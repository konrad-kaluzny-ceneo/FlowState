# Wedge transition sync recovery (S-35) Implementation Plan

## Overview

Ship calm network-loss recovery on authenticated wedge gates: preserve pending wedge intent (energy, phase, cycle ids), expose one-tap `retryWedgeSync`, refine `continueAfterCheckIn` partial-failure handling, add recovery handoff UI + optional offline banner. Closes test-plan risk #11 and US-01 guardrail (no silent loss / forced re-entry).

## Current State Analysis

- **S-34** optimistic check-in → break with `rollbackOptimisticCheckInTransition` on any chain failure (`use-pomodoro-cycle.ts`).
- **Check-in failure** restores gate but user must re-tap energy — no preserved intent (test ~1862–1914).
- **Suggestion failure** sets `pendingSuggestion.status = "error"` with fetch-only Retry (`task-suggestion-card.tsx` ~263–276).
- **Readiness** dismisses steering before `fetchKickoffSuggestion`; errors land on suggestion card only.
- **No offline detection** in `src/`.
- **F-07** mutexes overlay gates; recovery is dashboard interstitial, not a conductor beat.

## Desired End State

Authenticated user loses network on check-in, suggestion fetch, or kickoff readiness: sees what persisted (work cycle, check-in, break) and taps **Retry** once to replay the failed step without re-picking energy. Offline browser state shows subtle reconnect banner on home shell. Guest path unchanged.

### Verification

- Unit: pending intent preserved + `retryWedgeSync` oracles in `use-pomodoro-cycle.test.tsx`
- Dashboard smoke: recovery handoff renders with retry CTA
- `pnpm check` + `pnpm test` green

## What We're NOT Doing

- Persisted outbox / refresh survival
- Multi-tab sync reconciliation
- New F-07 conductor gate type
- Belt e2e offline simulation (test-plan negative space)
- Guest wedge gates
- tRPC global mutation retry config changes

## Implementation Approach

Add `PendingWedgeIntent` ref in hook; on wedge mutation failure capture intent instead of full rollback when server already persisted prior steps; export `retryWedgeSync` + `pendingWedgeRecovery` state. New `WedgeSyncRecovery` component for calm copy + one-tap retry (pattern from suggestion error card). `useOnlineStatus` hook + banner in home shell.

## Critical Implementation Details

**Partial failure:** If `createCheckIn` + `completeCycle` succeed but `suggestion.next` fails, keep break running; set intent phase `suggestion_fetch` with saved energy — do not call `rollbackOptimisticCheckInTransition`.

**Check-in-only failure:** Preserve `selectedEnergy` in intent; keep `awaitingCheckIn` true with recovery surface showing chosen energy label — retry calls `submitCheckIn` with same energy without requiring re-tap (or single Retry button that replays).

**Conductor / catch-up:** When `catchUp` visible, recovery handoff mounts below catch-up; dismiss catch-up on successful retry if user confirms underlying gate.

**Wind-down path:** Stay pessimistic — no optimistic retry changes to wind-down branch.

**Retry mutex:** `isWedgeSyncRetryingRef` prevents double-tap on `retryWedgeSync` (mirrors S-34 in-flight guard).

**Existing `retrySuggestion`:** When `pendingWedgeRecovery` is active, dashboard routes Retry to `retryWedgeSync`; otherwise keep card-level `retrySuggestion` for legacy fetch-only errors.

## Phase 1: Pending wedge intent and `retryWedgeSync`

### Overview

Hook infrastructure for preserved intent and targeted retry without full rollback.

### Changes Required

#### 1. `PendingWedgeIntent` type and ref

**File:** `src/hooks/use-pomodoro-cycle.ts`

**Intent:** Add `pendingWedgeIntentRef` holding `{ phase, energy, workCycleId, markTaskDone?, breakCycleId? }` and `pendingWedgeRecovery` state slice for UI.

**Contract:** Cleared on successful retry or explicit dismiss; not persisted across refresh.

#### 2. Refine `continueAfterCheckIn` failure branches

**File:** `src/hooks/use-pomodoro-cycle.ts` (~2706–2794)

