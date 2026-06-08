# Background Tab Return Catch-up (S-22) Implementation Plan

## Overview

When a Pomodoro cycle ends while the browser tab is hidden, returning users should see a calm catch-up header — what finished, how long ago, and the single next wedge action — wrapped around the existing gate UI (`CycleCompleteOverlay`, `CheckInOverlay`, or elevated `TaskSuggestionCard`). Extend `use-pomodoro-cycle` with a one-shot `catchUp` state; add a thin `TabReturnCatchUp` shell in `pomodoro-dashboard`. Visual-only (no alarm replay on focus). No server or schema changes.

## Current State Analysis

Cycle completion is client-authoritative: `handleCycleExpired` sets `state === "completed"` and plays the alarm. `visibilitychange` only runs `recalculateFromEndTime` on become-visible — it can trigger expiry if the fallback timer was throttled while hidden. There is **no** `endedWhileHidden` flag or catch-up surface today; gates render on return but without missed-transition context.

Post-work wedge (auth): `CycleCompleteOverlay` → `onCycleCompleteConfirm` → `awaitingCheckIn` + `CheckInOverlay` → `submitCheckIn` → break auto-start → `TaskSuggestionCard` during break → break-end `CycleCompleteOverlay`. Guest skips check-in/suggestion gates. Duplicate `handleCycleExpired` is already guarded (`stateRef !== "running"`).

### Key Discoveries:

- `handleCycleExpired` at `src/hooks/use-pomodoro-cycle.ts:185-194` — no visibility awareness today
- `visibilitychange` listener at `src/hooks/use-pomodoro-cycle.ts:378-390` — visible-only recalc
- Expired mount recovery at `src/hooks/use-pomodoro-cycle.ts:305-308` — sets `completed` + alarm; treat as hidden expiry for catch-up
- Gate orchestration at `src/app/_components/pomodoro-dashboard.tsx:69-197` — overlay z-index stack (cycle-complete z-50, check-in z-60)
- Hook visibility recalc test exists (`use-pomodoro-cycle.test.tsx:625-678`); no hidden-expiry or catch-up tests
- E2E uses `page.clock` + `advanceClockThroughFastWork` (`e2e/helpers/work-cycle.ts`); no background-tab simulation yet
- No `date-fns` in stack — relative time needs a lightweight `Intl` or manual helper

## Desired End State

1. **Hidden work expiry:** User backgrounds tab before 1s work cycle ends; on return, `tab-return-catchup` banner shows task title + “ended X ago” + calm handoff copy above `cycle-complete-overlay`; no alarm replay on focus.
2. **Hidden break expiry:** Same pattern for break-end overlay with break-specific copy.
3. **Auth wedge:** After hidden work expiry, user confirms → check-in gate shows **without** catch-up reappearing (one-shot dismiss on first gate interaction).
4. **Guest:** Catch-up for work/break confirm only; no check-in/suggestion gates.
5. **One-shot flag:** Subsequent `visibilitychange` events do not re-show catch-up after dismiss.
6. **Verification:** `pnpm check`, `pnpm typecheck`, `pnpm test`, `set CI=true && pnpm test:e2e` including new hook unit tests and `e2e/background-tab-return.spec.ts`.

### Acceptance Criteria (PRD / roadmap mapping)

| Criterion | Ref | Verification |
|-----------|-----|--------------|
| User sees UI prompt when cycle ends (including after background) | FR-013 | Catch-up banner + existing overlay; e2e |
| User confirms transition work → break → work | FR-014 | Existing gate handlers unchanged; e2e wedge |
| Check-in gate reachable after hidden work expiry | FR-020 | Auth e2e through confirm → check-in |
| Suggestion visible during break (no new modal) | FR-021 | Suggestion path unchanged; catch-up does not stack modals |
| Timer drift ≤ ±2s on background return | NFR | Existing hook recalc test still passes; no regression |
| Calm catch-up: what finished, how long ago, single next action | S-22 outcome | Banner copy + testids |

