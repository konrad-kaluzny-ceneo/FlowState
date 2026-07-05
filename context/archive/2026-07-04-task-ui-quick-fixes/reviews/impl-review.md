<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Task UI Quick Fixes

- **Plan**: context/changes/task-ui-quick-fixes/plan.md
- **Scope**: All 4 phases (complete)
- **Date**: 2026-07-04
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Unrelated change folders on feature branch

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: context/changes/status-vocabulary-unification/, context/changes/task-edit-interaction-fixes/
- **Detail**: Branch diff includes planning artifacts for two other changes not in the task-ui-quick-fixes plan. Implementation code matches plan; extras are docs-only and benign but widen branch scope before merge.
- **Fix**: Drop unrelated context folders from this branch before PR, or split into separate branches.
- **Decision**: ACCEPTED — intentional single PR bundling multiple change folders

### F2 — Orphaned deprecated coach constant

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/lib/onboarding/copy.ts:68
- **Detail**: `POST_MERGE_SUGGESTION_COACH_WITH_PRESET_LINE` remains after `getPresetCoachLine` / `PRESET_COACH_LINE` removal. No consumers in `src/`. Plan scoped removal to preset coach only; this sibling constant is harmless dead export.
- **Fix**: Delete `POST_MERGE_SUGGESTION_COACH_WITH_PRESET_LINE` in a follow-up or same PR cleanup pass.
- **Decision**: FIXED — removed orphaned constant from copy.ts

### F3 — Break-alerts permission hints (pre-existing gaps)

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/app/_components/out-of-tab-break-alerts-control.tsx:52-69
- **Detail**: Two a11y/UX gaps pre-date this slice and were not introduced by i18n: (1) permission hints do not refresh after "Try again" until unrelated re-render; (2) hints lack `aria-describedby` association with the toggle. i18n work correctly moved strings to `BreakAlerts` namespace.
- **Fix**: Defer to a dedicated break-alerts UX slice; wire permission state update on retry and `aria-describedby` on `StyledCheckbox`.
- **Decision**: FIXED — permission state refreshes on retry; hints linked via aria-describedby
