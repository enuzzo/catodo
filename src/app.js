import { playAnalogBoot } from "./boot/signal-hyperjump.js";
import Hls from "hls.js";
import {
  CatalogService,
  SOURCE_PRESETS,
  countryPlaylistUrl,
  filterCountriesByRegion,
  parseDeepLink,
  regionForCountry,
  sourcePreset,
} from "./data/index.js";
import i18n from "./i18n/index.js";
import { MultiviewController, PlayerManager } from "./player/index.js";
import { mountAppUI } from "./ui/markup.js";
import { EpgService, epgPreset } from "./epg/index.js";
import { filterChannelPicker } from "./ui/channel-picker-filter.js";
import { buildExploreCollections, pickExploreFeatured } from "./ui/explore-model.js";
import { multiviewTelemetry, singleTelemetry } from "./ui/telemetry-model.js";
import { resetWorldMapView, zoomWorldMap } from "./ui/world-map.js";

const UI_CHANNEL_LIMIT = 72;
const MULTIVIEW_MAX = 4;
const PLAYABLE_KINDS = new Set(["hls"]);
const TONE_BY_COUNTRY = ["blue", "cyan", "green", "yellow", "magenta", "red", "white"];
const QA_MODE = new URLSearchParams(location.search).has("qa");

const state = {
  view: "home",
  exploreCategory: "all",
  exploreFeaturedId: "",
  query: "",
  libraryQuery: "",
  countryQuery: "",
  countryRegion: "all",
  countrySort: "channels",
  countryMode: "map",
  selectedCountry: "",
  activeCountry: "",
  countryChannelQuery: "",
  countryChannelCategory: "",
  countryChannelLanguage: "",
  countryChannelLimit: UI_CHANNEL_LIMIT,
  featuredId: "",
  currentId: "",
  homeMuted: true,
  playerMuted: false,
  playerVolume: 100,
  playerLastAudibleVolume: 100,
  multiviewLayout: 4,
  multiviewFeeds: [],
  multiviewAudioIndex: null,
  multiviewChromeVisible: true,
  multiviewPickerSlot: null,
  multiviewPickerQuery: "",
  libraryCategory: "",
  libraryLanguage: "",
  libraryFavoritesOnly: false,
  libraryLimit: UI_CHANNEL_LIMIT,
  worldMixIds: [],
  homeFailureCount: 0,
  homeFailedIds: [],
  proxy: "",
  lastCatalog: null,
  throughputHistory: [],
  multiviewTelemetry: null,
  epgSources: [],
  epgRefreshMinutes: 360,
  epgLastRefresh: 0,
  schedules: new Map(),
  guideLoading: false,
  guideError: "",
  playerChromeVisible: false,
  playerReturnMode: "shell",
};

let catalog;
let ui;
let homePlayer;
let explorePlayer;
let mainPlayer;
let multiview;
let epg;
let unsubscribeCatalog;
let metricTimer;
let clockTimer;
let epgTimer;
let lastRememberedId = "";
let directoryMaps = { byCode: new Map(), byName: new Map() };
let playerChromeTimer = 0;
let multiviewChromeTimer = 0;
let multiviewPointerAt = 0;

function legacyStorage() {
  try { return globalThis.localStorage || undefined; }
  catch { return undefined; }
}

function t(key, fallback, vars = {}) {
  return i18n.t(key, fallback, vars);
}

function channelId(channel) {
  return String(channel?.channelId || channel?.id || "");
}

function firstEndpoint(channel) {
  return (channel?.endpoints || []).find((endpoint) => endpoint?.url) || null;
}

function isPlayableChannel(channel) {
  if (channel?.blocked || channel?.isNsfw || channel?.is_nsfw || channel?.closed) return false;
  return (channel?.endpoints || []).some((endpoint) => PLAYABLE_KINDS.has(endpoint?.kind));
}

function playableChannels(channels = state.lastCatalog?.channels || []) {
  return channels.filter(isPlayableChannel);
}

function findChannel(id) {
  return state.lastCatalog?.channels.find((channel) => channelId(channel) === id) || null;
}

function normalizedCountryLabel(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLocaleLowerCase("en-US");
}

function countryDirectoryMaps() {
  return directoryMaps;
}

function rebuildCountryDirectoryMaps(countries = []) {
  const byCode = new Map();
  const byName = new Map();
  for (const country of countries) {
    const code = String(country.code || "").toUpperCase();
    if (!/^[A-Z]{2}$/.test(code)) continue;
    byCode.set(code, country);
    byName.set(normalizedCountryLabel(country.name), code);
  }
  directoryMaps = { byCode, byName };
}

function countryFromSource(source) {
  try {
    const match = new URL(source?.url).pathname.match(/\/countries\/([a-z]{2})\.m3u$/i);
    if (match) return match[1].toUpperCase();
  } catch {
    // Migrated local sources can lack a valid remote URL.
  }
  const token = String(source?.name || "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(token) ? token : "";
}

function inferredCountryCode(channel) {
  const direct = String(channel?.countries?.[0] || channel?.country || "").toUpperCase();
  if (/^[A-Z]{2}$/.test(direct)) return direct;

  const sourceIds = new Set(channel?.sources || (channel?.source ? [channel.source] : []));
  for (const source of state.lastCatalog?.sources || []) {
    if (!sourceIds.has(source.sourceId)) continue;
    const code = countryFromSource(source);
    if (code) return code;
  }

  const { byCode, byName } = countryDirectoryMaps();
  for (const candidate of [channel?.groupTitle, ...(channel?.categories || [])]) {
    const token = String(candidate || "").trim().toUpperCase();
    if (byCode.has(token)) return token;
    const code = byName.get(normalizedCountryLabel(candidate));
    if (code) return code;
  }
  return "";
}

function proxyUrl(target) {
  if (!state.proxy || !target) return "";
  return `${state.proxy.replace(/\/+$/, "")}/?url=${encodeURIComponent(target)}`;
}

function playbackSource(channel) {
  const compatible = (channel?.endpoints || []).filter((endpoint) => PLAYABLE_KINDS.has(endpoint?.kind));
  const endpoints = [];
  for (const endpoint of compatible) {
    endpoints.push({
      url: endpoint.url,
      route: "direct",
      proxy: false,
      headers: endpoint.headers,
      referrer: endpoint.referrer,
    });
    if (state.proxy) endpoints.push({ url: proxyUrl(endpoint.url), route: "proxy", proxy: true });
  }
  return { endpoints };
}

function cachedLogoUrl(value) {
  const url = String(value || "").trim();
  if (!url) return "";
  try {
    const parsed = new URL(url, location.href);
    if (parsed.origin === location.origin || parsed.protocol !== "https:") return url;
    return `./logo-cache.php?url=${encodeURIComponent(parsed.href)}`;
  } catch {
    return url;
  }
}

function decorateChannel(channel, index = 0) {
  if (!channel) return null;
  const country = inferredCountryCode(channel);
  const directoryCountry = countryDirectoryMaps().byCode.get(country);
  const endpoint = firstEndpoint(channel);
  return {
    ...channel,
    id: channelId(channel),
    country: channel.countryNames?.[0] || directoryCountry?.name || country,
    countryCode: country,
    language: channel.languages?.[0] || channel.language || directoryCountry?.languages?.[0] || "",
    quality: endpoint?.quality || channel.quality || channel.feedFormat || "",
    tone: TONE_BY_COUNTRY[(country.charCodeAt?.(0) || index) % TONE_BY_COUNTRY.length],
    favorite: state.lastCatalog?.favorites.has(channelId(channel)) || false,
    logo: cachedLogoUrl(channel.logo),
    originalLogo: channel.logo || "",
    poster: channel.poster || channel.image || channel.thumbnail || cachedLogoUrl(channel.logo) || "",
    schedule: state.schedules.get(channelId(channel))?.programmes || [],
    guideStatus: state.schedules.get(channelId(channel))?.status || "unconfigured",
  };
}

function shuffled(values) {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const next = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[next]] = [copy[next], copy[index]];
  }
  return copy;
}

