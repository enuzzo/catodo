const DEFAULT_LOCALE = "en";
const interpolate = (template, vars) => String(template).replace(/\{([\w.]+)\}/g, (match, key) => vars[key] ?? match);

export class I18n {
  #locale;
  #messages = new Map();
  #listeners = new Set();
  #baseUrl;
  #fetch;

  constructor(options = {}) {
    this.#locale = options.locale || DEFAULT_LOCALE;
    this.#baseUrl = options.baseUrl || new URL("locales/", globalThis.location?.href || import.meta.url);
    this.#fetch = options.fetchImpl || globalThis.fetch;
  }

  get locale() { return this.#locale; }
  get direction() { return new Intl.Locale(this.#locale).textInfo?.direction || "ltr"; }

  async load(locale = this.#locale) {
    if (!this.#messages.has(locale)) {
      if (!this.#fetch) throw new Error("Fetch is not available for loading locale data");
      const response = await this.#fetch(new URL(`${locale}.json`, this.#baseUrl));
      if (!response.ok) throw new Error(`Could not load locale ${locale}: HTTP ${response.status}`);
      this.#messages.set(locale, await response.json());
    }
    this.#locale = locale;
    this.#listeners.forEach((listener) => listener(locale));
    return this;
  }

  async setLocale(locale) { return this.load(locale); }

  t(key, fallback = key, vars = {}) {
    const value = key.split(".").reduce((item, part) => item?.[part], this.#messages.get(this.#locale));
    return interpolate(typeof value === "string" ? value : fallback, vars);
  }

  subscribe(listener) { this.#listeners.add(listener); return () => this.#listeners.delete(listener); }
  number(value, options) { return new Intl.NumberFormat(this.#locale, options).format(value); }
  date(value, options) { return new Intl.DateTimeFormat(this.#locale, options).format(value); }
  relative(value, unit, options) { return new Intl.RelativeTimeFormat(this.#locale, options).format(value, unit); }
  list(values, options) { return new Intl.ListFormat(this.#locale, options).format(values); }
  region(code, options = {}) { return new Intl.DisplayNames([this.#locale], { type: "region", ...options }).of(code); }
  language(code, options = {}) { return new Intl.DisplayNames([this.#locale], { type: "language", ...options }).of(code); }
  plural(value, forms) { return forms[new Intl.PluralRules(this.#locale).select(value)] ?? forms.other; }
}

export const i18n = new I18n();
export const t = (...args) => i18n.t(...args);
export default i18n;
