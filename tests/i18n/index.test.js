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
