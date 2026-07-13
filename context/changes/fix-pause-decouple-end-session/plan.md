# Remove the redundant "Wstrzymaj i zakończ sesję" button — Implementation Plan

## Overview

During a running session the timer-hub stacks three controls: a pure Pause⇄Resume (the ⏸/▶ icon inside the timer card), a coupled **"Wstrzymaj i zakończ sesję"** text button (pause **+** open end-session confirm), and a plain **"Zakończ sesję"** text button (end-session confirm). The coupled button is redundant — pause and end already exist as independent affordances. This plan **removes** the coupled button and its handler, cleans up the orphaned i18n key, and re-homes the test coverage it carried onto the two surviving controls.

## Current State Analysis

- `src/app/_components/pomodoro-dashboard.tsx:1172-1195` renders the button block below the timer. While `state === "running"` it shows the coupled `pause-and-end-session-btn` (label `dashboard.pauseEndSession`), and always shows `end-session-btn` (label `dashboard.endSession`) for an active session.
- `handlePauseAndEndSessionClick` (`pomodoro-dashboard.tsx:293-299`) pauses then opens the end-session confirm overlay with the `"after-pause"` variant.
- A pure pause already exists in `TimerPanel`: ⏸ `timer-pause` while running (`src/app/_components/timer-panel.tsx:220-221`) flipping to ▶ `timer-resume` when paused (`:196-210`), wired via `onPause={pomodoro.pause}` / `onResume={pomodoro.resume}` (`pomodoro-dashboard.tsx:795-796`).
- `handleEndSessionClick` (`pomodoro-dashboard.tsx:281-291`) already handles both running and paused: it opens the confirm with the `"after-pause"` variant when `state === "paused"`, `"immediate"` when running. So the calm pause→end journey survives via ⏸ then "Zakończ sesję".
- The `"after-pause"` confirm copy is produced by `getEndSessionConfirmCopy` (`src/lib/session/end-session-copy.ts`) and stays in use — **do not remove it**.
- Coverage that references the button being removed:
  - Unit: `pomodoro-dashboard.test.tsx:782-790` (renders the button) and `:792-813` (pauses then asserts the after-pause "Stay paused" confirm). The `:792` test is the **only** unit-level assertion of the after-pause variant; existing `end-session-btn` unit tests cover only the running/`immediate` path (`:721-780`).
  - E2E: `e2e/session-closure.spec.ts:67-106` drives the coupled button end-to-end. The standalone end path is separately covered at `:37-64`.

## Desired End State

During a running session the timer hub shows exactly two controls: the ⏸/▶ pause icon (timer card) and the "Zakończ sesję" button. There is no "Wstrzymaj i zakończ sesję" button and no `dashboard.pauseEndSession` string in either locale. A user can still pause then end: click ⏸, then "Zakończ sesję", and see the after-pause confirm ("Zakończyć sesję podczas pauzy?" / "Stay paused" cancel) → closure. Unit and e2e suites are green, with the after-pause variant covered at both layers via the surviving controls.

### Key Discoveries:

- Pure pause already exists: `timer-panel.tsx:196-221` — makes relabeling redundant, hence removal.
- `handleEndSessionClick` already opens the `"after-pause"` variant when paused: `pomodoro-dashboard.tsx:281-291` — the pause→end journey needs no new code.
- `end-session-copy.ts` `"after-pause"` branch stays live (reached via `end-session-btn` when paused) — only the dashboard button/key/tests are dead.
- `dashboard.pauseEndSession` is referenced only at `pomodoro-dashboard.tsx:1182` (verified by repo-wide grep) — safe to delete the key.

## What We're NOT Doing

- Not relabeling the button to "Wstrzymaj" (would duplicate the existing ⏸ icon pause).
- Not touching the `TimerPanel` pause/resume/interrupt controls.
- Not touching `handleEndSessionClick`, the `EndSessionConfirmOverlay`, `end-session-copy.ts`, or the `"after-pause"` copy — all remain in use.
- Not restyling or repositioning "Zakończ sesję" beyond whatever trivially follows from it being the only button in its wrapper.
- Not changing pause/resume/end behavior or session-closure semantics.

