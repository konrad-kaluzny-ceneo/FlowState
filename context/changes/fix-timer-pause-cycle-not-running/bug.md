---
change_id: fix-timer-pause-cycle-not-running
kind: bug
verdict: confirmed
reported: 2026-07-13
---

# Bug: Pausing a running work cycle fails ("Cycle is not running")

## Symptom
During an active, running **work** cycle, clicking the ⏸ pause control (the timer-card
icon, `timer-pause`) fails: an error toast appears — **"Nie udało się wstrzymać cyklu.
Spróbuj ponownie."** ("Could not pause the cycle. Try again.") — and the timer stays in the
running state. The `timer-panel-paused` view never renders.

## Trigger
Start a focused work cycle, let it run (reproduced ~14s into a 30s test cycle — well past any
cycle-create persistence race), then click the ⏸ `timer-pause` button.

## Reproduction
Deterministic in Playwright (failed identically on two consecutive runs) via
`e2e/session-closure.spec.ts` → `pause via timer then end session closes session`
(currently quarantined as `test.fixme`, linked to this bug). The assertion
`expect(getByTestId('timer-panel-paused')).toBeVisible()` times out because pause never
takes effect.

## Expected
Clicking ⏸ pauses the cycle: server transitions the cycle `RUNNING → PAUSED`, the client
renders `timer-panel-paused` with a ▶ resume control, no error toast.

## Confirmation
**Verdict:** confirmed

Code path from trigger to symptom:

- Client `pause()` optimistically sets `paused`, resolves the persisted cycle id, then calls
  `cycles.pause({ cycleId, remainingDurationSec })`; on any throw it rolls back to running and
  sets the `pauseFailed` error — `src/hooks/use-pomodoro-cycle.ts:2107-2173`. The 14s elapsed
  rules out `resolvePersistedCycleId` returning null (create already persisted), so the throw
  comes from the server mutation.
- Server `cycle.pause` guards with `updateMany({ where: { id, userId, state: "RUNNING" }, ... })`
  and throws `BAD_REQUEST "Cycle is not running"` when `count === 0` —
  `src/server/api/routers/cycle.ts:377-395`. The cycle is **not in `RUNNING` state** server-side
  at pause time, which is the anomaly to investigate.

## Suspected cause
A regression in cycle state management from #200
(`context/archive/.../complete-task-mid-cycle-surface`) and/or #201
(`.../adhoc-rest-time`) — both modified `src/hooks/use-pomodoro-cycle.ts` and
`src/server/api/routers/cycle.ts` after 2026-07-06. Hypotheses to test in framing:
the start/create flow no longer persists the cycle as `RUNNING`; a new mid-cycle/ad-hoc-break
transition moves it out of `RUNNING`; or the optimistic `remainingDurationSec` computation now
trips the `> configuredDurationSec` guard (`cycle.ts:368-373`) under short test cycles.

## Impact
The ⏸ pause control — a core, user-facing timer affordance and one of the two controls the
`fix-pause-decouple-end-session` change relies on — is broken for work cycles. Pause→end and
plain pause journeys are affected. High priority: this is exactly the kind of dead-end
transition `context/foundation/lessons.md` (L-05) flags as critical-path.

## References
- Client pause: `src/hooks/use-pomodoro-cycle.ts:2107-2173`, `resolvePersistedCycleId` `:1987-2021`
- Server pause: `src/server/api/routers/cycle.ts:352-412`
- Quarantined e2e: `e2e/session-closure.spec.ts` (`test.fixme` "pause via timer then end session closes session")
- Discovered during: `context/changes/fix-pause-decouple-end-session/` (Phase 2)
- Suspected regressions: #200, #201
