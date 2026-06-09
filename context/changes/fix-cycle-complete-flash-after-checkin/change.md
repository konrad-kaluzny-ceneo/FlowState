---
change-id: fix-cycle-complete-flash-after-checkin
title: Fix Cycle Complete overlay flash after check-in
status: implementing
roadmap-id: B-04
linear: FLO-56
github: "#75"
created: 2026-06-09
updated: 2026-06-09
research: context/changes/fix-cycle-complete-flash-after-checkin/research.md
plan_review: context/changes/fix-cycle-complete-flash-after-checkin/reviews/plan-review.md
---

# Fix Cycle Complete overlay flash after check-in

## Notes

Production bug: after submitting energy at cycle end, the stale **Cycle Complete!** modal re-flashes until break/suggestion loads. Suspect `awaitingCheckIn=false` + `state=completed` gap in cycle panel state machine.
