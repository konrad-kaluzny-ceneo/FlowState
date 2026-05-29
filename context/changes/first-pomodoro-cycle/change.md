---
id: first-pomodoro-cycle
title: "First Pomodoro cycle on a selected task (north star)"
status: shipped
created: 2026-05-28
updated: 2026-05-29
status_note: merged PR #16 (Fixes #7); FLO-8 Done
---

# first-pomodoro-cycle

North-star slice: user picks one existing task, starts a configurable work cycle bound to it, hears an audio signal and sees a UI prompt at cycle end, confirms the transition, and returns to the same state after a refresh.

## References

- Roadmap: S-01
- Linear: [FLO-8](https://linear.app/flowstate-10xdev/issue/FLO-8)
- GitHub: [#7](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/7)
- PRD refs: US-01, FR-009, FR-010, FR-012, FR-013, FR-014, NFR (timer drift ≤ ±2s), NFR (crash/refresh recovery), NFR (200ms acknowledgement)
