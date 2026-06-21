# Fix Graceful Session End While Running (B-08 / T-04) Implementation Plan

## Overview

Enable users to end an active session while a work or break cycle is **running** or **paused**. T-04 today: the End session button is disabled during `running`, so users must Interrupt or wait. The hook's `endSession()` already interrupts the active cycle and presents the closure overlay — this slice removes the UI guard and adds a calm confirm step before calling the existing path.

## Current State Analysis

**Dashboard disable** — `pomodoro-dashboard.tsx:650` sets `disabled={pomodoro.state === "running"}` on `end-session-btn`. Paused cycles already allow end session.

**Hook ready** — `endSession()` (`use-pomodoro-cycle.ts:3082–3190`) handles running (interrupt + end) and paused (terminalize without interrupt count). Vitest covers `"endSession interrupts running cycle before ending session"`.

**E2E masks bug** — `e2e/session-closure.spec.ts:37–43` clicks Interrupt before End session; belt never asserts running-state end path.

**F-07 / closure mutex** — B-05 guards prevent kickoff/check-in stacking with closure overlay; confirm overlay is ephemeral and user-initiated — no new conductor beat.

### Key Discoveries

- Minimal variant is **dashboard-only** — no tRPC, Prisma, or hook changes.
- `OverlayScrim` + `OverlayCard` pattern (`wind-down-overlay.tsx`, `break-alerts-permission-prompt.tsx`) is the established confirm surface.
- Full pause-then-end variant deferred — S-24 shipped but dual-action UX is separate scope.

## Desired End State

1. During a running or paused cycle, End session button is **enabled**.
2. Click → confirm overlay with calm copy; Cancel dismisses with no side effects.
3. Confirm → `endSession()` → dismissible closure overlay; session cleared; no kickoff/check-in flash (existing mutex).
4. When idle-with-session (post-interrupt), End session still works **without** confirm (preserve current fast path).
5. Belt e2e ends session while timer running without pre-interrupt.

## What We're NOT Doing

- Pause-then-end dual-action button (full B-08 variant)
- Hook or API changes to `endSession` / `cycles.interrupt`
- F-07 conductor extension or new transition beat
- Copy changes to closure lines or wind-down overlay
- Guest vs auth divergence beyond existing session paths

## Implementation Approach

Three phases: TDD copy + overlay component → dashboard wiring with component tests → belt e2e. Pre-edit `pnpm change-impact` on dashboard (timer-hub adjacent).

## Critical Implementation Details

**Confirm predicate:** Show confirm when `state === "running" || state === "paused"`. Idle + `hasActiveSession` → direct `endSession()` (matches existing e2e).

**Overlay mutex:** Confirm overlay uses `OverlayScrim` at z-index 58 (same tier as wind-down). Only one confirm open at a time (local `useState`). Do not render confirm when wedge gates that block interaction are active — if user clicked End session, confirm takes focus; on cancel, wedge state unchanged.

**Loading state:** Use local `isEndingSession` in dashboard while `await endSession()` — `isConfirming` is scoped to check-in/wind-down paths only and is not set by `endSession()`.

## Phase 1: Copy module + confirm overlay (TDD)

### Overview

Extract calm confirm strings; build `EndSessionConfirmOverlay` with co-located tests.

### Changes Required

#### 1. Copy module

**File**: `src/lib/session/end-session-copy.ts`

**Intent**: Centralize title, body, confirm/cancel labels for destructive end-session confirm.

**Contract**: Export constants; add `end-session-copy.test.ts` asserting non-empty strings and calm tone (no exclamation marks).

#### 2. Confirm overlay component

**File**: `src/app/_components/end-session-confirm-overlay.tsx`

**Intent**: Skippable confirm dialog using `OverlayScrim` / `OverlayCard`.

**Contract**:
- Props: `onConfirm`, `onCancel`, `isSubmitting?`
- `data-testid="end-session-confirm-overlay"`, confirm `end-session-confirm-btn`, cancel `end-session-confirm-cancel-btn`
- Co-located `end-session-confirm-overlay.test.tsx`: renders copy, fires callbacks, disables when submitting

