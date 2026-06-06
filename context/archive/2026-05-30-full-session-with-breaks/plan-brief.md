# Full Session with Breaks — Plan Brief

> Full plan: `context/changes/full-session-with-breaks/plan.md`

## What & Why

Extend the working single-cycle Pomodoro (S-01) into a full multi-cycle session with automatic short/long breaks, configurable break durations, explicit session end, and a 4-hour inactivity timeout. This is the next step on the north-star path — without sessions, the product is a one-shot timer rather than a Pomodoro system.

## Starting Point

S-01 is shipped: a user can pick a task, run one configurable work cycle, hear the audio prompt, and confirm the transition. The schema already defines `CycleKind` (WORK/SHORT_BREAK/LONG_BREAK) and `SessionState` (ACTIVE/ENDED_BY_USER/ENDED_BY_TIMEOUT), but neither is wired — the client hardcodes `kind: "WORK"` and resets to idle after every cycle. No session-end logic exists.

## Desired End State

A user runs a full Pomodoro session: work cycles separated by auto-started short breaks, with a long break every 4 cycles. Break durations are configurable (1–30 min). The user can end the session at any time via a persistent button. Stale sessions (>4h no cycle activity) are automatically closed on next interaction. The break timer reuses the existing Web Worker infrastructure and recovers on refresh.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Break transition trigger | Auto-start after work cycle confirm | Minimal friction — user already confirmed, a second "start break" tap adds no value |
| Break duration storage | localStorage (same as work duration) | Consistent with existing pattern; no migration needed; single-user MVP |
| Inactivity timeout mechanism | Server-side check on next activity | No background job; works even if browser closed; simple and reliable |
| Activity definition for timeout | Starting or completing a cycle | Matches PRD §FR-019 "no cycle started" language exactly |
| Break UI | Reuse TimerPanel with break color scheme | Minimal new UI; visually distinct via calming blue/teal styling |
| Break-end transition | Audio chime + full overlay (same as work end) | Consistent UX pattern; mindful transition point preserved |
| Cycle counter for long break | Count COMPLETED WORK cycles in active session (DB query) | Server-authoritative; survives refresh; no new state to store |
| End session UX | Persistent button visible during active session | Discoverable; always accessible; matches FR-019 language |

## Scope

**In scope:**
- Auto-start short break after work cycle confirmation
- Long break after every 4th work cycle
- Configurable short/long break durations (localStorage, 1–30 min)
- Break timer with distinct visual styling
- Break-end audio chime + overlay prompt
- "End session" button (ends session, resets UI)
- 4h inactivity timeout (server-side, checked on next activity)
- `lastActivityAt` updates on cycle create/complete/interrupt
- Guest mode support for all above

**Out of scope:**
- End-of-cycle check-in (S-05)
- Task suggestion after break (S-06)
- Mid-cycle task completion prompt (S-03)
- Configurable "cycles before long break" count (hardcoded to 4)
- Real-time timeout notification (no client-side polling)
- Session history UI

## Architecture / Approach

Bottom-up layering: server mutations first (session end + lastActivityAt + inactivity check), then break config storage, then the client state machine (work→break→work transitions in `usePomodoroCycle`), and finally session-end UI. The existing Web Worker timer handles break cycles identically to work cycles — it only cares about `startedAt + configuredDurationSec`. No schema migration needed; all enums/fields exist from F-01.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Server: session lifecycle + lastActivityAt | `session.end` mutation, `lastActivityAt` updates, inactivity auto-close | Inactivity check edge case: session ended between cycle complete and break start |
| 2. Break duration config | localStorage getters/setters + UI controls in timer panel | None — straightforward extension of existing pattern |
| 3. Client: break transition state machine | Auto-start breaks, cycle counting, break-end overlay, break styling | State machine complexity — work→break→work transitions must not break recovery |
| 4. Session end UI + timeout | "End session" button, `endSession()` action, clean timeout handling | Interrupt-then-end sequencing if cycle is running when user clicks end |

**Prerequisites:** S-01 shipped (done), F-01 schema in place (done), F-02 e2e infra available (done)
**Estimated effort:** ~2-3 sessions across 4 phases

## Open Risks & Assumptions

- The inactivity check runs inside `findOrCreateActiveSession`, which is called on cycle start. If a user's session times out between completing a work cycle and the auto-started break cycle creation (same `confirmComplete` call), the break would land on a new session. Mitigation: the break creation passes the existing `sessionId` explicitly rather than relying on `findOrCreateActive`.
- Break auto-start creates two sequential mutations (complete work cycle + create break cycle). If the second fails, the user sees idle state instead of a break — acceptable degradation with an error message.

## Success Criteria (Summary)

- User completes a 4-cycle session with 3 short breaks and 1 long break, all with correct configured durations
- "End session" cleanly resets the UI and marks the session as ended in the DB
- A session inactive for >4h is automatically ended on next interaction, and a new session starts
