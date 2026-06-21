# Plan brief: Graceful session end while running (B-08)

**Change ID:** `fix-graceful-session-end-while-running`  
**Roadmap:** B-08 | FLO-70 | #113  
**PRD:** US-04 — user control over session lifecycle without opaque disabled controls

## Goal

Let users end an active session while a work or break timer is **running** or **paused**, via a calm confirm step — without forcing Interrupt first.

## Approach

- UI-only minimal fix: remove running disable guard; add skippable confirm overlay (`OverlayScrim` pattern); call existing `endSession()`.
- Hook and API unchanged — interrupt + closure already implemented.
- Extend belt e2e to end session **without** pre-interrupt.

## Out of scope

- Full **Pause & end session** dual-action variant → roadmap **B-09** (`pause-and-end-session`)
- Mid-cycle closure expectations / partial-effort copy → roadmap **S-38** (`session-end-mid-cycle-closure`); see OQ #7
- New F-07 conductor beat
- Guest-specific copy matrix changes
- Session timeout / pause-cap behavior changes

## Phases

1. Copy module + confirm overlay component (TDD)
2. Dashboard wiring + component tests
3. Belt e2e — end session while running shows closure

## Confidence

90% — narrow UI slice; hook oracle exists; main risk is wedge overlay stacking on confirm dismiss (mitigated: confirm is user-initiated, short-lived).
