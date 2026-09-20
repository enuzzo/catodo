// Layout-only fixtures. No catalog service, remote playlist, EPG or media fetch.
import { mountAppUI } from '../../src/ui/markup.js';
import { I18n } from '../../src/i18n/index.js';

const i18n = new I18n({ baseUrl: new URL('/locales/', location.href) });
await i18n.load('en');
const t = (...args) => i18n.t(...args);
const ui = mountAppUI(document.querySelector('#app'), {
  t,
  onAction(action, detail) {
    if (action === 'settings-section') ui.focusSettingsSection(detail.dataset.section);
    if (action === 'navigate') ui.showView(detail.dataset.view);
    if (action === 'toggle-more-menu') ui.setMoreMenuOpen(ui.refs.moreMenu.hidden);
  },
});
ui.renderSources({
  activate: false,
  installationSync: { status: 'local-only' },
  sources: [{
    sourceId: 'synthetic-world',
    name: 'World — layout fixture',
    url: 'https://iptv-org.github.io/iptv/index.m3u',
    host: 'Synthetic metadata · no playlist is fetched',
    channelCount: 11008,
  }],
  guideSources: [],
});
ui.renderGuide({ activate: false, channels: [], loading: true, configured: true });
ui.showView(new URLSearchParams(location.search).get('state') === 'guide-loading' ? 'guide' : 'sources');
