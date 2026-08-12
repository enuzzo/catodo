# Independent code and product review brief

Use this brief for a fresh, read-only inspection of CATODO. Read
`README.md`, `docs/ARCHITECTURE.md`, `docs/OPERATIONS.md`, `SECURITY.md`, and the
relevant source/tests before drawing conclusions.

## Product intent

CATODO is an English-first, open-source, Tesla-first browser interface for
discovering and watching user-approved public live-TV sources. Its visual voice
is a modern broadcast instrument: structured and spatially disciplined, a mix
of restrained brutalism and rounded surfaces, Exo 2 Variable, EBU accents, and
large touch targets. It should feel distinctive without becoming a sci-fi
cockpit.

Primary surfaces: Live, Explore collections, Countries, Multiview, TV Guide,
Library and Settings. Single-channel and Multiview playback should be immersive,
with chrome that disappears and returns predictably.

## Review goals

Perform two complementary passes:

1. **Engineering inspection:** find concrete correctness, state, concurrency,
   security, performance, accessibility, resilience, compatibility and test
   gaps. Trace important findings to exact files/lines and distinguish verified
   defects from risks or hypotheses.
2. **Product/design critique:** inspect information architecture, navigation,
   discoverability, spatial hierarchy, touch/keyboard accessibility, empty and
   loading states, channel selection, player controls, TV Guide, Countries,
   Multiview and Settings. Propose improvements that fit CATODO's visual/product
   identity rather than replacing it with a generic streaming UI.

Also propose useful or delightful functions CATODO could implement. Prioritize
features that are browser-feasible, Tesla-friendly and honest about external
stream reliability, licensing and metadata limitations.

## Required output

- Start with an executive verdict and the three most consequential observations.
- Findings table: severity (`P0`–`P3`), confidence, evidence, user impact and
  smallest sound remediation.
- Product/UX opportunities ranked by impact versus effort.
- Feature ideas grouped into quick wins, medium investments and ambitious bets.
- Identify features that should *not* be built and explain why.
- Suggest an incremental architecture/refactor sequence that preserves working
  behavior and persistent media DOM.
- Recommend missing automated and real-browser tests.
- End with a pragmatic next milestone containing no more than 5 deliverables.

Do not modify files, commit, push or deploy. Avoid generic advice. Where visual
judgment depends on the rendered application, inspect the running interface or
repository QA screenshots and clearly label anything not directly observed.
