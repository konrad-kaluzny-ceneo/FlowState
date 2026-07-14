---
change_id: fix-timer-pause-cycle-not-running
title: Pause e2e fails under Playwright fake clock (NOT a product bug)
status: archived
created: 2026-07-13
updated: 2026-07-14
archived_at: 2026-07-14T16:34:08Z
---

## Notes

**Original premise disproven.** Filed 2026-07-13 as a suspected server-side regression
("pausing a running work cycle fails with `Cycle is not running`", blamed on #200/#201).
A runtime probe on 2026-07-14 showed the ⏸ pause control **works fine** — on a real clock,
with both 600s and 30s cycles, `cycle.pause` returns 200.

The failure only occurs under Playwright's fake clock, where **no `cycle.pause` request is ever
sent**: the mutation's dispatch depends on a timer callback that a frozen clock never runs. The
server was never involved; the "Cycle is not running" diagnosis was inferred from a generic
client error toast, never observed.

Scope is therefore a **test fix**, not a product fix: drive the pause journey on a real clock
and lift the `test.fixme` quarantine in `e2e/session-closure.spec.ts` (quarantined during
`fix-pause-decouple-end-session`). No `src/` changes.

See `bug.md` (Correction section) for the probe evidence and `frame.md` for the framing that
correctly refused to plan a product fix on inference.
