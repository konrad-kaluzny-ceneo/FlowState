---
date: 2026-06-12T00:00:00+02:00
researcher: Auto
git_commit: 0cd368886360efac60b688de5fe2a2e4cf4a6b36
branch: main
repository: FlowState
topic: "Fix task edit save when clicking outside the task row"
tags: [research, codebase, task-list, inline-edit, blur-save, resumeNote]
status: complete
last_updated: 2026-06-12
last_updated_by: Auto
---

# Research: Fix task edit save when clicking outside the task row

**Date**: 2026-06-12
**Researcher**: Auto
**Git Commit**: [`0cd3688`](https://github.com/konrad-kaluzny-ceneo/FlowState/commit/0cd368886360efac60b688de5fe2a2e4cf4a6b36)
**Branch**: main
**Repository**: FlowState

## Research Question

How does task inline editing work today, and why do changes to `resumeNote`, attributes, and other fields fail to persist when the user clicks outside the row, switches tasks, or performs other actions (Focus, etc.) instead of pressing Enter in the title field?

## Summary

`saveEdit` already builds a complete payload (title, attributes, `resumeNote`) and calls `updateTask`, but **only the title textarea wires save triggers** (`onBlur` and Enter). The `resumeNote` textarea and Eisenhower attribute pickers have no blur or outside-click handlers. When focus is on `resumeNote` or the user changes attributes without ever blurring the title, clicking outside, Focus, or another task's title does not invoke `saveEdit` — drafts are silently discarded.

Additionally, `startEditing` overwrites shared edit state without saving the prior task, and Escape exits edit mode without save. The product intent since S-04 has been **save-on-blur + Enter**, but S-18 widened the edit surface without extending save triggers. Tests cover Enter-only save; title blur is implemented but untested.

**Secondary gap:** guest-mode `updateTask` in `use-task-mutations.ts` omits `resumeNote` even when `saveEdit` passes it.

## Detailed Findings

### Edit mode state (TaskList)

All edit state is local React state in `TaskList` — one shared draft set for whichever row has `editingId === task.id`:

| State | Purpose |
|-------|---------|
| `editingId` | Which task is in edit mode (`null` = none) |
| `editTitle`, `editResumeNote` | Draft title and resume note |
| `editWorkType`, `editUrgency`, `editImportance`, `editEffortMinutes`, `editCommitmentHorizon` | Draft attributes |

Entry: clicking the task title in read mode calls `startEditing`, which copies all fields from the task into draft state.

Exit with save: only via `saveEdit`, which validates non-empty title, calls `updateTask`, then clears edit state.

Exit without save: Escape (`onSetEditingId(null)`), switching to another task (`startEditing` overwrites drafts), or empty title guard (early return, stays in edit mode).

### Save triggers — title-only

The title textarea has the only save wiring:

- [`onBlur`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/0cd368886360efac60b688de5fe2a2e4cf4a6b36/src/app/_components/task-list.tsx#L381) → `onSaveEdit(task.id)`
- Enter without Shift → `onSaveEdit(task.id)`
- Shift+Enter → newline only (no save)
- Escape → cancel without save

The `resumeNote` textarea has `onChange` only — **no `onBlur`, no keyboard save**:

```399:407:src/app/_components/task-list.tsx
						<textarea
							className="w-full resize-none rounded bg-surface-panel px-2 py-1 text-primary text-sm focus:outline-none"
							id={`task-resume-note-edit-${String(task.id)}`}
							maxLength={120}
							onChange={(event) => onSetEditResumeNote(event.target.value)}
							placeholder="One line for when you return to this task"
							rows={2}
							value={editResumeNote}
						/>
```

Eisenhower attribute fields (`EisenhowerAttributeFields`, SegmentedControl for work type) likewise have no save triggers.

### Failure scenarios

| User action | Saves? | Why |
|-------------|--------|-----|
| Edit title, blur or Enter | Yes | Title textarea triggers `saveEdit` |
| Edit `resumeNote` only, click outside | **No** | `resumeNote` blur has no handler; title never blurred |
| Edit attributes only, click outside | **No** | No field with save-on-blur was focused |
| Edit `resumeNote`, click Focus | **No** | Focus button does not call `saveEdit` |
| Edit any field, click another task title | **No** | `startEditing` replaces drafts without saving |
| Edit any field, press Escape | **No** | Clears `editingId` without `saveEdit` |
| Click SegmentedControl while title focused | Deferred | `onMouseDown preventDefault` blocks title blur until later blur |
| Click SegmentedControl while `resumeNote` focused | **No** | `resumeNote` blurs with no save |

### saveEdit payload is complete

When invoked, `saveEdit` sends all fields including `resumeNote`:

```623:643:src/app/_components/task-list.tsx
	async function saveEdit(id: DomainTaskId) {
		if (!editTitle.trim()) {
			return;
		}

		await updateTask({
			id,
			title: editTitle.trim(),
			workType: editWorkType,
			urgency: editUrgency,
			weight: editUrgency,
			importance: editImportance,
			effortMinutes: parseEffortMinutes(editEffortMinutes),
			commitmentHorizon: editCommitmentHorizon,
			resumeNote:
				editResumeNote.trim().length > 0 ? editResumeNote.trim() : null,
		});
		setEditingId(null);
		setEditTitle("");
		setEditResumeNote("");
	}
```

The bug is **when** `saveEdit` is called, not **what** it sends.

### SegmentedControl blur race (partially mitigated)

S-04 impl review documented title `onBlur` racing with SegmentedControl clicks, saving stale attributes. Fix applied: `onMouseDown={(e) => e.preventDefault()}` on SegmentedControl buttons ([`task-list.tsx:211`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/0cd368886360efac60b688de5fe2a2e4cf4a6b36/src/app/_components/task-list.tsx#L211)). This pattern must be preserved or extended when adding row-level save-on-outside-click.

### Guest mode drops resumeNote

Even when `saveEdit` passes `resumeNote`, guest `updateTask` omits it:

```240:254:src/hooks/use-task-mutations.ts
	const updateTask = useCallback(
		async (input: UpdateTaskArgs) => {
			clearError();
			if (mode === "guest") {
				return taskRepo.update({
					id: input.id,
					title: input.title,
					status: input.status,
					workType: input.workType,
					weight: input.weight as 1 | 2 | 3 | undefined,
					importance: input.importance as 1 | 2 | 3 | undefined,
					urgency: input.urgency as 1 | 2 | 3 | undefined,
					effortMinutes: input.effortMinutes,
					commitmentHorizon: input.commitmentHorizon,
				});
			}
```

Guest repo supports `resumeNote`; the hook never forwards it. In scope for this fix if guest edit is supported.

### Test coverage gaps

| Covered | Not covered |
|---------|-------------|
| Enter-key save of multiline title + default attributes ([`task-list.test.tsx:81-114`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/0cd368886360efac60b688de5fe2a2e4cf4a6b36/src/app/_components/task-list.test.tsx#L81-L114)) | Title `onBlur` save |
| Read-mode long title display | `resumeNote` blur / outside-click save |
| | Click Focus while editing |
| | Switch tasks while editing (data loss) |
| | Escape cancel without save |
| | Attribute-only edits saved on blur |
| | SegmentedControl blur race regression |
| | E2E task edit flows (zero coverage) |

No test in the repo uses `fireEvent.blur` for edit save. `context/foundation/lessons.md` L-04 calls for per-surface edit oracles.

## Code References

- [`src/app/_components/task-list.tsx:376-437`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/0cd368886360efac60b688de5fe2a2e4cf4a6b36/src/app/_components/task-list.tsx#L376-L437) — Edit mode UI (title, resumeNote, attributes)
- [`src/app/_components/task-list.tsx:381`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/0cd368886360efac60b688de5fe2a2e4cf4a6b36/src/app/_components/task-list.tsx#L381) — Title `onBlur` → save (only save trigger)
- [`src/app/_components/task-list.tsx:399-407`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/0cd368886360efac60b688de5fe2a2e4cf4a6b36/src/app/_components/task-list.tsx#L399-L407) — resumeNote textarea (no save trigger)
- [`src/app/_components/task-list.tsx:444-447`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/0cd368886360efac60b688de5fe2a2e4cf4a6b36/src/app/_components/task-list.tsx#L444-L447) — Click another task → `startEditing` without save
- [`src/app/_components/task-list.tsx:474-485`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/0cd368886360efac60b688de5fe2a2e4cf4a6b36/src/app/_components/task-list.tsx#L474-L485) — Focus button (no save before focus)
- [`src/app/_components/task-list.tsx:538-548`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/0cd368886360efac60b688de5fe2a2e4cf4a6b36/src/app/_components/task-list.tsx#L538-L548) — Edit draft state
- [`src/app/_components/task-list.tsx:610-643`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/0cd368886360efac60b688de5fe2a2e4cf4a6b36/src/app/_components/task-list.tsx#L610-L643) — `startEditing` / `saveEdit`
- [`src/app/_components/task-list.tsx:211`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/0cd368886360efac60b688de5fe2a2e4cf4a6b36/src/app/_components/task-list.tsx#L211) — SegmentedControl `onMouseDown preventDefault`
- [`src/hooks/use-task-mutations.ts:240-262`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/0cd368886360efac60b688de5fe2a2e4cf4a6b36/src/hooks/use-task-mutations.ts#L240-L262) — `updateTask` (guest omits `resumeNote`)
- [`src/app/_components/task-list.test.tsx:81-114`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/0cd368886360efac60b688de5fe2a2e4cf4a6b36/src/app/_components/task-list.test.tsx#L81-L114) — Enter-only save test

## Architecture Insights

1. **Single save function, multiple entry points needed.** `saveEdit` is the correct aggregation point; fix should centralize "commit edit" rather than duplicating per-field blur handlers.

2. **Row-level vs field-level blur.** Per-field blur on every control is fragile. A row-level or document-level "click outside edit panel" handler (with SegmentedControl mousedown guard) is likely cleaner and matches the change note ("click outside row").

3. **Action hooks must save first.** Focus, start-editing-another-task, and mark-complete should call `saveEdit` (or a shared `commitEditIfDirty`) before proceeding — not rely on incidental blur order.

4. **Shared draft state is a footgun.** One `editingId` + shared drafts means switching tasks without save always loses data. `startEditing` should save the current edit if `editingId` is set.

5. **No in-flight save guard.** Rapid blur + Enter could double-call `updateTask`. Consider a saving flag if adding more triggers.

6. **Established pattern:** SegmentedControl `onMouseDown preventDefault` — reuse when expanding save triggers.

## Historical Context (from prior changes)

| Change | Relevance |
|--------|-----------|
| S-04 `task-attributes-for-scoring` | Introduced click-title edit + `saveEdit`; contract: **Enter or blur** saves attributes |
| S-04 impl review F1 | Blur-save race with SegmentedControl; fix: `onMouseDown preventDefault` (keep blur-save) |
| B-02 `fix-title-multiline-and-cycle-optimistic` | Textarea contract: Enter/Shift+Enter/Escape/**blur saves**; test covers Enter only |
| S-18 `task-resume-context-note` | Added `resumeNote` to edit mode; did not add save triggers → exposed current bug |
| L-04 (`lessons.md`) | Per-surface edit oracles; blur path still absent post-B-02 |

Prior archived plans explicitly rejected Enter-only save (S-04 impl review Fix B): *"Users accustomed to blur-to-save may lose edits."*

## Related Research

- [`context/archive/2026-06-12-task-resume-context-note/research.md`](../../archive/2026-06-12-task-resume-context-note/research.md) — S-18 resumeNote inline edit; component tests preferred over E2E
- [`context/archive/2026-06-09-fix-title-multiline-and-cycle-optimistic/research.md`](../../archive/2026-06-09-fix-title-multiline-and-cycle-optimistic/research.md) — B-02 textarea edit surface
- [`context/archive/2026-05-30-task-attributes-for-scoring/reviews/impl-review.md`](../../archive/2026-05-30-task-attributes-for-scoring/reviews/impl-review.md) — Blur vs SegmentedControl race decision

## Open Questions

1. **Escape semantics:** Should Escape discard (current) or save-and-exit? Archived B-02 plan says "Escape cancels" — likely keep discard; confirm in plan.

2. **Empty title:** `saveEdit` early-return leaves user stuck in edit mode. Should blur-outside allow cancel when title empty, or show validation?

3. **Optimistic double-save:** Is an in-flight guard needed when adding multiple save entry points?

4. **Guest mode:** Is `resumeNote` edit in guest mode in scope? Hook gap exists today.

5. **Implementation shape:** Row-level `useEffect` + pointer capture vs wrapping edit panel with `onBlur` capture vs saving in each action handler (`onFocusTask`, `startEditing`) — plan should pick one and preserve SegmentedControl race fix.

## Suggested fix directions (for `/10x-plan`)

1. Extract `commitEditIfDirty()` that calls `saveEdit` when `editingId != null` and title is non-empty.
2. Call it from: click-outside edit panel, `startEditing` (before switching tasks), `onFocusTask`, and optionally `resumeNote` blur.
3. Preserve SegmentedControl `onMouseDown preventDefault`; extend to effort input if needed.
4. Forward `resumeNote` in guest `updateTask`.
5. Add component tests: blur save from title, blur save from resumeNote, save before Focus, save before switching tasks, Escape no-save, SegmentedControl click does not stale-save.
