# Cycle Pause and Resume (S-24) Implementation Plan

## Overview

Ship PRD v3 US-04: users can pause a running work or break cycle and resume with remaining time preserved — distinct from Interrupt, excluded from `interruptionCount`, with wedge gates suppressed while PAUSED (pol-12) and a ~30 min pause cap that calmly ends the session (pol-8).

## Current State Analysis

Pause/resume is not implemented. `CycleState` has only `RUNNING | COMPLETED | INTERRUPTED`; the hook state is `"idle" | "running" | "completed"`. UI exposes only Interrupt (terminal). F-07 conductor is shipped but has no `cyclePaused` input. `getActive` queries `RUNNING` only on auth and guest paths.

### Key Discoveries

- End-time timer model (`cycleEndTimeMs`) already supports pause = stop worker + persist remaining; resume = `now + remainingDurationSec` (`use-pomodoro-cycle.ts:90-98`).
- Interrupt rollback pattern (B-03) is the oracle for optimistic auth pause/resume (L-04).
- Conductor suppression requires dashboard guards for non-conductor surfaces (suggestion cards, catch-up) per research.
- Guest has no 4h idle timeout; pause cap is orthogonal to session inactivity policy.

## Desired End State

1. User taps Pause on a running cycle → timer freezes, remaining time preserved, cycle persisted as `PAUSED`.
2. User taps Resume → timer continues from preserved remaining; no wedge overlays while paused.
3. Refresh while paused → same remaining time and paused UI without worker drift.
4. Pause >30 min → calm session end with closure line (`endedBy: "pause_cap"`).
5. Interrupt remains separate (terminal `INTERRUPTED`); pause never increments `interruptionCount`.
6. Belt e2e smoke covers pause/resume; cap path in full catalog (`@skip-belt`).

### Verification

- `pnpm test` green; `set CI=true && pnpm test:e2e:belt` green.
- Manual: pause during break suggestion window → no suggestion card; resume → timer correct.

## What We're NOT Doing

- B-08 full variant (pause-then-end session) — ships after S-24.
- Guest 4h session idle timeout parity — auth-only policy documented.
- Fixing stale RUNNING cycles after 4h session timeout — pre-existing gap.
- Hook decomposition (K1 refactor) — separate change.
- User-facing pause cap configuration — constant only in v1.

## Implementation Approach

Hybrid model from event storming: domain events + `CycleState.PAUSED` + `pausedAt` + `remainingDurationSec` in Prisma and guest blob. Server-side persistence for refresh/tab-close recovery on both auth and guest paths. Layer order: schema → repos → hook → conductor/dashboard → UI → cap timer → e2e.

## Critical Implementation Details

**Mutex:** `cycle.create` and running-cycle guards must treat `PAUSED` as an active cycle (block new create; allow pause only from `RUNNING`, resume only from `PAUSED`). `getActive` returns the latest `RUNNING` **or** `PAUSED` cycle.

**Activity timestamp:** `pause`/`resume` may update `lastActivityAt` for normal UX signals, but pause duration must **not** reset or extend the 4h session inactivity clock — cap is a separate wall-clock timer from `pausedAt`.

**Recovery:** On mount, if `getActive` returns `PAUSED`, hydrate hook to `"paused"` state with frozen `remainingMs` from `remainingDurationSec`; do **not** start the 1s worker until resume.

---

## Phase 1: Schema and domain types

### Overview

Add `PAUSED` to Prisma and guest schemas; extend domain types and repository interface.

### Changes Required

#### 1. Prisma schema

**File**: `prisma/schema.prisma`

**Intent**: Add `PAUSED` to `CycleState`; add optional `pausedAt DateTime?` and `remainingDurationSec Int?` on `Cycle`.

**Contract**: Migration via `pnpm prisma migrate dev` only. `@@map("flow_state_cycle")` unchanged.

#### 2. Guest schema mirror

**File**: `src/lib/guest/schema.ts`

**Intent**: Mirror enum and fields on guest cycle shape; bump validation if versioned.

**Contract**: Guest cycle `state` accepts `PAUSED`; `pausedAt` ISO string or null; `remainingDurationSec` number or null.

#### 3. Domain types and repository interface

**File**: `src/lib/data-mode/types.ts`

**Intent**: Extend `DomainActiveCycle.state` with `PAUSED`; add `pausedAt`, `remainingDurationSec`; add `pause` and `resume` to `CycleRepository`.

**Contract**:

```ts
pause(input: { cycleId: DomainTaskId; remainingDurationSec: number }): Promise<DomainActiveCycle>;
resume(input: { cycleId: DomainTaskId }): Promise<DomainActiveCycle>;
```

