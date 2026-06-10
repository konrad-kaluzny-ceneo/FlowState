# Pre-suggestion Readiness Gate (S-25) Implementation Plan

## Overview

Add an authenticated kickoff readiness gate so users declare Focused / Steady / Fading before the first `suggestion.next` kickoff fetch — replacing the S-15 synthetic `STEADY` hardcode with caller-supplied energy. Post-check-in suggestion already satisfies FR-020 via S-05 check-in; this slice adds the missing kickoff path only and verifies the post-check-in path unchanged.

## Current State Analysis

S-15 ships kickoff suggestions with server-side `energy: "STEADY"` hardcoded (`suggestion.ts:224-229`) and client eager fetch on `kickoffEligible` transition (`use-pomodoro-cycle.ts:876-893`) — no user energy declaration. S-05 `CheckInOverlay` already captures energy after each cycle; post-check-in `suggestion.next` reads `cycle.checkIn.energy` (`suggestion.ts:156-161`). Adding a second gate on the post-check-in path would violate roadmap risk Q2 and duplicate S-05.

### Key Discoveries:

- Only production STEADY literal is kickoff branch in `buildScoringContextForSession(..., "STEADY")` — post-check-in path is already dynamic
- `CheckInOverlay` owns three energy buttons with stable test IDs (`check-in-energy-*`) reusable via extraction
- `kickoffEligible` already excludes `awaitingCheckIn`, `awaitingWindDown`, and active post-check-in suggestion — readiness mounts only at idle wedge moments
- S-15 lesson: keep separate `suggestionNextKickoff` mutation hook — do not merge with post-check-in mutation
- L-04: readiness tap/skip must dismiss overlay within 200ms before awaiting network

## Desired End State

1. Authenticated user lands session-start or post-break idle with active tasks → kickoff readiness overlay appears (Focused / Steady / Fading + Skip — use Steady) before any kickoff `suggestion.next` call.
2. User selects energy or skips → overlay dismisses immediately; kickoff suggestion card loads with scorer using declared energy (skip → `STEADY`).
3. Skip does **not** write a `CheckIn` row — energy is session-scoped for the API call only.
4. Post-check-in break suggestion path unchanged: check-in overlay remains the sole energy gate; no readiness overlay after cycle complete.
5. Guest dashboard unchanged — no readiness overlay, no kickoff API calls.
6. Verification: `pnpm check`, `pnpm test`, `set CI=true && pnpm test:e2e e2e/session-kickoff.spec.ts`, post-check-in regression in `e2e/task-suggestion.spec.ts`.

## What We're NOT Doing

- Post-check-in readiness overlay (S-05 check-in is the gate — research 92% confidence)
- Guest-mode readiness or kickoff changes
- Persisting skipped kickoff energy to `CheckIn` or server-side session fields
- Reusing last cycle check-in energy at post-break kickoff (user re-declares)
- Inline energy chips on `TaskSuggestionCard` (overlay pattern matches S-05)
- Changing kickoff rationale keys (`kickoff_fresh` / `kickoff_resume` stay; task selection reflects energy)
- Post-check-in `suggestion.next` schema change (energy remains from DB check-in)
- Merging kickoff and post-check-in tRPC mutation hooks

## Implementation Approach

Six phases: API contract first (server accepts required kickoff `energy`), then UI extraction + hook gate (defer eager fetch), then unit/component tests, then e2e with updated helpers, then post-check-in regression proof, then test-plan cookbook update. API lands before client so type errors force complete wiring.

## Critical Implementation Details

**Gate sequencing:** On `kickoffEligible` false→true, set `awaitingKickoffReadiness(true)` instead of calling `fetchKickoffSuggestion`. Clear readiness on `start()`, session end, accept/override kickoff paths, and when post-check-in suggestion takes over. Never show readiness when `awaitingCheckIn`, `awaitingWindDown`, or `isPostCheckInTransitioning`.

**L-04 dismiss-before-fetch:** `submitKickoffReadiness` and `skipKickoffReadiness` must synchronously clear `awaitingKickoffReadiness` and disable buttons before `awaiting fetchKickoffSuggestion`. Hook unit test asserts overlay-gone / state-cleared within 200ms without awaiting mutation resolution.

**Separate mutation hook:** Continue using `suggestionNextKickoff` (`use-pomodoro-cycle.ts:253`) — pass `energy` in mutate payload; do not share hook instance with post-check-in fetch.

## Phase 1: API — Kickoff Energy Input

### Overview

Extend kickoff branch of `suggestion.next` with required `energy`; replace STEADY hardcode with `input.energy`; prove scoring differs by energy in router tests.