function refreshWorldMix() {
  const byCountry = new Map();
  for (const [index, channel] of shuffled(playableChannels()).entries()) {
    const country = inferredCountryCode(channel) || `UN-${index % 10}`;
    if (!byCountry.has(country)) byCountry.set(country, []);
    byCountry.get(country).push(channel);
  }
  const groups = shuffled([...byCountry.values()]);
  const selected = [];
  while (selected.length < 10 && groups.some((group) => group.length)) {
    for (const group of groups) {
      if (group.length && selected.length < 10) selected.push(group.shift());
    }
  }
  state.worldMixIds = selected.map(channelId);
}

function countryViewModel(directoryCountry, statsByCode, sourceCountries) {
  const code = String(directoryCountry.code || "").toUpperCase();
  const stats = statsByCode.get(code);
  return {
    ...directoryCountry,
    iso2: code,
    code,
    region: directoryCountry.region || regionForCountry(code) || "",
    language: directoryCountry.languages?.join(", ") || "—",
    channelCount: stats?.channels || 0,
    categories: stats?.categories || [],
    imported: sourceCountries.has(code) || Boolean(stats?.channels),
    provider: "iptv-org",
    host: "iptv-org.github.io",
    source: "Public country playlist directory",
    sourceUrl: "https://github.com/iptv-org/iptv",
    url: countryPlaylistUrl(code),
  };
}

function sourceCountryCodes(sources = []) {
  const codes = new Set();
  for (const source of sources) {
    try {
      const match = new URL(source.url).pathname.match(/\/countries\/([a-z]{2})\.m3u$/i);
      if (match) codes.add(match[1].toUpperCase());
    } catch {
      // A migrated local source may no longer expose a valid remote URL.
    }
  }
  return codes;
}

function countryModels() {
  const snapshot = state.lastCatalog;
  if (!snapshot) return [];
  const stats = new Map(inferredCountryStats().map((item) => [item.country, item]));
  const imported = sourceCountryCodes(snapshot.sources);
  return snapshot.countries.map((country) => countryViewModel(country, stats, imported));
}

function importedIso2() {
  return [...sourceCountryCodes(state.lastCatalog?.sources)];
}

function countryCounts() {
  return Object.fromEntries(inferredCountryStats().map((item) => [item.country, item.channels]));
}

function inferredCountryStats() {
  const stats = new Map();
  for (const channel of state.lastCatalog?.channels || []) {
    const country = inferredCountryCode(channel);
    if (!country) continue;
    const current = stats.get(country) || { country, channels: 0, categories: new Set() };
    current.channels += 1;
    for (const category of channel.categories || []) current.categories.add(category);
    stats.set(country, current);
  }
  return [...stats.values()].map((item) => ({ ...item, categories: [...item.categories].sort() }));
}

function formatClock() {
  const parts = new Intl.DateTimeFormat(i18n.locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZoneName: "short",
  }).formatToParts(new Date());
  const hour = parts.find((part) => part.type === "hour")?.value || "--";
  const minute = parts.find((part) => part.type === "minute")?.value || "--";
  const zone = parts.find((part) => part.type === "timeZoneName")?.value || "";
  return `${hour}:${minute} ${zone}`.trim();
}

function formatBytes(value) {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)));
  return `${(value / (1024 ** index)).toFixed(index > 1 ? 1 : 0)} ${units[index]}`;
}

function formatRate(value) {
  return `${((Number(value) || 0) / 1_000_000).toFixed(2)} Mbps`;
}

function formatSeconds(value) {
  return Number.isFinite(value) ? `${value.toFixed(1)} s` : "N/A";
}

function metricsForUi(metrics) {
  const resolution = metrics.resolution ? `${metrics.resolution.width} × ${metrics.resolution.height}` : "N/A";
  const codecs = String(metrics.codecs || "N/A").split(/\s*,\s*/);
  return {
    received: { value: formatBytes(metrics.loadedBytes), state: metrics.labels.loadedBytes },
    throughput: { value: formatRate(metrics.downloadThroughput), state: metrics.labels.downloadThroughput },
    abrEstimate: { value: formatRate(metrics.bandwidthEstimate), state: metrics.labels.bandwidthEstimate },
    buffer: { value: formatSeconds(metrics.bufferSeconds), state: metrics.labels.bufferSeconds },
    latency: { value: formatSeconds(metrics.latencySeconds), state: metrics.labels.latencySeconds },
    resolution: { value: resolution, state: metrics.labels.resolution },
    video: { value: codecs[0] || "N/A", state: metrics.labels.codecs },
    audio: { value: codecs[1] || "N/A", state: metrics.labels.codecs },
    audioOutput: {
      value: metrics.audio?.muted ? "MUTED" : metrics.audio?.paused ? "PAUSED" : `${Math.round((metrics.audio?.volume ?? 1) * 100)}%`,
      state: metrics.labels.audioOutput,
    },
    audioDecoded: {
      value: metrics.audio?.decodedBytes === null || metrics.audio?.decodedBytes === undefined ? "N/A" : formatBytes(metrics.audio.decodedBytes),
      state: metrics.labels.audioDecodedBytes,
    },
    fps: { value: `${(metrics.frameRate || 0).toFixed(1)} fps`, state: metrics.labels.frameRate },
    dropped: { value: String(metrics.frames?.dropped || 0), state: "measured" },
    level: { value: metrics.bitrate ? formatRate(metrics.bitrate) : "AUTO", state: metrics.labels.bitrate },
    route: { value: metrics.proxy ? "PROXY" : "DIRECT", state: metrics.labels.route },
  };
}

function playerAudioStatus(metrics = mainPlayer?.getMetrics?.() || {}) {
  const audio = metrics.audio || {};
  const muted = state.playerMuted || ui?.refs?.playerVideo?.muted || state.playerVolume === 0;
  if (muted) return { label: "Muted", tone: "muted", detail: `Output muted · volume ${state.playerVolume}%` };
  if (audio.paused) return { label: "Audio paused", tone: "muted", detail: "Playback is paused" };
  if (audio.decoded) {
    return {
      label: "Audio decoded",
      tone: "live",
      detail: `${audio.codec || "audio track"} · ${formatBytes(audio.decodedBytes)} decoded · volume ${state.playerVolume}%`,
    };
  }
  if (audio.codec) return { label: "Audio track found", tone: "checking", detail: `${audio.codec} · waiting for decoded bytes` };
  return { label: "Checking audio", tone: "checking", detail: "Waiting for the stream audio track" };
}

function playerUiState(extra = {}) {
  return {
    channel: decorateChannel(findChannel(state.currentId)),
    muted: state.playerMuted,
    volume: state.playerVolume,
    audioStatus: playerAudioStatus(),
    ...extra,
  };
}

async function applyPlayerAudio({ resume = false } = {}) {
  const volume = Math.max(0, Math.min(100, Number(state.playerVolume) || 0));
  state.playerVolume = volume;
  state.playerMuted = Boolean(state.playerMuted || volume === 0);
  ui.refs.playerVideo.volume = volume / 100;
  mainPlayer.setMuted(state.playerMuted);
  if (resume && !state.playerMuted) await ui.refs.playerVideo.play().catch(() => {});
  ui.updatePlayer(playerUiState());
}

function setHomeFeatured(channel, { retune = true, resetFailures = true } = {}) {
  if (!channel) return;
  if (resetFailures) {
    state.homeFailureCount = 0;
    state.homeFailedIds = [];
  }
  state.featuredId = channelId(channel);
  renderHome();
  if (retune) tuneHome(channel);
}