## What We're NOT Doing

- Alarm replay on tab focus (visual-only per research proxy)
- Server persistence of catch-up or `awaitingCheckIn` across refresh (pre-existing regression)
- Title/favicon pulse (S-20)
- Second full-screen modal on top of check-in
- Persisting `catchUp` to localStorage
- Worker-path Playwright proof (test-plan §6 limitation — hook unit tests cover logic)
- iOS Safari full-suspend QA automation (manual only)

## Implementation Approach

Five TDD-friendly phases: pure catch-up helpers → hook state (red/green unit tests) → presentational banner → dashboard wiring → e2e. Catch-up is a **header shell** above existing gates, not a replacement state machine. All gate actions delegate to existing `onCycleCompleteConfirm`, `submitCheckIn`, `acceptSuggestion` handlers; `dismissCatchUp` clears the one-shot flag on first interaction.

## Critical Implementation Details

**Catch-up set timing:** Track `tabWasHiddenWhileRunningRef` — set `true` on `visibilitychange` when `document.visibilityState === "hidden"` and `stateRef === "running"`; clear on `dismissCatchUp`, new cycle start, or after catch-up is set. Set `catchUp` inside a shared `setCatchUpOnHiddenExpiry(gateSnapshot)` helper when `handleCycleExpired` runs and **either** `document.visibilityState !== "visible"` **or** `tabWasHiddenWhileRunningRef` is true (covers fallback-throttled expiry on tab return via `recalculateFromEndTime`). Record `cycleEndedAtMs = endTimeRef.current ?? Date.now()` so “ended ago” reflects the true wall-clock end, not the moment recalc fired. Derive `gate` from post-expiry hook snapshot (`WORK_CONFIRM` or `BREAK_CONFIRM` from `cycleKind`). On `resumeFromActiveCycle` when `endTime <= Date.now()`, call the same helper with `cycleEndedAtMs = endTime` (mount/refresh treated as hidden expiry).

**Gate derivation priority** (when setting or displaying `catchUp.gate`): `awaitingCheckIn` → `CHECK_IN`; else `state === "completed"` + `WORK` → `WORK_CONFIRM`; else `state === "completed"` + break kind → `BREAK_CONFIRM`; else break running + `pendingSuggestion.status === "ready"` → `SUGGESTION_ACCEPT`. Primary MVP paths are `WORK_CONFIRM` and `BREAK_CONFIRM`; `CHECK_IN` / `SUGGESTION_ACCEPT` copy exists for enum completeness but catch-up clears on first interaction so stacking cannot occur.

**Dismiss contract:** Export `dismissCatchUp()` from hook; call from `pomodoro-dashboard` wrappers around `onCycleCompleteConfirm`, `submitCheckIn`, and `acceptSuggestion` **before** delegating to existing handlers. Do not call on overlay dismiss-only paths that do not advance the wedge unless that path is the intended “next action.”

**Z-index:** Catch-up banner renders inside/alongside the active gate container — below check-in (`z-60`), visually above cycle-complete body copy. Use `data-testid="tab-return-catchup"` on the banner root.

**S-20 coordination:** S-20 mute must not ship without S-22 catch-up or title-pulse e2e. This slice is the primary visual path for missed chimes.

---

## Phase 1: Catch-up Types, Gate Derivation, and Copy (TDD)

### Overview

Establish pure, testable foundations — `CatchUpGate` enum, gate derivation from hook snapshot, relative “ended ago” formatting, and calm copy strings — before touching React or the hook.

### Changes Required:

#### 1. Catch-up types

**File**: `src/lib/catch-up/types.ts` (new)

**Intent**: Single source for catch-up gate enum and state shape consumed by hook and UI.

