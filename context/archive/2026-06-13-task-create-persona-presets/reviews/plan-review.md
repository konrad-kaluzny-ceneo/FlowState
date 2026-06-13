<!-- PLAN-REVIEW-REPORT -->

# Plan Review — task-create-persona-presets

**Reviewed:** 2026-06-13  
**Plan:** `context/changes/task-create-persona-presets/plan.md`  
**Brief:** `context/changes/task-create-persona-presets/plan-brief.md`  
**Verdict:** APPROVED

## Summary

Four-phase UI-only plan is feasible and matches research + S-29 scope. Preset bundles locked; create-only v1; no schema/tRPC changes. F-05 guest parity and L-04 component-test oracles are explicit. Coach follows S-11 onboarding storage pattern. No CRITICAL blockers after plan patches.

## Findings

| ID | Severity | Finding | Resolution |
|----|----------|---------|------------|
| F1 | WARNING | Phase 2 wires coach via `useOnboarding()` in TaskList but plan omits hook extensions (`shouldShowPresetCoach`, `markPresetCoachDismissed`) and `parseStoredState` whitelist for new field | **Fixed:** Phase 2 adds `use-onboarding-state.ts` helpers + explicit `parseStoredState` field |
| F2 | WARNING | `newEffortMinutes` is string state; preset helper must return string effort (e.g. `"60"`) not number | **Fixed:** Phase 1 contract on `applyPersonaPresetToCreateState` |
| F3 | WARNING | Coach stacking: preset row coach can overlap `FirstRunOverlay` on home — plan says "mirror defer" but no concrete gate | **Fixed:** hide preset coach when `isFirstRunVisible` from `useOnboarding()` |
| F4 | WARNING | `task-list.test.tsx` renders without `OnboardingProvider`; coach tests will throw without wrapper or mock | **Fixed:** Phase 3 notes wrap with `OnboardingProvider` or mock `useOnboarding` |
| F5 | INFO | `plan-brief` requires `features/task-create-persona-presets` before phase 1 code | **Fixed:** Phase 1 pre-step branch creation |

## Checklist

| Area | Verdict |
|------|---------|
| Scope vs roadmap S-29 | MATCH |
| F-05 field bundles coherent | MATCH |
| Guest create parity (no API change) | MATCH |
| Create-only v1 (edit unchanged) | MATCH |
| Progress section contract | MATCH |
| L-04 component test oracle | MATCH |
| P-203 stretch isolated phase 4 | MATCH |
| No belt e2e (F-05 precedent) | MATCH |

## Triage

All WARNING findings auto-applied to plan. Proceed to S7 Phase 1 via `/10x-implement`.
