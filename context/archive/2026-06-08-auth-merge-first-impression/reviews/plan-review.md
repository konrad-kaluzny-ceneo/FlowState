<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Auth Narrative and Guest-Merge Success Handoff (S-14)

- **Plan**: `context/changes/auth-merge-first-impression/plan.md`
- **Mode**: Deep
- **Date**: 2026-06-08
- **Verdict**: SOUND
- **Findings**: 0 critical · 3 warnings · 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | WARNING |

## Grounding

Grounding: 10/10 paths ✓, 4/4 symbols ✓ (shouldDeferFirstRun, subscribeGuestStore, loadGuestSnapshotForImport, GuestImportOnMount), brief↔plan N/A (no plan-brief.md)

Code verification confirmed: `defer.ts` stub matches research; `guest-import-on-mount.tsx` discards import counts; `use-onboarding-state.ts` only subscribes to guest store today; `GuestSnapshotV1` task schema supports active/completed + `createdAt` ordering; `first-run-overlay.tsx` at `z-[55]` matches plan modal contract.

## Findings

### F1 — GuestMergeUiProvider ancestor requirement implicit

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phase 3 — Home shell integration
- **Detail**: Phase 3.3 requires `GuestImportOnMount` to call `useGuestMergeUi()`, but Phase 3.4 originally said only "wrap authenticated subtree" without stating the provider must be an **ancestor** of the import mount. Wrong placement (sibling provider) would throw at runtime and block the slice.
- **Fix**: Clarify that `GuestMergeUiProvider` wraps `HomeShellContent` (or `DataModeProvider` + children) inside `OnboardingProvider`, with `GuestImportOnMount` as a descendant.
- **Decision**: FIXED — applied to plan Phase 3.4

### F2 — MergeSuccessCopy type used before defined

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 vs Phase 3 overlay props
- **Detail**: Phase 3 overlay and context reference `MergeSuccessCopy`, but Phase 1 only specified an inline return type on `buildMergeSuccessCopy`. Implementer would invent a duplicate type or import from the wrong module.
- **Fix**: Export named `MergeSuccessCopy` type from `merge-copy.ts` in Phase 1 contract.
- **Decision**: FIXED — applied to plan Phase 1.2

### F3 — E2E first-run setup step buried in parentheses

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 5 — merge-success ordering spec
- **Detail**: The ordering spec must assert first-run appears **after** merge dismiss. That requires `firstRunDismissed: false` for the auth scope. The parenthetical "clear auth onboarding key in setup" was easy to miss and didn't name the existing `clearOnboardingKeys` helper used in `first-run-onboarding.spec.ts`.
- **Fix**: Add explicit setup step: call `clearOnboardingKeys(page)` before guest task seeding.
- **Decision**: FIXED — applied to plan Phase 5.2

### F4 — No browser e2e for auth value narrative

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 4 — Auth page value narrative
- **Detail**: FR-001/FR-002 auth copy is verified manually only. Acceptable for this slice (merge ordering is the higher-risk surface per test-plan Risk #5 UX half), but a future smoke spec could lock copy regressions.
- **Fix**: None required for S-14; manual verification in Phase 4 is sufficient.
- **Decision**: DISMISSED — accepted scope boundary

## Triage Summary

| Action | Findings |
|--------|----------|
| Fixed in plan | F1, F2, F3 |
| Dismissed | F4 |
| Open CRITICAL | 0 |

**Verdict after fixes: SOUND** — safe to proceed to `/10x-implement auth-merge-first-impression phase 1`.
