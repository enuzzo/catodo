import test from "node:test";
import assert from "node:assert/strict";
import { channelLocalTime, formatGuideDateTime, formatGuideTime } from "../../src/ui/time-format.js";

test("formats guide times in 24-hour notation even with a 12-hour locale", () => {
  const value = Date.UTC(2026, 7, 13, 17, 5);
  assert.equal(formatGuideTime(value, { locale: "en-US", timeZone: "UTC" }), "17:05");
  const formatted = formatGuideDateTime(value, { locale: "en-US", timeZone: "UTC" });
  assert.match(formatted, /17:05/);
  assert.doesNotMatch(formatted, /AM|PM/);
});

test("formats the streaming location clock from channel and endpoint timezones", () => {
  const value = Date.UTC(2026, 7, 13, 19, 5);
  assert.deepEqual(channelLocalTime({ timezones: ["Europe/Rome"] }, value, { locale: "en-US" }), {
    timeZone: "Europe/Rome",
    place: "Rome",
    time: "21:05",
  });
  assert.deepEqual(channelLocalTime({ endpoints: [{ timezones: ["America/New_York"] }] }, value, { locale: "en-US" }), {
    timeZone: "America/New_York",
    place: "New York",
    time: "15:05",
  });
});

test("hides the streaming location clock when timezone metadata is absent or invalid", () => {
  assert.equal(channelLocalTime({}, Date.now()), null);
  assert.equal(channelLocalTime({ timezones: ["Mars/Olympus_Mons"] }, Date.now()), null);
});
