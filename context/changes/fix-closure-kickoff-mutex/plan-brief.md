# Fix Closure Kickoff Mutex (B-05 / T-01) — Plan Brief

> Full plan: `context/changes/fix-closure-kickoff-mutex/plan.md`
> Research: `context/changes/fix-closure-kickoff-mutex/research.md`

## What & Why

User can dismiss session closure in peace — no energy popup (kickoff readiness or check-in) appears on top of or immediately after closure on the same visit. T-01 breaks FR-040 calm closure: kickoff (z=60) stacks over closure (z=58), and an async race can reopen kickoff after `endSession()` clears state.

## Starting Point

Dashboard renders kickoff and check-in overlays without checking `pendingClosureLine`; closure renders independently. The kickoff eligibility effect fires unguarded `getOrCreateActive()` while `kickoffFetchGenRef` only protects `fetchKickoffSuggestion`. Belt `session-closure.spec.ts` masks the bug by pre-dismissing kickoff before end session.

## Desired End State

End session → closure overlay → dismiss → calm idle on same visit with no kickoff or check-in overlay. Stale async kickoff eligibility aborts via generation token. Vitest and belt prove the fix; F-07 conductor deferred.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Stale async abort | Extend `kickoffFetchGenRef` to eligibility effect | Reuses existing invalidation from `clearKickoffSuggestion` on `endSession` | Research / Plan |
| Eligibility predicate | `kickoffEligible` excludes `pendingClosureLine` + dashboard guards | Avoids unnecessary API calls and defense in depth | Plan |
| Char test oracle | During closure + hook race + after dismiss (belt) | Documents both independent failure modes | Research / Plan |
| Check-in scope | Same `!pendingClosureLine` guard as kickoff | B-05 outcome explicitly covers check-in stacking | Research / Plan |
| E2E belt scope | `session-closure.spec.ts` only | Fixes documented belt gap without expanding scope | Plan |

## Scope

**In scope:** Hook gen guard; `kickoffEligible` predicate; dashboard kickoff + check-in mutex guards; Vitest characterization; belt assertion removing pre-dismiss mask.

**Out of scope:** F-07 conductor; wind-down/suggestion stacking; B-06 timeout closure; guest mode; `session-return-handoff.spec.ts`; `showInFlowSummary` during closure.

## Architecture / Approach

Two-layer fix: (1) hook captures `kickoffFetchGenRef` at async start and bails if `endSession` bumped the ref; (2) dashboard adds `!pendingClosureLine` to kickoff and check-in guards. Four commits: failing char tests → hook mechanism → dashboard enforcement → belt. Branch `features/fix-closure-kickoff-mutex`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Characterization | Failing Vitest oracle for dashboard mutex + hook race | Tests accidentally pass on current bug |
| 2. Hook mechanism | Gen guard + predicate; hook tests green | Gen capture vs increment semantics |
| 3. Dashboard enforcement | Mutex guards; all Vitest green | Missing check-in guard leaves B-05 outcome gap |
| 4. Belt | Remove mask; assert no kickoff after dismiss | E2E flake if kickoff still races in real browser |

**Prerequisites:** Branch `features/fix-closure-kickoff-mutex` checked out; research complete.
**Estimated effort:** ~1–2 sessions across 4 commits.

## Open Risks & Assumptions

- Dashboard-only fix without hook gen guard would still allow readiness flag after closure dismiss — both layers required.
- Legitimate post-visit kickoff on fresh load must not regress (predicate gates on `pendingClosureLine`, not `wasClosureShown`).
- F-07 will supersede ad-hoc guards but B-05 ships first per Stream N rollout.

## Success Criteria (Summary)

- Closure dismiss on same visit shows no kickoff readiness overlay (manual + belt).
- `endSession` during in-flight `getOrCreateActive` does not set `awaitingKickoffReadiness`.
- CI green: `pnpm check`, `pnpm test`, `pnpm test:e2e:belt`.
