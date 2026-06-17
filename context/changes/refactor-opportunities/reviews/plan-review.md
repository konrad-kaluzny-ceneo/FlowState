<!-- PLAN-REVIEW-REPORT -->

# Plan Review: refactor-opportunities

**Date:** 2026-06-17  
**Reviewer:** Cursor Agent (`/10x-plan-review`)  
**Plan:** `context/changes/refactor-opportunities/plan.md`  
**Verdict:** APPROVED

## Summary

Meta-rollout plan is **substantively sound**: it correctly separates orchestration (this change-id) from implementation (child folders), aligns with roadmap Stream N (B-05 → B-06 → F-07), and code verification confirms the documented T-01 mutex gap, E2E belt mask, dual task-read path (V9), and missing `data-mode-context` tests. Four WARNING items were triaged and fixed in `plan.md`, `rollout.md`, and `plan-brief.md`.

**Code verification highlights:**

- T-01: kickoff overlay guard (`pomodoro-dashboard.tsx:371–375`) omits `!pendingClosureLine`; closure renders later (`:390–395`) — both can be visible.
- Async race: kickoff eligibility effect (`use-pomodoro-cycle.ts:1101–1109`) calls `setAwaitingKickoffReadiness(true)` after `getOrCreateActive()` with **no** generation guard; `endSession` clears via `clearKickoffSuggestion` but cannot cancel an in-flight callback.
- `kickoffFetchGenRef` already exists for `fetchKickoffSuggestion` — B-05 must extend the pattern to the eligibility effect, not introduce it from scratch.
- Belt gap: `e2e/session-closure.spec.ts:45` calls `dismissKickoffReadinessIfVisible` before end session — masks T-01 as planned.
- Path C dual read confirmed: dashboard `api.task.list.useSuspenseQuery()` (`:452`) vs hook `utils.client.task?.list?.query` (`use-pomodoro-cycle.ts:650–658`).
- Phase 1 deliverables (`rollout.md`, `plan.md`, `plan-brief.md`) already exist on disk.

## Findings

| ID | Severity | Category | Finding | Recommendation |
|----|----------|----------|---------|----------------|
| F1 | WARNING | Contradiction | Phase 5 said prerequisite **F-07 merged** but also allowed K2 parallel with Phase 6. | **Fixed** — removed parallel language; K2 strictly after F-07. |
| F2 | WARNING | Completeness | B-07 not tracked in rollout or Phase 4 success criteria. | **Fixed** — B-07 subsection + success criterion in Phase 4; rollout row notes B-07. |
| F3 | WARNING | Feasibility | B-05 `kickoffFetchGenRef` exists for fetch only; eligibility effect unguarded. | **Fixed** — B-05 contract clarifies dashboard mutex + eligibility effect gen check. |
| F4 | WARNING | Prerequisites | F-07 prerequisite was B-05 merged (B-06 recommended). | **Fixed** — F-07 requires B-06 merged; handoff mutex updated. |
| F5 | OBSERVATION | Progress | Phase 1 artifacts exist (`rollout.md` with 5+ child IDs) but all Progress checkboxes are `[ ]`. | Mark 1.1–1.2 `[x]` when manifest is accepted; avoids re-doing Phase 1 on implement. |
| F6 | OBSERVATION | Scope | Research rank #2 K1 / #3 K2 inverted to K2 → K1 in rollout — rationale (ACL test net, F-07 churn) is documented and defensible. | No change required; note in `rollout.md` rank column already reflects implementation order. |
| F7 | OBSERVATION | Scope | B-08 (`fix-graceful-session-end-while-running`) is in Stream N but absent from rollout deferred list. | Add one-line deferral in `rollout.md` or "What We're NOT Doing" to prevent scope creep questions. |
| F8 | OBSERVATION | Operations | Meta-plan does not name who updates `rollout.md` row status on each child merge. | Add ritual: child merge PR updates parent `rollout.md` row (or ship-slice S14 archive step). |

## Checklist

- [x] Desired end state matches `change.md` notes (explore → rank → sequenced rollout)
- [x] Scope boundaries clear (no `src/` in meta change; Path B / K3 / API split excluded)
- [x] Roadmap Stream N order matches phases 2–4 (B-05 → B-06 → F-07)
- [x] T-01 / T-03 / E2E belt gap verified in code
- [x] F-07 conductor placement and OQ2 priority frozen in `rollout.md`
- [x] L-04 / S-34 deferral until after F-07 explicit
- [x] Progress section valid (canonical `## Progress` at bottom)
- [x] F1–F4 triaged and fixed in plan

## Decision

**Proceed** to `/10x-implement refactor-opportunities phase 1` (manifest sign-off) then `/10x-new fix-closure-kickoff-mutex`.
