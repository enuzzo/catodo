import { emit } from "./player-events.js";
import { PlayerSlot } from "./player-slot.js";

const SUPPORTED_LAYOUTS = [2, 3, 4];

function delay(milliseconds) {
  if (!milliseconds) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export class MultiviewController extends EventTarget {
  constructor(options) {
    super();
    const settings = options || {};
    this.onEvent = settings.onEvent || null;
    this.onDegrade = settings.onDegrade || null;
    this.staggerMs = settings.staggerMs === undefined ? 150 : settings.staggerMs;
    this.createSlot = settings.createSlot || ((slotOptions) => new PlayerSlot(slotOptions));
    this.slotOptions = settings.slotOptions || {};
    this.slots = [];
    this.slotRemovers = [];
    this.layout = 2;
    this.focusedSlotId = null;
    this.audioSlotId = null;
    this.userGestureReceived = false;
    this.startToken = 0;
    this.handledErrors = new WeakSet();
  }

  setLayout(count, videos) {
    if (SUPPORTED_LAYOUTS.indexOf(count) === -1) {
      throw new RangeError("Multiview layout must contain 2, 3, or 4 slots");
    }
    this.layout = count;
    const elements = videos || [];
    while (this.slots.length > count) this.removeLastSlot();
    while (this.slots.length < count) {
      const index = this.slots.length;
      const id = "slot-" + (index + 1);
      const slot = this.createSlot(Object.assign({}, this.slotOptions, {
        id: id,
        secondary: index > 0
      }));
      if (elements[index] && !slot.video) slot.attach(elements[index]);
      this.addSlot(slot);
    }
    this.slots.forEach((slot, index) => {
      if (elements[index] && slot.video !== elements[index]) slot.attach(elements[index]);
      slot.setSecondary(index > 0);
      slot.setMuted(true);
    });
    this.focusedSlotId = this.slots[0] ? this.slots[0].id : null;
    this.audioSlotId = null;
    this.userGestureReceived = false;
    emit(this, "layout", { count: count, focusedSlotId: this.focusedSlotId }, this.onEvent);
    return this.slots.slice();
  }

  addSlot(slot) {
    const onFatal = (event) => this.handleSlotFailure(slot, event.detail);
    const onMetrics = () => emit(this, "metrics", this.getAggregateMetrics(), this.onEvent);
    slot.addEventListener("fatal", onFatal);
    slot.addEventListener("metrics", onMetrics);
    this.slotRemovers.push(() => {
      slot.removeEventListener("fatal", onFatal);
      slot.removeEventListener("metrics", onMetrics);
    });
    this.slots.push(slot);
  }

  removeLastSlot() {
    const slot = this.slots.pop();
    const remove = this.slotRemovers.pop();
    if (remove) remove();
    if (slot) slot.destroy();
  }

  start(sources, options) {
    const settings = options || {};
    const list = sources || [];
    const count = settings.count || Math.min(4, Math.max(2, list.length));
    if (settings.videos || this.slots.length !== count) this.setLayout(count, settings.videos);
    const token = this.startToken + 1;
    this.startToken = token;
    const results = [];
    let chain = Promise.resolve();
    this.slots.forEach((slot, index) => {
      chain = chain.then(() => {
        if (token !== this.startToken || !list[index]) return null;
        slot.setMuted(true);
        return slot.tune(list[index], { muted: true }).then((value) => {
          results[index] = { status: "fulfilled", value: value };
        }).catch((error) => {
          results[index] = { status: "rejected", reason: error };
          this.handleSlotFailure(slot, { error: error });
        });
      }).then(() => delay(this.staggerMs));
    });
    return chain.then(() => {
      emit(this, "started", { results: results, layout: this.layout }, this.onEvent);
      return results;
    });
  }

  focus(slotId) {
    const selected = this.findSlot(slotId);
    if (!selected) return false;
    this.focusedSlotId = selected.id;
    this.slots.forEach((slot) => slot.setSecondary(slot.id !== selected.id));
    emit(this, "focus", { slotId: selected.id }, this.onEvent);
    return true;
  }

  registerUserGesture(slotId) {
    this.userGestureReceived = true;
    return this.activateAudio(slotId || this.focusedSlotId);
  }

  activateAudio(slotId) {
    if (!this.userGestureReceived) {
      this.slots.forEach((slot) => slot.setMuted(true));
      emit(this, "audio-blocked", { slotId: slotId, reason: "user-gesture-required" }, this.onEvent);
      return false;
    }
    const selected = this.findSlot(slotId);
    if (!selected) return false;
    this.slots.forEach((slot) => slot.setMuted(slot !== selected));
    this.audioSlotId = selected.id;
    emit(this, "audio-focus", { slotId: selected.id }, this.onEvent);
    return true;
  }

  muteAll() {
    this.slots.forEach((slot) => slot.setMuted(true));
    this.audioSlotId = null;
    emit(this, "audio-focus", { slotId: null }, this.onEvent);
  }

  findSlot(slotId) {
    return this.slots.find((slot) => slot.id === slotId) || null;
  }

  handleSlotFailure(slot, detail) {
    const error = detail && detail.error && typeof detail.error === "object" ? detail.error : null;
    if (error && this.handledErrors.has(error)) return;
    if (error) this.handledErrors.add(error);
    if (this.audioSlotId === slot.id) this.muteAll();
    const degradation = {
      reason: "slot-failed",
      slotId: slot.id,
      error: error,
      suggestedLayout: Math.max(2, this.layout - 1),
      remainingSlots: this.slots.filter((item) => item !== slot && !item.destroyed).map((item) => item.id)
    };
    emit(this, "degraded", degradation, this.onEvent);
    if (typeof this.onDegrade === "function") this.onDegrade(degradation);
  }

  requestGracefulDegradation(reason, detail) {
    const degradation = Object.assign({ reason: reason || "resource-pressure" }, detail || {});
    emit(this, "degraded", degradation, this.onEvent);
    if (typeof this.onDegrade === "function") this.onDegrade(degradation);
    return degradation;
  }

  getAggregateMetrics() {
    const metrics = this.slots.map((slot) => ({ slotId: slot.id, metrics: slot.getMetrics() }));
    return {
      slotCount: metrics.length,
      focusedSlotId: this.focusedSlotId,
      audioSlotId: this.audioSlotId,
      loadedBytes: metrics.reduce((sum, entry) => sum + (entry.metrics.loadedBytes || 0), 0),
      downloadThroughput: metrics.reduce((sum, entry) => sum + (entry.metrics.downloadThroughput || 0), 0),
      bandwidthEstimate: metrics.reduce((sum, entry) => sum + (entry.metrics.bandwidthEstimate || 0), 0),
      rebuffers: metrics.reduce((sum, entry) => sum + (entry.metrics.rebuffers || 0), 0),
      droppedFrames: metrics.reduce((sum, entry) => sum + ((entry.metrics.frames && entry.metrics.frames.dropped) || 0), 0),
      upload: null,
      uploadDisplay: "N/A",
      labels: {
        loadedBytes: "measured",
        downloadThroughput: "measured",
        bandwidthEstimate: "estimated",
        rebuffers: "measured",
        droppedFrames: "measured",
        upload: "unavailable"
      },
      slots: metrics
    };
  }

  destroy() {
    this.startToken += 1;
    while (this.slots.length) this.removeLastSlot();
    this.focusedSlotId = null;
    this.audioSlotId = null;
    this.userGestureReceived = false;
    emit(this, "destroyed", {}, this.onEvent);
  }
}
