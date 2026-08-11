/**
 * CATODO PROXY
 * Cloudflare Worker: fixes the three reasons an IPTV stream does not start in a browser.
 *
 *   1. CORS       the stream server does not send Access-Control-Allow-Origin
 *   2. http       the page is https, the segment is http, Chromium blocks it (mixed content)
 *   3. hotlink    the server requires a specific Referer or User-Agent
 *
 * Deploy:
 *   dash.cloudflare.com > Workers & Pages > Create > Worker
 *   paste this file, Deploy
 *   copy the URL (e.g. https://catodo-proxy.yourname.workers.dev) into Catodo's settings
 *
 * Usage:
 *   https://your-worker.workers.dev/?url=<url-encoded>
 */

// Server side check: a request is rejected unless its Origin header (or, when
// Origin is absent, its Referer header) matches ALLOW_ORIGIN. The
// Access-Control-Allow-Origin response header set in cors() below only tells
// browsers what they may read: it does nothing against curl or any other
// client that ignores CORS, which is why it cannot do this job alone.
//
// Be clear about how far this goes. It stops a browser on someone else's site
// from using the proxy, and it stops the casual case of somebody pasting the
// worker URL around. It does NOT stop a determined person: Origin and Referer
// are just headers, and anyone can send whatever they like with curl. The next
// step up, if this proxy ever gets abused, is a shared secret in the query
// string that only your CATODO knows.
//
// Put the real origin of your CATODO here. "*" disables the check entirely and
// is for local testing only: it leaves the proxy open to everyone.
const ALLOW_ORIGIN = "https://catodo.netmilk.dev";

// Blocks anything that is not a plausible streaming host.
const DENY_HOSTS = [
  /^localhost$/i, /^127\./, /^10\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./, /\.internal$/i, /metadata/i,
  // IPv6 loopback, the all zero address, and decimal/octal encoded IPv4.
  // The URL parser already normalizes most numeric encodings of an IPv4
  // address (0x7f000001, 017700000001, 2130706433) into dotted form before
  // this list runs, so /^127\./ and /^0\.0\.0\.0$/ already catch them; this
  // last pattern is a backstop for any purely numeric hostname that slips
  // through un-normalized.
  /^\[?::1\]?$/i, /^0\.0\.0\.0$/, /^\d+$/
];

// Reasonable upper bound on a playlist body. Real HLS playlists are a few
// KB to a few hundred KB; this just stops an abusive or misconfigured
// upstream from making the worker buffer something huge into memory.
const MAX_PLAYLIST_BYTES = 5 * 1024 * 1024;

