import { mkdir, rename } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const publicEntry = resolve(root, "dist", "app.html");
const privateDirectory = resolve(root, "dist", ".catodo-private");
const privateEntry = resolve(privateDirectory, "app.html");

await mkdir(privateDirectory, { recursive: true });
await rename(publicEntry, privateEntry);

console.log("Protected app entry: dist/.catodo-private/app.html");
