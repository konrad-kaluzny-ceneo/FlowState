# Unify task completion affordance Implementation Plan

## Overview

Reconcile the task list’s dual completion models so users see **one checkbox-style control per row** instead of a text “Done today” button on standing tasks and a circle “Mark complete” on others. Preserve S-27 standing semantics (`TaskDayCompletion` / `markDoneForToday`) and suggestion-pool exclusion; do **not** naively delete the write path. Reduce how often users encounter mixed row types by defaulting new tasks to non-standing.

## Current State Analysis

The list renders **mutually exclusive** controls per row (`task-list.tsx:335-381`): standing tasks show a text “Done today” button (`data-testid="done-for-today-button"`); non-standing tasks show an empty-circle checkbox that sets `status: "completed"`. New tasks default `isDailyStanding: true` in the create form (`task-list.tsx:574-585`) while Prisma defaults `false` (`schema.prisma:77`), so users frequently see both patterns on one screen.

`markDoneForToday` is intentional S-27 design — it upserts `TaskDayCompletion` while keeping `Task.status: "active"`, feeding suggestion pool exclusion and kickoff eligibility. Daily recap **Last 24h** already uses COMPLETED WORK cycles plus globally completed tasks (`build-daily-recap.ts:27-70`); day completions are not a recap source today.

A third path exists: cycle-complete overlay always offers global “mark task complete” (`cycle-complete-overlay.tsx:101-108`) regardless of standing flag.

### Key Discoveries:

- Naive button removal breaks standing day completion with **no replacement write path** — belt e2e fails (`e2e/daily-standing-capacity.spec.ts:111-160`).
- Frame reframed user report: UX confusion at list level, not recap misread (`frame.md` Reframed Problem Statement).
- Research Option **B** (UI unification, no backend change) is the smallest fix that addresses the reported symptom.
- `task-list.test.tsx:724-742` asserts standing rows call `markDoneForToday`, not global complete — must survive refactor.

## Desired End State

- Every active task row shows the **same** circle checkbox control (matching non-standing visual today).
- Clicking the control on a **standing** task calls `markDoneForToday` (per-day, task stays active, dimmed + ✓ when done).
- Clicking on a **non-standing** task keeps current global-complete behavior (including mid-cycle path when applicable).
- New tasks default **Daily standing OFF** unless the user opts in.
- Cycle-complete overlay on a **standing** focused task offers “Done for today” as the primary success action (not global archive).
- Belt e2e `standing task marked done for today is excluded from kickoff suggestions` passes.
- No schema, router, or guest-store changes.

### Verification

1. Create one standing and one regular task — both rows show identical checkbox chrome.
2. Mark standing done — row dims, ✓ appears, task remains in active list, excluded from kickoff.
3. Mark regular task complete — moves to completed section.
4. Complete a WORK cycle on a standing focused task — overlay primary action marks done-for-today, not global complete.

## What We're NOT Doing

- Removing `markDoneForToday`, `TaskDayCompletion`, or suggestion-pool exclusion logic.
- Feeding `TaskDayCompletion` into Daily recap Last 24h (separate product gap; recap already uses cycles + global complete per frame).
- Adding a new “archive forever” row affordance for standing tasks (existing paths: toggle off Daily standing then complete, or overlay secondary if added later).
- Changing recap Today section data sources.
- Retiring daily-standing feature or S-27 capacity/kickoff behavior.

## Implementation Approach

**Option B from research**: unify presentation, branch handler by `isDailyStanding`. No backend contract changes. Combine with **Option D partial** (create default off) to reduce mixed-row prevalence. Phase 3 aligns cycle overlay so standing tasks don’t expose a contradictory third “global complete” as the only primary action.

Use a single `data-testid="task-complete-button"` on the interactive control for both row types (replace `done-for-today-button`). Keep distinct `aria-label` values (“Done for today” vs “Mark complete”) for accessibility.

## Phase 1: Unify row completion control

### Overview

Replace the standing-branch text button with the same circle checkbox used on non-standing rows; branch `onClick` to `onMarkDoneForToday` vs existing global-complete handler.

### Changes Required:

#### 1. Task row completion UI

**File**: `src/app/_components/task-list.tsx`

