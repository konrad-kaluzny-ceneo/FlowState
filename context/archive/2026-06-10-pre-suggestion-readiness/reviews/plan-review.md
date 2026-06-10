<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Pre-suggestion Readiness Gate (S-25)

- **Plan**: `context/changes/pre-suggestion-readiness/plan.md`
- **Mode**: Deep
- **Date**: 2026-06-10
- **Verdict**: APPROVED (after fixes)
- **Findings**: 2 critical (fixed) · 5 warnings (fixed) · 1 observation (accepted)

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING → PASS (after fixes) |
| Plan Completeness | FAIL → PASS (after fixes) |

## Grounding

Grounding: 10/10 paths ✓, 8/8 symbols ✓, brief↔plan ✓

Verified paths: `suggestion.ts`, `suggestion.test.ts`, `use-pomodoro-cycle.ts`, `use-pomodoro-cycle.test.tsx`, `check-in-overlay.tsx`, `pomodoro-dashboard.tsx`, `e2e/helpers/kickoff.ts`, `e2e/helpers/check-in.ts`, `e2e/session-kickoff.spec.ts`, `check-in.ts`.

Verified symbols: STEADY hardcode (`suggestion.ts:229`), `kickoffEligible` effect (`use-pomodoro-cycle.ts:865-893`), `fetchKickoffSuggestion` (`use-pomodoro-cycle.ts:827`), `suggestionNextKickoff` hook (`use-pomodoro-cycle.ts:253`), `CheckInEnergy` enum (`check-in.ts:20`), `continueAfterCheckIn` + `clearKickoffIdleFlags` (`use-pomodoro-cycle.ts:1518-1552`), `showKickoffCard` gate (`pomodoro-dashboard.tsx:93-98`), kickoff test call sites (`suggestion.test.ts` ×8).

## Triage Summary

| ID | Severity | Decision |
|----|----------|----------|
| F1 | CRITICAL | FIXED — Phase 1 router tests must update all 8 kickoff call sites |
| F2 | CRITICAL | FIXED — Phase 3 must migrate existing kickoff hook describe block |
| F3 | WARNING | FIXED — Phase 2 dashboard adds `isPostCheckInTransitioning` guard |
| F4 | WARNING | FIXED — Phase 2 hook extends `kickoffEligible` + re-entry guards |
| F5 | WARNING | FIXED — EnergySelector owns type exports |
| F6 | WARNING | FIXED — `waitForKickoffSuggestion` option renamed to `readinessCompleted` |
| F7 | WARNING | FIXED — `getOrCreateActive` failure contract before readiness opens |
| O1 | OBSERVATION | ACCEPTED — roadmap outcome wording broader than scoped implementation |

## Findings

### F1 — Router test contract scoped to one call site

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — fix is obvious; missing it breaks Phase 1 gate
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — router unit tests
- **Detail**: Contract referenced only kickoff test ~line 570, but `suggestion.test.ts` has **8** `context: "kickoff"` call sites. Required `energy` schema change would fail the other seven tests with no plan step to update them.
- **Fix**: Broaden Phase 1 contract to update all kickoff `next()` call sites and list representative line numbers.
- **Decision**: FIXED

### F2 — Existing hook kickoff tests assume eager fetch

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — Phase 2 lands red tests with no owned migration step
- **Dimension**: Blind Spots
- **Location**: Phase 3 — hook unit tests
- **Detail**: `describe("kickoff suggestion eligibility")` (~line 1869) expects `pendingKickoffSuggestion.status === "ready"` immediately on eligibility. Phase 2 defers fetch behind readiness; plan only added new tests without migrating the existing describe block.
- **Fix**: Add explicit contract to update existing kickoff eligibility tests to drive readiness before asserting fetch.
- **Decision**: FIXED

### F3 — Dashboard mount missing post-check-in transition guard

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — B-04 coordination risk; readiness flash during check-in transition
- **Dimension**: End-State Alignment
- **Location**: Phase 2 — dashboard mount vs Critical Implementation Details
- **Detail**: Critical Implementation Details forbids readiness when `isPostCheckInTransitioning`, but Phase 2 dashboard contract omitted it (check-in/wind-down only). `pomodoro-dashboard.tsx` already uses this guard for `CycleCompleteOverlay`.
- **Fix**: Add `!pomodoro.isPostCheckInTransitioning` to Phase 2 mount contract.
- **Decision**: FIXED

### F4 — kickoffEligible missing transition and re-entry guards

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — double prompt or duplicate session touch on edge transitions
- **Dimension**: Architectural Fitness
- **Location**: Phase 2 — hook gate
- **Detail**: Roadmap Q2 risk requires readiness only when no check-in gate is active. Plan did not extend `kickoffEligible` with `!isPostCheckInTransitioning` or guard against re-opening readiness when already awaiting or fetch in flight.
- **Fix**: Extend Phase 2 hook contract with eligibility exclusion, re-entry skip, and session-fetch failure handling.
- **Decision**: FIXED

### F5 — Energy type ownership after extraction

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — import ambiguity between overlay, selector, and e2e helpers
- **Dimension**: Plan Completeness
- **Location**: Phase 2 — EnergySelector extraction
- **Detail**: `CheckInEnergy` / `CheckInEnergyUi` live in `check-in-overlay.tsx` today; extraction plan did not specify where types move or how `e2e/helpers/check-in.ts` stays stable.
- **Fix**: Move types to `energy-selector.tsx`; re-export from `check-in-overlay.tsx`.
- **Decision**: FIXED

### F6 — waitForKickoffSuggestion option naming

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — inverted semantics (`skipReadiness` vs default skip-energy)
- **Dimension**: Plan Completeness
- **Location**: Phase 4 — helper update
- **Detail**: `{ skipReadiness?: boolean }` defaulting to completing readiness is ambiguous — true could mean skip the gate or skip Steady energy.
- **Fix**: Rename to `{ readinessCompleted?: boolean }` with documented default behavior.
- **Decision**: FIXED

### F7 — Session materialization failure before readiness

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — silent no-op if getOrCreateActive fails in eligibility effect
- **Dimension**: Blind Spots
- **Location**: Phase 2 — kickoffEligible effect
- **Detail**: Today, effect failure sets `pendingKickoffSuggestion({ status: "error" })`. Deferred-fetch design could leave user with neither overlay nor error if failure path not specified.
- **Fix**: Contract: on `getOrCreateActive` failure, set kickoff error state without opening readiness.
- **Decision**: FIXED

### O1 — Roadmap outcome wording vs scoped plan

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔬 HIGH — stakeholder expectation management only
- **Dimension**: End-State Alignment
- **Location**: Roadmap S-25 outcome vs plan Overview
- **Detail**: Roadmap says "before post-check-in next-task suggestion"; plan correctly narrows post-check-in to S-05 check-in (verify-only, 92% research confidence). Scope is intentional and documented in Overview, brief, and "What We're NOT Doing".
- **Decision**: ACCEPTED

## Confidence

**91%** — Plan is well-grounded in shipped S-05/S-06/S-15 code; API-first sequencing and L-04 oracles match lessons. Highest residual risk: migrating eight router tests + kickoff hook describe block without flake on 200ms timing oracle. No open CRITICAL findings after auto-triage.
