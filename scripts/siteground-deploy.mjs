import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Client } from "basic-ftp";

const root = resolve(import.meta.dirname, "..");
const raw = await readFile(resolve(root, ".env"), "utf8");
const env = {};
for (const line of raw.split(/\r?\n/)) {
  const match = line.match(/^([A-Z_]+)=(.*)$/);
  if (match) env[match[1]] = match[2].trim();
}
for (const key of ["FTP_HOST", "FTP_USER", "FTP_PASSWORD"]) {
  if (!env[key]) throw new Error(`Missing ${key}`);
}

const client = new Client(30_000);
client.ftp.verbose = false;
try {
  await client.access({
    host: env.FTP_HOST,
    port: Number(env.FTP_PORT) || 21,
    user: env.FTP_USER,
    password: env.FTP_PASSWORD,
    secure: env.FTP_SECURE !== "false",
  });
  await client.ensureDir(env.FTP_REMOTE_DIR || "/");
  await client.uploadFromDir(resolve(root, "dist"));
  console.log("SiteGround upload complete: dist bundle only; existing access gate preserved");
} finally {
  client.close();
}
