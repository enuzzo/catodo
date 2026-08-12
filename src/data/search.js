const normalize = (value) => String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("en-US");

export function searchChannels(channels, query) {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return [...channels];
  return channels.filter((channel) => {
    const document = normalize([channel.name, ...(channel.aliases || []), ...(channel.countries || []), ...(channel.countryNames || []), ...(channel.languages || []), ...(channel.categories || []), ...(channel.sources || []), ...(channel.sourceNames || [])].join(" "));
    return terms.every((term) => document.includes(term));
  });
}

export class CatalogSearch {
  #worker = null;
  #channels = [];
  #requests = new Map();
  #requestId = 0;

  constructor(options = {}) {
    const WorkerImpl = options.WorkerImpl || globalThis.Worker;
    if (WorkerImpl) {
      try {
        this.#worker = new WorkerImpl(new URL("../workers/catalog-search.worker.js", import.meta.url), { type: "module" });
        this.#worker.onmessage = ({ data }) => {
          if (data.type !== "result") return;
          this.#requests.get(data.requestId)?.(data.channelIds);
          this.#requests.delete(data.requestId);
        };
      } catch { this.#worker = null; }
    }
  }

  index(channels) {
    this.#channels = channels;
    this.#worker?.postMessage({ type: "index", channels });
  }

  async search(query) {
    if (!this.#worker) return searchChannels(this.#channels, query);
    const requestId = ++this.#requestId;
    const channelIds = await new Promise((resolve) => {
      this.#requests.set(requestId, resolve);
      this.#worker.postMessage({ type: "search", requestId, query });
    });
    const positions = new Map(channelIds.map((id, position) => [id, position]));
    return this.#channels.filter((channel) => positions.has(channel.channelId)).sort((a, b) => positions.get(a.channelId) - positions.get(b.channelId));
  }

  destroy() {
    this.#worker?.terminate();
    this.#worker = null;
    this.#requests.clear();
  }
}
