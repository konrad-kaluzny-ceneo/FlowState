# Fix Closure Kickoff Mutex (B-05 / T-01) Implementation Plan

## Overview

Enforce mutual exclusion between session closure and kickoff readiness / check-in on the same visit. T-01 manifests as `SessionClosureOverlay` (z=58) flashing or being covered by `KickoffReadinessOverlay` or `CheckInOverlay` (z=60) due to (1) independent dashboard render guards and (2) an unguarded async `getOrCreateActive` in the kickoff eligibility effect that can reopen readiness after `endSession()`. This is a narrow B-05 hotfix ahead of F-07 `wedge-transition-conductor`.

## Current State Analysis

**Dashboard mutex gap** — `pomodoro-dashboard.tsx` renders `KickoffReadinessOverlay` when `awaitingKickoffReadiness` without checking `pendingClosureLine`; `CheckInOverlay` has the same gap. Closure renders whenever `pendingClosureLine != null` with no reciprocal guard.

**Hook async race** — The kickoff eligibility `useEffect` (`use-pomodoro-cycle.ts:1082–1115`) calls `sessions.getOrCreateActive()` and unconditionally `setAwaitingKickoffReadiness(true)` on resolve. `endSession()` calls `clearKickoffSuggestion()` (bumps `kickoffFetchGenRef`) but the eligibility effect never reads the generation token.

**Test gaps** — `pomodoro-dashboard.test.tsx` covers closure alone and kickoff suggestion card but not kickoff-readiness-overlay + closure mutex. `use-pomodoro-cycle.test.tsx` covers `endSession` + closure but not in-flight `getOrCreateActive`. Belt `e2e/session-closure.spec.ts:45` masks T-01 via `dismissKickoffReadinessIfVisible` before end session.

## Desired End State

After implementation:

1. User ends session → closure overlay shows → user dismisses → **no** kickoff readiness or check-in overlay on the same visit.
2. If kickoff eligibility async was in flight when `endSession()` runs, stale callback does not set `awaitingKickoffReadiness`.
3. While `pendingClosureLine` is set, dashboard never renders kickoff readiness or check-in overlays (even if hook flags are briefly true).
4. Vitest characterization tests document both failure modes; belt `session-closure.spec.ts` asserts `kickoff-readiness-overlay` count 0 after closure dismiss without pre-dismiss helper.

### Key Discoveries:

- `kickoffFetchGenRef` already aborts stale `fetchKickoffSuggestion` calls (`use-pomodoro-cycle.ts:1007,1021`); eligibility effect is the gap (`:1082–1109`).
- `clearKickoffSuggestion()` on `endSession` already increments gen (`:846–854`) — no new abort state needed.
- B-05 outcome explicitly includes check-in stacking (`B-05.md`); wind-down + suggestion stacking remains F-07 scope.
- Parent `refactor-opportunities` plan mandates characterization-first commit order and mechanism/enforcement split.

## What We're NOT Doing

- F-07 `wedge-transition-conductor` module or full overlay priority matrix
- Wind-down + suggestion stacking (other T-01-adjacent pairs)
- B-06 timeout-on-load closure fix (`fix-timeout-closure-on-load`)
- Guest-mode kickoff (authenticated-only path)
- `showInFlowSummary` suppression during closure
- `session-return-handoff.spec.ts` post-closure kickoff assertion (deferred)
- `wasClosureShown` sessionStorage gating in `kickoffEligible`

## Implementation Approach

Four reversible commits following parent implementation discipline: characterization (failing oracle) → hook mechanism (gen guard + predicate) → dashboard enforcement (mutex guards) → belt assertion. Hook fixes the async race; dashboard guards prevent simultaneous render when both flags are true; predicate update avoids unnecessary `getOrCreateActive` during closure.

## Critical Implementation Details

**Generation token semantics:** Capture `kickoffFetchGenRef.current` at the start of the eligibility async IIFE — do **not** pre-increment (unlike `fetchKickoffSuggestion`, which increments when starting a new fetch). `clearKickoffSuggestion()` on `endSession` increments the ref; the async callback must compare captured `gen` to `kickoffFetchGenRef.current` before `setAwaitingKickoffReadiness(true)` and `setActiveSessionId`.

**Commit boundaries:** Dashboard char tests fail after hook-only commit (mechanism green, enforcement missing) — that is expected until Phase 3 lands.

## Phase 1: Characterization (T-01 oracle)

### Overview

Land Vitest tests that document current buggy behavior for both failure modes. Tests must fail against production code until Phases 2–3 enforce the fix. No production changes in this commit.

### Changes Required:

#### 1. Dashboard mutex characterization

**File**: `src/app/_components/pomodoro-dashboard.test.tsx`

**Intent**: Pin T-01 dashboard symptom — kickoff readiness and check-in overlays must not render while closure is pending.

**Contract**: Add tests under existing `PomodoroDashboardBody` describe block using `makePomodoroMock` with **explicit `render()`** (not default `renderBody()` — it hardcodes `enableSuggestionGate: false` and `enableCheckInGate: false` at `:119–123`). Follow the check-in overlay test pattern at `:142–158` to pass gate props.

