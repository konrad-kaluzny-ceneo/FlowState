# Stale Task Archive Implementation Plan

## Overview

Implement S-44 / US-05 so stale active tasks leave the default task list after three or more days without task-row user touch, appear in a dedicated archive view, and can be multi-selected for explicit permanent deletion. The archive is persisted as task state (`status: "archived"` plus `archivedAt`) so the review bucket is stable, restorable, and excluded from suggestions until the user restores or deletes the task.

## Current State Analysis

FlowState already has task CRUD, optimistic task mutations, guest/auth data-mode parity, daily standing tasks, and deterministic suggestions. It does not yet have an archive status, archive timestamp, stale sweep, archive view, restore action, or bulk delete action.

Task status is currently a string column with `"active"` and `"completed"` behavior enforced in TypeScript and Zod rather than a database enum. That makes `"archived"` additive, but every typed boundary must be updated together: Prisma mapper/domain type, tRPC router inputs, guest snapshot schema, guest repository, optimistic mutation hook, UI filtering, import-from-guest, and tests.

## Desired End State

When a logged-in or guest user opens the home task inventory or archive view, active non-daily-standing tasks whose `updatedAt ?? createdAt` is at least three days old are moved to `status: "archived"` with `archivedAt` set once. The default task list shows only active and completed sections, with archived tasks absent. A separate archive view is reachable from the task inventory/home surface and lists archived tasks with multi-select, select-all, restore, and permanent delete actions.

Archived tasks are excluded from kickoff and post-check-in suggestion pools, including the daily-standing OR branch. Completed-task semantics remain unchanged, mark-done-for-today remains daily-standing only, and permanent delete is available only through an archived-only bulk mutation.

### Key Discoveries:

- `Task.status` is a free string column and already indexed, so `"archived"` can be added without a database enum migration; `Session.archivedAt` provides precedent for nullable archive timestamps.
- The stale anchor is `updatedAt ?? createdAt`, not creation date alone or last cycle focus; this matches the available task-row touch substrate without expanding into cycle aggregation.
- Daily-standing tasks must be exempt because done-for-today writes `TaskDayCompletion` and does not update the task row.
- Existing `task.list` returns all task statuses for the user; the UI currently filters only active and completed.
- Suggestions currently load `status = "active"` OR `isDailyStanding = true`; archived tasks need an explicit exclusion guard so a manually archived standing task cannot leak into suggestions.
- Guest/auth parity requires the archive status, `archivedAt`, stale sweep, restore, and bulk delete to exist in both tRPC and local snapshot repositories.

## What We're NOT Doing

- No recurring-rule engine or schedule customization for standing tasks.
- No "last focused counts as touch" behavior in this slice; that needs a future `lastTouchedAt` field and focus-cycle writes.
- No broad S-40 home IA reset; this slice adds a small, movable archive entry near the existing task inventory/home area.
- No soft-delete/trash layer after permanent delete. Bulk delete from archive is irreversible after confirmation, matching S-44.
- No wedge conductor, timer hook, or session-flow changes unless tests expose a stale suggestion cleanup issue.
- No full Playwright catalog promotion by default; add browser coverage only where component/router tests cannot prove the user-visible risk.

## Implementation Approach

Use a persisted archive state. Add `archivedAt` to `Task`, expose archive-specific router/repository actions, and run an idempotent stale sweep before task inventory data is returned. Keep the user-facing archive as a dedicated inventory component rather than adding a third section inside `TaskList`, because archive needs selection state, confirmation, restore, different empty states, and no cycle controls.

The chosen stale rule is:

```text
status = "active"
AND isDailyStanding = false
AND coalesce(updatedAt, createdAt) <= now - 3 days
```

The sweep should set `status: "archived"` and `archivedAt: now` only for matching tasks. Restore should move an archived task back to active, clear `archivedAt`, and append it to the end of active sort order. Bulk delete should validate that every selected task belongs to the current user and is archived before deleting.

## Critical Implementation Details

### Lazy Sweep Contract

