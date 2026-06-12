# Roadmap references

Progressive disclosure for `context/foundation/roadmap.md`. **Read the main file first** for vision, index, streams, and backlog handoff; load detail files only when planning, shipping, or expanding a specific item.

## When to load what

| Need | File |
|------|------|
| Big picture, status, dependencies | [`../roadmap.md`](../roadmap.md) |
| Codebase baseline at roadmap creation | [`baseline.md`](baseline.md) |
| All foundation blocks in one file | [`foundations.md`](foundations.md) |
| All slice blocks in one file | [`slices.md`](slices.md) |
| Single item (Outcome, Unknowns, Risk, …) | [`items/{ID}.md`](items/) — e.g. `items/S-17.md` |
| Bug slice detail | [`bugs.md`](bugs.md) or `items/B-01.md` |
| `/10x-roadmap-expand` batch merge notes | [`expand-batches/README.md`](expand-batches/README.md) |
| Research before `/10x-plan` | [`research-requirements.md`](research-requirements.md) |
| Product open questions | [`open-questions.md`](open-questions.md) |
| Deferred ideas | [`future-ideas.md`](future-ideas.md), [`parked.md`](parked.md) |
| Shipped archive log | [`done.md`](done.md) |

## Item index

| ID | Detail | Status (see glance) |
|----|--------|---------------------|
| F-01…F-06 | `items/F-0N.md` | see glance |
| F-07 | `items/F-07.md` | proposed (expand 2026-06-12) |
| S-01…S-31 | `items/S-NN.md` | see glance |
| S-32…S-35 | `items/S-3N.md` | proposed (expand 2026-06-12) |
| B-01…B-04 | `items/B-0N.md` | done |

Expand outcomes (F-07, S-32–S-35) and merge scope (P-202–P-205, P-GAP-*) live in the main [`roadmap.md`](../roadmap.md) glance + scope tables and in `items/` detail cards — no separate staging folder.

## Agent convention

1. Default context budget: **only** `roadmap.md` (~160 lines).
2. Before `/10x-plan <change-id>`: read `items/{roadmap-id}.md` for that slice + linked PRD refs.
3. Before `/10x-roadmap-expand` commit: read evaluator notes in [`expand-batches/README.md`](expand-batches/README.md) + target `items/{ID}.md`.
4. Do not duplicate detail back into `roadmap.md` — patch the reference file and update the glance row.
