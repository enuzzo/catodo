import { createHlsConfig } from "./hls-config.js";
import { emit } from "./player-events.js";
import { StreamMetrics } from "./stream-metrics.js";

function endpoint(value, defaults) {
  if (typeof value === "string") {
    return { url: value, route: defaults.route || "direct", proxy: Boolean(defaults.proxy) };
  }
  if (!value || !value.url) return null;
  return {
    url: value.url,
    route: value.route || defaults.route || (value.proxy ? "proxy" : "direct"),
    proxy: value.proxy === undefined ? Boolean(defaults.proxy) : Boolean(value.proxy),
    headers: { ...(value.headers || {}) },
    referrer: value.referrer || "",
  };
}

export function normalizeEndpoints(source) {
  const input = typeof source === "string" ? { url: source } : (source || {});
  const values = [];
  if (input.url) values.push(endpoint(input.url, { route: input.route, proxy: input.proxy }));
  (input.endpoints || []).forEach((item) => values.push(endpoint(item, {})));
  (input.fallbackUrls || []).forEach((item) => values.push(endpoint(item, { route: "fallback" })));
  if (input.fallbackUrl) values.push(endpoint(input.fallbackUrl, { route: "fallback" }));
  if (input.proxyUrl) values.push(endpoint(input.proxyUrl, { route: "proxy", proxy: true }));
  const seen = new Set();
  return values.filter((item) => {
    if (!item || seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}

function hlsSupported(HlsClass) {
  return Boolean(HlsClass && (typeof HlsClass.isSupported !== "function" || HlsClass.isSupported()));
}

const ENDPOINT_HEALTH_KEY = "catodo:endpoint-health";

function endpointHealth() {
  try { return JSON.parse(globalThis.localStorage?.getItem(ENDPOINT_HEALTH_KEY) || "{}") || {}; }
  catch { return {}; }
}

function preferLastWorking(values) {
  const health = endpointHealth();
  return [...values].sort((a, b) => Number(health[b.url]?.workedAt || 0) - Number(health[a.url]?.workedAt || 0));
}

export class PlayerSlot extends EventTarget {
  constructor(options) {
    super();
    const settings = options || {};
    this.id = settings.id || "player";
    this.video = null;
    this.HlsClass = settings.HlsClass || null;
    this.hlsFactory = settings.hlsFactory || null;
    this.hlsConfig = settings.hlsConfig || {};
    this.secondary = Boolean(settings.secondary);
    this.maxRetries = settings.maxRetries === undefined ? 2 : settings.maxRetries;
    this.maxMediaRecoveries = settings.maxMediaRecoveries === undefined ? 2 : settings.maxMediaRecoveries;
    this.retryDelayMs = settings.retryDelayMs === undefined ? 500 : settings.retryDelayMs;
    this.onEvent = settings.onEvent || null;
    this.metrics = settings.metrics || new StreamMetrics({ onEvent: (type, detail) => {
      if (type === "metrics") emit(this, "metrics", { slotId: this.id, metrics: detail }, this.onEvent);
    }});
    this.hls = null;
    this.endpoints = [];
    this.endpointIndex = -1;
    this.retries = 0;
    this.mediaRecoveries = 0;
    this.retryTimer = null;
    this.connectionListeners = [];
    this.destroyed = false;
    this.source = null;
    this.handleHlsError = this.handleHlsError.bind(this);
    this.handleNativeError = this.handleNativeError.bind(this);
    this.handlePlaying = this.handlePlaying.bind(this);
    if (settings.video) this.attach(settings.video);
  }

  getHlsClass() {
    return this.HlsClass || globalThis.Hls || null;
  }

  attach(video) {
    if (!video) throw new TypeError("PlayerSlot.attach requires a video element");
    if (this.video === video && !this.destroyed) return this;
    if (this.video) {
      this.detachMedia();
      this.metrics.destroy();
    }
    this.destroyed = false;
    this.video = video;
    this.video.autoplay = true;
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.addEventListener("error", this.handleNativeError);
    this.video.addEventListener("playing", this.handlePlaying);
    this.metrics.start(video);
    emit(this, "attached", { slotId: this.id, video: video }, this.onEvent);
    return this;
  }

  tune(source, options) {
    const settings = options || {};
    if (settings.video) this.attach(settings.video);
    if (!this.video) return Promise.reject(new Error("Attach a video element before tuning"));
    this.source = source;
    this.endpoints = preferLastWorking(normalizeEndpoints(source));
    if (!this.endpoints.length) return Promise.reject(new Error("No playable endpoint supplied"));
    this.metrics.reset();
    this.endpointIndex = -1;
    this.retries = 0;
    this.mediaRecoveries = 0;
    this.video.muted = settings.muted === undefined ? true : Boolean(settings.muted);
    return this.loadEndpoint(0, "tune");
  }

  loadEndpoint(index, reason) {
    if (index >= this.endpoints.length) {
      const error = new Error("All stream endpoints failed");
      emit(this, "fatal", { slotId: this.id, error: error, source: this.source }, this.onEvent);
      return Promise.reject(error);
    }
    this.clearRetry();
    this.teardownEngine();
    this.endpointIndex = index;
    this.retries = 0;
    this.mediaRecoveries = 0;
    const selected = this.endpoints[index];
    this.metrics.setRoute(selected.route, selected.proxy);
    emit(this, "tuning", {
      slotId: this.id,
      endpoint: selected,
      endpointIndex: index,
      endpointCount: this.endpoints.length,
      reason: reason
    }, this.onEvent);

    const HlsClass = this.getHlsClass();
    if (hlsSupported(HlsClass)) {
      const config = createHlsConfig({ secondary: this.secondary, overrides: this.hlsConfig });
      if (selected.headers && Object.keys(selected.headers).length) {
        config.xhrSetup = (xhr) => {
          for (const [name, value] of Object.entries(selected.headers)) {
            try { xhr.setRequestHeader(name, value); } catch { /* browser-forbidden header */ }
          }
        };
      }
      this.hls = this.hlsFactory ? this.hlsFactory(config) : new HlsClass(config);
      const events = HlsClass.Events || {};
      if (typeof this.hls.on === "function") {
        this.hls.on(events.ERROR || "hlsError", this.handleHlsError);
      }
      this.bindConnectionEvents(HlsClass, selected);
      this.metrics.bindHls(this.hls, HlsClass);
      this.hls.attachMedia(this.video);
      this.hls.loadSource(selected.url);
    } else if (this.canPlayNativeHls()) {
      emit(this, "progress", {
        slotId: this.id,
        phase: "native-loading",
        endpoint: selected,
        endpointIndex: index,
        endpointCount: this.endpoints.length,
      }, this.onEvent);
      this.video.src = selected.url;
      if (typeof this.video.load === "function") this.video.load();
    } else {
      const unsupported = new Error("HLS is not supported in this browser");
      emit(this, "fatal", { slotId: this.id, error: unsupported, endpoint: selected }, this.onEvent);
      return Promise.reject(unsupported);
    }

    const playResult = typeof this.video.play === "function" ? this.video.play() : null;
    return Promise.resolve(playResult).catch((error) => {
      emit(this, "autoplay-blocked", { slotId: this.id, error: error }, this.onEvent);
    }).then(() => {
      emit(this, "tuned", { slotId: this.id, endpoint: selected }, this.onEvent);
      return selected;
    });
  }

  canPlayNativeHls() {
    if (!this.video || typeof this.video.canPlayType !== "function") return false;
    return Boolean(
      this.video.canPlayType("application/vnd.apple.mpegurl") ||
      this.video.canPlayType("application/x-mpegURL")
    );
  }

  handlePlaying() {
    const selected = this.endpoints[this.endpointIndex];
    if (!selected?.url) return;
    try {
      const health = endpointHealth();
      health[selected.url] = { workedAt: Date.now(), route: selected.route || "direct" };
      const compact = Object.fromEntries(Object.entries(health).sort((a, b) => Number(b[1]?.workedAt || 0) - Number(a[1]?.workedAt || 0)).slice(0, 100));
      globalThis.localStorage?.setItem(ENDPOINT_HEALTH_KEY, JSON.stringify(compact));
    } catch { /* endpoint preference is an optional device-local optimisation */ }
  }

  bindConnectionEvents(HlsClass, endpointValue) {
    if (!this.hls || typeof this.hls.on !== "function") return;
    const events = HlsClass?.Events || {};
    const phases = [
      [events.MEDIA_ATTACHED, "media-attaching"],
      [events.MANIFEST_LOADING, "manifest-loading"],
      [events.MANIFEST_PARSED, "manifest-parsed"],
      [events.LEVEL_LOADING, "level-loading"],
      [events.FRAG_LOADING, "fragment-loading"],
      [events.FRAG_BUFFERED, "buffering"],
    ];
    const registered = new Set();
    phases.forEach(([type, phase]) => {
      if (!type || registered.has(type)) return;
      registered.add(type);
      const handler = () => emit(this, "progress", {
        slotId: this.id,
        phase,
        endpoint: endpointValue,
        endpointIndex: this.endpointIndex,
        endpointCount: this.endpoints.length,
      }, this.onEvent);
      this.hls.on(type, handler);
      this.connectionListeners.push({ hls: this.hls, type, handler });
    });
  }

  handleHlsError(_event, data) {
    if (!data || !data.fatal) {
      emit(this, "warning", { slotId: this.id, data: data }, this.onEvent);
      return;
    }
    const HlsClass = this.getHlsClass() || {};
    const types = HlsClass.ErrorTypes || {};
    if (data.type === types.MEDIA_ERROR || data.type === "mediaError") {
      if (this.mediaRecoveries < this.maxMediaRecoveries && this.hls && typeof this.hls.recoverMediaError === "function") {
        this.mediaRecoveries += 1;
        this.hls.recoverMediaError();
        emit(this, "recovering", {
          slotId: this.id,
          kind: "media",
          attempt: this.mediaRecoveries,
          endpoint: this.endpoints[this.endpointIndex],
          endpointIndex: this.endpointIndex,
          endpointCount: this.endpoints.length,
        }, this.onEvent);
        return;
      }
      this.fallback("media-error", data);
      return;
    }
    if (data.type === types.NETWORK_ERROR || data.type === "networkError") {
      this.retryOrFallback(data);
      return;
    }
    this.fallback("fatal-error", data);
  }

  handleNativeError(event) {
    if (!this.source || this.hls) return;
    this.retryOrFallback(event);
  }

  retryOrFallback(error) {
    if (this.retries >= this.maxRetries) {
      this.fallback("retry-exhausted", error);
      return;
    }
    this.retries += 1;
    emit(this, "retrying", {
      slotId: this.id,
      attempt: this.retries,
      error: error,
      endpoint: this.endpoints[this.endpointIndex],
      endpointIndex: this.endpointIndex,
      endpointCount: this.endpoints.length,
    }, this.onEvent);
    this.clearRetry();
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (this.hls && typeof this.hls.startLoad === "function") {
        this.hls.startLoad();
      } else if (this.video) {
        if (typeof this.video.load === "function") this.video.load();
        const result = typeof this.video.play === "function" ? this.video.play() : null;
        if (result && typeof result.catch === "function") result.catch(() => {});
      }
    }, this.retryDelayMs * this.retries);
  }

  fallback(reason, error) {
    const nextIndex = this.endpointIndex + 1;
    emit(this, "fallback", {
      slotId: this.id,
      from: this.endpoints[this.endpointIndex] || null,
      to: this.endpoints[nextIndex] || null,
      endpoint: this.endpoints[nextIndex] || null,
      endpointIndex: nextIndex,
      endpointCount: this.endpoints.length,
      reason: reason,
      error: error
    }, this.onEvent);
    this.loadEndpoint(nextIndex, reason).catch(() => {});
  }

  setMuted(muted) {
    if (this.video) this.video.muted = Boolean(muted);
    emit(this, "audio", { slotId: this.id, muted: Boolean(muted) }, this.onEvent);
  }

  setSecondary(secondary) {
    this.secondary = Boolean(secondary);
    if (this.hls) this.hls.autoLevelCapping = this.secondary ? 1 : -1;
  }

  getMetrics() {
    return this.metrics.snapshot();
  }

  clearRetry() {
    if (this.retryTimer !== null) clearTimeout(this.retryTimer);
    this.retryTimer = null;
  }

  teardownEngine() {
    this.connectionListeners.forEach(({ hls, type, handler }) => hls?.off?.(type, handler));
    this.connectionListeners = [];
    this.metrics.unbindHls();
    if (this.hls) {
      const HlsClass = this.getHlsClass();
      const events = HlsClass && HlsClass.Events ? HlsClass.Events : {};
      if (typeof this.hls.off === "function") this.hls.off(events.ERROR || "hlsError", this.handleHlsError);
      if (typeof this.hls.destroy === "function") this.hls.destroy();
      this.hls = null;
    }
  }

  detachMedia() {
    this.teardownEngine();
    if (this.video) {
      this.video.removeEventListener("error", this.handleNativeError);
      this.video.removeEventListener("playing", this.handlePlaying);
      if (typeof this.video.pause === "function") this.video.pause();
      this.video.removeAttribute("src");
      if (typeof this.video.load === "function") this.video.load();
    }
  }

  destroy() {
    if (this.destroyed) return;
    this.clearRetry();
    this.detachMedia();
    this.metrics.destroy();
    this.video = null;
    this.source = null;
    this.endpoints = [];
    this.destroyed = true;
    emit(this, "destroyed", { slotId: this.id }, this.onEvent);
  }
}
