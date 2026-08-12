let index = [];

const normalize = (value) => String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("en-US");

function documentFor(channel) {
  return normalize([
    channel.name,
    ...(channel.aliases || []),
    ...(channel.countries || []),
    ...(channel.countryNames || []),
    ...(channel.languages || []),
    ...(channel.categories || []),
    ...(channel.sources || []),
    ...(channel.sourceNames || []),
  ].join(" "));
}

self.onmessage = ({ data }) => {
  if (data.type === "index") {
    index = data.channels.map((channel) => ({ channelId: channel.channelId, document: documentFor(channel) }));
    self.postMessage({ type: "indexed", count: index.length });
  }
  if (data.type === "search") {
    const terms = normalize(data.query).split(/\s+/).filter(Boolean);
    const channelIds = !terms.length ? index.map((item) => item.channelId) : index.filter((item) => terms.every((term) => item.document.includes(term))).map((item) => item.channelId);
    self.postMessage({ type: "result", requestId: data.requestId, channelIds });
  }
};
