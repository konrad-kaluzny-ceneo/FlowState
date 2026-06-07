# S-09 Optimistic Task Mutations — Implementation Plan

## Overview

Make authenticated task-list CRUD (create, edit, complete, revert, delete) feel as fast as guest local storage by patching the `api.task.list` TanStack Query cache in `onMutate`, rolling back on error, and reconciling with the server via `invalidate` on settle. Surface mutation failures in the task list so users never see silent data loss.

## Current State Analysis

From `context/changes/optimistic-task-mutations/research.md`:

- **Read path:** `AuthenticatedPomodoroDashboard` loads tasks via `api.task.list.useSuspenseQuery()` and passes them to `TaskList` as props (`pomodoro-dashboard.tsx:185-200`).
- **Write path:** `TaskList` calls `useRepositories().tasks` (vanilla tRPC client via `createServerTaskRepository`), then `await onRefresh()` which runs `utils.task.list.invalidate()` — UI waits for mutation HTTP + refetch (`task-list.tsx:151-193, 288-445`).
- **Guest contrast:** synchronous `mutateSnapshot` + `useSyncExternalStore` — instant, no invalidation.
- **No existing optimism:** zero `onMutate` / `setQueryData` / `cancelQueries` usage anywhere in the codebase.
- **Errors:** task-list mutations fail silently today; cycle errors use `pomodoro-error` alert in `PomodoroDashboardBody`.

### Key Discoveries:

- Single cache key for authenticated task list: `utils.task.list` (same key the suspense query reads).
- `task.create` returns the full row; `task.update` and `task.delete` return `void` — optimistic layer must apply patches locally (`task.ts:22-73`).
- Repository abstraction (S-08) keeps guest/server parity but bypasses `useMutation` lifecycle — optimism belongs in a new hook layer, not inside `createServerTaskRepository`.
- Mid-cycle "Mark complete" delegates to `onMidCycleMarkComplete` when `canMidCycleMarkComplete` — out of scope (cycle hook path).
- `TaskList` `isPending` blocks all CRUD buttons during network round-trip; guest path blocks unnecessarily on sync writes.

## Desired End State

While logged in, every direct task-list action (add, save edit, mark complete, revert to active, delete) updates the visible list immediately (<200ms perceived acknowledgement). On server failure, the list rolls back to the pre-mutation snapshot and shows a dismissible error banner. On success or failure, `utils.task.list.invalidate()` on settle keeps cache aligned with Postgres. Guest mode behavior unchanged.

### Verification

- Unit tests assert `cancel`, `setData`, rollback, and `invalidate` for all five mutation paths.
- Manual: add/complete/delete tasks in authenticated dashboard with network throttling — UI moves before response; forced 500 restores prior list + error message.
- `pnpm test`, `pnpm typecheck`, `pnpm check` pass; existing e2e specs remain green.

## What We're NOT Doing

- Optimistic updates for cycle mutations (`cycle.create`, `cycle.complete`, `cycle.interrupt`).
- Optimistic task status via `markTaskDone` in cycle-complete overlay.
- Mid-cycle task switch / rebind optimistic paths in `use-pomodoro-cycle.ts`.
- Changing `task.update` router to return the updated row.
- Removing the repository layer or refactoring guest storage.
- E2E tests with delayed tRPC routes (stretch — manual verification covers latency UX).

## Implementation Approach

Add **`useTaskMutations`** at `src/hooks/use-task-mutations.ts` — a mode-aware hook that:

1. **Authenticated:** registers `api.task.create` / `api.task.update` / `api.task.delete` via `useMutation` with shared helpers for `utils.task.list.cancel()` → snapshot previous list via `getData()` → `setData(updater)` patch → rollback on `onError` → `utils.task.list.invalidate()` on `onSettled`.
2. **Guest:** delegates to `useRepositories().tasks` (existing sync path); no cache operations.
3. Exposes imperative methods (`createTask`, `updateTask`, `deleteTask`), aggregated `isMutating`, and local `error` / `clearError` for task-list error UX.

Wire **`TaskList`** to call hook methods instead of `taskRepo` + `await onRefresh()` for the five in-scope CRUD paths. Keep `onRefresh` prop for parent compatibility (cycle invalidation elsewhere); TaskList stops awaiting it after mutations.

**Temp ID for create:** negative integer (`-Date.now()`) — compatible with `DomainTaskId` and server numeric IDs; replace optimistic row with server row in `onSuccess`.

**Error display:** task-list-local alert (`data-testid="task-list-error"`, `role="alert"`) matching `pomodoro-error` styling — scoped to task CRUD failures without coupling to cycle error state.

## Critical Implementation Details

**Rules of hooks:** `useMutation` hooks must always be registered. Guest CRUD bypasses them inside wrapper functions (`createTask`, etc.) that call the repository directly when `mode === "guest"`.

**Create reconciliation:** On `onSuccess`, replace the temp-ID row in cache with the server-returned task (match by temp id or title+timestamp fallback). Do not append a duplicate.

