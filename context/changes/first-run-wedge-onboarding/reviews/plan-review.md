<!-- PLAN-REVIEW-REPORT -->
# Plan Review: First-Run Wedge Onboarding (S-11)

- **Plan**: context/changes/first-run-wedge-onboarding/plan.md
- **Mode**: Deep
- **Date**: 2026-06-07
- **Verdict**: SOUND
- **Implementation verdict**: APPROVED
- **Confidence**: 93/100
- **Findings**: 1 critical (fixed) · 3 warnings (fixed) · 1 observation (fixed)
- **Auto-triage fixes applied**: 5

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | PASS |

## Grounding

Grounding: 10/10 paths ✓, 6/6 symbols ✓, brief↔plan ✓

Verified paths: `home-shell.tsx`, `task-list.tsx`, `check-in-overlay.tsx`, `task-suggestion-card.tsx`, `pomodoro-dashboard.tsx`, `page.tsx`, `duration-storage.ts`, `e2e/helpers/idle-cycle.ts`, `check-in.ts`, `suggestion.ts`.

Verified symbols: `auth.getSession`, `useDataMode`, `enableCheckInGate`, `enableSuggestionGate`, empty placeholder at `task-list.tsx:270-271`, add input placeholder `"Add a new task..."`.

## Findings

### F1 — Phase 5 Progress missing storage.test.ts step

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 5 — Success Criteria / Progress
- **Detail**: Phase 5 Automated Verification listed `pnpm exec vitest run src/lib/onboarding/storage.test.ts` but Progress had no matching `5.x` item — `/10x-implement` would fail Progress parsing contract.
- **Fix**: Remove redundant storage vitest from Phase 5 (already covered by Phase 1.3).
- **Decision**: FIXED

### F2 — Duplicate `useOnboardingState` would desync coach flags

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Architectural Fitness
- **Location**: Phase 2 + Phase 4 — hook wiring
- **Detail**: Plan placed independent hook instances in `HomeShell` and `AuthenticatedPomodoroDashboard`. Separate React state would not reflect dismiss/mark mutations across the tree until remount.
- **Fix**: Single `OnboardingProvider` at `HomeShell`; Phase 4 consumes `useOnboarding()` from context only. Removed unnecessary `userId` prop chain through `PomodoroDashboard`.
- **Decision**: FIXED

### F3 — `page.tsx` userId not hoistable from current scope

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 — Server userId pass-through
- **Detail**: `user` is declared inside `try`; JSX cannot pass `user?.id` without hoisting to function scope.
- **Fix**: Explicit contract to declare `user` before `try` and assign inside it.
- **Decision**: FIXED

### F4 — Cycle-complete defer documented but not phased

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: End-State Alignment
- **Location**: Critical Implementation Details vs Phase 2
- **Detail**: Plan deferred first-run while `pomodoro.state === "completed"`, but `HomeShell` has no pomodoro access. Reload with expired active cycle would stack first-run (z-55) over cycle-complete (z-50), blocking recovery UX.
- **Fix**: Add `useTestIdVisible("cycle-complete-overlay")` helper; `FirstRunOverlay` visibility requires `!cycleCompleteVisible`. Documented in Critical Details + Phase 1/2 contracts.
- **Decision**: FIXED

### F5 — E2E blast radius incomplete

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 5 — helper extensions
- **Detail**: `ensureIdleCycle` extension covers 6 specs, but `smoke.spec.ts`, `guest-trial.spec.ts`, and two guest-merge specs hit `/` without idle reset and would fail on first-run overlay.
- **Fix**: Phase 5 item 2b — clear/dismiss onboarding in those specs' setup; document `mid-cycle-last-task.spec.ts` covered via `ensureIdleCycle`.
- **Decision**: FIXED

### F6 — Phase 4 ambiguous context vs prop chain

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Lean Execution
- **Location**: Phase 4 — Dashboard coach wiring
- **Detail**: "OR read from context provider" left implementer choice open while Phase 2 did not define provider.
- **Fix**: Resolved by F2 — context-only path mandated.
- **Decision**: FIXED

## Triage Summary

```
═══════════════════════════════════════════════════════════
  AUTO-TRIAGE COMPLETE
═══════════════════════════════════════════════════════════

  Fixed:     F1, F2, F3, F4, F5, F6   (5 plan edits)

  ► Verdict after fixes: SOUND → APPROVED
  ► Confidence: 93/100
═══════════════════════════════════════════════════════════
```

## Notes

- No `docs/reference/contract-surfaces.md` in repo — contract-surfaces check skipped.
- `lessons.md` priors (Linear sync) not applicable to this UI slice.
- Research confidence was 89/100; plan fixes raise implementability to 93/100. Remaining 7%: copy tone tuning (S-12) and S-14 merge-success wiring (stub only).
