/** Persistent appearance controls: only preferences and CSS tokens change, never media DOM. */
export function createAppearanceSettings({ t, appearance }) {
  const translate = (key, fallback, vars) => t?.(`appearance.${key}`, fallback, vars) || fallback;
  const node = (tag, className, text) => {
    const result = document.createElement(tag);
    if (className) result.className = className;
    if (text) result.textContent = text;
    return result;
  };
  const panel = node('section', 'panel appearance-settings');
  panel.id = 'settings-appearance';
  panel.tabIndex = -1;
  const heading = node('div', 'appearance-settings__heading');
  const copy = node('div');
  copy.append(node('h2', null, translate('title', 'Appearance')), node('p', null, translate('description', 'A palette for daylight. Another for after dark.')));
  const modes = node('div', 'appearance-modes');
  modes.setAttribute('role', 'group');
  modes.setAttribute('aria-label', translate('mode', 'Color mode'));
  const modeButtons = ['auto', 'light', 'dark'].map((mode, index) => {
    const button = node('button', 'button', translate(mode, ['Auto', 'Light', 'Dark'][index]));
    button.type = 'button';
    button.dataset.action = 'appearance-setting';
    button.dataset.preference = 'mode';
    button.dataset.value = mode;
    modes.append(button);
    return button;
  });
  heading.append(copy, modes);
  const choices = node('div', 'appearance-palettes');
  const cards = ['light', 'dark'].map((scheme) => {
    const preference = scheme === 'light' ? 'dayTheme' : 'nightTheme';
    const card = node('div', 'appearance-palette');
    const preview = node('div', 'appearance-palette__preview');
    preview.setAttribute('aria-hidden', 'true');
    preview.append(node('i'), node('i'), node('i'), node('b'));
    const label = node('label', 'appearance-palette__label', translate(scheme === 'light' ? 'dayPalette' : 'nightPalette', scheme === 'light' ? 'Day palette' : 'Night palette'));
    const select = node('select');
    select.setAttribute('aria-label', label.textContent);
    select.dataset.action = 'appearance-setting';
    select.dataset.preference = preference;
    for (const theme of globalThis.CatodoAppearance.THEMES.filter((item) => item.scheme === scheme)) {
      const option = node('option', null, theme.name);
      option.value = theme.id;
      select.append(option);
    }
    label.append(select);
    card.append(preview, label);
    choices.append(card);
    return { preference, preview, select };
  });
  const auto = node('div', 'appearance-auto');
  const autoLabel = node('label', 'appearance-auto__label', translate('autoFollows', 'Auto follows'));
  const autoSource = node('select');
  autoSource.setAttribute('aria-label', autoLabel.textContent);
  autoSource.dataset.action = 'appearance-setting';
  autoSource.dataset.preference = 'autoSource';
  for (const [value, key, fallback] of [['browser', 'browserPreference', 'Browser preference'], ['clock', 'localTime', 'Local time · 07:00–19:00']]) {
    const option = node('option', null, translate(key, fallback));
    option.value = value;
    autoSource.append(option);
  }
  autoLabel.append(autoSource);
  const autoHelp = node('p', 'appearance-auto__help', translate('autoHelp', 'If your car’s browser does not follow the display, choose Local time. Day runs from 07:00 to 19:00 on this device.'));
  autoHelp.id = 'appearance-auto-help';
  autoSource.setAttribute('aria-describedby', autoHelp.id);
  auto.append(autoLabel, autoHelp);
  const status = node('p', 'appearance-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const deviceNote = node('p', 'appearance-device-note');
  panel.append(heading, choices, auto, status, deviceNote);
  const unsubscribe = appearance?.subscribe(({ preferences, theme, source, scheme, persisted }) => {
    modeButtons.forEach((button) => {
      const selected = button.dataset.value === preferences.mode;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    cards.forEach(({ preference, preview, select }) => {
      select.value = preferences[preference];
      const palette = globalThis.CatodoAppearance.THEMES.find((item) => item.id === select.value);
      ['paper', 'paper-raised', 'ink', 'signal'].forEach((token) => preview.style.setProperty('--preview-' + token, palette.tokens[token]));
    });
    autoSource.value = preferences.autoSource;
    auto.hidden = preferences.mode !== 'auto';
    const sourceText = source === 'browser'
      ? translate('statusBrowser', 'Browser reports {scheme}', { scheme: translate(scheme, scheme) })
      : source === 'clock-fallback'
        ? translate('statusFallback', 'No browser preference available · using local time')
        : source === 'clock'
          ? translate('statusClock', 'Following local time')
          : translate('statusManual', 'Manual selection');
    status.textContent = `${theme.name} · ${sourceText}`;
    deviceNote.textContent = persisted
      ? translate('deviceNote', 'Saved on this browser. Your other screens keep their own appearance.')
      : translate('sessionNote', 'Browser storage is unavailable. Your choice will last for this session.');
  });
  return { element: panel, destroy: () => unsubscribe?.() };
}
