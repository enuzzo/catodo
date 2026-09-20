# Efficient agent work on CATODO

This guide is for substantial or interrupted work and for maintaining agent
instructions. Routine edits can go straight from the root route to owning code.

## Work and resume

1. Establish the requested outcome and current working-tree state. Select the
   owning area and nearest tests from `CODE-MAP.md`; inspect only relevant docs.
2. Make a bounded change and verify its behavior. Continue authorized local
   work through completion. Surface a decision only when it changes the result,
   scope or external effects; do not repeatedly ask about routine implementation.
3. Update the owning documentation and `Unreleased` entry when needed. Complete
   required gates before commit/push/deploy; respect the task's publication scope.
4. Report changes, evidence limits, publication status and remaining work in
   Italian. Carry worthwhile deferred ideas into `ROADMAP.md` as proposals.

For work spanning sessions, create a short file under `docs/work/` only when
needed. Include objective/non-goals, affected modules, decisions, completed work,
remaining steps, checks with dates and exact next action. Link it from the
roadmap while active; archive or mark it complete afterward. Do not create a
second permanent backlog or populate empty planning templates for trivial edits.

Independent read-only searches/checks can run together. Subagents are not a
mandatory ceremony: use them only when the user or applicable instructions
explicitly request delegation, give bounded ownership, and avoid concurrent
writers in the Dropbox checkout. Historical subagent recipes are not active
instructions.

## Why the information is arranged this way

Official guidance checked on 2026-09-20:

- [Rethinking skills and prompts for GPT-6 Astra](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra):
  keep always-loaded guidance lean and route to details by task; remove obsolete
  recipes and unnecessary reading/testing requirements.
- [Custom instructions with AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md):
  Codex discovers instructions along the root-to-working-directory chain, with
  more specific guidance later. Arbitrary linked Markdown is not automatically
  included. Discovery has a default combined size limit of 32 KiB.
- [GPT-6 Astra model guidance](https://developers.openai.com/api/docs/guides/latest-model):
  make autonomy, clarification boundaries, verification effort and communication
  expectations explicit; audit conflicting instructions in accessible files.

CATODO's implementation of these recommendations is a project choice, not a new
mandatory Astra file format. Root rules preserve release/security contracts;
scoped guides carry local invariants; the map is optional; old plans retain
historical evidence without activating old skill or deployment instructions.
There is no model configuration change and no new skill/plugin dependency.

## Maintain this structure

Update a route when its code moves, a test name changes or a boundary changes.
Prefer one owner for each fact. Keep provider observations dated and out of
permanent instructions. Add a new scoped file only for genuinely distinct rules;
keep PHP guidance outside `public/`, which is copied to the production artifact.

For an instruction audit, try representative tasks: a UI label should lead to
UI/i18n and both locales; a sync fix to data plus PHP; an EPG fix to resolver,
service and both proxy implementations; a release to operations. Check those
paths and applicable guides without launching a new coding session or executing
an archived plan. This checks navigation, not a measured token/latency gain.