**Contract**: Export `CatchUpGate` union: `"WORK_CONFIRM" | "CHECK_IN" | "BREAK_CONFIRM" | "SUGGESTION_ACCEPT"`. Export `CatchUpState` `{ endedWhileHidden: true; cycleEndedAtMs: number; gate: CatchUpGate } | null` (null = inactive).

#### 2. Gate derivation helper

**File**: `src/lib/catch-up/derive-gate.ts` (new)

**Intent**: Pure function to map a hook snapshot to the first pending gate for catch-up framing.

**Contract**: Export `deriveCatchUpGate(snapshot)` accepting `{ state, cycleKind, awaitingCheckIn, pendingSuggestionStatus }`. Return `CatchUpGate | null` per priority table in Critical Implementation Details; return `null` when no gate applies.

#### 3. Relative time formatter

**File**: `src/lib/catch-up/format-ended-ago.ts` (new)

**Intent**: Format “ended X ago” without adding `date-fns`.

**Contract**: Export `formatEndedAgo(endedAtMs: number, nowMs?: number): string` using `Intl.RelativeTimeFormat` or a simple seconds/minutes bucket (e.g. “just now”, “1 minute ago”). Deterministic when `nowMs` passed (tests).

#### 4. Copy module

**File**: `src/lib/catch-up/copy.ts` (new)

**Intent**: Centralize calm catch-up strings for guest/auth and all gate variants.

**Contract**: Export `getCatchUpCopy(gate, ctx)` where `ctx` includes `{ taskTitle?, cycleKind?, endedAgo }`. Work copy references task title; break copy references break kind; check-in/suggestion copy names single next action without duplicating overlay body text.

#### 5. Unit tests

**File**: `src/lib/catch-up/derive-gate.test.ts`, `src/lib/catch-up/format-ended-ago.test.ts`, `src/lib/catch-up/copy.test.ts` (new)

**Intent**: Lock gate matrix, time formatting edge cases (0s, 59s, 60s, 3600s), and copy presence per gate.

**Contract**: Cover all four gates + null; frozen `nowMs` for relative time.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/lib/catch-up/` passes
- `pnpm check` passes
- `pnpm typecheck` passes

#### Manual Verification:

- Copy reads calmly for work, break, check-in, and suggestion gates (spot-check strings in test output or Storybook-less review of copy module)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Hook `catchUp` State — Hidden Expiry Flag (TDD)

### Overview

Extend `use-pomodoro-cycle` to set a one-shot `catchUp` when expiry fires while hidden or on expired mount recovery; export `catchUp` and `dismissCatchUp`; add hook unit tests (red → green).

### Changes Required:

#### 1. Hook state and set logic

**File**: `src/hooks/use-pomodoro-cycle.ts`

**Intent**: Record hidden expiry and expose dismiss API without changing server completion semantics.

**Contract**:
- Add `catchUp` state (`CatchUpState`, default `null`) and `tabWasHiddenWhileRunningRef` (ref, default `false`).
- On `visibilitychange` to `"hidden"` while `stateRef === "running"`, set `tabWasHiddenWhileRunningRef = true`.
- Extract `setCatchUpOnHiddenExpiry(snapshot)` — sets `catchUp` with `endedWhileHidden: true`, `cycleEndedAtMs: endTimeRef.current ?? Date.now()`, `gate: deriveCatchUpGate(snapshot)`; clears `tabWasHiddenWhileRunningRef`.
- In `handleCycleExpired`, after setting `completed`, call `setCatchUpOnHiddenExpiry` when `document.visibilityState !== "visible"` **or** `tabWasHiddenWhileRunningRef` is true.
- In `resumeFromActiveCycle` expired branch (`endTime <= Date.now()`), call `setCatchUpOnHiddenExpiry` with `cycleEndedAtMs = endTime` (treat mount/refresh as hidden).
- Export `catchUp` and `dismissCatchUp: () => setCatchUp(null)` on hook return object (`dismissCatchUp` also clears `tabWasHiddenWhileRunningRef`).
- Do **not** replay alarm on visibility return; existing `playAlarm` in `handleCycleExpired` unchanged.

#### 2. Hook unit tests

**File**: `src/hooks/use-pomodoro-cycle.test.tsx`

**Intent**: Prove hidden expiry sets flag; visible expiry does not; dismiss clears; visible return when already `completed` does not duplicate flag or re-fire catch-up.

**Contract**:
- Mock `document.visibilityState` to `"hidden"` before advancing timers to expiry → expect `catchUp.endedWhileHidden === true`, `gate === "WORK_CONFIRM"`.
- Same flow with `"visible"` throughout (never hidden) → `catchUp === null`.
- **Visibility-recalc path (primary fallback story):** set hidden while running, advance wall-clock past `endTime` without firing expiry, flip to `"visible"`, dispatch `visibilitychange` → `recalculateFromEndTime` triggers expiry → `catchUp` set with `cycleEndedAtMs` matching `endTime`, not `Date.now()`.
- Expired `resumeFromActiveCycle` → `catchUp` set with `cycleEndedAtMs` from `endTime`.
- After `dismissCatchUp()`, simulate `visibilitychange` → `catchUp` stays null.
- Existing visibility recalc test (`625-678`) still passes (no regression).

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/hooks/use-pomodoro-cycle.test.tsx` passes
- `pnpm check` passes
- `pnpm typecheck` passes

