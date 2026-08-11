/**
 * CATODO PROXY
 * Cloudflare Worker: sistema i tre motivi per cui un flusso IPTV non parte in un browser.
 *
 *   1. CORS       il server dello stream non manda Access-Control-Allow-Origin
 *   2. http       la pagina e in https, il segmento in http, Chromium blocca (mixed content)
 *   3. hotlink    il server pretende un Referer o uno User-Agent preciso
 *
 * Deploy:
 *   dash.cloudflare.com > Workers & Pages > Create > Worker
 *   incolla questo file, Deploy
 *   copia l URL (es. https://catodo-proxy.tuonome.workers.dev) nelle impostazioni di Catodo
 *
 * Uso:
 *   https://tuo-worker.workers.dev/?url=<url-encodato>
 */

// Solo questo dominio puo usare il proxy. Evita che diventi un open proxy pubblico.
// Metti l origine reale del tuo CATODO. "*" solo per i test.
const ALLOW_ORIGIN = "https://catodo.netmilk.dev";

// Blocca tutto cio che non e un host di streaming plausibile.
const DENY_HOSTS = [
  /^localhost$/i, /^127\./, /^10\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./, /\.internal$/i, /metadata/i
];

// Regole per host che pretendono header specifici.
// Aggiungi qui quando un canale da 403 ma funziona nel browser normale.
const RULES = {
  // "esempio.com": { Referer: "https://esempio.com/", Origin: "https://esempio.com" },
};

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
           "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export default {
  async fetch(request) {
    const here = new URL(request.url);

    if (request.method === "OPTIONS") return preflight();

    const target = here.searchParams.get("url");
    if (!target) {
      return new Response("CATODO PROXY. Uso: /?url=<url-encodato>", {
        status: 400, headers: cors({ "content-type": "text/plain; charset=utf-8" })
      });
    }

    let up;
    try { up = new URL(target); } catch { return bad("URL non valido"); }
    if (!/^https?:$/.test(up.protocol)) return bad("Solo http e https");
    if (DENY_HOSTS.some(re => re.test(up.hostname))) return bad("Host non consentito");

    // header di uscita
    const out = new Headers({
      "user-agent": UA,
      "accept": "*/*",
      "accept-language": "it-IT,it;q=0.9,en;q=0.8"
    });
    const rule = RULES[up.hostname] || RULES[up.hostname.replace(/^www\./, "")];
    if (rule) for (const [k, v] of Object.entries(rule)) out.set(k, v);
    else out.set("referer", up.origin + "/");

    // range passthrough, serve ai segmenti
    const range = request.headers.get("range");
    if (range) out.set("range", range);

    let res;
    try {
      res = await fetch(up.toString(), { headers: out, redirect: "follow", cf: { cacheTtl: 0 } });
    } catch (e) {
      return bad("Origine irraggiungibile: " + e.message, 502);
    }

    const ct = (res.headers.get("content-type") || "").toLowerCase();
    const isPlaylist =
      ct.includes("mpegurl") ||
      /\.m3u8?(\?|$)/i.test(up.pathname + up.search);

    // Le playlist vanno riscritte: ogni segmento, ogni variante e ogni chiave
    // deve ripassare dal proxy, altrimenti il browser riparte con il problema CORS.
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

    // Segmenti e chiavi: passano cosi come sono, con i CORS aggiunti.
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

/** Riscrive tutti gli URL di una playlist HLS in modo che passino dal proxy. */
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

    // URI dentro gli attributi: chiavi AES, tracce audio, sottotitoli, mappe init
    if (t.startsWith("#")) {
      return line.replace(/URI="([^"]+)"/g, (_, u) => 'URI="' + wrap(u) + '"');
    }

    // riga nuda: variante o segmento
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
