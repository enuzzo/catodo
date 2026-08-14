import { playAnalogBoot } from "./boot/signal-hyperjump.js";
import Hls from "hls.js";
import {
  CatalogService,
  SOURCE_PRESETS,
  countryPlaylistUrl,
  createConfigurationBackup,
  filterCountriesByRegion,
  MULTIVIEW_LAYOUT_SETTING,
  MULTIVIEW_PRESETS_SETTING,
  normalizeMultiviewLayout,
  normalizeMultiviewPresets,
  parseDeepLink,
  regionForCountry,
  resolveMultiviewLayoutSync,
  resolveMultiviewPresetSync,
  sourcePreset,
} from "./data/index.js";
import i18n from "./i18n/index.js";
import { MultiviewController, PlayerManager, releasePlayerForTransition } from "./player/index.js";
import { mountAppUI } from "./ui/markup.js";
import { EpgService, GlobeTvCatalog, epgPreset, epgPresetsForCountry, groupGuideSources, guideUrlsForChannels } from "./epg/index.js";
import { filterChannelPicker } from "./ui/channel-picker-filter.js";
import {
  buildExploreCountryOptions,
  buildExploreCollections,
  filterExploreChannelsByCountry,
  matchesExploreCategory,
  pickExploreFeaturedForView,
  randomizeExploreCollectionSamples,
  randomizeExploreChannels,
  sortExploreChannels,
} from "./ui/explore-model.js";
import { multiviewTelemetry, singleTelemetry } from "./ui/telemetry-model.js";
import { advanceConnection, connectionView, startConnection } from "./ui/connection-model.js";
import { resolvePlayerReturnView } from "./ui/view-mode.js";
import { selectInitialHomeChannel } from "./ui/home-selection.js";
import { favoriteGuidePlan } from "./ui/favorite-guide-model.js";
import { defaultMultiviewPresetState, deleteMultiviewPreset, findMultiviewPreset, renameMultiviewPreset } from "./ui/multiview-preset-model.js";
import { resetWorldMapView, zoomWorldMap } from "./ui/world-map.js";

const UI_CHANNEL_LIMIT = 72;
const HOME_FAVORITES_LIMIT = 10;
const EXPLORE_PREVIEW_LIMIT = 8;
const EXPLORE_PAGE_SIZE = 32;
const MULTIVIEW_MAX = 4;
const PLAYABLE_KINDS = new Set(["hls"]);
const TONE_BY_COUNTRY = ["blue", "cyan", "green", "yellow", "magenta", "red", "white"];
const QA_MODE = new URLSearchParams(location.search).has("qa");

const state = {
  view: "home",
  exploreCategory: "all",
  exploreFeaturedId: "",
  exploreMuted: true,
  exploreCategorySort: "relevance",
  exploreCountry: "",
  exploreCategoryLimit: EXPLORE_PAGE_SIZE,
  exploreCollectionSamples: new Map(),
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
  countryGuideLoading: "",
  countryGuideCatalogUrls: new Map(),
  countryGuideAvailability: new Map(),
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
  guideQuery: "",
  guideFavoritesOnly: false,
  guideCatalogQuery: "",
  guideCatalogCountries: [],
  guideCatalogLoading: false,
  guideCatalogError: "",
  playerGuideLoadingId: "",
  multiviewPresets: [],
  selectedMultiviewPresetId: "",
  playerChromeVisible: false,
  playerReturnMode: "shell",
  playerReturnView: "home",
  playerConnection: null,
};

let catalog;
let ui;
let homePlayer;
let explorePlayer;
let mainPlayer;
let multiview;
let epg;
let guideCatalog;
let unsubscribeCatalog;
let metricTimer;
let clockTimer;
let epgTimer;
let lastRememberedId = "";
const countryGuideDiscoveryPromises = new Map();
let directoryMaps = { byCode: new Map(), byName: new Map() };
let playerChromeTimer = 0;
let multiviewChromeTimer = 0;
let multiviewPointerAt = 0;
let playerSession = 0;
let playerTransitioning = false;
let playerConnectionTimer = 0;
let initialHomeSelectionDone = false;
let lastInstallationSyncNotice = "";

function legacyStorage() {
  try { return globalThis.localStorage || undefined; }
  catch { return undefined; }
}

function readLocalJson(key, fallback) {
  try { return JSON.parse(legacyStorage()?.getItem(key) || "") ?? fallback; }
  catch { return fallback; }
}

function writeLocalJson(key, value) {
  try { legacyStorage()?.setItem(key, JSON.stringify(value)); } catch { /* optional device preference */ }
}

async function persistMultiviewPresets(presets) {
  state.multiviewPresets = normalizeMultiviewPresets(presets);
  writeLocalJson("catodo:multiview-presets", state.multiviewPresets);
  updatePresetOptions();
  if (catalog) await catalog.setSetting(MULTIVIEW_PRESETS_SETTING, state.multiviewPresets);
  return state.multiviewPresets;
}

async function persistMultiviewLayout(layout) {
  state.multiviewLayout = normalizeMultiviewLayout(layout);
  writeLocalJson("catodo:multiview-layout", state.multiviewLayout);
  if (catalog) await catalog.setSetting(MULTIVIEW_LAYOUT_SETTING, state.multiviewLayout);
  return state.multiviewLayout;
}

function updatePresetOptions() {
  const select = ui?.refs.multiviewPresets;
  if (!select) return;
  const current = state.selectedMultiviewPresetId || "";
  select.replaceChildren(new Option(t("multiview.presets", "Presets"), ""), ...state.multiviewPresets.map((preset) => new Option(preset.name, preset.id)));
  const selected = findMultiviewPreset(state.multiviewPresets, current);
  state.selectedMultiviewPresetId = selected?.id || "";
  select.value = state.selectedMultiviewPresetId;
  if (ui.refs.multiviewPresetRename) ui.refs.multiviewPresetRename.hidden = !selected;
  if (ui.refs.multiviewPresetDelete) ui.refs.multiviewPresetDelete.hidden = !selected;
}

function t(key, fallback, vars = {}) {
  return i18n.t(key, fallback, vars);
}

function reportInstallationSyncError(error) {
  const detail = error?.message || String(error || "Unknown synchronization error");
  if (detail === lastInstallationSyncNotice) return;
  lastInstallationSyncNotice = detail;
  ui?.toast(t(
    "settings.syncFailureToast",
    "Shared storage is unavailable. Changes are queued safely in this browser. {error}",
    { error: detail },
  ), { tone: "error" });
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
    guideAvailable: state.schedules.get(channelId(channel))?.status === "ready",
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
  const currentId = state.currentId;
  return {
    channel: decorateChannel(findChannel(currentId)),
    muted: state.playerMuted,
    volume: state.playerVolume,
    audioStatus: playerAudioStatus(),
    guideLoading: Boolean(currentId) && state.playerGuideLoadingId === currentId,
    ...extra,
  };
}

function clearPlayerConnectionTimer() {
  window.clearInterval(playerConnectionTimer);
  playerConnectionTimer = 0;
}

function playerConnectionUi() {
  return state.playerConnection ? connectionView(state.playerConnection) : null;
}

