# Roadmap references

Progressive disclosure for `context/foundation/roadmap.md`. **Read the main file first** for vision, index, streams, and backlog handoff; load detail files only when planning, shipping, or expanding a specific item.

## When to load what

| Need | File |
|------|------|
| Big picture, status, dependencies | [`../roadmap.md`](../roadmap.md) |
| Codebase baseline at roadmap creation | [`baseline.md`](baseline.md) |
| All foundation blocks in one file | [`foundations.md`](foundations.md) |
| All slice blocks in one file | [`slices.md`](slices.md) — **bulk only**; prefer `items/` |
| Single item (Outcome, Unknowns, Risk, …) | [`items/{ID}.md`](items/) — e.g. `items/S-17.md` |
| Bug slice detail | [`bugs.md`](bugs.md) or `items/B-01.md` |
| User flow map + T-01–T-05 | [`../user-flow.md`](../user-flow.md) |
| Flow coherence recommendations (2026-06-13) | [`flow-coherence-recommendations.md`](flow-coherence-recommendations.md) |
| `/10x-roadmap-expand` batch merge notes | [`expand-batches/README.md`](expand-batches/README.md) |
| Research before `/10x-plan` | [`research-requirements.md`](research-requirements.md) |
| Product open questions | [`open-questions.md`](open-questions.md) |
| PRD US ↔ slice / legacy FR | [`../prd-refs.md`](../prd-refs.md) |
| Agent context load router | [`../../README.md`](../../README.md) |
| Deferred ideas | [`future-ideas.md`](future-ideas.md), [`parked.md`](parked.md) |
| Shipped archive log | [`done.md`](done.md) |

## Item index

| ID | Detail | Status (see glance) |
|----|--------|---------------------|
| F-01…F-06 | `items/F-0N.md` | see glance |
| F-07 | `items/F-07.md` | done |
| F-14 | `items/F-14.md` | proposed (expand batch 7) |
| S-01…S-31 | `items/S-NN.md` | see glance |
| S-32…S-44 | `items/S-3N.md`, `items/S-44.md` | see glance |
| S-45…S-50 | no item card — see glance row + `done.md` | done |
| S-51, S-52 | `items/S-51.md`, `items/S-52.md` | ready |
| B-01…B-09 | `items/B-0N.md` | see glance |

Expand outcomes (F-07, S-32–S-35) and merge scope (P-202–P-205, P-GAP-*) live in the main [`roadmap.md`](../roadmap.md) glance + scope tables and in `items/` detail cards — no separate staging folder.

## Load by slice type

| Type | IDs (examples) | Also load |
| --- | --- | --- |
| Wedge / flow | F-07, B-05–B-08, S-21, S-34, S-35 | `user-flow.md`, `flow-coherence-recommendations.md`, `prd-refs.md` US-01 |
| Persona / trust | S-29, S-32 | `prd-refs.md` US-02 |
| Daily planning | S-27, S-30 | `prd-refs.md` US-03 |
| Pause | S-24, B-08, **B-09**, **S-38** | `prd-refs.md` US-04 |
| Craft | S-28, S-31, **F-14**, **S-40–S-43** | `DESIGN.md`, `items/F-14.md`, expand batch 7 |
| Bug (done) | B-01–B-04 | item card only |

## Agent convention

1. Default context budget: **only** `roadmap.md` (~160 lines).
2. Before `/10x-plan <change-id>`: read `items/{roadmap-id}.md` + [`../prd-refs.md`](../prd-refs.md) for US mapping.
3. Before `/10x-roadmap-expand` commit: read evaluator notes in [`expand-batches/README.md`](expand-batches/README.md) + target `items/{ID}.md`.
4. Do not duplicate detail back into `roadmap.md` — patch the reference file and update the glance row.