#### Manual Verification:

- None required — hook behavior validated by unit tests

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: `TabReturnCatchUp` Banner Component (TDD)

### Overview

Presentational calm header shell consuming `catchUp`, task context, and copy module; co-located component test.

### Changes Required:

#### 1. Banner component

**File**: `src/app/_components/tab-return-catchup.tsx` (new)

**Intent**: Render catch-up framing above existing gate content without owning gate actions.

**Contract**:
- Props: `{ catchUp: NonNullable<CatchUpState>; taskTitle?: string; cycleKind?: CycleKind | null; className? }`.
- Root `data-testid="tab-return-catchup"`.
- Display headline (what finished), `formatEndedAgo(cycleEndedAtMs)`, and subcopy from `getCatchUpCopy`.
- Styling: calm border/background consistent with existing overlay palette (purple/teal tones); not `fixed` full-screen — banner strip suitable for wrapping gate content.
- Return `null` when `catchUp` is null (caller may guard).

#### 2. Component tests

**File**: `src/app/_components/tab-return-catchup.test.tsx` (new)

**Intent**: Assert testid, task title visibility for `WORK_CONFIRM`, ended-ago text, gate-specific copy.

**Contract**: Render with frozen `cycleEndedAtMs`; snapshot or role/text assertions per gate.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/app/_components/tab-return-catchup.test.tsx` passes
- `pnpm check` passes
- `pnpm typecheck` passes

#### Manual Verification:

- Banner visual weight feels subordinate to gate overlay (no duplicate modal fatigue)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Dashboard Wiring and Dismiss Integration

### Overview

Wire `TabReturnCatchUp` into `pomodoro-dashboard` above the active gate; thread `dismissCatchUp` into gate interaction handlers; respect guest vs auth gate flags.

### Changes Required:

#### 1. Dashboard body props and catch-up shell

**File**: `src/app/_components/pomodoro-dashboard.tsx`

**Intent**: Show catch-up only when `pomodoro.catchUp != null` and the matching gate is active.

**Contract**:
- When `catchUp.gate === "WORK_CONFIRM"` or `"BREAK_CONFIRM"` and existing overlay conditions match, render `TabReturnCatchUp` immediately above `CycleCompleteOverlay` content (or as first child inside a thin wrapper `div` that groups banner + overlay).
- When `catchUp.gate === "CHECK_IN"` and `enableCheckInGate && awaitingCheckIn`, render banner above `CheckInOverlay`.
- When `catchUp.gate === "SUGGESTION_ACCEPT"` and `enableSuggestionGate` and suggestion `ready`, render banner above `TaskSuggestionCard`.
- Guest: only work/break confirm gates (`enableCheckInGate` / `enableSuggestionGate` false).

#### 2. Dismiss on first interaction

**File**: `src/app/_components/pomodoro-dashboard.tsx`

**Intent**: One-shot clear per research — no duplicate overlays on subsequent visibility events.

**Contract**:
- Wrap `onCycleCompleteConfirm` to call `pomodoro.dismissCatchUp()` then delegate.
- Wrap `submitCheckIn` to dismiss before await.
- Wrap `acceptSuggestion` to dismiss before void accept.
- Do not dismiss on passive visibility events.

#### 3. Optional re-export

**File**: `src/hooks/use-pomodoro-cycle.ts` (if needed)

**Intent**: Export `CatchUpGate` type for dashboard typing if not imported from `~/lib/catch-up/types`.

**Contract**: Type-only re-export or direct import from lib — no duplicate enum.

### Success Criteria:

#### Automated Verification:

- `pnpm test` passes (full unit suite)
- `pnpm check` passes
- `pnpm typecheck` passes

#### Manual Verification:

- Auth: background tab during 1s work cycle → return shows banner + cycle-complete overlay; confirm → banner gone, check-in shows without banner
- Guest: same flow stops at break confirm without check-in copy
- Break-end hidden expiry shows break-specific banner

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 5: E2E Background Tab Return Spec

### Overview

Playwright proof for calm catch-up on tab return after hidden work expiry; reuse fast-work helpers and add visibility simulation helper.

### Changes Required:

#### 1. Visibility helper

**File**: `e2e/helpers/visibility.ts` (new)

**Intent**: Simulate hidden tab during clock advance for e2e.

**Contract**: Export `runWhileHidden(page, fn)` that mocks `document.visibilityState` via `Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" })` inside `page.evaluate` (read-only in real browsers), runs `fn` (e.g. clock advance), restores `"visible"` with another `defineProperty`, and dispatches `visibilitychange`. Hook unit tests remain authority for the visibility-recalc fallback path; e2e proves expiry-while-hidden mock + gate wedge.

