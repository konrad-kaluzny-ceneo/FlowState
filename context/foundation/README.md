# Foundation Docs

Cross-change living documents that span multiple changes. Each project picks which foundation docs it needs (e.g. product requirements, tech-stack, roadmap, glossary, test-stack). Foundation docs are owned by the skills that read and write them; this README describes the conventions that apply to all of them.

## Context Loading

Foundation docs are **not** auto-loaded into the agent's context window. They are available on-demand via `#File` references in chat. Steering files in `.kiro/steering/foundation-*.md` provide summaries and tell the agent when to pull in the full document.

| Document | When to load |
|----------|-------------|
| `prd.md` | Implementing features, checking requirements, verifying acceptance criteria |
| `tech-stack.md` | Adding dependencies, changing auth, modifying build/deploy config |
| `infrastructure.md` | Deploying, debugging production, changing hosting setup |
| `health-check.md` | Auditing dependencies, reviewing project health |

## Update convention

**Edit-in-place.** Foundation docs evolve over the lifetime of the project. When something changes incrementally (a new dependency, a refined product goal, a shifted milestone), edit the existing file. Don't create dated copies.

## Archive convention

When a foundation doc is fully superseded — replaced by a new approach rather than refined — move it to `foundation/archive/YYYY-MM-DD-<doc>-v<N>.md` and write the replacement at the original path with an incremented `version:` in frontmatter. The archive folder is a historical record; nothing reads from it routinely.

**Current baseline (2026-06-12):** all foundation docs are `version: 2` (post-MVP iteration phase). v1 snapshots live in `foundation/archive/2026-06-12-*-v1.md` (plus `2026-05-24-health-check-v1.md`).

## Anti-pattern

Do **not** put change-scoped docs here. Anything tied to a single change (its plan, its research, its review) belongs under `context/changes/<change-id>/`. Foundation is for what outlives any one change.
