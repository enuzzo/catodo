import test from 'node:test';
import assert from 'node:assert/strict';

import { enableGuideTimelineDrag } from '../../src/ui/guide-timeline-drag.js';

function fakeTimeline() {
  const listeners = new Map();
  const classes = new Set();
  return {
    scrollLeft: 20,
    listeners,
    classList: {
      add: (value) => classes.add(value),
      remove: (value) => classes.delete(value),
      contains: (value) => classes.has(value),
    },
    addEventListener(type, handler) { listeners.set(type, handler); },
    removeEventListener(type) { listeners.delete(type); },
    setPointerCapture(pointerId) { this.capturedPointer = pointerId; },
    hasPointerCapture(pointerId) { return this.capturedPointer === pointerId; },
    releasePointerCapture() { this.capturedPointer = null; },
    dispatch(type, values = {}) {
      const event = { type, preventDefault() { this.defaultPrevented = true; }, stopImmediatePropagation() { this.stopped = true; }, ...values };
      listeners.get(type)?.(event);
      return event;
    },
  };
}

test('pointer drag scrolls the guide timeline and suppresses the resulting click', () => {
  const timeline = fakeTimeline();
  const dispose = enableGuideTimelineDrag(timeline);

  timeline.dispatch('pointerdown', { button: 0, pointerType: 'mouse', pointerId: 7, clientX: 120, clientY: 40 });
  const move = timeline.dispatch('pointermove', { pointerId: 7, clientX: 70, clientY: 42 });

  assert.equal(timeline.scrollLeft, 70);
  assert.equal(move.defaultPrevented, true);
  assert.equal(timeline.classList.contains('is-dragging'), true);
  assert.equal(timeline.capturedPointer, 7);

  timeline.dispatch('pointerup', { pointerId: 7 });
  const click = timeline.dispatch('click');
  assert.equal(timeline.classList.contains('is-dragging'), false);
  assert.equal(click.defaultPrevented, true);
  assert.equal(click.stopped, true);

  dispose();
});

test('click-sized movement and native touch gestures are left alone', () => {
  const timeline = fakeTimeline();
  enableGuideTimelineDrag(timeline);

  timeline.dispatch('pointerdown', { button: 0, pointerType: 'mouse', pointerId: 1, clientX: 100, clientY: 20 });
  timeline.dispatch('pointermove', { pointerId: 1, clientX: 96, clientY: 21 });
  timeline.dispatch('pointerup', { pointerId: 1 });
  assert.equal(timeline.scrollLeft, 20);
  assert.equal(timeline.dispatch('click').defaultPrevented, undefined);

  timeline.dispatch('pointerdown', { button: 0, pointerType: 'touch', pointerId: 2, clientX: 100, clientY: 20 });
  timeline.dispatch('pointermove', { pointerId: 2, clientX: 20, clientY: 20 });
  assert.equal(timeline.scrollLeft, 20);
});