## Implementation Approach

Delete the coupled button and its handler, drop the orphaned i18n key in both locales, and update the tests that referenced the removed control — replacing (not merely deleting) the coverage it carried so the after-pause journey stays guarded at both the unit and e2e layers. Phase 1 keeps the fast suite (unit/typecheck/lint) green; Phase 2 re-homes the slower e2e journey onto the two surviving controls.

## Phase 1: Remove the coupled button and re-home unit coverage

### Overview

Remove the button, its handler, and the orphaned i18n key; fix the unit suite by deleting the two coupled-button tests and adding a paused-state test that asserts the after-pause confirm via `end-session-btn`.

### Changes Required:

#### 1. Dashboard button + handler removal

**File**: `src/app/_components/pomodoro-dashboard.tsx`

**Intent**: Remove the redundant coupled control so only ⏸ (timer card) and "Zakończ sesję" remain. Delete the `pause-and-end-session-btn` button JSX (`:1175-1183`, including its `state === "running"` guard) and the `handlePauseAndEndSessionClick` callback (`:293-299`). Leave the enclosing `flex flex-col items-center gap-2` wrapper (`:1172-1195`) rendering just the `end-session-btn`.

**Contract**: The `state === "running"` conditional that gated the coupled button is removed; `end-session-btn`, `handleEndSessionClick`, `endSessionConfirm*` state, and the `EndSessionConfirmOverlay` render (`:1162-1170`) are untouched. No remaining reference to `handlePauseAndEndSessionClick` or `tDashboard("pauseEndSession")`.

#### 2. Drop the orphaned i18n key (both locales)

**File**: `messages/pl.json` and `messages/en.json`

**Intent**: Remove the now-unused `Session.dashboard.pauseEndSession` string so no dead key lingers.

**Contract**: Delete `"pauseEndSession"` from the `Session.dashboard` object in `messages/pl.json:115` and `messages/en.json:115`; keep `errorDismiss` and `endSession` siblings intact and valid JSON.

#### 3. Fix the unit tests

**File**: `src/app/_components/pomodoro-dashboard.test.tsx`

**Intent**: Remove the two tests that reference the deleted button (`:782-790` "shows pause and end session when running"; `:792-813` "pauses then opens after-pause confirm on pause and end click"). Add one replacement test preserving the after-pause assertion via the surviving control: render with `state: "paused"` and an active session, click `end-session-btn`, and assert the after-pause confirm renders (its "Stay paused" cancel copy) without calling `endSession`.

