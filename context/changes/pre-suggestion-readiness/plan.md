# Pre-suggestion readiness implementation plan

## Overview

Add an ephemeral **readiness gate** (Focused / Steady / Fading) at two wedge moments — session kickoff and after a work cycle break starts — so `suggestion.next` scores tasks from user-declared readiness instead of hardcoded `STEADY`. Reuse the existing check-in overlay pattern with readiness-specific copy and test IDs. Check-in energy (end-of-cycle) remains persisted on `CheckIn`; readiness energy is passed to the API only and does not create a new DB row.

## Current State Analysis

- **Kickoff** auto-fetches `suggestion.next` with `context: "kickoff"` when idle after session start or break (`use-pomodoro-cycle.ts` ~830–858). Server hardcodes `"STEADY"` at `suggestion.ts:229`.
- **Post-check-in** persists energy via `checkIn.create`, then `continueAfterCheckIn` starts the break and immediately calls `fetchPostCheckInSuggestion` (`use-pomodoro-cycle.ts:1438–1474`). Server uses `cycle.checkIn.energy` for scoring (`suggestion.ts:156–162`).
- **UI** — `CheckInOverlay` is a full-screen modal with three energy buttons (`check-in-overlay.tsx`). Suggestion cards render inline in `pomodoro-dashboard.tsx`; no readiness surface exists.
- **Guest** — suggestion gates are authenticated-only (`enableSuggestionGate`); no change needed.
- **Scorer** — `scoreTask` / `pickBestTask` already accept `ScoringContext.energy`; no scorer changes required.

### Key Discoveries

- Readiness and check-in are **semantically distinct**: check-in captures end-of-work energy; readiness captures how the user feels before picking the next task (after break at kickoff).
- `isPostCheckInTransitioning` and overlay suppression rules (B-04) must account for readiness so `cycle-complete-overlay` does not flash between gates.
- Catch-up (`derive-gate.ts`) keys on `awaitingCheckIn` and `pendingSuggestion.status === "ready"`; readiness needs its own gate snapshot.

## Desired End State

Authenticated users:

1. At **session kickoff** (idle after cold start or post-break), see a readiness overlay before any kickoff suggestion card. Choosing energy (or "Continue with Steady") fetches `suggestion.next` with that `energy`; rationale reflects the choice (e.g. FADING favors reactive tasks).
2. After **work cycle check-in** (and optional wind-down), break starts, then readiness overlay appears before the post-check-in suggestion card loads. `suggestion.next` uses readiness `energy`, not `cycle.checkIn.energy`, for scoring.
3. Skipping via "Continue with Steady" submits `STEADY` without implying a deliberate energy pick.
4. Guest mode unchanged.

**Verify:** `pnpm test`, `pnpm check`, targeted e2e (`session-kickoff.spec.ts`, `task-suggestion.spec.ts`), manual kickoff + post-check-in flows with FADING vs FOCUSED changing the suggested task.

## What We're NOT Doing

- Prisma migration or new persistence table for readiness
- Guest-mode readiness or guest suggestion scoring
- Replacing or removing S-05 end-of-cycle check-in
- S-23 "Why this?" expander factor updates (deferred until F-05 if needed)
- Auto-timeout skip; inline energy chips on suggestion card
- Using check-in energy for post-check-in scoring when readiness is declared separately

## Implementation Approach

Extend `suggestion.next` input with optional `energy` (default `STEADY`). Generalize `CheckInOverlay` into a variant-driven energy picker. Add `awaitingReadiness` state to `usePomodoroCycle` that blocks suggestion fetch until submit/skip. Defer `fetchKickoffSuggestion` and post-check-in `fetchPostCheckInSuggestion` until readiness resolves. Wire dashboard overlay and update catch-up derivation for tab-return.

## Critical Implementation Details

**Post-check-in sequencing:** `continueAfterCheckIn` must start the break first, then set `awaitingReadiness` with `context: "post_check_in"` and keep `pendingSuggestion` at `idle` until readiness submits. Do not fetch suggestion inside `continueAfterCheckIn` — move fetch to the readiness submit handler. `isPostCheckInTransitioning` should remain true from check-in submit through break start until readiness completes (prevents cycle-complete flash).

**Kickoff sequencing:** The `kickoffEligible` effect must set `awaitingReadiness` with `context: "kickoff"` instead of calling `fetchKickoffSuggestion` directly. Session resolution (`sessions.getOrCreateActive`) can still run in the effect; store `sessionId` on the readiness state for the subsequent fetch.

