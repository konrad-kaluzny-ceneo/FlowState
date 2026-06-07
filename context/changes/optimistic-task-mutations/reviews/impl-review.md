<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: S-09 Optimistic Task Mutations

- **Plan**: context/changes/optimistic-task-mutations/plan.md
- **Scope**: Phases 1–3 (all completed automated gates)
- **Date**: 2026-06-07
- **Verdict**: APPROVED
- **Findings**: 1 critical (fixed) · 2 warnings · 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Failed create on empty list skips rollback

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/hooks/use-task-mutations.ts:109-115
- **Detail**: `handleError` gated rollback on `context?.previousTasks !== undefined`. When the task list cache was empty (`getData()` returns `undefined`), a failed create left the optimistic row in cache — violating the plan's "rolls back to pre-mutation snapshot" requirement and causing silent phantom tasks.
- **Fix**: Roll back whenever `context` exists: `setData(undefined, () => context.previousTasks)` (including when `previousTasks` is `undefined`).
- **Decision**: FIXED — applied in review; regression test added (`restores empty cache on failed create`).

### F2 — E2E helper changes outside plan file list

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: e2e/helpers/work-cycle.ts
- **Detail**: `waitForTaskCreateSettled` waits for the Add button to leave "Adding..." state. Not listed in plan Changes Required but necessary after optimistic create + `isCreating` button label; prevents e2e races when focusing newly added tasks.
- **Fix**: Document as plan addendum or accept as Phase 3 fix-only diff (already committed in c255282).
- **Decision**: ACCEPTED — justified regression fix; no functional scope expansion.

### F3 — Manual acceptance items still pending in Progress

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: plan.md Progress §1.4, §2.4–2.5, §3.5–3.6
- **Detail**: All manual verification checkboxes remain `[ ]`. Automated gates (including e2e) pass; throttled-network UX and guest/auth error UX not recorded as human-verified.
- **Fix**: Human completes manual checklist before ship; no code change required.
- **Decision**: PENDING — expected at impl-review stage.

### F4 — Temp ID strategy differs from plan text

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/hooks/use-task-mutations.ts:40-45
- **Detail**: Plan specified `-Date.now()`; implementation uses monotonic decrementing negative integers. Both satisfy `DomainTaskId`, temp-ID guard, and reconcile-on-success — behavior matches intent.
- **Fix**: None required; optional plan addendum for accuracy.
- **Decision**: SKIPPED

### F5 — Extra `isCreating` export beyond plan contract

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/hooks/use-task-mutations.ts:224; src/app/_components/task-list.tsx:218
- **Detail**: Hook exports `isCreating` in addition to documented `isMutating`. Used to disable only the Add button during create while other actions remain available — reasonable UX refinement.
- **Fix**: None required.
- **Decision**: SKIPPED

## Automated verification (review run)

| Command | Result |
|---------|--------|
| `pnpm test` | PASS — 43 files, 256 tests |
| `E2E_WORKERS=1 pnpm test:e2e` | PASS — 19 tests |

## Implementation match summary

| Planned artifact | Status |
|------------------|--------|
| `src/hooks/use-task-mutations.ts` | MATCH — optimistic lifecycle, guest delegation, error UX |
| `src/hooks/use-task-mutations.test.tsx` | MATCH — create/update/delete/rollback/guest/temp-id tests |
| `src/app/_components/task-list.tsx` | MATCH — hook wiring, error banner, mid-cycle guard preserved |
| Scope exclusions (cycle optimism, router return shape) | RESPECTED |
