/**
 * CATODO: playlist diagnosis
 *
 * Takes an M3U list and tells you which channels will actually work inside a browser.
 * It is the question no other tool answers: VLC opens everything, the browser does not.
 *
 *   node check-playlist.mjs <url-or-path>
 *   node check-playlist.mjs <url> --deep      also tries to download the manifests
 *   node check-playlist.mjs <url> --csv       table to open in a spreadsheet
 *
 * Does NOT write any channel file and must not be used to generate lists for publishing.
 * CATODO does not distribute playlists: this only helps you understand, for your own list,
 * what is worth keeping.
 */

import { readFile } from "node:fs/promises";

const arg = process.argv[2];
const DEEP = process.argv.includes("--deep");
const CSV = process.argv.includes("--csv");

if (!arg) {
  console.error("usage: node check-playlist.mjs <url-or-path> [--deep] [--csv]");
  process.exit(1);
}

const kind = u => {
  if (!u) return "empty";
  if (/youtube\.com|youtu\.be/i.test(u)) return "youtube";
  if (/twitch\.tv/i.test(u)) return "twitch";
  if (/dailymotion/i.test(u)) return "dailymotion";
  if (/^rtmps?:|^rtsp:/i.test(u)) return "rtmp";
  if (/^http:\/\//i.test(u)) return "http";
  return "hls";
};

function parse(text) {
  const lines = text.split(/\r?\n/);
  const at = (l, k) => (l.match(new RegExp(k + '="([^"]*)"')) || [, ""])[1];
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith("#EXTINF")) continue;
    let url = "";
    for (let j = i + 1; j < lines.length; j++) {
      const t = lines[j].trim();
      if (t.startsWith("#EXTINF")) break;
      if (!t || t.startsWith("#")) continue;
      url = t; break;
    }
    if (!url) continue;
    const lastQuote = lines[i].lastIndexOf('"');
    const commaIdx = lines[i].indexOf(",", lastQuote + 1);
    const raw = (commaIdx === -1 ? "" : lines[i].slice(commaIdx + 1)).trim();
    out.push({
      name: raw.replace(/[\u24C8\u24BC\u24CE\u24C9]/g, "").trim(),
      group: at(lines[i], "group-title") || "Undefined",
      url, kind: kind(url)
    });
  }
  return out;
}

/** The browser needs two things VLC does not even look at: CORS and https. */
async function probe(c) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 8000);
  try {
    const r = await fetch(c.url, {
      signal: ac.signal,
      redirect: "follow",
      headers: { origin: "https://catodo.example", referer: "https://catodo.example/" }
    });
    clearTimeout(t);
    const acao = r.headers.get("access-control-allow-origin");
    const body = await r.text();
    return {
      status: r.status,
      cors: acao ? (acao === "*" ? "open" : acao) : "missing",
      m3u: body.includes("#EXTM3U") || body.includes("#EXTINF"),
      verdict: !r.ok ? "dead" : !acao ? "CORS missing, needs the proxy" : "ok"
    };
  } catch (e) {
    clearTimeout(t);
    return { status: 0, cors: "-", m3u: false, verdict: e.name === "AbortError" ? "timed out" : "unreachable" };
  }
}

let text;
if (/^https?:\/\//i.test(arg)) {
  const r = await fetch(arg);
  if (!r.ok) { console.error("HTTP " + r.status); process.exit(1); }
  text = await r.text();
} else {
  text = await readFile(arg, "utf8");
}

const all = parse(text);
const seen = new Set();
const list = all.filter(c => !seen.has(c.url) && seen.add(c.url));

const byKind = {};
list.forEach(c => byKind[c.kind] = (byKind[c.kind] || 0) + 1);

console.log("\nlist:       " + arg);
console.log("entries:    " + all.length + "  (unique: " + list.length + ")");
console.log("");
console.log("openable directly by the browser:      " + (byKind.hls || 0));
console.log("recoverable only with the proxy (http): " + (byKind.http || 0));
const lost = list.length - (byKind.hls || 0) - (byKind.http || 0);
console.log("not openable under any circumstances:   " + lost +
  "   " + Object.entries(byKind).filter(([k]) => k !== "hls" && k !== "http")
    .map(([k, n]) => k + " " + n).join(", "));

const groups = {};
list.forEach(c => {
  groups[c.group] = groups[c.group] || { tot: 0, ok: 0, http: 0 };
  groups[c.group].tot++;
  if (c.kind === "hls") groups[c.group].ok++;
  if (c.kind === "http") groups[c.group].http++;
});
console.log("\ngroup                                total    browser   proxy-only");
console.log("-".repeat(68));
Object.entries(groups).sort((a, b) => b[1].tot - a[1].tot).slice(0, 25)
  .forEach(([g, v]) => console.log(
    g.slice(0, 34).padEnd(36) + String(v.tot).padStart(5) + String(v.ok).padStart(9) + String(v.http).padStart(12)
  ));

if (!DEEP) {
  console.log("\nThis is only the address analysis. With --deep I also try to download");
  console.log("the manifests and tell you which ones respond and which send CORS headers.");
  process.exit(0);
}

const targets = list.filter(c => c.kind === "hls");
console.log("\nchecking " + targets.length + " manifests, this will take a few minutes...\n");
const rows = [];
const BATCH = 10;
for (let i = 0; i < targets.length; i += BATCH) {
  const slice = targets.slice(i, i + BATCH);
  const res = await Promise.all(slice.map(probe));
  slice.forEach((c, k) => rows.push({ ...c, ...res[k] }));
  process.stdout.write("\r  " + Math.min(i + BATCH, targets.length) + "/" + targets.length);
}

const ok = rows.filter(r => r.verdict === "ok");
const needProxy = rows.filter(r => /CORS/.test(r.verdict));
const dead = rows.filter(r => r.verdict === "dead" || r.verdict === "unreachable" || r.verdict === "timed out");

console.log("\n\nreal result");
console.log("-".repeat(68));
console.log("start in the browser without a proxy: " + ok.length);
console.log("need the proxy because of CORS:        " + needProxy.length);
console.log("do not respond:                        " + dead.length);

if (CSV) {
  console.log("\nname,group,result,status,cors,url");
  rows.forEach(r => console.log(
    [r.name, r.group, r.verdict, r.status, r.cors, r.url].map(x => '"' + String(x).replace(/"/g, '""') + '"').join(",")
  ));
} else if (dead.length) {
  console.log("\nfirst dead channels:");
  dead.slice(0, 15).forEach(r => console.log("  " + r.name.slice(0, 40).padEnd(42) + r.verdict));
  console.log("\nAdd --csv for the full table.");
}
