# Context — agent load router

Three folders; do not confuse the two **archive** locations.

| Path | Purpose |
| --- | --- |
| `foundation/` | Living cross-change docs (PRD, roadmap index, test-plan, lessons) |
| `changes/<change-id>/` | In-flight slice work (`change.md`, `research.md`, `plan.md`) |
| `archive/` | **Shipped changes** moved from `changes/` (`YYYY-MM-DD-<change-id>/`) |
| `foundation/archive/` | **Superseded foundation** snapshots only (old PRD, shape-notes) — not slice work |

Hard rules and commands: `@AGENTS.md` (repo root).

## Load order by task

| Task | Read first (in order) |
| --- | --- |
| Pick / ship slice | `foundation/roadmap.md` → `foundation/roadmap-references/items/{ID}.md` |
| Product contract | `foundation/prd.md` → `foundation/prd-refs.md` (US vs legacy FR) |
| PRD v3 scope map | `foundation/roadmap-references/prd-v3-horizon.md` |
| `/10x-plan` / `/10x-implement` | `changes/<change-id>/plan.md` Progress + `foundation/lessons.md` |
| Wedge / flow slices (F-07, B-05+) | + `foundation/user-flow.md`, `foundation/roadmap-references/flow-coherence-recommendations.md` |
| Tests | `foundation/test-plan.md`; commands in `foundation/test-stack.md` |
| Stack / health | `foundation/stack-assessment.md`, `foundation/tech-stack.md` |

**Do not** load `roadmap-references/slices.md` (530-line bulk export) unless you need every slice in one file — use `items/{ID}.md`.

## Active changes

```bash
ls context/changes/
```

Resume state: `roadmap.md` status + `changes/<change-id>/change.md` + `plan.md` `## Progress`.
