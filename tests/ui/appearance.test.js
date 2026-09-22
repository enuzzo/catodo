import test from 'node:test';
import assert from 'node:assert/strict';
import '../../public/appearance.js';

const { DEFAULTS, THEMES, STORAGE_KEY, normalize, resolve, createController } = globalThis.CatodoAppearance;

function environment({ saved, dark = false, light = true, blocked = false, legacy = false, hour = 12 } = {}) {
  const events = () => {
    const listeners = new Map();
    return {
      addEventListener(type, callback) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(callback); },
      removeEventListener(type, callback) { listeners.get(type)?.delete(callback); },
      emit(type, detail) { listeners.get(type)?.forEach((callback) => callback(detail)); },
      count() { return [...listeners.values()].reduce((total, set) => total + set.size, 0); },
    };
  };
  const data = new Map(saved ? [[STORAGE_KEY, saved]] : []);
  const properties = new Map();
  const metas = new Map();
  const queries = [dark, light].map((matches) => {
    const query = { ...events(), matches };
    if (legacy) {
      query.addListener = query.addEventListener.bind(null, 'change');
      query.removeListener = query.removeEventListener.bind(null, 'change');
      delete query.addEventListener;
      delete query.removeEventListener;
    }
    return query;
  });
  let tick;
  const env = {
    ...events(),
    localStorage: { getItem: (key) => data.get(key), setItem(key, value) { if (blocked) throw new Error('Quota'); data.set(key, value); } },
    matchMedia: (query) => queries[query.includes('dark') ? 0 : 1],
    Date: class { getHours() { return hour; } },
    setHour(value) { hour = value; },
    setInterval(callback) { tick = callback; return 1; }, clearInterval() { tick = null; }, tick: () => tick?.(),
    document: {
      ...events(), hidden: false,
      documentElement: { dataset: {}, style: { setProperty: (key, value) => properties.set(key, value) } },
      querySelector: (selector) => ({ setAttribute: (_, value) => metas.set(selector, value) }),
    },
  };
  return { env, queries, data, properties, metas };
}

test('new and malformed preferences default to Auto; themes cannot cross light/dark families', () => {
  for (const value of [null, [], 'dark', {}, { mode: 'invalid', autoSource: 'location', dayTheme: 'dracula', nightTheme: 'solarized-light' }]) assert.deepEqual(normalize(value), DEFAULTS);
  assert.equal(resolve({}, { dark: true, hour: 12 }).theme.id, 'catodo-dark');
  assert.equal(resolve({}, { light: true, hour: 23 }).scheme, 'light'); // Light is a valid browser signal, not proof of unsupported Auto.
  assert.equal(resolve({ mode: 'light' }, { dark: true }).scheme, 'light');
  assert.equal(resolve({ mode: 'dark' }, { light: true }).scheme, 'dark');
});

test('clock override and unsupported-browser fallback use device-local 07:00 / 19:00 boundaries', () => {
  for (const [hour, scheme] of [[0, 'dark'], [6, 'dark'], [7, 'light'], [18, 'light'], [19, 'dark'], [23, 'dark']]) {
    assert.equal(resolve({ autoSource: 'clock' }, { dark: true, light: true, hour }).scheme, scheme);
    assert.equal(resolve({}, { hour }).scheme, scheme);
  }
  assert.equal(resolve({}, {}).source, 'clock-fallback');
});

test('pre-paint controller restores choices, watches browser changes, and updates chrome without app DOM', () => {
  const { env, queries, properties, metas, data } = environment({ saved: JSON.stringify({ ...DEFAULTS, nightTheme: 'dracula' }) });
  const controller = createController(env);
  assert.equal(env.document.documentElement.dataset.theme, 'catodo-light');
  queries[0].matches = true; queries[1].matches = false; queries[0].emit('change');
  assert.equal(env.document.documentElement.dataset.theme, 'dracula');
  assert.equal(properties.get('--paper'), '#282a36');
  assert.equal(metas.get('meta[name="theme-color"]'), '#282a36');
  let notifications = 0;
  const unsubscribe = controller.subscribe(() => notifications++);
  controller.set({ mode: 'light', dayTheme: 'catppuccin-latte' });
  assert.equal(JSON.parse(data.get(STORAGE_KEY)).dayTheme, 'catppuccin-latte');
  assert.equal(controller.getState().theme.id, 'catppuccin-latte');
  controller.set({ mode: 'light' });
  assert.equal(notifications, 2); // No duplicate work for the same appearance.
  unsubscribe(); controller.destroy();
  assert.equal(env.count() + env.document.count() + queries.reduce((sum, query) => sum + query.count(), 0), 0);
});

test('time, wake-up and cross-tab reset keep Auto current without polling storage', () => {
  const { env, data } = environment();
  const controller = createController(env);
  controller.set({ autoSource: 'clock' });
  env.setHour(19); env.tick();
  assert.equal(controller.getState().scheme, 'dark');
  env.setHour(7); env.document.emit('visibilitychange');
  assert.equal(controller.getState().scheme, 'light');
  data.set(STORAGE_KEY, JSON.stringify({ mode: 'dark', nightTheme: 'monokai' }));
  env.emit('storage', { key: STORAGE_KEY, storageArea: env.localStorage });
  assert.equal(controller.getState().theme.id, 'monokai');
  data.clear(); env.emit('storage', { key: null });
  assert.deepEqual(controller.getState().preferences, DEFAULTS);
  controller.destroy();
});

test('corrupt or unavailable storage and older media-query listeners remain usable', () => {
  const { env, queries } = environment({ saved: '{broken', blocked: true, legacy: true });
  const controller = createController(env);
  controller.set({ mode: 'dark' });
  assert.equal(controller.getState().persisted, false);
  assert.equal(controller.getState().scheme, 'dark');
  controller.set({ mode: 'auto' });
  queries[0].matches = true; queries[0].emit('change');
  assert.equal(controller.getState().scheme, 'dark');
  controller.destroy();
  const unavailable = environment({ dark: false, light: false, hour: 22 });
  Object.defineProperty(unavailable.env, 'localStorage', { get() { throw new Error('Denied'); } });
  unavailable.env.matchMedia = undefined;
  const fallback = createController(unavailable.env);
  assert.equal(fallback.getState().scheme, 'dark');
  assert.equal(fallback.getState().persisted, false);
  fallback.destroy();
});

function luminance(hex) {
  const rgb = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
function contrast(a, b) { const pair = [luminance(a), luminance(b)].sort((a, b) => b - a); return (pair[0] + 0.05) / (pair[1] + 0.05); }

test('every palette keeps normal text, links, status text and filled-button labels above 4.5:1', () => {
  for (const theme of THEMES) {
    const tokens = theme.tokens;
    for (const foreground of ['ink', 'ink-soft', 'ink-faint', 'signal', 'success', 'warning', 'danger']) {
      for (const background of ['paper', 'paper-raised', 'paper-subtle']) {
        const ratio = contrast(tokens[foreground], tokens[background]);
        assert.ok(ratio >= 4.5, `${theme.id}: ${foreground} / ${background} = ${ratio.toFixed(2)}`);
      }
    }
    for (const background of ['signal', 'signal-hover']) assert.ok(contrast(tokens['on-signal'], tokens[background]) >= 4.5, `${theme.id}: button ${background}`);
    assert.ok(contrast(tokens.signal, tokens['signal-soft']) >= 4.5, `${theme.id}: link on soft accent`);
  }
});
