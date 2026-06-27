<!-- PLAN-REVIEW-REPORT -->

# Plan Review: product-voice-contract

**Date:** 2026-06-27  
**Verdict:** APPROVED  
**Confidence:** 90%

## Summary

The plan is substantive, traceable to F-14, and feasible for the current FlowState stack. It preserves the required separation between localization architecture and product voice work, covers the high-risk copy surfaces found in research, and includes an appropriate verification strategy for a broad i18n migration.

Auto-triage was applied under the 10x-ship-slice-base decision proxy. No critical findings were found. Two warning-level issues were fixed directly in `plan.md` and `plan-brief.md`.

## Findings Count

| Severity | Count | Status |
| --- | ---: | --- |
| CRITICAL | 0 | None |
| WARNING | 2 | Fixed |
| INFO | 2 | Not blocking |

## Findings

### WARNING-01: `next-intl` wiring was underspecified

**Status:** Fixed  
**Files updated:** `context/changes/product-voice-contract/plan.md`, `context/changes/product-voice-contract/plan-brief.md`

The plan chose `next-intl` correctly, but Phase 1 originally named only `package.json`, generic `src/i18n/**`, and `messages/*.json`. Current `next-intl` App Router setup also requires explicit plugin/request wiring and a no-prefix routing strategy if FlowState avoids `/en` and `/pl` URL segments.

Fix applied:

- Added `next.config.js` to dependency/configuration work with `createNextIntlPlugin`.
- Added `src/i18n/request.ts` and `src/i18n/routing.ts` to the locale foundation.
- Made no-prefix routing explicit, including `localePrefix: "never"` as the intended shape.
- Added a critical implementation detail tying together plugin config, request message loading, and proxy composition.

### WARNING-02: Locale proxy composition could drop first-visit locale or auth behavior

**Status:** Fixed  
**Files updated:** `context/changes/product-voice-contract/plan.md`

The plan correctly puts first-visit `Accept-Language` handling in `proxy.ts`, but FlowState's current proxy exits early for auth bypasses and delegates protected routes to Neon auth middleware. Without an explicit contract, implementation could set locale only for protected routes, skip `/`, or lose cookies/redirects when composing i18n and auth responses.

Fix applied:

- Strengthened the `proxy.ts` contract: i18n handling must run before auth bypass/redirect decisions.
- Required response composition to preserve both `next-intl` locale headers/cookies and Neon auth redirects.
- Required `/`, protected routes, and auth-entry paths to resolve the same effective locale.

### INFO-01: F-14 workstream naming must stay distinct from implementation phase numbers

**Status:** Fixed opportunistically  
**Files updated:** `context/changes/product-voice-contract/plan.md`, `context/changes/product-voice-contract/plan-brief.md`

F-14 defines two acceptance tracks: technical bilingual system and target voice contract. The implementation plan expands those into seven delivery phases, so references to "Phase 2 voice work" could be read as implementation Phase 2, which is actually language switch/preference sync.

Fix applied:

- Reworded the confusing note to "Workstream B voice work."
- Updated the brief's decision label from "Phase boundary" to "Workstream boundary."

### INFO-02: Length budgets remain an implementation watch item

**Status:** Not blocking  
**Files updated:** None

The plan already identifies Polish length risk for 120-character closure/resume-note zones and preserves current schema caps unless acceptance examples prove too tight. That is an appropriate decision for this slice: keep schema churn out of the infrastructure workstream unless target copy cannot satisfy F-14 acceptance.

## Approval Rationale

- F-14 acceptance is covered: first-class EN/PL, explicit resource structure/defaulting, unchanged EN migration, product voice contract, 5-second purpose test, rationale/recap target examples, and future-slice checklist.
- Research findings are reflected in the plan: client-heavy app, centralized and inline copy surfaces, ICU plural needs, hardcoded locale formatting, `UserPreference` extension point, and the transition-beat voice constraint.
- The plan respects FlowState constraints: pnpm, Prisma-generated migration, existing auth/guest split, no URL locale segments, no Neon server-error translation, no timer/scoring/wedge behavior refactors beyond copy extraction.
- Verification is proportionate to risk: unit/component/integration coverage, catalog parity, selector stabilization, `pnpm check`, `pnpm typecheck`, `pnpm test`, and E2E belt after broad text migration.

## Auto-Fixes Applied

- Clarified `next-intl` plugin/config/request/routing files in Phase 1.
- Added no-prefix routing and request-time message loading contracts.
- Strengthened proxy/auth composition requirements.
- Removed ambiguous "Phase 2 voice work" wording in favor of Workstream B.
- Aligned `plan-brief.md` with the corrected architecture summary.

## Residual Risk

The main residual risk is execution size: Phase 3 copy migration touches many client components, accessibility labels, placeholders, server-action/Zod messages, and tests. The plan mitigates this with phased migration, unchanged EN copy contracts, parity checks, and a dedicated regression belt, so the risk is acceptable for implementation.
