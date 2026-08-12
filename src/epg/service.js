import { parseXmltv, programmesForChannel } from "./xmltv.js";

const CACHE_TTL = 6 * 60 * 60 * 1000;
const WINDOW_MS = 4 * 60 * 60 * 1000;

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
  #customSources = [];

  constructor({ catalog, fetchImpl = globalThis.fetch, proxy = null } = {}) {
    this.#catalog = catalog;
    this.#fetch = fetchImpl;
    this.#proxy = proxy;
  }

  async init() {
    this.#customSources = unique(await this.#catalog?.getSetting?.("epg:sources", []) || []);
    return this;
  }

  getSources() { return [...this.#customSources]; }

  async setSources(sources) {
    const next = unique(Array.isArray(sources) ? sources : String(sources || "").split(/[\n,]+/));
    next.forEach((value) => {
      const parsed = new URL(value);
      if (!/^https?:$/.test(parsed.protocol)) throw new TypeError("TV guide sources must use HTTP or HTTPS");
    });
    this.#customSources = next;
    await this.#catalog?.setSetting?.("epg:sources", next);
    return this.getSources();
  }

  async #load(url) {
    const memory = this.#memory.get(url);
    if (memory && Date.now() - memory.fetchedAt < CACHE_TTL) return memory.programmes;
    const key = cacheKey(url);
    const persisted = await this.#catalog?.getSetting?.(key, null);
    if (persisted?.url === url && Date.now() - Number(persisted.fetchedAt || 0) < CACHE_TTL) {
      this.#memory.set(url, persisted);
      return persisted.programmes || [];
    }
    const candidates = [url];
    const proxied = typeof this.#proxy === "function" ? this.#proxy(url) : "";
    if (proxied) candidates.push(proxied);
    let lastError;
    for (const target of candidates) {
      try {
        const timeout = timeoutSignal();
        let response;
        try { response = await this.#fetch(target, { signal: timeout.signal }); }
        finally { timeout.cancel(); }
        if (!response.ok) throw new Error(`TV guide request failed (${response.status})`);
        const length = Number(response.headers?.get?.("content-length") || 0);
        if (length > 20 * 1024 * 1024) throw new RangeError("TV guide is larger than 20 MB");
        const programmes = parseXmltv(await response.text());
        const record = { url, fetchedAt: Date.now(), programmes };
        this.#memory.set(url, record);
        await this.#catalog?.setSetting?.(key, record);
        return programmes;
      } catch (error) { lastError = error; }
    }
    if (persisted?.programmes) return persisted.programmes;
    throw lastError || new Error("TV guide is unavailable");
  }

  async schedule(channel, options = {}) {
    const from = Number(options.from ?? Date.now());
    const to = Number(options.to ?? from + WINDOW_MS);
    const urls = unique([...guideUrlsForChannel(channel), ...this.#customSources]).slice(0, 4);
    if (!urls.length) return { programmes: [], status: "unconfigured", sources: [] };
    const settled = await Promise.allSettled(urls.map((url) => this.#load(url)));
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
    return new Map(entries);
  }
}