**Intent**: Collapse the `isDailyStanding` / `!isDailyStanding` visual fork into one checkbox-style button for the actionable (not-yet-done) state; preserve ✓ static span when `doneForToday`.

**Contract**: The ternary at lines 335-381 becomes: if `doneForToday` → static ✓ span (unchanged styling); else → single `<button>` with circle classes from the current non-standing branch, `data-testid="task-complete-button"`, `aria-label` = `"Done for today"` when `task.isDailyStanding` else `"Mark complete"`. `onClick` calls `onMarkDoneForToday(task.id)` for standing, existing `onBeginComplete` + `onUpdateTask({ status: "completed" })` path (with mid-cycle branch) for non-standing.

#### 2. Component tests

**File**: `src/app/_components/task-list.test.tsx`

**Intent**: Update tests that assert `done-for-today-button` presence and click target.

**Contract**: Tests at ~681 and ~724-742 query `task-complete-button` (or `getByRole` with aria-label). Standing-task test still expects `markDoneForToday` called and `updateTask` not called with `status: "completed"`. Add assertion that standing and non-standing actionable rows share the same visual class (circle border), not text-button classes.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/app/_components/task-list.test.tsx`
- `pnpm check`
- `pnpm typecheck`

#### Manual Verification:

- Standing row: checkbox click dims row and shows ✓ without moving task to Completed section.
- Non-standing row: checkbox click archives task as today.
- Screen reader announces correct label per row type.

**Implementation Note**: After completing this phase and automated verification, pause for manual confirmation before Phase 2.

---

## Phase 2: Default Daily standing OFF on create

### Overview

Align create-form default with Prisma and reduce how often new users see standing-specific completion on first tasks.

### Changes Required:

#### 1. Create form state

**File**: `src/app/_components/task-list.tsx`

**Intent**: New tasks should not default to daily standing unless the user enables the toggle.

**Contract**: `useState` initializer for `newIsDailyStanding` and `resetCreateFormState` set `false` instead of `true` (lines 574, 585).

#### 2. Dependent tests

**Files**: `src/app/_components/task-list.test.tsx` and any create-form tests asserting default toggle state.

**Intent**: Flip expectations where tests assume Daily standing checked by default on open create panel.

**Contract**: Tests that open create form and assert `daily-standing-toggle` checked → expect unchecked unless explicitly toggled.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/app/_components/task-list.test.tsx`
- `pnpm test`

#### Manual Verification:

- Open “Add task” — Daily standing toggle is off by default.
- Creating a task without toggling produces a row with Mark-complete semantics (global complete on checkbox).

**Implementation Note**: Pause for manual confirmation before Phase 3.

---

## Phase 3: Cycle overlay alignment + e2e

### Overview

Prevent the cycle-complete overlay from being the only obvious “success” action that globally archives standing tasks; update e2e helpers for unified test id.

### Changes Required:

#### 1. Cycle-complete overlay

**File**: `src/app/_components/cycle-complete-overlay.tsx`

**Intent**: When the focused task is daily standing and still active, primary CTA marks done-for-today instead of global complete.

**Contract**: Overlay receives enough context to know `focusedTask.isDailyStanding` and `!focusedTask.doneForToday` (may require prop from `pomodoro-dashboard.tsx` or cycle hook). Primary button label becomes “Done for today” in that case; `onConfirm(true)` dispatches `markDoneForToday` (wire through existing mutation hook) instead of cycle `markTaskDone` global path. Non-standing behavior unchanged. Consider renaming secondary “Continue later” only — do not add global archive as primary for standing.

**File**: `src/app/_components/pomodoro-dashboard.tsx` (or wherever overlay is mounted)

**Intent**: Pass standing flag and done-for-today handler into overlay confirm path.

**Contract**: Confirm handler branches: standing → `markDoneForToday({ id, localDateKey })`; else → existing `markTaskDone` / global complete.

#### 2. E2E helper + specs

**Files**: `e2e/helpers/daily-plan.ts`, `e2e/daily-standing-capacity.spec.ts`

**Intent**: Helpers and specs target unified completion control.

