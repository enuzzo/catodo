import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  base: "./",
  build: {
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, "index.html"),
        app: resolve(import.meta.dirname, "app.html"),
      },
      output: {
        manualChunks: {
          hls: ["hls.js"],
          three: [resolve(import.meta.dirname, "assets/vendor/three/three.module.min.js")],
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