#### 4. Pause cap constant

**File**: `src/lib/pause-cap.ts` (new)

**Intent**: Single source for cap duration used by hook and tests.

**Contract**: `export const PAUSE_CAP_MS = 30 * 60 * 1000;`

### Success Criteria

#### Automated Verification

- Migration applies cleanly: `pnpm prisma migrate dev`
- `pnpm check` passes
- `pnpm typecheck` passes

#### Manual Verification

- Prisma Studio shows `PAUSED` enum value on Cycle rows after manual seed (optional)

**Implementation Note**: After automated verification passes, confirm migration name is committed before Phase 2.

---

## Phase 2: Server and guest repositories

### Overview

Implement `pause`/`resume` mutations; extend `getActive` and create mutex for PAUSED cycles.

### Changes Required

#### 1. tRPC cycle router

**File**: `src/server/api/routers/cycle.ts`

**Intent**: Add `pause` (RUNNING → PAUSED, set `pausedAt`, `remainingDurationSec`, clear running end semantics) and `resume` (PAUSED → RUNNING, clear pause fields, set fresh `startedAt` anchor for end-time math). Extend `getActive` to `state: { in: ["RUNNING", "PAUSED"] }`. Extend `create` mutex to reject when PAUSED exists.

**Contract**: `pause` does not increment `interruptionCount`. `resume` rejects non-PAUSED cycles with `BAD_REQUEST`. Extend `cycle.test.ts` mock `CycleRecord` state union and `findCycle` to support `state: { in: [...] }` queries.

#### 2. Guest cycle repository

**File**: `src/lib/guest/guest-repositories.ts`

**Intent**: Mirror auth pause/resume/getActive semantics in localStorage blob.

**Contract**: Same state transitions; `remainingDurationSec` persisted on pause.

#### 3. Server repository wiring

**File**: `src/lib/repositories/server-repositories.ts`

**Intent**: Wire new tRPC mutations into `CycleRepository` implementation.

**Contract**: Parity with guest method signatures from `types.ts`.

#### 4. Guest import on merge

**File**: `src/server/api/lib/import-guest-snapshot.ts`

**Intent**: Handle PAUSED cycles on merge — import as PAUSED or expire per existing stale-RUNNING policy (align with RUNNING handling).

**Contract**: No silent data loss; PAUSED cycles survive merge when within cap. Extend `src/server/api/lib/import-guest-snapshot.test.ts` if merge paths change.

#### 5. Router unit tests

**File**: `src/server/api/routers/cycle.test.ts` (extend or new co-located)

**Intent**: Cover pause/resume happy path, wrong-state errors, getActive returns PAUSED, create blocked when PAUSED.

**Contract**: Dual-user isolation unchanged; ownership checks on pause/resume.

### Success Criteria

#### Automated Verification

- `pnpm exec vitest run src/server/api/routers/cycle.test.ts` passes (or equivalent path)
- `pnpm test` passes
- `pnpm check` passes

---

## Phase 3: Hook pause/resume and recovery

### Overview

Extend pomodoro hook state machine; optimistic pause/resume with rollback; refresh recovery for PAUSED.

### Changes Required

#### 1. Hook state and callbacks

**File**: `src/hooks/use-pomodoro-cycle.ts`

**Intent**: Add `"paused"` to `PomodoroCycleState`; expose `pause()` and `resume()`; stop worker on pause; on resume recalc `cycleEndTimeMs` from `remainingDurationSec`; mirror interrupt optimistic rollback for auth.

**Contract**: `interruptionCount` never incremented on pause/resume. Export `isPaused` or derive from `state === "paused"` for dashboard.

#### 2. Recovery branches

**File**: `src/hooks/use-pomodoro-cycle.ts`

**Intent**: `recoverActiveCycle` / `resumeFromActiveCycle` handle `PAUSED` — hydrate frozen remaining, no worker until resume.

**Contract**: Remaining within ±2s NFR after refresh (use stored `remainingDurationSec`, not elapsed wall clock).

#### 3. Hook tests

**File**: `src/hooks/use-pomodoro-cycle.test.tsx`

**Intent**: Pause freezes remaining; resume restores countdown; refresh hydrate PAUSED; rollback on failed pause mutation.

**Contract**: Deferred-mock pattern per test-plan risk #10.

### Success Criteria

#### Automated Verification

- `pnpm exec vitest run src/hooks/use-pomodoro-cycle.test.tsx` passes
- `pnpm test` passes

#### Manual Verification

- Local dev: pause → wait 5s → remaining unchanged; refresh → still paused with same remaining

---

