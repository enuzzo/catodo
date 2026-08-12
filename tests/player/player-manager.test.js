import test from "node:test";
import assert from "node:assert/strict";
import { PlayerManager } from "../../src/player/player-manager.js";
import { FakeSlot } from "./fakes.js";

test("PlayerManager exposes one slot and forwards its browser events", async () => {
  const slot = new FakeSlot({ id: "main" });
  const manager = new PlayerManager({ slot: slot });
  let forwarded = null;
  manager.addEventListener("tuned", (event) => {
    forwarded = event.detail;
  });

  await manager.tune("news");
  const tuned = new Event("tuned");
  Object.defineProperty(tuned, "detail", { value: { slotId: "main" } });
  slot.dispatchEvent(tuned);

  assert.deepEqual(slot.tuneCalls, ["news"]);
  assert.deepEqual(forwarded, { slotId: "main" });
  manager.destroy();
  assert.equal(slot.destroyed, true);
});
