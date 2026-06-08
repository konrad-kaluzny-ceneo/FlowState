<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Mindful Session Wind-Down Nudge Implementation Plan

- **Plan**: `context/changes/mindful-session-wind-down/plan.md`
- **Mode**: Deep
- **Date**: 2026-06-08
- **Verdict**: SOUND (after auto-fixes)
- **Findings**: 1 critical, 4 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | WARNING → PASS (after F1, F5) |
| Lean Execution | PASS |
| Architectural Fitness | WARNING → PASS (after F2) |
| Blind Spots | FAIL → PASS (after F1, F3, F4) |
| Plan Completeness | PASS |

## Grounding

Grounding: 7/7 paths ✓, 6/6 symbols ✓, research↔plan ✓

Verified paths: `use-pomodoro-cycle.ts`, `pomodoro-dashboard.tsx`, `first-run-overlay.tsx`, `rationale.ts`, `task-suggestion.spec.ts`, `check-in.ts`, `override-ack-copy.ts`.

Verified symbols: `submitCheckIn` (889), `confirmComplete` (723, starts break via `startBreakAfterWorkComplete`), `buildRationale`, `showSuggestionCard`, `enableCheckInGate`, `endSession`, `isConfirming`.

## Findings

### F1 — End session path calls `confirmComplete`, which starts break

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — architectural stakes; End session would flash break start then interrupt via `endSession`, contradicting "skips break/suggestion"
- **Dimension**: End-State Alignment
- **Location**: Phase 3 — Hook state and transition gate; Critical Implementation Details — State sequencing
- **Detail**: Desired End State promises End session "skips break/suggestion." Research resolved open Q2 the same way. `confirmComplete` at `use-pomodoro-cycle.ts:755-757` always calls `startBreakAfterWorkComplete` for WORK cycles. Wiring End session through `confirmComplete` would start a break before `endSession` interrupts it.
- **Fix**: Add `completeWorkCycleOnly(markTaskDone)` (persist completion, no break); End session path uses that helper then `endSession()`. Keep going path continues via `confirmComplete` + `fetchSuggestion`.
- **Decision**: FIXED — applied to plan.md Phase 3 contract and State sequencing

### F2 — `CycleCompleteOverlay` not gated during `awaitingWindDown`

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; violates roadmap orchestrator rule (one interstitial + one gate)
- **Dimension**: Architectural Fitness
- **Location**: Phase 3 — Dashboard mount and suggestion guard
- **Detail**: After check-in closes, `awaitingCheckIn` is false but `state` remains `"completed"` until cycle completion runs. `CycleCompleteOverlay` renders when `!awaitingCheckIn` (`pomodoro-dashboard.tsx:172`). Wind-down gate would stack two overlays.
- **Fix**: Extend `CycleCompleteOverlay` guard with `!pomodoro.awaitingWindDown`.
- **Decision**: FIXED — applied to plan.md Phase 3 dashboard contract

### F3 — Wind-down resolve handlers lack submit loading state

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 3 — Hook contract; Phase 2 — `isSubmitting` wiring
- **Detail**: `submitCheckIn` sets `isConfirming` false in `finally` before early return at wind-down gate. Overlay maps `isSubmitting` → `isConfirming`, so buttons stay enabled during async Keep going / End session work — double-submit risk.
- **Fix**: Wrap `onWindDownKeepGoing` and `onWindDownEndSession` with `setIsConfirming(true/false)`.
- **Decision**: FIXED — applied to plan.md Phase 3 hook contract

### F4 — `ensureIdleCycle` unaware of wind-down overlay

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — blast radius on all e2e specs using shared idle reset
- **Dimension**: Blind Spots
- **Location**: Phase 4 — E2E helpers
- **Detail**: `e2e/helpers/idle-cycle.ts` dismisses check-in, mid-cycle, cycle-complete, running timer, and end-session — but not `wind-down-overlay`. Specs with `ensureIdleCycle` in `beforeEach` can hang after wind-down tests.
- **Fix**: Add wind-down dismissal (default Keep going) to `ensureIdleCycle` reset loop.
- **Decision**: FIXED — applied to plan.md Phase 4 as `idle-cycle.ts` change

### F5 — E2E covers fatigue trigger only, not interruption trigger

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — half of trigger logic (`interruptionCount >= 2`) unproven at browser layer
- **Dimension**: End-State Alignment
- **Location**: Phase 4 — E2E spec contract
- **Detail**: Trigger rule is `FADING && (completedWorkCycles >= 3 || interruptionCount >= 2)`. Spec lists fatigue path and negatives but no interruption-path proof. Manual testing step 4 mentions mid-cycle interruptions but no automated counterpart.
- **Fix**: Add e2e case: Fading on 1st cycle after mid-cycle switches yielding `interruptionCount >= 2`, assert interruptions rationale.
- **Decision**: FIXED — applied to plan.md Phase 4 spec contract

### F6 — Tone guard test for wind-down copy is optional

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — `wind-down-copy.ts`; Testing Strategy
- **Detail**: Phase 1 contract references `override-ack-copy.test.ts` guard pattern (no "should"/"mistake") but lists `wind-down-copy.test.ts` as optional. FR-022 / roadmap S-16 preachiness risk is real; a 2-case unit test is cheap insurance.
- **Fix**: Promote `wind-down-copy.test.ts` to Phase 1 required (or fold tone asserts into `wind-down-nudge.test.ts`).
- **Decision**: ACCEPTED — left optional; unit matrix + e2e copy assertions provide partial coverage; can add in implement if time permits

## Triage Summary (auto-applied)

```
═══════════════════════════════════════════════════════════
  AUTO-TRIAGE COMPLETE (decision proxy)
═══════════════════════════════════════════════════════════

  Fixed:     F1, F2, F3, F4, F5   (5)
  Accepted:  F6                   (1)

  ► Verdict after fixes: SOUND
═══════════════════════════════════════════════════════════
```

## Review confidence

**92/100** — Core insertion point, overlay patterns, and scoring helpers verified in worktree. End-session/break sequencing bug was the highest-risk gap; fixed in plan. Interruption e2e setup complexity (mid-cycle rebind) not dry-run in browser during review.
