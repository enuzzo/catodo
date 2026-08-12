export const DB_NAME = "catodo-v2";
export const DB_VERSION = 1;
export const STORE_NAMES = Object.freeze([
  "sources", "snapshots", "channels", "endpoints", "channelSources",
  "favorites", "history", "aliases", "settings", "migrationJournal",
]);

let fallbackIndexedDbPromise = null;

async function resolveIndexedDb(indexedDBImpl) {
  if (indexedDBImpl) return indexedDBImpl;
  if (!fallbackIndexedDbPromise) {
    fallbackIndexedDbPromise = import("fake-indexeddb").then((module) => module.indexedDB);
  }
  return fallbackIndexedDbPromise;
}

function promisify(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function openCatalogDb(indexedDBImpl = globalThis.indexedDB) {
  const databaseFactory = await resolveIndexedDb(indexedDBImpl);
  const request = databaseFactory.open(DB_NAME, DB_VERSION);
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains("sources")) db.createObjectStore("sources", { keyPath: "sourceId" });
    if (!db.objectStoreNames.contains("snapshots")) {
      const store = db.createObjectStore("snapshots", { keyPath: "snapshotId" });
      store.createIndex("sourceId", "sourceId", { unique: false });
      store.createIndex("createdAt", "createdAt", { unique: false });
    }
    if (!db.objectStoreNames.contains("channels")) db.createObjectStore("channels", { keyPath: "channelId" });
    if (!db.objectStoreNames.contains("endpoints")) {
      const store = db.createObjectStore("endpoints", { keyPath: "endpointId" });
      store.createIndex("channelId", "channelId", { unique: false });
      store.createIndex("sourceId", "sourceId", { unique: false });
    }
    if (!db.objectStoreNames.contains("channelSources")) {
      const store = db.createObjectStore("channelSources", { keyPath: "id" });
      store.createIndex("sourceId", "sourceId", { unique: false });
      store.createIndex("channelId", "channelId", { unique: false });
    }
    if (!db.objectStoreNames.contains("favorites")) db.createObjectStore("favorites", { keyPath: "id" });
    if (!db.objectStoreNames.contains("history")) {
      const store = db.createObjectStore("history", { keyPath: "id" });
      store.createIndex("rememberedAt", "rememberedAt", { unique: false });
    }
    if (!db.objectStoreNames.contains("aliases")) {
      const store = db.createObjectStore("aliases", { keyPath: "alias" });
      store.createIndex("channelId", "channelId", { unique: false });
    }
    if (!db.objectStoreNames.contains("settings")) db.createObjectStore("settings", { keyPath: "key" });
    if (!db.objectStoreNames.contains("migrationJournal")) db.createObjectStore("migrationJournal", { keyPath: "id" });
  };
  return promisify(request);
}

export function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error || new Error("IndexedDB transaction aborted"));
    transaction.onerror = () => reject(transaction.error || new Error("IndexedDB transaction failed"));
  });
}

export async function get(db, store, key) {
  return promisify(db.transaction(store).objectStore(store).get(key));
}

export async function getAll(db, store) {
  return promisify(db.transaction(store).objectStore(store).getAll());
}

export async function put(db, store, value) {
  const transaction = db.transaction(store, "readwrite");
  transaction.objectStore(store).put(value);
  await transactionDone(transaction);
  return value;
}

export async function getSetting(db, key, fallback = null) {
  const record = await get(db, "settings", key);
  return record ? record.value : fallback;
}

export async function putSetting(db, key, value) {
  return put(db, "settings", { key, value, updatedAt: Date.now() });
}

export async function remove(db, store, key) {
  const transaction = db.transaction(store, "readwrite");
  transaction.objectStore(store).delete(key);
  await transactionDone(transaction);
}

export async function recordsByIndex(db, storeName, indexName, key) {
  const store = db.transaction(storeName).objectStore(storeName);
  return promisify(store.index(indexName).getAll(key));
}

