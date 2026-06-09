# Fix Cycle End Audio Toggle (B-01) Implementation Plan

## Overview

Restore immediate response for **Cycle end audio** Normal / Soft / Muted toggles on the timer panel (S-20 regression, [#72](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/72)). The server-reconciliation `useEffect` in `useCycleEndAudioPreference` re-enters on `suggestionFetchInFlight` transitions and overwrites optimistic `setMode` state with stale `preferenceQuery.data`. Fix sync semantics in the hook only; add hook unit coverage and live-click E2E regression for auth and guest paths.

## Current State Analysis

Authenticated users click a toggle → `setMode` updates state and localStorage optimistically → `preference.set` is deferred behind `waitUntilSuggestionIdle` → the server-sync effect re-fires (often because `suggestionFetchInFlight` flips during kickoff/post-check-in suggestion fetches) → `setModeState(serverMode)` runs with uncached stale query data → UI snaps back and clicks appear dead. UI wiring (`CycleAudioPreferenceControl`, `TimerPanel`) is correct. Guest path skips server-sync but shares effect dependency cleanup benefits. Existing E2E specs seed preference via API/localStorage and assert `aria-pressed` on load — they never click toggle buttons.

### Key Discoveries:

- `src/hooks/use-cycle-end-audio-preference.ts:82-129` — re-entrant server-sync effect; unconditional overwrite at 118-119
- `src/hooks/use-cycle-end-audio-preference.ts:131-143` — optimistic `setMode`; no `onSuccess` cache write
- `src/lib/trpc/suggestion-priority.ts:27-40` — `beginSuggestionFetch` drives `suggestionFetchInFlight` churn on auth dashboard
- `e2e/quiet-cycle-audio.spec.ts` / `e2e/guest-quiet-cycle-audio.spec.ts` — seed-only; no live toggle interaction
- `src/hooks/use-task-mutations.test.tsx` — established pattern for hook + tRPC mock unit tests

## Desired End State

1. **Immediate acknowledgement:** Clicking any toggle updates `aria-pressed` within 200ms (NFR) without pre-seeding preference via API or localStorage.
2. **Persistence:** Auth — selection survives page reload via server profile; guest — via `flowstate:cycleEndAudio:guest` localStorage.
3. **No regression:** Suggestion-priority serialization (`waitUntilSuggestionIdle`, link gating) and guest→auth merge on first sign-in still work.
4. **Regression lock:** Hook unit test proves mode survives `suggestionFetchInFlight` flip during `setMode`; E2E proves live-click cycle for auth and guest.

### Acceptance Criteria (B-01 / FR-013 / FR-014)

| Criterion | Ref | Verification |
|-----------|-----|--------------|
| Toggle responds on click | B-01 outcome | E2E live-click + manual |
| Preference persists across refresh | B-01 outcome | E2E reload (auth Soft); guest localStorage read |
| Cycle-end chime respects mode | FR-013 | Existing seeded muted e2e unchanged |
| Transition overlays unchanged | FR-014 | Existing quiet-cycle + background-tab e2e pass |
| 200ms acknowledgement | NFR | Optimistic UI; no await before `setModeState` |

## What We're NOT Doing

- Changes to `CycleAudioPreferenceControl`, `TimerPanel`, or `pomodoro-dashboard` wiring
- Backend `preference` router or Prisma schema changes
- New toast/error UI for `preference.set` failures
- Continuous volume slider or break-end pulse
- Broad refactor of suggestion-priority link or `use-pomodoro-cycle`
- Fixing unrelated optimistic delays (B-03 cycle start/interrupt)

## Implementation Approach

Two phases: (1) guard the server-sync effect so it runs at most once per scope for unconditional server overwrite, add `setMutation` cache coherence, and stabilize effect dependencies; (2) add hook unit test and live-click E2E specs. Preserve `waitUntilSuggestionIdle` in both sync and `setMode` paths — only sync *semantics* change, not serialization.

## Critical Implementation Details

**One-time sync per scope:** Reset `hasInitialSyncRef` in the existing scope-change effect (`isGuest` / `userId` deps) alongside `guestMergeAttemptedRef`. After the first successful reconcile (guest-merge branch or `setModeState(serverMode)` path), set `hasInitialSyncRef = true` and skip lines 118-119 on all subsequent effect runs. This directly stops the `suggestionFetchInFlight` re-entry overwrite without removing the dependency (query gating still needs it).

**Mutation cache write:** Configure `setMutation` with `onSuccess` calling `utils.preference.get.setData(undefined, { cycleEndAudioMode: variables.cycleEndAudioMode })` so any incidental query read cannot serve stale server mode.

**Effect deps:** Remove `setMutation` from the sync effect dependency array. Guest-merge path should call `mutateAsync` via the mutation options object or a ref-stable wrapper — do not re-add `setMutation` identity to deps.

**Mutation failure:** Keep optimistic UI on `preference.set` error (matches pre-regression behavior). No rollback or toast in this bug-fix scope.

---

## Phase 1: Hook sync guard and cache coherence

### Overview

Stop the server-sync effect from overwriting user edits after initial reconcile; keep guest-merge and suggestion-idle coordination intact.

### Changes Required:

#### 1. Sync guard refs and scope reset

**File**: `src/hooks/use-cycle-end-audio-preference.ts`

**Intent**: Ensure server reconciliation runs once per auth scope for the unconditional overwrite path; reset guards when `userId` or guest/authenticated mode changes.

**Contract**: Add `hasInitialSyncRef` (`useRef(false)`). In the scope-change effect (lines 64-73), reset `hasInitialSyncRef.current = false` alongside `guestMergeAttemptedRef`. In the server-sync effect, set `hasInitialSyncRef.current = true` on every successful reconcile exit: (a) guest-merge branch — set ref immediately before the early `return` at lines 112-114 after `setIsHydrated(true)`; (b) default branch — set ref after the first `setModeState(serverMode)` + `writeCycleEndAudioMode` (lines 118-119). At the top of the async reconcile body (after idle wait and merge-gen check), if `hasInitialSyncRef.current` is true, return before lines 118-119.

#### 2. Mutation onSuccess cache update

**File**: `src/hooks/use-cycle-end-audio-preference.ts`

**Intent**: Align React Query cache with user selection immediately after successful `preference.set` so stale `preferenceQuery.data` cannot revert UI if sync logic is ever extended.

**Contract**: Declare `const utils = api.useUtils()` before the mutation hook (same ordering as `use-task-mutations.ts`). Replace bare `api.preference.set.useMutation()` with options including `onSuccess: (_data, variables) => utils.preference.get.setData(undefined, { cycleEndAudioMode: variables.cycleEndAudioMode })`.

#### 3. Stabilize sync effect dependencies

**File**: `src/hooks/use-cycle-end-audio-preference.ts`

**Intent**: Prevent spurious effect re-runs from mutation object identity changes.

**Contract**: Remove `setMutation` from the sync effect dependency array (lines 122-129). Guest-merge `mutateAsync` call remains inside the effect but uses the mutation hook instance without listing it as a dep (eslint exhaustive-deps exception comment if required).

#### 4. Hook unit test — sync overwrite race

**File**: `src/hooks/use-cycle-end-audio-preference.test.tsx` (new)

**Intent**: Lock the regression: `setMode` selection survives a `suggestionFetchInFlight` flip that previously re-triggered server overwrite.

**Contract**: Mock `~/trpc/react` (`preference.get.useQuery`, `preference.set.useMutation`) and `~/lib/trpc/suggestion-priority` (`beginSuggestionFetch`, `resetSuggestionFetchPriorityForTests`). Render hook with authenticated scope. Simulate fetched query data `normal`, complete initial sync, call `setMode("soft")`, flip suggestion in-flight via `beginSuggestionFetch` + dispose, assert `result.current.mode` stays `"soft"`. Second test: guest scope `setMode` updates without server calls.

### Success Criteria:

#### Automated Verification:

- Hook unit tests pass: `pnpm exec vitest run src/hooks/use-cycle-end-audio-preference.test.tsx`
- Full unit suite passes: `pnpm test`
- Lint/format passes: `pnpm check`
- Typecheck passes: `pnpm typecheck`

#### Manual Verification:

- Auth dashboard: focus task, click Normal → Soft → Muted; each click updates active button immediately
- Auth with suggestion gate active: toggle during/after kickoff suggestion load still responds
- Guest: same live-click sequence on timer panel
- Guest→auth sign-in with non-default guest localStorage still merges once (smoke)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Live-click E2E regression (auth + guest)

### Overview

Close the test gap identified in research: assert toggle interaction via real clicks, not API/localStorage seed alone.

### Changes Required:

#### 1. Auth live-toggle spec

**File**: `e2e/quiet-cycle-audio.spec.ts`

**Intent**: Prove authenticated user can change cycle-end audio mode by clicking toggles without pre-seeding `preference.set`.

**Contract**: New test `"live toggle updates aria-pressed for each mode (B-01)"`. Flow: `addTask` + `focusTask` → assert `cycle-audio-preference-normal` has `aria-pressed="true"` (default) → click Soft → assert `cycle-audio-preference-soft` pressed → click Muted → assert muted pressed → click Normal → assert normal pressed. Do not call `setAuthMutedPreference`. Persistence: reload after selecting Soft, wait for `cycle.getActive` (same pattern as `setAuthMutedPreference`), assert Soft still pressed.

#### 2. Guest live-toggle spec

**File**: `e2e/guest-quiet-cycle-audio.spec.ts`

**Intent**: Prove guest live-click path; do not seed `GUEST_MUTED_KEY` in this test (use fresh guest from `beforeEach` without muted init script override, or dedicated test with cleared key).

**Contract**: Add nested `test.describe("live toggle (B-01)")` with its own `beforeEach` that does **not** seed `GUEST_MUTED_KEY` (parent `beforeEach` seeds muted for hidden-expiry tests only). New test `"guest live toggle updates aria-pressed for each mode (B-01)"`: `clearOnboardingKeys` + `page.evaluate(() => localStorage.removeItem("flowstate:cycleEndAudio:guest"))` before focus. Flow mirrors auth: add task, focus, click Soft → Muted → Normal, assert `aria-pressed` after each click. Verify `localStorage` key `flowstate:cycleEndAudio:guest` reflects final selection via `page.evaluate`.

#### 3. Test-plan cookbook note

**File**: `context/foundation/test-plan.md`

**Intent**: Document live-click pattern alongside existing seed-only quiet-cycle audio entry (§6).

**Contract**: Append to S-20 quiet-cycle audio cookbook bullet: live-toggle regression in same spec files; pattern = focus task → click `cycle-audio-preference-{mode}` → assert `aria-pressed`.

### Success Criteria:

#### Automated Verification:

- Auth quiet-cycle e2e passes: `set CI=true && pnpm exec playwright test e2e/quiet-cycle-audio.spec.ts`
- Guest quiet-cycle e2e passes: `set CI=true && pnpm exec playwright test e2e/guest-quiet-cycle-audio.spec.ts`
- Full check passes: `pnpm check`

#### Manual Verification:

- Confirm existing seeded muted + hidden-expiry tests still pass in same files (if CI flakes on suggestion-idle timing during live-toggle, review Playwright trace before changing assertions)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- Hook: initial sync from query, `setMode` survives `suggestionFetchInFlight` re-entry, guest `setMode` without server
- Existing: `storage.test.ts`, `preference.test.ts` — must remain green

### Integration / E2E:

- Live-click toggle (auth + guest) — new B-01 regression
- Existing seeded muted + S-22 catch-up tests — regression guard

### Manual Testing Steps:

1. Auth: focus task, rapid-click all three toggles — no snap-back
2. Auth: select Soft, hard refresh — still Soft
3. Guest: select Muted, refresh — still Muted
4. Auth with active suggestion fetch: toggle still responds within 200ms

## Performance Considerations

Negligible — one fewer unconditional state write per suggestion fetch cycle. No new network calls.

## Migration Notes

None. Server data unchanged; fix is client hook semantics only.

## References

- Research: `context/changes/fix-cycle-audio-toggle/research.md`
- Roadmap B-01: `context/foundation/roadmap.md`
- PRD FR-013/FR-014: `context/foundation/prd.md`
- S-20 original plan: `context/archive/2026-06-08-persistent-quiet-cycle-audio/plan.md`
- Hook under repair: `src/hooks/use-cycle-end-audio-preference.ts:82-129`
- E2E exemplar: `e2e/seed.spec.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Hook sync guard and cache coherence

#### Automated

- [ ] 1.1 Hook unit tests pass: `pnpm exec vitest run src/hooks/use-cycle-end-audio-preference.test.tsx`
- [ ] 1.2 Full unit suite passes: `pnpm test`
- [ ] 1.3 Lint/format passes: `pnpm check`
- [ ] 1.4 Typecheck passes: `pnpm typecheck`

#### Manual

- [ ] 1.5 Auth dashboard live-click Normal → Soft → Muted responds immediately
- [ ] 1.6 Auth toggle responds during/after suggestion gate activity
- [ ] 1.7 Guest live-click sequence responds on timer panel
- [ ] 1.8 Guest→auth merge smoke with non-default guest localStorage

### Phase 2: Live-click E2E regression (auth + guest)

#### Automated

- [ ] 2.1 Auth quiet-cycle e2e passes: `set CI=true && pnpm exec playwright test e2e/quiet-cycle-audio.spec.ts`
- [ ] 2.2 Guest quiet-cycle e2e passes: `set CI=true && pnpm exec playwright test e2e/guest-quiet-cycle-audio.spec.ts`
- [ ] 2.3 Full check passes: `pnpm check`

#### Manual

- [ ] 2.4 Existing seeded muted + hidden-expiry tests still pass in same spec files (review trace on live-toggle flake)