- **During closure:** When `pendingClosureLine` is non-null AND `awaitingKickoffReadiness` is true, render with `enableSuggestionGate` — `kickoff-readiness-overlay` must **not** be in the document. Closure overlay remains visible.
- **During closure (check-in):** When `pendingClosureLine` is non-null AND `awaitingCheckIn` is true with `activeCycle` set, render with `enableCheckInGate` — `check-in-overlay` must **not** be in the document.
- **After dismiss (dashboard layer):** When `pendingClosureLine` is null but `awaitingKickoffReadiness` is true after simulated closure dismiss path, kickoff overlay may render — this case is owned by hook race test; optional dashboard smoke only if it adds signal without duplicating hook test.

Tests fail on current code (kickoff renders without `!pendingClosureLine` guard).

#### 2. Hook async race characterization

**File**: `src/hooks/use-pomodoro-cycle.test.tsx`

**Intent**: Pin T-01 hook symptom — `endSession()` during in-flight `getOrCreateActive` must not leave `awaitingKickoffReadiness` true after the promise resolves.

**Contract**: Add test inside existing `"kickoff readiness gate"` describe (`:2298+`). Pattern: deferred `getOrCreateSession` promise (mirror L-04 blocked-mutate tests at `:2389+`); establish kickoff eligibility (idle authenticated path with `taskListQuery` returning active tasks — existing kickoff tests at `:2299`); call `endSession()` while `getOrCreateActive` is unresolved; release promise; assert `awaitingKickoffReadiness` is **false** and `pendingClosureLine` is set. Test fails on current unguarded effect.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/app/_components/pomodoro-dashboard.test.tsx` — new mutex tests exist and **fail** (expected red)
- `pnpm exec vitest run src/hooks/use-pomodoro-cycle.test.tsx` — new race test exists and **fail** (expected red)
- `pnpm check` passes (test-only commit)

#### Manual Verification:

- Review failing test output confirms oracle matches T-01 symptom (kickoff overlay query returns element; hook readiness true after late resolve)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the failing tests document the intended bug before proceeding to Phase 2.

---

## Phase 2: Hook mechanism (gen guard + predicate)

### Overview

Fix the async race in the kickoff eligibility effect and prevent eligibility while closure is pending. Dashboard guards remain unchanged — dashboard char tests still fail until Phase 3.

### Changes Required:

#### 1. Kickoff eligibility generation guard

**File**: `src/hooks/use-pomodoro-cycle.ts`

**Intent**: Abort stale eligibility `getOrCreateActive` callbacks when `endSession()` invalidates via `clearKickoffSuggestion()`.

**Contract**: In eligibility `useEffect` (`:1082–1109`), inside the async IIFE: capture `const gen = kickoffFetchGenRef.current` before `await sessions.getOrCreateActive()`; after resolve (and in error path before setting error state if applicable), return early if `gen !== kickoffFetchGenRef.current` before `setActiveSessionId` / `setAwaitingKickoffReadiness(true)`.

#### 2. Kickoff eligible predicate

**File**: `src/hooks/use-pomodoro-cycle.ts`

**Intent**: Short-circuit kickoff eligibility while closure overlay is pending — defense in depth with dashboard guards.

**Contract**: Add `pendingClosureLine == null` to `kickoffEligible` predicate (`:1070–1080`). Add `pendingClosureLine` to the effect dependency array if required for exhaustive-deps correctness.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/hooks/use-pomodoro-cycle.test.tsx` — race characterization test **passes**; existing kickoff suite green
- `pnpm test` passes
- `pnpm check` passes

#### Manual Verification:

- Dashboard mutex char tests still **fail** (expected — enforcement not landed)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 3.

---

## Phase 3: Dashboard enforcement (mutex guards)

### Overview

Add `!pendingClosureLine` to kickoff and check-in overlay render guards so closure always wins the z-index stack at the UI layer.

### Changes Required:

#### 1. Kickoff readiness guard

**File**: `src/app/_components/pomodoro-dashboard.tsx`

**Intent**: Prevent kickoff readiness overlay from rendering while session closure is showing.

**Contract**: Extend kickoff guard (`:371–375`) with `!pomodoro.pendingClosureLine` (or equivalent null check on `pendingClosureLine`).

#### 2. Check-in guard

**File**: `src/app/_components/pomodoro-dashboard.tsx`

**Intent**: Prevent check-in overlay from rendering while session closure is showing — matches B-05 outcome.