**Contract**: `markStandingDoneForToday` clicks `task-complete-button` (or `getByRole('button', { name: 'Done for today' })`) instead of `done-for-today-button`. Skip-belt spec at lines 187-189 updated similarly.

#### 3. Overlay tests (if present) or co-located smoke

**Files**: Add/update tests near overlay or dashboard if existing coverage exists; otherwise manual-only for overlay branch.

**Intent**: Standing focused task → primary overlay action does not call global complete mutation.

**Contract**: Mock mutation layer; assert `markDoneForToday` invoked when `isDailyStanding: true`.

### Success Criteria:

#### Automated Verification:

- `pnpm test`
- `set CI=true && pnpm test:e2e:belt` (belt includes standing kickoff exclusion case)
- `pnpm check`

#### Manual Verification:

- Finish WORK cycle on standing focused task — overlay primary marks done-for-today; task stays active.
- Finish WORK cycle on regular task — overlay still globally completes.
- Kickoff after standing done-for-today still excludes that task.

**Implementation Note**: Final phase — manual sign-off closes the change.

---

## Testing Strategy

### Unit Tests:

- `task-list.test.tsx`: unified control testid; standing → `markDoneForToday`; non-standing → global complete; done-for-today styling unchanged.
- `task-mutation.test.ts`: no changes expected (`markDoneForToday` router tests stay green).
- `suggestion.test.ts`: pool exclusion unchanged.

### Integration / E2E:

- Belt: `e2e/daily-standing-capacity.spec.ts` kickoff exclusion (lines 111-160).
- Skip-belt: standing UX visibility spec (lines 163-196) — update selector only.

### Manual Testing Steps:

1. Guest mode: mark standing task done via checkbox; reload; confirm guest day-completion store persists for today.
2. Auth mode: same flow; confirm `task.list` returns `doneForToday: true`.
3. Mixed list: one standing + one regular — visually identical checkboxes, different outcomes on click.
4. Midnight rollover smoke: done-for-today standing task reverts to actionable next local day (existing lazy invalidation).

## Performance Considerations

No new network calls. Optimistic `markDoneForToday` path in `use-task-mutations.ts` unchanged. Unified UI is a render-branch simplification — no perf impact.

## Migration Notes

No data migration. Existing `TaskDayCompletion` rows unaffected. Users with standing tasks keep behavior; only control chrome changes.

## References

- Frame brief: `context/changes/remove-done-for-today-button/frame.md`
- Research: `context/changes/remove-done-for-today-button/research.md`
- S-27 archive: `context/archive/2026-06-19-daily-standing-tasks-capacity-plan/plan.md`
- Row UI: `src/app/_components/task-list.tsx:335-381`
- Recap Last 24h: `src/lib/recap/build-daily-recap.ts:27-70`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Unify row completion control

#### Automated

- [x] 1.1 `pnpm exec vitest run src/app/_components/task-list.test.tsx` — cd94ffb
- [x] 1.2 `pnpm check` — cd94ffb
- [x] 1.3 `pnpm typecheck` — cd94ffb

#### Manual

- [x] 1.4 Standing row: checkbox click dims row and shows ✓ without moving task to Completed section — cd94ffb
- [x] 1.5 Non-standing row: checkbox click archives task as today — cd94ffb
- [x] 1.6 Screen reader announces correct label per row type — cd94ffb

### Phase 2: Default Daily standing OFF on create

#### Automated

- [x] 2.1 `pnpm exec vitest run src/app/_components/task-list.test.tsx` — c0cac95
- [x] 2.2 `pnpm test` — c0cac95

#### Manual

- [x] 2.3 Open Add task — Daily standing toggle is off by default — c0cac95
- [x] 2.4 Creating a task without toggling produces global-complete checkbox semantics — c0cac95

### Phase 3: Cycle overlay alignment + e2e

#### Automated

- [x] 3.1 `pnpm test`
- [x] 3.2 `set CI=true && pnpm test:e2e:belt`
- [x] 3.3 `pnpm check`

#### Manual

- [x] 3.4 Finish WORK cycle on standing focused task — overlay primary marks done-for-today; task stays active
- [x] 3.5 Finish WORK cycle on regular task — overlay still globally completes
- [x] 3.6 Kickoff after standing done-for-today still excludes that task

