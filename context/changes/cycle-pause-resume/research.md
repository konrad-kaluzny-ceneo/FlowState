---
date: 2026-06-18T17:00:00+02:00
researcher: Cursor Agent
git_commit: 0a044c8cfb0c47224fb6c871bd8a2d0a5ba0632a
branch: features/cycle-pause-resume
repository: konrad-kaluzny-ceneo/FlowState
topic: "S-24 cycle pause/resume — PAUSED state, timer recovery, wedge gate suppression, pause cap"
tags: [research, S-24, cycle-pause-resume, US-04, pause, wedge-conductor, guest, prisma]
status: complete
last_updated: 2026-06-18
last_updated_by: Cursor Agent
---

# Research: S-24 Cycle pause and resume (US-04)

**Date**: 2026-06-18T17:00:00+02:00  
**Researcher**: Cursor Agent  
**Git Commit**: `0a044c8cfb0c47224fb6c871bd8a2d0a5ba0632a`  
**Branch**: features/cycle-pause-resume  
**Repository**: konrad-kaluzny-ceneo/FlowState

## Research Question

What must be built for S-24 (`cycle-pause-resume`): PAUSED cycle state, guest blob + refresh recovery, pause vs inactivity timeout semantics, wedge gate suppression (pol-12), and ~30 min pause cap calm session end (pol-8)?

## Summary

**Pause/resume is not implemented.** Today the product exposes only **Interrupt** (terminal `INTERRUPTED`, remaining time lost). S-24 requires a hybrid model: `CycleState.PAUSED` + `pausedAt` + `remainingDurationSec`, distinct from `INTERRUPTED`, with no `interruptionCount` increment.

**Product rules are resolved** (PRD v3 US-04, event storming 2026-06-18):

- Pause does **not** extend the 4h session inactivity timeout (FR-019).
- Separate **~30 min pause cap** → calm session end with closure (pol-8).
- While PAUSED, **all wedge gates suppressed** (pol-12) — conductor + surfaces outside conductor.
- Pause ≠ Interrupt ≠ Rebind — four distinct mid-cycle intents (`user-flow.md` §4).

**Implementation order** (highest leverage):

1. Schema/types — Prisma enum + Cycle fields; guest schema mirror; domain types + repository interface
2. tRPC + guest repos — `pause`/`resume` mutations; extend `getActive` to return RUNNING **or** PAUSED
3. Hook — `pause()`/`resume()` callbacks; `"paused"` state; `cycleEndTimeMs` branch; refresh recovery without worker
4. UI — Pause/Resume in `timer-panel.tsx` (Interrupt stays separate)
5. Conductor + dashboard — `cyclePaused` input; suppress suggestion cards and catch-up while paused
6. Pause cap timer — wall-clock from `pausedAt`; reuse `endSession` + closure overlay pattern

**Confidence for planning:** 85% — product unknowns resolved; implementer choice remains server-side PAUSED persistence vs client-only freeze (recommend server-side for refresh recovery parity).

---

## Detailed Findings

### Current cycle state model

Prisma `CycleState` has three values only — no `PAUSED`:

```30:34:prisma/schema.prisma
enum CycleState {
  RUNNING
  COMPLETED
  INTERRUPTED
}
```

Cycle model has no `pausedAt` or `remainingDurationSec` (`prisma/schema.prisma:110-120`). Guest schema mirrors the same three states (`src/lib/guest/schema.ts:86-94`).

Client hook state is `"idle" | "running" | "completed"` only (`src/hooks/use-pomodoro-cycle.ts:102`). No pause handlers exist.

### Timer and refresh recovery

Running timer uses **absolute end time**: `startedAt + configuredDurationSec` via `cycleEndTimeMs()` (`use-pomodoro-cycle.ts:90-98`). Worker ticks every 1s; Page Visibility recalculates on tab return (`:841-864`, `:569-586`).

On mount, `recoverActiveCycle()` (`:693-751`) calls `cycles.getActive()` and `resumeFromActiveCycle()` (`:588-623`). Only `RUNNING` cycles recover today — auth `cycle.getActive` queries `state: "RUNNING"` only (`src/server/api/routers/cycle.ts:66-74`).

**Pause fits existing architecture:** pause = stop worker + persist remaining; resume = new `endTime = now + remainingDurationSec` — same pattern as visibility recalc.

### Interrupt vs pause (today)

