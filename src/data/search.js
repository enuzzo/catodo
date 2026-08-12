const normalize = (value) => String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("en-US");

export function searchDocument(channel) {
  const endpointTerms = (channel.endpoints || []).flatMap((endpoint) => [
    endpoint.streamTitle, endpoint.feedId, endpoint.feedName, ...(endpoint.feedAliases || []),
    ...(endpoint.languageNames || []), endpoint.feedFormat, endpoint.quality, endpoint.label,
  ]);
  const categoryTerms = (channel.categoryDescriptions || []).flatMap((category) => [category?.id, category?.name, category?.description]);
  return normalize([
    channel.name, channel.officialName, ...(channel.aliases || []), channel.network, ...(channel.owners || []),
    ...(channel.countries || []), ...(channel.countryNames || []), ...(channel.languages || []),
    ...(channel.categories || []), ...(channel.categoryNames || []), ...categoryTerms,
    ...(channel.sources || []), ...(channel.sourceNames || []), ...endpointTerms,
  ].join(" "));
}

export function searchChannels(channels, query) {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return [...channels];
  return channels.filter((channel) => {
    const document = searchDocument(channel);
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
    // Do not structured-clone logo/guide payloads into the worker. Only the
    // compact normalized search records cross the thread boundary.
    this.#worker?.postMessage({
      type: "index",
      records: channels.map((channel) => ({ channelId: channel.channelId, document: searchDocument(channel) })),
    });
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