### Success Criteria

#### Automated Verification

- `pnpm exec vitest run src/lib/session/end-session-copy.test.ts src/app/_components/end-session-confirm-overlay.test.tsx`
- `pnpm check`

#### Manual Verification

- —

---

## Phase 2: Dashboard wiring + component tests

### Overview

Remove running disable guard; wire confirm overlay state in dashboard body.

### Changes Required

#### 1. Dashboard end-session flow

**File**: `src/app/_components/pomodoro-dashboard.tsx`

**Intent**: Enable End session during running/paused; confirm before destructive end.

**Contract**:
- Remove `disabled={pomodoro.state === "running"}` (keep disabled only when `isConfirming` if needed for double-submit).
- Local state `endSessionConfirmOpen`.
- `onClick`: if running/paused → set confirm open; else → `endSession()`.
- Render `EndSessionConfirmOverlay` when open; confirm → `endSession()` then close; cancel → close only.

**Pre-edit**: `pnpm change-impact -- src/app/_components/pomodoro-dashboard.tsx`

#### 2. Component characterization

**File**: `src/app/_components/pomodoro-dashboard.test.tsx`

**Intent**: Pin T-04 fix at dashboard layer.

**Contract**:
- Running + `hasActiveSession`: `end-session-btn` **enabled** (not disabled).
- Click end session when running → confirm overlay visible; cancel hides overlay without calling `endSession`.
- Confirm calls `endSession` mock once.

### Success Criteria

#### Automated Verification

- `pnpm exec vitest run src/app/_components/pomodoro-dashboard.test.tsx`
- `pnpm check`
- `pnpm typecheck`

#### Manual Verification

- Start 30s work cycle → End session enabled → confirm → closure overlay → dismiss → idle home.

---

## Phase 3: Belt e2e — end session while running

### Overview

Replace interrupt-first workaround in session-closure belt spec with running-state end path.

### Changes Required

#### 1. Session closure e2e

**File**: `e2e/session-closure.spec.ts`

**Intent**: Belt proof that end session works while timer running.

**Contract**:
- After `startFocusedWorkCycle`, assert `end-session-btn` enabled while `timer-panel-running` visible.
- Click end session → confirm overlay → confirm → closure overlay → dismiss.
- Remove Interrupt click from this test path.
- Tag remains belt-eligible (no `@skip-belt`).

#### 2. Idle helper (if needed)

**File**: `e2e/helpers/idle-cycle.ts`

**Intent**: Helper should handle confirm overlay when ending session during cleanup.

**Contract**: If end session opens confirm, click confirm before expecting closure/idle.

### Success Criteria

#### Automated Verification

- `set CI=true && pnpm exec playwright test e2e/session-closure.spec.ts --grep-invert @skip-belt`
- `pnpm test`

#### Manual Verification

- —

---

## References

- `context/changes/fix-graceful-session-end-while-running/research.md`
- `context/foundation/user-flow.md` T-04
- `context/foundation/roadmap-references/items/B-08.md`
- `context/foundation/roadmap-references/flow-coherence-recommendations.md` B-08 section
- Archived S-24: `context/archive/2026-06-18-cycle-pause-resume/`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Copy module + confirm overlay (TDD)

#### Automated

- [x] 1.1 Add end-session copy module + unit tests
- [x] 1.2 Add EndSessionConfirmOverlay + component tests

### Phase 2: Dashboard wiring + component tests

#### Automated

- [ ] 2.1 Wire confirm flow in pomodoro-dashboard (remove running disable)
- [ ] 2.2 Add dashboard characterization tests for T-04

#### Manual

- [ ] 2.3 Smoke: end session while running in local dev

### Phase 3: Belt e2e — end session while running

#### Automated

- [ ] 3.1 Update session-closure.spec.ts for running-state end path
- [ ] 3.2 Adjust idle-cycle helper for confirm overlay if needed
