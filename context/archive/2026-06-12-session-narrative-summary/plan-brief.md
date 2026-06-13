# Plan Brief — session-narrative-summary

**Slice:** S-17 | **Change:** session-narrative-summary | **FR:** FR-040

## One-liner

Add calm session narrative (in-flow line, end closure, 8h return handoff) composing S-18 resume notes — no analytics.

## Phases (6)

1. Schema + pure narrative builder
2. tRPC queries (closure persist, stats, getLastEnded)
3. In-flow summary strip + first-cycle intention
4. Closure overlay on session end
5. 8h return handoff banner in home shell
6. Verification + e2e belt

## Key risks

- Stacking interstitials on transition beats → strict dashboard guards
- Resume note cleared on task complete → persist closure at session end
- Guest parity without session.list → blob-derived handoff

## Routed skills (S7)

| Phase | Skill |
|-------|-------|
| 1, 2 | `/10x-tdd` |
| 3, 4, 5 | `/10x-implement` + `/10x-e2e` (phases 4.3, 5.3) |

## Confidence

Plan completeness: **88%** → target 90% post plan-review