**Optimistic create row shape:** Temp row must satisfy `RouterOutputs["task"]["list"][number]` — copy `userId` from an existing cached row (or first list item); set `status: "active"`, `createdAt`/`updatedAt` to `new Date()`, and input `workType`/`weight` with Prisma defaults as fallback.

**Temp-ID guard:** While `id` is a negative number (create in flight), reject or no-op `updateTask`/`deleteTask` server calls — optimistic-only or disabled UI — to avoid `NOT_FOUND` against Postgres.

**Imperative API:** `createTask` / `updateTask` / `deleteTask` use `mutateAsync` so existing `TaskList` async handlers can `await` completion without reintroducing `onRefresh`.

**Mid-cycle guard:** When `canMidCycleMarkComplete` is true, `TaskList` already routes to `onMidCycleMarkComplete` — do not route that click through `useTaskMutations.updateTask`; cycle hook invalidation remains unchanged.

## Phase 1: Optimistic mutation hook

### Overview

Implement `useTaskMutations` with TanStack Query optimistic lifecycle for all five authenticated CRUD operations and unit tests that mock `api.useUtils()` cache helpers.

### Changes Required:

#### 1. Task list cache helpers

**File**: `src/hooks/use-task-mutations.ts` (new)

**Intent**: Centralize optimistic patch logic so create/update/delete/revert share one `cancel()` + snapshot + `setData()` pattern.

**Contract**: Internal helpers (not exported unless tests need them) that operate on `utils.task.list.getData()` / `setData(updater)` where list items match `RouterOutputs["task"]["list"][number]`. Create appends a temp row (see Critical Implementation Details); update merges input fields by `id`; delete filters by `id`. Export type alias `TaskListData = RouterOutputs["task"]["list"]` if tests require it.

#### 2. useTaskMutations hook

**File**: `src/hooks/use-task-mutations.ts`

**Intent**: Provide the authenticated optimistic mutation surface and guest repository delegation from one hook consumed by `TaskList`.

**Contract**: Export `useTaskMutations()` returning:

- `createTask(input)` — optimistic append with temp negative id; `onSuccess` swaps to server row
- `updateTask(input)` — optimistic merge (title/workType/weight/status)
- `deleteTask({ id })` — optimistic filter
- `isMutating: boolean` — aggregate pending state across the three mutations
- `error: string | null`, `clearError(): void` — set on mutation `onError` with user-readable message (tRPC `NOT_FOUND` → "Task not found"; generic fallback otherwise)

Each authenticated mutation: `onMutate` awaits `utils.task.list.cancel()`, saves `previousTasks` from `getData()`, patches via `setData`; `onError` restores `previousTasks` with `setData(() => previousTasks)` and sets error; `onSettled` calls `void utils.task.list.invalidate()`.

Guest branch: call `taskRepo.create/update/delete` directly (no cache ops, no error swallowing).

#### 3. Unit tests

**File**: `src/hooks/use-task-mutations.test.tsx` (new)

**Intent**: Lock optimistic behavior before UI wiring — the primary regression guard for this slice.

**Contract**: Mock `~/trpc/react` (`api.useUtils` with `task.list.setData`, `getData`, `cancel`, `invalidate`; `api.task.*.useMutation`) and `~/lib/data-mode/data-mode-context` (`useDataMode`, `useRepositories`). Tests (authenticated mode):

- Create: `setData` called with appended task before mutate resolves; `invalidate` on settle
- Update (edit + status): cache row patched optimistically
- Delete: row removed optimistically
- Error: `setData` restores snapshot; error string exposed
- Guest mode: repository called; no `setData` / `cancel`

Follow `use-pomodoro-cycle.test.tsx` mock + `QueryClientProvider` wrapper pattern.

### Success Criteria:

#### Automated Verification:

- `pnpm test src/hooks/use-task-mutations.test.tsx` passes
- `pnpm typecheck` passes
- `pnpm check` passes

#### Manual Verification:

- Hook file exports compile; no UI changes yet (expected — integration is Phase 2)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: TaskList integration and error UX

### Overview

Replace pessimistic repository + `onRefresh` pattern in `TaskList` with `useTaskMutations`; add task-list error banner; narrow `isPending` blocking to double-submit prevention via hook `isMutating`.

### Changes Required:

#### 1. TaskList mutation wiring

**File**: `src/app/_components/task-list.tsx`

**Intent**: Route all five in-scope CRUD handlers through `useTaskMutations` so authenticated users see immediate list updates from the suspense query cache.

**Contract**:

- Replace `useRepositories().tasks` CRUD calls with `createTask`, `updateTask`, `deleteTask` from `useTaskMutations()`.
- Remove `await onRefresh()` from: form submit (create), `saveEdit`, mark complete (non-mid-cycle path), revert to active, both delete buttons.
- Replace local `isPending` state with hook `isMutating` (or keep local state only if needed for edit blur race — prefer hook aggregate).
- Preserve mid-cycle branch: when `canMidCycleMarkComplete`, still call `onMidCycleMarkComplete` — do not call `updateTask`.
- Keep `onRefresh` in props signature unchanged (parent still passes it; unused by TaskList CRUD after this phase).

#### 2. Task-list error banner

