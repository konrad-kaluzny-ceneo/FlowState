<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Playwright E2E Test Infrastructure

- **Plan**: context/changes/e2e-test-infra/plan.md
- **Scope**: Phase 1–3 of 3
- **Date**: 2026-05-28
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — Fragile "user already exists" detection in global setup

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: e2e/global.setup.ts:28-50
- **Detail**: The "already exists" detection checked body string matching first, then fell back to status codes. Status codes are the canonical conflict signal and should be checked first.
- **Fix**: Reorder logic to check status codes (409/422) first, fall back to body string matching only for other non-2xx responses.
- **Decision**: FIXED

### F2 — Poor error diagnostics in auth.setup.ts on sign-in failure

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: e2e/auth.setup.ts:18
- **Detail**: Used `expect(response.ok()).toBeTruthy()` which produces a generic assertion error on failure with no diagnostic info.
- **Fix**: Replaced with explicit check that includes status and body in the error message.
- **Decision**: FIXED

### F3 — vitest.config.ts exclude overrides defaults

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Pattern Consistency
- **Location**: vitest.config.ts
- **Detail**: The `exclude: ["e2e/**", "node_modules/**"]` replaced Vitest's default exclude array entirely, losing other defaults (dist/, cypress/, .git/).
- **Fix A ⭐ Recommended**: Use spread of Vitest defaults — `[...configDefaults.exclude, "e2e/**"]`.
  - Strength: Preserves all default exclusions; future Vitest defaults inherited.
  - Tradeoff: Adds an import from 'vitest/config'.
  - Confidence: HIGH — documented Vitest pattern.
  - Blind spot: None significant.
- **Fix B**: Keep current explicit list.
  - Strength: No additional import; explicit is readable.
  - Tradeoff: Loses other Vitest defaults.
  - Confidence: MEDIUM — works today.
  - Blind spot: Future additions silently missed.
- **Decision**: FIXED (Fix A)

### F4 — No production guard in global.setup.ts

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: e2e/global.setup.ts
- **Detail**: No explicit guard prevented tests from running against a production database.
- **Fix**: Added guard: throw if baseURL doesn't include localhost or 127.0.0.1.
- **Decision**: FIXED

### F5 — Smoke test asserts heading /Active/ instead of task list container

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: e2e/smoke.spec.ts
- **Detail**: Plan said "asserts the task list container is visible." Implementation asserted a heading with regex /Active/ instead — fragile if heading text changes.
- **Fix**: Added `data-testid="task-list"` to TaskList root div; smoke test now uses `getByTestId("task-list")`.
- **Decision**: FIXED
