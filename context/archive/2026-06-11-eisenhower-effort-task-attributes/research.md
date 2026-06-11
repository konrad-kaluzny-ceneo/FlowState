---
date: 2026-06-11T12:30:00Z
researcher: ship-slice-orchestrator
git_commit: e8208047eded13e7a369af2e486f9edd45193523
branch: features/eisenhower-effort-task-attributes
repository: FlowState
topic: "F-05 Eisenhower task attributes + scorer v2 integration points"
tags: [research, codebase, scoring, task-schema, guest-merge, rationale-expander]
status: complete
last_updated: 2026-06-11
last_updated_by: ship-slice-orchestrator
---

# Research: F-05 Eisenhower task attributes + scorer v2

**Date**: 2026-06-11  
**Researcher**: ship-slice-orchestrator  
**Git Commit**: `e8208047eded13e7a369af2e486f9edd45193523`  
**Branch**: `features/eisenhower-effort-task-attributes`  
**Repository**: FlowState

## Research Question

Where and how should `importance`, `urgency`, `effortMinutes`, and `commitmentHorizon` integrate into the Task schema, scorer v2, UI, guest storage, and S-23 rationale expander — and what migration pattern applies for `weight` → `urgency`?

## Summary

Task today exposes `workType`, `weight` (1–3), and `sortOrder` on Prisma + guest blob. Scorer v1 uses **`weight` as the sole task-attribute base** in `scoreTask()`, then applies session multipliers (energy fit, fatigue, interruptions, late day, override boost). S-23 expander factors are **session-context only** — no Eisenhower/importance/effort/horizon chips yet (deferred per S-23 archive notes).

F-05 touches a well-bounded vertical slice: schema + migration (S-26 `sortOrder` backfill pattern), extend `ScoringTask` + `scoreTask()` v2 formula, thread fields through tRPC/guest/repositories/optimistic UI, refresh `dominant-factor.ts` + `rationale.ts` + `rationale-breakdown.ts`, and extend existing co-located tests (`score-task.test.ts`, `suggestion.test.ts`, `task-list.test.tsx`, guest merge).

**Orchestrator decisions (confidence ≥ 85):**

| Unknown | Decision | Rationale |
|---------|----------|-----------|
| `weight` migration | Copy `weight` → `urgency`; default `importance: 2`; keep `weight` column read-only legacy | Roadmap explicit; avoids dual-axis confusion for existing rows |
| Effort range | Optional `effortMinutes` 5–240; `null` = unknown (excluded from Ockham boost) | Bounded picker; unknown must not penalize |
| Weight UI relabel | Rename control to **Urgency** (keep Light/Medium/Heavy sublabels); add separate **Importance** picker | Roadmap "compact pickers"; avoids overloading one axis |

## Detailed Findings

### Prisma Task model (current)

`prisma/schema.prisma` — Task has `workType` (enum), `weight` (SmallInt default 2), `sortOrder` (Int default 0). Index on `[userId, sortOrder]`. No F-05 fields yet.

Migration templates:
- S-04: add columns with defaults + index (`work_type`, `weight`)
- S-26: add column, **backfill per-user ordering**, composite index (`sort_order`)

### Scorer v1 pipeline

| Layer | File | Role |
|-------|------|------|
| Core | `src/lib/scoring/score-task.ts` | `ScoringTask`, `scoreTask()`, `pickBestTask()` |
| Context | `src/server/api/routers/suggestion.ts` | Builds `ScoringContext`, maps tasks, calls scorer |
| Rationale | `src/lib/scoring/dominant-factor.ts` | Factor magnitudes → dominant key |
| Templates | `src/lib/scoring/rationale.ts` | One-line copy per `RationaleKey` |
| Expander | `src/lib/scoring/rationale-breakdown.ts` | S-23 chip list |

**v1 formula:** `score = weight × TYPE_FIT[energy][workType] × fatigue × interruptions × lateDay × overrideBoost`

**Tie-break:** score → `sortOrder` asc → `weight` desc → `createdAt` asc

**v2 intent (roadmap):** Eisenhower base (`urgency × importance`), Pareto (importance emphasis when Focused), Ockham (low `effortMinutes` when Fading), horizon coefficient (ASAP boost). Session multipliers likely retained on top of new base.