Run the stale sweep lazily from task inventory reads rather than adding a background job. For authenticated users, run it inside `task.list` and any archive-list procedure before returning data; for guests, run the same predicate in the guest task repository before returning snapshot tasks. The sweep must be idempotent and must not rewrite already archived tasks, completed tasks, or daily-standing tasks.

### Timestamp Meaning

For S-44, "last user touch" means task-row mutations that already affect `updatedAt`: edit, reorder, complete/revert/archive/restore, and create fallback through `createdAt`. Focus cycles do not count as touch in this slice because focus history is not stored on `Task`.

### Suggestion Safety

Treat `status: "archived"` as disqualifying for suggestions even if `isDailyStanding` is true. Auto-archive exempts standing tasks, but an explicit guard prevents future manual archive behavior from leaking archived standing tasks into the wedge.

## Phase 1: Persistence and Shared Task Contracts

### Overview

Add archive state to the task data model and every shared data contract so auth, guest, import, and UI code can represent archived tasks consistently.

### Changes Required:

#### 1. Prisma Task Schema and Migration

**File**: `prisma/schema.prisma`

**Intent**: Add a nullable `archivedAt` timestamp to `Task` so archive membership has a stable entry time for sorting, copy, and restore decisions.

**Contract**: `Task` gains `archivedAt DateTime? @map("archived_at") @db.Timestamptz` and an index that supports archive reads, preferably `[userId, status, archivedAt]`. Create the migration with `pnpm prisma migrate dev`; do not hand-write migration SQL.

#### 2. Prisma Task Mapper and Domain Type

**File**: `src/lib/persistence/prisma/task-mapper.ts`

**Intent**: Return archive timestamps through the existing task shape.

**Contract**: `mapTaskFromPrisma` includes `archivedAt`.

**File**: `src/lib/data-mode/types.ts`

**Intent**: Make archive state explicit at the repository boundary shared by guest and authenticated modes.

**Contract**: `DomainTask.status` narrows or documents the allowed task statuses including `"archived"`; `DomainTask` gains `archivedAt: Date | null`. `TaskRepository` gains archive-specific methods rather than overloading single-task delete for bulk delete.

#### 3. Guest Snapshot Schema

**File**: `src/lib/guest/schema.ts`

**Intent**: Preserve archived tasks in local guest data and during guest-to-auth import.

**Contract**: Guest task status accepts `"archived"` and guest tasks include optional/coerced nullable `archivedAt`, normalized to `null` for older snapshots.

#### 4. Guest Import

**File**: `src/server/api/lib/import-guest-snapshot.ts`

**Intent**: Preserve reviewed archive buckets when a guest signs in.

**Contract**: Imported tasks copy `status` and `archivedAt`. Active sort order can remain import-relative, but archived tasks should not re-enter active inventory during import.

### Success Criteria:

#### Automated Verification:

- Prisma migration and generated client update cleanly with `pnpm prisma migrate dev`.
- TypeScript accepts `DomainTask` and mapper changes with `pnpm typecheck`.
- Guest snapshot parsing preserves old snapshots without `archivedAt` and accepts archived tasks in `src/lib/guest/schema.ts` tests or adjacent guest repository tests.
- Guest import tests cover archived status and `archivedAt` preservation.
- Full project quality check passes with `pnpm check`.

#### Manual Verification:

- Inspect the generated migration to confirm it only adds archive task metadata/indexes and does not rewrite existing task data.
- Confirm a pre-existing task without `archivedAt` still loads in auth and guest task lists.
- Confirm no user-facing archive UI is exposed yet if later phases are not complete.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Archive Rules, Router Procedures, and Suggestion Exclusion

### Overview

Implement the server-side archive behavior: stale sweep, archive listing, restore, archived-only bulk delete, and suggestion-pool exclusion.

### Changes Required:

#### 1. Task Router Archive Helpers

**File**: `src/server/api/routers/task.ts`

**Intent**: Centralize stale-task archive behavior and protect ownership for every archive mutation.