function nextRandomHomeChannel() {
  const playable = playableChannels();
  if (!playable.length) return null;
  const next = catalog.randomPlayable({ currentChannelId: state.featuredId, filters: {} });
  if (next && isPlayableChannel(next) && (playable.length === 1 || channelId(next) !== state.featuredId)) return next;
  const alternatives = playable.filter((channel) => channelId(channel) !== state.featuredId);
  const pool = alternatives.length ? alternatives : playable;
  return pool[Math.floor(Math.random() * pool.length)] || null;
}

function renderHome() {
  const snapshot = state.lastCatalog;
  if (!snapshot) return;
  const allPlayable = playableChannels();
  const featured = findChannel(state.featuredId) || allPlayable[0] || snapshot.channels[0] || null;
  if (featured && !state.featuredId) state.featuredId = channelId(featured);
  if (!state.worldMixIds.some((id) => findChannel(id))) refreshWorldMix();
  const worldMix = state.worldMixIds.map(findChannel).filter(Boolean);
  const savedFavorites = catalog.list({ favorite: true }).map(decorateChannel).filter(Boolean);
  const favorites = QA_MODE && !savedFavorites.length
    ? worldMix.slice(0, 5).map(decorateChannel).filter(Boolean)
    : savedFavorites;
  const mixCountries = new Set(worldMix.map(inferredCountryCode).filter(Boolean));
  const markers = worldMix
    .map((channel, index) => ({
      iso2: inferredCountryCode(channel),
      label: index + 1,
      tone: decorateChannel(channel, index)?.tone,
    }))
    .filter((marker) => marker.iso2);
  if (QA_MODE && markers.length < 5) {
    const demoCodes = ["FR", "DE", "EG", "IN", "JP", "US", "BR", "ZA", "AU", "AR"];
    demoCodes.slice(markers.length, 10).forEach((iso2, index) => {
      markers.push({ iso2, label: markers.length + index + 1 });
    });
  }
  const allPlayableCountries = new Set(allPlayable.map(inferredCountryCode).filter(Boolean));
  ui.renderHome({
    activate: state.view === "home",
    featured: featured ? { ...decorateChannel(featured), muted: state.homeMuted, autoplay: true } : null,
    channels: worldMix.map(decorateChannel),
    favorites: favorites.slice(0, 5),
    liveCount: allPlayable.length,
    countryCount: allPlayableCountries.size,
    selectedIso2: inferredCountryCode(featured),
    importedIso2: importedIso2(),
    availableIso2: snapshot.countries.map((country) => country.code),
    markers,
    countryCounts: countryCounts(),
    time: formatClock(),
  });
}

function exploreCollections() {
  return buildExploreCollections(playableChannels().map(decorateChannel).filter(Boolean), {
    activeCategory: state.exploreCategory,
    limit: 12,
  });
}

function renderExplore() {
  const collections = exploreCollections();
  const featured = pickExploreFeatured(collections, state.exploreFeaturedId);
  if (featured) state.exploreFeaturedId = channelId(featured);
  ui.renderExplore({
    activate: state.view === "explore",
    category: state.exploreCategory,
    collections,
    featured: featured ? { ...featured, muted: true, autoplay: state.view === "explore" } : null,
  });
  if (state.view !== "explore") ui.refs.exploreVideo.pause();
}

function renderCountries() {
  let countries = countryModels();
  countries = filterCountriesByRegion(countries, state.countryRegion);
  if (state.countryQuery) {
    const query = state.countryQuery.toLocaleLowerCase("en-US");
    countries = countries.filter((country) => `${country.code} ${country.name}`.toLocaleLowerCase("en-US").includes(query));
  }
  countries.sort(state.countrySort === "az"
    ? (a, b) => a.name.localeCompare(b.name)
    : (a, b) => b.channelCount - a.channelCount || a.name.localeCompare(b.name));
  const selected = state.selectedCountry
    ? countryModels().find((country) => country.code === state.selectedCountry) || null
    : null;
  const selectedChannelFilters = selected ? {
    country: selected.code,
    query: state.countryChannelQuery || undefined,
    category: state.countryChannelCategory || undefined,
    language: state.countryChannelLanguage || undefined,
  } : null;
  const selectedCountryChannels = selected ? catalog.list({ country: selected.code }).filter(isPlayableChannel) : [];
  const matchingCountryChannels = selectedChannelFilters
    ? catalog.list(selectedChannelFilters).filter(isPlayableChannel)
    : [];
  state.activeCountry = selected?.code || "";
  ui.renderCountries({
    activate: state.view === "countries",
    countries,
    selectedCountry: selected,
    selectedIso2: selected?.code,
    importedIso2: importedIso2(),
    availableIso2: state.lastCatalog?.countries.map((country) => country.code),
    countryCounts: countryCounts(),
    query: state.countryQuery,
    region: state.countryRegion,
    sort: state.countrySort,
    mode: state.countryMode,
    countryChannels: matchingCountryChannels.slice(0, state.countryChannelLimit).map(decorateChannel),
    countryChannelTotal: selectedCountryChannels.length,
    countryChannelFilteredTotal: matchingCountryChannels.length,
    countryChannelQuery: state.countryChannelQuery,
    countryChannelCategory: state.countryChannelCategory,
    countryChannelLanguage: state.countryChannelLanguage,
    countryChannelCategories: [...new Set(selectedCountryChannels.flatMap((channel) => channel.categories || []))].sort(),
    countryChannelLanguages: [...new Set(selectedCountryChannels.flatMap((channel) => channel.languages || []))].sort(),
  });
}

function renderLibrary() {
  const filters = {
    query: state.libraryQuery || undefined,
    category: state.libraryCategory || undefined,
    language: state.libraryLanguage || undefined,
    favorite: state.libraryFavoritesOnly || undefined,
  };
  const matchingChannels = catalog.list(filters);
  const channels = matchingChannels.slice(0, state.libraryLimit);
  const allChannels = state.lastCatalog?.channels || [];
  ui.renderLibrary({
    activate: state.view === "library",
    channels: channels.map(decorateChannel),
    favoriteCount: state.lastCatalog?.favorites.size || 0,
    channelCount: state.lastCatalog?.channels.length || 0,
    sourceCount: state.lastCatalog?.sources.length || 0,
    categories: [...new Set(allChannels.flatMap((channel) => channel.categories || []))].sort(),
    languages: [...new Set(allChannels.flatMap((channel) => channel.languages || []))].sort(),
    category: state.libraryCategory,
    language: state.libraryLanguage,
    favoritesOnly: state.libraryFavoritesOnly,
    visibleCount: channels.length,
    filteredCount: matchingChannels.length,
  });
}

function renderSources() {
  ui.renderSources({
    activate: state.view === "sources",
    proxy: state.proxy,
    guideSources: state.epgSources,
    guideRefreshMinutes: state.epgRefreshMinutes,
    guideLastRefresh: state.epgLastRefresh,
    sources: (state.lastCatalog?.sources || []).map((source) => ({
      ...source,
      channelCount: source.count || 0,
      host: (() => { try { return new URL(source.url).host; } catch { return source.url; } })(),
    })),
  });
}

function renderGuide() {
  const channels = playableChannels().slice(0, 48).map(decorateChannel);
  const hasMappedGuide = channels.some((channel) => channel?.hasGuide || channel?.guides?.length || channel?.endpoints?.some((endpoint) => endpoint?.guides?.length));
  ui.renderGuide({
    activate: state.view === "guide",
    channels,
    sources: state.epgSources,
    configured: state.epgSources.length > 0 || hasMappedGuide,
    loading: state.guideLoading,
    error: state.guideError,
  });
}

