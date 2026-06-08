<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Persistent Quiet Cycle Audio (S-20)

- **Plan**: `context/changes/persistent-quiet-cycle-audio/plan.md`
- **Mode**: Deep
- **Date**: 2026-06-08
- **Verdict**: SOUND (after triage)
- **Findings**: 1 critical (fixed) · 4 warnings (fixed) · 1 observation (accepted)

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS (was WARNING — F1 fixed) |
| Architectural Fitness | PASS |
| Blind Spots | PASS (was WARNING — F4, F5 fixed) |
| Plan Completeness | PASS (was WARNING — F2, F3, F6 fixed) |

## Grounding

Grounding: 7/7 paths ✓, 5/5 symbols ✓, brief↔plan ✓

Verified paths: `src/lib/audio.ts`, `src/hooks/use-pomodoro-cycle.ts`, `src/app/_components/timer-panel.tsx`, `src/app/_components/pomodoro-dashboard.tsx`, `src/server/api/root.ts`, `prisma/schema.prisma`, `e2e/background-tab-return.spec.ts`.

Verified symbols: `playAlarm` (2 call sites at lines 281/399), `createAudioManager`, `tabWasHiddenWhileRunningRef`, `handleCycleExpired`, `dismissCatchUp`.

Codebase confirmation: S-22 catch-up shipped; `usePomodoroCycle()` currently takes no args; `OnboardingScope` and `flowstate:*` patterns exist; no `UserPreference` model; `playAlarm` blast radius limited to hook + tests.

## Findings

### F1 — Guest→auth merge contradicts itself (server vs client)

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Lean Execution
- **Location**: Critical Implementation Details; Phase 2 `preference.set` contract
- **Detail**: Critical Details said "one-time merge in mutation handler" while Phase 2 preferred client-side hook migration with an unresolved OR branch. Research and plan-brief both lock client-side merge on first auth `preference.set`.
- **Fix**: Unify to client-only migration in `useCycleEndAudioPreference`; remove server-side merge from `set` contract.
- **Decision**: FIXED — applied to Critical Details and Phase 2

### F2 — Prisma model missing field `@map` conventions

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — Prisma enum and model
- **Detail**: Plan omitted `@map` on `userId`, `cycleEndAudioMode`, `updatedAt` while existing models (`Task`, `Session`, `Cycle`) and research draft use snake_case column maps.
- **Fix**: Add `@map("user_id")`, `@map("cycle_end_audio_mode")`, `@map("updated_at")` with `@db` types matching siblings.
- **Decision**: FIXED — applied to Phase 1 contract

### F3 — Vague OnboardingScope wiring for guest path

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architectural Fitness
- **Location**: Phase 3 — Wire scope into dashboard
- **Detail**: Plan said "derive scope from guest/auth detection" but `GuestPomodoroDashboard` does not pass `workTypeDurationScope`; only auth wrapper derives scope today. Vague wording risks wrong localStorage key for guests.
- **Fix**: Instantiate hook in each wrapper with explicit scope: guest `{ mode: "guest" }`; auth reuses `workTypeDurationScope` memo.
- **Decision**: FIXED — applied to Phase 3 contract

### F4 — Guest e2e references non-existent lessons.md S-22 note

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 8 — Guest e2e spec
- **Detail**: Contract cited "lessons.md S-22 note" which does not exist. Repo pattern is `dismissFirstRunIfVisible` in `e2e/helpers/onboarding.ts` (used by `guest-trial.spec.ts`).
- **Fix**: Replace with explicit helper import and `beforeEach` call.
- **Decision**: FIXED — applied to Phase 8 guest spec contract

### F5 — S-22 regression not in Phase 8 automated criteria

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 8 — E2E Tests
- **Detail**: Testing Strategy mentions `background-tab-return.spec.ts` must stay green, but Phase 8 automated success criteria lacked an explicit run command. S-20 hook changes touch the same `handleCycleExpired` path as S-22.
- **Fix**: Add Phase 8 item 4 (S-22 regression) with run command for auth + guest background-tab-return specs; renumber Progress steps 8.3–8.7.
- **Decision**: FIXED — applied to Phase 8 body, success criteria, and Progress

### F6 — `usePomodoroCycle` options shape unspecified

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 5 — Hook accepts mode ref
- **Detail**: Plan offered `RefObject` OR `getMode` callback while current signature is `usePomodoroCycle()` with no parameters. Dual options invite inconsistent wiring.
- **Fix**: Standardize on `usePomodoroCycle({ getCycleEndAudioMode })` with default `"normal"`; dashboard passes `useCallback` keyed on `mode`.
- **Decision**: FIXED — applied to Phase 5, Implementation Approach, and test contracts

### F7 — Autoplay may block soft audio when tab hidden (pre-accepted)

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Research risks; plan Critical Details
- **Detail**: `playAlarm` already swallows `NotAllowedError` when hidden. Plan correctly accepts catch-up + title pulse as FR-013 visual coverage for muted/soft hidden expiry.
- **Fix**: None — risk already documented and accepted.
- **Decision**: ACCEPTED

## Triage Summary

| Action | Findings |
|--------|----------|
| Fixed | F1, F2, F3, F4, F5, F6 |
| Accepted | F7 |
| Skipped | — |
| Dismissed | — |

**Verdict after fixes: SOUND**

## S7 Confidence

**92%** — Plan is actionable, grounded in code, aligned with PRD FR-013/FR-014, roadmap S-20 outcome, and test-plan e2e conventions (§6.3 cookbook growth). Remaining uncertainty: favicon pulse asset choice (optional behind reduced-motion) and exact UI copy labels (tunable per plan-brief). Safe to proceed to `/10x-implement persistent-quiet-cycle-audio phase 1`.
