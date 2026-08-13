export function formatGuideTime(value, { locale, timeZone } = {}) {
  const date = new Date(Number(value));
  if (!Number.isFinite(date.getTime())) return "--:--";
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    ...(timeZone ? { timeZone } : {}),
  }).format(date);
}

export function formatGuideDateTime(value, { locale, timeZone } = {}) {
  const date = new Date(Number(value));
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    hourCycle: "h23",
    ...(timeZone ? { timeZone } : {}),
  }).format(date);
}
