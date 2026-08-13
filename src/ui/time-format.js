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

function firstTimeZone(channel) {
  const endpoints = Array.isArray(channel?.endpoints) ? channel.endpoints : [];
  const candidates = [
    channel?.timezone,
    ...(Array.isArray(channel?.timezones) ? channel.timezones : []),
    ...endpoints.flatMap((endpoint) => [
      endpoint?.timezone,
      ...(Array.isArray(endpoint?.timezones) ? endpoint.timezones : []),
    ]),
  ].map((value) => String(value || '').trim()).filter(Boolean);

  return candidates.find((timeZone) => {
    try {
      new Intl.DateTimeFormat('en', { timeZone }).format(0);
      return true;
    } catch {
      return false;
    }
  }) || '';
}

export function channelLocalTime(channel, value = Date.now(), { locale } = {}) {
  const timeZone = firstTimeZone(channel);
  if (!timeZone) return null;
  const place = timeZone.split('/').pop()?.replaceAll('_', ' ') || timeZone;
  return {
    timeZone,
    place,
    time: formatGuideTime(value, { locale, timeZone }),
  };
}
