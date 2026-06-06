---
change_id: testing-active-slice-browser-proofs
title: Active-slice browser proofs for mid-cycle prompt and check-in gate
status: implementing
created: 2026-06-06
updated: 2026-06-06
archived_at: null
---

## Notes

Open a change folder for rollout Phase 2 of context/foundation/test-plan.md: "Active-slice browser proofs".
Risks covered: #3 (mid-cycle task completion prompt — wrong choices or skipped break/end prompt), #7 (check-in gate skipped or energy fails to persist).
Test types planned: Playwright e2e.
Risk response intent:
- #3: Completing a task during an active cycle always surfaces FR-015 choices; with no active tasks left, only "end cycle and break" is offered — challenge happy-path completion without in-flight cycle state; avoid unit-testing prompt component in isolation without cycle-in-flight context.
- #7: Every completed work cycle requires an energy check-in before transition; stored value is readable for the next suggestion — challenge check-in UI mount implies persistence; avoid snapshot of check-in modal without asserting gate blocks transition.
After creating the folder, follow the downstream continuation rule.
