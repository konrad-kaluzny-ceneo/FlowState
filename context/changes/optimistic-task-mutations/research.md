---
date: 2026-06-07T12:00:00+02:00
researcher: Cursor Agent (Auto)
git_commit: 8c732be49d9bed0ce5e2af7ea37a4fc56761c4b6
branch: main
repository: FlowState
topic: "S-09 optimistic task mutations — authenticated TanStack Query cache updates"
tags: [research, codebase, task-crud, tanstack-query, trpc, optimistic-updates, guest-storage, s-09]
status: complete
last_updated: 2026-06-07
last_updated_by: Cursor Agent (Auto)
---

# Research: S-09 optimistic task mutations — authenticated TanStack Query cache updates

**Date**: 2026-06-07T12:00:00+02:00  
**Researcher**: Cursor Agent (Auto)  
**Git Commit**: `8c732be49d9bed0ce5e2af7ea37a4fc56761c4b6`  
**Branch**: `main`  
**Repository**: [konrad-kaluzny-ceneo/FlowState](https://github.com/konrad-kaluzny-ceneo/FlowState)

## Research Question

For roadmap slice **S-09** (`optimistic-task-mutations`):

1. How does task CRUD work today (tRPC + TanStack Query)? Find task-list, mutations, query keys, cache invalidation patterns.
2. How does guest local storage achieve instant UI (S-08 archived) — contrast with authenticated path?
3. What mutations need optimistic updates (create, update, delete, status toggle, complete)?
4. Existing test patterns for task mutations (unit + e2e)?
5. Scope: task list only vs cycle mutations (plan should decide task-only per roadmap)?

## Summary

**Authenticated task CRUD is pessimistic today.** `TaskList` calls repository methods (`taskRepo.create/update/delete`), which delegate to `utils.client.task.*.mutate()` (vanilla tRPC client, not `useMutation` hooks). After every mutation, `onRefresh()` runs `utils.task.list.invalidate()`, forcing a refetch before the UI reflects changes. Local `isPending` state also blocks buttons during the round-trip.

**Guest mode is instant by design.** Task mutations write synchronously to `localStorage` via `mutateSnapshot` → `notifyListeners`, and `useGuestDomainTasks` subscribes with `useSyncExternalStore`. No network, no invalidation, no loading gate on the task list.

**No optimistic TanStack Query patterns exist anywhere in the codebase** — no `onMutate`, `setQueryData`, or `cancelQueries` usage. The only `useMutation` hooks are for check-in and suggestion (`use-pomodoro-cycle.ts`).

**Five task-list mutations need optimistic cache updates:** create, update (edit fields), update status → completed, update status → active (revert), delete. Cycle-induced task status changes (`cycle.complete` with `markTaskDone`, mid-cycle `tasks.update`) are secondary paths that still use invalidate-only today.

**Recommended scope for `/10x-plan`:** task-list CRUD only (authenticated path). Roadmap explicitly states task list alone satisfies the slice outcome; cycle mutations are optional follow-up. Implement via a dedicated `useTaskMutations` hook (or equivalent) that patches `utils.task.list` cache with `onMutate` / rollback / `invalidate` on settle.

**Confidence: 88/100** — architecture is clear and the fix is a well-trodden TanStack Query pattern. Remaining uncertainty: whether to keep the repository abstraction for auth mutations or bypass it in `TaskList` (both viable; plan should pick one).

## Detailed Findings

### 1. Authenticated task CRUD — data flow

#### tRPC router (`task.list`, `task.create`, `task.update`, `task.delete`)

All four procedures use `protectedProcedure` and scope by `ctx.session.user.id`:

| Procedure | Returns | Notes |
|-----------|---------|-------|
| `list` | `Task[]` ordered by `createdAt asc` | Single query key source |
| `create` | Full created `Task` row | Includes server-assigned `id` |
| `update` | `void` (no return) | Partial patch via spread `data` |
| `delete` | `void` | `NOT_FOUND` if wrong user |

Source: [`src/server/api/routers/task.ts`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/8c732be49d9bed0ce5e2af7ea37a4fc56761c4b6/src/server/api/routers/task.ts)

#### Query: `api.task.list`

- **Read path:** `AuthenticatedPomodoroDashboard` uses `api.task.list.useSuspenseQuery()` ([`pomodoro-dashboard.tsx:185`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/8c732be49d9bed0ce5e2af7ea37a4fc56761c4b6/src/app/_components/pomodoro-dashboard.tsx#L185)).
- **SSR prefetch:** `page.tsx` prefetches `api.task.list` + `api.cycle.getActive` for authenticated users ([`page.tsx:18-22`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/8c732be49d9bed0ce5e2af7ea37a4fc56761c4b6/src/app/page.tsx#L18-L22)).
- **Query key:** tRPC React Query integration — `utils.task.list` (invalidate/setQueryData helpers). Under the hood: `[['task','list'], { type: 'query', input: undefined }]`.
- **Stale time:** 30s default ([`query-client.ts:10-13`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/8c732be49d9bed0ce5e2af7ea37a4fc56761c4b6/src/trpc/query-client.ts#L10-L13)).

#### Mutations: repository indirection (not `useMutation`)

`DataModeProvider` builds a tRPC vanilla client and passes it to `createServerTaskRepository`:

```typescript
// data-mode-context.tsx — authenticated branch
create: { mutate: (input) => utils.client.task.create.mutate(input) }
update: { mutate: (input) => utils.client.task.update.mutate(input) }
delete: { mutate: (input) => utils.client.task.delete.mutate(input) }
```

`createServerTaskRepository` wraps these as async `TaskRepository` methods ([`server-repositories.ts:89-100`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/8c732be49d9bed0ce5e2af7ea37a4fc56761c4b6/src/lib/repositories/server-repositories.ts#L89-L100)).

#### UI: `TaskList` mutation + refresh pattern

`TaskList` is mode-agnostic — it always calls `useRepositories().tasks` then `await onRefresh()`:

| User action | Repository call | Then |
|-------------|-----------------|------|
| Add task | `taskRepo.create({ title, workType, weight })` | `onRefresh()` |
| Save edit | `taskRepo.update({ id, title, workType, weight })` | `onRefresh()` |
| Mark complete | `taskRepo.update({ id, status: "completed" })` | `onRefresh()` |
| Revert to active | `taskRepo.update({ id, status: "active" })` | `onRefresh()` |
| Delete | `taskRepo.delete({ id })` | `onRefresh()` |

All paths set `isPending = true` for the duration, disabling buttons ([`task-list.tsx:119,151-164,177-193,288-298`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/8c732be49d9bed0ce5e2af7ea37a4fc56761c4b6/src/app/_components/task-list.tsx)).

For authenticated mode, `onRefresh` = `utils.task.list.invalidate()` ([`pomodoro-dashboard.tsx:197-199`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/8c732be49d9bed0ce5e2af7ea37a4fc56761c4b6/src/app/_components/pomodoro-dashboard.tsx#L197-L199)).

**Latency chain:** user click → await mutation HTTP → await invalidate refetch → React re-render. This violates NFR 200ms acknowledgement for task actions.

#### Cache invalidation elsewhere

`utils.task.list.invalidate()` is also called from:

- `use-pomodoro-cycle.ts` — after `cycle.complete` (when `markTaskDone`), break completion, mid-cycle task switch, `endSession` ([lines 655, 733, 789, 961](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/8c732be49d9bed0ce5e2af7ea37a4fc56761c4b6/src/hooks/use-pomodoro-cycle.ts))
- `guest-import-on-mount.tsx` — after successful guest→account import ([line 58](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/8c732be49d9bed0ce5e2af7ea37a4fc56761c4b6/src/app/_components/guest-import-on-mount.tsx#L58))

No `setQueryData` anywhere — invalidation is the sole cache update strategy.

### 2. Guest local storage — instant UI (S-08)

Archived change: `context/archive/2026-05-29-guest-local-storage-merge/`.

#### Write path (synchronous)

1. `guest-repositories.ts` `create/update/delete` call `mutateSnapshot(mutator)`.
2. `mutateSnapshot` clones snapshot, applies mutator, `saveSnapshot` → `localStorage.setItem` → `notifyListeners()` ([`store.ts:72-78`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/8c732be49d9bed0ce5e2af7ea37a4fc56761c4b6/src/lib/guest/store.ts#L72-L78)).
3. All subscribers fire immediately — no `await`.

#### Read path (reactive, no refetch)

`useGuestDomainTasks` uses `useSyncExternalStore(subscribeGuestStore, getGuestTasksSnapshot)` ([`use-domain-tasks.ts:45-58`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/8c732be49d9bed0ce5e2af7ea37a4fc56761c4b6/src/lib/data-mode/use-domain-tasks.ts#L45-L58)). `refresh` is a no-op.

`GuestPomodoroDashboard` passes this no-op refresh to `TaskList` — guest `onRefresh()` after mutations is effectively redundant (store already notified), but harmless.

#### Cycle-side task completion (guest)

Guest `cycles.complete` with `markTaskDone` updates task status inside the same `mutateSnapshot` call ([`guest-repositories.ts:280-291`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/8c732be49d9bed0ce5e2af7ea37a4fc56761c4b6/src/lib/repositories/guest-repositories.ts#L280-L291)) — also instant.

#### Contrast table

| Aspect | Guest (S-08) | Authenticated (today) |
|--------|--------------|----------------------|
| Storage | `localStorage` blob | Neon Postgres via tRPC |
| Task list source | `useSyncExternalStore` | `useSuspenseQuery` |
| Mutation API | Repository → sync `mutateSnapshot` | Repository → async `client.*.mutate` |
| UI update trigger | `notifyListeners()` (sync) | `invalidate()` → network refetch |
| Perceived latency | Immediate | Network RTT + refetch |
| Error handling | `throw new Error(error)` from quota failures | Silent until refetch fails; no rollback |
| `isPending` in TaskList | Blocks UI unnecessarily (mutation is sync) | Blocks UI during network |

**S-09 goal:** make authenticated task-list mutations feel like guest — patch TanStack Query cache in `onMutate`, rollback on error, invalidate on settle for server reconciliation.

### 3. Mutations requiring optimistic updates

#### Primary — `TaskList` direct (in scope)

| # | Mutation | tRPC endpoint | Optimistic cache action |
|---|----------|---------------|-------------------------|
| 1 | Create task | `task.create` | Append temp task to list; replace with server row on success |
| 2 | Edit task | `task.update` | Merge `{ title, workType, weight }` into cached row by `id` |
| 3 | Mark complete | `task.update` (`status: "completed"`) | Set `status: "completed"` on cached row |
| 4 | Revert to active | `task.update` (`status: "active"`) | Set `status: "active"` on cached row |
| 5 | Delete | `task.delete` | Remove row from cached list |

**Note:** `task.update` returns `void` — optimistic layer must apply the input patch locally; cannot wait for server response body.

#### Secondary — cycle hook paths (out of recommended scope)

| Path | How task status changes | Current client update |
|------|-------------------------|----------------------|
| `onCycleCompleteConfirm(markTaskDone: true)` | Server `cycle.complete` → `tx.task.update` in transaction ([`cycle.ts:165-169`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/8c732be49d9bed0ce5e2af7ea37a4fc56761c4b6/src/server/api/routers/cycle.ts#L165-L169)) | `utils.task.list.invalidate()` after cycle completes |
| `onMidCycleContinueWithTask` | Direct `tasks.update({ status: "completed" })` then `cycles.rebindTask` ([`use-pomodoro-cycle.ts:770-789`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/8c732be49d9bed0ce5e2af7ea37a4fc56761c4b6/src/hooks/use-pomodoro-cycle.ts#L770-L789)) | invalidate both cycle + task list |
| `onMidCycleEndCycleAndBreak` | `cycles.complete({ markTaskDone: true })` | invalidate via `startBreakAfterWorkComplete` |

These are coupled to cycle/check-in state machines. Optimistic task patching here adds complexity (must stay consistent with overlay/timer state). Roadmap unknown explicitly defers to `/10x-plan`; slice outcome is satisfied by task-list alone.

### 4. Existing test patterns

#### Server-side unit tests (router layer)

| File | Coverage | Relevance to S-09 |
|------|----------|-------------------|
| [`task.test.ts`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/8c732be49d9bed0ce5e2af7ea37a4fc56761c4b6/src/server/api/routers/task.test.ts) | Property: create sets `userId` | Router contract only |
| [`task-mutation.test.ts`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/8c732be49d9bed0ce5e2af7ea37a4fc56761c4b6/src/server/api/routers/task-mutation.test.ts) | Property: update/delete ownership → `NOT_FOUND` | Router contract only |
| [`task-isolation.test.ts`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/8c732be49d9bed0ce5e2af7ea37a4fc56761c4b6/src/server/api/routers/task-isolation.test.ts) | Cross-user list isolation | Router contract only |
| [`cycle.test.ts`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/8c732be49d9bed0ce5e2af7ea37a4fc56761c4b6/src/server/api/routers/cycle.test.ts) | `complete({ markTaskDone: true })` updates task status server-side | Indirect task mutation |

No server tests need changing for optimistic UI — behavior is client-side cache management.

#### Guest repository tests

[`guest-repositories.test.ts`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/8c732be49d9bed0ce5e2af7ea37a4fc56761c4b6/src/lib/repositories/guest-repositories.test.ts) — create/list/persist via localStorage. Demonstrates instant local CRUD; no TanStack Query involved.

#### Client / hook tests

| File | Pattern | Gap |
|------|---------|-----|
| [`use-pomodoro-cycle.test.tsx`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/8c732be49d9bed0ce5e2af7ea37a4fc56761c4b6/src/hooks/use-pomodoro-cycle.test.tsx) | Mocks `utils.task.list.invalidate` as `invalidateTaskList` | Asserts invalidate called after cycle complete; no cache content assertions |
| [`use-pomodoro-cycle-guest.test.tsx`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/8c732be49d9bed0ce5e2af7ea37a4fc56761c4b6/src/hooks/use-pomodoro-cycle-guest.test.tsx) | Guest repository integration | No Query client |

**No `task-list.test.tsx` exists.** No tests for optimistic `setQueryData` / rollback.

#### E2E (Playwright)

Helpers in [`e2e/helpers/work-cycle.ts`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/8c732be49d9bed0ce5e2af7ea37a4fc56761c4b6/e2e/helpers/work-cycle.ts):

- `addTask` — fill placeholder, click Add, `expect(listitem).toBeVisible()` (waits for DOM, not explicitly for network)
- `markTaskCompleteMidCycle` — clicks "Mark complete" aria-label

Specs using task CRUD: `pomodoro-cycle.spec.ts`, `mid-cycle-completion.spec.ts`, `mid-cycle-last-task.spec.ts`, `smoke.spec.ts`, guest merge specs. All assume authenticated storage state fixture.

**Recommended new tests for S-09:**

1. **Unit:** `useTaskMutations.test.tsx` — mock `api.useUtils()`, assert `setQueryData` on mutate, rollback on rejected promise, `invalidate` on settle.
2. **Unit (optional):** `TaskList` integration with mocked optimistic hook — task appears before mutation resolves.
3. **E2e (stretch):** `page.route` to delay `/api/trpc` task mutations — assert UI updates before response; assert rollback on 500. Follow F-02 authenticated fixture pattern.

### 5. Scope recommendation

**In scope (task-list CRUD, authenticated only):**

- Optimistic cache for all five `TaskList` mutation paths
- Error surfacing + rollback (reuse `pomodoro-error` pattern or inline toast in task-list)
- Remove or shorten `isPending` blocking for auth path (keep for true in-flight guard if needed)
- Guest path unchanged (already instant; optionally remove redundant `onRefresh` awaits later)

**Out of scope (defer to follow-up slice):**

- `cycle.create` / `cycle.complete` / `cycle.interrupt` optimistic updates
- Optimistic task status via `markTaskDone` in cycle-complete overlay
- Mid-cycle task switch optimistic path
- Changing `task.update` router to return updated row (nice-to-have, not required)

**Rationale:** `roadmap.md` S-09 unknown: *"task list alone satisfies the slice outcome"* ([`roadmap.md:260`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/8c732be49d9bed0ce5e2af7ea37a4fc56761c4b6/context/foundation/roadmap.md)). PRD FR-004–FR-008 map to task-list CRUD. NFR 200ms acknowledgement is most visible on add/complete/delete in the list.

## Code References

- [`src/server/api/routers/task.ts`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/8c732be49d9bed0ce5e2af7ea37a4fc56761c4b6/src/server/api/routers/task.ts) — tRPC task router (list/create/update/delete)
- [`src/app/_components/task-list.tsx`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/8c732be49d9bed0ce5e2af7ea37a4fc56761c4b6/src/app/_components/task-list.tsx) — all task-list mutations + `isPending` gate
- [`src/app/_components/pomodoro-dashboard.tsx`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/8c732be49d9bed0ce5e2af7ea37a4fc56761c4b6/src/app/_components/pomodoro-dashboard.tsx) — `useSuspenseQuery` read + `invalidate` refresh
- [`src/lib/data-mode/data-mode-context.tsx`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/8c732be49d9bed0ce5e2af7ea37a4fc56761c4b6/src/lib/data-mode/data-mode-context.tsx) — repository wiring for auth vs guest
- [`src/lib/repositories/server-repositories.ts`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/8c732be49d9bed0ce5e2af7ea37a4fc56761c4b6/src/lib/repositories/server-repositories.ts) — vanilla tRPC client mutation wrappers
- [`src/lib/repositories/guest-repositories.ts`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/8c732be49d9bed0ce5e2af7ea37a4fc56761c4b6/src/lib/repositories/guest-repositories.ts) — sync localStorage mutations (contrast target)
- [`src/lib/guest/store.ts`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/8c732be49d9bed0ce5e2af7ea37a4fc56761c4b6/src/lib/guest/store.ts) — `mutateSnapshot` + `notifyListeners`
- [`src/lib/data-mode/use-domain-tasks.ts`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/8c732be49d9bed0ce5e2af7ea37a4fc56761c4b6/src/lib/data-mode/use-domain-tasks.ts) — guest reactive task list
- [`src/hooks/use-pomodoro-cycle.ts`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/8c732be49d9bed0ce5e2af7ea37a4fc56761c4b6/src/hooks/use-pomodoro-cycle.ts) — secondary task invalidation paths
- [`src/trpc/query-client.ts`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/8c732be49d9bed0ce5e2af7ea37a4fc56761c4b6/src/trpc/query-client.ts) — QueryClient defaults (30s staleTime)
- [`src/server/api/routers/cycle.ts:165-169`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/8c732be49d9bed0ce5e2af7ea37a4fc56761c4b6/src/server/api/routers/cycle.ts#L165-L169) — server-side `markTaskDone` task update

## Architecture Insights

1. **Repository abstraction was built for guest/server parity (S-08), not for TanStack Query optimism.** Auth mutations bypass `useMutation` lifecycle hooks — optimistic updates require either a new hook layer or refactoring `createServerTaskRepository` to accept cache utils.

2. **Single source of truth for authenticated task list:** `api.task.list` query cache. `TaskList` receives `tasks` as props from parent suspense query — optimistic updates must patch the same cache key the parent reads.

3. **`task.create` returns entity; `task.update/delete` return void.** Create can reconcile temp IDs on success. Update/delete must trust optimistic patch until settle invalidation.

4. **Guest `isPending` in TaskList is vestigial** — mutations complete synchronously but UI still disables during `await onRefresh()` (no-op for guest). Auth optimism should reduce `isPending` scope to double-submit prevention only.

5. **Existing error UX:** `PomodoroDashboardBody` has `pomodoro-error` alert for cycle errors. Task-list mutations today have no user-visible error on failure — only silent non-update after failed refetch. S-09 should add explicit rollback + error message per roadmap ("no silent loss").

## Historical Context (from prior changes)

- [`context/archive/2026-05-29-guest-local-storage-merge/plan.md`](context/archive/2026-05-29-guest-local-storage-merge/plan.md) — introduced repository layer; moved UI off direct `api.task.*`; established guest instant-write pattern S-09 must match perceptually.
- [`context/foundation/roadmap.md`](context/foundation/roadmap.md) — S-09 outcome, optional cycle scope, risk mitigation (`onMutate`/rollback/invalidate).
- [`context/archive/2026-06-05-testing-isolation-abuse-guest-merge/research.md`](context/archive/2026-06-05-testing-isolation-abuse-guest-merge/research.md) — `task-mutation.test.ts` refactored to stateful ownership store (server tests solid; client gap remains).

## Related Research

- `context/archive/2026-05-29-guest-local-storage-merge/` — guest storage architecture (direct predecessor contrast)
- `context/archive/2026-06-05-testing-isolation-abuse-guest-merge/research.md` — task router ownership tests

## Open Questions

1. **Integration point:** `useTaskMutations` hook consumed by `TaskList` vs optimistic-aware `ServerTaskRepository` — plan should choose (hook is simpler, keeps repository thin).
2. **Temp ID strategy for create:** negative integers vs `crypto.randomUUID()` string — `DomainTaskId` allows both; server returns numeric `id`.
3. **Error display:** extend `pomodoro-error` vs local `task-list` error banner — minimal scope favors task-list-local alert.
4. **Whether to remove `await onRefresh()` entirely** for auth and rely on `onSettled: () => utils.task.list.invalidate()` — recommended yes.
