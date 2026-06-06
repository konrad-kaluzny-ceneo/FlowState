<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Phase 1 Test Rollout — Critical-Path Persistence & Timer

- **Plan**: context/changes/testing-critical-path-persistence-timer/plan.md
- **Mode**: Deep
- **Date**: 2026-06-04
- **Verdict**: REVISE → SOUND (after triage fixes applied)
- **Findings**: 0 critical, 5 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | WARNING |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Grounding: 8/8 existing paths ✓, 2 planned-new (countdown helper, e2e helper) ✓, 6/6 symbols ✓, brief↔plan ✓

## Findings

### F1 — Guest hook test needs explicit mock strategy

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — item 6
- **Detail**: Plan said seed localStorage only; hook tests hardcode authenticated mock — seeding never reaches recovery path.
- **Fix**: Require guest `vi.mock` + `createGuestRepositories()` before localStorage seed.
- **Decision**: FIXED (Fix in plan)

### F2 — Countdown oracle must account for display ceil

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1 — item 1
- **Detail**: `formatRemainingMs` uses ceil; mm:ss can read ~1s ahead of wall `remainingMs`.
- **Fix A ⭐ Recommended**: Hook uses `remainingMs`; e2e oracle ceil-aware or ≥3s tolerance.
- **Decision**: FIXED (Fix A)

### F3 — Auth reload e2e needs post-reload getActive wait

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 — item 1
- **Detail**: `beforeEach` getActive wait swallows errors; reload needs explicit re-wait.
- **Fix**: Add post-reload `waitForResponse` for `cycle.getActive`.
- **Decision**: FIXED (Fix in plan)

### F4 — Playwright clock across auth reload unverified

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 2 — item 1
- **Detail**: Fake clock may not survive `reload`; guest precedent does not advance clock first.
- **Fix A ⭐ Recommended**: Fallback assertion strategy if clock offset lost after reload.
- **Decision**: FIXED (Fix A)

### F5 — Visibility tests should assert remainingMs

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — item 5
- **Detail**: Recalc only updates `remainingMs`; mm:ss parsing adds ceil noise.
- **Fix**: Assert `result.current.remainingMs` ±2000ms on fallback path.
- **Decision**: FIXED (Fix in plan)

### F6 — Integration: extend create→getActive, not duplicate

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Lean Execution
- **Location**: Phase 1 — item 3
- **Detail**: Seeded `getActive` test exists; new signal is create→getActive full fields.
- **Fix**: Extend integration test at ~442, do not duplicate ~240.
- **Decision**: FIXED (Fix in plan)