function renderAll() {
  renderHome();
  renderExplore();
  renderCountries();
  renderLibrary();
  renderGuide();
  renderSources();
  ui.updateHeader({
    view: state.view,
    query: state.query,
    time: formatClock(),
    signalOk: !state.lastCatalog?.error,
  });
}

async function tuneHome(channel) {
  if (!channel || !isPlayableChannel(channel)) return;
  ui.refs.homeVideo.muted = state.homeMuted;
  await homePlayer.tune(playbackSource(channel), { muted: state.homeMuted }).catch((error) => {
    ui.toast(error.message, { tone: "error" });
  });
}

async function syncShellPreview() {
  if (state.view === "home") {
    ui.refs.exploreVideo.pause();
    ui.refs.homeVideo.muted = state.homeMuted;
    await ui.refs.homeVideo.play().catch(() => {});
    return;
  }
  ui.refs.homeVideo.pause();
  if (state.view === "explore") {
    const channel = findChannel(state.exploreFeaturedId);
    if (channel) await explorePlayer.tune(playbackSource(channel), { muted: true }).catch(() => {});
    return;
  }
  ui.refs.exploreVideo.pause();
}

async function openPlayer(channel, { returnMode = "shell" } = {}) {
  if (!channel || !isPlayableChannel(channel)) {
    ui.toast("No browser-playable HLS endpoint is available for this channel.", { tone: "error" });
    return;
  }
  state.homeMuted = true;
  homePlayer.setMuted(true);
  ui.refs.homeVideo.pause();
  ui.refs.exploreVideo.pause();
  state.playerReturnMode = returnMode;
  if (returnMode === "multiview") {
    multiview.muteAll();
    ui.refs.multiviewVideos.forEach((video) => video.pause());
  }
  state.currentId = channelId(channel);
  state.playerChromeVisible = false;
  state.playerMuted = state.playerVolume === 0;
  ui.refs.playerVideo.volume = state.playerVolume / 100;
  ui.showPlayer(playerUiState({ loading: true, playing: false, chromeVisible: false }));
  void loadSchedules([channel]).then(() => ui.updatePlayer(playerUiState()));
  await mainPlayer.tune(playbackSource(channel), { muted: state.playerMuted }).catch((error) => {
    ui.updatePlayer(playerUiState({ loading: false, error: error.message, playing: false }));
  });
}

async function loadSchedules(channels, { force = false } = {}) {
  const values = (Array.isArray(channels) ? channels : []).filter(Boolean);
  if (!values.length || (!state.epgSources.length && !values.some((channel) => channel?.hasGuide || channel?.guides?.length || channel?.endpoints?.some((endpoint) => endpoint?.guides?.length)))) return;
  if (!force && values.every((channel) => state.schedules.has(channelId(channel)))) return;
  state.guideLoading = true;
  state.guideError = "";
  renderGuide();
  try {
    const schedules = await epg.schedules(values, { force });
    schedules.forEach((value, key) => state.schedules.set(key, value));
    state.epgLastRefresh = epg.getLastRefresh();
  } catch (error) {
    state.guideError = error.message || "TV guide is unavailable.";
  } finally {
    state.guideLoading = false;
    renderHome();
    renderGuide();
    renderSources();
    if (state.currentId) ui.updatePlayer(playerUiState());
  }
}

function scheduleGuideRefresh() {
  window.clearInterval(epgTimer);
  epgTimer = 0;
  if (!state.epgRefreshMinutes) return;
  epgTimer = window.setInterval(() => void refreshGuideIfDue(), 60_000);
}

async function refreshGuideIfDue() {
  if (document.hidden || !state.epgRefreshMinutes) return;
  const dueAfter = state.epgRefreshMinutes * 60_000;
  if (state.epgLastRefresh && Date.now() - state.epgLastRefresh < dueAfter) return;
  state.schedules.clear();
  await loadSchedules(playableChannels().slice(0, 48), { force: true });
}

function showPlayerChrome() {
  state.playerChromeVisible = !state.playerChromeVisible;
  ui.updatePlayer(playerUiState({ chromeVisible: state.playerChromeVisible }));
  window.clearTimeout(playerChromeTimer);
  if (state.playerChromeVisible) playerChromeTimer = window.setTimeout(() => {
    state.playerChromeVisible = false;
    ui.updatePlayer(playerUiState({ chromeVisible: false }));
  }, 8000);
}

function setMultiviewChrome(visible, { autoHide = true } = {}) {
  state.multiviewChromeVisible = Boolean(visible);
  ui.refs.multiview.classList.toggle("is-chrome-visible", state.multiviewChromeVisible);
  window.clearTimeout(multiviewChromeTimer);
  if (state.multiviewChromeVisible && autoHide && ui.refs.root.dataset.mode === "multiview") {
    multiviewChromeTimer = window.setTimeout(() => setMultiviewChrome(false, { autoHide: false }), 6500);
  }
}

function revealMultiviewChrome() {
  if (ui.refs.root.dataset.mode !== "multiview") return;
  setMultiviewChrome(true);
}

function fillMultiview(seed) {
  const candidates = playableChannels();
  const ids = new Set(state.multiviewFeeds.map(channelId));
  if (seed && !ids.has(channelId(seed))) {
    state.multiviewFeeds.unshift(seed);
    ids.add(channelId(seed));
  }
  for (const channel of candidates) {
    if (state.multiviewFeeds.length >= MULTIVIEW_MAX) break;
    if (!ids.has(channelId(channel))) {
      state.multiviewFeeds.push(channel);
      ids.add(channelId(channel));
    }
  }
  state.multiviewFeeds = state.multiviewFeeds.slice(0, MULTIVIEW_MAX);
}

function createMultiviewController() {
  return new MultiviewController({
    staggerMs: 180,
    onDegrade: () => ui.toast("A feed was isolated to keep Multiview responsive.", { tone: "error" }),
  });
}

function createMainPlayer() {
  return new PlayerManager({ video: ui.refs.playerVideo, id: "main", onEvent: (type, detail) => {
    if (type === "fatal") ui.updatePlayer(playerUiState({
      loading: false,
      error: detail.error?.message,
      playing: false,
    }));
    if (type === "autoplay-blocked") ui.updatePlayer(playerUiState({ chromeVisible: true, playing: false }));
  } });
}

async function openMultiview(seed, { fill = true } = {}) {
  homePlayer.setMuted(true);
  if (fill) fillMultiview(seed);
  const feeds = state.multiviewFeeds.slice(0, state.multiviewLayout);
  state.multiviewAudioIndex = null;
  ui.showMultiview({ feeds: feeds.map(decorateChannel), layout: state.multiviewLayout, mutedAll: true, chromeVisible: true });
  setMultiviewChrome(true);
  await multiview.start(feeds.map(playbackSource), { count: state.multiviewLayout, videos: ui.refs.multiviewVideos });
}

function multiviewPickerChannels() {
  const currentIds = new Set(state.multiviewFeeds.map(channelId));
  return filterChannelPicker(playableChannels(), {
    query: state.multiviewPickerQuery,
    excludedIds: currentIds,
    getId: channelId,
    limit: 60,
  })
    .map(decorateChannel);
}

function showMultiviewPicker() {
  ui.showChannelPicker({
    slot: state.multiviewPickerSlot,
    query: state.multiviewPickerQuery,
    channels: multiviewPickerChannels(),
  });
}

