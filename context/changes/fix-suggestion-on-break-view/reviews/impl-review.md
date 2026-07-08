<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Single-Surface Next-Task Suggestion (Star Only)

- **Plan**: context/changes/fix-suggestion-on-break-view/plan.md
- **Scope**: Phases 1-4 of 5 (Phase 4 manual item 4.3 and Phase 5 docs not yet started)
- **Date**: 2026-07-08
- **Verdict**: NEEDS ATTENTION (minor) — both findings fixed during triage
- **Findings**: 0 critical, 2 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | WARNING |

## Findings

### F1 — Dead `SuggestionResult` / `PendingSuggestion` type exports

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/hooks/use-pomodoro-cycle.ts:191-210 (pre-fix)
- **Detail**: Phase 2 removed `pendingSuggestion` state and every consumer, but left the `SuggestionResult`/`PendingSuggestion` type exports behind. Zero references anywhere in `src/` or `e2e/` outside their own definitions. Phase 2's verification grep didn't include the type names, so it slipped through.
- **Fix**: Delete both type exports.
- **Decision**: FIXED — deleted lines 191-210; `pnpm typecheck` and `pnpm check` both clean afterward.

### F2 — Progress checkboxes missing commit-sha annotations

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: plan.md Phase 4 items 4.1/4.2
- **Detail**: Items 4.1/4.2 were checked `[x]` without the `— <commit sha>` suffix used by every other completed step in this plan. They landed in cbc40c6.
- **Fix**: Append ` — cbc40c6` to both items.
- **Decision**: FIXED.

### F3 — `resolveSuggestionCoachLine`'s persona-label param is now always `null`

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/app/_components/pomodoro-dashboard.tsx:203
- **Detail**: Plan explicitly flagged this as a risk to verify (not assume). Verified: the old `suggestionPersonaLabel` was derived from `pendingSuggestion` (break-panel state) and was always `null` by the time the star/kickoff path rendered. Hardcoding `null` is behaviorally identical for every real case; it just permanently closes off `getPostMergeSuggestionCoachLine`'s persona-badge branch from this call site (already unreachable in practice, untested either way).
- **Fix**: None needed.
- **Decision**: SKIPPED (no action needed).

## Verification performed

- `pnpm typecheck` — clean
- `pnpm check` (Biome) — clean, 478 files
- Targeted suite (use-pomodoro-cycle, pomodoro-dashboard, derive-gate, copy, transition-conductor, home-session-state, break-atmosphere, tab-return-catchup) — 226/226 pass
- Full suite (`pnpm test`) — 1227/1227 pass
- `rg "pendingSuggestion|acceptSuggestion|SUGGESTION_ACCEPT|suggestionCardOnBreak" src` — clean
- Three unplanned-file changes (wedge-sync-recovery.tsx, tasks/page.tsx, e2e/helpers/work-cycle.ts) confirmed as compile-forced fallout of Phase 2, correctly and minimally handled.
