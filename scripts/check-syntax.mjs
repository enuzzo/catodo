import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { extname, join } from "node:path";

const roots = ["src", "tests", "scripts"];
const files = [];

async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await walk(path);
    else if ([".js", ".mjs"].includes(extname(path))) files.push(path);
  }
}

for (const root of roots) {
  try { await walk(root); } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout);
    process.exit(result.status || 1);
  }
}

console.log(`Syntax OK: ${files.length} JavaScript files`);