**Wind-down path:** `onWindDownKeepGoing` → `continueAfterCheckIn` follows the same readiness-after-break path as a normal check-in.

## Phase 1: API and scorer wiring

### Overview

Add `energy` to `suggestion.next` for both contexts; use `input.energy` for scoring; extend router tests.

### Changes Required

#### 1. Suggestion router input schema

**File**: `src/server/api/routers/suggestion.ts`

**Intent**: Accept user-declared readiness energy on both `kickoff` and `post_check_in` branches; default to `STEADY` when omitted for backwards compatibility.

**Contract**: Extend `nextInputSchema` discriminated union — both branches gain `energy: z.enum(["FOCUSED", "STEADY", "FADING"]).default("STEADY")`. Kickoff path passes `input.energy` to `buildScoringContextForSession` (replace line 229 hardcode). Post-check-in path passes `input.energy` instead of `cycle.checkIn.energy` (line 161). Check-in row still required for `post_check_in` (wind-down, `recordDecision`, audit).

#### 2. Router tests

**File**: `src/server/api/routers/suggestion.test.ts`

**Intent**: Lock behavior — kickoff with `FADING` picks different task than `STEADY` on seeded tasks; post-check-in with `FOCUSED` input overrides a `STEADY` check-in row for scoring; omitted `energy` behaves as `STEADY`.

**Contract**: Update existing kickoff test at ~570 to pass explicit `energy: "STEADY"`. Add cases for `FOCUSED` / `FADING` kickoff and `input.energy` vs `checkIn.energy` divergence on `post_check_in`.

#### 3. Isolation tests (if present)

**File**: `src/server/api/routers/suggestion-isolation.test.ts`

**Intent**: Keep isolation harness aligned with new input shape.

**Contract**: Add `energy` field to kickoff/post_check_in `next` calls where the schema requires it.

### Success Criteria

#### Automated Verification

- `pnpm exec vitest run src/server/api/routers/suggestion.test.ts`
- `pnpm typecheck`
- `pnpm check`

#### Manual Verification

- None for this phase

**Implementation Note**: Pause after automated verification passes before Phase 2.

---

## Phase 2: Hook state machine

### Overview

Introduce `awaitingReadiness`, defer suggestion fetches, pass `energy` to mutations, preserve wind-down and B-04 transition guards.

### Changes Required

#### 1. Readiness state and types

**File**: `src/hooks/use-pomodoro-cycle.ts`

**Intent**: Track which readiness gate is active and the IDs needed for the subsequent fetch.

**Contract**: New state, e.g. `awaitingReadiness: null | { context: "kickoff"; sessionId: number } | { context: "post_check_in"; cycleId: number }`. Export `submitReadiness(energy)` and `skipReadiness()` (skip = `STEADY`). Clear readiness on session reset / interrupt paths that clear suggestions.

#### 2. Kickoff eligibility effect

**File**: `src/hooks/use-pomodoro-cycle.ts` (~830–858)

**Intent**: Stop auto-fetching on kickoff eligibility; show readiness gate instead.

**Contract**: When `kickoffEligible` transitions true, resolve session and set `awaitingReadiness` `{ context: "kickoff", sessionId }`. Do not call `fetchKickoffSuggestion` until readiness resolves.

#### 3. Post-check-in flow

**File**: `src/hooks/use-pomodoro-cycle.ts` (`continueAfterCheckIn`, ~1438–1474)

**Intent**: Start break, then readiness, then fetch — not fetch-then-break.

**Contract**: After `confirmComplete` confirms break `running`, set `awaitingReadiness` `{ context: "post_check_in", cycleId }`, keep `pendingSuggestion` at `idle`, clear `isPostCheckInTransitioning` only after readiness fetch completes (not immediately after break start). Remove direct `fetchPostCheckInSuggestion` call from `continueAfterCheckIn`.

#### 4. Fetch helpers

**File**: `src/hooks/use-pomodoro-cycle.ts` (`fetchKickoffSuggestion`, `fetchPostCheckInSuggestion`)

**Intent**: Include `energy` in `mutateAsync` input.

**Contract**: Both calls pass `energy` from readiness submit. `submitReadiness` dispatches to the correct fetch by `awaitingReadiness.context`, then clears readiness and sets pending suggestion/kickoff state as today.

#### 5. Hook unit tests

**File**: `src/hooks/use-pomodoro-cycle.test.tsx`

**Intent**: Regression coverage for deferred fetch and energy in mutation input.

**Contract**: Kickoff eligibility sets `awaitingReadiness` without `suggestion.next` call; submit triggers fetch with `energy`. Post-check-in: break starts before fetch; `energy` passed on `post_check_in` mutation. Wind-down continue path still reaches readiness gate.

