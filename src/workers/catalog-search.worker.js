let index = [];

const normalize = (value) => String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("en-US");

function documentFor(channel) {
  const endpointTerms = (channel.endpoints || []).flatMap((endpoint) => [
    endpoint.streamTitle, endpoint.feedId, endpoint.feedName, ...(endpoint.feedAliases || []),
    ...(endpoint.languageNames || []), endpoint.feedFormat, endpoint.quality, endpoint.label,
  ]);
  const categoryTerms = (channel.categoryDescriptions || []).flatMap((category) => [category?.id, category?.name, category?.description]);
  return normalize([
    channel.name,
    channel.officialName,
    ...(channel.aliases || []),
    channel.network,
    ...(channel.owners || []),
    ...(channel.countries || []),
    ...(channel.countryNames || []),
    ...(channel.languages || []),
    ...(channel.categories || []),
    ...(channel.categoryNames || []),
    ...categoryTerms,
    ...(channel.sources || []),
    ...(channel.sourceNames || []),
    ...endpointTerms,
  ].join(" "));
}

self.onmessage = ({ data }) => {
  if (data.type === "index") {
    index = Array.isArray(data.records)
      ? data.records.map((item) => ({ channelId: item.channelId, document: normalize(item.document) }))
      : data.channels.map((channel) => ({ channelId: channel.channelId, document: documentFor(channel) }));
    self.postMessage({ type: "indexed", count: index.length });
  }
  if (data.type === "search") {
    const terms = normalize(data.query).split(/\s+/).filter(Boolean);
    const channelIds = !terms.length ? index.map((item) => item.channelId) : index.filter((item) => terms.every((term) => item.document.includes(term))).map((item) => item.channelId);
    self.postMessage({ type: "result", requestId: data.requestId, channelIds });
  }
};
