<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: E2E Belt Merge Gate

- **Plan**: `context/changes/testing-e2e-belt-fast/plan.md`
- **Scope**: Full plan (Phases 1–5)
- **Date**: 2026-06-11
- **Verdict**: APPROVED
- **Findings**: 0 critical, 4 warnings (fixed), 2 observations (1 fixed, 1 skipped)

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

### F1 — sessionId substring match in cycle-recovery

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `e2e/helpers/cycle-recovery.ts:35`
- **Detail**: `response.url().includes(String(sessionId))` could false-positive on substring IDs.
- **Fix**: Parse tRPC `input` query param and compare `sessionId` exactly.
- **Decision**: FIXED

### F2 — Missing auth pool preflight in fixtures

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Reliability
- **Location**: `e2e/fixtures.ts:12-14`
- **Detail**: No check that `e2e/.auth/worker-{n}.json` exists before `newContext`.
- **Fix**: `fs.existsSync` with actionable error message.
- **Decision**: FIXED

### F3 — drainActiveCycles swallows all errors

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Reliability
- **Location**: `e2e/helpers/seed-scenario.ts:118-122`
- **Detail**: Empty catch retried auth/validation failures as flakes.
- **Fix**: Rethrow non-transient, non-race errors; keep retry for stale reads.
- **Decision**: FIXED

### F4 — E2E timer flag in CI build artifact

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: `.github/workflows/ci.yml:63`
- **Detail**: `NEXT_PUBLIC_E2E_MAIN_THREAD_TIMER=1` baked into CI build enables recovery hook in test artifact only.
- **Fix**: Accepted — Vercel prod does not set this var; documented in `e2e/README.md`.
- **Decision**: ACCEPTED

### F5 — Invalid E2E_WORKERS → NaN workers

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Reliability
- **Location**: `e2e/env.ts:25-29`
- **Detail**: `Math.min(NaN, 4)` without fallback.
- **Fix**: Fall back to `AUTH_POOL_SIZE` when parse invalid.
- **Decision**: FIXED

### F6 — Unplanned E2E production hook

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Scope Discipline
- **Location**: `src/hooks/use-e2e-expose-cycle-recovery.ts`, `pomodoro-dashboard.tsx:61`
- **Detail**: `window.__flowstateResetCycleRecovery` not in plan; gated by `NEXT_PUBLIC_E2E_MAIN_THREAD_TIMER=1` for belt wind-down reload stability.
- **Fix**: Accepted — minimal, test-only surface; no production timer path change.
- **Decision**: ACCEPTED
