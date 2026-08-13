function sourceCount(value) {
  if (Array.isArray(value)) return value.length;
  return Math.max(0, Number(value) || 0);
}

export function favoriteGuidePlan({
  schedule,
  mappedSources = 0,
  configuredSources = 0,
  countryCode = "",
} = {}) {
  const status = String(schedule?.status || "unconfigured");
  const hasSources = sourceCount(mappedSources) + sourceCount(configuredSources) > 0;

  if (status === "ready") return { status: "ready", action: "" };
  if (status === "stale" && hasSources) return { status: "stale", action: "open-guide-settings" };
  if (status === "unmatched" && hasSources) return { status: "unmatched", action: "open-guide-settings" };
  if (status === "error" && hasSources) return { status: "error", action: "open-guide-settings" };
  if (hasSources) return { status: "loading", action: "" };
  if (/^[A-Z]{2}$/.test(String(countryCode || "").toUpperCase())) {
    return { status: "needs-country-guide", action: "open-favorite-guide-setup" };
  }
  return { status: "needs-manual-guide", action: "open-guide-settings" };
}
