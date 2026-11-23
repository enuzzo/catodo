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
  copy.append(node('h2', null, translate('title', 'Appearance')), node('p', null, translate('description', 'Choose a palette for each mode.')));
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
  const setSwatch = (swatch, theme) => {
    for (const token of ['paper', 'ink', 'signal']) swatch.style.setProperty('--swatch-' + token, theme.tokens[token]);
  };
  const swatch = () => {
    const sample = node('span', 'palette-swatch');
    sample.setAttribute('aria-hidden', 'true');
    return sample;
  };
  const choices = node('div', 'appearance-palettes');
  const cards = ['light', 'dark'].map((scheme) => {
    const preference = scheme === 'light' ? 'dayTheme' : 'nightTheme';
    const family = scheme === 'light' ? translate('dayPalette', 'Day palette') : translate('nightPalette', 'Night palette');
    const card = node('details', 'appearance-palette');
    card.setAttribute('name', 'appearance-palettes');
    const summary = node('summary');
    const preview = swatch();
    const names = node('span', 'appearance-palette__names');
    const selectedName = node('strong');
    const inUse = node('span', 'appearance-palette__active', translate('inUse', 'In use'));
    names.append(node('span', null, family), selectedName);
    const caret = node('i', 'ph ph-caret-down');
    caret.setAttribute('aria-hidden', 'true');
    summary.append(preview, names, inUse, caret);
    const options = node('fieldset', 'appearance-palette__options');
    options.append(node('legend', 'sr-only', family));
    const radios = new Map();
    for (const theme of globalThis.CatodoAppearance.THEMES.filter((item) => item.scheme === scheme)) {
      const label = node('label', 'appearance-palette__option');
      const sample = swatch();
      setSwatch(sample, theme);
      const radio = node('input');
      radio.type = 'radio';
      radio.name = preference;
      radio.value = theme.id;
      radio.dataset.action = 'appearance-setting';
      radio.dataset.preference = preference;
      label.append(sample, node('span', null, theme.name), radio);
      options.append(label);
      radios.set(theme.id, { radio, theme });
    }
    card.append(summary, options);
    choices.append(card);
    return { scheme, preference, preview, selectedName, inUse, radios };
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
  const autoHelp = node('p', 'appearance-auto__help', translate('autoHelp', 'Choose Local time if the browser stays light after dark.'));
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
    cards.forEach((card) => {
      const selected = card.radios.get(preferences[card.preference]);
      selected.radio.checked = true;
      card.selectedName.textContent = selected.theme.name;
      card.inUse.hidden = card.scheme !== scheme;
      setSwatch(card.preview, selected.theme);
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
      ? translate('deviceNote', 'Saved on this browser.')
      : translate('sessionNote', 'Browser storage is unavailable. Your choice will last for this session.');
  });
  return { element: panel, destroy: () => unsubscribe?.() };
}
