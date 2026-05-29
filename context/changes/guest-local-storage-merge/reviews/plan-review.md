<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Guest usage with localStorage and merge on login

- **Plan**: `context/changes/guest-local-storage-merge/plan.md`
- **Mode**: Deep
- **Date**: 2026-05-30
- **Verdict**: SOUND (after triage fixes)
- **Findings**: 1 critical, 4 warnings, 2 observations — all triaged

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS (after F2, F5) |
| Lean Execution | PASS (after F7) |
| Architectural Fitness | PASS (after F1 reorder) |
| Blind Spots | PASS (after F1) |
| Plan Completeness | PASS (after F3, F4, F6) |

## Grounding

Grounding: 7/7 paths ✓, symbols ✓, brief↔plan ✓ (updated post-triage).

## Findings

### F1 — Neon optional session on `/` is unverified but gates the slice

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH
- **Dimension**: Blind Spots
- **Location**: Critical Implementation Details; Phase 3; `proxy.ts:5-7`
- **Detail**: Plan correctly flags TBD middleware config, but Phases 3–6 assume guest `/` works. Repo has only `auth.middleware({ loginUrl: "/auth/sign-in" })` with no public-route option.
- **Fix A ⭐ Recommended**: Auth spike before repository UI wiring; reorder phases.
- **Decision**: FIXED via Fix A — Phase 3 auth spike gates Phase 4

### F2 — `PomodoroDashboard` still uses `useSuspenseQuery`

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH
- **Dimension**: End-State Alignment
- **Location**: Phase 4 — Refactor consumers
- **Fix**: Remove duplicate task query; single repo source for `activeTaskIds`.
- **Decision**: FIXED

### F3 — Phase file list omits timer-panel, overlay, hook tests

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM
- **Dimension**: Plan Completeness
- **Location**: Phase 4; Phase 6
- **Fix**: Added timer-panel, cycle-complete-overlay to Phase 4; hook tests to Phase 6.
- **Decision**: FIXED

### F4 — Phase 5 lists auth server actions but says not to change them

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW
- **Dimension**: Plan Completeness
- **Location**: Phase 5 — Post-auth merge trigger
- **Fix**: Removed sign-in/sign-up action paths from file list.
- **Decision**: FIXED

### F5 — Guest cycle refresh recovery not explicit in Phase 3 contract

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM
- **Dimension**: End-State Alignment
- **Location**: Phase 4
- **Fix**: Guest `getActive()` + `resumeFromActiveCycle` via repository; manual refresh criterion.
- **Decision**: FIXED

### F6 — Critical Implementation Details references wrong phase for Neon

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Plan Completeness
- **Fix**: Updated to Phase 3 auth spike gate.
- **Decision**: FIXED

### F7 — Phase 1 partially complete on disk

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Lean Execution
- **Fix**: Phase 1 narrowed to PRD + S-08 verify-only.
- **Decision**: FIXED
