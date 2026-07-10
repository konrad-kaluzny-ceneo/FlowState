---
change_id: complete-task-mid-cycle-surface
title: One session = one task — finishing the focused task ends the cycle into a mandatory break
status: implementing
created: 2026-07-06
updated: 2026-07-10
archived_at: null
---

## Notes

Product model revised 2026-07-09 (supersedes the original "just relocate the
overlay" framing). Desired behavior:

- Finishing a task mid-cycle must lead into a short break (mind reset) — no
  "continue this cycle with a different task" escape hatch for the focused task.
- The focused task can be completed from the Focus view (no trigger exists today).
- Completing the *focused* task from `/tasks` auto-ends the session into a break,
  exactly as if done from `/focus`.
- Completing a *non-focused* task must NOT affect the running session/focus.
- Completing the focused task → auto break, with NO next-task selection for the
  current session.
- User picks short vs long break; the system-suggested option is marked with a star.
- On ending the *session*, the "did you finish the task?" choice is preserved.

Effect: "one session = one task, no context switch, then a short break."
Full analysis in `frame.md`.
