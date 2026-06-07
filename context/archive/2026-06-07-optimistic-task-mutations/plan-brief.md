# S-09 Optimistic Task Mutations — Plan Brief

> Full plan: `context/changes/optimistic-task-mutations/plan.md`
> Research: `context/changes/optimistic-task-mutations/research.md`

## What & Why

Authenticated task-list CRUD today waits for HTTP + `invalidate` refetch before the UI updates — violating the NFR 200ms acknowledgement and feeling slower than guest local storage. This slice patches the `api.task.list` TanStack Query cache optimistically for create, edit, complete, revert, and delete, with rollback and visible errors on failure.

## Starting Point

`TaskList` calls `useRepositories().tasks` (vanilla tRPC client) then `await onRefresh()` (`utils.task.list.invalidate()`). The parent suspense query re-renders only after refetch. Guest mode already writes synchronously to localStorage. No `onMutate` / `setQueryData` patterns exist in the codebase.

## Desired End State

Logged-in users see task-list changes instantly. Failed mutations roll back the list and show a dismissible error banner. Server reconciliation happens via `invalidate` on settle. Guest behavior is unchanged. Cycle-driven task updates (markTaskDone overlay, mid-cycle switch) remain invalidate-only.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| -------- | ------ | ---------------- | ------ |
| Scope | Task-list CRUD only (5 paths) | Roadmap S-09 outcome satisfied without cycle mutation complexity | Research |
| Integration point | `useTaskMutations` hook | Keeps repository thin; hooks satisfy Rules of Hooks for `useMutation` | Plan |
| Hook location | `src/hooks/use-task-mutations.ts` | Matches existing hook conventions (`use-pomodoro-cycle.ts`) | Plan |
| Temp create ID | Negative integer (`-Date.now()`) | Server returns numeric id; `task.update` input requires `z.number()` | Plan |
| Error UX | Task-list-local banner | Minimal scope; avoids coupling task errors to cycle `pomodoro-error` | Research / Plan |
| Remove `onRefresh` awaits | Yes for TaskList CRUD | Optimistic cache is source of truth until settle invalidation | Research / Plan |
| Cycle optimism | Out of scope | Coupled to overlay/timer state; deferred to follow-up slice | Research |

## Scope

**In scope:**

- Optimistic cache for create, edit, complete, revert, delete in authenticated `TaskList`
- `onMutate` / rollback / `invalidate on settle` via `utils.task.list`
- Error surfacing + rollback on mutation failure
- Unit tests for `useTaskMutations`
- Narrow `isMutating` blocking (no full-list lock during network)

**Out of scope:**

- Cycle create/complete/interrupt optimism
- `markTaskDone` overlay optimistic path
- Mid-cycle task switch in `use-pomodoro-cycle.ts`
- Changing `task.update` to return updated row
- E2E with delayed tRPC (manual throttling suffices)

## Architecture / Approach

```
TaskList → useTaskMutations()
              ├─ guest: taskRepo.create/update/delete (sync, unchanged)
              └─ auth: api.task.*.useMutation
                     onMutate: cancelQueries → snapshot → setQueryData
                     onError: restore snapshot + set error
                     onSettled: utils.task.list.invalidate()
```

Parent `AuthenticatedPomodoroDashboard` keeps `useSuspenseQuery()` — optimistic patches hit the same cache key the parent reads, so props update without refetch on the hot path.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Optimistic mutation hook | `useTaskMutations` + unit tests for patch/rollback/invalidate | Create temp-id reconcile duplicates row if swap logic wrong |
| 2. TaskList integration and error UX | Wire hook, error banner, remove pessimistic refresh | Mid-cycle mark-complete accidentally routed through hook |
| 3. Regression and acceptance | Full test/e2e gates + manual NFR check | Stale focus id after temp-id create if reconcile misses |

**Prerequisites:** S-01 (authenticated dashboard), F-02 (e2e auth fixture) — both shipped.

**Estimated effort:** ~1–2 sessions across 3 phases

## Open Risks & Assumptions

- Assumes `task.list` query shape stays stable (Prisma task row with numeric `id`).
- Create reconcile must replace temp row, not append server row twice.
- Cycle invalidation paths in `use-pomodoro-cycle.ts` remain unchanged and may briefly overwrite optimistic state if user mutates during cycle complete — acceptable for this slice.

## Success Criteria (Summary)

- Authenticated task add/edit/complete/revert/delete feel instant (<200ms perceived).
- Server error rolls back list and shows visible error — no silent loss.
- `pnpm test`, `pnpm test:e2e`, `pnpm check`, `pnpm typecheck` pass; guest CRUD unchanged.
