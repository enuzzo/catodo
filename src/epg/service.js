import { guideChannelIdsFor, parseXmltvDocument } from "./xmltv.js";
import { MAX_EPG_SOURCES } from "../data/installation-sync.js";
import { migrateKnownEpgSources } from "./presets.js";

const CACHE_TTL = 6 * 60 * 60 * 1000;
const WINDOW_MS = 8 * 60 * 60 * 1000;
const BUILT_IN_PROXY_MAX_BYTES = 32 * 1024 * 1024;
const REFRESH_INTERVALS = new Set([0, 30, 60, 360, 1440]);

function unique(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function latestProgrammeAt(programmes) {
  return (Array.isArray(programmes) ? programmes : []).reduce((latest, item) => Math.max(latest, Number(item?.stop) || 0), 0);
}

function programmeKey(programme) {
  return [programme?.start, programme?.stop, programme?.title, programme?.subtitle].map((value) => String(value || "")).join("\u0000");
}

function uniqueProgrammes(programmes) {
  const seen = new Set();
  return (Array.isArray(programmes) ? programmes : []).filter((programme) => {
    const key = programmeKey(programme);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => a.start - b.start || a.stop - b.stop);
}

function preferProgrammeCandidate(current, candidate) {
  if (!current) return candidate;
  if (candidate.direct !== current.direct) return candidate.direct ? candidate : current;
  if (candidate.programmes.length !== current.programmes.length) {
    return candidate.programmes.length > current.programmes.length ? candidate : current;
  }
  if (candidate.sourceIndex !== current.sourceIndex) return candidate.sourceIndex < current.sourceIndex ? candidate : current;
  return candidate.idIndex < current.idIndex ? candidate : current;
}

function builtInProxyUrl(url) {
  try {
    const parsed = new URL(url);
    const openEpg = parsed.hostname === "www.open-epg.com" && /^\/files\/[a-z0-9_-]+\.xml$/i.test(parsed.pathname);
    const epgShare = parsed.hostname === "epgshare01.online" && /^\/epgshare01\/epg_ripper_(?:[A-Z]{2}1)\.xml\.gz$/.test(parsed.pathname);
    if (!openEpg && !epgShare) return "";
    return `./epg-cache.php?url=${encodeURIComponent(parsed.href)}`;
  } catch {
    return "";
  }
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

export function guideUrlsForChannels(channels) {
  return unique((Array.isArray(channels) ? channels : []).flatMap(guideUrlsForChannel));
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
  #sourceStatus = new Map();

  constructor({ catalog, fetchImpl = globalThis.fetch, proxy = null } = {}) {
    this.#catalog = catalog;
    this.#fetch = typeof fetchImpl === "function" ? fetchImpl.bind(globalThis) : fetchImpl;
    this.#proxy = proxy;
  }

  async init() {
    const storedSources = unique(await this.#catalog?.getSetting?.("epg:sources", []) || []);
    this.#customSources = migrateKnownEpgSources(storedSources).slice(0, MAX_EPG_SOURCES);
    if (this.#customSources.join("\n") !== storedSources.join("\n")) {
      await this.#catalog?.setSetting?.("epg:sources", this.#customSources);
    }
    const refreshMinutes = Number(await this.#catalog?.getSetting?.("epg:refreshMinutes", 360));
    this.#refreshMinutes = REFRESH_INTERVALS.has(refreshMinutes) ? refreshMinutes : 360;
    this.#lastRefresh = Number(await this.#catalog?.getSetting?.("epg:lastRefresh", 0)) || 0;
    const statuses = await this.#catalog?.getSetting?.("epg:sourceStatus", []) || [];
    this.#sourceStatus = new Map((Array.isArray(statuses) ? statuses : []).map((item) => [item.url, item]));
    return this;
  }

  getSources() { return [...this.#customSources]; }
  getRefreshMinutes() { return this.#refreshMinutes; }
  getLastRefresh() { return this.#lastRefresh; }
  getSourceStatuses() { return this.#customSources.map((url) => ({ url, ...(this.#sourceStatus.get(url) || {}) })); }

  async #rememberSourceStatus(url, status) {
    this.#sourceStatus.set(url, { url, ...(this.#sourceStatus.get(url) || {}), ...status });
    await this.#catalog?.setSetting?.("epg:sourceStatus", [...this.#sourceStatus.values()].slice(-MAX_EPG_SOURCES));
  }

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
    if (!force && memory && Array.isArray(memory.channels) && Date.now() - memory.fetchedAt < CACHE_TTL) return memory;
    const key = cacheKey(url);
    const persisted = await this.#catalog?.getSetting?.(key, null);
    if (!force && persisted?.url === url && Array.isArray(persisted.channels) && Date.now() - Number(persisted.fetchedAt || 0) < CACHE_TTL) {
      this.#memory.set(url, persisted);
      return persisted;
    }
    const cached = memory?.url === url && Array.isArray(memory.channels)
      ? memory
      : persisted?.url === url && Array.isArray(persisted.channels) ? persisted : null;
    const builtInProxy = builtInProxyUrl(url);
    const candidates = builtInProxy ? [builtInProxy] : [url];
    const proxied = typeof this.#proxy === "function" ? this.#proxy(url) : "";
    if (proxied) candidates.push(proxied);
    let lastError;
    for (const target of candidates) {
      try {
        const timeout = timeoutSignal();
        let response;
        try {
          const headers = {};
          if (cached?.etag) headers["If-None-Match"] = cached.etag;
          if (cached?.lastModified) headers["If-Modified-Since"] = cached.lastModified;
          response = await this.#fetch(target, {
            signal: timeout.signal,
            cache: force ? "no-cache" : "default",
            headers,
          });
        }
        finally { timeout.cancel(); }
        if (response.status === 304 && cached?.programmes) {
          const record = { ...cached, fetchedAt: Date.now() };
          this.#memory.set(url, record);
          await this.#catalog?.setSetting?.(key, record);
          await this.#rememberSourceStatus(url, { state: "ready", fetchedAt: record.fetchedAt, programmeCount: record.programmes?.length || 0, channelCount: record.channels?.length || 0, latestProgrammeAt: latestProgrammeAt(record.programmes) });
          return record;
        }
        if (!response.ok) throw new Error(`TV guide request failed (${response.status})`);
        const maxBytes = target === builtInProxy ? BUILT_IN_PROXY_MAX_BYTES : 20 * 1024 * 1024;
        const length = Number(response.headers?.get?.("content-length") || 0);
        if (length > maxBytes) throw new RangeError(`TV guide is larger than ${Math.round(maxBytes / 1024 / 1024)} MB`);
        const document = parseXmltvDocument(await response.text(), { limits: { maxBytes } });
        const record = {
          url,
          fetchedAt: Date.now(),
          programmes: document.programmes,
          channels: document.channels,
          etag: response.headers?.get?.("etag") || "",
          lastModified: response.headers?.get?.("last-modified") || "",
        };
        this.#memory.set(url, record);
        await this.#catalog?.setSetting?.(key, record);
        await this.#rememberSourceStatus(url, { state: "ready", error: "", fetchedAt: record.fetchedAt, programmeCount: record.programmes.length, channelCount: record.channels.length, latestProgrammeAt: latestProgrammeAt(record.programmes) });
        return record;
      } catch (error) {
        lastError = error;
        await this.#rememberSourceStatus(url, { state: "error", error: error?.message || String(error), checkedAt: Date.now() });
      }
    }
    if (persisted?.programmes) {
      await this.#rememberSourceStatus(url, { state: "cached", error: lastError?.message || "Refresh failed", fetchedAt: persisted.fetchedAt, programmeCount: persisted.programmes.length, channelCount: persisted.channels?.length || 0, latestProgrammeAt: latestProgrammeAt(persisted.programmes) });
      return persisted;
    }
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
    const schedules = await this.schedules([channel], options);
    return schedules.get(String(channel?.channelId || channel?.id || "")) || { programmes: [], status: "unconfigured", sources: [], matched: false };
  }

  async schedules(channels, options = {}) {
    const from = Number(options.from ?? Date.now());
    const to = Number(options.to ?? from + WINDOW_MS);
    const values = Array.isArray(channels) ? channels : [];
    const mappedUrls = unique(values.flatMap(guideUrlsForChannel));
    const sourceScope = Array.isArray(options.sourceUrls) ? new Set(unique(options.sourceUrls)) : null;
    const scopedSources = sourceScope
      ? this.#customSources.filter((url) => sourceScope.has(url))
      : this.#customSources;
    const urls = unique([
      ...mappedUrls,
      ...(options.preferMapped === true && mappedUrls.length ? [] : scopedSources),
    ]);
    if (!urls.length) return new Map(values.map((channel) => [String(channel?.channelId || channel?.id || ""), { programmes: [], status: "unconfigured", sources: [], matched: false }]));
    const settled = await Promise.allSettled(urls.map((url) => this.#load(url, { force: options.force === true })));
    const documents = settled.flatMap((result, index) => {
      if (result.status !== "fulfilled") return [];
      const record = { url: urls[index], ...result.value };
      const programmesByChannel = new Map();
      for (const programme of record.programmes || []) {
        const key = String(programme.channel || "").toLocaleLowerCase("en-US");
        if (!programmesByChannel.has(key)) programmesByChannel.set(key, []);
        programmesByChannel.get(key).push(programme);
      }
      const sourceLatestProgrammeAt = latestProgrammeAt(record.programmes);
      return [{
        ...record,
        programmesByChannel,
        latestProgrammeAt: sourceLatestProgrammeAt,
        dataState: !record.programmes?.length ? "empty" : sourceLatestProgrammeAt <= from ? "stale" : "current",
        registryIds: new Set((record.channels || []).map((entry) => String(entry.id).toLocaleLowerCase("en-US"))),
      }];
    });
    const matchCounts = new Map(urls.map((url) => [url, 0]));
    const entries = values.map((channel) => {
      const directIds = guideIdsForChannel(channel);
      const normalizedDirectIds = new Set(directIds.map((id) => String(id).toLocaleLowerCase("en-US")));
      let matched = false;
      const matchedDataStates = [];
      let selectedProgrammeCandidate = null;
      documents.forEach((document, sourceIndex) => {
        const ids = unique([...directIds, ...guideChannelIdsFor(channel, document.channels)]);
        const normalizedIds = [...new Set(ids.map((id) => String(id).toLocaleLowerCase("en-US")))];
        const sourceMatched = normalizedIds.some((id) => document.registryIds.has(id) || document.programmesByChannel.has(id));
        if (sourceMatched) {
          matched = true;
          matchedDataStates.push(document.dataState);
          matchCounts.set(document.url, (matchCounts.get(document.url) || 0) + 1);
        }
        normalizedIds.forEach((id, idIndex) => {
          const programmes = uniqueProgrammes((document.programmesByChannel.get(id) || [])
            .filter((item) => item.stop > from && item.start < to));
          if (!programmes.length) return;
          selectedProgrammeCandidate = preferProgrammeCandidate(selectedProgrammeCandidate, {
            direct: normalizedDirectIds.has(id),
            idIndex,
            programmes,
            sourceIndex,
          });
        });
      });
      return [String(channel?.channelId || channel?.id || ""), {
        programmes: selectedProgrammeCandidate?.programmes || [],
        status: documents.length
          ? matched
            ? matchedDataStates.some((state) => state === "current") ? "ready" : "stale"
            : "unmatched"
          : "error",
        sources: urls,
        matched,
      }];
    });
    const documentByUrl = new Map(documents.map((document) => [document.url, document]));
    await Promise.all([...matchCounts].map(([url, matchedChannels]) => {
      const document = documentByUrl.get(url);
      return this.#rememberSourceStatus(url, {
        matchedChannels,
        ...(document ? { dataState: document.dataState, latestProgrammeAt: document.latestProgrammeAt } : {}),
      });
    }));
    const schedules = new Map(entries);
    if (documents.length) {
      this.#lastRefresh = Date.now();
      await this.#catalog?.setSetting?.("epg:lastRefresh", this.#lastRefresh);
    }
    return schedules;
  }
}