// Rules for hosts that require specific headers.
// Add one here when a channel returns 403 but works in a normal browser.
const RULES = {
  // "example.com": { Referer: "https://example.com/", Origin: "https://example.com" },
};

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
           "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export default {
  async fetch(request) {
    const here = new URL(request.url);

    if (!originAllowed(request)) return forbidden();

    if (request.method === "OPTIONS") return preflight();

    const target = here.searchParams.get("url");
    if (!target) {
      return new Response("CATODO PROXY. Usage: /?url=<url-encoded>", {
        status: 400, headers: cors({ "content-type": "text/plain; charset=utf-8" })
      });
    }

    let up;
    try { up = new URL(target); } catch { return bad("Invalid URL"); }
    if (!/^https?:$/.test(up.protocol)) return bad("Only http and https");
    if (DENY_HOSTS.some(re => re.test(up.hostname))) return bad("Host not allowed");

    // outgoing headers
    const out = new Headers({
      "user-agent": UA,
      "accept": "*/*",
      "accept-language": "it-IT,it;q=0.9,en;q=0.8"
    });
    const rule = RULES[up.hostname] || RULES[up.hostname.replace(/^www\./, "")];
    if (rule) for (const [k, v] of Object.entries(rule)) out.set(k, v);
    else out.set("referer", up.origin + "/");

    // range passthrough, needed for segments
    const range = request.headers.get("range");
    if (range) out.set("range", range);

    let res;
    try {
      res = await fetch(up.toString(), { headers: out, redirect: "follow", cf: { cacheTtl: 0 } });
    } catch (e) {
      return bad("Origin unreachable: " + e.message, 502);
    }

    const ct = (res.headers.get("content-type") || "").toLowerCase();
    const isPlaylist =
      ct.includes("mpegurl") ||
      /\.m3u8?(\?|$)/i.test(up.pathname + up.search);

    // Playlists must be rewritten: every segment, every variant and every key
    // must go back through the proxy, otherwise the browser hits the CORS problem again.
    if (isPlaylist) {
      const len = res.headers.get("content-length");
      if (len && Number(len) > MAX_PLAYLIST_BYTES) return bad("Playlist too large", 502);

      const text = await res.text();
      if (text.length > MAX_PLAYLIST_BYTES) return bad("Playlist too large", 502);

      const body = rewrite(text, res.url || up.toString(), here.origin + here.pathname);
      return new Response(body, {
        status: res.status,
        headers: cors({
          "content-type": "application/vnd.apple.mpegurl; charset=utf-8",
          "cache-control": "no-store"
        })
      });
    }

    // Segments and keys: pass through as they are, with CORS added.
    const h = cors({
      "content-type": res.headers.get("content-type") || "application/octet-stream",
      "cache-control": "public, max-age=8"
    });
    const len = res.headers.get("content-length");
    if (len) h.set("content-length", len);
    const cr = res.headers.get("content-range");
    if (cr) h.set("content-range", cr);
    if (res.headers.get("accept-ranges")) h.set("accept-ranges", res.headers.get("accept-ranges"));

    return new Response(res.body, { status: res.status, headers: h });
  }
};

/** Rewrites every URL in an HLS playlist so it goes through the proxy. */
function rewrite(text, baseUrl, proxyPath) {
  const base = new URL(baseUrl);
  const wrap = raw => {
    let abs;
    try { abs = new URL(raw, base).toString(); } catch { return raw; }
    return proxyPath + "?url=" + encodeURIComponent(abs);
  };

  return text.split(/\r?\n/).map(line => {
    const t = line.trim();
    if (!t) return line;

    // URIs inside attributes: AES keys, audio tracks, subtitles, init maps
    if (t.startsWith("#")) {
      return line.replace(/URI="([^"]+)"/g, (_, u) => 'URI="' + wrap(u) + '"');
    }

    // bare line: variant or segment
    return wrap(t);
  }).join("\n");
}

function cors(extra = {}) {
  const h = new Headers(extra);
  h.set("access-control-allow-origin", ALLOW_ORIGIN);
  h.set("access-control-allow-methods", "GET, HEAD, OPTIONS");
  h.set("access-control-allow-headers", "range, content-type");
  h.set("access-control-expose-headers", "content-length, content-range, accept-ranges");
  h.set("timing-allow-origin", "*");
  return h;
}

function preflight() {
  return new Response(null, { status: 204, headers: cors({ "access-control-max-age": "86400" }) });
}

function bad(msg, status = 400) {
  return new Response(msg, { status, headers: cors({ "content-type": "text/plain; charset=utf-8" }) });
}

/**
 * Server side origin check. hls.js sends an Origin header on every XHR
 * (including the OPTIONS preflight), so legitimate traffic always has one:
 * if it is present, it must match ALLOW_ORIGIN. If it is absent (a bare
 * curl request, or a top level browser navigation, which does not send
 * Origin) fall back to the Referer header's origin. If neither header is
 * present, or neither matches, the request is not allowed.
 */
function originAllowed(request) {
  if (ALLOW_ORIGIN === "*") return true;

  const origin = request.headers.get("origin");
  if (origin !== null) return origin === ALLOW_ORIGIN;

  const referer = request.headers.get("referer");
  if (referer) {
    try { return new URL(referer).origin === ALLOW_ORIGIN; }
    catch { return false; }
  }

  return false;
}

function forbidden() {
  return new Response("Forbidden", {
    status: 403, headers: { "content-type": "text/plain; charset=utf-8" }
  });
}
