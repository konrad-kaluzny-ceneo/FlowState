---
date: 2026-06-17T08:52:09+02:00
researcher: Cursor Agent
git_commit: dd55997af3ec6744c0413076e91d3ded33497f0c
branch: features/fix-closure-kickoff-mutex
repository: FlowState
topic: "B-05 fix-closure-kickoff-mutex — closure without kickoff/check-in stacking (T-01)"
tags: [research, codebase, wedge-gates, closure, kickoff, B-05, T-01]
status: complete
last_updated: 2026-06-17
last_updated_by: Cursor Agent
---

# Research: B-05 fix-closure-kickoff-mutex (T-01)

**Date**: 2026-06-17T08:52:09+02:00  
**Researcher**: Cursor Agent  
**Git Commit**: [`dd55997`](https://github.com/konrad-kaluzny-ceneo/FlowState/commit/dd55997af3ec6744c0413076e91d3ded33497f0c)  
**Branch**: `features/fix-closure-kickoff-mutex`  
**Repository**: [konrad-kaluzny-ceneo/FlowState](https://github.com/konrad-kaluzny-ceneo/FlowState)

## Research Question

How should `fix-closure-kickoff-mutex` (B-05) enforce mutual exclusion between session closure and kickoff readiness / check-in on the same visit, and what code changes and tests are required?

## Summary

**T-01 is confirmed and reproducible in code.** Two independent failure modes stack closure with kickoff readiness:

1. **Dashboard mutex gap** — [`pomodoro-dashboard.tsx`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/dd55997af3ec6744c0413076e91d3ded33497f0c/src/app/_components/pomodoro-dashboard.tsx) renders `KickoffReadinessOverlay` (z=60) without checking `pendingClosureLine`, while `SessionClosureOverlay` (z=58) renders whenever `pendingClosureLine != null` with no reciprocal guard. Kickoff paints on top when both mount.

2. **Async race in hook** — The kickoff eligibility `useEffect` ([`use-pomodoro-cycle.ts:1082–1115`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/dd55997af3ec6744c0413076e91d3ded33497f0c/src/hooks/use-pomodoro-cycle.ts#L1082-L1115)) starts an unguarded `sessions.getOrCreateActive()` and unconditionally calls `setAwaitingKickoffReadiness(true)` on resolve. `endSession()` clears kickoff state via `clearKickoffSuggestion()` and `clearKickoffIdleFlags()` but does **not** cancel in-flight callbacks — `kickoffFetchGenRef` is incremented in `clearKickoffSuggestion` but never read in the eligibility effect.

**B-05 scope (intentional narrow hotfix):** mutex closure ↔ kickoff/check-in + abort stale async kickoff. Does **not** implement F-07 conductor or fix other stacking pairs (wind-down + suggestion).

**Recommended fix (aligned with parent plan):**

| Layer | Change |
|-------|--------|
| Hook | Extend `kickoffFetchGenRef` to eligibility effect — capture `gen` at effect entry; check before `setAwaitingKickoffReadiness(true)`; `clearKickoffSuggestion()` on `endSession` already bumps gen |
| Dashboard | Add `!pomodoro.pendingClosureLine` to kickoff guard (L371–375) and check-in guard (L397–399) |
| Vitest | Characterization tests for dashboard mutex + hook race; fail until enforcement |
| E2E belt | Remove `dismissKickoffReadinessIfVisible` pre–end-session mask in `session-closure.spec.ts:45`; assert `kickoff-readiness-overlay` count 0 after closure dismiss |

## Detailed Findings

### Product intent and symptom (T-01)

From [`user-flow.md` T-01](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/dd55997af3ec6744c0413076e91d3ded33497f0c/context/foundation/user-flow.md#L253-L264):

- **Symptom:** `SessionClosureOverlay` flashes or is visible briefly, then kickoff readiness (or check-in) appears on top.
- **Product violation:** Closure should give a calm beat; immediate energy popup breaks FR-040 / interstitial-fatigue guardrail.
- **Dedup:** `sessionStorage` (`wasClosureShown`) prevents re-showing closure for the same session id — user cannot recover a dismissed-under-kickoff closure on the same visit.

### Dashboard overlay guards

File: [`src/app/_components/pomodoro-dashboard.tsx`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/dd55997af3ec6744c0413076e91d3ded33497f0c/src/app/_components/pomodoro-dashboard.tsx)

| Overlay | Guard lines | Checks `pendingClosureLine`? | z-index |
|---------|-------------|------------------------------|---------|
| `KickoffReadinessOverlay` | 371–381 | **No** | 60 ([`kickoff-readiness-overlay.tsx:25`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/dd55997af3ec6744c0413076e91d3ded33497f0c/src/app/_components/kickoff-readiness-overlay.tsx#L25)) |
| `SessionClosureOverlay` | 390–395 | N/A (only `pendingClosureLine != null`) | 58 ([`session-closure-overlay.tsx:23`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/dd55997af3ec6744c0413076e91d3ded33497f0c/src/app/_components/session-closure-overlay.tsx#L23)) |
| `CheckInOverlay` | 397–423 | **No** | 60 |
| `WindDownOverlay` | 425–434 | **No** | 58 |

Kickoff guard today:

```371:375:src/app/_components/pomodoro-dashboard.tsx
			{enableSuggestionGate &&
				pomodoro.awaitingKickoffReadiness &&
				!pomodoro.awaitingCheckIn &&
				!pomodoro.awaitingWindDown &&
				!pomodoro.isPostCheckInTransitioning && (
```

Closure render:

```390:395:src/app/_components/pomodoro-dashboard.tsx
			{pomodoro.pendingClosureLine != null && (
				<SessionClosureOverlay
					closureLine={pomodoro.pendingClosureLine}
					onDismiss={pomodoro.dismissSessionClosure}
				/>
			)}
```

**Note:** `showInFlowSummary` (L145–153) suppresses narrative on `awaitingKickoffReadiness` but not on `pendingClosureLine` — out of B-05 scope unless plan expands.

**`pendingClosureLine` usage:** Only read for closure render in dashboard. Set/cleared exclusively in hook (`presentClosureOverlay`, `dismissSessionClosure`, `endSession`).

### Hook: kickoff eligibility and async race

File: [`src/hooks/use-pomodoro-cycle.ts`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/dd55997af3ec6744c0413076e91d3ded33497f0c/src/hooks/use-pomodoro-cycle.ts)

**Eligibility predicate** (L1070–1080) requires authenticated idle state with `sessionStartIdleFlag` or `postBreakIdleFlag`. Does **not** consider `pendingClosureLine` or active session end in progress.

**Generation token pattern (partial):**

| Location | Role |
|----------|------|
| L326 | `kickoffFetchGenRef = useRef(0)` |
| L847 | `clearKickoffSuggestion()` increments ref |
| L1007, L1021, L1040 | `fetchKickoffSuggestion()` uses gen for stale abort |
| L1082–1109 | Eligibility effect — **no gen check** |

**`endSession` sequence** (L2081–2158):

1. `presentClosureOverlay(closureLine, endingSessionId)` — sets `pendingClosureLine` (L2114)
2. Resets timer/cycle/focus; clears `_activeSessionId` (L2126)
3. `clearKickoffSuggestion()` — gen++, `awaitingKickoffReadiness = false` (L2139)
4. `clearKickoffIdleFlags()` — makes future `kickoffEligible` false (L2140)

**Race sequence:**

```
Kickoff effect starts getOrCreateActive() (no gen token)
  → user calls endSession()
  → closure shown; kickoff cleared synchronously
  → getOrCreateActive resolves late
  → setActiveSessionId + setAwaitingKickoffReadiness(true)  // reopens kickoff over closure
```

The `!kickoffEligible` branch (L1086–1089) only clears readiness on eligible→ineligible transition while readiness is already true — it does not guard a stale async resolution.

**Typical trigger:** Page-load recovery sets `sessionStartIdleFlag` (L626) → effect fires → user interrupts and ends session before/slow API → closure + late kickoff.

### Test coverage gaps

| Layer | File | What exists | B-05 gap |
|-------|------|-------------|----------|
| Dashboard | `pomodoro-dashboard.test.tsx` | Closure alone (L305–314); kickoff **card** (L192–222) | No `kickoff-readiness-overlay` + `pendingClosureLine` mutex test |
| Hook | `use-pomodoro-cycle.test.tsx` | `endSession` + closure (L1109–1176); kickoff readiness suite (L2025+) | No `endSession` while `getOrCreateActive` in flight |
| E2E belt | `e2e/session-closure.spec.ts` | Closure dismiss flow | **L45 masks T-01** via `dismissKickoffReadinessIfVisible` before end session |

**E2E belt fix** ([`session-closure.spec.ts`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/dd55997af3ec6744c0413076e91d3ded33497f0c/e2e/session-closure.spec.ts)):

- Remove L45 and unused import L8
- After L56 (post-dismiss, same visit): `await expect(page.getByTestId("kickoff-readiness-overlay")).toHaveCount(0)`
- Assertion pattern exists in [`task-suggestion.spec.ts`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/dd55997af3ec6744c0413076e91d3ded33497f0c/e2e/task-suggestion.spec.ts) (kickoff count 0)

`session-return-handoff.spec.ts` does not pre-dismiss kickoff but also lacks post-closure kickoff assertion — optional parity, not required by parent plan.

### Blast radius

| File | Change type |
|------|-------------|
| `src/hooks/use-pomodoro-cycle.ts` | Gen guard in eligibility effect |
| `src/app/_components/pomodoro-dashboard.tsx` | Mutex guards on kickoff + check-in |
| `src/hooks/use-pomodoro-cycle.test.tsx` | Characterization + enforcement |
| `src/app/_components/pomodoro-dashboard.test.tsx` | Characterization + enforcement |
| `e2e/session-closure.spec.ts` | Belt assertion |

**Out of scope:** F-07 conductor module, wind-down/suggestion stacking, B-06 timeout-on-load (T-03), guest mode (kickoff is authenticated-only).

## Code References

- [`src/app/_components/pomodoro-dashboard.tsx:371-395`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/dd55997af3ec6744c0413076e91d3ded33497f0c/src/app/_components/pomodoro-dashboard.tsx#L371-L395) — kickoff guard without closure mutex; closure independent render
- [`src/app/_components/pomodoro-dashboard.tsx:397-399`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/dd55997af3ec6744c0413076e91d3ded33497f0c/src/app/_components/pomodoro-dashboard.tsx#L397-L399) — check-in guard without closure mutex
- [`src/hooks/use-pomodoro-cycle.ts:326`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/dd55997af3ec6744c0413076e91d3ded33497f0c/src/hooks/use-pomodoro-cycle.ts#L326) — `kickoffFetchGenRef` declaration
- [`src/hooks/use-pomodoro-cycle.ts:846-854`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/dd55997af3ec6744c0413076e91d3ded33497f0c/src/hooks/use-pomodoro-cycle.ts#L846-L854) — `clearKickoffSuggestion` bumps gen
- [`src/hooks/use-pomodoro-cycle.ts:1070-1115`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/dd55997af3ec6744c0413076e91d3ded33497f0c/src/hooks/use-pomodoro-cycle.ts#L1070-L1115) — kickoff eligibility + unguarded async
- [`src/hooks/use-pomodoro-cycle.ts:680-689`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/dd55997af3ec6744c0413076e91d3ded33497f0c/src/hooks/use-pomodoro-cycle.ts#L680-L689) — `presentClosureOverlay`
- [`src/hooks/use-pomodoro-cycle.ts:2114-2140`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/dd55997af3ec6744c0413076e91d3ded33497f0c/src/hooks/use-pomodoro-cycle.ts#L2114-L2140) — `endSession` closure then kickoff clear
- [`e2e/session-closure.spec.ts:45`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/dd55997af3ec6744c0413076e91d3ded33497f0c/e2e/session-closure.spec.ts#L45) — belt mask (pre-dismiss kickoff)
- [`e2e/helpers/idle-cycle.ts:6-11`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/dd55997af3ec6744c0413076e91d3ded33497f0c/e2e/helpers/idle-cycle.ts#L6-L11) — `dismissKickoffReadinessIfVisible` helper

## Architecture Insights

1. **Two-layer fix required.** Dashboard mutex alone stops simultaneous render when both flags are true, but does not prevent the hook from setting `awaitingKickoffReadiness` after closure dismiss — the async race must be fixed in the hook.

2. **Reuse existing gen pattern.** `kickoffFetchGenRef` already aborts stale `fetchKickoffSuggestion` calls; extending it to the eligibility effect is consistent and `endSession` already invalidates via `clearKickoffSuggestion()`.

3. **B-05 is a tactical slice of F-07.** Full priority matrix (closure > wind-down > check-in > suggestion > kickoff) belongs in `wedge-transition-conductor` (F-07). B-05 adds the minimum guards for the only **active product bug** (T-01) without refactoring all scattered `show*` / `&&` stacks.

4. **Check-in included in B-05 outcome.** Roadmap B-05 outcome explicitly covers check-in stacking; check-in guard (z=60) has the same mutex gap as kickoff.

## Historical Context (from prior changes)

- [`context/changes/refactor-opportunities/research.md`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/dd55997af3ec6744c0413076e91d3ded33497f0c/context/changes/refactor-opportunities/research.md) — V21–V22 verified dashboard mutex gap; ranked B-05 as first implementation step
- [`context/changes/refactor-opportunities/plan.md`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/dd55997af3ec6744c0413076e91d3ded33497f0c/context/changes/refactor-opportunities/plan.md) — Phase 2 commit order: characterization → hook mechanism → dashboard enforcement → belt
- [`context/changes/refactor-opportunities/reviews/plan-review.md`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/dd55997af3ec6744c0413076e91d3ded33497f0c/context/changes/refactor-opportunities/reviews/plan-review.md) — belt gap at `session-closure.spec.ts:45` documented
- [`context/foundation/roadmap-references/items/B-05.md`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/dd55997af3ec6744c0413076e91d3ded33497f0c/context/foundation/roadmap-references/items/B-05.md) — P0 hotfix; 92% flow-improvement confidence
- [`context/foundation/user-flow.md`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/dd55997af3ec6744c0413076e91d3ded33497f0c/context/foundation/user-flow.md) — T-01 root cause and overlay z-index matrix

## Related Research

- [`context/changes/refactor-opportunities/research.md`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/dd55997af3ec6744c0413076e91d3ded33497f0c/context/changes/refactor-opportunities/research.md) — K5 wedge orchestration parent research
- [`context/changes/repo-map-analysis/research.md`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/dd55997af3ec6744c0413076e91d3ded33497f0c/context/changes/repo-map-analysis/research.md) — hook fan-out and blast radius

## Open Questions

| # | Question | Recommendation for `/10x-plan` |
|---|----------|------------------------------|
| OQ1 | Generation token vs dedicated `endSession` flag for abort | **Gen token** — already exists; `clearKickoffSuggestion` on `endSession` provides invalidation without new state |
| OQ2 | Should `kickoffEligible` also exclude `pendingClosureLine != null`? | **Optional belt-and-suspenders** — dashboard guard is required for render; hook predicate update reduces unnecessary `getOrCreateActive` calls but is secondary |
| OQ3 | Assert kickoff hidden **during** closure visible, or only after dismiss? | **Both in char tests**; belt focuses on **after dismiss** per parent plan (same visit calm idle) |
| OQ4 | Include `session-return-handoff.spec.ts` post-closure kickoff assertion? | **Defer** — not in parent B-05 contract; add if belt flakes without it |

## Implementation Handoff (for plan)

Mandatory commit order from parent plan:

1. **Characterization** — Vitest: dashboard renders kickoff when `pendingClosureLine` set; hook sets `awaitingKickoffReadiness` after `endSession()` when `getOrCreateActive` was in flight (tests fail)
2. **Mechanism** — Hook: gen check in eligibility effect L1082–1114
3. **Enforcement** — Dashboard: `!pendingClosureLine` on kickoff + check-in guards
4. **Belt** — `session-closure.spec.ts`: remove L45 mask; assert no kickoff overlay after closure dismiss

Branch: `features/fix-closure-kickoff-mutex` (already checked out).