export async function replaceSourceSnapshot(db, source, channels, metadata = {}) {
  const now = Date.now();
  const snapshotId = metadata.snapshotId || `${source.sourceId}:${now}`;
  const transaction = db.transaction(["sources", "snapshots", "channels", "endpoints", "channelSources", "aliases"], "readwrite");
  const sourceStore = transaction.objectStore("sources");
  const snapshotStore = transaction.objectStore("snapshots");
  const channelStore = transaction.objectStore("channels");
  const endpointStore = transaction.objectStore("endpoints");
  const relationStore = transaction.objectStore("channelSources");
  const aliasStore = transaction.objectStore("aliases");

  const oldRelations = await promisify(relationStore.index("sourceId").getAll(source.sourceId));
  oldRelations.forEach((relation) => relationStore.delete(relation.id));
  const oldEndpoints = await promisify(endpointStore.index("sourceId").getAll(source.sourceId));
  oldEndpoints.forEach((endpoint) => endpointStore.delete(endpoint.endpointId));

  for (const channel of channels) {
    const { endpoints, endpoint, source: ignoredSource, sources: ignoredSources, ...storedChannel } = channel;
    channelStore.put({ ...storedChannel, updatedAt: now });
    relationStore.put({ id: `${source.sourceId}|${channel.channelId}`, sourceId: source.sourceId, channelId: channel.channelId, snapshotId });
    for (const item of endpoints || (endpoint ? [endpoint] : [])) endpointStore.put({
      ...item,
      canonicalEndpointId: item.canonicalEndpointId || item.endpointId,
      endpointId: `${item.canonicalEndpointId || item.endpointId}|${source.sourceId}`,
      channelId: channel.channelId,
      sourceId: source.sourceId,
      snapshotId,
    });
    for (const alias of channel.aliases || []) aliasStore.put({ alias: alias.toLocaleLowerCase("en-US"), channelId: channel.channelId });
  }

  snapshotStore.put({ snapshotId, sourceId: source.sourceId, createdAt: now, count: channels.length, ...metadata, status: "good" });
  sourceStore.put({ ...source, activeSnapshotId: snapshotId, count: channels.length, updatedAt: now, error: null });
  await transactionDone(transaction);
  return snapshotId;
}

export async function hydrateCatalog(db) {
  const [channelRows, endpointRows, relationRows, sources, favorites, history] = await Promise.all([
    getAll(db, "channels"), getAll(db, "endpoints"), getAll(db, "channelSources"),
    getAll(db, "sources"), getAll(db, "favorites"), getAll(db, "history"),
  ]);
  const active = new Map(sources.map((source) => [source.sourceId, source.activeSnapshotId]));
  const sourceNames = new Map(sources.map((source) => [source.sourceId, source.name]));
  const linked = relationRows.filter((row) => active.get(row.sourceId) === row.snapshotId);
  const sourceIdsByChannel = new Map();
  linked.forEach((row) => {
    if (!sourceIdsByChannel.has(row.channelId)) sourceIdsByChannel.set(row.channelId, []);
    sourceIdsByChannel.get(row.channelId).push(row.sourceId);
  });
  const endpointsByChannel = new Map();
  endpointRows.filter((row) => active.get(row.sourceId) === row.snapshotId).forEach((row) => {
    if (!endpointsByChannel.has(row.channelId)) endpointsByChannel.set(row.channelId, []);
    const endpoints = endpointsByChannel.get(row.channelId);
    const canonicalEndpointId = row.canonicalEndpointId || row.endpointId;
    const existing = endpoints.find((endpoint) => endpoint.endpointId === canonicalEndpointId);
    if (existing) {
      existing.sources = [...new Set([...(existing.sources || []), row.sourceId])];
    } else {
      endpoints.push({ ...row, endpointId: canonicalEndpointId, sources: [row.sourceId] });
    }
  });
  const channels = channelRows.filter((row) => sourceIdsByChannel.has(row.channelId)).map((row) => ({
    ...row,
    sources: sourceIdsByChannel.get(row.channelId),
    source: sourceIdsByChannel.get(row.channelId)[0] || null,
    sourceNames: sourceIdsByChannel.get(row.channelId).map((sourceId) => sourceNames.get(sourceId)).filter(Boolean),
    endpoints: endpointsByChannel.get(row.channelId) || [],
  }));
  return { sources, channels, favorites, history };
}
