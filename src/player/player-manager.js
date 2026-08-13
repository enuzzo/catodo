import { emit } from "./player-events.js";
import { PlayerSlot } from "./player-slot.js";

const FORWARDED_EVENTS = [
  "attached", "tuning", "tuned", "progress", "warning", "retrying", "recovering",
  "fallback", "fatal", "autoplay-blocked", "audio", "metrics", "destroyed"
];

export class PlayerManager extends EventTarget {
  constructor(options) {
    super();
    const settings = options || {};
    this.onEvent = settings.onEvent || null;
    this.slot = settings.slot || new PlayerSlot(Object.assign({}, settings.slotOptions || {}, {
      id: settings.id || "main",
      video: settings.video
    }));
    this.slotListeners = FORWARDED_EVENTS.map((type) => {
      const handler = (event) => emit(this, type, event.detail, this.onEvent);
      this.slot.addEventListener(type, handler);
      return { type: type, handler: handler };
    });
  }

  attach(video) {
    this.slot.attach(video);
    return this;
  }

  tune(source, options) {
    return this.slot.tune(source, options);
  }

  setMuted(muted) {
    this.slot.setMuted(muted);
  }

  getMetrics() {
    return this.slot.getMetrics();
  }

  destroy() {
    this.slot.destroy();
    this.slotListeners.forEach((entry) => this.slot.removeEventListener(entry.type, entry.handler));
    this.slotListeners = [];
  }
}
