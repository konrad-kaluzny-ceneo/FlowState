# S-26 Manual Task Priority Order — Implementation Plan

## Overview

Add persisted `sortOrder` on Task so users can drag-reorder **active** tasks in the task list. Manual order becomes a deterministic tie-breaker in `pickBestTask` when scorer scores tie — it does not override higher-scoring tasks (FR-021). Reorder updates use the S-09 optimistic TanStack cache pattern for sub-200ms perceived acknowledgement (NFR). Guest mode mirrors the same field in localStorage and preserves relative order on account merge (Risk #5).

## Current State Analysis

From `context/changes/task-manual-priority-order/research.md`:

- **No `sortOrder` today.** `task.list`, suggestion queries, and `pickBestTask` all implicitly order by `createdAt asc`.
- **S-09 pattern shipped.** `use-task-mutations.ts` patches `utils.task.list` in `onMutate`, rolls back on error, invalidates on settle — reorder must extend this hook, not invent a parallel cache path.
- **Task list UI.** `task-list.tsx` filters `activeTasks` / `completedTasks` from props; no client-side sort. `cycleLocked` disables delete/complete when `cycleState === "running" || "completed"`.
- **Scorer.** `pickBestTask` tie-break chain: score → weight → `createdAt`. No `sortOrder` on `ScoringTask`.
- **Guest merge.** `import-guest-snapshot.ts` copies title/status/workType/weight only; array order lost post-import because server list uses `createdAt`.
- **No DnD deps.** React 19.2.6; row has 5+ buttons — drag handle required either way.

### Key Discoveries:

- `src/server/api/routers/task.ts:7-12` — `list` orders `createdAt asc`; all mutations use `findFirst({ id, userId })` IDOR pattern.
- `src/hooks/use-task-mutations.ts:66-167` — optimistic helpers (`appendTask`, `patchTask`, `removeTask`) are the template for `reorderActiveTasks`.
- `src/lib/scoring/score-task.ts:68-85` — tie-break injection point is after score equality, before weight.
- `src/server/api/routers/suggestion.ts:147-172,214-237` — both kickoff and post-check-in load active tasks with `createdAt asc`.
- `src/lib/guest/schema.ts:7-17` — guest task shape needs `sortOrder`; Zod default from array index handles legacy snapshots.

## Desired End State

- User drags active tasks via a **drag handle**; list reorders instantly (<200ms) while logged in; order survives refresh.
- Reorder is **disabled** when `cycleLocked` or `isMutating` (mirrors delete/complete guards).
- Completed section is **unchanged** — no drag, no `sortOrder` maintenance on complete/revert in v1.
- When two tasks score equally, the one **higher in the manual list** (lower `sortOrder`) wins the suggestion.
- Guest: reorder works synchronously in localStorage; after sign-in merge, imported tasks keep their relative manual order after any existing account tasks.
- `pnpm test`, `pnpm check`, `pnpm typecheck`, and existing e2e remain green; new unit + one e2e spec cover reorder.

### Verification

- Integration: `task.reorder` validates permutation of caller's active IDs; cross-user ID → `NOT_FOUND`.
- Unit: `pickBestTask` prefers lower `sortOrder` on score tie; `useTaskMutations.reorderTasks` optimistic patch + rollback.
- E2e: authenticated drag persists after reload; guest merge preserves order (Risk #5 browser proof).

## What We're NOT Doing

- Reordering completed tasks (roadmap v1 — active only).
- Sparse `sortOrder` gaps — dense reindex `0..n-1` on every reorder.
- Full-row drag (handle only — avoids button click conflicts).
- Making manual order the primary ranking signal (tie-breaker only per FR-021).
- Optimistic cycle mutations (B-03 — separate slice).
- `@dnd-kit/react` vNext alpha — use stable `@dnd-kit/core` + `@dnd-kit/sortable`.
- Suggestion cache invalidation on reorder beyond standard `task.list` invalidate (accepted low-risk race per research).

## Implementation Approach

Bottom-up: schema → server API → scorer → optimistic hook → DnD UI → guest merge → acceptance.

1. Add `sortOrder Int NOT NULL` with per-user composite index; backfill existing rows by `createdAt asc` to preserve visible order on deploy.
2. Batch `task.reorder` mutation assigns dense indices in one `$transaction`; validate input is exact permutation of caller's **active** task IDs.
3. Extend `useTaskMutations` with `reorderTasks(orderedIds)` following S-09 lifecycle; guest branch calls `taskRepo.reorder` synchronously.
4. Wire `@dnd-kit` around active `<ul>` only; `onDragEnd` → optimistic reorder → mutation.
5. Inject `sortOrder` into scorer after score tie; update suggestion task queries.
6. Guest import: offset `sortOrder` by `max(existing) + 1`; merge preview sorts by `sortOrder`.

## Critical Implementation Details

**Backfill ordering:** Migration must assign `0..n-1` per `userId` ordered by `createdAt asc` so production lists look identical immediately after deploy. Use Prisma migration workflow (`pnpm db:migrate`); if generated SQL lacks backfill, add a follow-up data migration step in the same migration folder per team convention — never hand-write raw SQL outside Prisma migrate.

**Create assigns tail position:** `task.create` sets `sortOrder = max(active sortOrder for user) + 1` (or `0` when no active tasks). Guest `create` mirrors the same rule on the active subset.

**Complete/revert:** Marking complete does not recompact active `sortOrder` in v1 — gaps are harmless because list query orders active tasks only and reorder reindexes on next drag. Revert-to-active appends at `max + 1`.

**DnD + optimistic race:** `onDragEnd` fires after drop — call `reorderTasks` with the final ID order. Do not await network before updating cache; `onMutate` handles synchronous reorder.

## Phase 1: sortOrder schema and domain types

### Overview

Add `sortOrder` to Prisma Task, run migration with backfill, and extend shared domain/guest types so downstream layers compile.

### Changes Required:

#### 1. Prisma Task model

**File**: `prisma/schema.prisma`

**Intent**: Persist per-user manual priority among active tasks.

**Contract**: Add `sortOrder Int @default(0) @map("sort_order")` on `Task`. Add `@@index([userId, sortOrder], name: "task_user_sort_order_idx")`. No unique constraint.

#### 2. Migration and backfill

**File**: `prisma/migrations/<timestamp>_task_sort_order/` (generated)

**Intent**: Ship column safely on existing rows without reordering visible lists.

**Contract**: Run `pnpm db:migrate` with a descriptive name (e.g. `task_sort_order`). Ensure every existing row gets `sortOrder` `0..n-1` per `user_id` ordered by `createdAt asc`. Run `pnpm db:generate`.

#### 3. Domain and guest types

**File**: `src/lib/data-mode/types.ts`

**Intent**: Thread `sortOrder` through the dual data-mode abstraction.

**Contract**: Add `sortOrder: number` to `DomainTask`.

**File**: `src/lib/guest/schema.ts`

**Intent**: Persist guest manual order in `flowstate:guest-v1` snapshots.

**Contract**: Add `sortOrder: z.number().int().min(0)` to `guestTaskSchema`. On parse, default missing `sortOrder` from array index for legacy snapshots (no version bump).

#### 4. Domain task mappers

**File**: `src/lib/repositories/server-repositories.ts`

**Intent**: Thread `sortOrder` from tRPC list/create rows into `DomainTask`.

**Contract**: Add `sortOrder: number` to `TrpcTaskRow`; `toDomainTask` spreads it through (same pattern as other fields).

**File**: `src/lib/data-mode/use-domain-tasks.ts`

**Intent**: Guest hook path exposes `sortOrder` to `TaskList`.

**Contract**: Map `sortOrder` in `mapSnapshotToTasks()`.

**File**: `src/lib/repositories/guest-repositories.ts`

**Intent**: Guest repository `toDomainTask` includes `sortOrder`.

**Contract**: Extend local `toDomainTask` input/return with `sortOrder: number`.

### Success Criteria:

#### Automated Verification:

- `pnpm db:migrate` applies cleanly in dev
- `pnpm db:generate` succeeds
- `pnpm typecheck` passes
- `pnpm check` passes

#### Manual Verification:

- Prisma Studio or SQL spot-check: existing users have dense `sortOrder` matching prior `createdAt` order

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Server list, create, and reorder API

### Overview

Expose `sortOrder` through `task.list` and `task.create`; add batch `task.reorder` with per-user isolation and validation.

### Changes Required:

#### 1. task.list orderBy

**File**: `src/server/api/routers/task.ts`

**Intent**: Make server list order the single source of truth for UI display.

**Contract**: Change `list` `orderBy` to `[{ sortOrder: "asc" }, { createdAt: "asc" }]`.

#### 2. task.create sortOrder assignment

**File**: `src/server/api/routers/task.ts`

**Intent**: New tasks append at the bottom of the active manual list.

**Contract**: Before `create`, query `max(sortOrder)` where `userId` and `status: "active"`; set `sortOrder: (max ?? -1) + 1` on the new row.

#### 3. task.update revert sortOrder

**File**: `src/server/api/routers/task.ts`

**Intent**: Reverted completed tasks append at the tail of the active manual list (per Critical Implementation Details).

**Contract**: When `update` sets `status: "active"` on a previously completed task, assign `sortOrder: (max active sortOrder ?? -1) + 1` in the same write — do not reuse the stale pre-complete index.

#### 4. task.reorder mutation

**File**: `src/server/api/routers/task.ts`

**Intent**: Persist a full active-list reorder from DnD `onDragEnd`.

**Contract**:

```typescript
reorder: protectedProcedure
  .input(z.object({ orderedIds: z.array(z.number().int()).min(1) }))
  .mutation(...)
```

Steps: load caller's active tasks (`status: "active"`, `userId`); reject if `orderedIds` length ≠ active count or is not a permutation of those IDs (`TRPCError BAD_REQUEST`); `$transaction` updating each `{ id, userId }` with `sortOrder: index`. Return `void` (consistent with `update`/`delete`). Foreign or completed IDs → `NOT_FOUND` or `BAD_REQUEST` without leaking existence.

#### 5. Integration tests

**File**: `src/server/api/routers/task-mutation.test.ts`

**Intent**: Lock reorder semantics and IDOR posture (Risks #4, #6).

**Contract**: Add cases: owner reorders active tasks → list reflects new order; cross-user ID in `orderedIds` → `NOT_FOUND`; completed task ID in list → reject; non-permutation input → `BAD_REQUEST`; revert completed → active assigns tail `sortOrder`.

**File**: `src/server/api/routers/task-isolation.test.ts`

**Intent**: Prove user B's order unchanged after user A reorders.

**Contract**: Dual-user reorder; assert B's `sortOrder` values untouched.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/server/api/routers/task-mutation.test.ts` passes
- `pnpm exec vitest run src/server/api/routers/task-isolation.test.ts` passes
- `pnpm test` passes
- `pnpm typecheck` passes
- `pnpm check` passes

#### Manual Verification:

- tRPC caller or devtools: `task.reorder` on seeded active tasks updates `sortOrder` in DB

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Scorer tie-breaker and suggestion queries

### Overview

Wire `sortOrder` into `pickBestTask` as tie-breaker after score equality; update suggestion router task loads.

### Changes Required:

#### 1. ScoringTask and pickBestTask

**File**: `src/lib/scoring/score-task.ts`

**Intent**: Manual priority breaks scorer ties without overriding higher scores (FR-021).

**Contract**: Add `sortOrder: number` to `ScoringTask`. After score equality, compare `sortOrder asc` (lower = higher manual priority); then weight desc; then `createdAt asc`. Update `pickBestTask` comparator accordingly.

#### 2. Suggestion router task loads

**File**: `src/server/api/routers/suggestion.ts`

**Intent**: Pass `sortOrder` into scorer at kickoff and post-check-in entry points.

**Contract**: Change active-task queries at post-check-in (~147-172) and kickoff (~214-237) to `orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]`. Map `sortOrder` into `pickBestTask` input.

#### 3. Unit tests

**File**: `src/lib/scoring/score-task.test.ts`

**Intent**: Document and lock new tie-break chain.

**Contract**: Add test: equal scores, different `sortOrder` → lower `sortOrder` wins. Update existing weight/`createdAt` tie-break test if comparator order shifted. Extend `suggestion.test.ts` mocks if `orderBy` shape assertions exist.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/lib/scoring/score-task.test.ts` passes
- `pnpm exec vitest run src/server/api/routers/suggestion.test.ts` passes
- `pnpm test` passes
- `pnpm typecheck` passes
- `pnpm check` passes

#### Manual Verification:

- With two equal-score active tasks manually reordered, post-check-in suggestion prefers the higher-priority (lower `sortOrder`) task when scores tie

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Optimistic reorder hook and guest repository

### Overview

Extend `useTaskMutations` with S-09-style optimistic reorder; implement guest `taskRepo.reorder` for dual data-mode parity.

### Changes Required:

#### 1. Cache helper and mutation

**File**: `src/hooks/use-task-mutations.ts`

**Intent**: Give authenticated users instant reorder feedback before HTTP completes.

**Contract**:

- Add `reorderActiveTasks(list, orderedIds)` helper: reorder cached rows to match `orderedIds`, updating each row's `sortOrder` to its index.
- Register `api.task.reorder.useMutation` with `onMutate` → `cancel()` → snapshot → `setData(reorderActiveTasks)`; `onError` → restore snapshot + set error; `onSettled` → `void utils.task.list.invalidate()`.
- Export `reorderTasks({ orderedIds: number[] })` and include reorder pending in `isMutating`.
- Update `buildOptimisticCreateRow`: assign `sortOrder: (max active sortOrder in cache ?? -1) + 1` so optimistic append matches server tail rule before `onSuccess` replaces the temp row.

#### 2. TaskRepository interface and guest repository reorder

**File**: `src/lib/data-mode/types.ts`

**Intent**: Dual data-mode contract includes reorder for guest delegation.

**Contract**: Add `reorder(input: { orderedIds: DomainTaskId[] }): Promise<void>` to `TaskRepository`.

**File**: `src/lib/repositories/guest-repositories.ts`

**Intent**: Guest mode reorder without TanStack cache.

**Contract**: `list()` returns tasks sorted by `sortOrder asc` (then `createdAt asc`) — mirrors server `orderBy`. Add `reorder(orderedIds: DomainTaskId[])`: validate IDs are active tasks; assign dense `sortOrder`; persist via `mutateSnapshot`. `create` assigns `max(active sortOrder) + 1`. On `update` with `status: "active"` from completed, assign tail `sortOrder` (same rule as server `task.update`).

#### 3. Unit tests

**File**: `src/hooks/use-task-mutations.test.tsx`

**Intent**: Regression guard for optimistic reorder lifecycle.

**Contract**: Authenticated: `setData` reorders before resolve; error restores snapshot; `invalidate` on settle. Guest: repo `reorder` called; no cache ops.

**File**: `src/lib/repositories/guest-repositories.test.ts`

**Intent**: Guest create/reorder sortOrder rules.

**Contract**: Create appends at tail; reorder updates `sortOrder` and snapshot array order.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/hooks/use-task-mutations.test.tsx` passes
- `pnpm exec vitest run src/lib/repositories/guest-repositories.test.ts` passes
- `pnpm test` passes
- `pnpm typecheck` passes
- `pnpm check` passes

#### Manual Verification:

- Hook compiles; no UI yet (DnD is Phase 5)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 5: DnD UI, guest merge, and acceptance

### Overview

Install dnd-kit, wire sortable active list with drag handle, preserve guest order on merge, and run full gates including one new e2e spec.

### Changes Required:

#### 1. Dependencies

**File**: `package.json`

**Intent**: Add production DnD stack for React 19.

**Contract**: Add `@dnd-kit/core` and `@dnd-kit/sortable` (and `@dnd-kit/utilities` if required by sortable). Run `pnpm install`.

#### 2. Sortable active task list

**File**: `src/app/_components/task-list.tsx`

**Intent**: User-visible drag-reorder on active tasks only (FR-005 extension).

**Contract**:

- Wrap active `<ul>` in `DndContext` + `SortableContext` (`verticalListSortingStrategy`).
- Extract sortable row component with **drag handle** (`data-testid="task-drag-handle"`) — not full row.
- `PointerSensor` with `activationConstraint` (e.g. distance 8px) to avoid accidental drags.
- `onDragEnd`: if `over` and order changed, compute `orderedIds` from `arrayMove`, call `reorderTasks`.
- Disable DnD when `cycleLocked || isMutating` — handles inert, no drag start.
- Completed section: unchanged, no sortable wrapper.

#### 3. Guest merge sortOrder preservation

**File**: `src/server/api/lib/import-guest-snapshot.ts`

**Intent**: Preserve guest relative manual order on account merge (Risk #5).

**Contract**: Query `max(sortOrder)` for importing `userId`. Sort guest tasks by `sortOrder`. Create with `sortOrder: baseOffset + relativeIndex` where `baseOffset = (max ?? -1) + 1`.

**File**: `src/lib/guest/merge-copy.ts`

**Intent**: Merge preview reflects manual order.

**Contract**: `extractPreviewTaskTitles` sorts active tasks by `sortOrder` (not `createdAt`).

#### 4. Guest merge integration tests

**File**: `src/server/api/routers/guest.test.ts` (or colocated import tests)

**Intent**: Lock merge order preservation.

**Contract**: Import with pre-existing account tasks offsets guest order; relative order among guest tasks preserved.

#### 5. E2E spec

**File**: `e2e/task-reorder.spec.ts` (new)

**Intent**: Browser proof for new drag surface and persistence (test-plan §6.3 pattern).

**Contract**:

- Auth: add 3 tasks, drag handle moves middle task to top (`data-testid="task-drag-handle"`), assert row order in DOM, `page.reload()`, assert order persists.
- Guest (optional second test or same file): reorder in guest mode, sign in with merge, assert imported order relative to pre-existing tasks.

Model on `e2e/seed.spec.ts` — fixture auth, `addTask` helper, deliberate-break VERIFY entry in `e2e/DELIBERATE-BREAK.md` before merge.

**Note**: Playwright drag may use `locator.dragTo` or dnd-kit-compatible pointer events; prefer stable `data-testid` on handles and task rows.

### Success Criteria:

#### Automated Verification:

- `pnpm test` passes
- `set CI=true && pnpm test:e2e e2e/task-reorder.spec.ts` passes
- `set CI=true && pnpm test:e2e` passes (full suite)
- `pnpm typecheck` passes
- `pnpm check` passes

#### Manual Verification:

- Drag handle reorders active list instantly while logged in (<200ms perceived)
- Reorder disabled during running/completed cycle overlay
- Refresh preserves order; guest reorder survives page reload
- Guest merge: reordered guest tasks appear after existing account tasks in same relative order
- Scorer tie-break: manually prioritized task wins suggestion when scores equal

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- `score-task.test.ts` — sortOrder tie-break after equal scores
- `use-task-mutations.test.tsx` — optimistic reorder, rollback, guest delegation
- `guest-repositories.test.ts` — create tail assignment, reorder persistence
- `task-mutation.test.ts` / `task-isolation.test.ts` — reorder validation, IDOR

### Integration Tests:

- `guest.test.ts` / import — sortOrder offset on merge
- `suggestion.test.ts` — orderBy + pickBestTask input includes sortOrder

### E2E:

- `e2e/task-reorder.spec.ts` — auth drag + reload persistence; guest merge order (Risk #5 browser proof)
- Full suite regression via `set CI=true && pnpm test:e2e`

### Manual Testing Steps:

1. Add 4 active tasks; drag bottom to top — instant UI update, no button mis-clicks on handle-only drag
2. Start work cycle — confirm drag handles disabled
3. Complete cycle overlay visible — confirm drag still disabled
4. End idle state — reorder works again
5. Two tasks with same workType/weight/context — reorder higher task, trigger suggestion on score tie — higher manual priority wins
6. Guest: reorder, reload, sign in with existing account tasks — merged order correct

## Performance Considerations

- Reorder is O(n) dense reindex in one transaction — acceptable for MVP task counts (hundreds).
- Optimistic `setData` is synchronous — meets 200ms NFR without awaiting network.
- Composite index `[userId, sortOrder]` supports list query; no extra round-trips on drag.

## Migration Notes

- Deploy order: migration → API → client. Old clients without reorder UI still read correct order via backfilled `sortOrder`.
- Legacy guest snapshots without `sortOrder` parse with array-index defaults — no forced migration prompt.
- Rollback: revert app code; column can remain (harmless) or follow down-migration if needed before production deploy.

## References

- Research: `context/changes/task-manual-priority-order/research.md`
- S-09 optimistic pattern: `context/archive/2026-06-07-optimistic-task-mutations/plan.md`
- S-08 guest merge: `context/archive/2026-05-29-guest-local-storage-merge/plan.md`
- Roadmap S-26: `context/foundation/roadmap.md`
- Test-plan cookbook: `context/foundation/test-plan.md` §6.3, §6.5

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: sortOrder schema and domain types

#### Automated

- [x] 1.1 `pnpm db:migrate` applies cleanly in dev — 12297f1
- [x] 1.2 `pnpm db:generate` succeeds — 12297f1
- [x] 1.3 `pnpm typecheck` passes — 12297f1
- [x] 1.4 `pnpm check` passes — 12297f1

#### Manual

- [ ] 1.5 Prisma Studio or SQL spot-check: existing users have dense `sortOrder` matching prior `createdAt` order

### Phase 2: Server list, create, and reorder API

#### Automated

- [x] 2.1 `pnpm exec vitest run src/server/api/routers/task-mutation.test.ts` passes — 4d8d507
- [x] 2.2 `pnpm exec vitest run src/server/api/routers/task-isolation.test.ts` passes — 4d8d507
- [x] 2.3 `pnpm test` passes — 4d8d507
- [x] 2.4 `pnpm typecheck` passes — 4d8d507
- [x] 2.5 `pnpm check` passes — 4d8d507

#### Manual

- [ ] 2.6 tRPC caller or devtools: `task.reorder` on seeded active tasks updates `sortOrder` in DB

### Phase 3: Scorer tie-breaker and suggestion queries

#### Automated

- [x] 3.1 `pnpm exec vitest run src/lib/scoring/score-task.test.ts` passes — 6d8d7b6
- [x] 3.2 `pnpm exec vitest run src/server/api/routers/suggestion.test.ts` passes — 6d8d7b6
- [x] 3.3 `pnpm test` passes — 6d8d7b6
- [x] 3.4 `pnpm typecheck` passes — 6d8d7b6
- [x] 3.5 `pnpm check` passes — 6d8d7b6

#### Manual

- [ ] 3.6 With two equal-score active tasks manually reordered, post-check-in suggestion prefers the higher-priority (lower `sortOrder`) task when scores tie

### Phase 4: Optimistic reorder hook and guest repository

#### Automated

- [x] 4.1 `pnpm exec vitest run src/hooks/use-task-mutations.test.tsx` passes — c6de8f5
- [x] 4.2 `pnpm exec vitest run src/lib/repositories/guest-repositories.test.ts` passes — c6de8f5
- [x] 4.3 `pnpm test` passes — c6de8f5
- [x] 4.4 `pnpm typecheck` passes — c6de8f5
- [x] 4.5 `pnpm check` passes — c6de8f5

#### Manual

- [ ] 4.6 Hook compiles; no UI yet (DnD is Phase 5)

### Phase 5: DnD UI, guest merge, and acceptance

#### Automated

- [x] 5.1 `pnpm test` passes — 59f0488
- [x] 5.2 `set CI=true && pnpm test:e2e e2e/task-reorder.spec.ts` passes — 59f0488
- [x] 5.3 `set CI=true && pnpm test:e2e` passes (full suite) — 59f0488
- [x] 5.4 `pnpm typecheck` passes — 59f0488
- [x] 5.5 `pnpm check` passes — 59f0488

#### Manual

- [ ] 5.6 Drag handle reorders active list instantly while logged in (<200ms perceived)
- [ ] 5.7 Reorder disabled during running/completed cycle overlay
- [ ] 5.8 Refresh preserves order; guest reorder survives page reload
- [ ] 5.9 Guest merge: reordered guest tasks appear after existing account tasks in same relative order
- [ ] 5.10 Scorer tie-break: manually prioritized task wins suggestion when scores equal
