# Catalog and shared state

- Start with `catalog-service.js` for orchestration, `db.js` for IndexedDB
  transactions and `installation-sync.js` for the PHP client protocol.
- `source-policy.js` keeps deep links inert until consent. Preserve fetch/parser
  limits and safety filtering; failed refreshes keep the last good snapshot.
- Favorites reference stable channel IDs, not stream URLs. `identity.js` affects
  deduplication, endpoints, aliases, migration and history. Similar names alone
  do not justify merging regional feeds.
- Store/index changes require a `DB_VERSION` upgrade path in `db.js`, never
  deleting/recreating user data. Source replacement remains atomic.
- Shared configuration uses revision-guarded server state plus a durable FIFO
  outbox of idempotent intents. Preserve failed-head ordering, the multi-tab
  lease and explicit retained-data recovery. Never replay a stale full snapshot
  after conflict or reset the migration marker.
- Schema changes also touch `public/installation-api.php`; consult
  [server guidance](../../docs/SERVER.md).
  Backups exclude credentials, programme bodies and runtime caches.
- Use `tests/data/`; include `tests/php/installation-api.test.js` for shared-state
  changes. Synthetic fixtures must be isolated from real profiles/installations.

Read [architecture](../../docs/ARCHITECTURE.md#installation-wide-state) for sync
semantics and [operations](../../docs/OPERATIONS.md#installation-sync-diagnosis)
for diagnosis.
