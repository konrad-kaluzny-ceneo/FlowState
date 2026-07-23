---
change_id: blocked-task-status
title: Blocked task status — park a task waiting on someone/something without breaking session rhythm
status: archived
archived_at: 2026-07-23T10:05:12Z
created: 2026-07-15
updated: 2026-07-23
roadmap_id: S-51
prd_refs: US-06
---

## Notes

Roadmap slice **S-51** (`context/foundation/roadmap-references/items/S-51.md`). Adds
**blocked** as a fourth task lifecycle state — distinct from active, planned, and
completed, and not folded into the stale archive.

Reachable from three surfaces:

- **Task list (Zadania):** mark any active/planned task blocked; unblock returns it to active.
- **Mid-cycle (running WORK cycle):** block the focused task from the same place "Gotowe" is
  offered; hands the session off to a break exactly as completing does (S-50 rhythm).
- **Session end:** mark the focused task blocked in the cycle-complete closure surface.

Blocked tasks leave the wedge suggestion pool until unblocked. Builds directly on **S-50**
(`complete-task-mid-cycle-surface`), whose completion→break hand-off this mirrors.

Decisions locked during `/10x-plan` (2026-07-15): mid-cycle block reuses S-50's short/long break
chooser · blocked is a bare state (no waiting-on note this slice) · `cycles.complete` gains an
atomic block outcome param · dedicated "Zablokowane" tab · inline block/unblock icon buttons ·
blocked exempt from stale-archive · recap reporting out of scope · RUNNING-only mid-cycle block ·
immediate (no confirm) · hook/component/router tests + one focused belt e2e.

**Linear:** [FLO-104](https://linear.app/flowstate-10xdev/issue/FLO-104/user-can-mark-a-started-task-as-blocked-waiting-on-someone-or)
**GitHub:** [#203](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/203)
