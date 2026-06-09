# S-26 Manual Task Priority Order — Plan Brief

> Full plan: `context/changes/task-manual-priority-order/plan.md`
> Research: `context/changes/task-manual-priority-order/research.md`

## What & Why

Users need to express manual priority among active tasks — drag-reorder in the task list — and have that order persist across refresh and guest-to-account merge. Manual order becomes a deterministic **tie-breaker** in the adaptive suggester when scorer scores tie; it does not override higher-scoring tasks (FR-021, FR-022).

## Starting Point

Task list order is implicit `createdAt asc` everywhere: `task.list`, suggestion queries, and `pickBestTask` (score → weight → `createdAt`). S-09 shipped optimistic TanStack cache patches for CRUD; no `sortOrder` field, no DnD library, no reorder API. Guest merge copies task fields but loses relative array order on import.

## Desired End State

Active tasks show a drag handle; reorder feels instant (<200ms) via S-09 optimistic cache; order survives refresh and guest merge. Reorder is disabled during active cycles (`cycleLocked`). When two tasks score equally, the higher manual-priority task (lower `sortOrder`) wins the suggestion. One e2e spec proves drag persistence and guest merge order.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Reorder scope | Active tasks only (v1) | Roadmap confirms completed list unchanged; reduces scope | Research / Roadmap |
| DnD library | `@dnd-kit/core` + `@dnd-kit/sortable` | React 19 support, keyboard/touch, handle + activation constraint | Research |
| Drag surface | Handle only (not full row) | Row has 5+ buttons; avoids click conflicts | Research |
| Reorder API | Batch `orderedIds` → dense `0..n-1` reindex | Matches `onDragEnd` output; one transaction; simple validation | Research / Plan |
| Optimistic UX | Mirror S-09 `onMutate` / rollback / invalidate | Meets 200ms NFR; established hook pattern | Research / S-09 archive |
| Scorer tie-break | score → **sortOrder** → weight → createdAt | Manual order breaks ties only; does not trump score | Research / FR-021 |
| Guest merge | Offset `max(sortOrder)+1`; preserve relative order | Account tasks keep priority; guest order not lost | Research / Risk #5 |
| Cycle guard | Disable when `cycleLocked \|\| isMutating` | Mirrors delete/complete guards during running/completed overlay | Research / Plan |
| E2E | One `task-reorder.spec.ts` | New drag UI has no cheaper signal; merge order needs browser proof | Plan / test-plan |

## Scope

**In scope:**

- Prisma `sortOrder` migration + per-user backfill
- `task.list` / `task.create` / `task.reorder` tRPC
- `pickBestTask` sortOrder tie-breaker + suggestion query updates
- `useTaskMutations.reorderTasks` optimistic hook + guest repo reorder
- dnd-kit sortable active list with drag handle
- Guest schema, import offset, merge preview ordering
- Vitest unit/integration tests + `e2e/task-reorder.spec.ts`

**Out of scope:**

- Completed-task reorder
- Sparse sortOrder / gap compaction on complete
- Full-row drag
- Manual order as primary ranking signal
- Suggestion cache special invalidation beyond `task.list` invalidate

## Architecture / Approach

```
User drags handle → onDragEnd(orderedIds)
  ├─ auth: useTaskMutations.reorderTasks → onMutate patches task.list cache
  │         → task.reorder mutation → $transaction dense reindex
  └─ guest: taskRepo.reorder → localStorage snapshot

task.list orderBy: sortOrder asc → TaskList renders active order
suggestion.next loads active tasks + sortOrder → pickBestTask tie-break
import-guest-snapshot: offset sortOrder after existing account tasks
```

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Schema & types | `sortOrder` column, backfill, DomainTask + guest schema | Backfill SQL must preserve visible order |
| 2. Server API | list orderBy, create tail, reorder mutation + tests | Permutation validation edge cases |
| 3. Scorer | sortOrder tie-break in pickBestTask + suggestion loads | Tie-break must not override higher score |
| 4. Optimistic hook | reorderTasks + guest repo + unit tests | Cache reorder must match server dense indices |
| 5. DnD + merge + e2e | dnd-kit UI, guest import offset, acceptance | Playwright drag + dnd-kit pointer events |

**Prerequisites:** S-04 (task attrs), S-06 (scorer), S-09 (optimistic mutations) — all shipped.

**Estimated effort:** ~2–3 implementation sessions across 5 phases.

## Open Risks & Assumptions

- Prisma-generated migration may need explicit backfill step — implementer verifies post-`migrate dev`.
- Playwright `dragTo` with dnd-kit may need pointer-event tuning — test early in Phase 5.
- Suggestion highlight may briefly desync on reorder race — accepted; standard `invalidate` on settle (low risk per research).
- Complete/revert leaves sortOrder gaps — harmless; next drag reindexes.

## Success Criteria (Summary)

- User drag-reorders active tasks via handle; order persists on refresh.
- Reorder disabled during cycle lock; optimistic update <200ms perceived.
- Equal-score suggestion prefers manually higher-priority task.
- Guest merge preserves relative manual order after existing account tasks.