`cycle.interrupt` (`cycle.ts:297-338`) transitions RUNNING → INTERRUPTED + `endedAt` — terminal. Does **not** increment `interruptionCount`.

Hook `interrupt()` (`use-pomodoro-cycle.ts:1562-1645`) stops worker, calls server, rolls back on failure (auth optimistic pattern).

`interruptionCount` increments only on `cycle.complete` with `incrementInterruption: true` (`cycle.ts:209-211`) and `cycle.rebindTask` (`cycle.ts:288`).

### Session inactivity (4h) vs pause cap

Auth 4h timeout: `SESSION_INACTIVITY_TIMEOUT_MS` in `src/server/api/lib/active-session.ts:7-37`. Triggered on `findOrCreateActiveSession` when creating cycles/sessions. Pause must **not** bump `lastActivityAt` in ways that extend idle timeout — S-24 treats these as orthogonal policies.

Guest has **no** 4h timeout (`guest-repositories.ts:270-314`).

Pause cap (~30 min) has **no code** yet. Closest pattern: `maybePresentTimeoutClosure` (`use-pomodoro-cycle.ts:647-691`) + `endSession` (`:2144-2205`) + `buildClosureLine` (`narrative-builder.ts:92-103`). Likely needs new `endedBy` variant for pause-cap closure copy.

**Gap:** 4h timeout ends session but does not mark orphaned RUNNING cycles INTERRUPTED — stale cycle could resume after idle until cleared.

### Wedge gate suppression (pol-12)

F-07 conductor (`src/lib/wedge/transition-conductor.ts`) resolves one active gate via priority matrix. Suppression today uses boolean flags (`returnHandoffGateOpen`, `isPostCheckInTransitioning`, `awaitingCheckIn`, etc.) — **no `cyclePaused` input**.

Surfaces **outside** conductor must also suppress while paused:

- Break/idle `TaskSuggestionCard` (`pomodoro-dashboard.tsx:93-104`)
- Tab catch-up banners (`:163-180`)
- In-flow summary (`use-pomodoro-cycle.ts:2293-2324`)
- `deriveCatchUpGate` (`src/lib/wedge/derive-gate.ts:16-41`)

Domain sketch already exists: L9 oracle in `context/domain/02-invariant-aggregate-refactor.md:523` — `CycleState.PAUSED` → all gates in `suppressed`.

### Guest persistence and merge

Guest cycles in `localStorage` key `flowstate:guest-v1` (`src/lib/guest/store.ts`). Operations mirror auth: create/complete/interrupt/rebind in `guest-repositories.ts`.

`import-guest-snapshot.ts:114-127` expires stale RUNNING cycles on merge — must handle PAUSED import + cap logic.

---

## Extension points (implementation map)

| Layer | File | Change |
|-------|------|--------|
| Prisma | `prisma/schema.prisma` | Add `PAUSED`; `pausedAt`, `remainingDurationSec` on Cycle |
| Guest schema | `src/lib/guest/schema.ts` | Mirror enum + fields |
| Domain types | `src/lib/data-mode/types.ts` | Extend `DomainActiveCycle.state`; add repo methods |
| tRPC | `src/server/api/routers/cycle.ts` | `pause`, `resume`; extend `getActive`, `create` mutex |
| Guest repo | `src/lib/guest/guest-repositories.ts` | `pause`/`resume`; extend `getActive` |
| Server repo | `src/lib/repositories/server-repositories.ts` | Wire new mutations |
| Hook | `src/hooks/use-pomodoro-cycle.ts` | `pause`/`resume`; `"paused"` state; recovery branches |
| Conductor | `src/lib/wedge/transition-conductor.ts` | `cyclePaused` → all gates false |
| Dashboard | `src/app/_components/pomodoro-dashboard.tsx` | Pass paused; guard suggestion cards |
| UI | `src/app/_components/timer-panel.tsx` | Pause/Resume buttons |
| Tests | `use-pomodoro-cycle.test.tsx`, `transition-conductor.test.ts` | PAUSED hydrate, gate oracle, cap |

---

## Code References

