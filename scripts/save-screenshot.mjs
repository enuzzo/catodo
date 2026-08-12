import { writeFile } from "node:fs/promises";

const [target, encoded] = process.argv.slice(2);
if (!target || !encoded) throw new Error("Usage: save-screenshot.mjs <target> <base64>");
await writeFile(target, Buffer.from(encoded, "base64"));
