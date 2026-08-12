const DEFAULT_TIMING = Object.freeze({
  settle: 120,
  reveal: 900,
  hold: 1500,
  open: 700,
  exit: 380,
});

export class AnalogBoot {
  constructor({
    screen,
    skipButton,
    reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches,
    disabled = false,
    timing = DEFAULT_TIMING,
  } = {}) {
    this.screen = screen;
    this.skipButton = skipButton;
    this.reducedMotion = reducedMotion;
    this.disabled = disabled;
    this.timing = { ...DEFAULT_TIMING, ...timing };
    this.finished = false;
    this.timers = [];
  }

  play() {
    if (!this.screen) return Promise.resolve();
    if (this.disabled) {
      this.screen.hidden = true;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.resolve = resolve;
      this.skipButton?.addEventListener("click", this.finish, { once: true });
      if (this.reducedMotion) {
        this.screen.classList.add("is-settled", "is-revealing");
        this.schedule(this.finish, 650);
        return;
      }
      this.schedule(() => this.screen.classList.add("is-settled"), this.timing.settle);
      this.schedule(
        () => this.screen.classList.add("is-revealing"),
        this.timing.settle + this.timing.reveal,
      );
      this.schedule(
        () => this.screen.classList.add("is-opening"),
        this.timing.settle + this.timing.reveal + this.timing.hold,
      );
      this.schedule(
        this.finish,
        this.timing.settle + this.timing.reveal + this.timing.hold + this.timing.open,
      );
    });
  }

  schedule = (callback, delay) => {
    this.timers.push(window.setTimeout(callback, delay));
  };

  finish = () => {
    if (this.finished) return;
    this.finished = true;
    this.timers.splice(0).forEach(window.clearTimeout);
    this.skipButton?.removeEventListener("click", this.finish);
    this.screen.classList.add("is-exiting");
    window.setTimeout(() => {
      this.screen.hidden = true;
      this.resolve?.();
    }, this.reducedMotion ? 120 : this.timing.exit);
  };
}

export const playAnalogBoot = options => new AnalogBoot(options).play();
