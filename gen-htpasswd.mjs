/**
 * CATODO: genera .htpasswd
 *
 * Legge HTPASSWD_USER e HTPASSWD_PASSWORD da un file .env (di default
 * quello nella cartella corrente) e scrive .htpasswd nella stessa cartella,
 * con hash bcrypt nel formato $2y$ che Apache riconosce. Il file risultante
 * non va mai in git ne in un futuro caricamento automatico: va portato
 * sull FTP a mano, ogni volta che la password cambia.
 *
 *   node gen-htpasswd.mjs [percorso-env]
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcryptjs";

function parseEnv(text){
  const out = {};
  for (const line of text.split(/\r?\n/)){
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

const envPath = path.resolve(process.argv[2] || ".env");
let raw;
try { raw = await readFile(envPath, "utf8"); }
catch { console.error("non trovo " + envPath); process.exit(1); }

const env = parseEnv(raw);
const missing = ["HTPASSWD_USER", "HTPASSWD_PASSWORD"].filter(k => !env[k]);
if (missing.length){
  console.error("mancano variabili in " + envPath + ": " + missing.join(", "));
  process.exit(1);
}

const hash = bcrypt.hashSync(env.HTPASSWD_PASSWORD, 10).replace(/^\$2[aby]\$/, "$2y$");
const outPath = path.join(path.dirname(envPath), ".htpasswd");
await writeFile(outPath, env.HTPASSWD_USER + ":" + hash + "\n", "utf8");
console.log("scritto " + outPath + " per l utente " + env.HTPASSWD_USER);