### Success Criteria

#### Automated Verification

- `pnpm exec vitest run src/hooks/use-pomodoro-cycle.test.tsx`
- `pnpm test`
- `pnpm check`

#### Manual Verification

- None for this phase

**Implementation Note**: Pause after automated verification passes before Phase 3.

---

## Phase 3: Dashboard UI

### Overview

Generalize energy overlay for readiness copy; mount from dashboard; suppress suggestion cards while readiness active.

### Changes Required

#### 1. Overlay variant

**File**: `src/app/_components/check-in-overlay.tsx`

**Intent**: Reuse one component for check-in and readiness with different copy and test IDs.

**Contract**: Add `variant: "check_in" | "readiness"` (or equivalent props: `title`, `subtitle`, `testIdPrefix`, `showSkipSteady`). Readiness variant: title e.g. "How ready are you for what's next?", subtitle clarifying break/kickoff context, `data-testid` prefix `readiness-*` (overlay: `readiness-overlay`, energies: `readiness-energy-focused` etc., skip: `readiness-skip-steady`). Check-in variant keeps existing test IDs unchanged. `cycleId` optional for readiness (omit or use `data-session-id` / `data-context`).

#### 2. Overlay tests

**File**: `src/app/_components/check-in-overlay.test.tsx` (create if absent, or extend nearest co-located test)

**Intent**: Smoke readiness variant renders skip button and energy buttons with correct test IDs.

**Contract**: Render readiness variant; assert `readiness-skip-steady` and energy buttons present.

#### 3. Dashboard orchestration

**File**: `src/app/_components/pomodoro-dashboard.tsx`

**Intent**: Show readiness overlay when `awaitingReadiness` set; hide suggestion cards until fetch begins.

**Contract**: Mount readiness overlay when `enableSuggestionGate && pomodoro.awaitingReadiness != null`. Wire `onSubmit` → `submitReadiness`, skip → `skipReadiness`. Extend overlay suppression: hide `cycle-complete-overlay` while `awaitingReadiness` (alongside `awaitingCheckIn`, `isPostCheckInTransitioning`). `showSuggestionCard` / `showKickoffCard` require `awaitingReadiness == null` and pending status not `idle` only after readiness (loading/ready/error as today).

#### 4. Hook exports

**File**: `src/hooks/use-pomodoro-cycle.ts`

**Intent**: Expose readiness state and handlers on the hook return object for dashboard consumption.

**Contract**: Return `awaitingReadiness`, `submitReadiness`, `skipReadiness` (names as implemented).

### Success Criteria

#### Automated Verification

- `pnpm exec vitest run src/app/_components/check-in-overlay.test.tsx` (or co-located test path used)
- `pnpm test`
- `pnpm check`

#### Manual Verification

- Kickoff: idle dashboard shows readiness before suggestion card; skip shows Steady-scored suggestion
- Post-check-in: after check-in + break, readiness appears before suggestion card; no cycle-complete flash
- Wind-down continue path shows readiness before suggestion

**Implementation Note**: Pause for manual confirmation before Phase 4.

---

## Phase 4: E2E, catch-up, and roadmap sync

### Overview

