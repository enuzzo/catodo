import { APP_VERSION } from '../version.js';

export async function loadTheatreJson(path, { limit, signal, compressed = false, fetchImpl = (...args) => fetch(...args) }) {
  const version = encodeURIComponent(APP_VERSION);
  let response = await fetchImpl(`./theatre/${path}${compressed ? '.gz' : ''}?v=${version}`, { signal });
  if (compressed && response.status === 404) response = await fetchImpl(`./theatre/${path}?v=${version}`, { signal });
  if (!response.ok || Number(response.headers.get('content-length')) > limit) throw new Error('Theatre catalog unavailable');
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length > limit) throw new Error('Theatre catalog too large');
  // The host may have already decompressed an encoded response.
  const text = bytes[0] === 31 && bytes[1] === 139
    ? await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text()
    : new TextDecoder().decode(bytes);
  if (text.length > limit) throw new Error('Theatre catalog too large');
  return JSON.parse(text);
}