**Contract**: Add an internal helper that archives active, non-standing tasks where `updatedAt ?? createdAt <= now - 3 days`. Compute one `now`/cutoff per sweep, and keep the helper clock-injectable enough for exact boundary tests. `task.list` runs the helper before loading tasks. Add a dedicated `task.archiveList` query, sorted by `archivedAt` descending then `createdAt` descending, so the archive view has a stable cache boundary separate from the default inventory.

#### 2. Restore Procedure

**File**: `src/server/api/routers/task.ts`

**Intent**: Let users intentionally return an archived task to the active list.

**Contract**: `task.restore({ id })` validates `{ id, userId, status: "archived" }`, updates `status: "active"`, clears `archivedAt`, and sets `sortOrder` to `nextActiveSortOrder`.

#### 3. Archived-Only Bulk Delete Procedure

**File**: `src/server/api/routers/task.ts`

**Intent**: Make permanent deletion explicit and safe for archive cleanup.

**Contract**: `task.deleteArchived({ ids })` accepts a non-empty bounded array of integer IDs, validates all selected IDs belong to the user and are archived, rejects mixed active/completed/non-owned sets, then deletes the archived rows. Return deleted IDs or count for optimistic reconciliation.

#### 4. Update Status Validation

**File**: `src/server/api/routers/task.ts`

**Intent**: Avoid accidental archive transitions through generic task edit paths.

**Contract**: Keep generic `task.update` for normal edit/complete/revert behavior. If it accepts `"archived"`, it must set/clear `archivedAt` correctly; preferred contract is to keep archive transitions on dedicated archive/restore procedures and keep generic update to active/completed.

#### 5. Suggestion Pool Filter

**File**: `src/lib/suggestion/build-suggestion-pool.ts`

**File**: `src/hooks/use-pomodoro-cycle.ts`

**Intent**: Ensure archived tasks never appear as kickoff or post-check-in suggestions.

**Contract**: Query/filter must exclude `status: "archived"` even for daily-standing tasks. Preserve current done-for-today filtering for standing tasks. Also update kickoff eligibility (`taskPoolHasKickoffCandidates` / equivalent hook path) so an archived daily-standing row cannot keep kickoff/session suggestion surfaces eligible through the existing `status === "active" || isDailyStanding` branch.

### Success Criteria:

#### Automated Verification:

- Router tests cover stale predicate using `updatedAt ?? createdAt`, three-day boundary, active-only behavior, daily-standing exemption, and no mutation of completed/archived tasks.
- Router tests cover restore appending to active sort order and clearing `archivedAt`.
- Router isolation tests cover cross-user archive list, restore, and `deleteArchived` denial/no-write.
- Router tests prove `deleteArchived` rejects mixed active/completed/non-owned IDs and deletes only archived user rows.
- Suggestion and hook/helper tests prove archived tasks are excluded while non-archived daily-standing tasks remain eligible unless done today, including kickoff eligibility based on `task.list`.
- Targeted router/suggestion eligibility test command passes: `pnpm exec vitest run src/server/api/routers/task.test.ts src/server/api/routers/task-mutation.test.ts src/server/api/routers/task-isolation.test.ts src/server/api/routers/suggestion.test.ts src/hooks/use-pomodoro-cycle.test.tsx`.

#### Manual Verification:

- Review archive router contracts in the tRPC type output or editor IntelliSense to confirm UI gets dedicated restore and bulk-delete actions.
- Confirm no archive mutation can delete an active task by API misuse.
- Confirm suggestion behavior still returns active and eligible standing tasks when no archived rows exist.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Guest Repository and Optimistic Mutation Parity

### Overview

Mirror the archive behavior in guest mode and expose optimistic client actions with rollback/error behavior consistent with S-09 task CRUD.

### Changes Required:

#### 1. Guest Task Repository

**File**: `src/lib/repositories/guest-repositories.ts`

**Intent**: Keep local guest behavior equivalent to authenticated archive behavior.

