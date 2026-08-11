/**
 * CATODO: diagnosi lista
 *
 * Prende una lista M3U e dice quali canali funzioneranno davvero dentro un browser.
 * E la domanda a cui nessun altro strumento risponde: VLC apre tutto, il browser no.
 *
 *   node check-playlist.mjs <url-o-percorso>
 *   node check-playlist.mjs <url> --deep      prova anche a scaricare i manifest
 *   node check-playlist.mjs <url> --csv       tabella da aprire in un foglio
 *
 * NON scrive nessun file di canali e non va usato per generare liste da pubblicare.
 * CATODO non distribuisce playlist: questo serve solo a capire, sulla tua lista,
 * cosa vale la pena tenere.
 */

import { readFile } from "node:fs/promises";

const arg = process.argv[2];
const DEEP = process.argv.includes("--deep");
const CSV = process.argv.includes("--csv");

if (!arg) {
  console.error("uso: node check-playlist.mjs <url-o-percorso> [--deep] [--csv]");
  process.exit(1);
}

const kind = u => {
  if (!u) return "vuoto";
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
      if (!t || t.startsWith("#")) continue;
      url = t; break;
    }
    if (!url) continue;
    const raw = (lines[i].split(",").slice(1).join(",") || "").trim();
    out.push({
      name: raw.replace(/[\u24C8\u24BC\u24CE\u24C9]/g, "").trim(),
      group: at(lines[i], "group-title") || "Undefined",
      url, kind: kind(url)
    });
  }
  return out;
}

/** Il browser ha bisogno di due cose che VLC non guarda nemmeno: CORS e https. */
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
      cors: acao ? (acao === "*" ? "aperto" : acao) : "assente",
      m3u: body.includes("#EXTM3U") || body.includes("#EXTINF"),
      verdict: !r.ok ? "morto" : !acao ? "CORS assente, serve il proxy" : "ok"
    };
  } catch (e) {
    clearTimeout(t);
    return { status: 0, cors: "-", m3u: false, verdict: e.name === "AbortError" ? "scaduto" : "irraggiungibile" };
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

console.log("\nlista:      " + arg);
console.log("voci:       " + all.length + "  (uniche: " + list.length + ")");
console.log("");
console.log("apribili dal browser cosi come sono:  " + (byKind.hls || 0));
console.log("recuperabili solo con il proxy (http): " + (byKind.http || 0));
const lost = list.length - (byKind.hls || 0) - (byKind.http || 0);
console.log("non apribili in nessun caso:           " + lost +
  "   " + Object.entries(byKind).filter(([k]) => k !== "hls" && k !== "http")
    .map(([k, n]) => k + " " + n).join(", "));

const groups = {};
list.forEach(c => {
  groups[c.group] = groups[c.group] || { tot: 0, ok: 0, http: 0 };
  groups[c.group].tot++;
  if (c.kind === "hls") groups[c.group].ok++;
  if (c.kind === "http") groups[c.group].http++;
});
console.log("\ngruppo                              totali   browser   solo-proxy");
console.log("-".repeat(68));
Object.entries(groups).sort((a, b) => b[1].tot - a[1].tot).slice(0, 25)
  .forEach(([g, v]) => console.log(
    g.slice(0, 34).padEnd(36) + String(v.tot).padStart(5) + String(v.ok).padStart(9) + String(v.http).padStart(12)
  ));

if (!DEEP) {
  console.log("\nQuesta e solo l analisi degli indirizzi. Con --deep provo anche a scaricare");
  console.log("i manifest e ti dico quali rispondono e quali mandano gli header CORS.");
  process.exit(0);
}

const targets = list.filter(c => c.kind === "hls");
console.log("\nverifico " + targets.length + " manifest, ci vuole qualche minuto...\n");
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
const dead = rows.filter(r => r.verdict === "morto" || r.verdict === "irraggiungibile" || r.verdict === "scaduto");

console.log("\n\nrisultato reale");
console.log("-".repeat(68));
console.log("partono nel browser senza proxy:  " + ok.length);
console.log("servono il proxy per via dei CORS: " + needProxy.length);
console.log("non rispondono:                    " + dead.length);

if (CSV) {
  console.log("\nnome,gruppo,esito,stato,cors,url");
  rows.forEach(r => console.log(
    [r.name, r.group, r.verdict, r.status, r.cors, r.url].map(x => '"' + String(x).replace(/"/g, '""') + '"').join(",")
  ));
} else if (dead.length) {
  console.log("\nprimi canali morti:");
  dead.slice(0, 15).forEach(r => console.log("  " + r.name.slice(0, 40).padEnd(42) + r.verdict));
  console.log("\nAggiungi --csv per la tabella completa.");
}