## Phase 4: Wedge gate suppression (pol-12)

### Overview

Suppress all wedge gates and non-conductor surfaces while cycle is paused.

### Changes Required

#### 1. Conductor input

**File**: `src/lib/wedge/transition-conductor.ts`

**Intent**: Add `cyclePaused: boolean` to `WedgeConductorInput` and `KickoffEligibilityInput`; when true, all gate candidates false (L9 oracle).

**Contract**: Priority matrix unchanged; paused is a global suppressor above all gates.

#### 2. Conductor tests

**File**: `src/lib/wedge/transition-conductor.test.ts`

**Intent**: Assert every gate suppressed when `cyclePaused: true`; kickoff ineligible when paused.

**Contract**: Table-driven cases for each gate type.

#### 3. Catch-up derivation

**File**: `src/lib/wedge/derive-gate.ts`

**Intent**: Suppress catch-up banners while paused.

**Contract**: `deriveCatchUpGate` returns no gate when paused input present.

#### 4. Dashboard integration

**File**: `src/app/_components/pomodoro-dashboard.tsx`

**Intent**: Pass `cyclePaused` into `resolveWedgeBeat`; guard `showSuggestionCard`, `showKickoffCard`, catch-up UI when paused.

**Contract**: Preserve existing `data-testid` contracts; no new overlays while paused.

#### 5. Hook wiring to conductor

**File**: `src/hooks/use-pomodoro-cycle.ts`

**Intent**: Suppress in-flow summary and internal gate flags while paused.

**Contract**: `awaitingCheckIn`, kickoff, suggestion paths blocked when `state === "paused"`.

#### 6. Dashboard tests

**File**: `src/app/_components/pomodoro-dashboard.test.tsx`

**Intent**: Suggestion card hidden when paused; resumes after resume.

### Success Criteria

#### Automated Verification

- `pnpm exec vitest run src/lib/wedge/transition-conductor.test.ts` passes
- `pnpm exec vitest run src/app/_components/pomodoro-dashboard.test.tsx` passes
- `pnpm test` passes

---

## Phase 5: Timer UI (Pause / Resume)

### Overview

Add Pause and Resume controls distinct from Interrupt; co-located component smoke per L-04.

### Changes Required

#### 1. Timer panel

**File**: `src/app/_components/timer-panel.tsx`

**Intent**: Running state: show Pause (primary) + Interrupt (secondary/destructive). New paused state section: frozen countdown + Resume button. Break cycles get same controls with break-appropriate labels.

**Contract**: `data-testid="timer-pause"`, `data-testid="timer-resume"`, `data-testid="timer-panel-paused"`. Props: `onPause`, `onResume`, `state` includes `"paused"`. Paused panel shows Resume only — hide Interrupt until running again.

#### 2. Dashboard wiring

**File**: `src/app/_components/pomodoro-dashboard.tsx`

**Intent**: Pass `pause`/`resume` handlers from hook to `TimerPanel`.

#### 3. Component tests

**File**: `src/app/_components/timer-panel.test.tsx` (new)

**Intent**: Smoke: running shows Pause; paused shows Resume and frozen time; Interrupt still present on running.

**Contract**: RTL render only; no e2e required for button visibility.

### Success Criteria

#### Automated Verification

- `pnpm exec vitest run src/app/_components/timer-panel.test.tsx` passes
- `pnpm check` passes

#### Manual Verification

- Pause/Resume on work and break cycles; Interrupt still ends cycle terminally

---

## Phase 6: Pause cap and calm session end (pol-8)

### Overview

Wall-clock cap from `pausedAt`; auto end session with closure overlay when exceeded.

### Changes Required

#### 1. Cap timer in hook

**File**: `src/hooks/use-pomodoro-cycle.ts`

**Intent**: While paused, schedule check against `pausedAt + PAUSE_CAP_MS`; on exceed call existing `endSession` path with pause-cap semantics.

**Contract**: Cap uses pause duration only, not session idle clock. No `interruptionCount` increment.

#### 2. Closure copy variant

**File**: `src/lib/session/narrative-builder.ts`

**Intent**: Extend `endedBy` union with `"pause_cap"`; copy distinct from `"timeout"` (calm, mentions pause).

**Contract**: `buildClosureLine` handles `"pause_cap"`; tests updated.

#### 3. Narrative tests

**File**: `src/lib/session/narrative-builder.test.ts`

**Intent**: Assert pause_cap closure string shape.

#### 4. Hook cap tests

**File**: `src/hooks/use-pomodoro-cycle.test.tsx`

**Intent**: Fake timers: paused past cap triggers session end and closure line; no interrupt increment.

### Success Criteria