function refreshPlayerConnection() {
  if (!state.playerConnection || !isPlayerSurfaceActive()) return;
  const failed = state.playerConnection.phase === "error";
  ui.updatePlayer({
    loading: !failed,
    playing: false,
    error: failed ? state.playerConnection.error || "Stream unavailable" : "",
    connection: playerConnectionUi(),
  });
}

function beginPlayerConnection(source, phase = "start", detail = {}) {
  clearPlayerConnectionTimer();
  const endpoints = source?.endpoints || [];
  state.playerConnection = startConnection({
    route: endpoints[0]?.route || "direct",
    endpointCount: Math.max(1, endpoints.length),
  });
  if (phase !== "start") state.playerConnection = advanceConnection(state.playerConnection, phase, detail);
  playerConnectionTimer = window.setInterval(refreshPlayerConnection, 500);
  return playerConnectionUi();
}

function advancePlayerConnection(phase, detail = {}, { restart = false } = {}) {
  if (!state.playerConnection && !restart) return;
  if (!state.playerConnection) beginPlayerConnection(playbackSource(findChannel(state.currentId)));
  if (state.playerConnection.phase === "error" && phase !== "error") return;
  state.playerConnection = advanceConnection(state.playerConnection, phase, detail);
  if (phase === "error") clearPlayerConnectionTimer();
  refreshPlayerConnection();
}

function finishPlayerConnection() {
  clearPlayerConnectionTimer();
  state.playerConnection = null;
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
    ? worldMix.slice(0, HOME_FAVORITES_LIMIT).map(decorateChannel).filter(Boolean)
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
  const sync = snapshot.installationSync || {};
  ui.renderHome({
    activate: state.view === "home",
    featured: featured ? { ...decorateChannel(featured), muted: state.homeMuted, autoplay: true } : null,
    channels: worldMix.map(decorateChannel),
    favorites: favorites.slice(0, HOME_FAVORITES_LIMIT),
    liveCount: allPlayable.length,
    countryCount: allPlayableCountries.size,
    selectedIso2: inferredCountryCode(featured),
    importedIso2: importedIso2(),
    availableIso2: snapshot.countries.map((country) => country.code),
    markers,
    countryCounts: countryCounts(),
    time: formatClock(),
    restoring: !featured && Number(sync.hydrating) > 0,
    syncError: !featured && sync.status === "error",
    restoreError: !featured && Number(sync.hydrationFailed) > 0,
  });
}

function fullExploreCollections(activeCategory = state.exploreCategory) {
  return buildExploreCollections(playableChannels().map(decorateChannel).filter(Boolean), {
    activeCategory,
    limit: Number.MAX_SAFE_INTEGER,
  });
}

function exploreCollections(collections = fullExploreCollections()) {
  if (state.exploreCategory === "all") {
    return collections.map((collection) => {
      const byId = new Map(collection.channels.map((channel) => [channelId(channel), channel]));
      const sampleIds = state.exploreCollectionSamples.get(collection.id) || [];
      const sampled = sampleIds.map((id) => byId.get(id)).filter(Boolean);
      const selectedIds = new Set(sampled.map(channelId));
      const preview = [...sampled, ...collection.channels.filter((channel) => !selectedIds.has(channelId(channel)))]
        .slice(0, EXPLORE_PREVIEW_LIMIT);
      return {
        ...collection,
        channels: preview,
        totalCount: collection.channels.length,
        mode: "overview",
      };
    });
  }
  return collections.map((collection) => {
    const countryOptions = buildExploreCountryOptions(collection.channels);
    const filtered = filterExploreChannelsByCountry(collection.channels, state.exploreCountry);
    const sorted = sortExploreChannels(filtered, state.exploreCategorySort);
    return {
      ...collection,
      channels: sorted.slice(0, state.exploreCategoryLimit),
      totalCount: sorted.length,
      hasMore: state.exploreCategoryLimit < sorted.length,
      mode: "catalog",
      sort: state.exploreCategorySort,
      country: state.exploreCountry,
      countryOptions,
    };
  });
}

function refreshExploreCollectionSamples() {
  state.exploreCollectionSamples = randomizeExploreCollectionSamples(fullExploreCollections("all"), {
    limit: EXPLORE_PREVIEW_LIMIT,
    previousSamples: state.exploreCollectionSamples,
  });
}

function renderExplore() {
  const fullCollections = fullExploreCollections();
  const collections = exploreCollections(fullCollections);
  const existing = decorateChannel(findChannel(state.exploreFeaturedId));
  const featuredMatchesCountry = !state.exploreCountry
    || filterExploreChannelsByCountry([existing], state.exploreCountry).length > 0;
  const featured = existing
    && (state.exploreCategory === "all" || matchesExploreCategory(existing, state.exploreCategory))
    && featuredMatchesCountry
    ? existing
    : pickExploreFeaturedForView({
      activeCategory: state.exploreCategory,
      fullCollections,
      visibleCollections: collections,
      currentId: state.exploreFeaturedId,
    });
  const featuredCollection = fullCollections.find((collection) =>
    collection.channels.some((channel) => channelId(channel) === channelId(featured)));
  if (featured) state.exploreFeaturedId = channelId(featured);
  ui.renderExplore({
    activate: state.view === "explore",
    category: state.exploreCategory,
    collections,
    featured: featured ? { ...featured, muted: state.exploreMuted, autoplay: state.view === "explore" } : null,
    featuredCollection,
    restoring: !featured && Number(state.lastCatalog?.installationSync?.hydrating) > 0,
    syncError: !featured && state.lastCatalog?.installationSync?.status === "error",
    restoreError: !featured && Number(state.lastCatalog?.installationSync?.hydrationFailed) > 0,
  });
  if (state.view !== "explore") ui.refs.exploreVideo.pause();
}

function knownCountryGuideUrls(iso2, channels) {
  return [...new Set([
    ...epgPresetsForCountry(iso2).flatMap((preset) => preset.urls || []),
    ...guideUrlsForChannels(channels),
  ])];
}

function countryGuideUrls(iso2, channels) {
  const code = String(iso2 || "").toUpperCase();
  return [...new Set([
    ...knownCountryGuideUrls(code, channels),
    ...(state.countryGuideCatalogUrls.get(code) || []),
    ...guideSourcesForCountry(code),
  ])];
}