#### 2. E2E spec

**File**: `e2e/background-tab-return.spec.ts` (new)

**Intent**: Risk-oriented browser proof for S-22 primary path (auth work cycle ended while hidden).

**Contract**:
- Use `storageState` auth fixture pattern from `e2e/pomodoro-cycle.spec.ts` / `seed.spec.ts`.
- `startFocusedWorkCycle` with 1s duration.
- `page.clock.install()`; `runWhileHidden` + `page.clock.runFor(FAST_WORK_CLOCK_MS)` to expire while hidden.
- Restore visible; dispatch visibility change if not automatic.
- Assert `tab-return-catchup` visible with task title and ended-ago text.
- Assert `cycle-complete-overlay` visible.
- Click wedge confirm (“Continue later”); assert `tab-return-catchup` hidden; assert `check-in-overlay` visible (auth).
- Optional second test: guest path — banner + overlay, no check-in after confirm.

#### 3. Seed reference (optional)

**File**: `e2e/seed.spec.ts`

**Intent**: Document catch-up oracle in seed template if project convention requires — only if seed already lists S-22 risks.

**Contract**: Add comment or lightweight step referencing `tab-return-catchup` testid — optional, not blocking.

### Success Criteria:

#### Automated Verification:

- `set CI=true && pnpm test:e2e e2e/background-tab-return.spec.ts` passes
- `set CI=true && pnpm test:e2e` full suite passes (no regressions)
- `pnpm test` passes

#### Manual Verification:

- iOS Safari background suspend: manual spot-check that visibility recalc + catch-up appear on wake (document in PR test plan)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- `src/lib/catch-up/*` — gate derivation matrix, relative time, copy
- `src/hooks/use-pomodoro-cycle.test.tsx` — hidden vs visible expiry, mount recovery, dismiss one-shot
- `src/app/_components/tab-return-catchup.test.tsx` — render per gate

### Integration / E2E:

- `e2e/background-tab-return.spec.ts` — auth hidden work expiry → catch-up → check-in wedge
- Regression: `e2e/pomodoro-cycle.spec.ts`, `e2e/task-suggestion.spec.ts`, `e2e/first-run-onboarding.spec.ts` (overlay stacking)

### Manual Testing Steps:

1. Chrome: start 1s work, switch tab before end, return — banner + overlay, no double alarm on focus
2. Confirm work — banner does not reappear on check-in
3. Guest mode — work/break catch-up only
4. Break-end while hidden — break copy and overlay
5. Muted audio (future S-20) — catch-up still primary visual cue

## Performance Considerations

Catch-up adds one boolean state and a small banner render — negligible. Gate derivation is O(1) pure function. No new listeners beyond existing `visibilitychange`.

## Migration Notes

No data migration. Pure client-side additive state; clearing on dismiss means no persisted rollback needed.

## References

- Related research: `context/changes/background-tab-return-catchup/research.md`
- Roadmap S-22: `context/foundation/roadmap.md`
- Timer + visibility prior art: `context/archive/2026-06-04-testing-critical-path-persistence-timer/research.md`
- Overlay stacking: `context/archive/2026-06-07-first-run-wedge-onboarding/plan.md`
- Hook expiry: `src/hooks/use-pomodoro-cycle.ts:185-194`
- Dashboard gates: `src/app/_components/pomodoro-dashboard.tsx:69-197`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Catch-up Types, Gate Derivation, and Copy (TDD)

#### Automated

- [x] 1.1 `pnpm exec vitest run src/lib/catch-up/` passes — 60d05d7
- [x] 1.2 `pnpm check` passes — 60d05d7
- [x] 1.3 `pnpm typecheck` passes — 60d05d7

#### Manual

- [ ] 1.4 Copy reads calmly for work, break, check-in, and suggestion gates

### Phase 2: Hook `catchUp` State — Hidden Expiry Flag (TDD)

#### Automated

- [x] 2.1 `pnpm exec vitest run src/hooks/use-pomodoro-cycle.test.tsx` passes — 99321c3
- [x] 2.2 `pnpm check` passes — 99321c3
- [x] 2.3 `pnpm typecheck` passes — 99321c3

### Phase 3: `TabReturnCatchUp` Banner Component (TDD)

#### Automated

- [x] 3.1 `pnpm exec vitest run src/app/_components/tab-return-catchup.test.tsx` passes — c672669
- [x] 3.2 `pnpm check` passes — c672669
- [x] 3.3 `pnpm typecheck` passes — c672669

#### Manual

- [ ] 3.4 Banner visual weight feels subordinate to gate overlay

### Phase 4: Dashboard Wiring and Dismiss Integration

#### Automated

- [x] 4.1 `pnpm test` passes (full unit suite) — cf69fcd
- [x] 4.2 `pnpm check` passes — cf69fcd
- [x] 4.3 `pnpm typecheck` passes — cf69fcd

#### Manual

- [ ] 4.4 Auth hidden work expiry → banner + overlay; confirm clears banner; check-in without banner
- [ ] 4.5 Guest work/break catch-up without check-in gates
- [ ] 4.6 Break-end hidden expiry shows break-specific banner

### Phase 5: E2E Background Tab Return Spec

#### Automated

- [ ] 5.1 `set CI=true && pnpm test:e2e e2e/background-tab-return.spec.ts` passes
- [ ] 5.2 `set CI=true && pnpm test:e2e` full suite passes
- [x] 5.3 `pnpm test` passes

#### Manual

- [ ] 5.4 iOS Safari background suspend manual spot-check documented in PR