**File**: `src/app/_components/task-list.tsx`

**Intent**: Surface mutation failures per roadmap "no silent loss" — distinct from cycle `pomodoro-error`.

**Contract**: When `error != null`, render dismissible alert at top of task list (`data-testid="task-list-error"`, `role="alert"`) with `clearError` dismiss button; styling aligned with `pomodoro-dashboard.tsx:63-77`.

#### 3. Authenticated dashboard refresh prop (optional noop)

**File**: `src/app/_components/pomodoro-dashboard.tsx`

**Intent**: Document that `refreshTasks` is no longer required for task-list CRUD; keep prop for API stability.

**Contract**: No functional change required unless implementer wants inline comment on `refreshTasks` — do not remove prop (cycle paths and future callers may still use it).

### Success Criteria:

#### Automated Verification:

- `pnpm test` passes (full suite)
- `pnpm typecheck` passes
- `pnpm check` passes

#### Manual Verification:

- Logged in: add task appears in Active list immediately (before network completes)
- Edit title/workType/weight saves instantly in list
- Mark complete moves row to Completed section instantly
- Revert to active moves row back instantly
- Delete removes row instantly
- Guest mode: all CRUD still works (no regression; no cache rollback or error banner required)
- Simulate authenticated mutation failure (devtools offline or blocked request): list rolls back; `task-list-error` visible

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Regression and acceptance

### Overview

Run full automated gates and complete manual acceptance against NFR 200ms acknowledgement and FR-004–FR-008 task-list behaviors.

### Changes Required:

#### 1. No code changes expected

**Intent**: Verification-only phase unless Phase 2 manual testing reveals gaps.

**Contract**: Fix-only diffs if e2e or unit regressions found; do not expand scope to cycle optimism.

### Success Criteria:

#### Automated Verification:

- `pnpm test` passes
- `pnpm test:e2e` passes
- `pnpm typecheck` passes
- `pnpm check` passes

#### Manual Verification:

- Throttled network (Slow 3G): task add + complete feel instant; no multi-second button lockout
- Error dismiss clears banner; retry after error succeeds
- Focus/highlight/suggestion flows unchanged (no stale task ids after create reconcile)
- Mid-cycle mark complete (overlay path) still works — uses cycle hook, not optimistic task hook

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- `use-task-mutations.test.tsx` — optimistic patch, rollback, invalidate, guest delegation (Phase 1)
- Existing router tests unchanged (`task.test.ts`, `task-mutation.test.ts`)

### Integration Tests:

- None required beyond hook tests; TaskList is thin wiring

### Manual Testing Steps:

1. Sign in, open dashboard, add task — verify instant appearance
2. Edit task inline — verify instant update
3. Complete and revert — verify section moves without refetch flash
4. Delete from active and completed — verify instant removal
5. Block `/api/trpc` task mutation — verify rollback + error banner
6. Guest incognito — verify CRUD unchanged

## Performance Considerations

Optimistic patches avoid an extra refetch round-trip on the hot path; `invalidate` on settle runs in background for reconciliation. `utils.task.list.cancel()` on `onMutate` prevents stale refetch from overwriting optimistic state mid-flight. No change to 30s staleTime default.

## Migration Notes

No schema or data migration. Deploy is client-only; rollback is revert PR — pessimistic invalidate path restores prior behavior.

## References

- Related research: `context/changes/optimistic-task-mutations/research.md`
- Guest instant-write pattern: `context/archive/2026-05-29-guest-local-storage-merge/plan.md`
- Task router: `src/server/api/routers/task.ts`
- TaskList CRUD: `src/app/_components/task-list.tsx`
- Authenticated read + invalidate: `src/app/_components/pomodoro-dashboard.tsx:184-201`
- Cycle error UX pattern: `src/app/_components/pomodoro-dashboard.tsx:63-77`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Optimistic mutation hook

#### Automated

- [x] 1.1 `pnpm test src/hooks/use-task-mutations.test.tsx` passes
- [x] 1.2 `pnpm typecheck` passes
- [x] 1.3 `pnpm check` passes

#### Manual

- [ ] 1.4 Hook exports compile; no UI changes yet (expected — integration is Phase 2)

### Phase 2: TaskList integration and error UX

#### Automated

- [ ] 2.1 `pnpm test` passes (full suite)
- [ ] 2.2 `pnpm typecheck` passes
- [ ] 2.3 `pnpm check` passes

#### Manual

- [ ] 2.4 Logged-in CRUD (add, edit, complete, revert, delete) updates list immediately
- [ ] 2.5 Guest mode CRUD unchanged (no cache rollback); auth mutation failure shows rollback + `task-list-error`

### Phase 3: Regression and acceptance

#### Automated

- [ ] 3.1 `pnpm test` passes
- [ ] 3.2 `pnpm test:e2e` passes
- [ ] 3.3 `pnpm typecheck` passes
- [ ] 3.4 `pnpm check` passes

#### Manual

- [ ] 3.5 Throttled network: instant task actions, no prolonged button lockout
- [ ] 3.6 Mid-cycle and focus/suggestion flows unchanged after optimistic create reconcile