async function discoverCountryGuideUrls(iso2, { force = false } = {}) {
  const code = String(iso2 || "").toUpperCase();
  if (!code || !guideCatalog) return [];
  const channels = catalog.list({ country: code }).filter(isPlayableChannel);
  const knownUrls = knownCountryGuideUrls(code, channels);
  if (knownUrls.length) return countryGuideUrls(code, channels);
  const availability = state.countryGuideAvailability.get(code);
  if (!force && (availability === "ready" || availability === "unavailable")) return countryGuideUrls(code, channels);
  if (countryGuideDiscoveryPromises.has(code)) return countryGuideDiscoveryPromises.get(code);

  const country = countryModels().find((item) => item.code === code);
  if (!country) return [];
  state.countryGuideAvailability.set(code, "loading");
  if (state.selectedCountry === code) renderCountries();
  const discovery = (async () => {
    try {
      const files = await guideCatalog.countryFor(country, { force });
      const urls = files.map((file) => file.url).filter(Boolean);
      state.countryGuideCatalogUrls.set(code, urls);
      state.countryGuideAvailability.set(code, urls.length ? "ready" : "unavailable");
      return countryGuideUrls(code, channels);
    } catch (error) {
      state.countryGuideAvailability.set(code, "error");
      throw error;
    } finally {
      countryGuideDiscoveryPromises.delete(code);
      if (state.selectedCountry === code) renderCountries();
    }
  })();
  countryGuideDiscoveryPromises.set(code, discovery);
  return discovery;
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
  const selectedCountryGuideUrls = countryGuideUrls(selected?.code, selectedCountryChannels);
  const countryGuideAvailability = state.countryGuideAvailability.get(selected?.code);
  const configuredGuideUrls = new Set(state.epgSources);
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
    countryGuideSourceCount: selectedCountryGuideUrls.length,
    countryGuideConfiguredCount: selectedCountryGuideUrls.filter((url) => configuredGuideUrls.has(url)).length,
    countryGuideLoading: state.countryGuideLoading === selected?.code,
    countryGuideChecking: countryGuideAvailability === "loading",
    countryGuideLookupError: countryGuideAvailability === "error",
    countryGuideUnavailable: countryGuideAvailability === "unavailable",
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
  const installationSync = state.lastCatalog?.installationSync || {};
  const recentIds = [...new Set((state.lastCatalog?.history || []).map((entry) => entry.channelId))].slice(0, 20);
  const recent = recentIds.map(findChannel).filter(Boolean).map(decorateChannel);
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
    query: state.libraryQuery,
    favoritesOnly: state.libraryFavoritesOnly,
    visibleCount: channels.length,
    filteredCount: matchingChannels.length,
    restoring: Number(installationSync.hydrating) > 0,
    syncError: installationSync.status === 'error',
    restoreError: Number(installationSync.hydrationFailed) > 0,
    recent,
  });
}

function renderSources() {
  const sourceStatuses = epg?.getSourceStatuses?.() || [];
  const catalogQuery = state.guideCatalogQuery.trim().toLocaleLowerCase("en-US");
  ui.renderSources({
    activate: state.view === "sources",
    proxy: state.proxy,
    guideSources: state.epgSources,
    guideRefreshMinutes: state.epgRefreshMinutes,
    guideLastRefresh: state.epgLastRefresh,
    guideSourceGroups: groupGuideSources(state.epgSources, sourceStatuses),
    guideCatalogCountries: state.guideCatalogCountries.filter((country) => !catalogQuery || country.name.toLocaleLowerCase("en-US").includes(catalogQuery)),
    guideCatalogQuery: state.guideCatalogQuery,
    guideCatalogLoading: state.guideCatalogLoading,
    guideCatalogError: state.guideCatalogError,
    installationSync: state.lastCatalog?.installationSync,
    sources: (state.lastCatalog?.sources || []).map((source) => ({
      ...source,
      channelCount: source.count || 0,
      host: (() => { try { return new URL(source.url).host; } catch { return source.url; } })(),
      healthLabel: source.error ? "Using last known good" : source.checkedAt ? `Healthy · checked ${formatRelativeTime(source.checkedAt)}` : "Ready to refresh",
    })),
  });
}

function formatRelativeTime(value) {
  const elapsed = Math.max(0, Date.now() - Number(value || 0));
  if (elapsed < 60_000) return "just now";
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m ago`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)}h ago`;
  return `${Math.floor(elapsed / 86_400_000)}d ago`;
}

function renderGuide() {
  const decorated = playableChannels().map(decorateChannel);
  const matched = decorated.filter((channel) => state.schedules.get(channelId(channel))?.matched === true);
  const all = decorated.filter((channel) => channel.guideAvailable && channel.schedule.length > 0);
  const query = state.guideQuery.trim().toLocaleLowerCase("en-US");
  const channels = all.filter((channel) => (!state.guideFavoritesOnly || channel.favorite)
    && (!query || `${channel.name} ${channel.countryName || channel.country || ""}`.toLocaleLowerCase("en-US").includes(query))).slice(0, 160);
  const hasMappedGuide = all.length > 0 || state.epgSources.length > 0;
  const sourceStatuses = epg?.getSourceStatuses?.() || [];
  const staleSources = sourceStatuses.filter((source) => source.dataState === "stale");
  const latestProgrammeAt = sourceStatuses.reduce((latest, source) => Math.max(latest, Number(source.latestProgrammeAt) || 0), 0);
  const covered = all.length;
  ui.renderGuide({
    activate: state.view === "guide",
    channels,
    sources: state.epgSources,
    configured: state.epgSources.length > 0 || hasMappedGuide,
    loading: state.guideLoading,
    error: state.guideError,
    query: state.guideQuery,
    favoritesOnly: state.guideFavoritesOnly,
    covered,
    total: matched.length || all.length,
    matched: matched.length,
    staleSourceCount: staleSources.length,
    latestProgrammeAt,
  });
}

function countryCodeForGuideName(name) {
  const compact = normalizedCountryLabel(name).replace(/\s+/g, "");
  for (const [label, code] of countryDirectoryMaps().byName) {
    if (label.replace(/\s+/g, "") === compact) return code;
  }
  return "";
}

function guideSourcesForCountry(iso2) {
  const code = String(iso2 || "").trim().toUpperCase();
  if (!code) return [];
  return groupGuideSources(state.epgSources)
    .filter((group) => countryCodeForGuideName(group.name) === code)
    .flatMap((group) => group.sources.map((source) => source.url));
}

function guideCandidateChannels() {
  const groups = groupGuideSources(state.epgSources, epg?.getSourceStatuses?.() || []);
  const codes = new Set(groups.map((group) => countryCodeForGuideName(group.name)).filter(Boolean));
  const hasCustom = groups.some((group) => group.id === "custom");
  if (hasCustom || !groups.length) {
    return playableChannels().filter((channel) => channel?.hasGuide || channel?.guides?.length || channel?.endpoints?.some((endpoint) => endpoint?.guides?.length)).slice(0, 320);
  }
  return playableChannels().filter((channel) => codes.has(inferredCountryCode(channel)));
}

async function loadGuideCatalog({ force = false } = {}) {
  if (!guideCatalog || state.guideCatalogLoading) return;
  state.guideCatalogLoading = true;
  state.guideCatalogError = "";
  renderSources();
  try {
    state.guideCatalogCountries = await guideCatalog.countries({ force });
  } catch (error) {
    state.guideCatalogError = error?.message || "Guide catalog unavailable";
  } finally {
    state.guideCatalogLoading = false;
    renderSources();
  }
}

