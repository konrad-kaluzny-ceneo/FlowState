---
date: 2026-06-09T12:00:00+02:00
researcher: Cursor Agent (Auto)
git_commit: a800588494220ea491e953e38b67abfdc7d94b52
branch: features/task-manual-priority-order
repository: FlowState
topic: "S-26 manual task priority order — sortOrder schema, reorder API, optimistic DnD, scorer tie-break, guest merge"
tags: [research, codebase, task, sortOrder, dnd-kit, optimistic-updates, scorer, guest-merge, s-26]
status: complete
last_updated: 2026-06-09
last_updated_by: Cursor Agent (Auto)
---

# Research: S-26 manual task priority order (drag-and-drop)

**Date**: 2026-06-09T12:00:00+02:00  
**Researcher**: Cursor Agent (Auto)  
**Git Commit**: `a800588494220ea491e953e38b67abfdc7d94b52`  
**Branch**: `features/task-manual-priority-order`  
**Repository**: [konrad-kaluzny-ceneo/FlowState](https://github.com/konrad-kaluzny-ceneo/FlowState)

## Research Question

For roadmap slice **S-26** (`task-manual-priority-order`), verify six implementation risks before `/10x-plan`:

1. Task model/schema — add `sortOrder` field, migration path, guest localStorage shape
2. `task-list.tsx` — current optimistic mutation patterns from S-09 to mirror for reorder
3. Task tRPC router — reorder mutation design, per-user isolation
4. Suggestion scorer — where tie-breaker logic lives, how to inject manual `sortOrder`
5. dnd-kit vs native HTML5 DnD — pick one with evidence for React 19 + optimistic updates
6. Guest merge — preserve relative `sortOrder` on import

## Summary

**`sortOrder` does not exist anywhere today.** Task list order is implicit `createdAt asc` from `task.list`, suggestion queries, scorer tie-break, and guest merge preview. S-26 requires a Prisma migration (`sortOrder Int NOT NULL`, backfilled per-user by `createdAt asc`), guest schema extension, a batch `task.reorder` mutation, and scorer/list query updates.

**S-09 optimistic pattern is the template for reorder.** `use-task-mutations.ts` patches `utils.task.list` synchronously in `onMutate`, rolls back on error, and invalidates on settle — meeting the 200ms NFR without awaiting network. Reorder should add a `reorderTasks` helper + mutation following the same contract.

**DnD recommendation: `@dnd-kit/core` + `@dnd-kit/sortable`.** React 19.2.6, no existing DnD deps, button-heavy task rows require a drag handle either way; dnd-kit provides sortable transforms, keyboard a11y, and touch sensors with lower custom-code cost than native HTML5.

**Guest merge hook is `import-guest-snapshot.ts` task loop.** Today it copies title/status/workType/weight only; relative order is lost because server list uses `createdAt`. Add `sortOrder` to guest schema, assign on create/reorder in guest repo, and pass through on import with offset for existing account tasks.

**Scorer tie-break:** `pickBestTask` in `score-task.ts` currently resolves equal scores via weight → `createdAt`. After score equality, insert `sortOrder asc` (lower = higher manual priority); keep weight/`createdAt` as fallbacks when `sortOrder` ties.

## Detailed Findings

### 1. Task model/schema — `sortOrder`, migration, guest localStorage

#### Current Task schema

```56:75:prisma/schema.prisma
model Task {
  id        Int       @id @default(autoincrement())
  title     String    @db.VarChar(256)
  status    String    @default("active") @db.VarChar(20)
  userId    String    @map("user_id") @db.VarChar(255)
  workType  WorkType  @default(OPERATIONAL) @map("work_type")
  weight    Int       @default(2) @db.SmallInt
  createdAt DateTime  @default(now()) @map("createdAt") @db.Timestamptz
  updatedAt DateTime? @updatedAt @map("updatedAt") @db.Timestamptz
  // ...
  @@index([status], name: "task_status_idx")
  @@index([userId], name: "task_user_id_idx")
  @@index([workType], name: "task_work_type_idx")
  @@map("flow_state_task")
}
```

No `sortOrder` field in schema, migrations, or application code.

#### Recommended `sortOrder` design

| Aspect | Recommendation |
|--------|----------------|
| Type | `Int` / `INTEGER NOT NULL` (same as `weight`) |
| Column map | `@map("sort_order")` |
| Default | `@default(0)` on schema; backfill existing rows per-user by `createdAt asc` |
| Scope | Per-user ordering among **active** tasks (v1 — roadmap confirms active-only) |
| Index | `@@index([userId, sortOrder], name: "task_user_sort_order_idx")` |
| Uniqueness | No unique constraint — batch reindex on reorder is simpler |
| New task | `max(active sortOrder) + 1` on create (server + guest) |

#### Migration path

Repo convention: `pnpm db:migrate` → `prisma migrate dev`; never hand-write migration SQL (AGENTS.md).

Precedent for additive columns: `20260526171857_session_domain_model` added `weight` and `work_type` with `NOT NULL DEFAULT`.

Steps:
1. Add `sortOrder` + composite index to `schema.prisma`
2. Run `pnpm db:migrate`
3. Backfill: assign `0..n-1` per `user_id` ordered by `createdAt asc` (preserves current visible order on deploy)
4. `prisma generate` (also in `pnpm dev` / `pnpm build`)

#### Guest localStorage shape

- **Key:** `flowstate:guest-v1` (`src/lib/guest/schema.ts:5`)
- **Task schema** (`src/lib/guest/schema.ts:7-17`): `id`, `title`, `status`, `workType`, `weight`, `createdAt`, `updatedAt` — no `sortOrder`
- **Persistence:** `localStorage.setItem` via `src/lib/guest/store.ts`
- **Order today:** array order in snapshot; new tasks appended (`src/lib/repositories/guest-repositories.ts:88-91`)
- **Domain type:** `DomainTask` in `src/lib/data-mode/types.ts` has no `sortOrder`

**Guest schema extension:** add `sortOrder: z.number().int().min(0)` with Zod default from array index on parse for legacy snapshots.

### 2. `task-list.tsx` — S-09 optimistic patterns to mirror

#### Current rendering and ordering

```132:133:src/app/_components/task-list.tsx
	const activeTasks = tasks.filter((t) => t.status === "active");
	const completedTasks = tasks.filter((t) => t.status === "completed");
```

- No client-side sort — array order from `task.list` (`createdAt asc`)
- Data path: `pomodoro-dashboard.tsx` → `api.task.list.useSuspenseQuery()` → `TaskList` props
- Guest path: `useGuestDomainTasks()` → same `TaskList` interface

#### Mutations consumed

`TaskList` uses only `useTaskMutations()` (`task-list.tsx:109-117`):

| Action | Hook method | tRPC |
|--------|-------------|------|
| Add | `createTask` | `task.create` |
| Edit / complete / revert | `updateTask` | `task.update` |
| Delete | `deleteTask` | `task.delete` |

`onRefresh` prop is accepted but unused (S-09 removed post-mutation refetch).

#### S-09 optimistic contract (`use-task-mutations.ts`)

| Phase | Behavior |
|-------|----------|
| `onMutate` | `cancel()` → snapshot `previousTasks` → `setData(updater)` |
| `onError` | Restore `previousTasks`; set formatted error |
| `onSettled` | `void utils.task.list.invalidate()` |
| `onSuccess` (create) | Replace temp negative id with server row |

Helpers: `appendTask`, `patchTask`, `removeTask`, `replaceTempTask` (lines 66-93).

Tests in `use-task-mutations.test.tsx` cover optimistic patch, rollback, invalidate, guest delegation, temp-id skip.

#### Reorder mirror plan

1. Add `reorderActiveTasks(list, orderedIds)` cache helper
2. Add `api.task.reorder.useMutation` with same lifecycle handlers
3. Expose `reorderTasks` + include in `isMutating`
4. Guest branch: `taskRepo.reorder(...)` synchronous
5. Wire DnD `onDragEnd` in active list only; disable when `cycleLocked` / `isMutating`

**200ms NFR:** synchronous `setData` in `onMutate` gives perceived update before HTTP — same mechanism as create/update/delete (PRD NFR, S-09 plan acceptance criterion).

### 3. Task tRPC router — reorder mutation, per-user isolation

#### Existing procedures (`src/server/api/routers/task.ts`)

| Procedure | Lines | Notes |
|-----------|-------|-------|
| `list` | 7-12 | `where: { userId }`, `orderBy: { createdAt: "asc" }` |
| `create` | 14-31 | Stamps `userId` from session |
| `update` | 33-57 | `findFirst({ id, userId })` → `NOT_FOUND` |
| `delete` | 59-73 | Same isolation pattern |

All use `protectedProcedure` (UNAUTHORIZED if no session).

#### Isolation pattern

- Reads: `where: { userId: ctx.session.user.id }`
- Mutations: `findFirst({ id, userId })` before write; cross-user → `NOT_FOUND` (not FORBIDDEN)
- Tests: `task-isolation.test.ts` (Property 10), `task-mutation.test.ts` (Property 11)

#### Recommended `reorder` API

**Batch ordered IDs** (not single move):

```typescript
reorder: protectedProcedure
  .input(z.object({ orderedIds: z.array(z.number().int()).min(1) }))
  .mutation(...)
```

Rationale:
- DnD `onDragEnd` yields full active list order
- One `$transaction` assigns `sortOrder = index` for each ID
- Matches optimistic `setData` full-list replace
- Validate `orderedIds` is exact permutation of caller's **active** task IDs

Server steps:
1. Load active tasks for `userId`
2. Validate input is permutation of those IDs
3. `$transaction`: `task.update({ where: { id, userId }, data: { sortOrder: i } })` per index
4. Return void (consistent with `update`/`delete`) or updated list

**`list` order change:**

```typescript
orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
```

**`create` change:** assign `sortOrder = max(existing active) + 1`.

**Tests to extend:** `task-mutation.test.ts` (owner reorder, cross-user ID → NOT_FOUND, completed ID → reject), `task-isolation.test.ts` (user B order unchanged after user A reorder).

### 4. Suggestion scorer — tie-breaker and `sortOrder` injection

#### Current tie-break chain

```68:85:src/lib/scoring/score-task.ts
	return tasks.reduce((best, task) => {
		const taskScore = scoreTask(task, context);
		const bestScore = scoreTask(best, context);
		if (taskScore > bestScore) return task;
		if (taskScore < bestScore) return best;
		if (task.weight > best.weight) return task;
		if (task.weight < best.weight) return best;
		return task.createdAt < best.createdAt ? task : best;
	});
```

Order: score → weight → `createdAt`.

`ScoringTask` (`score-task.ts:11-16`) has no `sortOrder`. Test at `score-task.test.ts:87-100` documents weight/`createdAt` tie-break.

#### Suggestion entry points

Both in `src/server/api/routers/suggestion.ts`:
- Post-check-in: lines 147-172
- Kickoff: lines 214-237

Both load active tasks with `orderBy: { createdAt: "asc" }` and map to `pickBestTask` without `sortOrder`.

#### Recommended comparator after score tie

```
score → sortOrder (asc, lower = higher manual priority) → weight (desc) → createdAt (asc)
```

Changes:
1. Add `sortOrder: number` to `ScoringTask`
2. Insert sortOrder comparison after score equality, **before** weight
3. Pass `sortOrder` in both `pickBestTask` call sites
4. Change suggestion active-task queries to `orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]`

Manual order is tie-breaker only — does not override higher-scoring tasks (FR-021, S-26 outcome).

### 5. DnD library decision

#### Stack evidence

- React `^19.2.6`, React DOM `^19.2.6` (`package.json:37-38`)
- No DnD dependencies in `package.json` or `src/`
- Task rows have 5+ interactive controls (complete, edit, Focus, delete) — full-row drag conflicts with clicks

#### Comparison

| Criterion | `@dnd-kit/core` + `@dnd-kit/sortable` | Native HTML5 DnD |
|-----------|----------------------------------------|-------------------|
| React 19 | Peer support; typing fixes merged | Works but awkward with controlled state |
| Optimistic UX | `arrayMove` + transform styles during drag; `onDragEnd` → S-09 cache patch | Ghost image; brittle sibling reflow |
| Accessibility | Keyboard sensor, announcements, focus mgmt | Minimal; custom keyboard reorder needed |
| Touch | Pointer/touch sensors + activation constraints | iOS historically poor (desktop-first PRD) |
| Row complexity | Handle + `activationConstraint` | Same handle need, worse ergonomics |

#### Recommendation: **`@dnd-kit/core` + `@dnd-kit/sortable`**

Implementation sketch:
- `DndContext` + `SortableContext` around active `<ul>` only
- Drag handle per row (not full row)
- `onDragEnd` → optimistic cache reorder → `task.reorder`
- Disable when `cycleLocked` / `isMutating`

Note: `@dnd-kit/react` (vNext) exists but maintainer labels early releases alpha; mature `@dnd-kit/core` + `@dnd-kit/sortable` is safer for production.

DnD choice is independent of optimistic persistence — both libraries fire `onDragEnd`; S-09 rollback pattern applies either way.

### 6. Guest merge — preserve relative `sortOrder`

#### Current import loop

```48:60:src/server/api/lib/import-guest-snapshot.ts
		for (const guestTask of snapshot.tasks) {
			const title = resolveUniqueTitle(guestTask.title, existingTitles);
			existingTitles.add(title);
			const created = await tx.task.create({
				data: {
					title,
					status: guestTask.status,
					userId,
					workType: guestTask.workType,
					weight: guestTask.weight,
				},
			});
			taskIdMap.set(guestTask.id, created.id);
		}
```

- Iterates array order but does not set `sortOrder` or guest `createdAt`
- Server list uses `createdAt asc` — guest manual order lost post-import
- Merge preview sorts by `createdAt` (`src/lib/guest/merge-copy.ts:33-44`), not array/`sortOrder`

#### Recommended merge strategy

1. Add `sortOrder` to `guestTaskSchema`; backfill from array index on parse for legacy snapshots
2. Guest reorder: update `sortOrder` in `guest-repositories.ts`
3. On import:
   - Query `max(sortOrder)` for existing user tasks (offset base)
   - Sort guest tasks by `sortOrder`
   - Assign `sortOrder: baseOffset + relativeIndex`
4. Update `extractPreviewTaskTitles` to sort active tasks by `sortOrder`
5. Add tests: import preserves relative order; offset when account already has tasks

**No version bump required** if Zod defaults handle missing `sortOrder` in v1 snapshots.

## Code References

- `prisma/schema.prisma:56-75` — Task model (no sortOrder yet)
- `src/server/api/routers/task.ts:7-74` — list/create/update/delete; list orders by createdAt
- `src/app/_components/task-list.tsx:132-133,281-394` — filter by status; active list render
- `src/hooks/use-task-mutations.ts:66-167` — S-09 optimistic helpers and mutation lifecycle
- `src/hooks/use-task-mutations.test.tsx` — optimistic/rollback test contract
- `src/lib/scoring/score-task.ts:60-86` — pickBestTask tie-break chain
- `src/lib/scoring/score-task.test.ts:87-100` — weight/createdAt tie-break test
- `src/server/api/routers/suggestion.ts:147-172,214-237` — kickoff + post-check-in task load
- `src/lib/guest/schema.ts:5-17` — guest snapshot key and task shape
- `src/lib/repositories/guest-repositories.ts:71-91` — guest task array append
- `src/server/api/lib/import-guest-snapshot.ts:48-60` — guest task import loop (sortOrder hook)
- `src/lib/guest/merge-copy.ts:18-44` — merge preview ordering
- `src/lib/data-mode/types.ts:3-12` — DomainTask type
- `package.json:37-38` — React 19.2.6

## Architecture Insights

- **Single source of list order:** server `task.list` orderBy drives UI; client does not re-sort. Adding `sortOrder` to orderBy automatically updates TaskList display.
- **Dual data mode:** authenticated (TanStack cache + tRPC) vs guest (localStorage + repository). Every new field/mutation needs both paths — established in S-08/S-09.
- **Scorer decoupled from list order:** `pickBestTask` uses explicit comparator, not array order. Must wire `sortOrder` into `ScoringTask` separately from list query.
- **IDOR posture:** cross-user task access returns `NOT_FOUND`; reorder validation must reject foreign IDs without leaking existence.
- **Active-only v1:** roadmap confirms manual order on active tasks only; completed section unchanged.

## Historical Context (from prior changes)

- `context/archive/2026-05-30-task-attributes-for-scoring/plan.md:38-39` — S-04 explicitly deferred drag reorder; added workType/weight
- `context/archive/2026-06-07-adaptive-task-suggestion/research.md` — S-06 introduced pickBestTask; candidates ordered by createdAt; tie-break createdAt
- `context/archive/2026-06-07-optimistic-task-mutations/plan.md` — S-09 shipped optimistic TanStack cache pattern; reorder must mirror rollback
- `context/archive/2026-05-29-guest-local-storage-merge/plan.md` — S-08 import contract (UUID remap, title suffix, transactional); task loop order is sortOrder hook
- `context/foundation/roadmap.md:633-647` — S-26 outcome, unknowns, optimistic reorder risk note

## Related Research

- `context/archive/2026-06-07-optimistic-task-mutations/research.md` — S-09 pessimistic→optimistic migration analysis
- `context/archive/2026-06-07-adaptive-task-suggestion/research.md` — scorer and suggestion router patterns
- `context/archive/2026-05-29-guest-local-storage-merge/research.md` — guest snapshot and import pipeline

## Open Questions

| Question | Recommendation | Blocker? |
|----------|----------------|----------|
| Active-only or also completed reorder? | **Active only** (roadmap v1) | No |
| Guest merge preserve sortOrder? | **Yes** — offset-based import | No |
| Drag handle vs full-row? | **Handle** — row has 5+ buttons | No |
| Reorder during active cycle? | Disable when `cycleLocked` (mirror delete/complete guards) | No |
| Sparse vs dense sortOrder on reorder? | **Dense reindex** (0..n-1) in batch mutation — simpler | No |
| Suggester cache after reorder? | `invalidate` on settle may race with accepted suggestion — mirror S-09 rollback; consider invalidating `suggestion` cache if highlighted row desyncs | Low risk — plan should note |

## Confidence & Blockers

**Confidence: 92/100**

High confidence on schema shape, S-09 mirror pattern, tRPC isolation, scorer injection points, dnd-kit choice, and guest import hook. Minor uncertainty on backfill migration SQL (Prisma-generated vs custom step) and exact suggester cache invalidation scope on reorder race.

**Blockers: none.** All prerequisites (S-04, S-06, S-09) are archived and shipped. No conflicting DnD library in repo. Product unknowns resolved by roadmap (active-only, preserve guest order).
