<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Home IA Reset Implementation Plan

- **Plan**: `context/changes/home-ia-reset/plan.md`
- **Scope**: Phases 1–4 (all automated Progress items complete)
- **Date**: 2026-06-27
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings (fixed), 1 observation

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

### F1 — Guest `dataMode` input unused in pure derivation

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: `src/lib/home/home-session-state.ts:311`
- **Detail**: Plan requires `dataMode` as a minimum input and states guest must not assume suggestion/steering gates. Dashboard passes `dataMode` correctly, but `deriveHomeSessionState` ignored it — guest behavior relied solely on `enableSuggestionGate` from the caller. A mistaken caller passing `dataMode: "guest"` with `enableSuggestionGate: true` could elevate auth-only next-focus surfaces.
- **Fix**: Normalize guest input inside `deriveHomeSessionState` by forcing `enableSuggestionGate: false` when `dataMode === "guest"`; add unit test for the mismatch case.
- **Decision**: FIXED — `normalizeGuestInput` added; test `forces suggestion gate off for guest even when caller passes it enabled` added.

### F3 — Dashboard tests omitted authenticated scope with suggestion gate

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: `src/app/_components/pomodoro-dashboard.test.tsx`
- **Detail**: Overlay and permission-deferral tests passed `enableSuggestionGate` while defaulting `onboardingScope` to guest. After F1 enforced guest gate suppression in the pure module, those tests no longer matched production auth wiring.
- **Fix**: Add `authenticatedOnboardingScope` fixture; pass it on all `enableSuggestionGate` renders; align notification-dismiss assertion with authenticated scope.
- **Decision**: FIXED

### F2 — Manual verification items remain open

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: `context/changes/home-ia-reset/plan.md` Progress §1.5, §2.7–2.9, §3.7–3.8, §4.5–4.6
- **Detail**: Eleven manual Progress checkboxes remain `- [ ]`. Automated gates (`pnpm check`, `pnpm test`, targeted Vitest) pass. Manual items cover browser QA (5-second purpose test, idle/returning eye-tracking, archive round-trip) and are appropriately deferred to pre-merge QA — not rubber-stamped.
- **Fix**: None required for S8 approval; carry forward to PR test plan / S10 manual checklist.
- **Decision**: SKIPPED — acknowledged pending manual QA.

## Review Coverage

- **Plan drift**: All four phases implemented per plan. Pure module, dashboard zone consumption, purpose header, recap collapse, and component test matrix match intent. Hook/conductor/e2e files unchanged on branch.
- **Scope guardrails**: No hook/conductor edits, no belt e2e, no new copy keys, no DB/tRPC/auth changes. Wedge overlays remain outside IA regions.
- **Acceptance (S-40)**: Five session states, module priority matrix, collapsed recap, timer hero in active work, filled primary CTA oracle in component tests — all present.
- **Tests run**: `pnpm check` PASS; `pnpm test` PASS (136 files, 1070 tests); targeted S-40 Vitest command PASS after F1 fix.

## Triage Summary

| ID | Decision |
|----|----------|
| F1 | FIXED |
| F3 | FIXED |
| F2 | SKIPPED (manual QA deferred) |