function renderAll() {
  const renderer = { home: renderHome, explore: renderExplore, countries: renderCountries, library: renderLibrary, guide: renderGuide, sources: renderSources }[state.view];
  renderer?.();
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

async function tuneExplore(channel) {
  if (!channel || !isPlayableChannel(channel)) return;
  ui.refs.exploreVideo.muted = state.exploreMuted;
  await explorePlayer.tune(playbackSource(channel), { muted: state.exploreMuted }).catch((error) => {
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
    if (channel) await tuneExplore(channel);
    return;
  }
  ui.refs.exploreVideo.pause();
}

async function openPlayer(channel, { returnMode = "shell" } = {}) {
  if (!channel || !isPlayableChannel(channel)) {
    ui.toast("No browser-playable HLS endpoint is available for this channel.", { tone: "error" });
    return;
  }
  ui.hideProgrammeOverlay?.();
  state.homeMuted = true;
  homePlayer.setMuted(true);
  ui.refs.homeVideo.pause();
  ui.refs.exploreVideo.pause();
  state.playerReturnMode = returnMode;
  if (returnMode === "shell" && ui.refs.root.dataset.mode !== "player") {
    state.playerReturnView = resolvePlayerReturnView(state.view);
  }
  if (returnMode === "multiview") {
    multiview.muteAll();
    ui.refs.multiviewVideos.forEach((video) => video.pause());
  }
  const openedChannelId = channelId(channel);
  const session = ++playerSession;
  state.currentId = openedChannelId;
  state.playerGuideLoadingId = openedChannelId;
  state.playerChromeVisible = false;
  state.playerMuted = state.playerVolume === 0;
  ui.refs.playerVideo.volume = state.playerVolume / 100;
  const source = playbackSource(channel);
  const connection = beginPlayerConnection(source);
  ui.showPlayer(playerUiState({ loading: true, playing: false, chromeVisible: false, connection }));
  void loadSchedules([channel], { preferMapped: true }).finally(() => {
    if (state.playerGuideLoadingId === openedChannelId) state.playerGuideLoadingId = "";
    if (isActivePlayerSession(session, openedChannelId)) ui.updatePlayer(playerUiState());
  });
  await mainPlayer.tune(source, { muted: state.playerMuted }).catch((error) => {
    if (isActivePlayerSession(session, openedChannelId)) {
      advancePlayerConnection("error", { error }, { restart: true });
    }
  });
}

function isActivePlayerSession(session, id) {
  return isPlayerSurfaceActive()
    && session === playerSession
    && state.currentId === id;
}

function isPlayerSurfaceActive() {
  return !playerTransitioning
    && Boolean(state.currentId)
    && ui?.refs?.root?.dataset?.mode === "player";
}

async function loadSchedules(channels, { force = false, preferMapped = false, sourceUrls } = {}) {
  const values = (Array.isArray(channels) ? channels : []).filter(Boolean);
  if (!values.length || (!state.epgSources.length && !values.some((channel) => channel?.hasGuide || channel?.guides?.length || channel?.endpoints?.some((endpoint) => endpoint?.guides?.length)))) return;
  if (!force && values.every((channel) => state.schedules.has(channelId(channel)))) return;
  state.guideLoading = true;
  state.guideError = "";
  renderGuide();
  try {
    const schedules = await epg.schedules(values, { force, preferMapped, sourceUrls });
    schedules.forEach((value, key) => state.schedules.set(key, value));
    state.epgLastRefresh = epg.getLastRefresh();
  } catch (error) {
    state.guideError = error.message || "TV guide is unavailable.";
  } finally {
    state.guideLoading = false;
    renderHome();
    renderGuide();
    renderSources();
    if (isPlayerSurfaceActive()) ui.updatePlayer(playerUiState());
  }
}

async function loadCountrySchedules(iso2 = state.selectedCountry, { force = false } = {}) {
  const code = String(iso2 || "").toUpperCase();
  if (!code) return;
  const channels = catalog.list({ country: code }).filter(isPlayableChannel).slice(0, UI_CHANNEL_LIMIT);
  await loadSchedules(channels, { force, sourceUrls: guideSourcesForCountry(code) });
  if (state.selectedCountry === code) renderCountries();
}

async function connectFavoriteGuide(channel) {
  if (!channel) return;
  const id = channelId(channel);
  const countryCode = inferredCountryCode(channel);
  const mappedSources = guideUrlsForChannels([channel]);
  const countrySources = guideSourcesForCountry(countryCode);
  const customSources = groupGuideSources(state.epgSources)
    .filter((group) => group.id === "custom")
    .flatMap((group) => group.sources.map((source) => source.url));
  const configuredSources = [...new Set([...countrySources, ...customSources])];
  const currentSchedule = state.schedules.get(id);

  if (currentSchedule?.status === "unconfigured") state.schedules.delete(id);
  if (!state.schedules.has(id) && (mappedSources.length || configuredSources.length)) {
    await loadSchedules([channel], {
      preferMapped: mappedSources.length > 0,
      sourceUrls: mappedSources.length ? undefined : configuredSources,
    });
  }

  const plan = favoriteGuidePlan({
    schedule: state.schedules.get(id),
    mappedSources,
    configuredSources,
    countryCode,
  });
  const countryName = countryDirectoryMaps().byCode.get(countryCode)?.name || countryCode;
  const messages = {
    ready: "Favorite saved · TV guide ready.",
    stale: "Favorite saved · the connected guide data is outdated.",
    unmatched: "Favorite saved · the connected guide has no match for this channel.",
    error: "Favorite saved · the guide could not be refreshed.",
    loading: "Favorite saved · guide connection is in progress.",
    "needs-country-guide": `Favorite saved · connect the ${countryName || "country"} guide to add schedules.`,
    "needs-manual-guide": "Favorite saved · no guide provider is associated with this channel.",
  };
  const actionLabels = {
    "open-favorite-guide-setup": "Connect guide",
    "open-guide-settings": "Guide settings",
  };
  ui.toast(messages[plan.status], {
    duration: plan.action ? 7200 : 3600,
    action: plan.action ? {
      label: actionLabels[plan.action],
      name: plan.action,
      dataset: { iso2: countryCode },
    } : undefined,
  });
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
  await loadSchedules(guideCandidateChannels(), { force: true });
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

function applyDefaultMultiviewPreset(incomingChannel = null) {
  const entry = defaultMultiviewPresetState(state.multiviewPresets, channelId(incomingChannel));
  if (!entry) return false;
  state.multiviewLayout = Math.max(2, Math.min(4, Number(entry.preset.layout) || 4));
  state.multiviewFeeds = entry.channelIds.map(findChannel).filter(Boolean);
  state.selectedMultiviewPresetId = entry.customized ? "" : entry.preset.id;
  updatePresetOptions();
  return true;
}

function createMultiviewController() {
  return new MultiviewController({
    staggerMs: 180,
    onDegrade: () => ui.toast("A feed was isolated to keep Multiview responsive.", { tone: "error" }),
  });
}

function createMainPlayer() {
  return new PlayerManager({ video: ui.refs.playerVideo, id: "main", onEvent: (type, detail) => {
    if (type === "tuning") advancePlayerConnection("tuning", detail);
    if (type === "progress") advancePlayerConnection(detail.phase, detail);
    if (type === "retrying" || type === "recovering" || type === "fallback") {
      advancePlayerConnection(type, detail, { restart: true });
    }
    if (type === "fatal") advancePlayerConnection("error", { ...detail, error: detail.error }, { restart: true });
    if (type === "autoplay-blocked") {
      finishPlayerConnection();
      ui.updatePlayer(playerUiState({ loading: false, chromeVisible: true, playing: false }));
    }
  } });
}

async function openMultiview(seed, { fill = true } = {}) {
  homePlayer.setMuted(true);
  ui.refs.homeVideo.pause();
  ui.refs.exploreVideo.pause();
  mainPlayer.setMuted(true);
  ui.refs.playerVideo.pause();
  if (fill) fillMultiview(seed);
  const feeds = state.multiviewFeeds.slice(0, state.multiviewLayout);
  state.multiviewAudioIndex = null;
  ui.showMultiview({ feeds: feeds.map(decorateChannel), layout: state.multiviewLayout, mutedAll: true, chromeVisible: true });
  setMultiviewChrome(true);
  await multiview.start(feeds.map(playbackSource), { count: state.multiviewLayout, videos: ui.refs.multiviewVideos });
}

async function releaseMainPlayer() {
  const result = await releasePlayerForTransition({
    manager: mainPlayer,
    video: ui.refs.playerVideo,
    fullscreenRoot: ui.refs.player,
    documentRef: document,
  });
  if (!result.released) {
    state.playerChromeVisible = true;
    ui.updatePlayer(playerUiState({
      chromeVisible: true,
      muted: ui.refs.playerVideo.muted,
      playing: !ui.refs.playerVideo.paused,
    }));
    ui.toast(t("player.fullscreenExitFailed", "Could not exit full screen. Playback stayed in the player."), { tone: "error" });
    return false;
  }
  finishPlayerConnection();
  playerSession += 1;
  state.playerGuideLoadingId = "";
  mainPlayer = createMainPlayer();
  return true;
}

async function addCurrentPlayerToMultiview() {
  if (playerTransitioning) return;
  const seed = findChannel(state.currentId);
  if (!seed || !isPlayableChannel(seed)) return;
  playerTransitioning = true;
  try {
    if (!await releaseMainPlayer()) return;
    state.playerReturnMode = "shell";
    state.currentId = "";
    const loadedPreset = applyDefaultMultiviewPreset(seed);
    await openMultiview(loadedPreset ? null : seed);
  } finally {
    playerTransitioning = false;
  }
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
  if (state.view === "explore") {
    refreshExploreCollectionSamples();
    renderExplore();
  }
  ui.showView(state.view);
  void syncShellPreview();
}

async function closePlayerOverlay() {
  if (playerTransitioning) return;
  const returnMode = state.playerReturnMode;
  playerTransitioning = true;
  try {
    if (!await releaseMainPlayer()) return;
    if (returnMode !== "multiview") {
      state.playerReturnMode = "shell";
      state.view = resolvePlayerReturnView(state.playerReturnView, state.view);
      closeOverlays();
      return;
    }

    state.playerReturnMode = "shell";
    const requestedAudioIndex = state.multiviewAudioIndex;
    const feeds = state.multiviewFeeds.slice(0, state.multiviewLayout);
    multiview.muteAll();
    ui.showMultiview({
      feeds: feeds.map(decorateChannel),
      layout: state.multiviewLayout,
      mutedAll: true,
      chromeVisible: true,
    });
    const resumed = await Promise.all(ui.refs.multiviewVideos.slice(0, state.multiviewLayout).map(async (video) => {
      try {
        await video.play();
        return true;
      } catch {
        return false;
      }
    }));
    if (requestedAudioIndex !== null && resumed[requestedAudioIndex]) {
      state.multiviewAudioIndex = requestedAudioIndex;
      multiview.registerUserGesture(`slot-${requestedAudioIndex + 1}`);
    } else {
      state.multiviewAudioIndex = null;
      multiview.muteAll();
    }
    ui.updateMultiview({
      feeds: feeds.map(decorateChannel),
      layout: state.multiviewLayout,
      audioIndex: state.multiviewAudioIndex,
    });
    setMultiviewChrome(true);
  } finally {
    playerTransitioning = false;
  }
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

async function toggleFullscreen(target) {
  try {
    if (document.fullscreenElement) await document.exitFullscreen?.();
    else if (typeof target?.requestFullscreen === "function") await target.requestFullscreen();
    else throw new Error("Fullscreen API unavailable");
  } catch {
    ui.toast("Full screen is unavailable in this browser.", { tone: "error" });
  }
}

async function handleAction(action, detail) {
  const id = detail.dataset.channelId || detail.element?.closest?.("[data-channel-id]")?.dataset.channelId;
  if (ui.refs.root.dataset.mode === "multiview" && action !== "toggle-multiview-chrome") revealMultiviewChrome();
  switch (action) {
    case "trigger-signal-easter-egg":
      ui.playSignalEasterEgg?.();
      break;
    case "toggle-more-menu": {
      const open = ui.refs.moreMenu.hidden;
      ui.refs.moreMenu.hidden = !open;
      ui.refs.moreSummary.setAttribute("aria-expanded", String(open));
      break;
    }
    case "toggle-mobile-search": {
      const open = !ui.refs.searchForm.classList.contains("is-open");
      ui.refs.searchForm.classList.toggle("is-open", open);
      ui.refs.searchToggle.setAttribute("aria-expanded", String(open));
      if (open) requestAnimationFrame(() => ui.refs.searchInput.focus());
      break;
    }
    case "close-mobile-search": {
      ui.refs.searchForm.classList.remove("is-open");
      ui.refs.searchToggle.setAttribute("aria-expanded", "false");
      ui.refs.searchToggle.focus();
      break;
    }
    case "navigate": {
      if (ui.refs.moreMenu) ui.refs.moreMenu.hidden = true;
      ui.refs.searchForm.classList.remove("is-open");
      ui.refs.searchToggle.setAttribute("aria-expanded", "false");
      const targetView = detail.dataset.mode === "explore" ? "explore" : detail.dataset.view || "home";
      const shouldRandomizeHome = targetView === "home";
      const shouldRandomizeExplore = targetView === "explore";
      const opensFavoriteLibrary = targetView === "library" && detail.dataset.libraryFilter === "favorites";
      state.view = targetView;
      if (opensFavoriteLibrary) {
        state.libraryFavoritesOnly = true;
        state.libraryQuery = "";
        state.libraryCategory = "";
        state.libraryLanguage = "";
        state.libraryLimit = UI_CHANNEL_LIMIT;
      }
      if (shouldRandomizeHome) {
        refreshWorldMix();
        const randomHome = nextRandomHomeChannel();
        if (randomHome) state.featuredId = channelId(randomHome);
      }
      if (shouldRandomizeExplore) refreshExploreCollectionSamples();
      renderAll();
      ui.showView(state.view);
      if (state.view === "guide") void loadSchedules(guideCandidateChannels());
      if (state.view === "sources" && !state.guideCatalogCountries.length) void loadGuideCatalog();
      if (shouldRandomizeHome) await tuneHome(findChannel(state.featuredId));
      else await syncShellPreview();
      break;
    }
    case "filter-explore": {
      state.exploreCategory = detail.dataset.category || "all";
      state.exploreFeaturedId = "";
      state.exploreCategorySort = "relevance";
      state.exploreCountry = "";
      state.exploreCategoryLimit = EXPLORE_PAGE_SIZE;
      renderExplore();
      ui.refs.views.explore.scrollTop = 0;
      const channel = findChannel(state.exploreFeaturedId);
      if (channel) await tuneExplore(channel);
      break;
    }
    case "randomize-explore-collection": {
      const collectionId = detail.dataset.collection;
      const fullCollections = fullExploreCollections("all");
      const collection = fullCollections.find((item) => item.id === collectionId);
      if (!collection) break;
      const byId = new Map(collection.channels.map((channel) => [channelId(channel), channel]));
      const sampled = (state.exploreCollectionSamples.get(collectionId) || [])
        .map((id) => byId.get(id))
        .filter(Boolean);
      const currentIds = sampled.length
        ? sampled.map(channelId)
        : collection.channels.slice(0, EXPLORE_PREVIEW_LIMIT).map(channelId);
      const sample = randomizeExploreChannels(collection.channels, {
        limit: EXPLORE_PREVIEW_LIMIT,
        previousIds: currentIds,
      });
      state.exploreCollectionSamples.set(collectionId, sample.map(channelId));
      renderExplore();
      break;
    }
    case "sort-explore":
      state.exploreCategorySort = detail.dataset.sort || detail.value || "relevance";
      state.exploreCategoryLimit = EXPLORE_PAGE_SIZE;
      renderExplore();
      break;
    case "filter-explore-country": {
      state.exploreCountry = detail.value || "";
      state.exploreFeaturedId = "";
      state.exploreCategoryLimit = EXPLORE_PAGE_SIZE;
      renderExplore();
      const channel = findChannel(state.exploreFeaturedId);
      if (channel) await tuneExplore(channel);
      break;
    }
    case "load-more-explore": {
      const total = exploreCollections(fullExploreCollections())[0]?.totalCount || 0;
      if (state.exploreCategory !== "all" && state.exploreCategoryLimit < total) {
        state.exploreCategoryLimit += EXPLORE_PAGE_SIZE;
        renderExplore();
      }
      break;
    }
    case "explore-random": {
      const collections = fullExploreCollections();
      const pool = collections.flatMap((collection) => collection.channels || []);
      const alternatives = pool.filter((channel) => channelId(channel) !== state.exploreFeaturedId);
      const channel = (alternatives.length ? alternatives : pool)[Math.floor(Math.random() * Math.max(1, alternatives.length || pool.length))];
      if (!channel) break;
      state.exploreFeaturedId = channelId(channel);
      renderExplore();
      const source = findChannel(state.exploreFeaturedId);
      if (source) await tuneExplore(source);
      break;
    }
    case "tune-explore-channel": {
      const channel = findChannel(id);
      if (!channel || !isPlayableChannel(channel)) break;
      state.exploreFeaturedId = channelId(channel);
      renderExplore();
      ui.refs.views.explore.scrollTop = 0;
      await tuneExplore(channel);
      break;
    }
    case "toggle-explore-audio": {
      state.exploreMuted = !ui.refs.exploreVideo.muted;
      explorePlayer.setMuted(state.exploreMuted);
      if (!state.exploreMuted) await ui.refs.exploreVideo.play().catch(() => {});
      renderExplore();
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
      ui.refs.searchForm.classList.remove("is-open");
      ui.refs.searchToggle.setAttribute("aria-expanded", "false");
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
    case "open-channel-guide": {
      const channel = findChannel(id);
      if (!channel) break;
      if (ui.expandGuideProgrammeCard?.(detail.element)) break;
      if (!state.schedules.has(id)) await loadSchedules([channel]);
      ui.showProgrammeOverlay(decorateChannel(channel));
      break;
    }
    case "close-channel-guide":
      ui.hideProgrammeOverlay();
      break;
    case "tune-home-channel": {
      const channel = findChannel(id);
      if (channel && isPlayableChannel(channel)) setHomeFeatured(channel);
      break;
    }
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
    case "refresh-home-suggestions":
      refreshWorldMix();
      renderHome();
      void loadSchedules(state.worldMixIds.map(findChannel).filter(Boolean));
      break;
    case "toggle-home-audio": {
      state.homeMuted = !ui.refs.homeVideo.muted;
      homePlayer.setMuted(state.homeMuted);
      if (!state.homeMuted) await ui.refs.homeVideo.play().catch(() => {});
      renderHome();
      break;
    }
    case "random-player-channel": {
      const next = catalog.randomPlayable({ currentChannelId: state.currentId, filters: {} });
      if (next && isPlayableChannel(next)) await openPlayer(next, { returnMode: state.playerReturnMode });
      else ui.toast("No other browser-playable channel is available.", { tone: "error" });
      break;
    }
    case "toggle-favorite":
    case "add-favorite":
    case "remove-favorite": {
      if (!id) break;
      const wasFavorite = state.lastCatalog?.favorites.has(id);
      if (action === "add-favorite" && wasFavorite) break;
      if (action === "remove-favorite" && !wasFavorite) break;
      const effect = wasFavorite ? "remove" : "add";
      const animation = ui.playFavoriteEffect?.(detail.element, effect);
      if (effect === "remove") await animation;
      await catalog.toggleFavorite(id);
      if (ui.refs.root.dataset.mode === "player" && id === state.currentId) {
        ui.updatePlayer(playerUiState({ chromeVisible: state.playerChromeVisible }));
      }
      if (effect === "add") void connectFavoriteGuide(findChannel(id));
      break;
    }
    case "open-favorite-guide-setup": {
      const iso2 = String(detail.dataset.iso2 || "").toUpperCase();
      if (!/^[A-Z]{2}$/.test(iso2)) {
        state.view = "sources";
        renderAll();
        ui.showView("sources");
        break;
      }
      const installedSources = guideSourcesForCountry(iso2);
      if (installedSources.length) {
        await loadCountrySchedules(iso2, { force: true });
        ui.toast("This country guide is already connected in Preferences.");
        break;
      }
      const country = countryModels().find((item) => item.code === iso2);
      ui.showCountryGuideDialog({ iso2, name: country?.name || iso2 });
      break;
    }
    case "close-country-guide-dialog":
      ui.showCountryGuideDialog(false);
      break;
    case "open-guide-settings":
      if (ui.refs.root.dataset.mode === "player") {
        await closePlayerOverlay();
        if (ui.refs.root.dataset.mode === "player") break;
      }
      state.view = "sources";
      renderAll();
      ui.showView("sources");
      if (!state.guideCatalogCountries.length) void loadGuideCatalog();
      break;
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
        await loadSchedules(guideCandidateChannels(), { force: true });
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
      await loadSchedules(guideCandidateChannels(), { force: true });
      break;
    case "filter-guide-catalog":
      state.guideCatalogQuery = detail.value || "";
      renderSources();
      break;
    case "add-guide-country": {
      const country = state.guideCatalogCountries.find((item) => item.id === detail.dataset.countryId);
      if (!country) break;
      try {
        const files = await guideCatalog.country(country);
        const added = files.map((file) => file.url).filter((url) => !state.epgSources.includes(url));
        state.epgSources = await epg.setSources([...state.epgSources, ...added]);
        state.schedules.clear();
        renderSources();
        const code = countryCodeForGuideName(country.name);
        const candidates = playableChannels().filter((channel) => !code || inferredCountryCode(channel) === code);
        await loadSchedules(candidates, { force: true, sourceUrls: files.map((file) => file.url) });
        const matched = candidates.filter((channel) => state.schedules.get(channelId(channel))?.matched).length;
        ui.toast(`${country.name}: ${added.length} source${added.length === 1 ? "" : "s"} downloaded · ${matched} channels matched.`);
      } catch (error) {
        ui.toast(error?.message || "Could not add this guide country.", { tone: "error" });
      }
      break;
    }
    case "remove-guide-source": {
      const url = detail.dataset.url;
      if (!url) break;
      state.epgSources = await epg.setSources(state.epgSources.filter((source) => source !== url));
      state.schedules.clear();
      renderSources();
      renderGuide();
      ui.toast("TV Guide source removed.");
      break;
    }
    case "remove-guide-country": {
      const countryId = detail.dataset.countryId;
      const group = groupGuideSources(state.epgSources).find((item) => item.id === countryId);
      if (!group) break;
      const urls = new Set(group.sources.map((source) => source.url));
      state.epgSources = await epg.setSources(state.epgSources.filter((source) => !urls.has(source)));
      state.schedules.clear();
      renderSources();
      renderGuide();
      ui.toast(`${group.name} guide removed.`);
      break;
    }
    case "filter-guide":
      state.guideQuery = detail.value || "";
      renderGuide();
      break;
    case "filter-guide-favorites":
      state.guideFavoritesOnly = !state.guideFavoritesOnly;
      renderGuide();
      break;
    case "guide-now":
      ui.refs.guideGrid.querySelector(".guide-timeline")?.scrollTo({ left: 0, behavior: "smooth" });
      break;
    case "add-channel-guide": {
      state.view = "sources";
      renderSources();
      ui.showView("sources");
      if (detail.dataset.country === "IT") {
        const preset = epgPreset("open-epg-italy");
        if (preset) ui.refs.guideInput.value = preset.urls.join("\n");
        ui.toast("Italy guide sources are ready to review and approve.");
      } else {
        ui.refs.guideInput.focus();
        ui.toast("Add a country XMLTV source, then save it to match this channel.");
      }
      break;
    }
    case "select-country":
      state.selectedCountry = String(detail.dataset.iso2 || "").toUpperCase();
      state.countryChannelQuery = "";
      state.countryChannelCategory = "";
      state.countryChannelLanguage = "";
      state.countryChannelLimit = UI_CHANNEL_LIMIT;
      state.view = "countries";
      renderCountries();
      void loadCountrySchedules();
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
      void loadCountrySchedules();
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
    case "load-all-country-channels":
      state.countryChannelLimit = Number.MAX_SAFE_INTEGER;
      renderCountries();
      break;
    case "load-country-guide": {
      const iso2 = String(detail.dataset.iso2 || state.selectedCountry || "").toUpperCase();
      const channels = iso2 ? catalog.list({ country: iso2 }).filter(isPlayableChannel) : [];
      const accepted = Boolean(detail.formData?.get("countryGuideConsent"));
      if (!accepted) {
        ui.toast("Accept the third-party guide notice before connecting this country.", { tone: "error" });
        break;
      }
      state.countryGuideLoading = iso2;
      ui.setCountryGuideDialogBusy(true);
      renderCountries();
      try {
        const guideUrls = await discoverCountryGuideUrls(iso2, {
          force: ["error", "unavailable"].includes(state.countryGuideAvailability.get(iso2)),
        });
        if (!guideUrls.length) {
          ui.toast("GlobeTV does not currently publish an XMLTV source for this country.", { tone: "error" });
          break;
        }
        const merged = [...new Set([...state.epgSources, ...guideUrls])];
        const added = merged.length > state.epgSources.length;
        if (added) {
          state.epgSources = await epg.setSources(merged);
          scheduleGuideRefresh();
        }
        channels.forEach((channel) => state.schedules.delete(channelId(channel)));
        renderSources();
        renderGuide();
        await loadCountrySchedules(iso2, { force: true });
        ui.showCountryGuideDialog(false);
        if (state.guideError) ui.toast(`Guide saved in Preferences, but refresh failed: ${state.guideError}`, { tone: "error" });
        else ui.toast(added
          ? "Country guide added to Preferences and refreshed."
          : "Country guide already connected in Preferences and refreshed.");
      } catch (error) {
        ui.toast(error.message || "The country guide could not be connected.", { tone: "error" });
      } finally {
        state.countryGuideLoading = "";
        ui.setCountryGuideDialogBusy(false);
        renderCountries();
      }
      break;
    }
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
    case "retry-installation-sync": {
      const synced = await catalog.retryInstallationSync();
      renderSources();
      ui.toast(
        synced ? t("settings.syncRetrySuccess", "Shared storage is synchronized.") : t("settings.syncRetryFailed", "Shared storage is still unavailable."),
        { tone: synced ? "success" : "error" },
      );
      break;
    }
    case "recover-installation-data":
      if (window.confirm(t(
        "settings.syncRecoverConfirm",
        "Merge the retained browser sources and Favorites into the shared library? Existing shared data will be kept.",
      ))) {
        const recovered = await catalog.recoverInstallationData();
        renderAll();
        ui.toast(
          recovered ? t("settings.syncRecoverSuccess", "Retained data was merged into the shared library.") : t("settings.syncRecoverFailed", "Recovery is queued and will retry when shared storage reconnects."),
          { tone: recovered ? "success" : "error" },
        );
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
    case "export-backup": {
      const backup = createConfigurationBackup({
        sources: state.lastCatalog?.sources,
        favorites: state.lastCatalog?.favorites,
        proxy: state.proxy,
        guideSources: state.epgSources,
        guideRefreshMinutes: state.epgRefreshMinutes,
        multiviewLayout: state.multiviewLayout,
        multiviewPresets: state.multiviewPresets,
      });
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `catodo-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 0);
      ui.toast("Backup downloaded.");
      break;
    }
    case "import-backup": {
      const file = detail.target?.files?.[0];
      if (!file || file.size > 1_000_000) { if (file) ui.toast("Backup is too large.", { tone: "error" }); break; }
      try {
        const backup = JSON.parse(await file.text());
        if (backup?.schema !== "catodo-backup" || backup.version !== 1) throw new Error("Unsupported CATODO backup.");
        if (!window.confirm(`Merge ${backup.sources?.length || 0} sources, ${backup.favorites?.length || 0} Favorites, and ${backup.multiviewPresets?.length || 0} presets into this installation?`)) break;
        for (const source of backup.sources || []) await catalog.importUrl(source.url, { confirmed: true, name: source.name, proxy: state.proxy || undefined });
        for (const id of backup.favorites || []) if (!state.lastCatalog?.favorites.has(id) && findChannel(id)) await catalog.toggleFavorite(id);
        if (backup.settings?.proxy !== undefined) { state.proxy = String(backup.settings.proxy || ""); await catalog.setSetting("proxy", state.proxy); }
        if (Array.isArray(backup.settings?.guideSources)) state.epgSources = await epg.setSources(backup.settings.guideSources);
        if (backup.settings?.guideRefreshMinutes !== undefined) state.epgRefreshMinutes = await epg.setRefreshMinutes(backup.settings.guideRefreshMinutes);
        if (backup.settings?.multiviewLayout !== undefined) await persistMultiviewLayout(backup.settings.multiviewLayout);
        await persistMultiviewPresets([...state.multiviewPresets, ...(backup.multiviewPresets || [])]);
        renderAll(); ui.toast("Backup merged successfully.");
      } catch (error) { ui.toast(error.message || "Backup could not be restored.", { tone: "error" }); }
      finally { detail.target.value = ""; }
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
    case "toggle-fullscreen": {
      const target = ui.refs.root.dataset.mode === "multiview" ? ui.refs.multiview : ui.refs.player;
      await toggleFullscreen(target);
      break;
    }
    case "add-to-multiview":
      await addCurrentPlayerToMultiview();
      break;
    case "open-multiview":
      await openMultiview(applyDefaultMultiviewPreset() ? null : findChannel(id || state.featuredId));
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
      await persistMultiviewLayout(detail.dataset.count);
      await openMultiview();
      break;
    case "save-multiview-preset": {
      if (!state.multiviewFeeds.length) break;
      const name = window.prompt("Preset name", `Multiview ${state.multiviewPresets.length + 1}`)?.trim();
      if (!name) break;
      const preset = { id: `preset-${Date.now()}`, name: name.slice(0, 40), layout: state.multiviewLayout, channelIds: state.multiviewFeeds.slice(0, state.multiviewLayout).map(channelId) };
      state.multiviewPresets = [...state.multiviewPresets, preset];
      state.selectedMultiviewPresetId = preset.id;
      await persistMultiviewPresets(state.multiviewPresets); ui.toast("Multiview preset saved.");
      break;
    }
    case "load-multiview-preset": {
      state.selectedMultiviewPresetId = detail.value || "";
      const preset = findMultiviewPreset(state.multiviewPresets, state.selectedMultiviewPresetId);
      updatePresetOptions();
      if (!preset) break;
      state.multiviewLayout = preset.layout;
      state.multiviewFeeds = preset.channelIds.map(findChannel).filter(Boolean);
      await openMultiview();
      break;
    }
    case "rename-multiview-preset": {
      const preset = findMultiviewPreset(state.multiviewPresets, state.selectedMultiviewPresetId);
      if (!preset) break;
      const name = window.prompt("Rename preset", preset.name)?.trim();
      if (!name) break;
      await persistMultiviewPresets(renameMultiviewPreset(state.multiviewPresets, preset.id, name));
      ui.toast("Multiview preset renamed.");
      break;
    }
    case "delete-multiview-preset": {
      const preset = findMultiviewPreset(state.multiviewPresets, state.selectedMultiviewPresetId);
      if (!preset || !window.confirm(`Delete the preset “${preset.name}”?`)) break;
      const remainingPresets = deleteMultiviewPreset(state.multiviewPresets, preset.id);
      state.selectedMultiviewPresetId = "";
      await persistMultiviewPresets(remainingPresets);
      ui.toast("Multiview preset deleted.");
      break;
    }
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
  const audible = multiview.toggleAudio(slotId);
  state.multiviewAudioIndex = audible ? index : null;
  if (audible) {
    try {
      await ui.refs.multiviewVideos[index]?.play();
    } catch {
      multiview.muteAll();
      state.multiviewAudioIndex = null;
      ui.toast(t("multiview.audioBlocked", "Tap the feed again to enable audio."), { tone: "error" });
    }
  }
  ui.updateMultiview({
    feeds: state.multiviewFeeds.slice(0, state.multiviewLayout).map(decorateChannel),
    layout: state.multiviewLayout,
    audioIndex: state.multiviewAudioIndex,
  });
}

function bindVideoEvents() {
  ui.refs.homeVideo.addEventListener("playing", () => {
    state.homeFailureCount = 0;
    state.homeFailedIds = [];
    ui.updateHeader({ signalOk: true });
  });
  ui.refs.playerVideo.addEventListener("playing", async () => {
    if (!isPlayerSurfaceActive()) return;
    finishPlayerConnection();
    ui.updatePlayer(playerUiState({ loading: false, playing: true, connection: null }));
    if (state.currentId && lastRememberedId !== state.currentId) {
      lastRememberedId = state.currentId;
      await catalog.remember(state.currentId, { endpointId: firstEndpoint(findChannel(state.currentId))?.endpointId });
    }
  });
  ui.refs.playerVideo.addEventListener("pause", () => {
    if (!isPlayerSurfaceActive()) return;
    ui.updatePlayer(playerUiState({ playing: false }));
  });
  ui.refs.playerVideo.addEventListener("waiting", () => {
    if (!isPlayerSurfaceActive()) return;
    advancePlayerConnection("waiting", {}, { restart: true });
  });
  ui.refs.playerVideo.addEventListener("loadedmetadata", () => {
    if (isPlayerSurfaceActive()) advancePlayerConnection("metadata");
  });
  ui.refs.playerVideo.addEventListener("canplay", () => {
    if (isPlayerSurfaceActive()) advancePlayerConnection("canplay");
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
  const legacyMultiviewLayout = readLocalJson("catodo:multiview-layout", null);
  state.multiviewLayout = normalizeMultiviewLayout(legacyMultiviewLayout);
  const legacyMultiviewPresets = normalizeMultiviewPresets(readLocalJson("catodo:multiview-presets", []));
  state.multiviewPresets = legacyMultiviewPresets;
  updatePresetOptions();
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

  catalog = new CatalogService({
    proxy: state.proxy || undefined,
    localStorage: legacyStorage(),
    onSyncError: reportInstallationSyncError,
  });
  await catalog.init();
  const layoutSync = resolveMultiviewLayoutSync(
    await catalog.getSetting(MULTIVIEW_LAYOUT_SETTING, null),
    legacyMultiviewLayout,
  );
  state.multiviewLayout = layoutSync.layout;
  writeLocalJson("catodo:multiview-layout", state.multiviewLayout);
  if (layoutSync.migrateLegacy) await catalog.setSetting(MULTIVIEW_LAYOUT_SETTING, state.multiviewLayout);
  const presetSync = resolveMultiviewPresetSync(
    await catalog.getSetting(MULTIVIEW_PRESETS_SETTING, null),
    legacyMultiviewPresets,
  );
  state.multiviewPresets = presetSync.presets;
  writeLocalJson("catodo:multiview-presets", state.multiviewPresets);
  updatePresetOptions();
  if (presetSync.migrateLegacy) await catalog.setSetting(MULTIVIEW_PRESETS_SETTING, state.multiviewPresets);
  state.proxy = await catalog.getSetting("proxy", "");
  epg = new EpgService({ catalog, proxy: proxyUrl });
  await epg.init();
  guideCatalog = new GlobeTvCatalog({ catalog });
  state.epgSources = epg.getSources();
  state.epgRefreshMinutes = epg.getRefreshMinutes();
  state.epgLastRefresh = epg.getLastRefresh();
  scheduleGuideRefresh();
  unsubscribeCatalog = catalog.subscribe((snapshot) => {
    state.lastCatalog = snapshot;
    rebuildCountryDirectoryMaps(snapshot.countries);
    const first = playableChannels(snapshot.channels)[0];
    if (!initialHomeSelectionDone && first) {
      refreshWorldMix();
      const initial = selectInitialHomeChannel({
        favorites: catalog.list({ favorite: true }).filter(isPlayableChannel),
        pickRandom: nextRandomHomeChannel,
        fallback: first,
      });
      state.featuredId = channelId(initial);
      initialHomeSelectionDone = true;
    }
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
          loadedBytes: footerMetrics.loadedBytes,
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
  clearPlayerConnectionTimer();
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
