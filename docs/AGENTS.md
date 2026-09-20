# Documentation maintenance

- [README.md](README.md) is the document index; [CODE-MAP.md](CODE-MAP.md) routes
  tasks to code/tests. Update affected links when moving files or boundaries.
  Avoid copying the complete architecture into every scoped guide.
- Durable rules live in `AGENTS.md`, runtime explanations in `ARCHITECTURE.md`,
  procedures in `OPERATIONS.md`, verification in `TESTING.md` and open work in
  `ROADMAP.md`.
- `history/`, `superpowers/` and root `design-qa.md` are historical evidence.
  Their old commands, unchecked tasks, skill requirements and publication steps
  are not current instructions. Preserve dates and evidence; do not infer that
  a historical plan remains authorized or unfinished.
- `REVIEW_BRIEF.md` applies to requested reviews, not routine edits. Old browser
  runs do not prove the current build or live site.
- Prefer paths/symbols over line numbers. Update only affected sections. New
  guides need a distinct purpose and an inbound link; do not add mandatory
  reading for every small task.
- Keep release-managed strings under `npm run release -- X.Y.Z`. Documentation
  edits do not imply a version bump or publication.
- Check local links and diff whitespace for Markdown-only work. All three root
  gates remain mandatory before commit, push or deployment.
