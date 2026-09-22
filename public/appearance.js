/* Shared, synchronous pre-paint bootstrap for the PHP gate and Vite shell.
 * No network, account data or media access. Palette provenance: THIRD_PARTY_NOTICES.md.
 */
(function (global) {
  'use strict';
  const STORAGE_KEY = 'catodo:appearance:v1';
  const DEFAULTS = Object.freeze({ mode: 'auto', autoSource: 'browser', dayTheme: 'catodo-light', nightTheme: 'catodo-dark' });
  const mix = (a, b, weight) => '#' + [1, 3, 5].map((offset) => Math.round(
    parseInt(a.slice(offset, offset + 2), 16) * (1 - weight) + parseInt(b.slice(offset, offset + 2), 16) * weight,
  ).toString(16).padStart(2, '0')).join('');

  function palette(id, name, scheme, colors) {
    const [paper, raised, subtle, ink, muted, faint, line, strong, signal, hover, onSignal, success, warning, danger] = colors;
    const tokens = {
      paper, 'paper-raised': raised, 'paper-subtle': subtle, ink, 'ink-soft': muted, 'ink-faint': faint,
      line, 'line-strong': strong, signal, 'signal-hover': hover, 'on-signal': onSignal,
      'signal-soft': mix(paper, signal, scheme === 'dark' ? 0.13 : 0.04),
      'surface-hover': mix(raised, ink, 0.05), chrome: paper,
      success, warning, danger,
      'success-soft': mix(paper, success, 0.10), 'warning-soft': mix(paper, warning, 0.10), 'danger-soft': mix(paper, danger, 0.10),
      'map-land': mix(paper, ink, 0.17), 'map-highlight': mix(paper, signal, 0.35),
      'shadow-soft': scheme === 'dark' ? '0 14px 40px rgb(0 0 0 / 24%)' : '0 14px 40px rgb(17 19 16 / 8%)',
    };
    return Object.freeze({ id, name, scheme, tokens: Object.freeze(tokens) });
  }

  // Semantic adaptations preserve each palette's character and readable UI contrast.
  const THEMES = Object.freeze([
    palette('catodo-light', 'CATODO Light', 'light', ['#f7f6f2', '#fdfcf9', '#efefeb', '#111310', '#5d6059', '#696c64', '#ddded8', '#b9bbb4', '#075df6', '#004bd4', '#ffffff', '#117742', '#846200', '#c0262d']),
    palette('catppuccin-latte', 'Catppuccin Latte', 'light', ['#eff1f5', '#ffffff', '#e6e9ef', '#4c4f69', '#5c5f77', '#62657d', '#ccd0da', '#9ca0b0', '#185bdd', '#124bbd', '#ffffff', '#397718', '#886100', '#c2183a']),
    palette('solarized-light', 'Solarized Light', 'light', ['#fdf6e3', '#fffbef', '#eee8d5', '#073642', '#52676e', '#52676e', '#d8d2c0', '#a1aaa4', '#006da3', '#005780', '#ffffff', '#526c00', '#856100', '#bb2929']),
    palette('catodo-dark', 'CATODO Dark', 'dark', ['#14171c', '#1c2027', '#242932', '#f2f3ef', '#b6bdc7', '#a1aab7', '#343b46', '#687587', '#83b4ff', '#a4c8ff', '#101923', '#75d79e', '#eac46a', '#ff9199']),
    palette('catppuccin-mocha', 'Catppuccin Mocha', 'dark', ['#1e1e2e', '#252537', '#313244', '#cdd6f4', '#bac2de', '#a6adc8', '#45475a', '#6c7086', '#89b4fa', '#b4befe', '#1e1e2e', '#a6e3a1', '#f9e2af', '#f38ba8']),
    palette('dracula', 'Dracula', 'dark', ['#282a36', '#303341', '#383b4c', '#f8f8f2', '#c2c5db', '#b1b6ce', '#484d64', '#737da6', '#bd93f9', '#d2b3ff', '#282a36', '#50fa7b', '#f1fa8c', '#ff8c99']),
    palette('monokai', 'Monokai', 'dark', ['#272822', '#303129', '#3b3c32', '#f8f8f2', '#c8c8b9', '#b4b4a5', '#4b4c40', '#797b68', '#a6e22e', '#c0ef64', '#272822', '#a6e22e', '#e6db74', '#ff80a5']),
    palette('solarized-dark', 'Solarized Dark', 'dark', ['#002b36', '#073642', '#103f4a', '#eee8d5', '#a3b1ae', '#9ca9a9', '#28515c', '#607d83', '#63b6e5', '#91d0f2', '#002b36', '#b5c65d', '#ebbe56', '#ff8e86']),
  ]);

  function normalize(value) {
    const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const theme = (id, scheme, fallback) => THEMES.some((item) => item.id === id && item.scheme === scheme) ? id : fallback;
    return {
      mode: ['auto', 'light', 'dark'].includes(input.mode) ? input.mode : DEFAULTS.mode,
      autoSource: ['browser', 'clock'].includes(input.autoSource) ? input.autoSource : DEFAULTS.autoSource,
      dayTheme: theme(input.dayTheme, 'light', DEFAULTS.dayTheme),
      nightTheme: theme(input.nightTheme, 'dark', DEFAULTS.nightTheme),
    };
  }

  function resolve(value, { dark = false, light = false, hour = new Date().getHours() } = {}) {
    const preferences = normalize(value);
    let scheme = preferences.mode;
    let source = 'manual';
    if (scheme === 'auto') {
      if (preferences.autoSource === 'browser' && (dark || light)) {
        scheme = dark ? 'dark' : 'light';
        source = 'browser';
      } else {
        scheme = hour >= 7 && hour < 19 ? 'light' : 'dark';
        source = preferences.autoSource === 'clock' ? 'clock' : 'clock-fallback';
      }
    }
    return { preferences, scheme, source, theme: THEMES.find((item) => item.id === preferences[scheme === 'dark' ? 'nightTheme' : 'dayTheme']) };
  }

  function createController(env) {
    let storage;
    try { storage = env.localStorage; } catch { /* Private/constrained browser: session-only preference. */ }
    const read = () => {
      try { return normalize(JSON.parse(storage?.getItem(STORAGE_KEY) || 'null')); } catch { return normalize(); }
    };
    const media = (query) => { try { return env.matchMedia?.(query); } catch { return null; } };
    const dark = media('(prefers-color-scheme: dark)');
    const light = media('(prefers-color-scheme: light)');
    let preferences = read();
    let persisted = Boolean(storage);
    let current;
    let signature;
    const listeners = new Set();
    const root = env.document.documentElement;

    function refresh() {
      const next = { ...resolve(preferences, { dark: dark?.matches, light: light?.matches, hour: new (env.Date || Date)().getHours() }), persisted };
      const nextSignature = JSON.stringify([next.preferences, next.scheme, next.source, persisted]);
      if (signature === nextSignature) return;
      signature = nextSignature;
      current = next;
      root.dataset.colorScheme = next.scheme;
      root.dataset.theme = next.theme.id;
      root.style.colorScheme = next.scheme;
      for (const [token, color] of Object.entries(next.theme.tokens)) root.style.setProperty('--' + token, color);
      // Also color the document before either stylesheet has finished loading.
      root.style.backgroundColor = next.theme.tokens.paper;
      env.document.querySelector('meta[name="theme-color"]')?.setAttribute('content', next.theme.tokens.paper);
      env.document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', next.scheme);
      listeners.forEach((listener) => listener(current));
    }
    const onStorage = (event) => {
      if ((event.key === STORAGE_KEY || event.key === null) && (!event.storageArea || event.storageArea === storage)) {
        preferences = read();
        persisted = Boolean(storage);
        refresh();
      }
    };
    const onVisible = () => { if (!env.document.hidden) refresh(); };
    [dark, light].forEach((query) => {
      if (query?.addEventListener) query.addEventListener('change', refresh);
      else query?.addListener?.(refresh);
    });
    env.addEventListener('storage', onStorage);
    env.addEventListener('focus', refresh);
    env.addEventListener('pageshow', refresh);
    env.document.addEventListener('visibilitychange', onVisible);
    const timer = env.setInterval(onVisible, 30_000);
    refresh();
    return Object.freeze({
      getState: () => ({ ...current, preferences: { ...current.preferences } }),
      set(patch) {
        preferences = normalize({ ...preferences, ...patch });
        try {
          if (!storage) throw new Error('Storage unavailable');
          storage.setItem(STORAGE_KEY, JSON.stringify(preferences));
          persisted = true;
        } catch { persisted = false; }
        refresh();
      },
      subscribe(listener) { listeners.add(listener); listener(current); return () => listeners.delete(listener); },
      destroy() {
        env.clearInterval(timer);
        [dark, light].forEach((query) => {
          if (query?.removeEventListener) query.removeEventListener('change', refresh);
          else query?.removeListener?.(refresh);
        });
        env.removeEventListener('storage', onStorage);
        env.removeEventListener('focus', refresh);
        env.removeEventListener('pageshow', refresh);
        env.document.removeEventListener('visibilitychange', onVisible);
        listeners.clear();
      },
    });
  }
  global.CatodoAppearance = Object.freeze({ STORAGE_KEY, DEFAULTS, THEMES, normalize, resolve, createController,
    controller: global.document ? createController(global) : null });
})(globalThis);
