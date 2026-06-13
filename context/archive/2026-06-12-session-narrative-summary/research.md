---
date: 2026-06-12T16:35:00+00:00
researcher: Auto (10x-ship-slice-flat S4)
git_commit: 9176fa1abac35cb16954986b46a79fdb3b1ce10f
branch: features/session-narrative-summary
repository: FlowState
topic: "S-17 session narrative — lifecycle hooks, resume note composition, overlay placement"
tags: [research, session, narrative, S-17, resumeNote, overlay-shell]
status: complete
last_updated: 2026-06-12
last_updated_by: Auto
---

# Research: S-17 session narrative summary

**Date**: 2026-06-12  
**Researcher**: Auto  
**Git Commit**: `9176fa1abac35cb16954986b46a79fdb3b1ce10f`  
**Branch**: `features/session-narrative-summary`  
**Repository**: FlowState

## Research Question

Where and how should in-flow session summary, session-end closure, and 8h return handoff be implemented — composing S-18 `Task.resumeNote` without stacking interstitials on wedge transition beats?

## Summary

S-17 is greenfield UI + a pure narrative builder module. Session lifecycle (`getOrCreateActive`, `session.end`, 4h timeout) exists; **no post-end closure or 8h handoff** exists today. S-18 `Task.resumeNote` is shipped and ready for handoff composition. Overlay patterns from S-12/S-16/S-22/S-19 define strict mutual-exclusion guards in `pomodoro-dashboard.tsx` — in-flow summary must be an inline strip (like override ack), closure a dismissible `overlay-shell` gate after `endSession()`, and 8h handoff a shell-level banner (like `FirstRunOverlay`). Schema needs `Cycle.intention` (~80 chars); optional `Session.closureLine` for persisted closure at return.

## Detailed Findings

### Session lifecycle & end paths

- **Create**: `findOrCreateActiveSession` (`src/server/api/lib/active-session.ts:9-44`); client via `use-pomodoro-cycle.ts:1217-1229`.
- **User end**: `end-session-btn` → `endSession()` → `session.end` sets `ENDED_BY_USER` (`session.ts:39-72`); **immediate client reset, no closure UI** (`use-pomodoro-cycle.ts:1868-1917`).
- **Wind-down pre-end**: S-16 `WindDownOverlay` → `onWindDownEndSession` (`wind-down-overlay.tsx`, `use-pomodoro-cycle.ts:1955-1974`); auth-only.
- **4h timeout**: Server-side on `lastActivityAt` (`active-session.ts:7,25-31`); silent — new session on next API call; client resets `completedWorkCycles` when session id changes.

### Session context available vs gaps

| Input | Status | Location |
|-------|--------|----------|
| Cycles completed | **Exists** | `cycle.countCompletedWork` (`cycle.ts:24-35`); client `completedWorkCycles` |
| Latest check-in energy | **Gap** | Per-cycle in suggestion path only; no `latestCheckInForSession` |
| Tasks completed this session | **Gap** | No session-scoped count; infer from WORK cycles + task status |
| Interruption count | **Exists** | `Session.interruptionCount` |
| Session endedAt | **Exists** | Prisma + guest `endedAt` |
| Resume note | **Exists (S-18)** | `Task.resumeNote` (`schema.prisma:74`) |

### S-18 resume note (handoff input)

- Schema: `resumeNote VARCHAR(120)` on Task; clears on task complete (`task.ts:115-117`).
- Display: suggestion card (`task-suggestion-card.tsx:116-122`), focused task row (`task-list.tsx:467-476`).
- Capture: mid-cycle completion continue path only (`mid-cycle-completion-prompt.tsx`); not mid-cycle focus switch.
- Guest: `flowstate:guest-v1` blob (`guest/schema.ts:26`).

### Overlay & transition beat patterns

