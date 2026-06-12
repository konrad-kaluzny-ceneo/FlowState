# Fix task edit blur save — Plan Brief

> Full plan: `context/changes/fix-task-edit-blur-save/plan.md`
> Research: `context/changes/fix-task-edit-blur-save/research.md`

## What & Why

Inline task edits (title, resumeNote, Eisenhower attributes) should persist when the user clicks outside the row, switches tasks, or clicks Focus — not only on Enter in the title field. Today `saveEdit` sends the full payload but is wired only to the title textarea; S-18 widened edit mode without extending save triggers, causing silent data loss.

## Starting Point

`TaskList` holds shared edit draft state (`editingId`, `editTitle`, `editResumeNote`, attribute drafts). `saveEdit` at `task-list.tsx:623-643` already aggregates all fields. Title textarea has `onBlur` + Enter; resumeNote and pickers do not. SegmentedControl uses `onMouseDown preventDefault` (S-04 race fix). One Enter-only component test exists; no blur/oracle coverage.

## Desired End State

Any exit from edit mode via click-outside, Focus, or switching to another task commits the full draft when title is non-empty. Escape still cancels without save (B-02 contract). Guest `updateTask` forwards `resumeNote`. Component tests guard blur, Focus-switch, task-switch, Escape, and SegmentedControl race paths per L-04.

## Key Decisions Made

| Decision | Choice | Why | Source |
| -------- | ------ | --- | ------ |
| Save trigger architecture | Central `commitEditIfDirty()` + action hooks | Avoids per-field blur fragility; `saveEdit` already aggregates payload | Research |
| Click-outside detection | `pointerdown` on document while `editingId` set, scoped to edit panel ref | Matches change note; works regardless of which field had focus | Plan |
| Escape semantics | Keep cancel-without-save | B-02 archived contract; no user confusion change | Research |
| Empty title on outside click | Exit edit mode without save (discard) | Better than stuck-in-edit early return | Plan |
| Double-save guard | `useRef` in-flight flag on commit | Multiple entry points (blur + pointerdown) can fire close together | Research |
| Guest mode | Forward `resumeNote` in guest `updateTask` | Hook gap; guest repo already supports field | Research |
| SegmentedControl race | Preserve `onMouseDown preventDefault`; extend to effort `<input>` if needed | S-04 impl-review Fix A — do not regress stale attribute saves | Research |
| Testing layer | Component tests only (`task-list.test.tsx`) | S-18 research: component smoke sufficient; no E2E for this bug class | Research |

## Scope

**In scope:**
- `commitEditIfDirty` and wiring in `TaskList` / `SortableActiveTaskRow`
- Save before: click outside edit panel, Focus click, `startEditing` another task
- Guest `resumeNote` forward in `use-task-mutations.ts`
- Component tests for all new save paths + Escape no-save + SegmentedControl regression

**Out of scope:**
- E2E task edit specs
- Escape → save-and-exit behavior change
- Empty-title validation UI / error toast
- Mark-complete-while-editing race (pre-existing; separate change if needed)
- Roadmap slice registration / Linear issue (ad-hoc bugfix change)

## Architecture / Approach

Add `commitEditIfDirty()` in `TaskList`: if `editingId != null` and title trimmed non-empty, await `saveEdit(editingId)`; if title empty, clear edit state (discard). Register a document `pointerdown` listener when editing, ignoring clicks inside the edit panel ref and SegmentedControl/Eisenhower buttons (mousedown guard). Wrap `startEditing` and the Focus handler to await commit before proceeding. Route title `onBlur` through the same helper. Forward `resumeNote` in guest update path.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Commit wiring | All save entry points + guest fix | pointerdown vs SegmentedControl race |
| 2. Component tests | Blur/outside/Focus/switch/Escape oracles | Testing Library blur/focus timing |

**Prerequisites:** On `main`, branch `features/fix-task-edit-blur-save`
**Estimated effort:** ~1 session, 2 phases

## Open Risks & Assumptions

- Assumes parent `onFocusTask` is synchronous-safe after await commit (no re-entrancy issues).
- Mark-complete while editing may still issue a partial `updateTask({ status })` without full draft — documented out of scope.
- No autofocus on edit entry; outside-click save does not require autofocus change.

## Success Criteria (Summary)

- Edit resumeNote only, click app background → `updateTask` includes resumeNote
- Edit attributes, click Focus → save then focus
- Edit task A, click task B title → task A saved before B opens
- Escape → no `updateTask`; drafts discarded
- `pnpm check` + `pnpm test` green