**Intent:** Branch failures: (a) check-in fail → rollback + intent `check_in`; (b) complete fail → intent `complete_work`; (c) break create fail → intent `start_break` with work saved message; (d) suggestion fetch fail → **no rollback**, intent `suggestion_fetch`, break keeps running.

#### 3. `retryWedgeSync` export

**File:** `src/hooks/use-pomodoro-cycle.ts`

**Intent:** Replay failed phase from intent: re-call appropriate mutation chain without clearing energy selection.

**Contract:** Idempotent; sets `isConfirming` only during active retry; surfaces errors via `pendingWedgeRecovery`.

#### 4. `submitCheckIn` intent capture

**File:** `src/hooks/use-pomodoro-cycle.ts` (~2919–3020)

**Intent:** On wind-down path failures, capture energy in intent for retry.

### Success Criteria

#### Automated

- [ ] 1.1 `pnpm check`
- [ ] 1.2 `pnpm exec vitest run src/hooks/use-pomodoro-cycle.test.tsx` — new partial-failure + retry oracles
- [ ] 1.3 `pnpm test`

#### Manual

- [ ] 1.4 Throttle network: suggestion fail after break starts — break continues, Retry works

---

## Phase 2: Wedge sync recovery UI

### Overview

Calm handoff component replacing generic error for wedge recovery cases.

### Changes Required

#### 1. `WedgeSyncRecovery` component

**File:** `src/app/_components/wedge-sync-recovery.tsx` (new)

**Intent:** Copy pattern from `task-suggestion-card.tsx` error block: what saved + **Retry** + optional Dismiss. `data-testid="wedge-sync-recovery"`.

**Contract:** `prefers-reduced-motion` safe; Serene Pastel tokens from DESIGN.md.

#### 2. Dashboard wiring

**File:** `src/app/_components/pomodoro-dashboard.tsx`

**Intent:** Render `WedgeSyncRecovery` when `pendingWedgeRecovery` active; prefer over generic `pomodoro-error` for wedge failures. Wire `onRetry={retryWedgeSync}`.

**Contract:** Does not stack with conductor overlay gates — show when gate dismissed but recovery pending, or inline above suggestion card.

#### 3. Check-in overlay hint (optional)

**File:** `src/app/_components/check-in-overlay.tsx`

**Intent:** When intent preserved, show selected energy readout + Retry if overlay still visible.

### Success Criteria

#### Automated

- [ ] 2.1 `pnpm exec vitest run src/app/_components/pomodoro-dashboard.test.tsx` — recovery smoke
- [ ] 2.2 `pnpm check`
- [ ] 2.3 `pnpm test`

#### Manual

- [ ] 2.4 Recovery copy readable; one tap retries without re-picking energy

---

## Phase 3: Offline / reconnect banner (P-GAP-107)

### Overview

Global calm banner when browser offline.

### Changes Required

#### 1. `useOnlineStatus` hook

**File:** `src/hooks/use-online-status.ts` (new)

**Intent:** `online` / `offline` events + initial `navigator.onLine`.

#### 2. Banner in home shell

**File:** `src/app/_components/home-shell.tsx`

**Intent:** Subtle banner: "You're offline — changes save when you're back." `data-testid="offline-banner"`. Hide when online.

#### 3. Unit test

**File:** `src/app/_components/home-shell.test.tsx`

**Intent:** Mock offline event → banner visible.

### Success Criteria

#### Automated

- [ ] 3.1 `pnpm exec vitest run src/hooks/use-online-status.test.ts` (if co-located) or home-shell test
- [ ] 3.2 `pnpm check`
- [ ] 3.3 `pnpm test`

#### Manual

- [ ] 3.4 DevTools offline → banner appears; online → dismisses

---

## Phase 4: Readiness path + kickoff accept parity

### Overview

Kickoff steering errors and S-34-style non-blocking kickoff accept.

### Changes Required

#### 1. Kickoff fetch failure on steering

**File:** `use-pomodoro-cycle.ts` (~1497–1669)

**Intent:** When `fetchKickoffSuggestion` fails after energy/focus, set `pendingWedgeRecovery` with phase `kickoff_suggestion` preserving `lastKickoffEnergyRef` / intention.

#### 2. Steering card error affordance

**File:** `src/app/_components/session-steering-card.tsx`, `pomodoro-dashboard.tsx`

