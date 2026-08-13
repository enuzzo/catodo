import test from "node:test";
import assert from "node:assert/strict";

import { advanceConnection, connectionView, startConnection } from "../../src/ui/connection-model.js";

test("connection model exposes honest phases, route and elapsed guidance", () => {
  const started = startConnection({ now: 1_000, route: "proxy", endpointCount: 2 });
  const manifest = advanceConnection(started, "manifest-loading", { endpointIndex: 1 }, { now: 2_000 });
  const view = connectionView(manifest, { now: 8_500 });
  assert.equal(view.title, "Requesting live playlist");
  assert.equal(view.step, 2);
  assert.equal(view.elapsedMs, 7_500);
  assert.equal(view.meta, "PROXY · ENDPOINT 2/2");
  assert.match(view.advice, /responding slowly/i);
  assert.equal(view.canTryAnother, false);
});

test("connection model marks long waits and terminal failures as actionable", () => {
  const started = startConnection({ now: 0, endpointCount: 1 });
  const slow = connectionView(advanceConnection(started, "fragment-loading", {}, { now: 5_000 }), { now: 13_000 });
  assert.equal(slow.tone, "slow");
  assert.equal(slow.canTryAnother, true);
  const failed = connectionView(advanceConnection(started, "error", { error: new Error("offline") }, { now: 3_000 }), { now: 3_000 });
  assert.equal(failed.tone, "error");
  assert.equal(failed.error, "offline");
  assert.match(failed.advice, /try another channel/i);
});
