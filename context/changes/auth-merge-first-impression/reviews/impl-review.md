<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Auth Narrative and Guest-Merge Success Handoff (S-14)

- **Plan**: context/changes/auth-merge-first-impression/plan.md
- **Scope**: Phases 1–5 (full plan)
- **Date**: 2026-06-08
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 3 observations (2 fixed during review)

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Summary

All five plan phases are implemented and match intent. Automated verification passes after review fixes for SSR/hydration mismatches. Two justified scope extensions (sessionStorage merge persistence, skip `router.refresh` while modal open) support modal survival without violating "What We're NOT Doing" boundaries.

## Verification Run (2026-06-08)

| Command | Result |
|---------|--------|
| `pnpm check` | PASS |
| `pnpm test` | PASS (286 tests) |
| `$env:CI="true"; pnpm exec playwright test e2e/merge-success-on-sign-in.spec.ts` | PASS |

Manual plan items (3.4–3.6, 4.4–4.5, 5.7) remain unchecked in Progress — expected pre-PR; no evidence of rubber-stamping on automated items.

## Plan Drift Matrix

| Planned item | Verdict | Notes |
|--------------|---------|-------|
| `merge-copy.ts` + tests | MATCH | Title extraction order, overflow, singular/plural |
| `defer.ts` + tests + hook subscription | MATCH | OR semantics, pub/sub, test reset |
| `MergeSuccessOverlay` | MATCH | z-[55], testids, dismiss-only, no backdrop click |
| `GuestMergeUiProvider` | MATCH + EXTRA | sessionStorage persistence not in plan; needed for remount survival |
| `GuestImportOnMount` wiring | MATCH + EXTRA | Skips `router.refresh()` when modal open |
| Auth value narrative (sign-in/sign-up) | MATCH | Card wrapper aligned; copy accurate to guest vs auth parity |
| E2E merge-success ordering spec | MATCH | Asserts modal before first-run, copy content, dismiss handoff |
| `dismissMergeSuccessIfVisible` helper | MATCH | Called first from `dismissFirstRunIfVisible` |

## Findings

### F1 — GuestMergeUiProvider hydration mismatch

- **Severity**: ⚠️ WARNING (fixed during review)
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/app/_components/guest-merge-ui-context.tsx
- **Detail**: `useState` initializer read `sessionStorage` on client but SSR rendered null — React hydration mismatch when pending merge copy existed.
- **Fix**: Initialize copy/visible to null/false; hydrate from sessionStorage in `useLayoutEffect` only.
- **Decision**: FIXED

### F2 — deferFirstRun client initializer diverged from SSR

- **Severity**: ⚠️ WARNING (fixed during review)
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/hooks/use-onboarding-state.ts
- **Detail**: SSR initialized `deferFirstRun` to `true`; client initializer called `shouldDeferFirstRun()` which could be `false` on hydration — source of FirstRunOverlay hydration warnings in e2e logs despite passing tests.
- **Fix**: Always initialize `deferFirstRun` to `true`; sync via existing `useLayoutEffect`.
- **Decision**: FIXED

### F3 — Redundant setMergeSuccessVisible call

- **Severity**: 💡 OBSERVATION (fixed during review)
- **Impact**: 🏃 LOW
- **Dimension**: Pattern Consistency
- **Location**: src/app/_components/guest-import-on-mount.tsx
- **Detail**: `showMergeSuccess()` already calls `setMergeSuccessVisible(true)`; duplicate call removed.
- **Decision**: FIXED

### F4 — sessionStorage merge persistence not in plan

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Scope Discipline
- **Location**: src/app/_components/guest-merge-ui-context.tsx
- **Detail**: Plan specified in-memory provider state only. Implementation adds `flowstate:merge-success-pending` sessionStorage to survive provider remount and skipped refresh. Justified: without it, modal disappears before user dismisses.
- **Decision**: ACCEPTED — intentional scope extension; e2e helper clears key in `clearOnboardingKeys`

### F5 — MergeSuccessOverlay parses body string format

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Architecture
- **Location**: src/app/_components/merge-success-overlay.tsx
- **Detail**: `parseMergeSuccessBody` couples UI to newline-delimited copy structure from `buildMergeSuccessCopy`. Unit tests lock copy shape; acceptable for MVP. Future refactor could pass structured props directly.
- **Decision**: ACCEPTED

### F6 — Duplicate React keys for identical preview titles

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Safety & Quality
- **Location**: src/app/_components/merge-success-overlay.tsx:83
- **Detail**: `key={previewTitle}` collides if two imported tasks share a title. Edge case; no functional impact on merge flow.
- **Decision**: SKIPPED — out of slice scope

## Hydration Mismatch Evaluation

E2e logs showed FirstRunOverlay hydration warnings while tests passed. Root cause: **F2** — client-first-render `deferFirstRun` could differ from SSR. **F1** contributed when sessionStorage held pending merge copy. Both fixed; no further action required unless warnings persist after deploy (unlikely).

## Fixes Applied During Review

1. `guest-merge-ui-context.tsx` — SSR-safe state init + layout-effect hydration
2. `use-onboarding-state.ts` — uniform `deferFirstRun` initial value `true`
3. `guest-import-on-mount.tsx` — removed redundant `setMergeSuccessVisible` import/call