- `prisma/schema.prisma:30-34` — CycleState enum (no PAUSED)
- `prisma/schema.prisma:110-120` — Cycle model fields
- `src/server/api/routers/cycle.ts:66-75` — getActive (RUNNING only)
- `src/server/api/routers/cycle.ts:297-338` — interrupt (terminal)
- `src/hooks/use-pomodoro-cycle.ts:90-98` — cycleEndTimeMs
- `src/hooks/use-pomodoro-cycle.ts:588-623` — resumeFromActiveCycle
- `src/hooks/use-pomodoro-cycle.ts:693-751` — recoverActiveCycle
- `src/hooks/use-pomodoro-cycle.ts:1562-1645` — interrupt flow (rollback pattern for pause)
- `src/server/api/lib/active-session.ts:7-37` — 4h session timeout
- `src/lib/wedge/transition-conductor.ts:59-109` — gate priority + suppression
- `src/app/_components/pomodoro-dashboard.tsx:93-104` — suggestion cards outside conductor
- `src/app/_components/timer-panel.tsx:121-127` — Interrupt button only today
- `src/lib/guest/schema.ts:86-94` — guest cycle state enum
- `src/lib/guest/guest-repositories.ts:361-468` — guest cycle CRUD

---

## Architecture Insights

1. **End-time model** — Pause/resume extends the existing absolute-end-time pattern; no need to rewrite the worker.
2. **Repository abstraction** — Auth and guest share `CycleRepository`; both need pause/resume for parity.
3. **Optimistic UI** — Mirror B-03 / interrupt rollback pattern for auth pause/resume (200ms NFR per L-04).
4. **Conductor boundary** — pol-12 requires dashboard-level guards for non-conductor surfaces (suggestion cards, catch-up).
5. **F-07 prerequisite satisfied** — Conductor is shipped; S-24 adds `cyclePaused` as a new suppression dimension.

---

## Historical Context

- `context/foundation/roadmap-references/items/S-24.md` — canonical slice spec; status ready; pol-8, pol-12, hybrid model
- `context/foundation/prd.md` — US-04 acceptance; ~30 min cap; pause excluded from interruption count
- `context/foundation/user-flow.md:140-149` — four mid-cycle intents table
- `context/domain/04-event-storming.md:108-145` — pol-8, pol-12, domain events
- `context/domain/02-invariant-aggregate-refactor.md:523` — L9 gate oracle for PAUSED
- `context/archive/` — no prior pause implementation; F-07 explicitly deferred pause to S-24
- `context/changes/cycle-pause-resume/change.md` — change opened 2026-06-18

---

## PRD acceptance mapping

| Criterion | Implementation anchor |
|-----------|----------------------|
| Pause/resume preserves remaining time | `remainingDurationSec` + hook end-time recalc |
| Pause does not increment interruptionCount | No wire to increment paths in pause/resume |
| ~30 min cap → calm session end | New cap timer + `endSession` + closure overlay |
| Refresh recovery while paused | `getActive` returns PAUSED; hydrate without worker |
| Wedge gates suppressed while PAUSED | Conductor + dashboard guards (pol-12) |
| Distinct from Interrupt | Separate UI + `PAUSED` vs `INTERRUPTED` state |

---

## Open Questions (for /10x-plan)

1. **Server-side PAUSED persistence** — Recommend yes (Prisma + guest blob) for refresh/tab-close recovery. Client-only freeze insufficient for auth path.
2. **Exact pause cap** — Default 30 min (`30 * 60 * 1000` ms constant); tunable via env or constant (not user-facing in v1).
3. **Pause cap closure copy** — New `endedBy: "pause_cap"` variant in `buildClosureLine` vs reuse `"timeout"`.
4. **Guest 4h timeout** — No guest idle timeout today; document as auth-only or add parity (recommend document-only for v1).
5. **Stale RUNNING after 4h session timeout** — Out of S-24 scope but note as pre-existing gap; pause cap path should end session cleanly.
6. **B-08 full variant** — Deferred until S-24 ships; minimal B-08 can ship after pause exists.

---

## Recommended plan phases (preview)

1. **Schema + migration** — PAUSED enum, fields, guest mirror, `pnpm prisma migrate dev`
2. **Server + guest repos** — pause/resume/getActive; unit tests on cycle router
3. **Hook pause/resume** — state machine, worker stop/start, refresh recovery
4. **Conductor + dashboard** — pol-12 suppression everywhere
5. **Timer UI** — Pause/Resume vs Interrupt
6. **Pause cap** — pol-8 timer + calm session end
7. **E2E belt** — pause/resume smoke; cap path `@skip-belt` if slow
