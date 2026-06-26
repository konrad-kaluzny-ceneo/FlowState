---
change_id: testing-prd-v3-wedge-coherence
title: PRD v3 wedge coherence
status: implemented
created: 2026-06-26
updated: 2026-06-26
archived_at: null
---

## Notes

Quality companion for **test-plan §3 Phase 8** and roadmap **Q-08** — not a reopen of shipped S-39 product scope. Shipped wedge features (F-07 conductor, pause, optimistic transitions, recovery, operability) need orchestrated test proofs before new product scope.

### Problem

PRD v3 wedge flows (US-01, US-04) span transition mutex, pause semantics, optimistic wedge handoff, network recovery, stuck-gate dismiss, and S-39 operability oracles. Individual slices shipped fixes and partial tests, but **test-plan risks #8–#12** lack a coordinated rollout: hook/component/belt proofs may be thin, duplicated, or missing race branches after F-07 and B-05–B-08 hotfixes.

### Outcome

Quality rollout proves PRD v3 wedge coherence end-to-end:

- **#8** — at most one interstitial + one gate per transition beat; no overlay stacking on same visit
- **#9** — check-in → suggestion ≤200ms perceived; rollback on mutation failure
- **#10** — pause/resume preserves remaining time; ~30 min cap ends session calmly (not as interruption)
- **#11** — network loss during wedge gate: calm recovery, preserved intent, one-tap retry
- **#12** — every gate primary action dismisses overlay and unblocks next beat (no deferral deadlock)
- **S-39** — operability oracles per test-plan §6.10 (focus, live status, keyboard-first) where belt cannot observe

Deliver unit, hook, component, and integration oracles per Phase 8 dual-layer map; add belt coverage only if implementation proves a contract cannot be observed below browser level. Update cookbook §6.10 as patterns land.

### Prerequisites (roadmap)

F-07, S-21, S-24, S-28, S-34, S-35, S-39 — all **done**. No hard blockers.

### Research handoff

Ground in `context/foundation/test-plan.md` §2 risks #8–#12, §3 Phase 8, §6.10 wedge dismiss/operability oracles. Hot spots: wedge conductor, cycle hook, dashboard overlay orchestration. Prior archived context: `session-entry-wedge-bugs`, `accessible-wedge-gates`, `optimistic-wedge-transitions`, `wedge-transition-sync-recovery`, `cycle-pause-resume`.
