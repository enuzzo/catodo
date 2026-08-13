export class FakeVideo extends EventTarget {
  constructor() {
    super();
    this.autoplay = false;
    this.muted = false;
    this.volume = 1;
    this.paused = true;
    this.readyState = 4;
    this.webkitAudioDecodedByteCount = 0;
    this.playsInline = false;
    this.currentTime = 5;
    this.ended = false;
    this.src = "";
    this.playCalls = 0;
    this.pauseCalls = 0;
    this.loadCalls = 0;
    this.removedAttributes = [];
    this.buffered = {
      length: 1,
      start: () => 0,
      end: () => 15
    };
    this.quality = { totalVideoFrames: 100, droppedVideoFrames: 2 };
  }
  play() {
    this.playCalls += 1;
    this.paused = false;
    return Promise.resolve();
  }

  pause() {
    this.pauseCalls += 1;
    this.paused = true;
  }

  load() {
    this.loadCalls += 1;
  }

  canPlayType() {
    return "";
  }

  removeAttribute(name) {
    this.removedAttributes.push(name);
    if (name === "src") this.src = "";
  }

  getVideoPlaybackQuality() {
    return this.quality;
  }
}

export class FakeHls {
  static instances = [];

  static Events = {
    ERROR: "error",
    MEDIA_ATTACHED: "media-attached",
    MANIFEST_LOADING: "manifest-loading",
    MANIFEST_PARSED: "manifest-parsed",
    LEVEL_LOADING: "level-loading",
    FRAG_LOADING: "frag-loading",
    FRAG_BUFFERED: "frag-buffered",
    FRAG_LOADED: "frag-loaded",
    LEVEL_SWITCHED: "level-switched",
    LEVEL_LOADED: "level-loaded"
  };

  static ErrorTypes = {
    NETWORK_ERROR: "networkError",
    MEDIA_ERROR: "mediaError"
  };

  static isSupported() {
    return true;
  }

  constructor(config) {
    this.config = config;
    this.listeners = new Map();
    this.destroyCalls = 0;
    this.startLoadCalls = 0;
    this.recoverCalls = 0;
    this.currentLevel = 0;
    this.bandwidthEstimate = 6_000_000;
    this.latency = 2.5;
    this.levels = [{
      bitrate: 3_000_000,
      width: 1920,
      height: 1080,
      videoCodec: "avc1.640028",
      audioCodec: "mp4a.40.2",
      frameRate: 25
    }];
    FakeHls.instances.push(this);
  }

  on(type, handler) {
    const entries = this.listeners.get(type) || [];
    entries.push(handler);
    this.listeners.set(type, entries);
  }

  off(type, handler) {
    const entries = this.listeners.get(type) || [];
    this.listeners.set(type, entries.filter((entry) => entry !== handler));
  }

  emit(type, data) {
    (this.listeners.get(type) || []).slice().forEach((handler) => handler(type, data));
  }

  attachMedia(video) {
    this.video = video;
  }

  loadSource(url) {
    this.url = url;
  }

  startLoad() {
    this.startLoadCalls += 1;
  }

  recoverMediaError() {
    this.recoverCalls += 1;
  }

  destroy() {
    this.destroyCalls += 1;
  }
}

export class FakeSlot extends EventTarget {
  constructor(options) {
    super();
    this.id = options.id;
    this.video = options.video || new FakeVideo();
    this.secondary = Boolean(options.secondary);
    this.destroyed = false;
    this.tuneCalls = [];
    this.metrics = options.metrics || {
      loadedBytes: 0,
      downloadThroughput: 0,
      bandwidthEstimate: 0,
      rebuffers: 0,
      frames: { dropped: 0 }
    };
  }

  attach(video) {
    this.video = video;
  }

  tune(source) {
    this.tuneCalls.push(source);
    return Promise.resolve(source);
  }

  setMuted(value) {
    this.video.muted = Boolean(value);
  }

  setSecondary(value) {
    this.secondary = Boolean(value);
  }

  getMetrics() {
    return this.metrics;
  }

  destroy() {
    this.destroyed = true;
  }
}