**Contract**: Extend check-in guard (`:397–399`) with `!pomodoro.pendingClosureLine`.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/app/_components/pomodoro-dashboard.test.tsx` — all tests pass including Phase 1 mutex tests
- `pnpm exec vitest run src/hooks/use-pomodoro-cycle.test.tsx` — all tests pass
- `pnpm test` passes
- `pnpm check` passes
- `pnpm typecheck` passes

#### Manual Verification:

- Local: start work cycle → end session while running → closure visible with no kickoff overlay on top → dismiss → idle calm (no immediate kickoff popup on same visit)

**Implementation Note**: After completing this phase and manual verification, proceed to Phase 4.

---

## Phase 4: Belt assertion (session-closure.spec.ts)

### Overview

Remove the belt mask that hides T-01 and assert kickoff readiness stays absent after closure dismiss on the same visit.

### Changes Required:

#### 1. Session closure belt spec

**File**: `e2e/session-closure.spec.ts`

**Intent**: Belt must prove T-01 fix — not mask kickoff before end session.

**Contract**:

- **Drop the interrupt step** (lines 40–43) and click `end-session-btn` while the cycle is still running — `endSession()` auto-interrupts per hook (`use-pomodoro-cycle.ts:2087–2103`). This avoids post-interrupt idle kickoff (legitimate product path) blocking navigation without masking T-01.
- Remove `await dismissKickoffReadinessIfVisible(page)` at line 45
- Remove unused `dismissKickoffReadinessIfVisible` import from `./helpers/idle-cycle` (line 8) if no longer referenced
- After closure dismiss assertion (`:55–57`), add `await expect(page.getByTestId("kickoff-readiness-overlay")).toHaveCount(0)` — pattern from `e2e/task-suggestion.spec.ts:71`

### Success Criteria:

#### Automated Verification:

- `set CI=true && pnpm test:e2e:belt -- e2e/session-closure.spec.ts` passes
- `pnpm test` passes (unit suite unchanged)
- `pnpm check` passes

#### Manual Verification:

- Belt run locally shows closure flow without pre-dismiss helper; no kickoff overlay after dismiss

**Implementation Note**: Phase 4 completes B-05 implementation. Ready for PR / merge gate.

---

## Testing Strategy

### Unit Tests:

- Dashboard: kickoff + check-in absent when `pendingClosureLine` set (Phase 1 oracle, green Phase 3)
- Hook: `endSession` during blocked `getOrCreateActive` does not reopen `awaitingKickoffReadiness` (Phase 1 oracle, green Phase 2)
- Regression: existing kickoff readiness gate suite (`use-pomodoro-cycle.test.tsx:2298+`) and closure overlay test (`pomodoro-dashboard.test.tsx:305–314`)

### Integration Tests:

- No new integration layer — hook + dashboard covered separately per characterization discipline

### Manual Testing Steps:

1. Authenticated user with active tasks: start cycle → end session while running → verify closure alone on screen
2. Dismiss closure → verify no kickoff readiness overlay on same page visit
3. Reload page fresh → verify kickoff can still appear on legitimate idle recovery (no over-blocking)

## Performance Considerations

Negligible — one ref comparison per eligibility async resolve; predicate adds one null check to existing boolean chain. Avoids unnecessary `getOrCreateActive` during closure.

## Migration Notes

None — behavioral fix only; no schema or API changes. `sessionStorage` `wasClosureShown` dedupe unchanged.

## References

- Research: `context/changes/fix-closure-kickoff-mutex/research.md`
- Parent plan: `context/changes/refactor-opportunities/plan.md` (Phase 2 / B-05 commit order)
- Roadmap: `context/foundation/roadmap-references/items/B-05.md`
- User flow T-01: `context/foundation/user-flow.md`
- Dashboard guards: `src/app/_components/pomodoro-dashboard.tsx:371–423`
- Hook eligibility: `src/hooks/use-pomodoro-cycle.ts:1070–1115`
- Belt mask: `e2e/session-closure.spec.ts:45`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Characterization (T-01 oracle)

#### Automated

- [ ] 1.1 Dashboard mutex char tests exist and fail (expected red)
- [ ] 1.2 Hook race char test exists and fails (expected red)
- [ ] 1.3 `pnpm check` passes on test-only commit

#### Manual

- [ ] 1.4 Failing test output confirms T-01 oracle before Phase 2

### Phase 2: Hook mechanism (gen guard + predicate)

#### Automated

- [ ] 2.1 Hook race char test passes; kickoff suite green
- [ ] 2.2 `pnpm test` passes
- [ ] 2.3 `pnpm check` passes

#### Manual

- [ ] 2.4 Dashboard mutex char tests still fail (expected until Phase 3)

### Phase 3: Dashboard enforcement (mutex guards)

#### Automated

- [ ] 3.1 `pomodoro-dashboard.test.tsx` all green including mutex tests
- [ ] 3.2 `use-pomodoro-cycle.test.tsx` all green
- [ ] 3.3 `pnpm test`, `pnpm check`, `pnpm typecheck` pass

#### Manual

- [ ] 3.4 End session → closure → dismiss → no kickoff on same visit (local)

### Phase 4: Belt assertion (session-closure.spec.ts)

#### Automated

- [ ] 4.1 `set CI=true && pnpm test:e2e:belt -- e2e/session-closure.spec.ts` passes
- [ ] 4.2 `pnpm test` and `pnpm check` pass

#### Manual

- [ ] 4.3 Belt run shows no pre-dismiss kickoff mask; post-dismiss kickoff count 0
