---
change_id: complete-task-mid-cycle-surface
title: Surface mid-cycle task completion where it is triggered (task list + Focus)
status: preparing
created: 2026-07-06
updated: 2026-07-06
archived_at: null
---

## Notes

Completing a task during a running WORK cycle sets shared state
(`midCyclePendingTask`) but the choice overlay (`MidCycleCompletionPrompt`) is
mounted only on `/focus`. On `/tasks` the click does nothing visible; the user
only sees the "pick next task / end session" prompt after navigating to
`/focus`. Separately, `/focus` has the overlay but no trigger to complete the
current focused task. Framed in `frame.md`.