### Changes Required:

#### 1. Kickoff input schema

**File**: `src/server/api/routers/suggestion.ts`

**Intent**: Kickoff callers must declare energy; post-check-in branch unchanged.

**Contract**: Add `energy: z.enum(["FOCUSED", "STEADY", "FADING"])` to kickoff object in `nextInputSchema` discriminated union. Mirror `check-in.ts:20` enum values.

#### 2. Kickoff handler — pass through energy

**File**: `src/server/api/routers/suggestion.ts`

**Intent**: Feed declared energy into scorer instead of synthetic STEADY.

**Contract**: Replace `"STEADY"` literal at kickoff `buildScoringContextForSession` call with `input.energy`. Post-check-in branch continues reading energy from `CheckIn` row — no schema or logic change.

#### 3. Router unit tests

**File**: `src/server/api/routers/suggestion.test.ts`

**Intent**: Lock kickoff energy contract and prove scorer sensitivity before client work.

**Contract**: Update **all** kickoff `next()` call sites in this file (8 today — e.g. lines 577, 600, 614, 620, 646, 662, 753, 760) to pass explicit `energy`. Add case: same task pool with `FOCUSED` vs `FADING` yields different `taskId` winner when type-fit dominates (e.g. DEEP_WORK vs REACTIVE pool). Assert kickoff input without `energy` fails validation. Post-check-in tests unchanged.

### Success Criteria:

#### Automated Verification:

- `pnpm check` passes
- `pnpm typecheck` passes
- `pnpm exec vitest run src/server/api/routers/suggestion.test.ts` passes

#### Manual Verification:

- Kickoff `next` rejects missing `energy` at tRPC layer (dev console or temporary call)

**Implementation Note**: Pause for manual confirmation before Phase 2.

---

## Phase 2: EnergySelector + KickoffReadinessOverlay + Hook Gate

### Overview

Extract shared energy button group from check-in; add kickoff readiness overlay with skip; introduce `awaitingKickoffReadiness` hook state and defer eager kickoff fetch until energy declared or skipped.

### Changes Required:

#### 1. Extract EnergySelector

**File**: `src/app/_components/energy-selector.tsx` (new)

**Intent**: Single source for Focused / Steady / Fading buttons shared by check-in and kickoff readiness.

**Contract**: Export `EnergySelector` with props: `onSelect(energy: CheckInEnergy)`, `disabled?: boolean`, optional `coachLine`. Move `CheckInEnergy` / `CheckInEnergyUi` types here (re-export from `check-in-overlay.tsx` for backward compat). Preserve existing `data-testid` values (`check-in-energy-focused`, `check-in-energy-steady`, `check-in-energy-fading`) so `e2e/helpers/check-in.ts` keeps working.

#### 2. Refactor CheckInOverlay

**File**: `src/app/_components/check-in-overlay.tsx`

**Intent**: Check-in overlay delegates button row to `EnergySelector`; no behavior change.

**Contract**: Replace inline button map with `<EnergySelector onSelect={onSubmit} disabled={isSubmitting} coachLine={coachLine} />`. Keep `data-testid="check-in-overlay"`, headline, and subcopy unchanged.

#### 3. KickoffReadinessOverlay

**File**: `src/app/_components/kickoff-readiness-overlay.tsx` (new)

**Intent**: Full-screen gate before kickoff fetch with kickoff-specific copy and skippable Steady default.

**Contract**: Props: `onSubmit(energy: CheckInEnergy)`, `onSkip()`, `isSubmitting?: boolean`. `data-testid="kickoff-readiness-overlay"`. Headline e.g. "How's your energy to start?"; subcopy distinct from check-in. Render `EnergySelector` + secondary **Skip — use Steady** button (`data-testid="kickoff-readiness-skip-btn"`). Skip calls `onSkip()` without persisting CheckIn.

#### 4. Hook — awaitingKickoffReadiness state

**File**: `src/hooks/use-pomodoro-cycle.ts`

**Intent**: Gate kickoff fetch behind user energy declaration; satisfy L-04 dismiss-before-network.

**Contract**: Add `awaitingKickoffReadiness` boolean state. Extend `kickoffEligible` with `!isPostCheckInTransitioning`. Replace eager `fetchKickoffSuggestion` in `kickoffEligible` effect with `setAwaitingKickoffReadiness(true)` after `getOrCreateActive` — skip re-entry when `awaitingKickoffReadiness` is already true or `pendingKickoffSuggestion.status !== "idle"`. On `getOrCreateActive` failure, set `pendingKickoffSuggestion({ status: "error" })` without opening readiness. Add `submitKickoffReadiness(energy)` and `skipKickoffReadiness()` — both synchronously clear `awaitingKickoffReadiness`, then call `fetchKickoffSuggestion(sessionId, energy)` (`skip` → `"STEADY"`). Extend `fetchKickoffSuggestion` signature to accept `energy` and include in `suggestionNextKickoff.mutateAsync` payload. Clear readiness on `start()`, session end, kickoff accept/override, and when post-check-in suggestion activates. Expose new state/actions on hook return.

