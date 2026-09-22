/** Native progressive media. No URL is attached until the viewer consents. */
export class TheatrePlayer {
  constructor({ video, beforePlay = () => {}, onState = () => {} }) {
    this.video = video;
    this.beforePlay = beforePlay;
    this.onState = onState;
    this.active = false;
    this.session = 0;
    this.title = null;
    this.error = '';
    this.listeners = ['play', 'pause', 'playing', 'timeupdate', 'loadedmetadata', 'volumechange', 'waiting', 'ended', 'error'].map((name) => {
      const listener = () => {
        if (name === 'play') {
          if (!this.active) { video.pause(); return; }
          this.beforePlay();
        }
        if (name === 'error' && video.getAttribute('src')) this.error = 'unavailable';
        if (name === 'playing') this.error = '';
        this.onState(this.snapshot());
      };
      video.addEventListener(name, listener);
      return [name, listener];
    });
  }

  snapshot() {
    return { titleId: this.title?.id || '', playing: !this.video.paused, muted: this.video.muted,
      currentTime: this.video.currentTime, duration: this.video.duration, error: this.error };
  }

  setActive(active) {
    this.active = Boolean(active);
    if (!this.active) { this.session += 1; this.video.pause(); }
  }

  async play(title, { consent = false, editionIndex = 0 } = {}) {
    const edition = title?.editions?.[editionIndex];
    if (!this.active || !consent || title?.decision !== 'usable' || !edition) return false;
    let url;
    try { url = new URL(edition.url); } catch { return false; }
    if (url.protocol !== 'https:' || url.username || url.password) return false;
    const session = ++this.session;
    this.beforePlay();
    this.error = '';
    if (this.video.getAttribute('src') !== url.href) {
      this.video.pause();
      this.title = title;
      // Intentionally omit crossOrigin: progressive playback needs no CORS grant.
      this.video.src = url.href;
      this.video.load();
    }
    try {
      await this.video.play();
      if (session !== this.session || !this.active) return false;
      return true;
    } catch (error) {
      if (session !== this.session) return false;
      this.error = error?.name === 'NotAllowedError' ? 'gesture' : 'unavailable';
      this.onState(this.snapshot());
      return false;
    }
  }

  pause() { this.session += 1; this.video.pause(); }
  clear() {
    this.pause();
    this.title = null;
    this.error = '';
    this.video.removeAttribute('src');
    this.video.load();
    this.onState(this.snapshot());
  }
  seek(delta) {
    if (Number.isFinite(this.video.duration) && this.video.duration > 0) {
      this.video.currentTime = Math.max(0, Math.min(this.video.duration, this.video.currentTime + delta));
    }
  }
  destroy() {
    this.setActive(false);
    this.listeners.forEach(([name, listener]) => this.video.removeEventListener(name, listener));
    this.listeners = [];
    this.video.removeAttribute('src');
    this.video.load();
  }
}
