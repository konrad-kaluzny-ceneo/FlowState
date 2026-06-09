---
change-id: fix-cycle-audio-toggle
title: Fix cycle end audio toggle unresponsive
status: impl_reviewed
roadmap-id: B-01
linear: FLO-53
github: "#72"
created: 2026-06-08
updated: 2026-06-09
---

# Fix cycle end audio toggle unresponsive

## Notes

Production regression in S-20: Cycle end audio Normal / Soft / Muted buttons do not update on click. Suspect `useCycleEndAudioPreference` server-sync effect overwriting optimistic state.