**Contract**: Guest `list()` runs the stale sweep before returning tasks. Add repository methods for restore and archived-only bulk delete. The guest stale predicate uses the same `updatedAt ?? createdAt` anchor, standing exemption, and `archivedAt` assignment semantics as the server.

#### 2. Data-Mode Context

**File**: `src/lib/data-mode/data-mode-context.tsx`

**Intent**: Ensure authenticated repository wrappers expose archive actions to hooks through the same abstraction used by guest mode.

**Contract**: Extend `TaskRepository`, `createServerTaskRepository`, `createGuestTaskRepository`, and the authenticated client shape in `DataModeProvider` with explicit `listArchived`, `restore`, and `deleteArchived` methods. The authenticated repository delegates to `task.archiveList`, `task.restore`, and `task.deleteArchived`; the guest repository mirrors the same semantics locally. Do not rely on ad-hoc component calls that bypass the data-mode abstraction.

#### 3. Task Mutation Hook

**File**: `src/hooks/use-task-mutations.ts`

**Intent**: Add optimistic archive UI actions that feel immediate and roll back cleanly.

**Contract**: Expose `restoreTask` and `deleteArchivedTasks` from the hook. For auth, patch the current `task.list` and `task.archiveList` caches before the server resolves; roll back on error; invalidate task list, archive list, recap if relevant, and any task-list-backed kickoff/suggestion eligibility after restore or permanent delete. For guest, call repository methods and refresh local task data through the existing refresh path.

#### 4. Hook Tests

**File**: `src/hooks/use-task-mutations.test.tsx`

**Intent**: Protect optimistic archive interactions and prevent S-09 responsiveness regressions.

**Contract**: Add tests for optimistic restore, bulk delete removal, rollback on restore/delete failure, and guest repository delegation.

### Success Criteria:

#### Automated Verification:

- Guest repository tests prove stale sweep, daily-standing exemption, restore sort order, and archived-only bulk delete.
- Hook tests prove restore and bulk delete update `task.list` and `task.archiveList` UI cache before the mutation resolves, then reconcile/rollback correctly.
- Existing task create/update/delete/reorder/mark-done hook tests still pass.
- Targeted command passes: `pnpm exec vitest run src/lib/repositories/guest-repositories.test.ts src/hooks/use-task-mutations.test.tsx`.
- `pnpm check` passes after repository and hook changes.

#### Manual Verification:

- In guest mode, create or seed stale tasks, reload the home view, and confirm stale non-standing tasks leave active inventory.
- In guest mode, restore an archived task and confirm it appears at the end of active tasks.
- Simulate or force a failed auth mutation and confirm the archive UI restores the previous state with the existing calm task error style.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Dedicated Archive View and Inventory Entry

### Overview

Add the user-facing archive review surface without refactoring the whole home IA. The archive should be a dedicated view reachable from the existing task inventory/home area, not a third section in the default active list.

### Changes Required:

#### 1. Archive View Component

**File**: `src/app/_components/task-archive-view.tsx`

**Intent**: Provide the separate review bucket required by S-44.

**Contract**: Render archived tasks with selection checkboxes, select-all, restore action, delete selected action, confirmation before permanent delete, selected count, and empty states. The component must not show focus, mark-done, reorder, or cycle controls.

#### 2. Task Inventory Integration

**File**: `src/app/_components/task-list.tsx`

**Intent**: Keep the default task list lean while offering a discoverable archive entry.

**Contract**: Filter only `status === "active"` and `status === "completed"` into the existing sections. Surface a small secondary archive entry or callback target near the task inventory that opens the archive view. Keep completed behavior and active drag-reorder unchanged.

#### 3. Dashboard/Home Composition

**File**: `src/app/_components/pomodoro-dashboard.tsx`

**Intent**: Wire archive view state and task refresh through the existing dashboard composition.

**Contract**: Toggle between task inventory and archive view, or show archive in a colocated panel/drawer, without changing timer/wedge overlays. Archive entry placement should be simple and movable later by S-40.

#### 4. Translations and Copy

**File**: `messages/en.json`

**File**: `messages/pl.json`

