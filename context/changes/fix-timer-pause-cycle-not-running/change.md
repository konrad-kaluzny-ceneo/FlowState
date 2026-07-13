---
change_id: fix-timer-pause-cycle-not-running
title: Pausing a running work cycle fails with "Cycle is not running"
status: bug_filed
created: 2026-07-13
updated: 2026-07-13
archived_at: null
---

## Notes

Discovered while implementing `fix-pause-decouple-end-session` (Phase 2 e2e). Pausing a
running work cycle via the ⏸ timer-card control fails server-side and the timer stays
running. Independent of the button-removal change — the ⏸ control and its pause path were
untouched. Suspected regression from #200 (complete-task-mid-cycle-surface) / #201
(adhoc-rest-time), both of which modified `use-pomodoro-cycle.ts` and `cycle.ts` after the
decouple frame was written (2026-07-06). Next step: `/10x-frame` then `/10x-plan`.
