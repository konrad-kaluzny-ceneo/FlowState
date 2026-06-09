# Deliberate-Break VERIFY Matrix

One-time `/10x-e2e` VERIFY results — each row confirms the spec goes **red** when its risk assertion is weakened, then the break was reverted.

| Spec | Risk | Break applied (what was weakened) | Test went red? | Date | Notes |
|------|------|-----------------------------------|----------------|------|-------|
| `persistence-reload.spec.ts` | #1 | Assert non-existent task title `DELIBERATE_BREAK_WRONG_TASK` visible after reload | Yes | 2026-06-06 | Timer panel assertion kept; task title oracle caught break |
| `guest-trial.spec.ts` | #1 (guest) | Assert wrong listitem text after guest reload | Yes | 2026-06-06 | Guest banner + timer assertions unchanged |
| `mid-cycle-last-task.spec.ts` | #3 | Assert `mid-cycle-continue-btn` visible (should be hidden for solo task) | Yes | 2026-06-06 | Correct prod behavior: continue hidden |
| `pomodoro-cycle.spec.ts` | S-01 / #7 | Assert non-existent button `DELIBERATE_BREAK_WRONG_BUTTON` after cycle complete | Yes | 2026-06-06 | Representative test: "focus, start, complete via clock, continue later" |
| `guest-merge-on-sign-in.spec.ts` | #5 | Assert wrong listitem text `DELIBERATE_BREAK_WRONG_TASK` after sign-in merge | Yes | 2026-06-06 | Guest banner hidden + blob cleared assertions unchanged |
| `guest-merge-cycle-on-sign-in.spec.ts` | #5 | Assert wrong listitem text `DELIBERATE_BREAK_WRONG_TASK` after cycle merge | Yes | 2026-06-06 | `timer-panel-running` + guest blob cleared assertions unchanged |
| `mindful-session-wind-down.spec.ts` | S-16 / FR-019–FR-021 | Assert `wind-down-overlay` hidden when fatigue+Fading trigger expected | Yes | 2026-06-08 | Fatigue-path test: overlay oracle caught break; Short Break hidden assertion unchanged |
| `task-reorder.spec.ts` | S-26 / FR-005 | Assert wrong active task order after drag (`DELIBERATE_BREAK_WRONG_ORDER`) | Yes | 2026-06-09 | Auth drag+reload test: title-order oracle caught break; reload persistence assertion unchanged |

**Method:** Temporarily invert or replace the key business-outcome assertion, run the single spec with `CI=true`, confirm failure, revert immediately. No production code changes committed.

**Re-run:** Required when assertion targets change materially or a spec is rewritten.