**Intent**: Add calm, clear archive copy with locale parity.

**Contract**: Add task archive strings under the `Tasks` namespace or a dedicated adjacent namespace. Copy should avoid punitive language; examples: "Archived tasks", "Review tasks that have been quiet for 3+ days", "Delete selected permanently", "No archived tasks".

#### 5. Component Tests

**File**: `src/app/_components/task-archive-view.test.tsx`

**File**: `src/app/_components/task-list.test.tsx`

**Intent**: Prove the archive UI behavior at the cheapest layer.

**Contract**: Tests cover active/completed filtering, archive entry visibility, archive empty state, multi-select/select-all, confirmation before delete, restore action, selected-count reset, and absence of cycle controls on archived rows.

### Success Criteria:

#### Automated Verification:

- Component tests prove archived tasks do not render in active or completed sections.
- Component tests prove archive view multi-select, select-all, restore, delete confirmation, and empty states.
- Translation structure remains valid for EN and PL, with no orphan user-facing strings in the new UI.
- Targeted command passes: `pnpm exec vitest run src/app/_components/task-list.test.tsx src/app/_components/task-archive-view.test.tsx`.
- `pnpm check` passes after UI and message changes.

#### Manual Verification:

- From the home/task inventory area, open the archive view in no more than two actions.
- Confirm archive view has calm copy, no guilt/streak language, and no focus-cycle controls.
- Select multiple archived tasks, cancel confirmation, and confirm nothing is removed.
- Delete selected archived tasks after confirmation and confirm they disappear from archive without changing visible active tasks.
- Restore an archived task and confirm it returns to active inventory at the end of the list.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 5: End-to-End Risk Proof and Final Hardening

### Overview

Add focused tests for the complete S-44 user outcome, then run the required quality gates. Keep the e2e surface targeted because router, hook, and component tests carry most of the signal.

### Changes Required:

#### 1. E2E Archive Scenario

**File**: `e2e/archive-old-tasks.spec.ts`

**Intent**: Prove the business outcome across browser, auth shell, archive entry, multi-select delete, and suggestion isolation.

**Contract**: Seed stale active tasks and fresh active tasks through existing e2e helpers/API setup. Open home/task inventory, confirm stale tasks are absent from active list and present in archive, select multiple archived tasks, permanently delete selected tasks, and confirm fresh active tasks and suggestion flow remain unaffected. Tag non-belt variants with `@skip-belt` if multiple cases are added.

#### 2. E2E Helpers or Seed Extension

**File**: `e2e/helpers/seed-scenario.ts`

**Intent**: Avoid slow UI setup for stale timestamp conditions.

**Contract**: Add a narrow seed helper for tasks with explicit `createdAt`, `updatedAt`, `status`, `archivedAt`, and `isDailyStanding` values, scoped to the authenticated test user.

#### 3. Belt Decision

**File**: `package.json`

**File**: `e2e/*`

**Intent**: Decide whether the archive scenario belongs in the belt merge gate.

**Contract**: Default to a targeted full-catalog e2e spec unless implementation reveals browser-only risk that component/router tests cannot cover. If the scenario is promoted to belt, update belt inventory and ensure `set CI=true && pnpm test:e2e:belt` remains practical.

#### 4. Final Quality Pass

**File**: project-wide

**Intent**: Catch cross-layer regressions before handoff.

**Contract**: Run the standard local gates and any targeted S-44 commands from earlier phases.

### Success Criteria:

#### Automated Verification:

- Targeted e2e scenario passes with `set CI=true && pnpm test:e2e e2e/archive-old-tasks.spec.ts`.
- If promoted to belt, `set CI=true && pnpm test:e2e:belt` passes and belt documentation stays accurate.
- Full project quality gate passes with `pnpm check`.
- Unit/integration suite passes with `pnpm test`.
- Type checking passes with `pnpm typecheck` if not already covered by `pnpm check`.

#### Manual Verification:

