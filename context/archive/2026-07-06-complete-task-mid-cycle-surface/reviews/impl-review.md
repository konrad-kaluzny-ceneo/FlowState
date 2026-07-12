<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: One Session = One Task — Mandatory Break on Focused-Task Completion

- **Plan**: context/changes/complete-task-mid-cycle-surface/plan.md
- **Scope**: Phases 1–5 of 5 (full plan)
- **Date**: 2026-07-10
- **Verdict**: APPROVED
- **Findings**: 0 critical · 2 warnings · 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Dead-code divergent cadence algorithm

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/hooks/use-pomodoro-cycle.ts:2183
- **Detail**: startBreakAfterWorkComplete's fallback (when overrideBreakKind is not passed) used `newCount % 4 === 0` — a divergent algorithm from the cyclesSinceLastLong-based logic used everywhere else. Currently dead code because onChooseBreak always passes breakKind, but could silently diverge.
- **Fix**: Replaced `% 4` fallback with `cyclesSinceLastLong + 1 >= 4` to match canonical cadence logic.
- **Decision**: FIXED

### F2 — Guest-path error recovery drops cycle state

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/hooks/use-pomodoro-cycle.ts:~2710–2760
- **Detail**: In onCompleteFocusedTask's guest path, if cycles.complete() fails, the catch block resets to idle (clears activeCycle, cycleKind). The user loses their running cycle with no retry path. The authenticated path preserves state via pendingWedgeRecovery for retry — guest path does not.
- **Fix B**: Accepted state loss with error banner (already implemented). Added comment documenting the intentional guest-mode tradeoff.
  - Strength: Simple; guest mode is inherently lossy.
  - Tradeoff: User loses partial focus time on an edge case.
  - Confidence: MED — acceptable for guest tier.
- **Decision**: FIXED (Fix B — accept state loss, document tradeoff)

### F3 — Optimistic counter increment before async

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/hooks/use-pomodoro-cycle.ts:~2172
- **Detail**: In startBreakAfterWorkComplete, setCompletedWorkCycles and setCyclesSinceLastLong are called before cycles.create(). If cycles.create throws (caught in onChooseBreak), the gate re-opens but counters are already incremented — retry suggestion off by one.
- **Fix**: Added counter rollback in onChooseBreak's catch block (decrement completedWorkCycles, restore cyclesSinceLastLong).
- **Decision**: FIXED

### F4 — E2E helper timeout borderline

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: e2e/helpers/break-choice.ts:18–30
- **Detail**: The chooseBreakKind helper used 15s/10s/10s timeouts. When chained with completeWorkCycleWithCheckIn, total flow could approach L-06's 15s threshold.
- **Fix**: Reduced timeouts to 10s/5s/5s — still generous for CI but avoids pushing chained flows past 15s.
- **Decision**: FIXED

### F5 — Fire-async-then-navigate pattern undocumented

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/app/tasks/page.tsx:57–58
- **Detail**: onMidCycleMarkComplete calls the async focused-completion handler then immediately router.push("/focus"). The async work persists in the shared context provider but could confuse future developers.
- **Fix**: Added comments at both redirect sites documenting that async work persists in the context provider across route changes.
- **Decision**: FIXED
