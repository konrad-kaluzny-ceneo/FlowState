<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Task Attributes for Scoring

- **Plan**: context/changes/task-attributes-for-scoring/plan.md
- **Scope**: Phase 1–4 of 4
- **Date**: 2026-05-31
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 2 observations

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

### F1 — onBlur save races with SegmentedControl clicks

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/app/_components/task-list.tsx:269
- **Detail**: The edit-mode title input's onBlur triggers saveEdit before SegmentedControl onClick fires, causing saves with stale attribute values when clicking controls while title input is focused.
- **Fix A ⭐ Recommended**: Add onMouseDown + preventDefault to SegmentedControl buttons to prevent blur
  - Strength: Standard React pattern; keeps save-on-blur UX for actual focus loss.
  - Tradeoff: Adds an onMouseDown handler to SegmentedControl buttons.
  - Confidence: HIGH — well-established pattern in React form UIs.
  - Blind spot: None significant.
- **Fix B**: Remove onBlur save, rely on Enter/explicit save button
  - Strength: Eliminates the race entirely.
  - Tradeoff: Loses click-away-to-save convenience.
  - Confidence: MEDIUM — changes existing UX behavior.
  - Blind spot: Users accustomed to blur-to-save may lose edits.
- **Decision**: FIXED via Fix A

### F2 — Guest update does not validate weight bounds

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/repositories/guest-repositories.ts:107
- **Detail**: Guest update path directly spreads input.weight without bounds checking (tRPC validates 1-3 server-side but guest path has no guard).
- **Fix**: Add Math.min(3, Math.max(1, input.weight)) clamp in guest update.
- **Decision**: FIXED

### F3 — DomainTask.workType/weight optional despite always-present data

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: src/lib/data-mode/types.ts:10-11
- **Detail**: Fields typed as optional but both data sources always provide values, forcing redundant ?? fallbacks in every consumer.
- **Fix**: Make fields required in DomainTask; remove TASK_DEFAULTS fallbacks from task-list.tsx.
- **Decision**: FIXED
