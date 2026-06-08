# Mindful Session Wind-Down Nudge Implementation Plan

## Overview

Implement S-16: an optional, dismissible wind-down gate for authenticated users after a Fading check-in when session fatigue or interruption signals align. The nudge offers **End session** (existing `endSession` flow) or **Keep going** (defer break start and suggestion fetch until resolved). Pure evaluation lives in `wind-down-nudge.ts`; UI in `WindDownOverlay`; minimal hook/dashboard wiring preserves merge isolation from parallel slice S-15.

## Current State Analysis

- **Check-in gate exists** — `submitCheckIn` in `use-pomodoro-cycle.ts` persists energy, then immediately runs `confirmComplete` + `fetchSuggestion` with no intermediate gate.
- **Session signals available** — `completedWorkCycles` is cached in the hook; `interruptionCount` is on `DomainSession` from `sessions.getOrCreateActive()` but not cached today.
- **Overlay patterns established** — `CheckInOverlay` (blocking gate, `z-[60]`), `FirstRunOverlay` (dismissible dialog, `z-[55]`).
- **Scoring rationale helpers** — `buildRationale` / `getDominantRationaleKey` in `src/lib/scoring/` provide fatigue and interruption copy aligned with suggestion scoring.
- **E2E helpers** — `completeCheckIn`, `completeWorkCycleWithCheckIn`, `task-suggestion.spec.ts` patterns cover check-in → suggestion; no wind-down or dedicated session-end path tests yet.
- **No wind-down code** — change folder has research only; guest path skips check-in and must skip wind-down.

### Key Discoveries:

- `use-pomodoro-cycle.ts:889-929` — primary insertion point; both normal and mid-cycle check-ins share `submitCheckIn`.
- `pomodoro-dashboard.tsx:69-72` — `showSuggestionCard` requires break running + non-idle suggestion; deferring `confirmComplete`/`fetchSuggestion` naturally blocks the card.
- `score-task.ts:29-44` — fatigue threshold at `completedWorkCycles >= 4` post-complete; pre-complete evaluation uses `>= 3` to mean "this will be the 4th."
- Roadmap orchestrator rule — at most one interstitial + one gate per transition: sequence must be check-in → wind-down (if triggered) → break → suggestion inline.

## Desired End State

Authenticated user completing a WORK cycle check-in with **Fading** energy sees a wind-down overlay when `completedWorkCycles >= 3` OR `interruptionCount >= 2`, unless they chose **Keep going** on a prior wind-down this session. Overlay shows invitational copy with a one-line rationale (fatigue or interruptions dominant). **Keep going** dismisses until the next check-in, completes the cycle, starts break, fetches suggestion. **End session** completes the in-flight cycle, skips break/suggestion, calls existing `endSession()`. Guest users never see the overlay. E2E spec proves trigger, dismiss, end-session, and negative paths. `test-plan.md` §6 documents the new e2e pattern.

### Verification:

- `pnpm check` and `pnpm test` pass.
- `set CI=true && pnpm test:e2e e2e/mindful-session-wind-down.spec.ts` passes.
- Manual: Fading + fatigue triggers nudge; Steady/Focused do not; decline suppresses until next check-in.

## What We're NOT Doing

- Guest-mode wind-down (no Fading signal without check-in).
- Server-persisted dismiss flag (MVP in-memory only; refresh mid-break may re-show — acceptable).
- New tRPC procedure for wind-down evaluation.
- S-12 visual polish / design-token pass (functional overlay first).
- S-15 kickoff suggestion work (parallel slice — touch only shared mount points minimally).
- Dedicated mid-cycle-only wind-down fork (mid-cycle uses same `submitCheckIn` path).
- Copy overlap with S-21 Fading re-entry (invitational tone only; no preachy "you should stop" language).

## Implementation Approach

