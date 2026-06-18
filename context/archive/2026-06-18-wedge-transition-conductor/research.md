---
topic: wedge-transition-conductor (F-07)
researcher: ship-slice-flat
date: 2026-06-18
confidence: 88
---

# Research — wedge-transition-conductor (F-07)

## Question

How should a central wedge transition conductor replace scattered overlay guards while enforcing pol-10 (return handoff defers kickoff) and preserving belt/e2e contracts?

## Upstream

- K5 findings in `context/changes/refactor-opportunities/research.md` (overlay orchestration debt)
- B-05 archived: closure↔kickoff mutex + async abort after `endSession()`
- B-06 archived: timeout closure on hydrate before kickoff flag
- `flow-coherence-recommendations.md` OQ2 priority matrix
- `user-flow.md` T-06 / pol-10

## Current state (verified 2026-06-18)

| Layer | Role | Status |
|-------|------|--------|
| `use-pomodoro-cycle.ts` | Gate flags, `kickoffEligible`, effects | B-05/B-06 guards partial; no handoff in `kickoffEligible` |
| `pomodoro-dashboard.tsx` | 8+ local `show*` + overlay `&&` stacks | Kickoff guarded by `pendingClosureLine == null`; closure unguarded vs kickoff z-order |
| `return-handoff-banner-mount.tsx` | DOM `useTestIdVisible` suppression | Handoff/kickoff not coordinated in hook |
| `src/lib/wedge/` | — | **Missing** (0 conductor files) |

**pol-10 gap:** `kickoffEligible` (`use-pomodoro-cycle.ts:1084–1095`) excludes closure but not undismissed return handoff. `useReturnHandoff` computes `gateOpen` independently in `home-shell`.

**B-07 gap:** Wind-down evaluated in `submitCheckIn` with pre-increment `completedWorkCycles`; break increment in `startBreakAfterWorkComplete` (`:1610`) runs after check-in — wind-down triggers one cycle late at Fading + 3 cycles.

## Priority matrix (OQ2 — decided)

From `flow-coherence-recommendations.md` + event storming pol-10:

```
return handoff (undismissed) > session closure > wind-down > check-in > cycle intention > kickoff readiness > cycle complete > suggestion card > in-flow summary
```

Return handoff is an interstitial banner (not dashboard overlay) but **blocks kickoff eligibility** until dismissed.

## Target architecture

```
src/lib/wedge/transition-conductor.ts   — pure resolveWedgeBeat + computeKickoffEligible
src/lib/wedge/transition-conductor.test.ts — priority oracle
use-pomodoro-cycle.ts                   — kickoffEligible via conductor; returnHandoffGateOpen query; B-07 +1 at check-in
pomodoro-dashboard.tsx                  — render from conductor output (preserve data-testid)
return-handoff-banner-mount.tsx         — keep DOM suppression (belt-stable); hook blocks kickoff via pol-10
```

Hook return API unchanged (63 fields). Dashboard props unchanged.

## Test surface

| Layer | File | Covers |
|-------|------|--------|
| Unit | `transition-conductor.test.ts` | Matrix: closure vs kickoff, handoff blocks kickoff, wind-down vs check-in |
| Hook | `use-pomodoro-cycle.test.tsx` | pol-10 kickoff defer (extend) |
| Belt | `session-return-handoff.spec.ts` | handoff visible → no kickoff; dismiss → kickoff may appear |
| Belt | `session-closure.spec.ts` | existing T-01 parity |

## Risks

- Refactor touches all overlay render paths — behavior-parity tests required before merge
- Guest mode: kickoff N/A; handoff guest path via guest store (no hook change for guest kickoff)
- Catch-up overlays (S-22): coordinate via conductor input flags, not separate priority tier

## Confidence

88% — B-05/B-06 landed; K5 mapped; remaining work is pure module + enforcement with existing test harness.
