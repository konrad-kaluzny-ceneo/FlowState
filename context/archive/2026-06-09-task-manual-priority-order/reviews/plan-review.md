<!-- PLAN-REVIEW-REPORT -->
# Plan Review: S-26 Manual Task Priority Order

- **Plan**: `context/changes/task-manual-priority-order/plan.md`
- **Mode**: Deep
- **Date**: 2026-06-09
- **Verdict**: SOUND
- **Findings**: 1 critical (fixed), 4 warnings (fixed), 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | PASS |

## Grounding

Grounding: 10/10 paths ✓, 4/4 symbols ✓ (`pickBestTask`, `appendTask`, `ScoringTask`, `cycleLocked`), brief↔plan ✓

## Auto-Triage Log

| Finding | Severity | Action |
|---------|----------|--------|
| F1 — Revert-to-active sortOrder missing from phases | ❌ CRITICAL | Fixed in plan.md Phase 2 + integration test contract |
| F2 — Domain task mappers omitted from Phase 1 | ⚠️ WARNING | Fixed — added `server-repositories.ts`, `use-domain-tasks.ts`, `guest-repositories.ts` mappers |
| F3 — `TaskRepository` interface missing `reorder` | ⚠️ WARNING | Fixed — added to Phase 4 `types.ts` contract |
| F4 — Optimistic create row lacks `sortOrder` | ⚠️ WARNING | Fixed — added `buildOptimisticCreateRow` tail rule in Phase 4 |
| F5 — Guest `list()` / revert sortOrder gaps | ⚠️ WARNING | Fixed — guest repo sorts by `sortOrder`; revert assigns tail |
| F6 — Prisma backfill SQL may need custom step | 💡 OBSERVATION | Accepted — already documented in Critical Implementation Details |

## Findings

### F1 — Revert-to-active sortOrder missing from phases

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: End-State Alignment
- **Location**: Critical Implementation Details vs Phase 2
- **Detail**: Plan promises "Revert-to-active appends at `max + 1`" but Phase 2 only covered `task.create` tail assignment — no `task.update` path when `status` changes from completed to active. Without it, reverted tasks retain stale indices and break manual list order.
- **Fix**: Add Phase 2 `task.update` contract + integration test case for revert tail assignment.
- **Decision**: FIXED — applied to plan.md

### F2 — Domain task mappers omitted from Phase 1

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — Domain and guest types
- **Detail**: Adding `sortOrder` to `DomainTask` alone leaves three mappers (`server-repositories.ts`, `use-domain-tasks.ts`, `guest-repositories.ts`) unspecified — dual data-mode parity would rely on typecheck discovery rather than explicit guidance.
- **Fix**: List all three mapper files in Phase 1 with spread/map contracts.
- **Decision**: FIXED — applied to plan.md

### F3 — TaskRepository interface missing reorder

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 4 — Guest repository reorder
- **Detail**: Phase 4 adds `taskRepo.reorder` for guest mode but `TaskRepository` in `types.ts` had no `reorder` method — established dual data-mode pattern requires interface + both implementations.
- **Fix**: Add `reorder(input: { orderedIds: DomainTaskId[] })` to `TaskRepository`.
- **Decision**: FIXED — applied to plan.md

### F4 — Optimistic create row lacks sortOrder

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 4 — use-task-mutations.ts
- **Detail**: `buildOptimisticCreateRow` appends without `sortOrder`; once the field exists on list rows, optimistic creates would mismatch server tail assignment until `onSuccess`.
- **Fix**: Assign tail `sortOrder` in `buildOptimisticCreateRow` from cached active max.
- **Decision**: FIXED — applied to plan.md

### F5 — Guest list() / revert sortOrder gaps

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 4 — guest-repositories.ts
- **Detail**: Guest `list()` returned snapshot array order; server uses `orderBy sortOrder`. Guest `update` on revert-to-active had no tail assignment mirroring server.
- **Fix**: Sort guest list by `sortOrder asc`; assign tail on revert in guest `update`.
- **Decision**: FIXED — applied to plan.md

### F6 — Prisma backfill SQL may need custom step

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1 — Migration and backfill
- **Detail**: Prisma-generated migration may not include per-user `createdAt`-ordered backfill; plan already flags implementer verification post-`migrate dev`.
- **Fix**: None — existing Critical Implementation Details and Phase 1 note are sufficient.
- **Decision**: ACCEPTED

## Post-Fix Assessment

All CRITICAL and WARNING findings were auto-applied to `plan.md`. Progress section format validated (5 phases, 1:1 Progress mapping, no stray checkboxes in phase bodies). Plan aligns with research, S-09 optimistic pattern, FR-021 tie-breaker scope, and codebase grounding. No open CRITICAL findings remain.

**Recommended next step**: `/10x-implement task-manual-priority-order phase 1`