**Intent:** Show inline error + Retry when kickoff session init fails (`sessions.getOrCreateActive` error path).

#### 3. Non-blocking `acceptKickoffSuggestion`

**File:** `use-pomodoro-cycle.ts` (~1810–1840)

**Intent:** Mirror `acceptSuggestion`: pre-focus immediately; `void recordKickoffDecision`.

### Success Criteria

#### Automated

- [ ] 4.1 `pnpm exec vitest run src/hooks/use-pomodoro-cycle.test.tsx` — kickoff retry + accept oracles
- [ ] 4.2 `pnpm check`
- [ ] 4.3 `pnpm test`

#### Manual

- [ ] 4.4 Kickoff readiness failure → Retry without re-selecting energy

---

## Phase 5: Test hardening and docs

### Overview

Complete risk #11 coverage; prevention comments.

### Changes Required

#### 1. Hook oracles

**File:** `src/hooks/use-pomodoro-cycle.test.tsx`

**Intent:** Tests: (1) check-in fail → retry preserves energy; (2) suggestion fail after break → no rollback; (3) `retryWedgeSync` replays chain; (4) kickoff retry.

#### 2. Prevention comment

**File:** `use-pomodoro-cycle.ts` wedge section

**Intent:** Reference S-35 + test-plan risk #11 — wedge failures must not force energy re-entry.

### Success Criteria

#### Automated

- [ ] 5.1 `pnpm exec vitest run src/hooks/use-pomodoro-cycle.test.tsx`
- [ ] 5.2 `pnpm check`
- [ ] 5.3 `pnpm test`

#### Manual

- [ ] 5.4 Review deferred-mock stability

---

## Testing Strategy

### Unit Tests

Primary signal per test-plan risk #11 — hook deferred mocks for retry without energy re-entry; dashboard smoke for recovery UI; home-shell offline banner.

### E2E

Defer belt offline scenarios — negative space in test-plan.

### Manual

1. Auth: full cycle → check-in → throttle → Retry
2. Break running + failed suggestion → Retry loads suggestion
3. Kickoff steering → failed fetch → Retry
4. Offline banner toggles with DevTools

## Performance Considerations

Retry is user-triggered (no aggressive auto-retry loops). Banner uses passive event listeners.

## Migration Notes

None — client-only.

## References

- Research: `context/changes/wedge-transition-sync-recovery/research.md`
- S-34 archive: `context/archive/2026-06-19-optimistic-wedge-transitions/`
- test-plan risk #11: `context/foundation/test-plan.md`
- Roadmap S-35: `context/foundation/roadmap-references/items/S-35.md`

## Progress

### Phase 1: Pending wedge intent and retryWedgeSync

#### Automated

- [x] 1.1 `pnpm check`
- [x] 1.2 `pnpm exec vitest run src/hooks/use-pomodoro-cycle.test.tsx`
- [x] 1.3 `pnpm test`

#### Manual

- [ ] 1.4 Throttle network partial failure scenario

### Phase 2: Wedge sync recovery UI

#### Automated

- [x] 2.1 `pnpm exec vitest run src/app/_components/pomodoro-dashboard.test.tsx`
- [x] 2.2 `pnpm check`
- [x] 2.3 `pnpm test`

#### Manual

- [ ] 2.4 Recovery UI one-tap retry

### Phase 3: Offline banner

#### Automated

- [x] 3.1 home-shell / use-online-status tests
- [x] 3.2 `pnpm check`
- [x] 3.3 `pnpm test`

#### Manual

- [ ] 3.4 Offline banner toggle

### Phase 4: Readiness + kickoff accept

#### Automated

- [x] 4.1 `pnpm exec vitest run src/hooks/use-pomodoro-cycle.test.tsx`
- [x] 4.2 `pnpm check`
- [x] 4.3 `pnpm test`

#### Manual

- [ ] 4.4 Kickoff retry path

### Phase 5: Test hardening

#### Automated

- [x] 5.1 `pnpm exec vitest run src/hooks/use-pomodoro-cycle.test.tsx`
- [x] 5.2 `pnpm check`
- [x] 5.3 `pnpm test`

#### Manual

- [ ] 5.4 Test stability review
