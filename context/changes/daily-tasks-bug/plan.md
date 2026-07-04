# Daily standing task list completion fix — Implementation Plan

## Overview

Fix a task-list regression where active tasks with `isDailyStanding: true` call `markDoneForToday` on checkbox click instead of `updateTask({ status: "completed" })`. That leaves the task in **Aktywne** with a non-interactive checkmark and no revert path. Daily inclusion must not change list placement — completion always moves a task to **Ukończone** with the existing revert control.

Branch: `features/mvp-defect-intake` (shared MVP defect intake — do not create a separate feature branch).

## Current State Analysis

Task list sections partition purely by `status`:

- `activeTasks = tasks.filter(t => t.status === "active")` — `task-list.tsx:661`
- `completedTasks = tasks.filter(t => t.status === "completed")` — `task-list.tsx:662`

In `SortableActiveTaskRow`, the complete control branches on `isDailyStanding`:

- `task-list.tsx:392-395` — standing tasks call `onMarkDoneForToday(task.id)` and return early.
- `markDoneForToday` optimistically sets `doneForToday: true` while `status` stays `"active"` — `use-task-mutations.ts:398-399`.
- When `doneForToday` is true, the row renders a static `<span>✓</span>` instead of a button — `task-list.tsx:374-380` — so the user cannot undo from the list.

The `isDailyStanding` flag is still correct for badges, recap/plan surfaces, and suggestion pool weighting; only the **list complete action** is wrong.

### Key Discoveries:

- Root cause is localized to `SortableActiveTaskRow` complete handler — no schema or API change required for the reported bug.
- `markDoneForToday` remains used by `pomodoro-dashboard.tsx:1078-1088` on cycle-complete confirm for focused daily standing tasks — a separate flow; not part of this defect report.
- Unit test `calls markDoneForToday for standing tasks instead of global complete` (`task-list.test.tsx:867`) encodes the buggy behavior and must flip.
- Test `renders daily standing toggle…` (`task-list.test.tsx:778`) expects aria `"Done for today"` on standing rows — must align with unified `"Mark complete"`.

## Desired End State

When the user clicks the complete checkbox on any active task (including daily standing):

1. The task receives `status: "completed"` via the same path as non-standing tasks (including mid-cycle and animation hooks when applicable).
2. The task appears under **Ukończone** (`sectionCompleted`).
3. The user can revert via the existing completed-row control (`revertAria` → `status: "active"`).
4. `isDailyStanding` continues to show the Daily badge and feed recap/plan data; it does not alter section membership.

### Verification

- Automated: `pnpm check`, `pnpm exec vitest run src/app/_components/task-list.test.tsx`, full `pnpm test`.
- Manual: create task with “Uwzględnij w Daily” checked → complete → confirm **Ukończone** + revert works (PL locale).

## What We're NOT Doing

- Changing `markDoneForToday` API, Prisma `taskDayCompletion`, or midnight reset logic (S-27 recap still owns daily completion records).
- Changing pomodoro cycle-complete overlay behavior (`pomodoro-dashboard.tsx` daily branch) — separate product surface; revisit only if product wants unified semantics there too.
- Migrating existing rows stuck with `doneForToday: true` + `status: "active"` (manual revert or wait for midnight reset is acceptable for MVP).
- Removing `doneForToday` display branch for rows marked via pomodoro (rare edge; out of scope).
- New e2e belt spec — unit coverage is sufficient for this one-handler fix.

## Implementation Approach

Single-file UI fix: remove the standing-task special case in the active-row complete handler so all active tasks share one completion pipeline. Delete now-unused `handleMarkDoneForToday` wiring and the `onMarkDoneForToday` prop from `SortableActiveTaskRow`. Update co-located tests to assert standing tasks use `updateTask({ status: "completed" })` and unified aria labels.

## Critical Implementation Details

**State sequencing:** Keep `onBeginComplete` + `updateTask({ status: "completed" })` ordering identical to non-standing tasks so the complete animation still runs.

**User experience spec:** Use `markCompleteAria` for every active-row complete button — do not branch aria on `isDailyStanding`.

## Phase 1: Unify active-row completion handler

### Overview

Remove the standing-task branch so checkbox click always completes into **Ukończone**.

