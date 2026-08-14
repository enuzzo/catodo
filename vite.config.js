import { defineConfig } from "vite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { gunzipSync } from "node:zlib";

const packageJson = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
const appVersion = packageJson.version;
const epgShareCountryTags = new Set([
  "AE1", "AL1", "AR1", "AT1", "AU1", "BA1", "BE1", "BG1", "BR1", "CA1", "CH1", "CL1", "CO1", "CR1", "CY1", "CZ1",
  "DE1", "DK1", "DO1", "EC1", "ES1", "FI1", "FR1", "GR1", "HK1", "HR1", "HU1", "ID1", "IE1", "IL1", "IN1", "IT1",
  "JM1", "JP1", "KE1", "KR1", "LT1", "LV1", "MT1", "MX1", "MY1", "NG1", "NL1", "NO1", "NZ1", "PA1", "PE1", "PH1",
  "PK1", "PL1", "PT1", "RO1", "RS1", "SA1", "SE1", "SG1", "SK1", "SV1", "TR1", "UK1", "US1", "UY1", "VN1", "ZA1",
]);

const versionPlugin = {
  name: "catodo-version",
  transformIndexHtml(html) {
    return html.replaceAll("__CATODO_VERSION__", appVersion);
  },
  generateBundle() {
    this.emitFile({
      type: "asset",
      fileName: "version.json",
      source: `${JSON.stringify({ name: packageJson.name, version: appVersion }, null, 2)}\n`,
    });
  },
};

const epgDevProxyPlugin = {
  name: "catodo-epg-dev-proxy",
  configureServer(server) {
    server.middlewares.use(async (request, response, next) => {
      const requestUrl = new URL(request.url || "/", "http://127.0.0.1");
      if (requestUrl.pathname !== "/epg-cache.php") return next();
      if (requestUrl.searchParams.get("catalog") === "open-epg") {
        try {
          const upstream = await fetch("https://www.open-epg.com/app/epgfetch.php", { headers: { "User-Agent": "CATODO/2 vite-epg-catalog" } });
          const rows = await upstream.json();
          if (!upstream.ok || !Array.isArray(rows)) throw new Error(`Guide catalog request failed (${upstream.status})`);
          const safe = rows.flatMap((row) => {
            let parsed;
            try { parsed = new URL(row?.url); } catch { parsed = null; }
            if (!parsed || parsed.protocol !== "https:" || parsed.hostname !== "www.open-epg.com" || !/^\/files\/[a-z0-9_-]{2,64}\.xml$/i.test(parsed.pathname)) return [];
            return [{ cou: String(row?.cou || "").slice(0, 80), url: parsed.href, age: String(row?.age || "").slice(0, 16), cnt: Number(row?.cnt) || 0 }];
          });
          response.statusCode = 200;
          response.setHeader("Content-Type", "application/json; charset=utf-8");
          response.setHeader("Cache-Control", "private, max-age=900");
          response.setHeader("X-Content-Type-Options", "nosniff");
          response.end(JSON.stringify(safe));
        } catch {
          response.statusCode = 502;
          response.end();
        }
        return;
      }
      const target = requestUrl.searchParams.get("url") || "";
      let parsed;
      try { parsed = new URL(target); } catch { parsed = null; }
      const openEpg = parsed?.protocol === "https:" && parsed.hostname === "www.open-epg.com" && /^\/files\/[a-z0-9_-]{2,64}\.xml$/i.test(parsed.pathname);
      const epgShareMatch = parsed?.pathname.match(/^\/epgshare01\/epg_ripper_([A-Z]{2}1)\.xml\.gz$/);
      const epgShare = parsed?.protocol === "https:" && parsed.hostname === "epgshare01.online" && epgShareCountryTags.has(epgShareMatch?.[1]);
      if (!openEpg && !epgShare) {
        response.statusCode = 400;
        response.end();
        return;
      }
      try {
        const upstream = await fetch(parsed, { headers: { "User-Agent": "CATODO/2 vite-epg-proxy" } });
        const length = Number(upstream.headers.get("content-length") || 0);
        if (!upstream.ok || length > 12 * 1024 * 1024) throw new Error(`Guide request failed (${upstream.status})`);
        const downloaded = Buffer.from(await upstream.arrayBuffer());
        if (!downloaded.length || downloaded.length > 12 * 1024 * 1024) throw new Error("Guide response has an invalid size");
        const body = downloaded[0] === 0x1f && downloaded[1] === 0x8b ? gunzipSync(downloaded) : downloaded;
        if (!body.length || body.length > 32 * 1024 * 1024) throw new Error("Guide response has an invalid expanded size");
        const prefix = body.subarray(0, 256).toString("utf8").trimStart();
        if (!prefix.startsWith("<?xml") && !prefix.startsWith("<tv")) throw new Error("Guide response is not XMLTV");
        response.statusCode = 200;
        response.setHeader("Content-Type", "application/xml; charset=utf-8");
        response.setHeader("Cache-Control", "private, max-age=900");
        response.setHeader("X-Content-Type-Options", "nosniff");
        response.end(body);
      } catch {
        response.statusCode = 502;
        response.end();
      }
    });
  },
};

export default defineConfig({
  base: "./",
  define: {
    __CATODO_VERSION__: JSON.stringify(appVersion),
  },
  plugins: [versionPlugin, epgDevProxyPlugin],
  build: {
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, "index.html"),
        app: resolve(import.meta.dirname, "app.html"),
      },
      output: {
        manualChunks: {
          hls: ["hls.js"],
        },
      },
    },
  },
  publicDir: "public",
  server: {
    host: "0.0.0.0",
    allowedHosts: ["terminal.local", "localhost", "127.0.0.1"],
  },
});
