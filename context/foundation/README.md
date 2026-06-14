# Foundation Docs

Cross-change living documents that span multiple changes. Each project picks which foundation docs it needs (e.g. product requirements, tech-stack, roadmap, glossary, test-stack). Foundation docs are owned by the skills that read and write them; this README describes the conventions that apply to all of them.

## Context Loading

Foundation docs are **not** auto-loaded into the agent's context window. Pull them on demand via `@` references or the load router in [`../README.md`](../README.md).

| Document | When to load |
|----------|-------------|
| `prd.md` | Product contract, acceptance, scope (v3 brownfield — US + Scope, not FR-NNN) |
| `prd-refs.md` | Map US ↔ roadmap IDs; legacy FR traceability |
| `roadmap.md` | Slice index, status, dependencies — then `roadmap-references/items/{ID}.md` for detail |
| `roadmap-references/prd-v3-horizon.md` | PRD v3 must-have slice map |
| `user-flow.md` | Wedge beat order, guest vs auth (F-07, B-05+) |
| `tech-stack.md` | Adding dependencies, changing auth, modifying build/deploy config |
| `stack-assessment.md` | Agent-friendly stack evaluation, wedge domain gaps |
| `test-plan.md` | Test strategy and cookbook (§6) |
| `test-stack.md` | Pointer to runners and commands (for `/10x-tdd`) |
| `lessons.md` | Before `/10x-plan` or `/10x-implement` |
| `infrastructure.md` | Deploying, debugging production, changing hosting setup |
| `health-check.md` | Auditing dependencies, reviewing project health |

**Avoid** loading `roadmap-references/slices.md` (bulk export) when planning one slice — use `items/{ID}.md`.

## Update convention

**Edit-in-place.** Foundation docs evolve over the lifetime of the project. When something changes incrementally (a new dependency, a refined product goal, a shifted milestone), edit the existing file. Don't create dated copies.

## Archive convention

When a foundation doc is fully superseded — replaced by a new approach rather than refined — move it to `foundation/archive/YYYY-MM-DD-<doc>-v<N>.md` and write the replacement at the original path with an incremented `version:` in frontmatter. The archive folder is a historical record; nothing reads from it routinely.

**Current baseline (2026-06-13):** PRD v3, roadmap v3, stack-assessment added. v1/v2 snapshots in `foundation/archive/` (including `2026-06-13-prd-v2.md`, `2026-06-13-shape-notes-v3-final.md`).

## Anti-pattern

Do **not** put change-scoped docs here. Anything tied to a single change (its plan, its research, its review) belongs under `context/changes/<change-id>/`. Foundation is for what outlives any one change.

**Do not** confuse `context/archive/` (shipped **changes**) with `context/foundation/archive/` (superseded **foundation** docs).
