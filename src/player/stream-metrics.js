import { emit } from "./player-events.js";

function finite(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function bufferedAhead(video) {
  if (!video || !video.buffered) return 0;
  const time = finite(video.currentTime, 0);
  for (let index = 0; index < video.buffered.length; index += 1) {
    if (video.buffered.start(index) <= time && video.buffered.end(index) >= time) {
      return Math.max(0, video.buffered.end(index) - time);
    }
  }
  return 0;
}

function fragmentKey(data) {
  const fragment = data && data.frag ? data.frag : {};
  if (fragment.sn !== undefined) {
    return [fragment.level, fragment.cc, fragment.sn, fragment.urlId].join(":");
  }
  return fragment.url || (data && data.url) || null;
}

function fragmentBytes(data) {
  const stats = data && data.stats ? data.stats : {};
  if (finite(stats.loaded, -1) >= 0) return stats.loaded;
  if (data && data.payload && finite(data.payload.byteLength, -1) >= 0) return data.payload.byteLength;
  return 0;
}

function fragmentDurationSeconds(data) {
  const stats = data && data.stats ? data.stats : {};
  const start = finite(stats.loading && stats.loading.start, finite(stats.trequest, 0));
  const end = finite(stats.loading && stats.loading.end, finite(stats.tload, 0));
  return end > start ? (end - start) / 1000 : 0;
}

function levelDetails(level) {
  const attrs = level && level.attrs ? level.attrs : {};
  const codecs = [];
  if (level && level.videoCodec) codecs.push(level.videoCodec);
  if (level && level.audioCodec) codecs.push(level.audioCodec);
  return {
    bitrate: finite(level && level.bitrate, finite(level && level.averageBitrate, 0)),
    width: finite(level && level.width, finite(attrs.RESOLUTION && attrs.RESOLUTION.width, 0)),
    height: finite(level && level.height, finite(attrs.RESOLUTION && attrs.RESOLUTION.height, 0)),
    codecs: codecs.join(", ") || attrs.CODECS || null,
    videoCodec: (level && level.videoCodec) || null,
    audioCodec: (level && level.audioCodec) || null,
    frameRate: finite(level && level.frameRate, finite(attrs["FRAME-RATE"], 0))
  };
}

function decodedAudioBytes(video) {
  const value = finite(video && video.webkitAudioDecodedByteCount, -1);
  return value >= 0 ? value : null;
}

export class StreamMetrics extends EventTarget {
  constructor(options) {
    super();
    const settings = options || {};
    this.video = settings.video || null;
    this.onEvent = settings.onEvent || null;
    this.sampleIntervalMs = settings.sampleIntervalMs || 1000;
    this.route = null;
    this.proxy = false;
    this.hls = null;
    this.HlsClass = null;
    this.listeners = [];
    this.fragmentKeys = new Set();
    this.loadedBytes = 0;
    this.lastThroughput = 0;
    this.rebuffers = 0;
    this.waiting = false;
    this.hasPlayed = false;
    this.frames = { total: 0, dropped: 0, presented: 0, fps: 0 };
    this.lastFrameSample = null;
    this.audioDecodedBaseline = decodedAudioBytes(this.video) || 0;
    this.frameRequest = null;
    this.timer = null;
    this.started = false;
    this.handleWaiting = this.handleWaiting.bind(this);
    this.handlePlaying = this.handlePlaying.bind(this);
    this.handleFrame = this.handleFrame.bind(this);
  }

  start(video) {
    if (video) this.video = video;
    if (this.started || !this.video) return this;
    this.started = true;
    this.video.addEventListener("waiting", this.handleWaiting);
    this.video.addEventListener("stalled", this.handleWaiting);
    this.video.addEventListener("playing", this.handlePlaying);
    if (typeof this.video.requestVideoFrameCallback === "function") {
      this.frameRequest = this.video.requestVideoFrameCallback(this.handleFrame);
    }
    if (typeof setInterval === "function") {
      this.timer = setInterval(() => this.sample(), this.sampleIntervalMs);
    }
    return this;
  }

  setRoute(route, proxy) {
    this.route = route || "direct";
    this.proxy = Boolean(proxy);
    this.publish();
  }

  bindHls(hls, HlsClass) {
    this.unbindHls();
    this.hls = hls;
    this.HlsClass = HlsClass || null;
    const events = HlsClass && HlsClass.Events ? HlsClass.Events : {};
    this.bindHlsEvent(events.FRAG_LOADED || "hlsFragLoaded", (_, data) => this.recordFragment(data));
    this.bindHlsEvent(events.LEVEL_SWITCHED || "hlsLevelSwitched", () => this.publish());
    this.bindHlsEvent(events.LEVEL_LOADED || "hlsLevelLoaded", () => this.publish());
    return this;
  }

  bindHlsEvent(type, handler) {
    if (!this.hls || typeof this.hls.on !== "function") return;
    this.hls.on(type, handler);
    this.listeners.push({ type: type, handler: handler });
  }

  unbindHls() {
    if (this.hls && typeof this.hls.off === "function") {
      this.listeners.forEach((entry) => this.hls.off(entry.type, entry.handler));
    }
    this.listeners = [];
    this.hls = null;
    this.HlsClass = null;
  }

  recordFragment(data) {
    const key = fragmentKey(data);
    if (key && this.fragmentKeys.has(key)) return;
    if (key) this.fragmentKeys.add(key);
    const bytes = fragmentBytes(data);
    const seconds = fragmentDurationSeconds(data);
    this.loadedBytes += bytes;
    if (bytes > 0 && seconds > 0) this.lastThroughput = (bytes * 8) / seconds;
    this.publish();
  }

  handleWaiting() {
    if (this.waiting) return;
    if (this.video && this.video.ended) return;
    this.waiting = true;
    if (this.hasPlayed) this.rebuffers += 1;
    this.publish();
  }

  handlePlaying() {
    this.hasPlayed = true;
    this.waiting = false;
    this.publish();
  }

  handleFrame(now, metadata) {
    const presented = finite(metadata && metadata.presentedFrames, this.frames.presented + 1);
    if (this.lastFrameSample && now > this.lastFrameSample.now) {
      this.frames.fps = ((presented - this.lastFrameSample.presented) * 1000) / (now - this.lastFrameSample.now);
    }
    this.frames.presented = presented;
    this.lastFrameSample = { now: now, presented: presented };
    if (this.started && this.video && typeof this.video.requestVideoFrameCallback === "function") {
      this.frameRequest = this.video.requestVideoFrameCallback(this.handleFrame);
    }
  }

  sample() {
    if (this.video && typeof this.video.getVideoPlaybackQuality === "function") {
      const quality = this.video.getVideoPlaybackQuality() || {};
      this.frames.total = finite(quality.totalVideoFrames, this.frames.total);
      this.frames.dropped = finite(quality.droppedVideoFrames, this.frames.dropped);
    } else if (this.video) {
      this.frames.total = finite(this.video.webkitDecodedFrameCount, this.frames.total);
      this.frames.dropped = finite(this.video.webkitDroppedFrameCount, this.frames.dropped);
    }
    return this.publish();
  }

  snapshot() {
    const hls = this.hls;
    const levelIndex = hls ? finite(hls.currentLevel, finite(hls.loadLevel, -1)) : -1;
    const level = hls && hls.levels && levelIndex >= 0 ? hls.levels[levelIndex] : null;
    const manifest = levelDetails(level);
    const latency = hls && finite(hls.latency, -1) >= 0
      ? hls.latency
      : hls && finite(hls.liveSyncPosition, -1) >= 0 && this.video
        ? Math.max(0, hls.liveSyncPosition - finite(this.video.currentTime, 0))
        : null;
    const rawAudioBytes = decodedAudioBytes(this.video);
    const audioBytes = rawAudioBytes === null ? null : Math.max(0, rawAudioBytes - this.audioDecodedBaseline);
    const audioCodec = manifest.audioCodec || null;
    return {
      loadedBytes: this.loadedBytes,
      downloadThroughput: this.lastThroughput,
      bandwidthEstimate: hls ? finite(hls.bandwidthEstimate, 0) : 0,
      bitrate: manifest.bitrate,
      resolution: manifest.width && manifest.height ? { width: manifest.width, height: manifest.height } : null,
      codecs: manifest.codecs,
      frameRate: manifest.frameRate || this.frames.fps,
      frames: Object.assign({}, this.frames),
      bufferSeconds: bufferedAhead(this.video),
      latencySeconds: latency,
      rebuffers: this.rebuffers,
      waiting: this.waiting,
      audio: {
        codec: audioCodec,
        decodedBytes: audioBytes,
        decoded: audioBytes !== null && audioBytes > 0,
        muted: Boolean(this.video && this.video.muted),
        volume: this.video ? finite(this.video.volume, 1) : 0,
        paused: Boolean(this.video && this.video.paused),
        readyState: this.video ? finite(this.video.readyState, 0) : 0,
      },
      route: this.route || "direct",
      proxy: this.proxy,
      upload: null,
      uploadDisplay: "N/A",
      labels: {
        loadedBytes: "measured",
        downloadThroughput: "measured",
        bandwidthEstimate: "estimated",
        bitrate: "manifest",
        resolution: "manifest",
        codecs: "manifest",
        audioDecodedBytes: audioBytes === null ? "unavailable" : "measured",
        audioOutput: "measured",
        frameRate: manifest.frameRate ? "manifest" : "measured",
        bufferSeconds: "measured",
        latencySeconds: latency === null ? "unavailable" : "estimated",
        rebuffers: "measured",
        route: "configured",
        upload: "unavailable"
      }
    };
  }

  publish() {
    const snapshot = this.snapshot();
    emit(this, "metrics", snapshot, this.onEvent);
    return snapshot;
  }

  reset() {
    this.fragmentKeys.clear();
    this.loadedBytes = 0;
    this.lastThroughput = 0;
    this.rebuffers = 0;
    this.waiting = false;
    this.hasPlayed = false;
    this.frames = { total: 0, dropped: 0, presented: 0, fps: 0 };
    this.lastFrameSample = null;
    this.audioDecodedBaseline = decodedAudioBytes(this.video) || 0;
  }

  destroy() {
    this.unbindHls();
    if (this.video && this.started) {
      this.video.removeEventListener("waiting", this.handleWaiting);
      this.video.removeEventListener("stalled", this.handleWaiting);
      this.video.removeEventListener("playing", this.handlePlaying);
      if (this.frameRequest !== null && typeof this.video.cancelVideoFrameCallback === "function") {
        this.video.cancelVideoFrameCallback(this.frameRequest);
      }
    }
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.frameRequest = null;
    this.started = false;
    this.video = null;
  }
}