1. **TDD pure module first** — `shouldShowWindDownNudge` and `buildWindDownRationale` with full unit coverage; no React coupling.
2. **Isolated UI component** — `WindDownOverlay` mirrors `FirstRunOverlay` structure (two actions, `z-[58]`).
3. **Minimal hook diff** — add three state fields + two resolve handlers; branch `submitCheckIn` after check-in persist; extract post-check-in continuation into a small internal helper to avoid duplicating `confirmComplete` + `fetchSuggestion` calls.
4. **Dashboard gate** — `enableWindDownGate` prop (authenticated only); mount overlay between check-in block and end-session button; hide suggestion card while `awaitingWindDown`.
5. **E2E last** — new spec + helper; update `test-plan.md` §6.3 cookbook entry.

## Critical Implementation Details

### State sequencing

After `createCheckIn` succeeds: close check-in overlay (`setAwaitingCheckIn(false)`), evaluate nudge. If triggered, set `awaitingWindDown` and **return before** `confirmComplete` — break has not started, suggestion fetch has not fired. **Keep going** sets `windDownDismissed = true`, clears `awaitingWindDown`, then runs deferred continuation. **End session** clears `awaitingWindDown`, runs `completeWorkCycleOnly(markTaskDone)` (persists cycle completion **without** `startBreakAfterWorkComplete`), then `endSession()` without `fetchSuggestion`.

### S-15 merge isolation

New logic stays in `wind-down-nudge.ts` and `wind-down-overlay.tsx`. Hook changes limited to: new state declarations, `submitCheckIn` branch, two exported resolve callbacks, reset in `endSession`. Dashboard changes: one prop, one conditional render block, `showSuggestionCard` guard. Do not refactor kickoff/suggestion orchestration in this slice.

## Phase 1: Wind-Down Evaluation Module (TDD)

### Overview

Pure functions encoding trigger rules, dismiss suppression, and rationale copy. No UI or hook dependencies.

### Changes Required:

#### 1. Evaluation module

**File**: `src/lib/session/wind-down-nudge.ts`

**Intent**: Centralize S-16 trigger and rationale logic so hook and tests share one source of truth; align thresholds with scoring fatigue/interruption signals.

**Contract**: Export `WindDownInput` (`energy`, `completedWorkCycles`, `interruptionCount`, `dismissed`), `shouldShowWindDownNudge(input): boolean`, `buildWindDownRationale(input): string`. Trigger: `energy === "FADING" && !dismissed && (completedWorkCycles >= 3 || interruptionCount >= 2)`. Rationale: prefer fatigue copy when `completedWorkCycles >= 3`, else interruptions when `interruptionCount >= 2`; delegate copy to `buildRationale("fatigue" | "interruptions", context)` with `ScoringContext` shape (`energy: "FADING"`, pass `completedWorkCycles + 1` for fatigue line so copy reads "after N cycles" for the impending 4th).

#### 2. Invitational copy constants

**File**: `src/lib/session/wind-down-copy.ts`

**Intent**: Keep overlay headline/body invitational (FR-022 override culture); avoid S-19 override-ack tone and S-21 preachiness.

**Contract**: Export `WIND_DOWN_TITLE`, `WIND_DOWN_BODY` (optional session wrap-up invitation), `WIND_DOWN_KEEP_GOING_LABEL`, `WIND_DOWN_END_SESSION_LABEL`. Copy must not use "should", "mistake", or imperative stop language (mirror `override-ack-copy.test.ts` guard pattern).

#### 3. Unit tests

**File**: `src/lib/session/wind-down-nudge.test.ts`

**Intent**: Lock trigger matrix and rationale selection before hook wiring.