- Authenticated user can review stale archived tasks, restore one, and bulk delete others from the browser.
- Guest user can repeat the same archive/restore/delete flow locally.
- After deleting archived tasks, kickoff/post-check-in suggestion still works from remaining active tasks and never names a deleted or archived task.
- Confirm no timer, check-in, break, pause, or wedge overlay behavior changed during archive navigation.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to archive/review.

---

## Testing Strategy

### Unit Tests:

- Stale predicate around the exact three-day boundary using `updatedAt ?? createdAt`.
- Guest snapshot normalization for `status: "archived"` and missing `archivedAt`.
- Suggestion pool exclusion for archived tasks, including daily-standing edge cases.
- Archive view selection, restore, delete confirmation, and empty states.

### Integration Tests:

- tRPC archive list/sweep/restore/deleteArchived contracts with owner isolation.
- Guest import preserving archived status and `archivedAt`.
- Restore sort-order append behavior.
- Bulk delete rejecting non-archived and cross-user IDs.

### Manual Testing Steps:

1. Seed or create stale active, fresh active, completed, and daily-standing tasks.
2. Open home/task inventory and confirm only stale non-standing active tasks leave the default list.
3. Open archive view and confirm stale tasks appear with archive-focused actions only.
4. Restore one archived task and confirm it returns as active at the end of the list.
5. Select multiple archived tasks, cancel delete confirmation, then confirm permanent delete removes only selected archived tasks.
6. Run a kickoff or post-check-in suggestion and confirm archived/deleted tasks are not suggested.
7. Repeat archive flow in guest mode and then sign in to confirm archived guest tasks remain archived after import.

## Performance Considerations

The stale sweep is small-scale but runs on common inventory reads. Keep it to a scoped `updateMany` predicate using indexed `userId`/`status`/timestamp fields. Avoid per-task client-side loops for authenticated users. For guests, local snapshot scans are acceptable because data volume is small.

Optimistic restore and bulk delete should update the visible archive state before the network resolves, following the S-09 pattern and L-04's per-action responsiveness rule.

## Migration Notes

Additive migration only: `Task.archivedAt` starts as `null` for all existing tasks. Existing active and completed tasks keep their status. The first post-deploy inventory/archive read may lazily archive matching stale active, non-standing tasks. Rollback is simple at the app layer if needed: stop writing `"archived"` and ignore `archivedAt`; no existing completed/active semantics are overwritten except tasks already moved into archive.

## References

- Change brief: `context/changes/archive-old-tasks/change.md`
- Research: `context/changes/archive-old-tasks/research.md`
- PRD US-05: `context/foundation/prd.md`
- Roadmap S-44: `context/foundation/roadmap-references/items/S-44.md`
- Test strategy: `context/foundation/test-plan.md`
- Product voice: `context/foundation/product-voice.md`
- Lessons: `context/foundation/lessons.md`
- Schema: `prisma/schema.prisma`
- Task router: `src/server/api/routers/task.ts`
- Guest repository: `src/lib/repositories/guest-repositories.ts`
- Task mutation hook: `src/hooks/use-task-mutations.ts`
- Task list: `src/app/_components/task-list.tsx`
- Suggestion pool: `src/lib/suggestion/build-suggestion-pool.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` - <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Persistence and Shared Task Contracts

#### Automated

- [x] 1.1 Prisma migration and generated client update cleanly with `pnpm prisma migrate dev` — 721b89c
- [x] 1.2 TypeScript accepts `DomainTask` and mapper changes with `pnpm typecheck` — 721b89c
- [x] 1.3 Guest snapshot parsing preserves old snapshots without `archivedAt` and accepts archived tasks in schema or repository tests — 721b89c
- [x] 1.4 Guest import tests cover archived status and `archivedAt` preservation — 721b89c
- [x] 1.5 Full project quality check passes with `pnpm check` — 721b89c

#### Manual

- [ ] 1.6 Inspect generated migration for additive archive metadata/indexes only
- [ ] 1.7 Confirm pre-existing tasks without `archivedAt` still load in auth and guest task lists
- [ ] 1.8 Confirm no user-facing archive UI is exposed yet if later phases are incomplete