### Changes Required:

#### 1. SortableActiveTaskRow complete control

**File**: `src/app/_components/task-list.tsx`

**Intent**: Stop routing daily standing tasks through `markDoneForToday`; use the standard complete mutation for all active tasks.

**Contract**:

- Delete early return `if (task.isDailyStanding) { onMarkDoneForToday(...); return; }` at `:392-395`.
- Set complete button `aria-label` to `t("markCompleteAria")` unconditionally (remove `:384-386` branch).
- Remove `onMarkDoneForToday` from `SortableActiveTaskRowProps`, destructuring, and call site in the active-task map.
- Remove `handleMarkDoneForToday`, `markDoneForToday` destructure from `useTaskMutations()`, and `formatLocalDateKey` import if no longer referenced.

### Success Criteria:

#### Automated Verification:

- `pnpm check` passes (Biome + format).
- `pnpm typecheck` passes.
- `pnpm exec vitest run src/app/_components/task-list.test.tsx` passes.

#### Manual Verification:

- Daily standing active task moves to **Ukończone** after checkbox click.
- Revert button returns task to **Aktywne**.
- Non-standing task behavior unchanged.

**Implementation Note**: Pause after Phase 1 automated green + manual confirmation before closing the change.

---

## Phase 2: Regression tests

### Overview

Flip tests that encoded the buggy standing-task path and assert unified completion UX.

### Changes Required:

#### 1. task-list.test.tsx

**File**: `src/app/_components/task-list.test.tsx`

**Intent**: Tests must guard the fixed behavior — standing tasks complete like any other task.

**Contract**:

- Replace `calls markDoneForToday for standing tasks instead of global complete` with a test that clicks `"Mark complete"`, expects `updateTask({ id, status: "completed" })`, and asserts `markDoneForToday` was **not** called.
- In `renders daily standing toggle in create form and badge on standing tasks`, expect two `"Mark complete"` buttons (or `getAllByRole`) instead of `"Done for today"` for the standing row.
- Keep `does not use line-through on done-for-today active task titles` — still valid for pomodoro-set `doneForToday` rows.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/app/_components/task-list.test.tsx` — all cases green.
- `pnpm test` — full suite green.

#### Manual Verification:

- None beyond Phase 1.

---

## Testing Strategy

### Unit Tests:

- Standing task complete → `updateTask` with `status: "completed"`, not `markDoneForToday`.
- Both standing and regular rows expose `task-complete-button` with `markCompleteAria`.
- Existing completed-row revert test unchanged.

### Integration Tests:

- Not required — handler is client-only; optimistic path already covered in `use-task-mutations.test.tsx`.

### Manual Testing Steps:

1. Open task list (PL locale).
2. Add task with “Uwzględnij w Daily” checked.
3. Click complete checkbox → task in **Ukończone**.
4. Click revert → task back in **Aktywne** with Daily badge intact.

## Performance Considerations

None — removes one conditional branch; no new network calls.

## Migration Notes

No migration. Existing `doneForToday` + `active` rows (if any) remain until user reverts manually or daily reset clears `doneForToday` on next local day fetch.

## References

- Change notes: `context/changes/daily-tasks-bug/change.md`
- Buggy handler: `src/app/_components/task-list.tsx:374-407`
- Section filters: `src/app/_components/task-list.tsx:661-662`
- Optimistic `markDoneForToday`: `src/hooks/use-task-mutations.ts:393-400`
- Prior standing-task test: `src/app/_components/task-list.test.tsx:867-885`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Unify active-row completion handler

#### Automated

- [x] 1.1 `pnpm check` passes
- [x] 1.2 `pnpm typecheck` passes
- [x] 1.3 `pnpm exec vitest run src/app/_components/task-list.test.tsx` passes (after Phase 2 test updates land — run again at end)

#### Manual

- [x] 1.4 Daily standing task completes into **Ukończone** and reverts to **Aktywne**

### Phase 2: Regression tests

#### Automated

- [x] 2.1 Standing-task test expects `updateTask({ status: "completed" })`, not `markDoneForToday`
- [x] 2.2 Daily toggle/badge test uses unified `"Mark complete"` aria
- [x] 2.3 Full `pnpm test` passes