- **Primitive**: `overlay-shell.tsx` — `OverlayScrim` z 50/58/60, `OverlayCard` variants.
- **One interstitial + one gate per beat** (PRD + frame): override ack pattern (`pomodoro-dashboard.tsx:275-282`) for inline lines; gates mutually exclusive via `awaitingCheckIn`, `awaitingWindDown`, `isPostCheckInTransitioning`, `showSuggestionCard`.
- **TabReturnCatchUp**: non-modal top strip (`tab-return-catchup.tsx`); wraps first pending gate only.
- **Copy modules**: `wind-down-copy.ts`, `override-ack-copy.ts`, `catch-up/copy.ts` — S-17 should add `session-narrative-copy.ts` + pure builder.

### Schema migration needs

1. **`Cycle.intention`** — nullable `VarChar(80)`; wire through `cycle.create`, guest `guestCycleSchema`, domain types.
2. **Optional `Session.closureLine`** — persist rendered closure for 8h handoff composition (frame: compose closure + resume note).
3. **Handoff dismiss** — localStorage key (auth + guest); no DB column required.
4. **8h detection** — client-side: `Date.now() - endedAt > 8h`; new tRPC `session.getLastEnded` or use `session.list`.

## Code References

- `src/server/api/lib/active-session.ts:7-36` — 4h inactivity timeout
- `src/server/api/routers/session.ts:7-72` — list, getOrCreateActive, end
- `src/hooks/use-pomodoro-cycle.ts:1868-1917` — endSession (closure hook point)
- `src/app/_components/pomodoro-dashboard.tsx:90-94,275-282,390-410` — gate guards + overlay mounts
- `src/app/_components/overlay-shell.tsx:30-93` — shared overlay primitives
- `src/lib/session/wind-down-nudge.ts` — closest S-16 pattern for narrative evaluation
- `prisma/schema.prisma:90-128` — Session, Cycle models
- `context/archive/2026-06-12-task-resume-context-note/plan.md` — S-18 explicitly deferred S-17 handoff

## Architecture Insights

- **Phased delivery valid**: closure can ship before handoff; S-18 prerequisite met.
- **In-flow summary**: non-blocking strip between timer and suggestion; never when `showSuggestionCard` or any gate active.
- **Closure overlay**: after successful `endSession()`; z=58; same for user + timeout paths (frame decision).
- **8h handoff**: `home-shell.tsx` shell-level; resume note clause first, task title second, max two clauses.
- **Guest parity**: derive from guest blob; no `session.list` tRPC; guest lacks 4h timeout and wind-down today.

## Historical Context

- `context/changes/session-narrative-summary/frame.md` — locked product decisions for 7 roadmap unknowns.
- `context/archive/2026-06-12-task-resume-context-note/` — resume note field + wedge display; handoff deferred to S-17.
- Roadmap Open Q2: at most one interstitial + one gate per transition beat.

## Open Questions (for plan)

1. Store closure line on `Session` at end vs recompute at return?
2. Tasks-completed-in-session: count WORK cycles with completed task vs new audit field?
3. Timeout path closure: detect session id change on `getOrCreateActive` and show closure for ended session?
4. Guest wind-down absent — apply closure on guest `end()` only?

## Recommended extension points

| Phase | Location | Action |
|-------|----------|--------|
| A | `src/lib/session/narrative-builder.ts` (new) | Pure functions + copy module |
| A | `prisma/schema.prisma` | `Cycle.intention`, optional `Session.closureLine` |
| B | `pomodoro-dashboard.tsx` | In-flow summary strip with gate guards |
| B | New `session-closure-overlay.tsx` | Post-end dismissible overlay |
| B | `use-pomodoro-cycle.ts` `endSession` | Trigger closure before full reset |
| C | `home-shell.tsx` | 8h return handoff banner |
| C | `session.ts` tRPC | `getLastEnded` or extend list |
| D | `*.test.ts`, e2e | Builder unit tests; closure + handoff e2e |