Update e2e helpers and specs; extend tab-return catch-up for readiness gate; mark slice active/done in tracking surfaces as part of ship (not this plan's code scope beyond tests).

### Changes Required

#### 1. E2E helpers

**Files**: `e2e/helpers/readiness.ts` (new), `e2e/helpers/kickoff.ts`, `e2e/helpers/suggestion.ts`

**Intent**: Shared readiness completion step before waiting for `suggestion.next`.

**Contract**: `completeReadiness(page, energy?: "FOCUSED"|"STEADY"|"FADING"|"skip")` — wait for `readiness-overlay`, click energy or `readiness-skip-steady`. Update `waitForKickoffSuggestion` / `waitForSuggestionNext` callers to complete readiness first where the flow now gates fetch.

#### 2. E2E specs

**Files**: `e2e/session-kickoff.spec.ts`, `e2e/task-suggestion.spec.ts`

**Intent**: Prove readiness gates suggestion and energy affects outcome where deterministic.

**Contract**: Kickoff spec: complete readiness with `FADING`, assert suggestion request body includes `"energy":"FADING"`. Post-check-in spec: readiness step between check-in and suggestion accept; assert `suggestion.next` includes readiness energy. Add case: FADING readiness yields different suggested task than FOCUSED when seed tasks support it (mirror router test seeds).

#### 3. Catch-up derivation

**Files**: `src/lib/catch-up/derive-gate.ts`, `src/lib/catch-up/types.ts`, `src/hooks/use-pomodoro-cycle.ts`, `src/app/_components/pomodoro-dashboard.tsx`, `src/app/_components/tab-return-catchup.test.tsx`

**Intent**: Tab return during readiness shows catch-up handoff to readiness overlay.

**Contract**: Add `awaitingReadiness` to `CatchUpGateSnapshot`; new gate `READINESS` when readiness active. Dashboard shows `TabReturnCatchUp` for readiness gate (mirror `showCheckInCatchUp`). Unit test in `tab-return-catchup.test.tsx` or `derive-gate` test file.

#### 4. Seed spec smoke

**File**: `e2e/seed.spec.ts`

**Intent**: Ensure CI smoke still passes with readiness in default path.

**Contract**: Update seed flow if it crosses kickoff or suggestion paths.

### Success Criteria

#### Automated Verification

- `set CI=true && pnpm test:e2e e2e/session-kickoff.spec.ts e2e/task-suggestion.spec.ts`
- `pnpm test`
- `pnpm check`

#### Manual Verification

- Background tab during readiness gate: catch-up surfaces on return
- No regression on check-in overlay test IDs (`check-in-energy-*`)

**Implementation Note**: Final phase — ship when all automated + manual checks pass.

---

## Testing Strategy

### Unit Tests

- `suggestion.test.ts` — energy on both contexts; default STEADY; post_check_in input overrides check-in row for scoring
- `use-pomodoro-cycle.test.tsx` — deferred fetch, readiness submit/skip, wind-down path
- `check-in-overlay` — readiness variant test IDs and skip button
- `derive-gate` / `tab-return-catchup` — READINESS gate

### Integration Tests

- Hook + mocked tRPC: readiness → mutation input includes energy

### Manual Testing Steps

1. Create 3 tasks (deep, admin, reactive). Kickoff with FADING — expect reactive-leaning suggestion rationale.
2. Complete work cycle, check in FOCUSED, continue through wind-down skip, readiness FADING — suggestion should follow readiness not check-in.
3. Kickoff skip ("Continue with Steady") — suggestion loads without extra tap.
4. Verify guest dashboard has no readiness overlay.

## Performance Considerations

One additional modal interaction per wedge moment; no extra API round-trips (fetch deferred, not duplicated). Suggestion fetch still single call per moment.

## Migration Notes

None. `energy` on `suggestion.next` defaults to `STEADY` for any stale clients.

## References

- Roadmap S-25: `context/foundation/roadmap.md`
- Change identity: `context/changes/pre-suggestion-readiness/change.md`
- Check-in overlay: `src/app/_components/check-in-overlay.tsx`
- Suggestion router: `src/server/api/routers/suggestion.ts:15-266`
- Kickoff effect: `src/hooks/use-pomodoro-cycle.ts:830-858`
- L-04 (per-surface 200ms): `context/foundation/lessons.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: API and scorer wiring

#### Automated

- [ ] 1.1 `pnpm exec vitest run src/server/api/routers/suggestion.test.ts`
- [ ] 1.2 `pnpm typecheck`
- [ ] 1.3 `pnpm check`

#### Manual

- [ ] 1.4 None for this phase

### Phase 2: Hook state machine

#### Automated

- [ ] 2.1 `pnpm exec vitest run src/hooks/use-pomodoro-cycle.test.tsx`
- [ ] 2.2 `pnpm test`
- [ ] 2.3 `pnpm check`

#### Manual

- [ ] 2.4 None for this phase

### Phase 3: Dashboard UI

#### Automated

- [ ] 3.1 Co-located overlay unit tests pass
- [ ] 3.2 `pnpm test`
- [ ] 3.3 `pnpm check`

#### Manual

- [ ] 3.4 Kickoff readiness before suggestion card; skip shows Steady-scored suggestion
- [ ] 3.5 Post-check-in readiness after break; no cycle-complete flash
- [ ] 3.6 Wind-down continue shows readiness before suggestion

### Phase 4: E2E, catch-up, and roadmap sync

#### Automated

- [ ] 4.1 `set CI=true && pnpm test:e2e e2e/session-kickoff.spec.ts e2e/task-suggestion.spec.ts`
- [ ] 4.2 `pnpm test`
- [ ] 4.3 `pnpm check`

#### Manual

- [ ] 4.4 Tab-return catch-up during readiness gate
- [ ] 4.5 Check-in test IDs unchanged (`check-in-energy-*`)
