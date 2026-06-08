<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Background Tab Return Catch-up (S-22)

- **Plan**: `context/changes/background-tab-return-catchup/plan.md`
- **Mode**: Deep
- **Date**: 2026-06-08
- **Verdict**: SOUND
- **Findings**: 1 critical (fixed) · 2 warnings (fixed) · 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | PASS |

## Grounding

Grounding: 5/5 paths ✓, 3/3 symbols ✓, brief↔plan ✓

Verified paths: `src/hooks/use-pomodoro-cycle.ts`, `src/app/_components/pomodoro-dashboard.tsx`, `src/hooks/use-pomodoro-cycle.test.tsx`, `e2e/helpers/work-cycle.ts`, `e2e/pomodoro-cycle.spec.ts`. Symbols: `handleCycleExpired`, `resumeFromActiveCycle`, `visibilitychange` listener, `onCycleCompleteConfirm`, `submitCheckIn`, `acceptSuggestion`. Testids `cycle-complete-overlay` and `check-in-overlay` confirmed in overlay components.

## Findings

### F1 — Visibility-recalc expiry path would skip catch-up

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — architectural stakes; primary user story depends on fallback path
- **Dimension**: End-State Alignment
- **Location**: Critical Implementation Details — Catch-up set timing; Phase 2 hook contract
- **Detail**: Plan documents that `visibilitychange` → `recalculateFromEndTime` can trigger `handleCycleExpired` when the fallback timer was throttled while hidden (the primary E2E-forced path via `NEXT_PUBLIC_E2E_MAIN_THREAD_TIMER=1`). Original contract only set `catchUp` when `document.visibilityState !== "visible"` at expiry time — but recalc runs only on become-visible, so expiry would fire with `visibilityState === "visible"` and catch-up would never appear. Contradicts Desired End State #1 (“background tab before cycle ends; on return, banner shows”).
- **Fix**: Add `tabWasHiddenWhileRunningRef` set on hidden `visibilitychange` while running; trigger `setCatchUpOnHiddenExpiry` when ref is true OR tab still hidden; use `cycleEndedAtMs = endTimeRef.current ?? Date.now()`; add visibility-recalc hook test (hidden → advance past endTime → visible → recalc → catchUp set).
- **Decision**: FIXED — applied to plan Critical Implementation Details, Phase 2 contract, and Phase 5 e2e authority note

### F2 — `cycleEndedAtMs` would show “just now” after delayed recalc

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; affects S-22 “how long ago” outcome
- **Dimension**: End-State Alignment
- **Location**: Critical Implementation Details — Catch-up set timing; Phase 2 hook contract
- **Detail**: Using `Date.now()` at recalc-fired expiry misstates elapsed time when the user returns minutes after the true `endTime`. Research §5 specifies client wall-clock end for relative time.
- **Fix**: Set `cycleEndedAtMs` from `endTimeRef.current` (or `endTime` in `resumeFromActiveCycle`); assert in visibility-recalc hook test.
- **Decision**: FIXED — bundled with F1 in `setCatchUpOnHiddenExpiry` helper

### F3 — E2E visibility helper assigns read-only property

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 5 — `e2e/helpers/visibility.ts` contract
- **Detail**: `document.visibilityState` is read-only in browsers; direct assignment via `page.evaluate` fails. Hook tests already use `Object.defineProperty` (see `use-pomodoro-cycle.test.tsx:657-660`).
- **Fix**: Specify `Object.defineProperty` mock pattern in visibility helper contract; document hook tests as authority for visibility-recalc path.
- **Decision**: FIXED — applied to Phase 5 visibility helper contract

## Triage Summary

| ID | Severity | Decision |
|----|----------|----------|
| F1 | CRITICAL | FIXED |
| F2 | WARNING | FIXED |
| F3 | WARNING | FIXED |

**Verdict after fixes:** SOUND — safe to implement.

## Review Confidence

**HIGH** — Grounded against `use-pomodoro-cycle.ts:269-390` (recalc + visibility listener), `playwright.config.ts` (fallback timer forced in e2e), and existing hook test patterns. No contract-surfaces.md in project (check skipped). Progress section mechanically consistent with five phases.
