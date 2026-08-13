export const DEFAULT_FETCH_LIMITS = Object.freeze({ maxBytes: 20 * 1024 * 1024, timeoutMs: 20_000 });
function proxyUrl(proxy, target) {
  if (!proxy) return null;
  const normalized = String(proxy).replace(/\/+$/, "");
  return `${normalized}/?url=${encodeURIComponent(target)}`;
}

async function readLimited(response, maxBytes) {
  const announced = Number(response.headers.get("content-length") || 0);
  if (announced > maxBytes) throw new RangeError(`Source exceeds ${maxBytes} bytes`);
  if (!response.body?.getReader) {
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > maxBytes) throw new RangeError(`Source exceeds ${maxBytes} bytes`);
    return text;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new RangeError(`Source exceeds ${maxBytes} bytes`);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  chunks.forEach((chunk) => { bytes.set(chunk, offset); offset += chunk.byteLength; });
  return new TextDecoder().decode(bytes);
}

export async function fetchPlaylist(url, options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (!fetchImpl) throw new Error("Fetch is not available");
  const limits = { ...DEFAULT_FETCH_LIMITS, ...(options.limits || {}) };
  const candidates = [url, proxyUrl(options.proxy, url)].filter(Boolean);
  let lastError;
  for (const target of candidates) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    options.signal?.addEventListener('abort', abort, { once: true });
    if (options.signal?.aborted) controller.abort();
    const timer = setTimeout(() => controller.abort(), limits.timeoutMs);
    try {
      const headers = { Accept: "audio/x-mpegurl, application/vnd.apple.mpegurl, text/plain, */*" };
      if (options.etag) headers["If-None-Match"] = options.etag;
      if (options.lastModified) headers["If-Modified-Since"] = options.lastModified;
      const response = await fetchImpl(target, { headers, cache: "no-cache", signal: controller.signal });
      if (response.status === 304) return { notModified: true, etag: options.etag, lastModified: options.lastModified };
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await readLimited(response, limits.maxBytes);
      if (!/^\s*(?:#EXTM3U|#EXTINF)/m.test(text)) throw new TypeError("Response is not an M3U playlist");
      return { text, etag: response.headers.get("etag"), lastModified: response.headers.get("last-modified"), fetchedUrl: target };
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', abort);
    }
  }
  throw lastError || new Error("Source is unreachable");
}