#### 5. Dashboard mount

**File**: `src/app/_components/pomodoro-dashboard.tsx`

**Intent**: Show kickoff readiness overlay at idle wedge; never alongside check-in or wind-down.

**Contract**: Render `KickoffReadinessOverlay` when `enableSuggestionGate && pomodoro.awaitingKickoffReadiness && !pomodoro.awaitingCheckIn && !pomodoro.awaitingWindDown && !pomodoro.isPostCheckInTransitioning`. Wire `onSubmit` → `submitKickoffReadiness`, `onSkip` → `skipKickoffReadiness`. Do not mount for guest (`enableSuggestionGate` auth-only).

### Success Criteria:

#### Automated Verification:

- `pnpm check` passes
- `pnpm typecheck` passes

#### Manual Verification:

- Dev: session-start idle shows readiness overlay before kickoff card
- Skip dismisses overlay immediately; kickoff card appears
- Energy tap dismisses overlay immediately; card reflects energy-sensitive pick (compare Fading vs Focused on mixed pool)
- Post-break idle triggers readiness again (not last check-in energy)
- Check-in overlay after cycle complete unchanged — no readiness flash

**Implementation Note**: Pause for manual confirmation before Phase 3.

---

## Phase 3: Hook Tests + Component Smoke

### Overview

Lock readiness gate behavior, energy pass-through, L-04 timing, and mutual exclusion with check-in in unit tests; add co-located component smoke for extracted UI.

### Changes Required:

#### 1. Hook unit tests — kickoff readiness

**File**: `src/hooks/use-pomodoro-cycle.test.tsx`

**Intent**: Prove deferred fetch, skip → STEADY, energy forwarded, and gate coordination without e2e.

**Contract**: Update existing `describe("kickoff suggestion eligibility")` tests (~line 1869) — they assume eager fetch; drive readiness via `submitKickoffReadiness` / `skipKickoffReadiness` before asserting `pendingKickoffSuggestion`. Add tests: `kickoffEligible` transition sets `awaitingKickoffReadiness` without `suggestion.next` call; `submitKickoffReadiness("FOCUSED")` calls mutate with `energy: "FOCUSED"`; `skipKickoffReadiness()` calls mutate with `energy: "STEADY"`; no `checkIn.create` on skip; readiness cleared within 200ms of submit/skip (fake timers or `performance.now` bound); `awaitingCheckIn` suppresses readiness; post-check-in fetch still uses check-in energy path unchanged.

#### 2. EnergySelector smoke

**File**: `src/app/_components/energy-selector.test.tsx` (new)

**Intent**: Guard unbounded button labels and test IDs after extraction.

**Contract**: Render three energy buttons with expected test IDs; `onSelect` fires with correct enum on click; disabled state blocks clicks.

#### 3. KickoffReadinessOverlay smoke

**File**: `src/app/_components/kickoff-readiness-overlay.test.tsx` (new)

**Intent**: Verify kickoff copy, skip button, and EnergySelector wiring.

**Contract**: Overlay visible with `kickoff-readiness-overlay` test id; skip button calls `onSkip`; energy button calls `onSubmit` with value.

### Success Criteria:

#### Automated Verification:

- `pnpm check` passes
- `pnpm exec vitest run src/hooks/use-pomodoro-cycle.test.tsx` passes (readiness cases)
- `pnpm exec vitest run src/app/_components/energy-selector.test.tsx src/app/_components/kickoff-readiness-overlay.test.tsx` passes

#### Manual Verification:

- CheckInOverlay still renders and submits after EnergySelector extraction

**Implementation Note**: Pause for manual confirmation before Phase 4.

---

## Phase 4: E2E Kickoff Readiness + Helpers

### Overview

Update session-kickoff e2e to complete readiness gate before asserting kickoff card; add reusable helper; prove FOCUSED vs skip paths end-to-end.

### Changes Required:

#### 1. Kickoff readiness helper

**File**: `e2e/helpers/kickoff.ts`

**Intent**: Centralize readiness interaction for all kickoff specs.

