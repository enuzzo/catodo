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

// Only this domain can use the proxy. Prevents it from becoming a public open proxy.
// Put the real origin of your CATODO here. "*" only for testing.
const ALLOW_ORIGIN = "https://catodo.netmilk.dev";

// Blocks anything that is not a plausible streaming host.
const DENY_HOSTS = [
  /^localhost$/i, /^127\./, /^10\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./, /\.internal$/i, /metadata/i
];

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
      const text = await res.text();
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
