<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Phase 2 Test Rollout — Active-Slice Browser Proofs

- **Plan**: context/changes/testing-active-slice-browser-proofs/plan.md
- **Scope**: All phases (1–4)
- **Date**: 2026-06-06
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 2 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — `check-in-gate.spec.ts` not shipped

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Plan Adherence
- **Location**: e2e/check-in-gate.spec.ts (missing)
- **Detail**: Phase 4 explicitly requires a dedicated Risk #7 spec with UI gate-blocking assertions and a `checkIn.create` persistence oracle. The file does not exist in the repo. Coverage is partial via `e2e/pomodoro-cycle.spec.ts` + `completeCheckIn` helper. Deferral is documented in `context/foundation/test-plan.md` §6.6 (batched tRPC oracle issues), but `plan.md` Progress marks Phase 4 complete without noting the deferral in the plan itself.
- **Fix A ⭐ Recommended**: Add a plan addendum under Phase 4 documenting the deferral (mirror §6.6 rationale) and open a follow-up issue for `check-in-gate.spec.ts` when batch-mutation oracles are supported.
  - Strength: Aligns plan source-of-truth with shipped reality and test-plan cookbook.
  - Tradeoff: Plan becomes a moving target; stakeholders who read plan only miss the deferral.
  - Confidence: HIGH — deferral rationale already written in test-plan.
  - Blind spot: Whether partial S-01 coverage is sufficient for Risk #7 sign-off.
- **Fix B**: Implement `check-in-gate.spec.ts` now with UI-only assertions (skip network oracle).
  - Strength: Closes the largest plan gap immediately.
  - Tradeoff: May still fail on batched tRPC persistence oracle; half-measure vs plan contract.
  - Confidence: MEDIUM — UI path is straightforward; network oracle was the blocker.
  - Blind spot: Batch stream response parsing not re-tested in this review.
- **Decision**: FIXED via Fix A — plan addendum added; follow-up queued in `follow-ups/review-fixes.md`

### F2 — Mid-cycle end-break bypasses check-in gate

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/hooks/use-pomodoro-cycle.ts:664-692
- **Detail**: `onMidCycleEndCycleAndBreak` calls `cycles.complete` then `startBreakAfterWorkComplete` directly, skipping `awaitingCheckIn` / `submitCheckIn`. The Desired End State requires every completed WORK cycle to pass the energy gate before break starts (Risk #7 / FR-020). Timer-expiry path correctly gates via `onCycleCompleteConfirm`; mid-cycle "End cycle and break" does not. E2e `mid-cycle-completion.spec.ts` codifies the bypass (expects "Short Break" immediately).
- **Fix A ⭐ Recommended**: Route mid-cycle end-break through the same `awaitingCheckIn` → `submitCheckIn` → `confirmComplete` chain used by timer-expiry WORK completion.
  - Strength: Unifies FR-020 coverage; one code path for all WORK→break transitions.
  - Tradeoff: UX adds a step to mid-cycle end-break; e2e mid-cycle specs need check-in helper calls.
  - Confidence: HIGH — hook already has the gate machinery.
  - Blind spot: Product intent — mid-cycle early end may have been deliberately exempt.
- **Fix B**: Document mid-cycle end-break as an explicit FR-020 exemption in PRD/test-plan and accept the gap.
  - Strength: No code churn; preserves current faster UX.
  - Tradeoff: Risk #7 "every completed WORK cycle" claim becomes inaccurate.
  - Confidence: MEDIUM — depends on product sign-off.
  - Blind spot: Server-side hardening still absent (deferred per plan).
- **Decision**: FIXED via Fix A — mid-cycle end-break routes through check-in gate for authenticated WORK cycles

### F3 — S-01 e2e lacks gate-blocking assertion

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: e2e/pomodoro-cycle.spec.ts:32-33
- **Detail**: After clicking "Continue later", specs call `completeCheckIn` immediately but never assert break UI (`timer-panel-running` / "Short Break") is absent before energy selection — the core Risk #7 oracle from Desired End State.
- **Fix**: Before `completeCheckIn`, add `expect(page.getByText("Short Break")).toBeHidden()` (or equivalent break-panel assertion) in both pomodoro-cycle tests.
- **Decision**: FIXED — gate-blocking assertion added to pomodoro-cycle.spec.ts

### F4 — Collateral test-infra changes outside plan

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: commit 83dc136 — src/test-utils/*, src/lib/auth/server.ts, src/server/api/trpc.ts, isolation test files
- **Detail**: Commit `83dc136` refactored test utilities and touched many router isolation tests not listed in any plan phase. Changes appear benign (array-access helpers, auth session typing) but expand review surface beyond the change scope.
- **Fix**: No action required if refactor was prerequisite for new tests; optionally note in plan epilogue.
- **Decision**: FIXED — noted in plan addendum

### F5 — CheckInOverlay omits `cycleId` prop

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/app/_components/check-in-overlay.tsx:33-36
- **Detail**: Plan specified `cycleId` prop on `CheckInOverlay`; implementation relies on hook-held `activeCycle.id` instead. Functionally equivalent.
- **Fix**: No action required unless testids need cycle-scoped DOM attributes.
- **Decision**: FIXED — cycleId prop added to CheckInOverlay
