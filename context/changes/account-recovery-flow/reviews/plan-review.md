<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Account Recovery Flow Implementation Plan

- **Plan**: `context/changes/account-recovery-flow/plan.md`
- **Mode**: Deep
- **Date**: 2026-06-07
- **Verdict**: SOUND
- **Findings**: 0 critical, 6 warnings, 0 observations (pre-fix); all warnings fixed via decision proxy

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS (was WARNING — F4 fixed) |
| Architectural Fitness | PASS |
| Blind Spots | PASS (was WARNING — F3, F5 fixed) |
| Plan Completeness | PASS (was WARNING — F1, F2, F6 fixed) |

## Grounding

Grounding: 8/8 paths ✓, 4/4 symbols ✓ (`auth.requestPasswordReset`, `auth.resetPassword`, `NEON_AUTH_NETWORK_ERROR_CODES`, `signUpSchema`), brief↔plan ✓

## Decision Log (ship-slice proxy)

| ID | Decision | Rationale | Confidence |
|----|----------|-----------|------------|
| F1 | Added `getRequestOrigin()` helper contract in Critical Implementation Details + Phase 1 file | No origin helper exists in codebase; Next.js 16 `headers()` is async — implementer would guess fallback logic | HIGH |
| F2 | Specified `passwordSchema` export from sign-up schema + Phase 2 file change | "Reuse signUpSchema" was ambiguous; drift risk without named export | HIGH |
| F3 | Export `postAuthWithRetry` from e2e helpers + use in API smoke test | CI runs `E2E_WORKERS=1` for Neon rate limits; raw `request.post` flakes on 429/503 per existing helper pattern | HIGH |
| F4 | Corrected "three new route folders" → two new + sign-in mods | Plan body contradicted actual scope (only forgot/reset are new folders) | HIGH |
| F5 | Specified `result.error` handling for forgot-password and reset-password actions | Sign-in/sign-up already check `result.error`; plan omitted concrete SDK response contract | HIGH |
| F6 | OAuth `error` banner takes precedence over `reset=success` | Both use `useSearchParams` on sign-in; edge case would confuse UX without precedence rule | MED |

## Findings

### F1 — Origin helper lacks concrete implementation

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Critical Implementation Details — redirectTo origin
- **Detail**: Plan referenced `headers()` but provided no async helper contract. Codebase has no existing origin builder (`grep` found none under `src/`). Next.js 16 requires `await headers()`.
- **Fix**: Add `src/lib/auth/request-origin.ts` with `getRequestOrigin()` and reference from forgot-password action.
- **Decision**: FIXED via F1

### F2 — Password schema reuse unspecified

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 — Reset-Password Schema
- **Detail**: "Reuse password constraints from signUpSchema" did not specify export/import mechanism. `signUpSchema` is a composite object (name, email, password).
- **Fix**: Export `passwordSchema = signUpSchema.shape.password` from sign-up schema; import in reset-password schema.
- **Decision**: FIXED via F2

### F3 — E2E API test missing rate-limit retry

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 3 — Account Recovery E2E Spec
- **Detail**: `e2e/helpers/user.ts` wraps auth POSTs in `postAuthWithRetry` (429/503 backoff) but keeps it private. Plan used raw `request.post` despite CI rate-limit docs in `e2e/README.md`.
- **Fix**: Export `postAuthWithRetry`; use in account-recovery API smoke test.
- **Decision**: FIXED via F3

### F4 — "Three new route folders" incorrect

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Lean Execution
- **Location**: Implementation Approach
- **Detail**: Only `forgot-password/` and `reset-password/` are new folders; sign-in is modified in place.
- **Fix**: Reword to "two new route folders plus sign-in modifications".
- **Decision**: FIXED via F4

### F5 — SDK error handling underspecified

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1 action, Phase 2 reset action
- **Detail**: Sign-in checks `result.error` + `NEON_AUTH_NETWORK_ERROR_CODES`. Plan said "on SDK success or ambiguous response" for forgot-password without specifying response shape. Reset action similarly vague.
- **Fix**: Mirror sign-in `result.error` pattern; non-enumerating success for forgot-password on non-network errors.
- **Decision**: FIXED via F5

### F6 — Sign-in banner param precedence

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 — Sign-In Success Banner
- **Detail**: Sign-in form already reads `?error` for OAuth failures. Adding `?reset=success` without precedence rule could show conflicting banners.
- **Fix**: OAuth `error` banner takes precedence; show reset success only when no `error` param.
- **Decision**: FIXED via F6

## Triage Summary

```
═══════════════════════════════════════════════════════════
  TRIAGE COMPLETE (decision proxy — no user prompts)
═══════════════════════════════════════════════════════════

  Fixed:     F1, F2, F3, F4, F5, F6   (6)
  Skipped:   —                        (0)
  Accepted:  —                        (0)
  Dismissed: —                        (0)

  ► Verdict after fixes: SOUND
═══════════════════════════════════════════════════════════
```
