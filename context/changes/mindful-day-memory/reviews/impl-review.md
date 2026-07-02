<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Mindful day memory (S-42)

- **Plan**: context/changes/mindful-day-memory/plan.md
- **Scope**: Phase 1-3 of 3 (full plan)
- **Date**: 2026-07-02
- **Verdict**: REJECTED (at time of review; F1 fixed during triage — see decisions)
- **Findings**: 1 critical, 1 warning, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | FAIL (pre-fix) — resolved by F1 fix |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — Collapsed line reads as broken text when there's nothing to return to

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: src/lib/recap/format-day-memory.ts:79, messages/en.json:335, messages/pl.json:335
- **Detail**: When `continueTaskId` resolves to no return-to task (a common state — e.g. first task of the day completed, no session has ended yet) but `done`/`remains` still have content, `formatDayMemory` fell back to using the section label itself as the "next" value (`next: returnTo?.taskTitle ?? returnToLabel`). This produced literally broken, self-referential text: EN "Done: 1 task. Remains: 0 open. Return calmly to: Return to." / PL "Zrobione: 1 zadanie. Zostało: 0 otwarte. Wróć spokojnie do: Wróć tutaj." It was locked in by an explicit test (`format-day-memory.test.ts:284-307`) asserting this exact broken string as correct. Directly contradicts the feature's stated purpose (calm narrative prose, not garbled text).
- **Fix A ⭐ Recommended**: Add a second message key `DayMemory.collapsedLineNoReturn` ("Done: {done}. Remains: {remaining}." / PL "Zrobione: {done}. Zostało: {remaining}.") and branch in the formatter when `returnTo == null`, matching the codebase's existing with/without-target precedent (`CycleComplete.breakContinueWithTask` vs. `breakContinue`).
  - Strength: Direct precedent in the same message files; produces grammatically correct calm prose.
  - Tradeoff: Two new message keys × 2 locales.
  - Confidence: HIGH.
  - Blind spot: None significant (confirmed sole caller of `buildDayMemoryCollapsedLine`).
- **Fix B**: ICU `select` inside the single `collapsedLine` key.
  - Strength: Single key.
  - Tradeoff: No existing `select`-based precedent in this codebase.
  - Confidence: MEDIUM.
- **Decision**: FIXED via Fix A. Added `DayMemory.collapsedLineNoReturn` message key (EN + PL) and `buildDayMemoryCollapsedLineNoReturn` accessor in `narrative-copy.ts`; `format-day-memory.ts` now branches on `returnTo != null`. Updated `format-day-memory.test.ts` to assert the correct omitted-clause text (EN + new PL case) instead of the broken fallback string. Verified: `pnpm typecheck`, `pnpm check`, and full `pnpm test` (138 files / 1111 tests) all pass.

### F2 — DayMemoryLine doesn't reuse the SectionToggle disclosure pattern

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/app/_components/day-memory-line.tsx:46-63
- **Detail**: Sibling `DailyRecapPanel` uses a reusable `SectionToggle` component for per-section disclosure. `DayMemoryLine` hand-rolls its own single top-level toggle instead — a legitimate UX difference (one collapsed line vs. per-section toggles), not a bug.
- **Fix**: Not required — divergence is a valid design choice.
- **Decision**: SKIPPED.

### F3 — formatDayMemory recomputed on every render without memoization

- **Severity**: ⚪ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/app/_components/day-memory-line.tsx:33
- **Detail**: Runs on every render, including unrelated dashboard re-renders. Low risk given bounded per-day array sizes; component hidden during the highest-frequency re-render state (active work). Sibling `DailyRecapPanel` does the same.
- **Fix**: Optional — `useMemo` if profiling later shows it matters.
- **Decision**: SKIPPED.