### Task create/edit UI

Primary surface: `src/app/_components/task-list.tsx`
- Create/edit "+ Details" exposes `workType` + `weight` via `SegmentedControl`
- `WEIGHT_LABELS`: Light / Medium / Heavy
- Mutations via `use-task-mutations.ts` → tRPC `task.create` / `task.update`

Router: `src/server/api/routers/task.ts` — Zod validates `weight` 1–3; auto-assigns `sortOrder` on create.

Suggestion card: `task-suggestion-card.tsx` shows `workType` + `weight` badges.

### S-23 expander ↔ scorer

Five factors today (`override_preference`, `interruptions`, `late_day`, `fatigue`, `energy_deep`/`energy_light`) — all derived from session context + `workType`; `weight` only appears as `base` in magnitude math.

F-05 must add task-attribute factors (e.g. `eisenhower_fit`, `importance`, `low_effort`, `horizon_asap`) in `getFactorContributions()` and extend `RationaleKey` + chip labels.

### Guest / localStorage

`src/lib/guest/schema.ts` — `guestTaskSchema` mirrors `workType`, `weight`, optional `sortOrder`. Merge via `import-guest-snapshot.ts` copies all three.

New fields must land in guest schema + `guest-repositories.ts` + merge import in same slice (L-01 pattern: never split guest/server attribute parity).

### Test coverage map

Strong unit coverage on scorer + suggestion API. Extend:
- `score-task.test.ts` — v2 matrix cases per energy + attribute combos
- `dominant-factor.test.ts` — new factor keys
- `suggestion.test.ts` — breakdown includes new chips when dominant
- `task-mutation.test.ts`, `guest.test.ts` — CRUD + merge
- `task-list.test.tsx` — new pickers smoke

No e2e belt case required for foundation CRUD unless plan adds one; Vitest sufficient per test-plan risk mapping.

## Code References

- `prisma/schema.prisma:56-77` — Task model
- `src/lib/scoring/score-task.ts:11-93` — Scorer v1
- `src/lib/scoring/dominant-factor.ts:4-75` — Factor contributions
- `src/server/api/routers/suggestion.ts:57-279` — API integration
- `src/server/api/routers/task.ts:25-134` — Task CRUD
- `src/app/_components/task-list.tsx:31-518` — UI controls
- `src/lib/guest/schema.ts:7-18` — Guest task shape
- `prisma/migrations/20260609060315_task_sort_order/migration.sql` — Backfill pattern

## Architecture Insights

1. **Single scorer module** — all v2 logic stays in `src/lib/scoring/`; routers only map DB → `ScoringTask`.
2. **Legacy `weight` column** — keep during v1→v2 transition; do not drop in F-05. Read path prefers `urgency`; write path syncs both or writes urgency-only with weight mirror for rollback.
3. **Guest parity** — schema + repositories + merge must ship together (lessons L-04: verify each interactive surface).
4. **S-23 refresh is in-scope** — roadmap lists factor breakdown update; plan should include rationale key + chip additions, not defer to follow-up.
5. **Commitment horizon** — new Prisma enum (`ASAP`, `THIS_WEEK`, `WHEN_POSSIBLE`) with default `WHEN_POSSIBLE`.

## Historical Context

- `context/archive/2026-05-30-task-attributes-for-scoring/` — S-04 introduced `workType` + `weight`
- `context/archive/2026-06-09-task-manual-priority-order/` — S-26 `sortOrder` migration + optimistic reorder pattern
- `context/archive/2026-06-10-suggestion-rationale-expander/` — S-23 expander; Eisenhower factors explicitly deferred to F-05
- Roadmap F-05 section + batch-3 promote notes — scorer v2 unlocks S-27

## Related Research

- `context/archive/2026-06-07-adaptive-task-suggestion/research.md` — original scorer v1
- `context/archive/2026-06-10-suggestion-rationale-expander/research.md` — expander factor model

## Open Questions

| Item | Status | Notes |
|------|--------|-------|
| Exact v2 coefficient values | Plan phase | Calibrate in plan with worked examples + unit tests as oracle |
| Show effort/horizon on suggestion card badges | Plan phase | Default: show horizon when ASAP; effort only in expander |
| Drop `weight` column | Out of scope | Post-F-05 + S-23 stable |
