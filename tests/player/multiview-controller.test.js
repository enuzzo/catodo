import test from "node:test";
import assert from "node:assert/strict";
import { MultiviewController } from "../../src/player/multiview-controller.js";
import { FakeSlot } from "./fakes.js";
test("Multiview keeps audio muted until a gesture and switches audio without retuning", () => {
  const controller = new MultiviewController({
    createSlot: (options) => new FakeSlot(options),
    staggerMs: 0
  });
  controller.setLayout(3);
  controller.slots.forEach((slot) => slot.tuneCalls.push("already-tuned"));

  assert.equal(controller.activateAudio("slot-2"), false);
  assert.ok(controller.slots.every((slot) => slot.video.muted));

  assert.equal(controller.registerUserGesture("slot-2"), true);
  assert.equal(controller.slots[0].video.muted, true);
  assert.equal(controller.slots[1].video.muted, false);
  assert.equal(controller.slots[2].video.muted, true);

  assert.equal(controller.activateAudio("slot-3"), true);
  assert.equal(controller.slots[0].video.muted, true);
  assert.equal(controller.slots[1].video.muted, true);
  assert.equal(controller.slots[2].video.muted, false);
  assert.deepEqual(controller.slots.map((slot) => slot.tuneCalls.length), [1, 1, 1]);
  controller.destroy();
});

test("Multiview starts slots sequentially and isolates a rejected slot", async () => {
  const order = [];
  const degraded = [];
  class OrderedSlot extends FakeSlot {
    tune(source) {
      order.push(this.id);
      this.tuneCalls.push(source);
      if (this.id === "slot-2") return Promise.reject(new Error("offline"));
      return Promise.resolve(source);
    }
  }
  const controller = new MultiviewController({
    createSlot: (options) => new OrderedSlot(options),
    staggerMs: 0,
    onDegrade: (detail) => degraded.push(detail)
  });
  controller.setLayout(3);
  const result = await controller.start(["one", "two", "three"], { count: 3 });

  assert.deepEqual(order, ["slot-1", "slot-2", "slot-3"]);
  assert.equal(result[0].status, "fulfilled");
  assert.equal(result[1].status, "rejected");
  assert.equal(result[2].status, "fulfilled");
  assert.equal(degraded.length, 1);
  assert.equal(degraded[0].slotId, "slot-2");
  controller.destroy();
});

test("Multiview aggregates measured metrics from all slots", () => {
  const values = [
    { loadedBytes: 100, downloadThroughput: 1000, bandwidthEstimate: 2000, rebuffers: 1, frames: { dropped: 2 } },
    { loadedBytes: 200, downloadThroughput: 3000, bandwidthEstimate: 4000, rebuffers: 2, frames: { dropped: 3 } }
  ];
  let index = 0;
  const controller = new MultiviewController({
    createSlot: (options) => new FakeSlot(Object.assign({}, options, { metrics: values[index++] })),
    staggerMs: 0
  });
  controller.setLayout(2);
  controller.registerUserGesture("slot-1");
  const aggregate = controller.getAggregateMetrics();

  assert.equal(aggregate.loadedBytes, 300);
  assert.equal(aggregate.downloadThroughput, 4000);
  assert.equal(aggregate.bandwidthEstimate, 6000);
  assert.equal(aggregate.rebuffers, 3);
  assert.equal(aggregate.droppedFrames, 5);
  assert.equal(aggregate.audioSlotId, "slot-1");
  assert.equal(aggregate.uploadDisplay, "N/A");
  controller.destroy();
});