**Contract**: Cases — Fading+f fatigue triggers; Fading+interruptions triggers; Fading alone does not; Steady/Focused never trigger; `dismissed: true` suppresses; boundary `completedWorkCycles === 3` triggers, `=== 2` does not; `interruptionCount === 2` triggers, `=== 1` does not; rationale returns fatigue vs interruptions string per dominant signal.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/lib/session/wind-down-nudge.test.ts` passes (red → green via TDD).
- `pnpm check` passes.
- `pnpm typecheck` passes.

#### Manual Verification:

- N/A — pure module only.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: WindDownOverlay Component

### Overview

Dismissible gate overlay with rationale, **Keep going**, and **End session** actions. No hook wiring yet — component is testable in isolation.

### Changes Required:

#### 1. Overlay component

**File**: `src/app/_components/wind-down-overlay.tsx`

**Intent**: Render the wind-down gate UI following existing overlay conventions.

**Contract**: Props: `rationale: string`, `onKeepGoing: () => void`, `onEndSession: () => void`, `isSubmitting?: boolean`. `data-testid`: `wind-down-overlay`, `wind-down-keep-going-btn`, `wind-down-end-session-btn`, `wind-down-rationale`. Fixed overlay `z-[58]`, `role="dialog"`. Primary action: Keep going (purple, matches first-run). Secondary: End session (muted/red hover, matches end-session-btn tone). Disable both buttons while `isSubmitting`.

### Success Criteria:

#### Automated Verification:

- `pnpm check` passes.
- `pnpm typecheck` passes.
- `pnpm test` passes (existing suite; no regressions).

#### Manual Verification:

- Temporarily mount overlay in Storybook/dev placeholder or via test page — verify readable rationale, both buttons visible, z-index does not clash with check-in overlay pattern.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Hook Gate + Dashboard Integration

### Overview

Wire evaluation into `submitCheckIn`, expose resolve handlers, mount overlay on authenticated dashboard, block suggestion until gate resolves.

### Changes Required:

#### 1. Hook state and transition gate

**File**: `src/hooks/use-pomodoro-cycle.ts`

**Intent**: Insert wind-down gate between check-in persist and break/suggestion transition; reuse existing `endSession` for End session path.

**Contract**: New state — `awaitingWindDown`, `windDownDismissed` (session-scoped), `windDownRationale`. New exports — `awaitingWindDown`, `windDownRationale`, `onWindDownKeepGoing`, `onWindDownEndSession`. Internal helpers: `completeWorkCycleOnly(markTaskDone)` — `cycles.complete` + worker teardown + `completedWorkCycles` refresh, **no** `startBreakAfterWorkComplete`; `continueAfterCheckIn(markTaskDone, workCycleId)` — `confirmComplete` + `fetchSuggestion`. `submitCheckIn` after successful `createCheckIn`: fetch `sessions.getOrCreateActive()` for `interruptionCount`; if `shouldShowWindDownNudge({ energy, completedWorkCycles, interruptionCount, dismissed: windDownDismissed })` → set rationale + `awaitingWindDown`, return (leave `setIsConfirming(false)` in `finally` so overlay buttons are enabled). Else call `continueAfterCheckIn`. `onWindDownKeepGoing` / `onWindDownEndSession`: wrap async work with `setIsConfirming(true/false)` (reuse `isConfirming` for overlay `isSubmitting`). `onWindDownKeepGoing`: set `windDownDismissed = true`, clear `awaitingWindDown`, call `continueAfterCheckIn`. `onWindDownEndSession`: clear `awaitingWindDown`, `await completeWorkCycleOnly(markTaskDone)`, then `endSession()` (no break, no `fetchSuggestion`). Reset `windDownDismissed` and `awaitingWindDown` in `endSession`. Skip evaluation when `mode === "guest"`. Apply to mid-cycle path (shared `submitCheckIn`).

#### 2. Dashboard mount and suggestion guard

**File**: `src/app/_components/pomodoro-dashboard.tsx`

**Intent**: Show overlay only for authenticated users; prevent suggestion card while wind-down gate is open.

**Contract**: New prop `enableWindDownGate` (default `false`). `AuthenticatedPomodoroDashboard` passes `enableWindDownGate` alongside `enableCheckInGate`. Render `WindDownOverlay` when `enableWindDownGate && pomodoro.awaitingWindDown`. Wire `onKeepGoing` → `onWindDownKeepGoing`, `onEndSession` → `onWindDownEndSession`, `isSubmitting` → `pomodoro.isConfirming`. Extend `showSuggestionCard` condition with `!pomodoro.awaitingWindDown`. Gate `CycleCompleteOverlay` with `!pomodoro.awaitingWindDown` (alongside existing `!awaitingCheckIn`) so only one interstitial is visible during the wind-down gate. Place overlay after `CheckInOverlay` block, before `end-session-btn`.

### Success Criteria:

#### Automated Verification:

- `pnpm check` passes.
- `pnpm typecheck` passes.
- `pnpm test` passes.

#### Manual Verification:

- Authenticated: complete 4 WORK cycles, select Fading on 4th check-in → wind-down appears, break timer not running yet, no suggestion card.
- **Keep going** → break starts, suggestion card loads.
- **End session** → session ends, idle state, `hasActiveSession` false, no suggestion.
- Fading on 1st cycle → no wind-down.
- Steady/Focused after fatigue → no wind-down.
- **Keep going** then Fading+f fatigue on next check-in → nudge reappears.
- Guest mode → no wind-down overlay at any point.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: E2E Proofs + Test-Plan Cookbook

### Overview

Browser-level proof for wind-down trigger, dismiss, end-session, and negative paths. Document pattern in quality contract cookbook.

### Changes Required:

#### 1. E2E helpers

**File**: `e2e/helpers/wind-down.ts` (new)

**Intent**: Reusable wind-down assertions for specs and future slices.

**Contract**: `expectWindDownVisible(page, { rationale? })`, `dismissWindDownKeepGoing(page)`, `endSessionViaWindDown(page)` — target test IDs from Phase 2.

**File**: `e2e/helpers/check-in.ts`

**Intent**: Optional convenience for check-in + wind-down sequences.

**Contract**: Export `completeCheckInWithOptionalWindDown(page, energy, action?: "keep-going" | "end-session")` if it reduces spec duplication; otherwise keep helpers separate.

**File**: `e2e/helpers/idle-cycle.ts`

**Intent**: Prevent `ensureIdleCycle` from hanging when a wind-down gate is open from a prior test step.

**Contract**: In the reset loop, if `wind-down-overlay` is visible, click `wind-down-keep-going-btn` (default) before other dismissals; re-check idle after dismissal.

#### 2. E2E spec

**File**: `e2e/mindful-session-wind-down.spec.ts`

**Intent**: Risk proof for S-16 / FR-019–FR-021 mindful guardrail — gate ordering and override paths.

**Contract**: Model on `e2e/seed.spec.ts` + `e2e/task-suggestion.spec.ts` (provenance header, per-test auth, `ensureIdleCycle` in `beforeEach`). Tests:
- **Trigger (fatigue path)**: 3 cycles with `steady` check-in, 4th cycle `fading` → `wind-down-overlay` visible with fatigue rationale; break not running until Keep going.
- **Trigger (interruption path)**: 1st cycle `fading` after mid-cycle task switch (≥2 `interruptionCount`) → overlay visible with interruptions rationale; no fatigue cycles required.
- **Keep going → suggestion**: after dismiss, break `timer-panel-running`, `task-suggestion-card` appears (or loading).
- **End session path**: trigger nudge → `wind-down-end-session-btn` → `end-session-btn` hidden / `hasActiveSession` false / idle dashboard.
- **Dismiss suppresses**: Keep going on 4th cycle; 5th cycle Fading+f fatigue → no overlay (same session).
- **Negative — energy**: 4th cycle `focused` or `steady` with fatigue → no overlay; suggestion proceeds normally.
- **Negative — fatigue**: 1st cycle `fading` → no overlay.

Run: `set CI=true && pnpm test:e2e e2e/mindful-session-wind-down.spec.ts`. Record deliberate-break VERIFY in `e2e/DELIBERATE-BREAK.md` per AGENTS.md before merge.

#### 3. Test-plan cookbook update

**File**: `context/foundation/test-plan.md`

**Intent**: Fill §6 cookbook so `/10x-tdd` and future agents know how to add wind-down e2e tests.

**Contract**: Add under §6.3: **Mindful session wind-down (S-16, FR-019/FR-020)** entry — spec path, helpers, trigger setup (multi-cycle steady then fading), test IDs, run command, reference test names. Update `last_updated` line in file header.

### Success Criteria:

#### Automated Verification:

- `set CI=true && pnpm test:e2e e2e/mindful-session-wind-down.spec.ts` passes.
- `pnpm check` passes.
- `pnpm test` passes.

#### Manual Verification:

- Review e2e failure screenshots on deliberate break (overlay missing, wrong ordering) confirm assertions catch user-visible regressions.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- `wind-down-nudge.test.ts` — full trigger matrix, dismiss flag, rationale dominance, boundary values.
- Optional: `wind-down-copy.test.ts` — tone guards (no preachy words).

### Integration Tests:

- None required for MVP (client-side evaluation; `endSession` and `checkIn.create` already covered elsewhere).

### E2E Tests:

- `mindful-session-wind-down.spec.ts` — trigger, keep-going, end-session, dismiss suppression, negative energy/fatigue paths.

### Manual Testing Steps:

1. Authenticated 4-cycle fatigue + Fading → nudge → Keep going → suggestion.
2. Same trigger → End session → clean idle, no suggestion.
3. Guest session → no nudge after cycle complete.
4. Mid-cycle end + Fading with `interruptionCount >= 2` → nudge triggers.

## Performance Considerations

- One extra `sessions.getOrCreateActive()` call per check-in when evaluating wind-down — acceptable; only on authenticated WORK check-in submit.
- No additional polling or persistence writes.

## Migration Notes

- No schema migration.
- No data backfill.
- In-memory dismiss resets on session end or page refresh — document as known MVP limitation.

## References

- Related research: `context/changes/mindful-session-wind-down/research.md`
- PRD: FR-019, FR-020, FR-021 (`context/foundation/prd.md`)
- Roadmap S-16: `context/foundation/roadmap.md`
- Check-in gate pattern: `src/hooks/use-pomodoro-cycle.ts:889-929`
- Overlay pattern: `src/app/_components/first-run-overlay.tsx`
- Suggestion e2e exemplar: `e2e/task-suggestion.spec.ts`
- S-19 tone reference: `src/lib/suggestion/override-ack-copy.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Wind-Down Evaluation Module (TDD)

