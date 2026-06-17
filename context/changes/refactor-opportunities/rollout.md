# Refactor rollout registry

Meta-change: `refactor-opportunities`. Update status as child changes merge.

**Decisions (frozen 2026-06-17):**

- F-07 conductor: `src/lib/wedge/transition-conductor.ts` (pure)
- OQ2 priority: closure > wind-down > check-in > suggestion accept > kickoff readiness > in-flow narrative
- B-05 abort: `kickoffFetchGenRef` generation token
- K2: Path C (`useDomainTasks`) before Path A (repo extend for checkIn/suggestion)

| Rank | Research | Change ID | Roadmap | Prerequisite | Handoff | Status |
|------|----------|-----------|---------|--------------|---------|--------|
| 1a | K5 / T-01 | `fix-closure-kickoff-mutex` | B-05 | — | `/10x-new fix-closure-kickoff-mutex` | not started |
| 1b | K5 / T-03 | `fix-timeout-closure-on-load` | B-06 | B-05 merged | `/10x-new fix-timeout-closure-on-load` | not started |
| 1c | K5 | `wedge-transition-conductor` | F-07 (+ B-07 wind-down) | B-06 merged | `/10x-new wedge-transition-conductor` | not started |
| 3 | K2 | `data-mode-acl-hardening` | — | F-07 merged | `/10x-new data-mode-acl-hardening` | not started |
| 2 | K1 | `cycle-hook-pure-extracts` | — | F-07 merged | `/10x-new cycle-hook-pure-extracts` | not started |
| — | K4 (optional) | `sign-in-schema-extract` | — | — | `/10x-new sign-in-schema-extract` | not started |
| — | K3 (deferred) | `guest-merge-consolidation` | — | data-mode tests | TBD | deferred |
| — | B-08 (deferred) | `fix-graceful-session-end-while-running` | B-08 | F-07; S-24 full | TBD | deferred |

## Verification anchors

- T-01: `pomodoro-dashboard.tsx:371–375` vs `:390–395` (V21–V22)
- ACL gap: 0 `data-mode-context` test files (V28)
- Conductor: 0 `*conductor*` files in `src/` today (V20)