async function replaceMultiviewSlot(index, channel) {
  if (!channel || !isPlayableChannel(channel)) return;
  state.multiviewFeeds[index] = channel;
  const slot = multiview.slots?.[index] || multiview.findSlot?.(`slot-${index + 1}`);
  const keepAudio = state.multiviewAudioIndex === index;
  ui.updateMultiview({
    feeds: state.multiviewFeeds.slice(0, state.multiviewLayout).map(decorateChannel),
    layout: state.multiviewLayout,
    audioIndex: state.multiviewAudioIndex,
  });
  if (!slot) {
    await openMultiview(null, { fill: false });
    return;
  }
  await slot.tune(playbackSource(channel), { muted: !keepAudio }).catch(() => {});
  if (keepAudio) {
    multiview.registerUserGesture(slot.id);
    multiview.activateAudio(slot.id);
  }
}

function updateMultiviewMetrics() {
  const metrics = multiview?.getAggregateMetrics();
  if (!metrics || ui.refs.root.dataset.mode !== "multiview") return;
  state.multiviewTelemetry = multiviewTelemetry(metrics, state.multiviewFeeds.slice(0, state.multiviewLayout).map(decorateChannel));
  ui.updateMultiview({
    feeds: state.multiviewFeeds.slice(0, state.multiviewLayout).map(decorateChannel),
    layout: state.multiviewLayout,
    audioIndex: state.multiviewAudioIndex,
    throughput: formatRate(metrics.downloadThroughput),
    received: `${state.multiviewTelemetry.received} received`,
    signalOk: !metrics.slots.some((entry) => entry.metrics.waiting),
  });
}

function closeOverlays() {
  window.clearTimeout(multiviewChromeTimer);
  mainPlayer.setMuted(true);
  multiview.muteAll();
  state.multiviewAudioIndex = null;
  ui.showMultiviewSignalLab(false);
  ui.showChannelPicker(false);
  ui.showView(state.view);
  if (state.view === "home") {
    refreshWorldMix();
    const randomHome = nextRandomHomeChannel();
    if (randomHome) {
      state.featuredId = channelId(randomHome);
      renderHome();
      void tuneHome(randomHome);
      return;
    }
  }
  void syncShellPreview();
}

async function closePlayerOverlay() {
  mainPlayer.setMuted(true);
  ui.refs.playerVideo.pause();
  if (document.fullscreenElement === ui.refs.player) await document.exitFullscreen?.().catch(() => {});
  mainPlayer.destroy();
  mainPlayer = createMainPlayer();
  if (state.playerReturnMode !== "multiview") {
    closeOverlays();
    return;
  }

  state.playerReturnMode = "shell";
  const feeds = state.multiviewFeeds.slice(0, state.multiviewLayout);
  ui.showMultiview({
    feeds: feeds.map(decorateChannel),
    layout: state.multiviewLayout,
    audioIndex: state.multiviewAudioIndex,
    chromeVisible: true,
  });
  await Promise.all(ui.refs.multiviewVideos.slice(0, state.multiviewLayout).map((video) => video.play().catch(() => {})));
  if (state.multiviewAudioIndex !== null) {
    const slotId = `slot-${state.multiviewAudioIndex + 1}`;
    multiview.registerUserGesture(slotId);
    multiview.activateAudio(slotId);
  }
  setMultiviewChrome(true);
}

function showImportForCountry(code) {
  const country = countryModels().find((item) => item.code === code);
  if (country) ui.showImportDialog({ source: country, country });
}

function importCountryModel(codeValue) {
  const code = String(codeValue || "").toUpperCase();
  const directory = state.lastCatalog?.countries.find((country) => country.code === code);
  if (!directory) return null;
  return {
    ...directory,
    iso2: code,
    code,
    provider: "iptv-org",
    host: "iptv-org.github.io",
    source: "Public country playlist directory",
    sourceUrl: "https://github.com/iptv-org/iptv",
    url: countryPlaylistUrl(code),
  };
}

async function performImport(detail) {
  const code = String(detail.dataset.iso2 || "").toUpperCase();
  const url = String(detail.formData?.get("url") || "").trim();
  const consent = detail.formData?.get("consent") === "on";
  const preset = sourcePreset(detail.dataset.presetId);
  if (!consent) {
    ui.toast("Confirm the source and content disclaimer first.", { tone: "error" });
    return;
  }
  ui.toast("Importing playlist…", { icon: "arrows-clockwise", duration: 1800 });
  ui.setImportBusy(true);
  try {
    const beforeCount = catalog.getState().channels.length;
    const importedSource = code
      ? await catalog.importCountry(code, { confirmed: true, proxy: state.proxy || undefined })
      : await catalog.importUrl(url, { confirmed: true, name: preset?.name, proxy: state.proxy || undefined });
    const afterCount = catalog.getState().channels.length;
    const newChannels = Math.max(0, afterCount - beforeCount);
    const mergedChannels = Math.max(0, Number(importedSource?.count || 0) - newChannels);
    ui.showImportDialog(false);
    ui.toast(`${newChannels.toLocaleString("en-US")} new channels · ${mergedChannels.toLocaleString("en-US")} matched and merged.`, { duration: 5200 });
  } catch (error) {
    ui.toast(error.message, { tone: "error", duration: 5200 });
  } finally {
    ui.setImportBusy(false);
  }
}

async function copyDiagnostics() {
  const channel = findChannel(state.currentId);
  const report = JSON.stringify({
    generatedAt: new Date().toISOString(),
    channel: channel ? { id: channelId(channel), name: channel.name } : null,
    metrics: mainPlayer.getMetrics(),
  }, null, 2);
  try {
    await navigator.clipboard.writeText(report);
    ui.toast("Diagnostics copied.");
  } catch {
    ui.toast("Clipboard access is unavailable in this browser.", { tone: "error" });
  }
}

