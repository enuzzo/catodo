import test from "node:test";
import assert from "node:assert/strict";
import { formatGuideDateTime, formatGuideTime } from "../../src/ui/time-format.js";

test("formats guide times in 24-hour notation even with a 12-hour locale", () => {
  const value = Date.UTC(2026, 7, 13, 17, 5);
  assert.equal(formatGuideTime(value, { locale: "en-US", timeZone: "UTC" }), "17:05");
  const formatted = formatGuideDateTime(value, { locale: "en-US", timeZone: "UTC" });
  assert.match(formatted, /17:05/);
  assert.doesNotMatch(formatted, /AM|PM/);
});
