import { parseXmltv, programmesForChannel } from "./xmltv.js";
import { MAX_EPG_SOURCES } from "../data/installation-sync.js";

const CACHE_TTL = 6 * 60 * 60 * 1000;
const WINDOW_MS = 4 * 60 * 60 * 1000;
const REFRESH_INTERVALS = new Set([0, 30, 60, 360, 1440]);

function unique(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function guidesFor(channel) {
  const endpoints = Array.isArray(channel?.endpoints) ? channel.endpoints : [];
  return [
    ...(Array.isArray(channel?.guides) ? channel.guides : []),
    ...endpoints.flatMap((endpoint) => Array.isArray(endpoint?.guides) ? endpoint.guides : []),
  ];
}

export function guideUrlsForChannel(channel) {
  return unique(guidesFor(channel).flatMap((guide) => (guide?.sources || [])
    .filter((source) => String(source?.format || "XML").toUpperCase() === "XML")
    .map((source) => source?.url)));
}

export function guideIdsForChannel(channel) {
  return unique([
    channel?.tvgId,
    channel?.id,
    channel?.channelId,
    ...guidesFor(channel).flatMap((guide) => [guide?.siteId, guide?.site_id]),
  ]);
}

function cacheKey(url) {
  let hash = 2166136261;
  for (const character of url) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return `epg:cache:v1:${(hash >>> 0).toString(16)}`;
}

function timeoutSignal() {
  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), 20_000);
  return { signal: controller.signal, cancel: () => globalThis.clearTimeout(timer) };
}

export class EpgService {
  #catalog;
  #fetch;
  #proxy;
  #memory = new Map();
  #inFlight = new Map();
  #customSources = [];
  #refreshMinutes = 360;
  #lastRefresh = 0;

  constructor({ catalog, fetchImpl = globalThis.fetch, proxy = null } = {}) {
    this.#catalog = catalog;
    this.#fetch = fetchImpl;
    this.#proxy = proxy;
  }

  async init() {
    this.#customSources = unique(await this.#catalog?.getSetting?.("epg:sources", []) || []);
    const refreshMinutes = Number(await this.#catalog?.getSetting?.("epg:refreshMinutes", 360));
    this.#refreshMinutes = REFRESH_INTERVALS.has(refreshMinutes) ? refreshMinutes : 360;
    this.#lastRefresh = Number(await this.#catalog?.getSetting?.("epg:lastRefresh", 0)) || 0;
    return this;
  }

  getSources() { return [...this.#customSources]; }
  getRefreshMinutes() { return this.#refreshMinutes; }
  getLastRefresh() { return this.#lastRefresh; }

  async setSources(sources) {
    const next = unique(Array.isArray(sources) ? sources : String(sources || "").split(/[\n,]+/));
    if (next.length > MAX_EPG_SOURCES) throw new RangeError(`TV Guide accepts at most ${MAX_EPG_SOURCES} sources`);
    next.forEach((value) => {
      const parsed = new URL(value);
      if (!/^https?:$/.test(parsed.protocol)) throw new TypeError("TV guide sources must use HTTP or HTTPS");
    });
    await this.#catalog?.setSetting?.("epg:sources", next);
    this.#customSources = next;
    return this.getSources();
  }

  async setRefreshMinutes(value) {
    const next = Number(value);
    if (!REFRESH_INTERVALS.has(next)) throw new RangeError("Unsupported TV guide refresh interval");
    await this.#catalog?.setSetting?.("epg:refreshMinutes", next);
    this.#refreshMinutes = next;
    return next;
  }

  async #loadOnce(url, { force = false } = {}) {
    const memory = this.#memory.get(url);
    if (!force && memory && Date.now() - memory.fetchedAt < CACHE_TTL) return memory.programmes;
    const key = cacheKey(url);
    const persisted = await this.#catalog?.getSetting?.(key, null);
    if (!force && persisted?.url === url && Date.now() - Number(persisted.fetchedAt || 0) < CACHE_TTL) {
      this.#memory.set(url, persisted);
      return persisted.programmes || [];
    }
    const cached = memory?.url === url ? memory : persisted?.url === url ? persisted : null;
    const candidates = [url];
    const proxied = typeof this.#proxy === "function" ? this.#proxy(url) : "";
    if (proxied) candidates.push(proxied);
    let lastError;
    for (const target of candidates) {
      try {
        const timeout = timeoutSignal();
        let response;
        try {
          response = await this.#fetch(target, {
            signal: timeout.signal,
            cache: force ? "no-cache" : "default",
          });
        }
        finally { timeout.cancel(); }
        if (response.status === 304 && cached?.programmes) {
          const record = { ...cached, fetchedAt: Date.now() };
          this.#memory.set(url, record);
          await this.#catalog?.setSetting?.(key, record);
          return record.programmes;
        }
        if (!response.ok) throw new Error(`TV guide request failed (${response.status})`);
        const length = Number(response.headers?.get?.("content-length") || 0);
        if (length > 20 * 1024 * 1024) throw new RangeError("TV guide is larger than 20 MB");
        const programmes = parseXmltv(await response.text());
        const record = {
          url,
          fetchedAt: Date.now(),
          programmes,
          etag: response.headers?.get?.("etag") || "",
          lastModified: response.headers?.get?.("last-modified") || "",
        };
        this.#memory.set(url, record);
        await this.#catalog?.setSetting?.(key, record);
        return programmes;
      } catch (error) { lastError = error; }
    }
    if (persisted?.programmes) return persisted.programmes;
    throw lastError || new Error("TV guide is unavailable");
  }

  async #load(url, options = {}) {
    const active = this.#inFlight.get(url);
    if (active) return active;
    const pending = this.#loadOnce(url, options).finally(() => this.#inFlight.delete(url));
    this.#inFlight.set(url, pending);
    return pending;
  }

  async schedule(channel, options = {}) {
    const from = Number(options.from ?? Date.now());
    const to = Number(options.to ?? from + WINDOW_MS);
    const urls = unique([...this.#customSources, ...guideUrlsForChannel(channel)]).slice(0, 8);
    if (!urls.length) return { programmes: [], status: "unconfigured", sources: [] };
    const settled = await Promise.allSettled(urls.map((url) => this.#load(url, { force: options.force === true })));
    const programmes = settled.flatMap((result) => result.status === "fulfilled" ? result.value : []);
    return {
      programmes: programmesForChannel(programmes, guideIdsForChannel(channel), { from, to }),
      status: settled.some((result) => result.status === "fulfilled") ? "ready" : "error",
      sources: urls,
    };
  }

  async schedules(channels, options = {}) {
    const entries = await Promise.all((Array.isArray(channels) ? channels : []).map(async (channel) => [
      String(channel?.channelId || channel?.id || ""),
      await this.schedule(channel, options),
    ]));
    const schedules = new Map(entries);
    if ([...schedules.values()].some((value) => value.status === "ready")) {
      this.#lastRefresh = Date.now();
      await this.#catalog?.setSetting?.("epg:lastRefresh", this.#lastRefresh);
    }
    return schedules;
  }
}
