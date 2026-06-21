# Plan Review: ui-polish-fixes

**Date**: 2026-06-21  
**Reviewer**: plan-review sub-agent  
**Verdict**: APPROVED

## Summary

The expanded plan is internally consistent after Phase 3 was broadened from dismiss-copy-only to full daily recap visual polish. Phase 1 is complete (bdd58b3); Phases 2–6 remain feasible UI-layer work with preserved e2e contracts (`data-testid`, `aria-label`). The main test-contract risk — unit tests that assume Last 24h is always present with empty-state copy — is documented in Phase 3 and Progress 3.3; belt e2e (`daily-work-timing-recap.spec.ts`) exercises the non-empty Last 24h path and requires no spec changes.

## Findings table

| ID | Severity | Finding | Action |
|----|----------|---------|--------|
| F1 | WARNING | Current State Analysis still read as if plum tokens were current after Phase 1 landed | **Fixed** — added Phase 1 landed note at top of Current State Analysis |
| F2 | WARNING | Phase 3.5 did not name the existing `"shows empty states when sections have no rows"` test that must be replaced (still asserts Last 24h empty copy today) | **Fixed** — Phase 3.5 now explicitly requires replacing that case |
| F3 | INFO | Prior plan-review referenced Phase 3 as dismiss copy; plan now correctly scopes visual polish (elevation, X, omit-when-empty, chevrons) | Accepted — superseded by this review |
| F4 | INFO | `plan-brief.md` Success Criteria summary omits daily recap; Desired End State and Phases table are aligned | Accepted |
| F5 | INFO | Omit-when-empty Last 24h: `daily-recap-panel.test.tsx:81–93` and e2e non-empty path verified against source; plan's "no e2e changes" claim holds | Accepted |
| F6 | INFO | Phase 3 chevron rotation vs NOT Doing "static chevron acceptable" — rotation is optional basic affordance, not blocked | Accepted |
| F7 | INFO | L-04 component smoke applies to Phase 4 `TaskFieldsPanel`, not Phase 3 recap work | Accepted |
| F8 | INFO | Phase ordering 2→3 valid with Phase 1 done; Phase 3 only hard-depends on Phase 1 tokens (landed) | Accepted |

## CRITICAL

None.

## Recommendation

Proceed to Phase 2 (checkbox / break alerts) or Phase 3 (daily recap visual polish) on `features/ui-polish-fixes`. For Phase 3, implement panel changes first, then update unit tests per the revised Phase 3.5 contract before marking Progress 3.1–3.3 complete. Re-run `pnpm test` (not only the targeted vitest file) before phase sign-off.
