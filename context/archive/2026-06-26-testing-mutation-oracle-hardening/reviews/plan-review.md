<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Mutation Oracle Hardening

**Review date:** 2026-06-26  
**Roadmap ID:** Q-09 / test-plan §3 Phase 5  
**Change ID:** testing-mutation-oracle-hardening  
**Plan reviewed:** `context/changes/testing-mutation-oracle-hardening/plan.md`  
**Verdict:** APPROVED  
**S6 exit:** satisfied after automatic plan-artifact fixes  
**Approval confidence:** 91/100

## Scope Reviewed

Read and cross-checked:

- `context/changes/testing-mutation-oracle-hardening/plan.md`
- `context/changes/testing-mutation-oracle-hardening/plan-brief.md`
- `context/changes/testing-mutation-oracle-hardening/research.md`
- `context/changes/testing-mutation-oracle-hardening/change.md`
- `context/foundation/test-plan.md` Phase 5 and §6.7
- `context/foundation/lessons.md`

Spot-checked feasibility anchors used by the plan:

- `src/server/api/trpc.ts`
- `src/hooks/use-pomodoro-cycle.test.tsx`
- `src/server/api/routers/cycle-isolation.test.ts`
- `src/server/api/routers/guest.test.ts`
- `src/server/api/lib/import-guest-snapshot.ts`

## Findings

| ID | Severity | Finding | Applied fix | Status |
| --- | --- | --- | --- | --- |
| F1 | WARNING | New direct `protectedProcedure` tests will run through `timingMiddleware`, which adds a random dev delay unless the existing immediate-timer test helper is installed before importing `trpc.ts`. | Added a plan-review decision and Phase 1 note requiring `installImmediateSetTimeout` or an equivalent local setup without weakening the middleware oracle. | Closed |
| F2 | WARNING | Phase 3 made suggestion ownership work optional, but the Stryker command list did not include `suggestion.ts` if that optional router work is touched. | Added a plan-review decision, conditional Stryker command, and implementation note treating `suggestion.ts` as a touched router when suggestion ownership work is implemented. | Closed |
| F3 | WARNING | The plan allows minimal production fixes if a new oracle exposes a shipped bug, but hook/check-in gate fixes could touch transition behavior covered by the recurring lesson on stuck gates. | Added a plan-review decision and Phase 2 note requiring affected actionability/dismiss oracles for any production fix that changes a transition gate. | Closed |

No CRITICAL findings were found.

## Scorecard

| Dimension | Verdict | Notes |
| --- | --- | --- |
| Plan / research alignment | PASS | The plan follows the S4 survived-mutant inventory, user-visible review rule, and Phase 5 risks #1-#6. |
| Scope discipline | PASS | No full-repo Stryker chase, no e2e additions, no UI/component smoke, no CI mutation gate wiring. |
| Feasibility | PASS | Named test files and patterns exist or are reasonable additions; tRPC timing and conditional suggestion evidence are now explicit. |
| Risk coverage | PASS | Auth middleware, hook timer/recovery/gate branches, router ownership, and guest import transaction boundaries map to risks #1-#6. |
| Testing strategy | PASS | Phase-local Vitest commands, targeted Stryker reruns, and final `pnpm check` / `pnpm test` are specified. |
| Progress ledger | PASS | `## Progress` is implementation-ready and optional suggestion work is now tied to conditional verification. |
| Lessons integration | PASS | Transition-gate production fixes now inherit the stuck-gate actionability rule. |

## Review Results

The plan is approved after the three warning fixes above. It is substance-ready for S7 because it targets weak oracles rather than coverage expansion, keeps mutation work scoped to user-visible survivor clusters, and preserves the test-plan §6.7 rule to classify equivalent/deferred survivors instead of chasing 100%.

Residual risk is implementation-level: hook mutation debt is large, so the final phase must record targeted Stryker misses honestly rather than treating the 65% hook band as guaranteed.

## S6 Exit Checklist

- [x] Review saved under `context/changes/testing-mutation-oracle-hardening/reviews/plan-review.md`
- [x] CRITICAL/WARNING findings triaged automatically
- [x] No open CRITICAL findings remain
- [x] Plan artifacts updated only; no production code or tests implemented
- [x] `change.md` status updated to `plan_reviewed`
