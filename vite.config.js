import { defineConfig } from "vite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const packageJson = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
const appVersion = packageJson.version;

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
      const target = requestUrl.searchParams.get("url") || "";
      let parsed;
      try { parsed = new URL(target); } catch { parsed = null; }
      if (!parsed || parsed.protocol !== "https:" || parsed.hostname !== "www.open-epg.com" || !/^\/files\/italy[1-8]\.xml$/.test(parsed.pathname)) {
        response.statusCode = 400;
        response.end();
        return;
      }
      try {
        const upstream = await fetch(parsed, { headers: { "User-Agent": "CATODO/2 vite-epg-proxy" } });
        const length = Number(upstream.headers.get("content-length") || 0);
        if (!upstream.ok || length > 20 * 1024 * 1024) throw new Error(`Guide request failed (${upstream.status})`);
        const body = Buffer.from(await upstream.arrayBuffer());
        if (!body.length || body.length > 20 * 1024 * 1024) throw new Error("Guide response has an invalid size");
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
