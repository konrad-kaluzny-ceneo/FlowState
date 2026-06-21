---
date: 2026-06-21T12:45:00+00:00
researcher: ship-slice-orchestrator
git_commit: 91d56955f8b6bd61344a3975b44e29a0363e85d8
branch: features/fix-graceful-session-end-while-running
repository: FlowState
topic: "B-08 graceful session end while timer running (T-04)"
tags: [research, B-08, T-04, end-session, US-04]
status: complete
last_updated: 2026-06-21
last_updated_by: ship-slice-orchestrator
---

# Research: B-08 graceful session end while timer running

**Date**: 2026-06-21  
**Researcher**: ship-slice-orchestrator  
**Git Commit**: 91d56955f8b6bd61344a3975b44e29a0363e85d8  
**Branch**: features/fix-graceful-session-end-while-running  
**Repository**: FlowState

## Research Question

What must change so users can end a session calmly while a work or break cycle is running (T-04 / B-08 minimal variant)?

## Summary

The bug is **UI-only**: `endSession()` in the hook already interrupts a running or paused cycle and ends the session server-side. The dashboard disables the End session button when `state === "running"`, forcing users through Interrupt first. Fix: enable the button during running/paused, add a confirm overlay (reuse `OverlayScrim` pattern), then call existing `endSession()`. No backend or hook changes required for minimal scope. Belt e2e currently masks T-04 by interrupting before end session.

## Detailed Findings

### Dashboard disable guard (root cause)

- `pomodoro-dashboard.tsx:650` — `disabled={pomodoro.state === "running"}` on `end-session-btn`.
- Button renders only when `hasActiveSession` (`:646`).
- When paused, button is already enabled (only `running` is disabled).

### Hook already supports end while running

- `use-pomodoro-cycle.ts:3082–3190` — `endSession()`:
  - If `state === "running"`: `stopWorker()`, best-effort `cycles.interrupt`, then `sessions.end`.
  - If `state === "paused"`: interrupt paused cycle without incrementing interruption count.
  - Presents closure overlay via `presentClosureOverlay`.
- Vitest oracle exists: `"endSession interrupts running cycle before ending session"` (`use-pomodoro-cycle.test.tsx:1487`).

### User-flow / roadmap intent

- `user-flow.md` T-04 documents intentional disable but notes user frustration at end of day.
- `flow-coherence-recommendations.md` B-08: minimal = confirm → interrupt → closure (skip break); full = pause-then-end after S-24.
- Prerequisites F-07 and S-24 are **done** — minimal variant is unblocked.

### Existing overlay / confirm patterns

- `WindDownOverlay`, `SessionClosureOverlay`, `break-alerts-permission-prompt` use `OverlayScrim` + `OverlayCard` from `overlay-shell.tsx`.
- No shared AlertDialog primitive — new small confirm overlay fits existing craft.

### E2E coverage gap

- `e2e/session-closure.spec.ts:37–43` interrupts cycle before clicking end session — documents current workaround, not T-04 fix.
- `e2e/helpers/idle-cycle.ts:122–124` skips end session when disabled.

## Code References

- `src/app/_components/pomodoro-dashboard.tsx:646-655` — End session button + disable guard
- `src/hooks/use-pomodoro-cycle.ts:3082-3190` — `endSession` interrupt + closure path
- `src/app/_components/overlay-shell.tsx` — OverlayScrim/OverlayCard primitives
- `e2e/session-closure.spec.ts:27-58` — closure belt spec (interrupt-first)
- `context/foundation/user-flow.md:283-285` — T-04 definition

## Architecture Insights

- B-08 minimal stays in dashboard layer; hook contract unchanged.
- Confirm overlay must not stack with F-07 wedge gates — render only on explicit End session click; dismiss on cancel. No new conductor beat.
- `isConfirming` from hook can disable confirm buttons during async end (mirror wind-down overlay).

## Historical Context

- `context/archive/2026-06-18-cycle-pause-resume/plan.md` — deferred B-08 full (pause-then-end) until S-24; S-24 now shipped.
- `context/archive/2026-06-17-fix-closure-kickoff-mutex/` — closure mutex patterns; end session while running must still present single closure overlay without kickoff stacking (existing guards).

## Related Research

- `context/archive/2026-06-18-cycle-pause-resume/research.md` — pause cap + endSession integration

## Open Questions

1. **Confirm on paused only vs running+paused?** Recommend both for consistent destructive-action UX (confidence 85%).
2. **Full pause-then-end variant?** Out of minimal scope — separate follow-up if product wants explicit pause path before end (OQ3).