**Contract**: Add `completeKickoffReadiness(page, energy: CheckInEnergyUi | 'skip')` — wait for `kickoff-readiness-overlay`, tap energy test id or skip button, assert overlay hidden before proceeding. Export alongside existing kickoff helpers.

#### 2. Update waitForKickoffSuggestion

**File**: `e2e/helpers/kickoff.ts`

**Intent**: Prevent flake from expecting network before user completes gate.

**Contract**: `waitForKickoffSuggestion(page, options?: { readinessCompleted?: boolean })` — when `readinessCompleted` is not true (default), call `completeKickoffReadiness(page, 'skip')` first; when true, skip straight to network wait. Network wait still filters `"context":"kickoff"`.

#### 3. Session kickoff spec

**File**: `e2e/session-kickoff.spec.ts`

**Intent**: Prove readiness gate is part of kickoff wedge UX.

**Contract**: Update `prepareSessionStartKickoff` to complete readiness (default skip) before card assertions. Add scenario: select FOCUSED energy before kickoff card on mixed task pool (assert deep-work task wins). Existing accept/override/chip scenarios pass with readiness step inserted.

#### 4. Test IDs

**File**: `src/app/_components/kickoff-readiness-overlay.tsx` (verify from Phase 2)

**Intent**: Stable e2e selectors for overlay and skip.

**Contract**: `kickoff-readiness-overlay`, `kickoff-readiness-skip-btn` present and used by helpers.

### Success Criteria:

#### Automated Verification:

- `pnpm check` passes
- `pnpm test` passes
- `set CI=true && pnpm test:e2e e2e/session-kickoff.spec.ts` passes

#### Manual Verification:

- E2E failure message clearly distinguishes readiness vs suggestion timeouts

**Implementation Note**: Pause for manual confirmation before Phase 5.

---

## Phase 5: Post-check-in Path Regression

### Overview

Verify S-05/S-06 post-check-in suggestion path unchanged — no readiness overlay, check-in energy still drives scorer. Regression tests only; no new UI.

### Changes Required:

#### 1. Router regression

**File**: `src/server/api/routers/suggestion.test.ts`

**Intent**: Confirm post-check-in branch ignores kickoff energy input and reads CheckIn.

**Contract**: Existing post-check-in cases pass without modification; FOCUSED check-in → deep-work preference assertion still holds.

#### 2. Hook regression

**File**: `src/hooks/use-pomodoro-cycle.test.tsx`

**Intent**: Post-check-in flow never sets `awaitingKickoffReadiness`.

**Contract**: Test: after `submitCheckIn`, `awaitingKickoffReadiness` remains false; `fetchPostCheckInSuggestion` fires without readiness gate; break-running suggestion card path unchanged.

#### 3. E2E regression

**File**: `e2e/task-suggestion.spec.ts` (verify only)

**Intent**: Post-check-in suggestion e2e unaffected by kickoff readiness work.

