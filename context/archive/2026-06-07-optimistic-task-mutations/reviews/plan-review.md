<!-- PLAN-REVIEW-REPORT -->
# Plan Review: S-09 Optimistic Task Mutations

- **Plan**: context/changes/optimistic-task-mutations/plan.md
- **Mode**: Deep
- **Date**: 2026-06-07
- **Verdict**: SOUND
- **Findings**: 1 critical (fixed) · 5 warnings (fixed) · 1 observation (open)

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | PASS |

## Grounding

Grounding: 5/5 paths ✓ (4 existing + 1 planned new file), 3/3 symbols ✓ (`useRepositories`, `onRefresh`, `api.task.list`), brief↔plan ✓

Deep verification confirmed: no existing `onMutate`/`setData`/`cancel` usage; tRPC v11 utils expose `setData`/`getData`/`cancel` (not raw `setQueryData`/`cancelQueries`); `task.update`/`delete` return void; `DomainTaskId` accepts negative numbers; mid-cycle mark-complete branch exists at `task-list.tsx:283-286`.

## Findings

### F1 — Wrong TanStack cache API names for tRPC utils

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Implementation Approach, Phase 1 contracts, Verification, Performance
- **Detail**: Plan referenced raw TanStack Query helpers (`setQueryData`, `cancelQueries`). This codebase uses tRPC v11 `@trpc/react-query` utils — `utils.task.list.setData()`, `getData()`, `cancel()` wrap the underlying query client. Wrong names would block Phase 1 implementation or compile errors.
- **Fix**: Replace all cache helper references with tRPC utils API (`setData`, `getData`, `cancel`).
- **Decision**: FIXED — applied across plan.md

### F2 — Progress 2.5 conflates guest rollback with auth error UX

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Progress § Phase 2 Manual step 2.5; Phase 2 Manual Verification
- **Detail**: Step 2.5 implied guest mode shows cache rollback + `task-list-error`, contradicting "guest unchanged" scope — guest has no TanStack cache to roll back.
- **Fix**: Split auth vs guest acceptance — guest CRUD unchanged; rollback + banner auth-only.
- **Decision**: FIXED — updated Progress 2.5 and Phase 2 manual bullets

### F3 — Optimistic create row shape unspecified

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1 — Task list cache helpers
- **Detail**: Temp create row must satisfy full `task.list` output shape (`userId`, `status`, timestamps, etc.). Missing contract risks type errors or broken badges/sections on optimistic row.
- **Fix**: Document temp row fields in Critical Implementation Details; type as `RouterOutputs["task"]["list"][number]`.
- **Decision**: FIXED — added optimistic create row shape + type alias guidance

### F4 — Temp-ID tasks can be updated/deleted before create settles

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Critical Implementation Details
- **Detail**: Negative temp IDs are valid `DomainTaskId` values. If user completes/deletes/edits before `task.create` resolves, server receives invalid id → `NOT_FOUND`, triggering rollback UX on normal user action.
- **Fix**: Guard `updateTask`/`deleteTask` while `Number(id) < 0` — reject or disable UI until reconcile.
- **Decision**: FIXED — added temp-ID guard to Critical Implementation Details

### F5 — Unit test mock contract used wrong helper names

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — Unit tests
- **Detail**: Tests specified asserting `setQueryData` calls; mocks must target `utils.task.list.setData`, `getData`, `cancel` to match tRPC utils.
- **Fix**: Align test contract with tRPC utils mock surface.
- **Decision**: FIXED — updated Phase 1 test contract (bundled with F1)

### F6 — Imperative hook methods need `mutateAsync`

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Critical Implementation Details / useTaskMutations contract
- **Detail**: `TaskList` handlers are async and currently `await` repository calls. Hook wrappers using fire-and-forget `mutate` would break `try/finally` flow unless explicitly documented.
- **Fix**: Specify `createTask`/`updateTask`/`deleteTask` use `mutateAsync`.
- **Decision**: FIXED — added imperative API note to Critical Implementation Details

### F7 — Aggregate `isMutating` still blocks all CRUD buttons

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Lean Execution
- **Location**: Phase 2 — TaskList mutation wiring
- **Detail**: Replacing local `isPending` with hook-level `isMutating` keeps global button disable during any in-flight mutation. Acceptable for double-submit prevention; main latency win is removing `await onRefresh()`. Per-row pending is a future refinement if needed.
- **Fix**: None required for this slice — NFR satisfied by optimistic cache + no refetch wait.
- **Decision**: ACCEPTED — acceptable for S-09 scope

## Triage Summary

- **Fixed**: F1, F2, F3, F4, F5, F6 (6)
- **Accepted**: F7 (1)
- **Open CRITICAL**: 0
- **Verdict after fixes**: SOUND
- **Confidence**: 92% — architecture grounded in codebase; tRPC utils API verified via docs; remaining risk is create-reconcile edge cases under rapid multi-click (mitigated by temp-ID guard)