#### Automated Verification

- `pnpm exec vitest run src/lib/session/narrative-builder.test.ts` passes
- `pnpm exec vitest run src/hooks/use-pomodoro-cycle.test.tsx` passes (cap cases)
- `pnpm test` passes

#### Manual Verification

- Dev: shorten `PAUSE_CAP_MS` temporarily to verify closure overlay (revert before commit)

---

## Phase 7: E2E belt smoke

### Overview

Browser proof for pause/resume happy path on belt; cap path in full catalog.

### Changes Required

#### 1. Belt spec

**File**: `e2e/cycle-pause-resume.spec.ts` (new)

**Intent**: Start work cycle → Pause → assert frozen countdown → Resume → assert countdown decreases. Assert no check-in/suggestion overlay while paused (pol-12 smoke).

**Contract**: Uses worker auth fixture; no `@skip-belt`.

#### 2. Full catalog cap spec (optional)

**File**: `e2e/cycle-pause-cap.spec.ts` (new)

**Intent**: Cap → session end → closure visible. Tag `@skip-belt` if slow (fake clock injection or test-only cap override).

**Contract**: Document run command in plan references only.

### Success Criteria

#### Automated Verification

- `set CI=true && pnpm test:e2e:belt` passes
- `pnpm test` passes
- `pnpm check` passes

---

## Testing Strategy

### Unit Tests

- Cycle router: pause/resume state machine, mutex, isolation
- Hook: pause freeze, resume countdown, PAUSED hydrate, cap timer, rollback
- Conductor: all gates suppressed when paused
- Narrative: `pause_cap` closure line
- Timer panel: button visibility per state

### Integration Tests

- Guest repo pause/resume round-trip in localStorage
- Guest merge with PAUSED cycle

### Manual Testing Steps

1. Auth: pause work cycle 2 min in → refresh → resume → completes with correct remaining
2. Guest: same path without sign-in
3. Pause during idle kickoff window → no kickoff card
4. Interrupt after pause still works from running state only
5. Cap path (with shortened constant locally) → closure, session ended

## Performance Considerations

Pause stops the 1s worker — reduces background work while paused. Cap timer uses single `setTimeout`/`setInterval` aligned to cap deadline, not per-second polling.

## Migration Notes

Existing cycles remain `RUNNING | COMPLETED | INTERRUPTED`; new fields nullable. No backfill required. Deploy migration before app code that writes PAUSED.

## References

- Research: `context/changes/cycle-pause-resume/research.md`
- Slice spec: `context/foundation/roadmap-references/items/S-24.md`
- User intents: `context/foundation/user-flow.md` §4
- Test-plan risk #10: `context/foundation/test-plan.md` §2
- Conductor pattern: `context/archive/2026-06-18-wedge-transition-conductor/plan.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Schema and domain types

#### Automated

- [x] 1.1 Migration applies cleanly: `pnpm prisma migrate dev`
- [x] 1.2 `pnpm check` passes
- [x] 1.3 `pnpm typecheck` passes

#### Manual

- [x] 1.4 Confirm migration committed before Phase 2

### Phase 2: Server and guest repositories

#### Automated

- [x] 2.1 Cycle router pause/resume/getActive tests pass
- [x] 2.2 `pnpm test` passes
- [x] 2.3 `pnpm check` passes

### Phase 3: Hook pause/resume and recovery

#### Automated

- [x] 3.1 Hook pause/resume/recovery tests pass
- [x] 3.2 `pnpm test` passes

#### Manual

- [ ] 3.3 Local pause → refresh → same remaining

### Phase 4: Wedge gate suppression (pol-12)

#### Automated

- [x] 4.1 Conductor paused-suppression tests pass
- [x] 4.2 Dashboard paused-guard tests pass
- [x] 4.3 `pnpm test` passes

### Phase 5: Timer UI (Pause / Resume)

#### Automated

- [ ] 5.1 Timer panel component tests pass
- [ ] 5.2 `pnpm check` passes

#### Manual

- [ ] 5.3 Pause/Resume on work and break; Interrupt unchanged

### Phase 6: Pause cap and calm session end (pol-8)

#### Automated

- [ ] 6.1 Narrative pause_cap tests pass
- [ ] 6.2 Hook cap timer tests pass
- [ ] 6.3 `pnpm test` passes

#### Manual

- [ ] 6.4 Closure overlay on cap (dev with shortened constant)

### Phase 7: E2E belt smoke

#### Automated

- [ ] 7.1 `set CI=true && pnpm test:e2e:belt` passes
- [ ] 7.2 `pnpm test` passes
- [ ] 7.3 `pnpm check` passes
