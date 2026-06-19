# Optimistic wedge transitions (S-34) Implementation Plan

## Overview

Ship optimistic UI for the authenticated post-check-in wedge path in `use-pomodoro-cycle.ts`, mirroring B-03 patterns: check-in overlay dismiss and break timer start within 200ms, non-blocking suggestion accept, rollback on server failure. Closes PRD US-01 guardrail and test-plan risk #9.

## Current State Analysis

- **B-03** optimizes auth `start()` / `interrupt()` with temp negative cycle ids and snapshot rollback (`use-pomodoro-cycle.ts` ~1411–1735).
- **Post-check-in chain** is sequential: `submitCheckIn` awaits `createCheckIn.mutateAsync`, then `continueAfterCheckIn` awaits `confirmComplete` + break `cycles.create`, then `fetchPostCheckInSuggestion` awaits `suggestion.next` (~2121–2353).
- **`acceptSuggestion`** sync pre-focuses but awaits `recordSuggestionDecision` (~1341–1360); override path already fire-and-forgets.
- **F-07 conductor** enforces gate mutex; `isPostCheckInTransitioning` suppresses cycle-complete flash (B-04).
- **Kickoff readiness** (S-25) already has 200ms dismiss tests (~2674–2762) — out of v1 scope.

### Key Discoveries

- Use hook-local optimism (B-03), not S-09 query cache — wedge state is not in `task.list`.
- `resolveServerCycleId()` must remain in check-in path when optimistic start still pending.
- Server requires persisted check-in before `suggestion.next` post_check_in — UI can advance break first, fetch must wait/retry.
- Wind-down branch (B-07) in `submitCheckIn` opens a higher-priority gate — do not optimistically skip it.

## Desired End State

Authenticated user completes WORK cycle → confirms → taps energy → check-in overlay clears and break timer runs within 200ms; suggestion card shows loading then ready; accept pre-focuses immediately. On mutation failure, UI rolls back with `pomodoro-error` toast. Guest path unchanged. All existing wedge ordering tests (B-04, conductor) pass.

### Verification

- Unit: deferred-mock oracles per test-plan §6.8 in `use-pomodoro-cycle.test.tsx`.
- `pnpm check` + `pnpm test` green.
- Manual: authenticated full cycle check-in → break → accept suggestion feels instant.

## What We're NOT Doing

- Kickoff `suggestion.next` / kickoff accept optimism (S-25 covers readiness dismiss).
- S-35 network-loss recovery banner / outbox retry.
- Guest wedge gates or guest suggestion UI.
- Optimistic wind-down, closure, mid-cycle rebind, or `markTaskDone` overlay.
- Belt e2e latency timing assertions.
- Bundling `fix-stale-suggestion-after-delete`.

## Implementation Approach

Introduce wedge optimistic helpers alongside B-03 refs in `use-pomodoro-cycle.ts`: snapshot rollback for check-in/break transition, background async chain for server persistence, preserve conductor flags. Phase 1 handles check-in → break; Phase 2 suggestion accept + ordered fetch; Phase 3 tests.

## Critical Implementation Details

**State sequencing:** Set `awaitingCheckIn = false`, `isPostCheckInTransitioning = true`, break `running` **before** awaiting server — same ordering as B-03 start. Clear `isPostCheckInTransitioning` only after break worker starts (not after suggestion fetch) so B-04 suppression still covers break transition.

**Wind-down exception:** When B-07 wind-down branch triggers after check-in save, do **not** enter optimistic break path — show wind-down gate synchronously as today.

**Suggestion ordering:** Start `createCheckIn` in background; on success chain `confirmComplete` → break create → then `fetchPostCheckInSuggestion`. If check-in fails, roll back to check-in gate.

## Phase 1: Optimistic check-in dismiss and break handoff

### Overview

Refactor `submitCheckIn` and `continueAfterCheckIn` so authenticated users leave the check-in gate and see break running within 200ms, with async server reconciliation and rollback.

### Changes Required

