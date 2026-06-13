# Fix task edit blur save — Implementation Plan

## Overview

Wire all inline task edit exit paths to commit the existing draft via `saveEdit`, so title, `resumeNote`, and Eisenhower attributes persist on click-outside, Focus, and task-switch — not only on Enter/blur of the title textarea. Add component-test oracles per L-04 and fix guest-mode `resumeNote` omission in `use-task-mutations`.

## Current State Analysis

- `saveEdit` (`src/app/_components/task-list.tsx:623-643`) already sends the full update payload including `resumeNote`.
- Save triggers exist only on the title textarea: `onBlur` (line 381) and Enter without Shift (lines 384-386).
- `resumeNote` textarea (lines 399-407) and attribute pickers have no commit wiring.
- `startEditing` (lines 610-621) overwrites drafts without saving the prior task.
- Focus button (lines 474-485) calls `onFocusTask` directly with no commit.
- SegmentedControl buttons use `onMouseDown preventDefault` (line 211) to prevent stale attribute saves when clicking from title focus — must preserve.
- Guest `updateTask` (`src/hooks/use-task-mutations.ts:243-254`) omits `resumeNote`.
- Tests: Enter-only save at `task-list.test.tsx:81-114`; no blur/outside/Focus coverage.

### Key Discoveries

- Bug is **when** `saveEdit` runs, not **what** it sends (`research.md`).
- Product contract since S-04/B-02: **Enter or blur saves**; Escape cancels.
- S-18 added `resumeNote` to edit UI without extending triggers — regression vector.

## Desired End State

A user editing any field in a task row can click outside the row, click Focus, or open another task for edit and see all draft changes persisted (when title is non-empty). Escape still discards. Guest edits persist `resumeNote`. Component tests lock the behavior.

### Verification

- Component tests pass for blur, outside-click, Focus, task-switch, Escape, SegmentedControl attribute change.
- `pnpm check` and `pnpm test` green.

## What We're NOT Doing

- E2E Playwright specs for task edit
- Changing Escape to save-and-exit
- Empty-title validation messaging / blocking UI redesign
- Fixing mark-complete-while-editing concurrent update race
- Creating a roadmap slice or Linear issue (ad-hoc change)

## Implementation Approach

Introduce `commitEditIfDirty()` in `TaskList` as the single commit gate. Add a document-level `pointerdown` listener active while `editingId != null` to commit when click lands outside the edit panel (respecting SegmentedControl mousedown guards). Wrap `startEditing` and Focus to await commit first. Route title blur through the same helper. Add in-flight ref to suppress duplicate concurrent commits. Forward `resumeNote` in guest update. Cover with component tests in phase 2 via `/10x-tdd`.

## Critical Implementation Details

**Timing & lifecycle:** Register the outside-click listener in a `useEffect` keyed on `editingId`. Clean up on unmount and when edit ends. Use `pointerdown` (not `click`) so commit runs before focus moves to the new target.

**User experience spec:** When title is empty/whitespace on commit attempt, clear `editingId` and drafts without calling `updateTask` (discard) — avoids the current stuck-in-edit early return on outside click.

**State sequencing:** `startEditing` must `await commitEditIfDirty()` before copying the new task's fields into draft state. Focus wrapper in `TaskList` must await commit before calling the `onFocusTask` prop.

## Phase 1: Commit wiring and guest fix

### Overview

Centralize edit commit and wire all exit paths that should persist drafts.

### Changes Required

#### 1. TaskList — commit helper and in-flight guard

**File**: `src/app/_components/task-list.tsx`

**Intent**: Add `commitEditIfDirty()` that reads current `editingId` and draft state. If `editingId` is set and `editTitle.trim()` is non-empty, await existing `saveEdit(editingId)`. If title is empty, reset edit state (`setEditingId(null)`, clear drafts) without `updateTask`. Use a `useRef` boolean to skip re-entrant calls while a commit is in flight.

**Contract**: New async function in `TaskList`; `saveEdit` remains the persistence implementation; title textarea `onBlur` delegates to `commitEditIfDirty` instead of calling `onSaveEdit` directly.

#### 2. TaskList — outside-click listener

**File**: `src/app/_components/task-list.tsx`

**Intent**: While `editingId != null`, attach a document `pointerdown` handler. If the event target is outside the editing row's edit panel (use a `ref` on the edit panel wrapper div), call `commitEditIfDirty()`. Ignore targets inside SegmentedControl / Eisenhower picker buttons (they already use or should use `onMouseDown preventDefault`).

**Contract**: `ref` on the edit-mode panel container in `SortableActiveTaskRow`; listener registered from `TaskList` via callback ref or prop passthrough — implementer chooses minimal diff.