**Contract**: Full spec passes without modification — no readiness overlay appears during check-in → break → suggestion flow.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/server/api/routers/suggestion.test.ts` passes (post-check-in cases)
- `pnpm exec vitest run src/hooks/use-pomodoro-cycle.test.tsx` passes (post-check-in cases)
- `set CI=true && pnpm test:e2e e2e/task-suggestion.spec.ts` passes

#### Manual Verification:

- Dev: complete work cycle → check-in only (no readiness) → break suggestion uses declared check-in energy

**Implementation Note**: Pause for manual confirmation before Phase 6.

---

## Phase 6: Test-plan Cookbook Update

### Overview

Update test-plan §6 session-kickoff entry to document readiness gate step and new helper — canonical pattern for future kickoff-related tests.

### Changes Required:

#### 1. Cookbook entry — session kickoff

**File**: `context/foundation/test-plan.md` §6

**Intent**: Future agents know readiness precedes kickoff card in e2e.

**Contract**: Extend existing S-15 session-kickoff bullet: note S-25 readiness overlay (`kickoff-readiness-overlay`) before `task-suggestion-card`; document `completeKickoffReadiness(page, energy | 'skip')` in helpers list; reference test for FOCUSED energy path if added in Phase 4; run command unchanged (`set CI=true && pnpm test:e2e e2e/session-kickoff.spec.ts`). Note post-check-in path uses check-in only — no readiness helper on `task-suggestion.spec.ts`.

### Success Criteria:

#### Automated Verification:

- `pnpm check` passes

#### Manual Verification:

- Cookbook entry accurately reflects helper names and test-id contract

**Implementation Note**: Slice complete after manual sign-off and ship via PR (Fixes #79).

---

## Testing Strategy

### Unit Tests:

- `suggestion.test.ts` — kickoff requires `energy`; FOCUSED vs FADING changes winner; post-check-in unchanged
- `use-pomodoro-cycle.test.tsx` — readiness gate, skip → STEADY, L-04 timing, check-in mutual exclusion
- `energy-selector.test.tsx`, `kickoff-readiness-overlay.test.tsx` — component smoke

### Integration Tests:

- Kickoff mutate payload includes `energy` (hook test with mocked tRPC)

### Manual Testing Steps:

1. Auth cold start with tasks → readiness → skip → kickoff card
2. Auth cold start → FOCUSED → deep-work task suggested on mixed pool
3. Post-break idle → readiness again (not auto STEADY from last check-in)
4. Complete cycle → check-in only → break suggestion (no readiness)
5. Guest mode → no readiness, no kickoff
6. Skip → no new row in `flow_state_check_in`

## Performance Considerations

Readiness adds one user tap before existing single kickoff tRPC call — no additional polling. Overlay dismiss is synchronous (L-04); network fetch runs after dismiss, same as check-in pattern.

## Migration Notes

No schema migration — kickoff `energy` is input-only. Existing kickoff clients (if any stale tabs) will fail validation until refresh — acceptable for unreleased contract extension.

## References

- Research: `context/changes/pre-suggestion-readiness/research.md`
- Roadmap S-25: `context/foundation/roadmap.md` (§ S-25)
- S-15 plan pattern: `context/archive/2026-06-08-session-kickoff-suggestion/plan.md`
- PRD FR-019/FR-020/FR-021: `context/foundation/prd.md`
- L-04: `context/foundation/lessons.md`
- Test-plan Risk #7: `context/foundation/test-plan.md`
- Kickoff STEADY hardcode: `src/server/api/routers/suggestion.ts:224-229`
- Eager kickoff fetch: `src/hooks/use-pomodoro-cycle.ts:876-893`
- Check-in overlay: `src/app/_components/check-in-overlay.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: API — Kickoff Energy Input

#### Automated

- [x] 1.1 `pnpm check` passes
- [x] 1.2 `pnpm typecheck` passes
- [x] 1.3 `pnpm exec vitest run src/server/api/routers/suggestion.test.ts` passes

#### Manual

- [ ] 1.4 Kickoff `next` rejects missing `energy` at tRPC layer

### Phase 2: EnergySelector + KickoffReadinessOverlay + Hook Gate

#### Automated

- [ ] 2.1 `pnpm check` passes
- [ ] 2.2 `pnpm typecheck` passes

#### Manual

- [ ] 2.3 Session-start idle shows readiness overlay before kickoff card
- [ ] 2.4 Skip dismisses overlay immediately; kickoff card appears
- [ ] 2.5 Energy tap dismisses overlay immediately; scorer reflects selection
- [ ] 2.6 Post-break idle triggers readiness again
- [ ] 2.7 Check-in overlay after cycle complete unchanged

### Phase 3: Hook Tests + Component Smoke

#### Automated

- [ ] 3.1 `pnpm check` passes
- [ ] 3.2 `pnpm exec vitest run src/hooks/use-pomodoro-cycle.test.tsx` passes (readiness cases)
- [ ] 3.3 `pnpm exec vitest run src/app/_components/energy-selector.test.tsx src/app/_components/kickoff-readiness-overlay.test.tsx` passes

#### Manual

- [ ] 3.4 CheckInOverlay still renders and submits after extraction

### Phase 4: E2E Kickoff Readiness + Helpers

#### Automated

- [ ] 4.1 `pnpm check` passes
- [ ] 4.2 `pnpm test` passes
- [ ] 4.3 `set CI=true && pnpm test:e2e e2e/session-kickoff.spec.ts` passes

#### Manual

- [ ] 4.4 E2E failure messages distinguish readiness vs suggestion timeouts

### Phase 5: Post-check-in Path Regression

#### Automated

- [ ] 5.1 `pnpm exec vitest run src/server/api/routers/suggestion.test.ts` passes (post-check-in cases)
- [ ] 5.2 `pnpm exec vitest run src/hooks/use-pomodoro-cycle.test.tsx` passes (post-check-in cases)
- [ ] 5.3 `set CI=true && pnpm test:e2e e2e/task-suggestion.spec.ts` passes

#### Manual

- [ ] 5.4 Dev: check-in only path — no readiness overlay before break suggestion

### Phase 6: Test-plan Cookbook Update

#### Automated

- [ ] 6.1 `pnpm check` passes

#### Manual

- [ ] 6.2 Cookbook entry reflects readiness helper and test-id contract
