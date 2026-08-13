const PHASES = {
  start: {
    step: 1,
    title: "Contacting stream",
    detail: "Selecting a browser-compatible route to the provider.",
  },
  tuning: {
    step: 1,
    title: "Opening stream endpoint",
    detail: "Connecting to the selected provider endpoint.",
  },
  "media-attaching": {
    step: 1,
    title: "Preparing the player",
    detail: "Attaching the stream engine to the video surface.",
  },
  "manifest-loading": {
    step: 2,
    title: "Requesting live playlist",
    detail: "Waiting for the provider to return the HLS manifest.",
  },
  "manifest-parsed": {
    step: 2,
    title: "Live playlist received",
    detail: "The provider replied. Selecting a compatible quality level.",
  },
  "level-loading": {
    step: 2,
    title: "Selecting live quality",
    detail: "Loading the current live media playlist.",
  },
  "fragment-loading": {
    step: 3,
    title: "Downloading first segment",
    detail: "The playlist is valid. Waiting for the first media bytes.",
  },
  buffering: {
    step: 3,
    title: "Building playback buffer",
    detail: "Media bytes arrived. Preparing enough video to start cleanly.",
  },
  metadata: {
    step: 3,
    title: "Stream metadata received",
    detail: "Video information is available. Preparing decoded frames.",
  },
  canplay: {
    step: 4,
    title: "Starting live playback",
    detail: "The browser has enough media to begin playback.",
  },
  waiting: {
    step: 3,
    title: "Live signal interrupted",
    detail: "Playback is waiting for more media from the provider.",
  },
  retrying: {
    step: 2,
    title: "Retrying provider connection",
    detail: "The endpoint did not answer cleanly. Retrying the same route.",
  },
  recovering: {
    step: 3,
    title: "Repairing media playback",
    detail: "The stream arrived but the browser is recovering its decoder.",
  },
  fallback: {
    step: 1,
    title: "Trying a backup endpoint",
    detail: "The previous route failed. Switching to another available source.",
  },
  "native-loading": {
    step: 2,
    title: "Requesting native stream",
    detail: "The browser is opening the HLS playlist directly.",
  },
  error: {
    step: 4,
    title: "Stream unavailable",
    detail: "No playable live signal was returned by this channel.",
  },
};

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function startConnection({ now = Date.now(), route = "direct", endpointCount = 1 } = {}) {
  return {
    phase: "start",
    startedAt: finite(now, Date.now()),
    updatedAt: finite(now, Date.now()),
    route: String(route || "direct").toUpperCase(),
    endpointIndex: 0,
    endpointCount: Math.max(1, finite(endpointCount, 1)),
    attempt: 0,
    error: "",
  };
}

export function advanceConnection(current, phase, detail = {}, { now = Date.now() } = {}) {
  const base = current || startConnection({ now });
  const nextPhase = PHASES[phase] ? phase : base.phase;
  return {
    ...base,
    phase: nextPhase,
    updatedAt: finite(now, Date.now()),
    route: String(detail.endpoint?.route || detail.route || base.route || "direct").toUpperCase(),
    endpointIndex: Math.max(0, finite(detail.endpointIndex, base.endpointIndex)),
    endpointCount: Math.max(1, finite(detail.endpointCount, base.endpointCount)),
    attempt: Math.max(0, finite(detail.attempt, base.attempt)),
    error: phase === "error" ? String(detail.error?.message || detail.error || detail.message || base.error || "") : "",
  };
}

export function connectionView(current, { now = Date.now() } = {}) {
  const value = current || startConnection({ now });
  const phase = PHASES[value.phase] || PHASES.start;
  const elapsedMs = Math.max(0, finite(now, Date.now()) - finite(value.startedAt, now));
  const isError = value.phase === "error";
  let advice = "This is within the normal startup window.";
  if (isError) advice = "This endpoint did not produce a playable signal. Try another channel.";
  else if (elapsedMs >= 12_000) advice = "No playable frames yet. The stream may be offline—try another channel.";
  else if (elapsedMs >= 6_000) advice = "The provider is responding slowly. Waiting may still be worthwhile.";
  const endpoint = `ENDPOINT ${Math.min(value.endpointIndex + 1, value.endpointCount)}/${value.endpointCount}`;
  const attempt = value.attempt > 0 ? ` · RETRY ${value.attempt}` : "";
  return {
    ...value,
    ...phase,
    elapsedMs,
    advice,
    meta: `${value.route || "DIRECT"} · ${endpoint}${attempt}`,
    tone: isError ? "error" : elapsedMs >= 12_000 ? "slow" : "loading",
    canTryAnother: isError || elapsedMs >= 8_000,
  };
}

