---
change_id: fix-pause-decouple-end-session
kind: bug
verdict: confirmed
reported: 2026-07-06
---

# Bug: "Pause" button also forces an end-session popup

## Symptom
The control labeled **"Wstrzymaj i zakończ sesję"** (Pause & end session) does more than
pause — after pausing it immediately opens the end-session confirmation popup. The user
wants a plain **"Wstrzymaj"** (Pause) that only pauses, with the end-session popup removed
from this action entirely. A separate **"Zakończ sesję"** button already sits directly below
for ending the session.

## Trigger
During an active, running session, clicking the "Wstrzymaj i zakończ sesję" button (shown
only while `state === "running"`).

## Expected
The button pauses the timer and nothing else — no end-session confirmation overlay. Ending
the session stays exclusively with the existing "Zakończ sesję" button below.

## Confirmation
**Verdict:** confirmed

Code path from trigger to symptom:

- The button is rendered while running, labeled from message key `dashboard.pauseEndSession`
  = "Wstrzymaj i zakończ sesję" — `src/app/_components/pomodoro-dashboard.tsx:1330-1340`
  (label `messages/pl.json:115`).
- Its handler `handlePauseAndEndSessionClick` pauses, then **opens the end-session
  confirmation overlay** with the `"after-pause"` variant —
  `src/app/_components/pomodoro-dashboard.tsx:322-328`:
  ```
  await pomodoro.pause();
  setEndSessionConfirmVariant("after-pause");
  setEndSessionConfirmOpen(true);
  ```
- That flag drives `EndSessionConfirmOverlay` —
  `src/app/_components/pomodoro-dashboard.tsx:1318-1326`.
- A separate "Zakończ sesję" button (key `dashboard.endSession`, `messages/pl.json:116`)
  already handles ending via `handleEndSessionClick` —
  `src/app/_components/pomodoro-dashboard.tsx:1341-1349` and `:310-320`.
- A resume path exists (`onResume={pomodoro.resume}` —
  `src/app/_components/pomodoro-dashboard.tsx:858`), so a pause-only action is not a dead-end.

This is a refinement of the shipped pause-and-end feature (archived
`context/archive/2026-06-23-pause-and-end-session/`, roadmap B-09), not a duplicate — that
change introduced the coupled behavior; this one decouples pause from end.

## Suspected cause
`handlePauseAndEndSessionClick` couples pause with opening the end-session overlay —
`src/app/_components/pomodoro-dashboard.tsx:322-328`. The fix likely: make the handler call
only `pomodoro.pause()` (drop `setEndSessionConfirmVariant`/`setEndSessionConfirmOpen`),
and relabel the button via the `dashboard.pauseEndSession` message (→ reuse "Wstrzymaj",
cf. `messages/pl.json:115` / aria key `pauseAria` at `messages/pl.json:338`). Confirm the
`"after-pause"` overlay variant is still reachable from the "Zakończ sesję" button while
paused (`handleEndSessionClick`, `:310-320`) so the pause-then-end path is preserved.