async function handleAction(action, detail) {
  const id = detail.dataset.channelId || detail.element?.closest?.("[data-channel-id]")?.dataset.channelId;
  if (ui.refs.root.dataset.mode === "multiview" && action !== "toggle-multiview-chrome") revealMultiviewChrome();
  switch (action) {
    case "navigate": {
      const targetView = detail.dataset.mode === "explore" ? "explore" : detail.dataset.view || "home";
      const shouldRandomizeHome = targetView === "home";
      state.view = detail.dataset.mode === "explore" ? "explore" : detail.dataset.view || "home";
      if (shouldRandomizeHome) {
        refreshWorldMix();
        const randomHome = nextRandomHomeChannel();
        if (randomHome) state.featuredId = channelId(randomHome);
      }
      renderAll();
      ui.showView(state.view);
      if (state.view === "guide") void loadSchedules(playableChannels().slice(0, 48));
      if (shouldRandomizeHome) await tuneHome(findChannel(state.featuredId));
      else await syncShellPreview();
      break;
    }
    case "filter-explore": {
      state.exploreCategory = detail.dataset.category || "all";
      state.exploreFeaturedId = "";
      renderExplore();
      const channel = findChannel(state.exploreFeaturedId);
      if (channel) await explorePlayer.tune(playbackSource(channel), { muted: true }).catch(() => {});
      break;
    }
    case "explore-random": {
      const collections = exploreCollections();
      const pool = collections.flatMap((collection) => collection.channels || []);
      const alternatives = pool.filter((channel) => channelId(channel) !== state.exploreFeaturedId);
      const channel = (alternatives.length ? alternatives : pool)[Math.floor(Math.random() * Math.max(1, alternatives.length || pool.length))];
      if (!channel) break;
      state.exploreFeaturedId = channelId(channel);
      renderExplore();
      const source = findChannel(state.exploreFeaturedId);
      if (source) await explorePlayer.tune(playbackSource(source), { muted: true }).catch(() => {});
      break;
    }
    case "explore-surprise": {
      const channel = catalog.randomWorld({ currentChannelId: state.exploreFeaturedId }) || catalog.randomPlayable({ currentChannelId: state.exploreFeaturedId });
      if (channel && isPlayableChannel(channel)) await openPlayer(channel);
      break;
    }
    case "search-query":
      state.query = detail.value || "";
      if (state.query.trim()) {
        state.libraryQuery = state.query.trim();
        state.view = "library";
        renderLibrary();
        ui.updateHeader({ view: "library", query: state.query });
      } else if (state.view === "library") {
        state.libraryQuery = "";
        renderLibrary();
        ui.updateHeader({ view: "library", query: "" });
      }
      break;
    case "search": {
      state.query = String(detail.formData?.get("query") || state.query).trim();
      state.libraryQuery = state.query;
      state.view = "library";
      renderLibrary();
      ui.updateHeader({ view: "library", query: state.query });
      break;
    }
    case "filter-library":
      state.libraryQuery = detail.value || "";
      state.libraryLimit = UI_CHANNEL_LIMIT;
      renderLibrary();
      break;
    case "filter-library-category":
      state.libraryCategory = detail.value || "";
      state.libraryLimit = UI_CHANNEL_LIMIT;
      renderLibrary();
      break;
    case "filter-library-language":
      state.libraryLanguage = detail.value || "";
      state.libraryLimit = UI_CHANNEL_LIMIT;
      renderLibrary();
      break;
    case "filter-library-favorites":
      state.libraryFavoritesOnly = !state.libraryFavoritesOnly;
      state.libraryLimit = UI_CHANNEL_LIMIT;
      renderLibrary();
      break;
    case "load-more-library":
      state.libraryLimit += UI_CHANNEL_LIMIT;
      renderLibrary();
      break;
    case "open-channel":
    case "open-player":
      await openPlayer(findChannel(id || state.featuredId));
      break;
    case "random-channel": {
      const compatible = nextRandomHomeChannel();
      if (compatible) setHomeFeatured(compatible);
      else ui.toast("Import a playlist to activate Random.", { tone: "error" });
      break;
    }
    case "shuffle-world": {
      refreshWorldMix();
      const next = catalog.randomWorld({ currentChannelId: state.featuredId });
      const compatible = next && isPlayableChannel(next) ? next : state.worldMixIds.map(findChannel).find(Boolean);
      if (compatible) setHomeFeatured(compatible);
      break;
    }
    case "toggle-home-audio": {
      state.homeMuted = !ui.refs.homeVideo.muted;
      homePlayer.setMuted(state.homeMuted);
      if (!state.homeMuted) await ui.refs.homeVideo.play().catch(() => {});
      renderHome();
      break;
    }
    case "toggle-favorite":
    case "add-favorite":
    case "remove-favorite": {
      if (!id) break;
      const wasFavorite = state.lastCatalog?.favorites.has(id);
      if (action === "add-favorite" && wasFavorite) break;
      if (action === "remove-favorite" && !wasFavorite) break;
      await catalog.toggleFavorite(id);
      if (ui.refs.root.dataset.mode === "player" && id === state.currentId) {
        ui.updatePlayer(playerUiState({ chromeVisible: state.playerChromeVisible }));
      }
      break;
    }
    case "toggle-player-chrome":
      showPlayerChrome();
      break;
    case "save-guide-sources": {
      if (!detail.formData?.get("guideConsent")) {
        ui.toast("Confirm third-party guide access before saving.", { tone: "error" });
        break;
      }
      try {
        state.epgSources = await epg.setSources(String(detail.formData.get("guideSources") || "").split(/\n+/));
        state.epgRefreshMinutes = await epg.setRefreshMinutes(detail.formData.get("guideRefreshMinutes"));
        scheduleGuideRefresh();
        state.schedules.clear();
        renderGuide();
        renderSources();
        await loadSchedules(playableChannels().slice(0, 48), { force: true });
        ui.toast("TV Guide settings saved.");
      } catch (error) {
        ui.toast(error.message, { tone: "error" });
      }
      break;
    }
    case "use-guide-preset": {
      const preset = epgPreset(detail.dataset.presetId);
      if (!preset) break;
      ui.refs.guideInput.value = preset.urls.join("\n");
      ui.refs.guideInput.focus();
      ui.toast(`${preset.name} is ready to review. Confirm and save to connect it.`);
      break;
    }
    case "view-guide-provider":
      if (detail.dataset.url) window.open(detail.dataset.url, "_blank", "noopener,noreferrer");
      break;
    case "refresh-guide":
      state.schedules.clear();
      await loadSchedules(playableChannels().slice(0, 48), { force: true });
      break;
    case "select-country":
      state.selectedCountry = String(detail.dataset.iso2 || "").toUpperCase();
      state.countryChannelQuery = "";
      state.countryChannelCategory = "";
      state.countryChannelLanguage = "";
      state.countryChannelLimit = UI_CHANNEL_LIMIT;
      state.view = "countries";
      renderCountries();
      break;
    case "clear-country-selection":
    case "back-to-world-map":
      state.selectedCountry = "";
      state.countryChannelQuery = "";
      state.countryChannelCategory = "";
      state.countryChannelLanguage = "";
      state.countryChannelLimit = UI_CHANNEL_LIMIT;
      renderCountries();
      break;
    case "filter-countries-region":
      state.countryRegion = detail.dataset.region || "all";
      renderCountries();
      break;
    case "filter-countries-query":
      state.countryQuery = detail.value || "";
      renderCountries();
      break;
    case "sort-countries":
      state.countrySort = detail.value || "channels";
      renderCountries();
      break;
    case "filter-countries":
      state.countryQuery = String(detail.formData?.get("countryQuery") || "");
      state.countrySort = String(detail.formData?.get("countrySort") || "channels");
      renderCountries();
      break;
    case "set-country-mode":
      state.countryMode = detail.dataset.mode || "map";
      renderCountries();
      break;
    case "view-all-countries":
      state.countryRegion = "all";
      state.countryQuery = "";
      renderCountries();
      break;
    case "view-country-channels":
      state.selectedCountry = String(detail.dataset.iso2 || state.selectedCountry || "").toUpperCase();
      state.countryChannelLimit = UI_CHANNEL_LIMIT;
      renderCountries();
      break;
    case "filter-country-channels":
      state.countryChannelQuery = detail.value || "";
      state.countryChannelLimit = UI_CHANNEL_LIMIT;
      renderCountries();
      break;
    case "filter-country-channel-category":
      state.countryChannelCategory = detail.value || "";
      state.countryChannelLimit = UI_CHANNEL_LIMIT;
      renderCountries();
      break;
    case "filter-country-channel-language":
      state.countryChannelLanguage = detail.value || "";
      state.countryChannelLimit = UI_CHANNEL_LIMIT;
      renderCountries();
      break;
    case "load-more-country-channels":
      state.countryChannelLimit += UI_CHANNEL_LIMIT;
      renderCountries();
      break;
    case "open-import-dialog":
      if (detail.dataset.presetId) {
        const preset = sourcePreset(detail.dataset.presetId);
        if (preset) ui.showImportDialog({ ...preset, presetId: preset.id, presets: SOURCE_PRESETS });
      } else if (detail.dataset.iso2) {
        const country = importCountryModel(detail.dataset.iso2);
        if (country) ui.showImportDialog({ source: country, country });
      } else {
        ui.showImportDialog({
          provider: "External source",
          host: "User supplied",
          source: "M3U playlist URL",
          presets: SOURCE_PRESETS,
        });
      }
      break;
    case "select-source-preset": {
      const preset = sourcePreset(detail.dataset.presetId);
      if (preset) ui.showImportDialog({ ...preset, presetId: preset.id, presets: SOURCE_PRESETS });
      break;
    }
    case "close-import-dialog":
      ui.showImportDialog(false);
      break;
    case "confirm-import":
      await performImport(detail);
      break;
    case "view-import-source":
      if (detail.dataset.url) window.open(detail.dataset.url, "_blank", "noopener,noreferrer");
      break;
    case "refresh-source":
      try {
        await catalog.refreshSource(detail.dataset.sourceId, { proxy: state.proxy || undefined });
        ui.toast("Source refreshed.");
      } catch (error) { ui.toast(error.message, { tone: "error" }); }
      break;
    case "edit-source": {
      const source = state.lastCatalog?.sources.find((item) => item.sourceId === detail.dataset.sourceId);
      if (source) ui.showImportDialog({ ...source, provider: source.trusted ? "Trusted catalog" : "External source", host: (() => { try { return new URL(source.url).host; } catch { return "Saved source"; } })(), source: source.name });
      break;
    }
    case "remove-source":
      if (detail.dataset.sourceId && window.confirm("Remove this playlist and its cached channels?")) {
        await catalog.removeSource(detail.dataset.sourceId);
        ui.toast("Playlist removed.");
      }
      break;
    case "set-proxy": {
      const value = String(detail.formData?.get("proxy") || "").trim();
      if (value) {
        try {
          const parsed = new URL(value);
          if (!/^https?:$/.test(parsed.protocol)) throw new Error();
        } catch {
          ui.toast("Enter a valid HTTP or HTTPS proxy URL.", { tone: "error" });
          break;
        }
      }
      state.proxy = value.replace(/\/+$/, "");
      await catalog.setSetting("proxy", state.proxy);
      try { legacyStorage()?.setItem("catodo:proxy", JSON.stringify(state.proxy)); } catch { /* optional legacy mirror */ }
      renderSources();
      ui.toast(state.proxy ? "Proxy saved." : "Proxy disabled.");
      break;
    }
    case "close-player":
      await closePlayerOverlay();
      break;
    case "close-multiview":
      closeOverlays();
      break;
    case "toggle-playback":
      if (ui.refs.playerVideo.paused) await ui.refs.playerVideo.play().catch(() => {});
      else ui.refs.playerVideo.pause();
      break;
    case "set-volume": {
      const volume = Math.max(0, Math.min(100, Number(detail.value) || 0));
      state.playerVolume = volume;
      if (volume > 0) state.playerLastAudibleVolume = volume;
      state.playerMuted = volume === 0;
      await applyPlayerAudio({ resume: volume > 0 });
      break;
    }
    case "set-player-muted": {
      const shouldMute = detail.dataset.muted === "true";
      if (!shouldMute) {
        state.playerVolume = state.playerVolume > 0 ? state.playerVolume : state.playerLastAudibleVolume || 100;
        state.playerMuted = false;
      } else {
        state.playerLastAudibleVolume = state.playerVolume || state.playerLastAudibleVolume;
        state.playerMuted = true;
      }
      await applyPlayerAudio({ resume: !state.playerMuted });
      break;
    }
    case "rewind":
      if (ui.refs.playerVideo.seekable?.length) ui.refs.playerVideo.currentTime = Math.max(ui.refs.playerVideo.seekable.start(0), ui.refs.playerVideo.currentTime - 15);
      break;
    case "forward":
      if (ui.refs.playerVideo.seekable?.length) ui.refs.playerVideo.currentTime = Math.min(ui.refs.playerVideo.seekable.end(ui.refs.playerVideo.seekable.length - 1), ui.refs.playerVideo.currentTime + 15);
      break;
    case "previous-channel": {
      const channels = playableChannels();
      const index = channels.findIndex((channel) => channelId(channel) === state.currentId);
      await openPlayer(channels[(index - 1 + channels.length) % channels.length], { returnMode: state.playerReturnMode });
      break;
    }
    case "open-signal-lab":
      if (ui.refs.root.dataset.mode === "multiview") {
        const metrics = multiview.getAggregateMetrics();
        state.multiviewTelemetry = multiviewTelemetry(metrics, state.multiviewFeeds.slice(0, state.multiviewLayout).map(decorateChannel));
        ui.showMultiviewSignalLab(state.multiviewTelemetry);
      } else {
        const metrics = mainPlayer.getMetrics();
        ui.showSignalLab({
          channel: decorateChannel(findChannel(state.currentId)),
          metrics: metricsForUi(metrics),
          samples: state.throughputHistory,
          maxMbps: 20,
        });
      }
      break;
    case "close-multiview-signal-lab":
      ui.showMultiviewSignalLab(false);
      break;
    case "close-signal-lab":
      ui.showSignalLab(false);
      break;
    case "copy-diagnostics":
      await copyDiagnostics();
      break;
    case "toggle-player-fit":
      ui.refs.playerVideo.classList.toggle("is-contain");
      break;
    case "toggle-fullscreen": {
      const target = ui.refs.root.dataset.mode === "multiview" ? ui.refs.multiview : ui.refs.player;
      if (document.fullscreenElement) await document.exitFullscreen?.();
      else await target.requestFullscreen?.();
      break;
    }
    case "add-to-multiview":
      await openMultiview(findChannel(state.currentId));
      break;
    case "open-multiview":
      await openMultiview(findChannel(id || state.featuredId));
      break;
    case "toggle-multiview-chrome":
      setMultiviewChrome(!state.multiviewChromeVisible);
      break;
    case "expand-multiview-slot": {
      const index = Math.max(0, Math.min(3, Number(detail.dataset.slot) - 1));
      const channel = state.multiviewFeeds[index];
      if (channel) await openPlayer(channel, { returnMode: "multiview" });
      break;
    }
    case "set-multiview-layout":
      state.multiviewLayout = Math.max(2, Math.min(4, Number(detail.dataset.count) || 4));
      await openMultiview();
      break;
    case "select-multiview-audio": {
      await selectMultiviewAudio(detail.dataset.slot);
      break;
    }
    case "replace-multiview-channel": {
      const index = Math.max(0, Math.min(3, Number(detail.dataset.slot) - 1));
      const currentIds = new Set(state.multiviewFeeds.map(channelId));
      const candidates = playableChannels().filter((channel) => !currentIds.has(channelId(channel)));
      const next = candidates[Math.floor(Math.random() * candidates.length)];
      if (next && isPlayableChannel(next)) await replaceMultiviewSlot(index, next);
      else ui.toast("No other playable channel is available.", { tone: "error" });
      break;
    }
    case "open-multiview-picker":
      state.multiviewPickerSlot = Math.max(1, Math.min(4, Number(detail.dataset.slot) || 1));
      state.multiviewPickerQuery = "";
      showMultiviewPicker();
      break;
    case "filter-multiview-picker":
      state.multiviewPickerQuery = detail.value || "";
      showMultiviewPicker();
      break;
    case "close-multiview-picker":
      state.multiviewPickerSlot = null;
      state.multiviewPickerQuery = "";
      ui.showChannelPicker(false);
      break;
    case "select-multiview-channel": {
      const index = Math.max(0, Math.min(3, Number(state.multiviewPickerSlot) - 1));
      const channel = findChannel(id);
      state.multiviewPickerSlot = null;
      state.multiviewPickerQuery = "";
      ui.showChannelPicker(false);
      if (channel) await replaceMultiviewSlot(index, channel);
      break;
    }
    case "remove-multiview-channel": {
      const index = Math.max(0, Math.min(3, Number(detail.dataset.slot) - 1));
      state.multiviewFeeds.splice(index, 1);
      state.multiviewLayout = Math.max(2, state.multiviewLayout - 1);
      multiview.destroy();
      multiview = createMultiviewController();
      await openMultiview(null, { fill: false });
      break;
    }
    case "add-multiview-channel":
      fillMultiview();
      await openMultiview();
      break;
    case "map-zoom-in":
    case "map-zoom-out":
    case "map-center": {
      const map = ui.refs.countryMap;
      if (action === "map-center") resetWorldMapView(map);
      else zoomWorldMap(map, action === "map-zoom-out" ? "out" : "in");
      break;
    }
    default:
      break;
  }
}