#### 1. Wedge optimistic infrastructure

**File:** `src/hooks/use-pomodoro-cycle.ts`

**Intent:** Add refs/snapshot helpers for post-check-in optimism parallel to B-03 (`pendingWedgeTransitionRef`, break optimistic cycle allocation, `rollbackOptimisticCheckInTransition`).

**Contract:** Rollback restores `awaitingCheckIn`, cycle state, worker, and `isPostCheckInTransitioning`; surface errors via existing `setPomodoroError` pattern.

#### 2. Optimistic `submitCheckIn` (non-wind-down path)

**File:** `src/hooks/use-pomodoro-cycle.ts` (~2266–2353)

**Intent:** On energy tap (when wind-down does not trigger): immediately dismiss check-in (`awaitingCheckIn = false`), invoke optimistic break transition, fire `createCheckIn` + complete/break chain asynchronously.

**Contract:** Still call `resolveServerCycleId()` before persisting check-in. Wind-down branch unchanged (await check-in, then show wind-down).

#### 3. Optimistic `continueAfterCheckIn`

**File:** `src/hooks/use-pomodoro-cycle.ts` (~2121–2157)

**Intent:** Split into sync UI transition (break running, worker started with optimistic break cycle id) and async server `confirmComplete` + `startBreakAfterWorkComplete` with reconcile/rollback.

**Contract:** Mirror B-03 break `create` reconciliation (temp id → server id, timer drift >2s correction). Keep `pendingSuggestion = loading` during async suggestion fetch.

#### 4. Check-in overlay submit UX

**File:** `src/app/_components/check-in-overlay.tsx`, `pomodoro-dashboard.tsx`

**Intent:** Ensure overlay dismisses on optimistic path — `isSubmitting` should not block dismiss once hook clears `awaitingCheckIn`; may shorten to error-only disable.

**Contract:** `disabled={isSubmitting}` only while synchronous wind-down path; optimistic path clears gate immediately.

### Success Criteria

#### Automated Verification

- `pnpm check`
- `pnpm exec vitest run src/hooks/use-pomodoro-cycle.test.tsx` — existing post-check-in ordering tests pass
- `pnpm test`

#### Manual Verification

- Authenticated WORK cycle end → check-in → break starts without visible stall
- Simulated network slow-down: break still starts quickly; suggestion loads when ready
- Wind-down (Fading fatigue) still shows wind-down gate, not instant break

---

## Phase 2: Non-blocking suggestion accept and ordered fetch

### Overview

Make suggestion accept match override pattern; keep suggestion fetch async without blocking break UI.

### Changes Required

#### 1. `acceptSuggestion` non-blocking

**File:** `src/hooks/use-pomodoro-cycle.ts` (~1341–1360)

**Intent:** Pre-focus synchronously; `void recordSuggestionDecision(...)` with error toast on failure (no `isAcceptingSuggestion` block).

**Contract:** Remove or bypass `isAcceptingSuggestion` disable on accept button in `task-suggestion-card.tsx` wiring.

#### 2. Ordered async `fetchPostCheckInSuggestion`

**File:** `src/hooks/use-pomodoro-cycle.ts` (~1045–1118)

**Intent:** After optimistic break starts, await check-in persistence then call `suggestion.next`; on failure set `pendingSuggestion = error` with retry affordance (minimal — full retry UI deferred to S-35).

**Contract:** Do not call `suggestion.next` before check-in mutation succeeds.

#### 3. Dashboard wiring

**File:** `src/app/_components/pomodoro-dashboard.tsx`

**Intent:** Pass updated loading/accept flags; ensure suggestion card visible during break with loading skeleton.

**Contract:** No new conductor gates; suggestion remains interstitial/card, not a gate beat.

### Success Criteria

#### Automated Verification

- `pnpm check`
- `pnpm test`

#### Manual Verification

- Accept suggestion during break: task pre-focused immediately
- Override path unchanged (ack strip + fire-and-forget)
- Suggestion error state shows calm message if fetch fails

---

