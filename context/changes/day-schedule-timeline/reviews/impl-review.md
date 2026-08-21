<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: S-54 Day Schedule Timeline

- **Plan**: context/changes/day-schedule-timeline/plan.md
- **Scope**: Phases 1–5 of 5
- **Date**: 2026-08-19
- **Verdict**: NEEDS ATTENTION → findings fixed in triage
- **Findings**: 0 critical 5 warnings 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING (F4 documented) |
| Scope Discipline | PASS |
| Safety & Quality | WARNING (F1–F3, F7–F8 addressed) |
| Architecture | PASS |
| Pattern Consistency | WARNING (F5–F6 addressed) |
| Success Criteria | PASS |

## Findings

### F1 — Concurrent overlap possible under Read Committed

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Safety & Quality
- **Location**: src/server/api/lib/schedule-blocks.ts
- **Detail**: Txn re-read alone is insufficient under Read Committed for empty-day races.
- **Fix A ⭐ Recommended**: Per-(userId, localDateKey) `pg_advisory_xact_lock` (seed 1) on create/update.
- **Decision**: FIXED via Fix A

### F2 — Unbounded batch taskIds array

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/server/api/routers/day-plan.ts
- **Detail**: No `.max()` on taskIds; N+1 attachable checks.
- **Fix**: Cap at `MAX_BATCH_TASKS_PER_BLOCK` (50) + bulk `findMany` ownership/status check.
- **Decision**: FIXED

### F3 — Edit-panel save is two sequential mutations

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/app/_components/schedule-block-edit-panel.tsx
- **Detail**: updateBlock then setFocus/setBatch could partially persist.
- **Fix A ⭐ Recommended**: Atomic save — extended `updateBlock` to accept optional `focusTaskId` / `batchTaskIds` in the same transaction; panel uses one call.
- **Decision**: FIXED via Fix A (atomic updateBlock attachments)

### F4 — Empty-slot create is double-click, not click

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/app/_components/day-schedule-timeline.tsx
- **Detail**: Plan said click; impl uses double-click + Add button.
- **Fix A ⭐ Recommended**: Document double-click in the plan as an addendum.
- **Decision**: FIXED via Fix A (plan addendum + Desired End State wording)

### F5 — Optimistic focus attach keeps stale task title

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/hooks/use-day-schedule.ts
- **Detail**: onMutate reused prior focusTask when switching task ids.
- **Fix**: Clear focusTask unless the optimistic id matches the prior summary.
- **Decision**: FIXED

### F6 — Isolation tests omit attachment mutator IDOR cases

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/server/api/routers/day-plan-schedule-isolation.test.ts
- **Detail**: setBlockFocusTask / setBlockBatchTasks / updateBlock+focus not covered for foreign blockId.
- **Fix**: Added NOT_FOUND cases for attachment mutators.
- **Decision**: FIXED

### F7 — metaLabel only trims; tags strip control chars

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/server/api/lib/schedule-blocks.ts
- **Detail**: metaLabel lacked control-char sanitize used by tags.
- **Fix**: `normalizeMetaLabel` now uses `sanitizeContextLabel`.
- **Decision**: FIXED

### F8 — Context-tag 50-cap soft under concurrency

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/server/api/lib/schedule-blocks.ts
- **Detail**: Count-then-insert race on tag create.
- **Fix**: `pg_advisory_xact_lock(hashtextextended(userId, 2))` before count in createContextTag.
- **Decision**: FIXED
