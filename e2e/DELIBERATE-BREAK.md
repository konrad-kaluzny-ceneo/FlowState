# Deliberate-Break VERIFY Matrix

One-time `/10x-e2e` VERIFY results — each row confirms the spec goes **red** when its risk assertion is weakened, then the break was reverted.

| Spec | Risk | Break applied (what was weakened) | Test went red? | Date | Notes |
|------|------|-----------------------------------|----------------|------|-------|
| `persistence-reload.spec.ts` | #1 | Assert non-existent task title `DELIBERATE_BREAK_WRONG_TASK` visible after reload | Yes | 2026-06-06 | Timer panel assertion kept; task title oracle caught break |
| `guest-trial.spec.ts` | #1 (guest) | Assert wrong listitem text after guest reload | Yes | 2026-06-06 | Guest banner + timer assertions unchanged |
| `mid-cycle-last-task.spec.ts` | #3 | Assert `mid-cycle-continue-btn` visible (should be hidden for solo task) | Yes | 2026-06-06 | Correct prod behavior: continue hidden |
| `pomodoro-cycle.spec.ts` | S-01 / #7 | Assert non-existent button `DELIBERATE_BREAK_WRONG_BUTTON` after cycle complete | Yes | 2026-06-06 | Representative test: "focus, start, complete via clock, continue later" |
| `guest-merge-on-sign-in.spec.ts` | #5 | Assert wrong listitem text `DELIBERATE_BREAK_WRONG_TASK` after sign-in merge | Yes | 2026-06-06 | Guest banner hidden + blob cleared assertions unchanged |

**Method:** Temporarily invert or replace the key business-outcome assertion, run the single spec with `CI=true`, confirm failure, revert immediately. No production code changes committed.

**Re-run:** Required when assertion targets change materially or a spec is rewritten.
