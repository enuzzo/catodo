import test from "node:test";
import assert from "node:assert/strict";

import { I18n } from "../../src/i18n/index.js";

test("i18n invokes browser fetch with the global receiver", async () => {
  const fetchImpl = async function () {
    assert.equal(this, globalThis);
    return new Response(JSON.stringify({ greeting: "Hello" }));
  };
  const i18n = new I18n({ baseUrl: new URL("https://example.test/locales/"), fetchImpl });
  await i18n.load("en");
  assert.equal(i18n.t("greeting"), "Hello");
});

test("a new release bypasses a stale unversioned translation response", async () => {
  const requested = [];
  const i18n = new I18n({
    baseUrl: new URL("https://example.test/locales/"),
    version: "2.10.1",
    fetchImpl: async (url) => {
      requested.push(url.href);
      return new Response(JSON.stringify(url.searchParams.get("v") === "2.10.1"
        ? { theatre: { languages: { zxx: "No dialogue" } } } : {}));
    },
  });
  await i18n.load("en");
  await i18n.load("en");
  assert.equal(i18n.t("theatre.languages.zxx", "zxx"), "No dialogue");
  assert.deepEqual(requested, ["https://example.test/locales/en.json?v=2.10.1"]);
});