### Phase 2: Archive Rules, Router Procedures, and Suggestion Exclusion

#### Automated

- [ ] 2.1 Router tests cover stale predicate, three-day boundary, active-only behavior, daily-standing exemption, and no mutation of completed/archived tasks
- [ ] 2.2 Router tests cover restore appending to active sort order and clearing `archivedAt`
- [ ] 2.3 Router isolation tests cover cross-user archive list, restore, and `deleteArchived` denial/no-write
- [ ] 2.4 Router tests prove `deleteArchived` rejects mixed active/completed/non-owned IDs and deletes only archived user rows
- [ ] 2.5 Suggestion and hook/helper tests prove archived tasks are excluded from suggestion pools and kickoff eligibility while non-archived daily-standing tasks remain eligible unless done today
- [ ] 2.6 Targeted router/suggestion eligibility test command passes

#### Manual

- [ ] 2.7 Review archive router contracts in tRPC types or editor IntelliSense
- [ ] 2.8 Confirm no archive mutation can delete an active task by API misuse
- [ ] 2.9 Confirm suggestion behavior still returns active and eligible standing tasks when no archived rows exist

### Phase 3: Guest Repository and Optimistic Mutation Parity

#### Automated

- [ ] 3.1 Guest repository tests prove stale sweep, daily-standing exemption, restore sort order, and archived-only bulk delete
- [ ] 3.2 Hook tests prove restore and bulk delete update `task.list` and `task.archiveList` UI caches before the mutation resolves, then reconcile/rollback correctly
- [ ] 3.3 Existing task create/update/delete/reorder/mark-done hook tests still pass
- [ ] 3.4 Targeted guest and hook test command passes
- [ ] 3.5 `pnpm check` passes after repository and hook changes

#### Manual

- [ ] 3.6 In guest mode, stale non-standing tasks leave active inventory after reload
- [ ] 3.7 In guest mode, restoring an archived task returns it to the end of active tasks
- [ ] 3.8 Failed auth archive mutation restores previous state with the existing task error style

### Phase 4: Dedicated Archive View and Inventory Entry

#### Automated

- [ ] 4.1 Component tests prove archived tasks do not render in active or completed sections
- [ ] 4.2 Component tests prove archive view multi-select, select-all, restore, delete confirmation, and empty states
- [ ] 4.3 Translation structure remains valid for EN and PL with no orphan user-facing strings in the new UI
- [ ] 4.4 Targeted component test command passes
- [ ] 4.5 `pnpm check` passes after UI and message changes

#### Manual

- [ ] 4.6 Open archive view from home/task inventory in no more than two actions
- [ ] 4.7 Confirm archive view has calm copy and no focus-cycle controls
- [ ] 4.8 Cancel delete confirmation and confirm no archived tasks are removed
- [ ] 4.9 Confirm delete selected removes selected archived tasks without changing visible active tasks
- [ ] 4.10 Confirm restore returns an archived task to active inventory at the end of the list

### Phase 5: End-to-End Risk Proof and Final Hardening

#### Automated

- [ ] 5.1 Targeted e2e scenario passes with `set CI=true && pnpm test:e2e e2e/archive-old-tasks.spec.ts`
- [ ] 5.2 If promoted to belt, `set CI=true && pnpm test:e2e:belt` passes and belt documentation stays accurate
- [ ] 5.3 Full project quality gate passes with `pnpm check`
- [ ] 5.4 Unit/integration suite passes with `pnpm test`
- [ ] 5.5 Type checking passes with `pnpm typecheck` if not already covered by `pnpm check`

#### Manual

- [ ] 5.6 Authenticated user can review stale archived tasks, restore one, and bulk delete others from the browser
- [ ] 5.7 Guest user can repeat the archive/restore/delete flow locally
- [ ] 5.8 After deleting archived tasks, suggestions still work from remaining active tasks and never name a deleted or archived task
- [ ] 5.9 Confirm no timer, check-in, break, pause, or wedge overlay behavior changed during archive navigation