#### 3. TaskList — save before task switch and Focus

**File**: `src/app/_components/task-list.tsx`

**Intent**: Change `startEditing` to async: await `commitEditIfDirty()` before initializing drafts for the new task. Wrap the Focus handler passed to rows: `async (id, task) => { await commitEditIfDirty(); onFocusTask(id, task); }`.

**Contract**: `onStartEditing` prop type may become `(task: DomainTask) => void | Promise<void>`; Focus row handler awaits commit.

#### 4. Eisenhower effort input — mousedown guard (if missing)

**File**: `src/app/_components/task-list.tsx` (`EisenhowerAttributeFields`)

**Intent**: If the effort minutes `<input>` lacks `onMouseDown preventDefault`, add it so clicking effort from title/resumeNote focus does not trigger a premature outside commit with stale effort value.

**Contract**: Match SegmentedControl pattern at line 211.

#### 5. Guest updateTask — forward resumeNote

**File**: `src/hooks/use-task-mutations.ts`

**Intent**: Include `resumeNote: input.resumeNote` in the guest branch of `updateTask` (lines 243-254).

**Contract**: Guest `taskRepo.update` call accepts `resumeNote` (repo already supports it per research).

### Success Criteria

#### Automated Verification

- `pnpm check` passes
- `pnpm typecheck` passes
- `pnpm exec vitest run src/hooks/use-task-mutations.test.tsx` passes (if guest update tests exist; add minimal test if none cover resumeNote)

#### Manual Verification

- Edit resumeNote only, click task list background → note persists on refocus
- Edit attributes, click Focus → attributes saved, task focused
- Edit task A, click task B title → A saved, B opens in edit
- Escape still discards without network save
- Click SegmentedControl while editing title → attributes update without stale save

**Implementation Note**: Pause for manual confirmation before phase 2.

---

## Phase 2: Component test oracles

### Overview

Add co-located component tests per L-04 and B-02 blur-save contract. Route via `/10x-tdd`.

### Changes Required

#### 1. task-list.test.tsx — save path coverage

**File**: `src/app/_components/task-list.test.tsx`

**Intent**: Add tests (use `fireEvent.blur`, `fireEvent.pointerDown` on document/outside element, or Testing Library patterns that match implementation):

1. **Blur save from title** — change title, blur textarea → `updateTask` with new title
2. **Outside click from resumeNote** — edit resumeNote only, pointerdown outside edit panel → `updateTask` includes `resumeNote`
3. **Focus while editing** — edit resumeNote, click Focus → `updateTask` then focus handler behavior
4. **Switch tasks while editing** — edit task 1, click task 2 title → two `updateTask` calls (task 1 saved first)
5. **Escape no save** — edit title, Escape → `updateTask` not called
6. **SegmentedControl no stale save** — change work type via SegmentedControl, assert single save with updated workType (not stale)

**Contract**: Extend existing `TaskList` describe block; reuse `makeTask`, `updateTask` mock, two-task fixtures where needed.

### Success Criteria

#### Automated Verification

- `pnpm exec vitest run src/app/_components/task-list.test.tsx` passes
- `pnpm test` passes

#### Manual Verification

- None required if automated oracles cover all paths

---

## Testing Strategy

### Unit / component tests

- All new behavior in `task-list.test.tsx` (phase 2)
- Optional: guest `resumeNote` forward test in `use-task-mutations.test.tsx`

### Manual Testing Steps

1. Open app, edit task resumeNote, click empty area → reload/check note persisted
2. Edit urgency, click another task → first task urgency saved
3. Guest mode (if available): edit resumeNote, blur save → persists locally

## Performance Considerations

Negligible — one document listener while a single row is in edit mode; removed on exit.

## Migration Notes

None — behavior fix only, no schema changes.

## References

- Research: `context/changes/fix-task-edit-blur-save/research.md`
- S-04 blur race fix: `context/archive/2026-05-30-task-attributes-for-scoring/reviews/impl-review.md`
- B-02 contract: `context/archive/2026-06-09-fix-title-multiline-and-cycle-optimistic/plan.md`
- L-04: `context/foundation/lessons.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Commit wiring and guest fix

#### Automated

- [x] 1.1 `pnpm check` passes
- [x] 1.2 `pnpm typecheck` passes
- [x] 1.3 Guest resumeNote forward verified (existing or new unit test)

#### Manual

- [x] 1.4 Outside click, Focus, and task-switch save verified in browser
- [x] 1.5 Escape cancel and SegmentedControl attribute change verified in browser

### Phase 2: Component test oracles

#### Automated

- [x] 2.1 `pnpm exec vitest run src/app/_components/task-list.test.tsx` passes
- [x] 2.2 `pnpm test` passes