#### Automated

- [x] 1.1 `pnpm exec vitest run src/lib/session/wind-down-nudge.test.ts` passes (red → green via TDD) — 7870c68
- [x] 1.2 `pnpm check` passes — 7870c68
- [x] 1.3 `pnpm typecheck` passes — 7870c68

### Phase 2: WindDownOverlay Component

#### Automated

- [x] 2.1 `pnpm check` passes — 8251287
- [x] 2.2 `pnpm typecheck` passes — 8251287
- [x] 2.3 `pnpm test` passes (existing suite; no regressions) — 8251287

#### Manual

- [ ] 2.4 Overlay renders rationale and both actions with correct z-index pattern

### Phase 3: Hook Gate + Dashboard Integration

#### Automated

- [x] 3.1 `pnpm check` passes
- [x] 3.2 `pnpm typecheck` passes
- [x] 3.3 `pnpm test` passes

#### Manual

- [ ] 3.4 Authenticated Fading+fatigue triggers nudge; Keep going proceeds to break and suggestion
- [ ] 3.5 End session path ends session without suggestion; guest never sees overlay
- [ ] 3.6 Keep going suppresses nudge until next check-in; negatives (Steady/Focused, low fatigue) verified

### Phase 4: E2E Proofs + Test-Plan Cookbook

#### Automated

- [ ] 4.1 `set CI=true && pnpm test:e2e e2e/mindful-session-wind-down.spec.ts` passes
- [ ] 4.2 `pnpm check` passes
- [ ] 4.3 `pnpm test` passes

#### Manual

- [ ] 4.4 Deliberate-break review confirms e2e catches gate ordering regressions