## Phase 3: Deferred-mock tests and prevention

### Overview

Add §6.8 oracles for wedge optimism and rollback; document pattern.

### Changes Required

#### 1. Unit tests — optimistic check-in → break

**File:** `src/hooks/use-pomodoro-cycle.test.tsx`

**Intent:** Deferred mocks on `createCheckIn`, `completeCycle`, `createBreak`: assert `awaitingCheckIn` false and `state === "running"` (break) before releases; assert B-04 no flash helper still holds.

**Contract:** Test names cite L-04 / S-34; use same deferred pattern as B-03 tests (~469, ~705).

#### 2. Unit tests — rollback

**File:** `src/hooks/use-pomodoro-cycle.test.tsx`

**Intent:** Reject `createCheckIn` or `completeCycle` after optimistic advance; assert rollback to check-in gate or error state.

#### 3. Unit tests — acceptSuggestion non-blocking

**File:** `src/hooks/use-pomodoro-cycle.test.tsx`

**Intent:** Assert pre-focus before `recordDecision` resolves.

#### 4. Prevention comments

**Files:** `use-pomodoro-cycle.ts` (wedge section header comment referencing S-34 + L-04)

**Intent:** Inline guard comment for future editors — each wedge tap surface needs own 200ms oracle.

### Success Criteria

#### Automated Verification

- `pnpm exec vitest run src/hooks/use-pomodoro-cycle.test.tsx`
- `pnpm check`
- `pnpm test`

#### Manual Verification

- Review new tests with fake timers if any flakiness

---

## Testing Strategy

### Unit Tests

- Deferred-mock oracles for check-in dismiss, break start, accept pre-focus, rollback paths
- Preserve: `submitCheckIn keeps cycle-complete suppressed until break running`, wind-down branch tests, conductor-related hook tests

### Integration Tests

- No new belt e2e required per test-plan risk #9 (hook oracle sufficient)

### Manual Testing Steps

1. Auth user: full WORK cycle → check-in (each energy) → break → accept suggestion
2. Throttle network (DevTools): verify break starts quickly, suggestion eventually loads
3. Trigger wind-down path: verify wind-down gate still appears
4. Guest user: verify unchanged break-after-work (no check-in)

## Performance Considerations

Target perceived latency ≤200ms on check-in tap and suggestion accept — measured in unit tests via state assertions before mock release, not wall-clock e2e.

## Migration Notes

None — client-only hook changes; no schema migration.

## References

- Research: `context/changes/optimistic-wedge-transitions/research.md`
- B-03 plan: `context/archive/2026-06-09-fix-title-multiline-and-cycle-optimistic/plan.md`
- F-07 conductor: `src/lib/wedge/transition-conductor.ts`
- test-plan §6.8: `context/foundation/test-plan.md`
- PRD US-01: `context/foundation/prd.md`
- Roadmap S-34: `context/foundation/roadmap-references/items/S-34.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Optimistic check-in dismiss and break handoff

#### Automated

- [x] 1.1 `pnpm check` — c241f8b
- [x] 1.2 `pnpm exec vitest run src/hooks/use-pomodoro-cycle.test.tsx` — existing post-check-in tests pass — c241f8b
- [x] 1.3 `pnpm test` — c241f8b

#### Manual

- [ ] 1.4 Authenticated check-in → break feels instant; wind-down path unchanged

### Phase 2: Non-blocking suggestion accept and ordered fetch

#### Automated

- [x] 2.1 `pnpm check`
- [x] 2.2 `pnpm test`

#### Manual

- [ ] 2.3 Accept pre-focuses immediately; fetch error shows calm state

### Phase 3: Deferred-mock tests and prevention

#### Automated

- [ ] 3.1 `pnpm exec vitest run src/hooks/use-pomodoro-cycle.test.tsx` — new S-34 oracles pass
- [ ] 3.2 `pnpm check`
- [ ] 3.3 `pnpm test`

#### Manual

- [ ] 3.4 Review test stability (fake timers if needed)
