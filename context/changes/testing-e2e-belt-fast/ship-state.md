---
stage: S7
phase: 2
roadmap_id: test-plan-phase-7
change_id: testing-e2e-belt-fast
confidence: 88
updated: 2026-06-10
---

## Artifact pointers
- plan.md ✓ (5 phases, 40 progress items — Phase 2 complete)
- plan-brief.md ✓
- research.md ✓
- digest.md ✓
- reviews/plan-review.md ✓

## Last decisions (max 5)
| Step | Decision | Conf |
|------|----------|------|
| S7-p2 | Tagged demoted specs @skip-belt too so grep-invert yields 12 before Phase 5 deletion | 90 |
| S7-p2 | Cap workers at AUTH_POOL_SIZE=4; globalSetup boots server, no teardown kill | 91 |
| S7-p2 | Belt run 8/12 green serial — wind-down fatigue + post-end-session timer shell deferred Phase 3 | 88 |
| S7-p2 | Kickoff dismiss in idle-cycle + work-cycle for pooled-worker overlay bleed | 89 |
| S7-p1 | Rebase clean onto test-plan-refresh-2026-06-10; belt table verified 12/10 | 95 |

## Blockers
(none)

## Next implement
Phase 3: Wind-Down Seed + CI Gate Swap — seed-scenario.ts, CI belt command, E2E_WORKERS=4
