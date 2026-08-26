import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const text = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("the production player entry is never left in the public static root", () => {
  const packageJson = JSON.parse(text("package.json"));
  const loginGate = text("index.php");
  const accessRules = text(".htaccess");
  const deploy = text("scripts/siteground-deploy.mjs");

  assert.match(packageJson.scripts.build, /scripts\/protect-app-entry\.mjs/);
  assert.match(loginGate, /\.catodo-private\/app\.html/);
  assert.match(accessRules, /app\\\.html/);
  assert.match(accessRules, /\.catodo-private/);
  assert.match(deploy, /remove\("app\.html", true\)/);
});