async function selectMultiviewAudio(slotNumber) {
  const index = Math.max(0, Math.min(3, Number(slotNumber) - 1));
  const slot = multiview.slots?.[index] || multiview.findSlot?.(`slot-${index + 1}`);
  const slotId = slot?.id || `slot-${index + 1}`;
  multiview.registerUserGesture(slotId);
  state.multiviewAudioIndex = index;
  await ui.refs.multiviewVideos[index]?.play().catch(() => {});
  multiview.activateAudio(slotId);
  ui.updateMultiview({
    feeds: state.multiviewFeeds.slice(0, state.multiviewLayout).map(decorateChannel),
    layout: state.multiviewLayout,
    audioIndex: index,
  });
}

function bindVideoEvents() {
  ui.refs.homeVideo.addEventListener("playing", () => {
    state.homeFailureCount = 0;
    state.homeFailedIds = [];
    ui.updateHeader({ signalOk: true });
  });
  ui.refs.playerVideo.addEventListener("playing", async () => {
    ui.updatePlayer(playerUiState({ loading: false, playing: true }));
    if (state.currentId && lastRememberedId !== state.currentId) {
      lastRememberedId = state.currentId;
      await catalog.remember(state.currentId, { endpointId: firstEndpoint(findChannel(state.currentId))?.endpointId });
    }
  });
  ui.refs.playerVideo.addEventListener("pause", () => {
    ui.updatePlayer(playerUiState({ playing: false }));
  });
  ui.refs.playerVideo.addEventListener("waiting", () => {
    ui.updatePlayer(playerUiState({ loading: true, playing: false }));
  });
  ui.refs.multiview.addEventListener("pointermove", () => {
    const now = performance.now();
    if (now - multiviewPointerAt < 500) return;
    multiviewPointerAt = now;
    revealMultiviewChrome();
  });
  ui.refs.multiview.addEventListener("keydown", revealMultiviewChrome);
}

