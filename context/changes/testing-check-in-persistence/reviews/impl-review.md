<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Risk #7 Check-In Persistence

- **Plan**: context/changes/testing-check-in-persistence/plan.md
- **Scope**: Phases 1–2 of 2
- **Date**: 2026-06-05
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — change.md status committed in Phase 1

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: context/changes/testing-check-in-persistence/change.md
- **Detail**: Plan Phase 2 specifies advancing change.md to `implemented` on ship. Content is correct (`status: implemented`, `updated: 2026-06-05`), but it landed in commit 3fbd851 (Phase 1) rather than 82b5aa5 (Phase 2). Process-only drift; no functional gap.
- **Fix**: No action required — content matches intent.
- **Decision**: SKIPPED — no action required; content correct

### F2 — Overlapping create→list energy tests

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/server/api/routers/check-in.test.ts:153-168
- **Detail**: `create persists energy readable via list` (STEADY) and the `it.each` FOCUSED/STEADY/FADING round-trip block both assert the same create→list contract. Redundant but harmless; `it.each` adds enum exhaustiveness.
- **Fix A ⭐ Recommended**: Keep both for readability.
- **Fix B**: Drop the single-energy case and rely on `it.each`.
- **Decision**: FIXED via Fix A — kept both tests; no edit required

### F3 — Ordering test asserts cycleId, not respondedAt

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/server/api/routers/check-in.test.ts:170-183
- **Detail**: `list returns newest check-in first` checks `list[0].cycleId === 2` rather than comparing `respondedAt` timestamps. Safe today because the mock assigns distinct timestamps per create; would still fail if sort were wrong.
- **Fix**: Add `expect(list[0]!.respondedAt.getTime()).toBeGreaterThan(list[1]!.respondedAt.getTime())` to pin the sort key.
- **Decision**: FIXED — added respondedAt comparison

### F4 — Minor pattern nits vs peer tests

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/server/api/routers/check-in.test.ts:86-88, 116-122
- **Detail**: Missing `vi.clearAllMocks()` in `beforeEach` (present in session.test.ts) and missing setTimeout stub comment (present in check-in-isolation.test.ts). Neither affects correctness today.
- **Fix**: Add comment + `vi.clearAllMocks()` for consistency with peers.
- **Decision**: FIXED — added setTimeout comment and vi.clearAllMocks()
