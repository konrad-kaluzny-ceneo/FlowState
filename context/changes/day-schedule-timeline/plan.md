# S-54 Day Schedule Timeline Implementation Plan

## Overview

Replace the Plan dnia “Kalendarz wkrótce” placeholder with a real, persisted daily time axis for authenticated users. Blocks (focus, meeting, break, personal, planning, batch) are created, moved, and resized on a 06:00–22:00 timeline with 15-minute snap, optimistic mutations, overlap prevention, task attachments (FR-002), and GTD context (FR-004). Guest users see the existing `guestEmpty` sign-in card only — no blurred calendar mock (the calendar exists for accounts; teasing “coming soon” would be false).

## Current State Analysis

- **UI:** `plan-dnia-view.tsx` renders `ComingSoonPreview` + static `DayCalendarMock` (hard-coded 08:00–18:00 decorative blocks). Budget panel and delegation are real for auth.
- **Data:** `DayPlan` table stores `focusBudgetMinutes`, `usedFocusMinutes`, `energyLevel` per `(userId, localDateKey)` — no schedule entities.
- **API:** `dayPlan` tRPC router (`getOrCreate`, `setBudget`, `setEnergy`, delegation) — all `protectedProcedure`; no block procedures.
- **Data-mode:** Tasks/cycles/sessions use repository pattern; day plan bypasses it via direct tRPC hooks (`useDayPlan`).
- **Guest:** `/plan` passes `dayPlan={undefined}`; mock calendar + `guestEmpty` message.
- **Stack:** `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` present (task reorder in `task-list.tsx`).

### Key Discoveries

