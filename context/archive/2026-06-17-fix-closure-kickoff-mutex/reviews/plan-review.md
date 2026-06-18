<!-- PLAN-REVIEW-REPORT -->

# Plan Review: fix-closure-kickoff-mutex

**Date:** 2026-06-17  
**Reviewer:** Cursor Agent (`/10x-plan-review`)  
**Plan:** `context/changes/fix-closure-kickoff-mutex/plan.md`  
**Verdict:** APPROVED

## Summary

The B-05 hotfix plan is **substantively sound and ready to implement** after triaging two WARNING items. Code verification confirms every anchor in Current State Analysis: dashboard kickoff/check-in guards omit `pendingClosureLine`, the eligibility effect at `use-pomodoro-cycle.ts:1101–1109` sets readiness without a generation check, `clearKickoffSuggestion()` already bumps `kickoffFetchGenRef`, and belt `session-closure.spec.ts:45` pre-dismisses kickoff before end session. The four-phase characterization → mechanism → enforcement → belt commit order matches parent `refactor-opportunities` discipline and AGENTS.md wedge rules (B-05 before F-07).

**Code verification highlights:**

- T-01 dashboard gap: kickoff guard (`pomodoro-dashboard.tsx:371–375`) and check-in guard (`:397–399`) render without `!pendingClosureLine`; closure at `:390–395` is independent — both can mount (z=60 over z=58).
- Async race: eligibility effect calls `setAwaitingKickoffReadiness(true)` after `getOrCreateActive()` with no gen guard; `endSession` (`:2139–2140`) calls `clearKickoffSuggestion()` + `clearKickoffIdleFlags()` but cannot cancel in-flight callbacks.
- Gen pattern reuse is correct: capture `kickoffFetchGenRef.current` at async start **without** pre-increment (child plan supersedes parent wording "increment at effect start").
- Post-dismiss calm idle is achievable: `clearKickoffIdleFlags()` on `endSession` prevents immediate re-eligibility; gen guard prevents stale async reopen.
- Branch `features/fix-closure-kickoff-mutex` is checked out.
- `renderBody()` in dashboard tests defaults all gates to `false` — char tests must opt in explicitly.

## Findings

| ID | Severity | Category | Finding | Recommendation |
|----|----------|----------|---------|----------------|
| F1 | WARNING | Feasibility | Phase 4 removes `dismissKickoffReadinessIfVisible` at L45 without a replacement navigation strategy. After interrupt → idle, `kickoffEligible` can become true again (`sessionStartIdleFlag` persists through cycle start/interrupt), triggering kickoff **before** end session — a legitimate product path, not T-01. Full-screen kickoff overlay (z=60) may block `end-session-btn` click. | **Fixed** — Phase 4 drops interrupt step; end session while running (`endSession` auto-interrupts). Post-closure kickoff count remains T-01 oracle. |
| F2 | WARNING | Completeness | Phase 1 dashboard char tests reference `renderBody` / `makePomodoroMock` but `renderBody()` hardcodes `enableSuggestionGate: false` and `enableCheckInGate: false` (`pomodoro-dashboard.test.tsx:119–123`). Kickoff/check-in overlays will never render unless tests use the explicit `render()` pattern from the check-in test at `:142–158`. | **Fixed** — Phase 1.1 contract requires explicit `render()` with gate props; warns against default `renderBody()`. |
| F3 | OBSERVATION | Alignment | Parent `refactor-opportunities/plan.md:59` says "increment at effect start"; child plan correctly specifies capture-without-increment in Critical Implementation Details. Child semantics match `fetchKickoffSuggestion` invalidation via `clearKickoffSuggestion` on `endSession`. | No change required — child plan is authoritative; optional one-line note in Phase 2 that pre-increment is **not** used here. |
| F4 | OBSERVATION | Test strategy | Hook race char test references L-04 blocked-mutate pattern at `:2389+`, but those tests defer `suggestionNextMutate`, not `getOrCreateSession`. No deferred `getOrCreateActive` test exists yet. | **Clarify Phase 1.2:** block `getOrCreateSession` with a deferred promise (same vitest pattern, different mock target). Feasible — mock is already `vi.fn()` at test line 10. |
| F5 | OBSERVATION | Contract | Plan includes gen guard on eligibility effect error path (`setPendingKickoffSuggestion({ status: "error" })`) — verified needed; current `:1106–1108` has no gen check and could surface stale error after `endSession`. | Already in plan — ensure implementer does not skip error path when landing Phase 2. |

## Checklist

- [x] Desired end state matches `change.md` / `plan-brief.md` (calm closure, no kickoff/check-in on same visit)
- [x] Scope boundaries clear (F-07, B-06, wind-down stacking, guest mode excluded)
- [x] Two-layer fix (hook gen guard + dashboard mutex) verified necessary in code
- [x] Line references and file paths accurate against current branch
- [x] Characterization-first commit order matches parent discipline
- [x] Mechanism/enforcement split (Phases 2–3) explicit with expected red/green states
- [x] Progress section valid (canonical `## Progress` at bottom)
- [x] F1–F2 triaged and fixed in `plan.md`

## Decision

**Proceed to `/10x-implement fix-closure-kickoff-mutex phase 1`.**