**Contract**: New test drives `renderBody({ hasActiveSession: true, state: "paused", activeCycle: { id: 42 }, endSession })` → click `end-session-btn` → expect `end-session-confirm-overlay` present and `getByText("Stay paused")` (the `pauseCancelLabel`) → `endSession` not called. Mirrors the existing running-state confirm tests at `:734-780`.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm check`
- Dashboard unit tests pass: `pnpm exec vitest run src/app/_components/pomodoro-dashboard.test.tsx`
- No dangling references: repo grep for `pauseEndSession` and `pause-and-end-session-btn` returns only the change-doc files under `context/`

#### Manual Verification:

- During a running session the timer hub shows only the ⏸ pause icon and "Zakończ sesję" — no "Wstrzymaj i zakończ sesję" button
- Pausing via ⏸ then clicking "Zakończ sesję" shows the "Zakończyć sesję podczas pauzy?" confirm and, on confirm, the session closure
- Ending directly while running (without pausing) still shows the immediate confirm copy

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human before proceeding to Phase 2.

---

## Phase 2: Rewrite the e2e journey to the two-tap path

### Overview

Convert the e2e test that drove the removed coupled button into the two-tap journey using the surviving controls, keeping end-to-end proof that pause→end reaches the after-pause closure.

### Changes Required:

#### 1. Rewrite the pause-and-end e2e case

**File**: `e2e/session-closure.spec.ts`

**Intent**: Replace the coupled-button interaction (`:79-82`) so the test pauses via the timer-card icon, then ends via the standalone button. Start the focused work cycle, click `timer-pause`, assert `timer-panel-paused`, click `end-session-btn`, then assert the existing after-pause confirm → closure flow (`:87-105`) unchanged.

**Contract**: Test title updated to reflect the two-tap journey (e.g. "pause via timer then end session closes session"). Locators `timer-pause` (`timer-panel.tsx:220`) and `end-session-btn` replace `pause-and-end-session-btn`; the confirm/closure assertions (`end-session-confirm-overlay`, `end-session-confirm-btn`, `session-closure-overlay`, `session-closure-line` "wasn't counted", `session-closure-dismiss-btn`) stay as-is. No reference to `pause-and-end-session-btn` remains in the spec.

### Success Criteria:

#### Automated Verification:

- Rewritten spec passes: `pnpm exec playwright test e2e/session-closure.spec.ts`
- No dangling reference: grep of `e2e/` for `pause-and-end-session-btn` is empty

#### Manual Verification:

- The rewritten e2e drives the same user-visible outcome (paused timer → after-pause confirm → closure) via ⏸ and "Zakończ sesję"

**Implementation Note**: After automated verification passes, pause for human confirmation that the e2e journey reads correctly.

---

## Testing Strategy

### Unit Tests:

- Remove coupled-button tests; add a paused-state test asserting the after-pause confirm via `end-session-btn` (retains the assertion the removed `:799` test provided).
- Existing running-state end-session confirm tests (`:728-787`) remain the guard for the `immediate` variant.

### Integration / E2E Tests:

- One rewritten journey: focused work cycle → ⏸ pause → "Zakończ sesję" → after-pause confirm → closure. Standalone immediate-end path (`:37-64`) is unchanged.

### Manual Testing Steps:

1. Start a focused work cycle; confirm only ⏸ and "Zakończ sesję" appear below the timer.
2. Click ⏸ → timer shows Paused with a ▶ Resume; click "Zakończ sesję" → after-pause confirm appears; confirm → closure overlay.
3. Restart a cycle; click "Zakończ sesję" while running (no pause) → immediate confirm copy; confirm → closure.
4. Click ▶ Resume after pausing → timer resumes counting (regression check that pause/resume is intact).

## Migration Notes

None — UI-only removal plus an i18n key deletion. No data, schema, or API changes.

## References

- Frame brief: `context/changes/fix-pause-decouple-end-session/frame.md`
- Bug report: `context/changes/fix-pause-decouple-end-session/bug.md`
- Coupled button + handler: `src/app/_components/pomodoro-dashboard.tsx:293-299`, `:1172-1195`
- Surviving pause control: `src/app/_components/timer-panel.tsx:196-221`
- End-session handler / after-pause variant: `src/app/_components/pomodoro-dashboard.tsx:281-291`; `src/lib/session/end-session-copy.ts`
- Prior feature that introduced the coupling (B-09): `context/archive/2026-06-23-pause-and-end-session/`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append `— <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Remove the coupled button and re-home unit coverage

#### Automated

- [x] 1.1 Type checking passes: `pnpm typecheck`
- [x] 1.2 Linting passes: `pnpm check`
- [x] 1.3 Dashboard unit tests pass: `pnpm exec vitest run src/app/_components/pomodoro-dashboard.test.tsx`
- [x] 1.4 No dangling references: grep for `pauseEndSession` / `pause-and-end-session-btn` returns only `context/` docs (production src + messages clean; remaining e2e ref cleared in Phase 2 / row 2.2)

#### Manual

- [ ] 1.5 Running session shows only ⏸ and "Zakończ sesję" — no coupled button
- [ ] 1.6 ⏸ then "Zakończ sesję" shows the after-pause confirm → closure
- [ ] 1.7 Ending while running (no pause) still shows the immediate confirm

### Phase 2: Rewrite the e2e journey to the two-tap path

#### Automated

- [ ] 2.1 Rewritten spec passes: `pnpm exec playwright test e2e/session-closure.spec.ts`
- [ ] 2.2 No dangling reference: grep of `e2e/` for `pause-and-end-session-btn` is empty

#### Manual

- [ ] 2.3 Rewritten e2e drives paused timer → after-pause confirm → closure via ⏸ and "Zakończ sesję"
