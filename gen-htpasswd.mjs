/**
 * CATODO: generate .htpasswd
 *
 * Reads HTPASSWD_USER and HTPASSWD_PASSWORD from a .env file (by default
 * the one in the current folder) and writes .htpasswd in the same folder,
 * with a bcrypt hash in the $2y$ format Apache recognizes. The resulting file
 * must never go into git or into any future automated upload: it must be
 * uploaded to the FTP by hand, every time the password changes.
 *
 *   node gen-htpasswd.mjs [env-path]
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcryptjs";

function parseEnv(text){
  const out = {};
  for (const line of text.split(/\r?\n/)){
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (!m) continue;

    let value = m[2];
    const quoted = value.match(/^(["'])([\s\S]*)\1$/);
    if (quoted) {
      // Quoted values are used literally, quotes stripped, no comment parsing:
      // a quoted password can legitimately contain a space or a #.
      value = quoted[2];
    } else {
      // Unquoted: a trailing " #comment" is a comment only when it is
      // preceded by whitespace, so a password containing a bare # is safe.
      value = value.replace(/\s+#.*$/, "");
    }

    out[m[1]] = value;
  }
  return out;
}

const envPath = path.resolve(process.argv[2] || ".env");
let raw;
try { raw = await readFile(envPath, "utf8"); }
catch { console.error("cannot find " + envPath); process.exit(1); }

const env = parseEnv(raw);
const missing = ["HTPASSWD_USER", "HTPASSWD_PASSWORD"].filter(k => !env[k]);
if (missing.length){
  console.error("missing variables in " + envPath + ": " + missing.join(", "));
  process.exit(1);
}

const hash = bcrypt.hashSync(env.HTPASSWD_PASSWORD, 10).replace(/^\$2[aby]\$/, "$2y$");
const outPath = path.join(path.dirname(envPath), ".htpasswd");
await writeFile(outPath, env.HTPASSWD_USER + ":" + hash + "\n", "utf8");
console.log("written " + outPath + " for user " + env.HTPASSWD_USER);