async function boot() {
  globalThis.Hls ||= Hls;
  const root = document.querySelector("#app");
  const bootOptions = {
    screen: document.querySelector("#boot-screen"),
    skipButton: document.querySelector("#boot-skip"),
    disabled: new URLSearchParams(location.search).has("qa"),
  };
  const bootPromise = playAnalogBoot(bootOptions);
  await i18n.load("en").catch(() => i18n);
  document.documentElement.lang = i18n.locale;
  document.documentElement.dir = i18n.direction;

  ui = mountAppUI(root, { t, onAction: (action, detail) => void handleAction(action, detail) });
  ui.setCountryImportHandler((iso2) => {
    const country = importCountryModel(iso2 || state.activeCountry);
    if (country) ui.showImportDialog({ source: country, country });
  });
  homePlayer = new PlayerManager({ video: ui.refs.homeVideo, id: "home", onEvent: (type) => {
    if (type !== "fatal" || state.homeFailureCount >= 8) return;
    state.homeFailureCount += 1;
    state.homeFailedIds.push(state.featuredId);
    const failed = new Set(state.homeFailedIds);
    const next = state.worldMixIds.map(findChannel).find((channel) => channel && !failed.has(channelId(channel)))
      || playableChannels().find((channel) => !failed.has(channelId(channel)));
    if (next) window.setTimeout(() => setHomeFeatured(next, { resetFailures: false }), 250);
    else ui.updateHeader({ signalOk: false });
  } });
  explorePlayer = new PlayerManager({ video: ui.refs.exploreVideo, id: "explore" });
  mainPlayer = createMainPlayer();
  multiview = createMultiviewController();
  bindVideoEvents();

  catalog = new CatalogService({ proxy: state.proxy || undefined, localStorage: legacyStorage() });
  await catalog.init();
  state.proxy = await catalog.getSetting("proxy", "");
  epg = new EpgService({ catalog, proxy: proxyUrl });
  await epg.init();
  state.epgSources = epg.getSources();
  state.epgRefreshMinutes = epg.getRefreshMinutes();
  state.epgLastRefresh = epg.getLastRefresh();
  scheduleGuideRefresh();
  unsubscribeCatalog = catalog.subscribe((snapshot) => {
    state.lastCatalog = snapshot;
    rebuildCountryDirectoryMaps(snapshot.countries);
    const first = playableChannels(snapshot.channels)[0];
    if (!state.featuredId && first) state.featuredId = channelId(first);
    renderAll();
  });

  const deepLink = parseDeepLink(location.href);
  if (deepLink.type === "country" && deepLink.valid) {
    state.selectedCountry = deepLink.code;
    showImportForCountry(deepLink.code);
  } else if (deepLink.type === "source" && deepLink.valid) {
    ui.showImportDialog({ url: deepLink.url, provider: "Deep link", host: new URL(deepLink.url).host, source: "External playlist" });
  }

  if (state.featuredId) {
    await tuneHome(findChannel(state.featuredId));
    void loadSchedules(state.worldMixIds.map(findChannel).filter(Boolean));
  }
  clockTimer = window.setInterval(() => ui.updateHeader({ time: formatClock() }), 30_000);
  metricTimer = window.setInterval(() => {
    const metrics = mainPlayer.getMetrics();
    if (ui.refs.root.dataset.mode === "player") ui.updatePlayer(playerUiState());
    state.throughputHistory.push((metrics.downloadThroughput || 0) / 1_000_000);
    state.throughputHistory = state.throughputHistory.slice(-60);
    if (!ui.refs.signalLab.hidden) ui.showSignalLab({
      channel: decorateChannel(findChannel(state.currentId)),
      metrics: metricsForUi(metrics),
      samples: state.throughputHistory,
      maxMbps: 20,
    });
    updateMultiviewMetrics();
    const footerMetrics = ui.refs.root.dataset.mode === "multiview"
      ? multiview.getAggregateMetrics()
      : ui.refs.root.dataset.mode === "player"
        ? metrics
        : homePlayer.getMetrics();
    const footerTelemetry = ui.refs.root.dataset.mode === "multiview"
      ? singleTelemetry({
          downloadThroughput: footerMetrics.downloadThroughput,
          bufferSeconds: footerMetrics.slots.reduce((sum, entry) => sum + (entry.metrics.bufferSeconds || 0), 0),
          frames: { dropped: footerMetrics.droppedFrames },
          waiting: footerMetrics.slots.some((entry) => entry.metrics.waiting),
        })
      : singleTelemetry(footerMetrics);
    ui.updateHeader({ telemetry: footerTelemetry });
    if (!ui.refs.multiviewSignalLab.hidden && ui.refs.root.dataset.mode === "multiview") {
      state.multiviewTelemetry = multiviewTelemetry(footerMetrics, state.multiviewFeeds.slice(0, state.multiviewLayout).map(decorateChannel));
      ui.showMultiviewSignalLab(state.multiviewTelemetry);
    }
  }, 1000);

  await bootPromise;
}

window.addEventListener("beforeunload", () => {
  window.clearInterval(clockTimer);
  window.clearInterval(metricTimer);
  window.clearInterval(epgTimer);
  window.clearTimeout(playerChromeTimer);
  window.clearTimeout(multiviewChromeTimer);
  unsubscribeCatalog?.();
  homePlayer?.destroy();
  explorePlayer?.destroy();
  mainPlayer?.destroy();
  multiview?.destroy();
  catalog?.destroy();
  ui?.destroy();
}, { once: true });

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) void refreshGuideIfDue();
});

boot().catch((error) => {
  console.error("CATODO failed to start", error);
  const screen = document.querySelector("#boot-screen");
  if (screen) screen.hidden = true;
  const root = document.querySelector("#app");
  if (root) {
    const message = document.createElement("p");
    message.className = "fatal-startup";
    message.textContent = `CATODO could not start: ${error.message}`;
    root.replaceChildren(message);
  }
});