- PRD v4 requires schedule blocks on the **same `localDateKey`** as budget — do not introduce a parallel “day” model (`shape-notes.md`, `stack-assessment.md` Gap 1).
- Blocks must persist **without** requiring a focus budget row (`getOrCreate` today returns zeros when no row).
- S-54 roadmap cites FR-001–004; RRULE (FR-003) is **S-56**, not this slice.
- Auth-only schedule is an explicit guest exception (PRD OQ #1 decision); document in code comments near guest branch.

## Desired End State

A logged-in user on `/plan`:

1. Sees a scrollable **06:00–22:00** timeline instead of the blurred mock.
2. **Double-clicks** an empty slot or uses an **Add block** affordance to create a typed block.
3. **Drags** to move and **resizes** block edges; times snap to **15-minute** increments.
4. Gets a **validation error** (no silent overlap) if a move would conflict with another block.
5. Edits a block to attach **0–1 focus task** or **multiple batch tasks**, optional **meta label** on batch blocks, and **fixed or custom GTD context**.
6. Reloads the page — blocks remain for today's `localDateKey`.
7. Guest users see `guestEmpty` only — no `ComingSoonPreview`, no `DayCalendarMock`.

### Verification

- Automated: `pnpm check`, `pnpm typecheck`, `pnpm test`, targeted vitest for overlap validation + timeline component + day-plan router extensions; belt e2e smoke on `/plan`.
- Manual: create overlapping blocks (rejected); drag block across noon; attach tasks; add custom context tag and reuse on second block.

## What We're NOT Doing

- RRULE recurrence and pattern materialization (S-56 / FR-003)
- Planning session runtime “Teraz planuję” (S-55 / FR-005)
- Plan→Fokus handoff navigation (S-58 / FR-007)
- Day-open steering (S-59)
- Guest schedule localStorage / snapshot import
- Week view (PRD OQ #7 deferred)
- External calendar import
- Scorer/suggestion changes from block context
- Podsumowanie schedule analytics (S-61)
- Timer-hub / wedge / `use-pomodoro-cycle` edits

## Implementation Approach

Greenfield schedule domain attached to `(userId, localDateKey)`. Phase 1 lands schema + shared types. Phase 2 extends `dayPlan` router with block CRUD, overlap validation, and context-tag management; introduces `ScheduleRepository` (auth implementation only) and `useDaySchedule` with optimistic mutations mirroring S-09 task patterns. Phase 3 ships `DayScheduleTimeline` with vertical `@dnd-kit` drag/resize. Phase 4 adds block edit panel for attachments and context. Phase 5 consolidates tests and belt e2e.

## Critical Implementation Details

**Empty-slot create (Phase 3 UX):** Creating from the axis uses **double-click** on empty space (plus the **Add block** button), not single-click — single-click would fight drag/resize pointer handling. Plan Desired End State wording (“Clicks an empty slot”) is superseded by this interaction; i18n `addBlockDoubleClickAria` documents it.

**Overlap validation:** Server is source of truth — reject any block whose `[startMinute, startMinute + durationMinutes)` intersects another block for the same `(userId, localDateKey)`. Client may pre-check for UX but must handle `CONFLICT` tRPC error with optimistic rollback. **Concurrency:** wrap create/update in a DB transaction — re-list blocks for the day inside the transaction before insert/update so two concurrent mutations cannot both pass a stale overlap check (read-modify-write race). Take a per-`(userId, localDateKey)` `pg_advisory_xact_lock` (seed 1) so Read Committed cannot double-book empty days.

**Axis bounds:** Blocks must lie fully within the visible axis: `startMinute >= AXIS_START_MINUTE (360)` and `startMinute + durationMinutes <= AXIS_END_MINUTE (1320)`. Reject (do not silently clamp) on server; client snap/clamp may assist UX but server validates.

**Block persistence without budget:** `ScheduleBlock` uses `(userId, localDateKey)` directly — do not require a `DayPlan` row. Budget panel continues to lazy-create `DayPlan` only on `setBudget` / `setEnergy`.

**Task IDs:** `Task.id` is `Int` (autoincrement) — `focusTaskId` and batch `taskIds` use `number` / `z.number().int()`, not string cuids. `ScheduleBlock.id` and `UserContextTag.id` are also `Int @default(autoincrement())`; `blockId` / `tagId` / `customContextTagId` use `z.number().int()`.

**Context XOR:** At most one of `fixedContext` and `customContextTagId` may be non-null. Both null is allowed (no context). Reject payloads that set both; the edit modal clears the other field in the same mutation.

**Guest branch:** Do not mount `DayScheduleTimeline` or call block queries when `mode === "guest"`. Delete `DayCalendarMock`, `CALENDAR_HOURS`, `CALENDAR_BLOCKS`, and the `ComingSoonPreview` wrapper — guest keeps the `guestEmpty` card (“Plan dnia jest dostępny po zalogowaniu.”). Guest `Repositories` includes a `schedule` stub that throws if invoked — UI must never call it.

**localDateKey rollover:** `useDaySchedule` must consume the same `localDateKey` as `useDayPlan` — passed from `AuthenticatedPlanPage` (do not maintain a separate date key in the view). On visibility rollover, invalidate `dayPlan.listBlocks` for the new key alongside existing `getOrCreate` / `task.list` invalidations (in `useDayPlan`'s existing listener or a `useEffect` in `useDaySchedule` keyed on `localDateKey`).

**PLANNING blocks:** Schedule slot only in S-54 — no “Teraz planuję” runtime, elapsed tracking, or wedge gates (S-55 / FR-005).

## Phase 1: Schema & Domain Types

### Overview

Introduce persisted schedule entities, enums, and shared domain types used by router, repository, and UI.

### Changes Required:

#### 1. Prisma schema

**File**: `prisma/schema.prisma`

**Intent**: Persist schedule blocks, batch task attachments, and reusable custom context tags per user.

**Contract**:
- Enum `ScheduleBlockType`: `FOCUS`, `MEETING`, `BREAK`, `PERSONAL`, `PLANNING`, `BATCH`
- Enum `GtdFixedContext`: `PHONE`, `COMPUTER`, `OFFICE`, `ERRANDS` (nullable on block — context optional)
- Model `UserContextTag`: `id Int @id @default(autoincrement())`, `userId` (plain string, no User FK), `label` (varchar bounded, e.g. 32), `createdAt`, `updatedAt`; `@@unique([userId, label])`; `@@map("flow_state_user_context_tag")`
- Model `ScheduleBlock`: `id Int @id @default(autoincrement())`, `userId`, `localDateKey` (VarChar 10), `blockType`, `startMinute` (Int, axis-validated 360–1305), `durationMinutes` (Int ≥ 15), optional `metaLabel` (batch display), optional `fixedContext`, optional `customContextTagId` FK, optional `focusTaskId` Int FK → `Task` (`onDelete: SetNull`, FOCUS only), `createdAt` / `updatedAt`; index `(userId, localDateKey)`; `@@map("flow_state_schedule_block")`
- Model `ScheduleBlockTask`: `scheduleBlockId`, `taskId` (`onDelete: Cascade` — join rows drop when the task is deleted; batch block remains), `sortOrder`; `@@unique([scheduleBlockId, taskId])`; `@@map("flow_state_schedule_block_task")`
- Add opposite Prisma relations on `Task` (`scheduleFocusBlocks`, `scheduleBatchLinks`) — required for the FKs; no `User` model (plain `userId` string, same as `DayPlan`)
- When `focusTaskId` is null after task delete, timeline chip shows block type only (no task title)
- Run `pnpm prisma migrate dev` — never hand-write SQL.

#### 2. Domain types & validation helpers

**Files**: `src/lib/schedule/types.ts` (new), `src/lib/schedule/overlap.ts` (new), `src/lib/schedule/snap.ts` (new)

**Intent**: Shared types and pure functions for 15-minute snap, axis bounds, and overlap detection reused by server and client.

**Contract**:
- Constants: `AXIS_START_MINUTE = 360` (06:00), `AXIS_END_MINUTE = 1320` (22:00), `SNAP_MINUTES = 15`
- `snapMinute(value: number): number`, `intervalsOverlap(a, b): boolean`
- Export `DomainScheduleBlock` shape mirroring API output (includes resolved context label, focus task summary, batch task ids)

#### 3. i18n keys (skeleton)

**Files**: `messages/pl.json`, `messages/en.json`

**Intent**: Add `PlanDnia` namespace keys for block type labels, axis errors, context names, edit panel copy. Remove mock-only keys (`blockFocus`, `blockMeeting`, `blockBreak`, `blockPersonal`, `calendarComingSoon`) once `DayCalendarMock` is deleted in Phase 3. Keep `guestEmpty`.

**Contract**: Keys for six block types, overlap error, add/edit/delete actions, fixed context enum labels, custom tag create placeholder.

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly: `pnpm prisma migrate dev`
- `pnpm check` and `pnpm typecheck` pass
- `pnpm exec vitest run src/lib/schedule/overlap.test.ts` — overlap edge cases (adjacent blocks OK, partial overlap rejected)
- `pnpm exec vitest run src/lib/schedule/snap.test.ts` — snap rounds to nearest 15 min within axis

#### Manual Verification:

- Prisma Studio shows new tables after migrate
- Enum values match UI block type palette from mock (focus/meeting/break/personal + planning/batch)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Repository & tRPC

### Overview

Extend `dayPlan` router with block and context-tag procedures; add auth repository wiring and `useDaySchedule` hook skeleton with query enabled for authenticated mode only.

### Changes Required:

#### 1. Overlap-aware block service

**File**: `src/server/api/lib/schedule-blocks.ts` (new)

**Intent**: Centralize create/update/delete/list with overlap validation and attachment invariants.

**Contract**:
- `listBlocksForDay(db, userId, localDateKey)` → ordered by `startMinute`
- `createBlock`, `updateBlock`, `deleteBlock` — validate snap (% 15 === 0), duration ≥ 15, axis bounds (see Critical Implementation Details), no overlap; each mutator runs in a transaction with same-day block re-read before write
- `focusTaskId` allowed only when `blockType === FOCUS`; at most one non-null
- `ScheduleBlockTask` rows only when `blockType === BATCH`
- **Type change (same transaction):** FOCUS → other nulls `focusTaskId`; BATCH → other deletes `ScheduleBlockTask` rows and nulls `metaLabel`; other → FOCUS/BATCH starts with empty attachments. Reject a payload that keeps leftover attachments on an incompatible type
- Map Prisma rows to `DomainScheduleBlock`

#### 2. Extend dayPlan router

**File**: `src/server/api/routers/day-plan.ts`

**Intent**: Expose schedule block CRUD and context tag management under existing `dayPlan` namespace.

**Contract** (all `protectedProcedure`):
- `listBlocks({ localDateKey })` → `DomainScheduleBlock[]`
- `createBlock({ localDateKey, blockType, startMinute, durationMinutes, metaLabel?, fixedContext?, customContextTagId? })` — reject if both context fields are non-null; `customContextTagId` is `z.number().int()`
- `updateBlock({ blockId: z.number().int(), ...partial fields including blockType, startMinute, durationMinutes, fixedContext, customContextTagId })` — type change follows schedule-blocks cleanup rules above; context XOR same as create
- `deleteBlock({ blockId: z.number().int() })`
- `setBlockFocusTask({ blockId, taskId | null })`
- `setBlockBatchTasks({ blockId, taskIds: number[] })`
- `listContextTags()` → user tags
- `createContextTag({ label })` — trim, strip control chars, max 32 chars, dedupe via unique constraint; reject when user already has 50 tags
- `deleteContextTag({ tagId: z.number().int() })` — reject with calm message if any block still references the tag (do not null FK silently)
- Overlap failure → `TRPCError` code `CONFLICT` with calm message key for i18n

#### 3. Repository interface (auth-only impl)

**Files**: `src/lib/data-mode/types.ts`, `src/lib/repositories/server-repositories.ts`

**Intent**: Introduce `ScheduleRepository` contract so future guest parity has a seam; auth impl delegates to tRPC client.

**Contract**:
- `ScheduleRepository`: `listBlocks(localDateKey)`, `createBlock(...)`, `updateBlock(...)`, `deleteBlock(id)`, attachment + context tag methods matching router
- Add `schedule` to `Repositories` type; wire in `data-mode-context.tsx` for authenticated mode only
- Guest factory: `createGuestRepositories` returns a `schedule` stub whose methods throw `Error("Schedule not available in guest mode")` — **not used** because UI gates on auth; document in `change.md` Notes

#### 4. useDaySchedule hook

**File**: `src/hooks/use-day-schedule.ts` (new)

**Intent**: Auth-only query + mutation wrappers with `localDateKey` from `useDayPlan` or shared `formatLocalDateKey()` + visibility rollover alignment.

**Contract**:
- `enabled: mode === "authenticated"`
- Accept `localDateKey` from `useDayPlan()` (single source — do not maintain a separate date key state)
- Query key includes `localDateKey`
- Exposes `blocks`, `isLoading`, `createBlock`, `updateBlock`, `deleteBlock`, attachment mutators, `contextTags`
- Phase 2: pessimistic mutations intentional (API/router verification before UI); Phase 3 adds optimistic create/move/resize/delete; Phase 4 adds optimistic attachment/context mutators (L-04 per-surface oracle)

#### 5. Router tests

**Files**: `src/server/api/routers/day-plan.test.ts` (extend), `src/server/api/routers/day-plan-schedule.integration.test.ts` (new), `src/server/api/routers/day-plan-schedule-isolation.test.ts` (new)

**Intent**: Cover overlap rejection, attachment invariants, context tag CRUD, per-user isolation.

**Contract**: Two users same `localDateKey` cannot see each other's blocks; adjacent non-overlapping blocks succeed; isolation file follows `task-isolation.test.ts` / `*-isolation.test.ts` naming; integration file covers CRUD + CONFLICT + tag-delete-when-in-use.

### Success Criteria:

#### Automated Verification:

- `pnpm check` and `pnpm typecheck` pass
- `pnpm exec vitest run src/server/api/routers/day-plan.test.ts src/server/api/routers/day-plan-schedule.integration.test.ts`
- `pnpm test` full suite green

#### Manual Verification:

- tRPC playground / temporary dev call: create two non-overlapping blocks, third overlapping returns CONFLICT
- Custom context tag create + assign to block persists

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Timeline UI

### Overview

Replace `ComingSoonPreview` + `DayCalendarMock` with interactive `DayScheduleTimeline` for authenticated users — 06:00–22:00 axis, drag, resize, 15-minute snap, optimistic block CRUD. Delete the mock entirely; guests keep `guestEmpty` only.

### Changes Required:

#### 1. DayScheduleTimeline component

**File**: `src/app/_components/day-schedule-timeline.tsx` (new)

**Intent**: Render hour grid, block chips positioned by `startMinute`/`durationMinutes`, handle pointer drag to move and edge drag to resize.

**Contract**:
- Props: `blocks`, `localDateKey`, mutation callbacks from `useDaySchedule`
- Visual: reuse mock color tokens (`worktype-deep`, `ops`, break, energy-fading) extended for planning/batch types
- **Not** `SortableContext` / `verticalListSortingStrategy` (task-list reorder pattern) — use `@dnd-kit/core` `Draggable` + custom `modifiers` (or pointer handlers on block edges for resize) to map Y delta → `startMinute` / `durationMinutes`; budget a Phase 3 spike if modifiers insufficient
- Snap applied before calling `updateBlock`
- Empty-slot click → create default 30-min block of selected/default type (focus)
- Inline overlap error from mutation rollback
- `data-testid` hooks for e2e: `schedule-timeline`, `schedule-block-{id}`, `schedule-add-block`

#### 2. Optimistic mutations in useDaySchedule

**File**: `src/hooks/use-day-schedule.ts`

**Intent**: ≤200ms perceived updates on create/move/resize/delete with rollback on error (S-09 pattern).

**Contract**:
- Use tRPC utils cache + `onMutate` / `onError` rollback for `listBlocks` query
- Debounce not required — single mutation per drag end

#### 3. Integrate into plan-dnia-view

**File**: `src/app/_components/plan-dnia-view.tsx`

**Intent**: Auth path renders `DayScheduleTimeline`. Delete `DayCalendarMock`, `CALENDAR_HOURS`, `CALENDAR_BLOCKS`, and `ComingSoonPreview` from this view — the calendar is no longer “coming soon”.

**Contract**:
- Auth path: render `<DayScheduleTimeline />` above budget panel
- Guest path: `guestEmpty` card only (no calendar preview, no “Kalendarz wkrótce”)
- Loading skeleton for timeline while `useDaySchedule.isLoading`

#### 4. Plan page wiring

**File**: `src/app/plan/page.tsx`

**Intent**: `AuthenticatedPlanPage` calls `useDayPlan` and `useDaySchedule` and passes both into `PlanDniaView`. Do not compose `useDaySchedule` inside the view while `useDayPlan` stays on the page. Guest page stays hook-free (`dayPlan={undefined}`).

**Contract**: Authenticated page mounts timeline without regressing budget/delegation sections. `useDaySchedule` receives `localDateKey` from the page's `useDayPlan()` return (single source).

#### 5. Component tests

**File**: `src/app/_components/day-schedule-timeline.test.tsx` (new), update `plan-dnia-view.test.tsx`

**Intent**: Assert auth renders timeline test ids; guest does **not** render `plan-dnia-calendar-preview` and still shows `plan-dnia-guest-empty`; overlap error surfaces.

**Contract**: Mock `useDaySchedule`; do not require full dnd pointer simulation in unit tests — test render + callback wiring.

### Success Criteria:

#### Automated Verification:

- `pnpm check` and `pnpm typecheck` pass
- `pnpm exec vitest run src/app/_components/day-schedule-timeline.test.tsx src/app/_components/plan-dnia-view.test.tsx`
- `pnpm test` full suite green

#### Manual Verification:

- Add block at 09:00, drag to 10:30, resize to 45 min — reload persists
- Attempt overlap — block snaps back with error message
- Guest `/plan` shows `guestEmpty` only — no blurred calendar

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Attachments & Context

### Overview

Block edit panel for FR-002 (focus task picker, batch checklist + meta label) and FR-004 (fixed context enum + custom tag picker).

### Changes Required:

#### 1. Block edit panel

**File**: `src/app/_components/schedule-block-edit-panel.tsx` (new)

**Intent**: `ModalShell` (same primitive as `TaskDetailPanel` in `overlay-shell.tsx`) opened from block click — edit type, times, context, attachments. Do not add Sheet/Popover/Dialog primitives.

**Contract**:
- FOCUS: single task combobox from **active or planned** tasks (same filter as Fokus picker / delegation pool; reuse task list filtering patterns)
- BATCH: multi-select checklist of **active or planned** tasks + optional `metaLabel` text field (both per user decision)
- Context: radio/select for fixed enum + dropdown of `UserContextTag` + “Add tag” inline create; choosing one clears the other (XOR with server reject if both set)
- Delete block action with confirm
- Meeting/break/personal/planning: context optional; no task attachments except batch/focus rules
- Tiny time tweaks may stay on the timeline chip; type / attachments / context open `ModalShell`

#### 2. Wire panel to timeline

**File**: `src/app/_components/day-schedule-timeline.tsx`

**Intent**: Open edit panel on block click; close on save/outside click.

**Contract**: Selected block id state; panel calls `setBlockFocusTask`, `setBlockBatchTasks`, context mutators.

#### 3. Task ownership validation

**File**: `src/server/api/lib/schedule-blocks.ts`

**Intent**: Reject attaching tasks not owned by user or not `active`/`planned` status (reject `completed`, `archived`, `blocked`, `delegated`).

**Contract**: Validate `taskId` on attachment mutations; batch preserves `sortOrder` from input array.

#### 4. i18n completion

**Files**: `messages/pl.json`, `messages/en.json`

**Intent**: All user-visible attachment/context strings through `PlanDnia` or new `ScheduleBlock` namespace.

**Contract**: No hard-coded Polish in components.

### Success Criteria:

#### Automated Verification:

- `pnpm check` and `pnpm typecheck` pass
- `pnpm exec vitest run src/app/_components/schedule-block-edit-panel.test.tsx`
- Router tests cover invalid task attachment rejection

#### Manual Verification:

- Focus block: attach one task, switch task, clear attachment
- Batch block: attach 3 tasks, set meta label “Telefony”, see label on timeline chip
- Create custom tag “Dom”, assign to two blocks same day

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 5: Tests & Verification

### Overview

Harden test coverage, add belt e2e smoke for Plan dnia schedule, update roadmap status.

### Changes Required:

#### 1. Hook tests

**File**: `src/hooks/use-day-schedule.test.tsx` (new)

**Intent**: Auth enables query; guest does not fetch; optimistic rollback on CONFLICT.

**Contract**: Mirror `use-day-plan.test.tsx` patterns with TRPC mock; include attachment mutator optimistic rollback tests (L-04).

#### 2. E2E belt spec

**File**: `e2e/plan-schedule.spec.ts` (new)

**Intent**: Authenticated worker opens `/plan`, creates block via API seed or UI, asserts timeline renders block chip.

**Contract**: Tag `@skip-belt` only for cases requiring fragile drag simulation; belt case uses tRPC seed + visibility assert.
- Import `{ expect, test }` from `e2e/fixtures.ts` (worker `storageState` from `e2e/.auth/worker-{n}.json` — same as `e2e/seed.spec.ts`). Do **not** UI-login with `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD`.
- Seed blocks via `page.request` tRPC helpers modeled on `e2e/helpers/daily-plan.ts` (`trpcMutation` / `dayPlan.setBudget`), calling `dayPlan.createBlock` once Phase 2 exists.

#### 3. MCP optional read extension

**File**: `src/app/api/mcp/mcp-tools.ts`

**Intent**: If low effort, extend `get_day_plan` response with block count summary for agents — optional, skip if >30 min scope.

**Contract**: Document in plan only if implemented; otherwise defer.

#### 4. Status sync

**Files**: `context/foundation/roadmap.md` (S-54 → active when implementation starts, not at plan time)

**Intent**: Implementer runs `/update-status` when branch opens.

**Contract**: GitHub #220, Linear issue when created.

### Success Criteria:

#### Automated Verification:

- `pnpm check`, `pnpm typecheck`, `pnpm test` pass
- `set CI=true && pnpm test:e2e:belt` pass (new spec included or `@skip-belt` with belt subset passing)

#### Manual Verification:

- Full auth manual walkthrough on `/plan`: create day, edit attachments, next-day empty timeline (new `localDateKey`). For agent browser login, read `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD` from `.env` (lessons — manual verification only; never paste values into the plan).
- Verify budget panel and delegation still work below timeline

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests

- `overlap.test.ts` — adjacent, contained, partial overlap
- `snap.test.ts` — boundary 06:00/22:00 clamping
- `day-plan-schedule.integration.test.ts` — CRUD + isolation + CONFLICT
- `day-schedule-timeline.test.tsx` — render gates auth vs guest
- `schedule-block-edit-panel.test.tsx` — focus single-select, batch multi-select

### Integration Tests

- Two-user isolation on same date key
- Delete context tag blocked when in use (reject, not cascade null)
- Attach completed/archived/blocked/delegated task rejected; `active` and `planned` allowed
- Axis overflow (block ending after 22:00) rejected
- Concurrent overlap attempt: second transaction returns CONFLICT (mock or integration)

### Manual Testing Steps

1. Log in, open Plan dnia, create focus block 09:00–09:30, attach task.
2. Create batch block 10:00–10:30 with meta label + 2 tasks.
3. Drag focus block to overlap batch — expect error, no persistence.
4. Reload — blocks remain.
5. Open as guest — `guestEmpty` sign-in card, no calendar mock.

## Performance Considerations

- Single-day block list expected <50 blocks — no virtualization required for v1.
- Optimistic updates keep perceived latency ≤200ms (PRD v4 SLA).
- Index `(userId, localDateKey)` supports list query.

## Migration Notes

- New tables only — no backfill; existing users see empty timeline until they add blocks.
- Remove unused mock i18n keys (`calendarComingSoon`, `blockFocus`, etc.) in Phase 3 when `DayCalendarMock` is deleted. Keep `guestEmpty`.

## References

- Slice card: `context/foundation/roadmap-references/items/S-54.md`
- PRD v4: `context/foundation/prd-v4.md` (US-08, US-15, FR-001–004)
- Stack guidance: `context/foundation/stack-assessment.md` (Gap 1, Gap 4)
- Prior day-plan slice: `context/archive/2026-06-19-daily-standing-tasks-capacity-plan/plan.md`
- UI placeholder: `src/app/_components/plan-dnia-view.tsx`
- dnd precedent: `src/app/_components/task-list.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Schema & Domain Types

#### Automated

- [x] 1.1 Migration applies cleanly: `pnpm prisma migrate dev` — 42925aa
- [x] 1.2 `pnpm check` and `pnpm typecheck` pass — 42925aa
- [x] 1.3 `pnpm exec vitest run src/lib/schedule/overlap.test.ts` — 42925aa
- [x] 1.4 `pnpm exec vitest run src/lib/schedule/snap.test.ts` — 42925aa

#### Manual

- [x] 1.5 Prisma Studio shows new tables after migrate — 42925aa

### Phase 2: Repository & tRPC

#### Automated

- [x] 2.1 `pnpm check` and `pnpm typecheck` pass — 4ad0efc
- [x] 2.2 `pnpm exec vitest run src/server/api/routers/day-plan.test.ts src/server/api/routers/day-plan-schedule.integration.test.ts src/server/api/routers/day-plan-schedule-isolation.test.ts` — 4ad0efc
- [x] 2.3 `pnpm test` full suite green — 4ad0efc

#### Manual

- [x] 2.4 tRPC manual: overlap CONFLICT and context tag assign persist — 4ad0efc

### Phase 3: Timeline UI

#### Automated

- [x] 3.1 `pnpm check` and `pnpm typecheck` pass — a156e70
- [x] 3.2 `pnpm exec vitest run src/app/_components/day-schedule-timeline.test.tsx src/app/_components/plan-dnia-view.test.tsx` — a156e70
- [x] 3.3 `pnpm test` full suite green — a156e70

#### Manual

- [x] 3.4 Manual drag/resize/reload persist; guest sees `guestEmpty` only (no calendar mock) — a156e70

### Phase 4: Attachments & Context

#### Automated

- [x] 4.1 `pnpm check` and `pnpm typecheck` pass — 91001eb
- [x] 4.2 `pnpm exec vitest run src/app/_components/schedule-block-edit-panel.test.tsx` — 91001eb
- [x] 4.3 Router tests cover invalid task attachment rejection — 91001eb

#### Manual

- [x] 4.4 Manual focus/batch/context attachment walkthrough — 91001eb — 91001eb

### Phase 5: Tests & Verification

#### Automated

- [x] 5.1 `pnpm check`, `pnpm typecheck`, `pnpm test` pass — b1eb911
- [x] 5.2 `set CI=true && pnpm test:e2e:belt` pass — b1eb911

#### Manual

- [x] 5.3 Full auth manual walkthrough; budget and delegation regression check — b1eb911
