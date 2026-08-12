export const DEFAULT_XMLTV_LIMITS = Object.freeze({
  maxBytes: 20 * 1024 * 1024,
  maxProgrammes: 50_000,
  maxTextLength: 4_096,
});

function decodeEntities(value) {
  return String(value || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(x?[0-9a-f]+);/gi, (_, code) => String.fromCodePoint(
      code[0].toLowerCase() === "x" ? Number.parseInt(code.slice(1), 16) : Number.parseInt(code, 10),
    ))
    .replace(/&amp;/g, "&")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function attr(tag, name) {
  const match = String(tag).match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i"));
  return decodeEntities(match?.[1] ?? match?.[2] ?? "");
}

function childText(body, tag, maxTextLength) {
  const match = String(body).match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return decodeEntities(match?.[1] || "").slice(0, maxTextLength);
}

export function parseXmltvDate(value) {
  const match = String(value || "").trim().match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?(?:\s*([+-])(\d{2})(\d{2}))?/);
  if (!match) return null;
  const [, year, month, day, hour, minute, second = "00", sign, offsetHour = "00", offsetMinute = "00"] = match;
  let timestamp = Date.UTC(+year, +month - 1, +day, +hour, +minute, +second);
  if (sign) {
    const offset = (+offsetHour * 60 + +offsetMinute) * 60_000;
    timestamp += sign === "+" ? -offset : offset;
  }
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function parseXmltv(xml, options = {}) {
  const limits = { ...DEFAULT_XMLTV_LIMITS, ...(options.limits || {}) };
  const source = String(xml ?? "");
  if (new TextEncoder().encode(source).byteLength > limits.maxBytes) {
    throw new RangeError(`TV guide exceeds ${limits.maxBytes} bytes`);
  }
  const programmes = [];
  const pattern = /<programme\b([^>]*)>([\s\S]*?)<\/programme>/gi;
  let match;
  while ((match = pattern.exec(source))) {
    if (programmes.length >= limits.maxProgrammes) {
      throw new RangeError(`TV guide exceeds ${limits.maxProgrammes} programmes`);
    }
    const openTag = match[1];
    const body = match[2];
    const channel = attr(openTag, "channel");
    const start = parseXmltvDate(attr(openTag, "start"));
    const stop = parseXmltvDate(attr(openTag, "stop"));
    const title = childText(body, "title", limits.maxTextLength);
    if (!channel || start === null || stop === null || stop <= start || !title) continue;
    programmes.push({
      id: `${channel}:${start}:${stop}`,
      channel,
      start,
      stop,
      title,
      subtitle: childText(body, "sub-title", limits.maxTextLength),
      description: childText(body, "desc", limits.maxTextLength),
      category: childText(body, "category", 256),
    });
  }
  return programmes;
}

export function programmesForChannel(programmes, channelIds, options = {}) {
  const ids = new Set((Array.isArray(channelIds) ? channelIds : [channelIds])
    .map((value) => String(value || "").trim().toLocaleLowerCase("en-US"))
    .filter(Boolean));
  const from = Number(options.from ?? Date.now());
  const to = Number(options.to ?? from + 3 * 60 * 60 * 1000);
  return (Array.isArray(programmes) ? programmes : [])
    .filter((item) => ids.has(String(item.channel || "").toLocaleLowerCase("en-US")) && item.stop > from && item.start < to)
    .sort((a, b) => a.start - b.start || a.stop - b.stop);
}
