---
change_id: stateful-illustration-system
title: S-28 phase 2 — state-bound Calm Garden illustrations on hero/rail, not on wedge gates
status: archived
created: 2026-07-02
updated: 2026-07-03
archived_at: 2026-07-03T09:00:00Z
---

## Notes

Roadmap slice S-43 `stateful-illustration-system` (Linear [FLO-91](https://linear.app/flowstate-10xdev/issue/FLO-91/flowstate-stateful-illustration-system-s-43), GitHub [#175](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/175)).

Outcome: user recognizes app mode at a glance from a state-bound Calm Garden illustration on the desktop rail and home hero — a state cue, not decoration. Six variants bound to home session state (`idle`, `energy_choice`, `work`, `break`, `return`, `closure`).

This is S-28 phase 2 absorption: phase 1 (`wellness-illustration-foundation`) already shipped in PR #160, delivering the Serene Pastel illustration tokens (F-06) and the base art system. Phase 2 adds the overlay scrims and the state-to-variant mapping deferred from phase 1.

Placement is explicitly constrained: render only on the home hero and desktop rail. Per the roadmap Note "not on gates," illustrations must **never** appear on S-39 wedge/interstitial gate controls (check-in, cycle complete, wind-down, session closure) — decorative art on gate controls would hurt S-39 operability. Illustrations must be `aria-hidden`; text/status remains canonical. Crossfade ≤200ms, instant swap under `prefers-reduced-motion`, and motion must not delay the S-34 optimistic transition path.

Dependencies (all done): S-28 wellness-illustration-foundation phase 1 (PR #160), F-06 Serene Pastel tokens, F-07 wedge-transition-conductor, S-39 accessible-wedge-gates.

Detail reference: `context/foundation/roadmap-references/items/S-43.md`.
