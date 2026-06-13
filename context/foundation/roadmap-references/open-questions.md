> Detail reference — load on demand. Index: [roadmap.md](../roadmap.md). PRD source: [prd.md](../prd.md) v3.

# Open Roadmap Questions

## Resolved in PRD v3 (2026-06-13)

| Topic | Resolution | Roadmap impact |
| --- | --- | --- |
| Pause vs 4h session timeout | Pause ≠ interruption; ~30 min pause cap → auto-end session | S-24 ready for `/10x-plan` |
| Standing local-day reset | Local midnight browser timezone | S-27 plan constraint |
| Guest FR-040/041 scope | Shortened closure in guest; full narrative after merge | S-11 extension timing |
| Transition surface stacking | F-07 conductor; max 1 interstitial + 1 gate | B-05→F-07 chain |

Detail: [`prd-v3-horizon.md`](prd-v3-horizon.md).

## Still open

1. **Exact pause cap duration** — ~30 min proposed. Owner: user. Block: no (S-24 plan may default 30).
2. **Scoring coefficient values (v2 branches)** — tunable post-ship. Owner: implementer. Block: no.
3. **Conductor beat priority order** — owner: implementer in F-07 `/10x-plan`. Block: no per slice; yes for polish pass if beats collide.
4. **`Task.resumeNote` vs interruption snapshot** — Owner: implementer. Block: S-18/S-17 handoff (historical).
5. **`weight` migration vs dual-axis defaults** — Owner: implementer. Block: was F-05; **done** — note for S-27 only if capacity edge cases.
6. **Drag-drop library and touch targets** — Owner: implementer. Block: no for S-26 (done).
