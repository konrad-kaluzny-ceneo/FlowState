# Adaptive Task Suggestion (S-06) Implementation Plan

## Overview

Implement FR-021 and FR-022: after each authenticated WORK-cycle check-in, the system suggests the next active task using a deterministic v1 formula (weight Ã— work-type fit Ã— session context), shows a one-line rationale, and lets the user accept or override. Builds on shipped S-04 task attributes and S-05 check-in gate.

## Current State Analysis

All scoring **inputs** exist; **consumption** does not:

- `Task.workType` + `weight` on schema and in `task-list.tsx` UI (`src/server/api/routers/task.ts`)
- `CheckIn.energy` persisted via `checkIn.create`; gate in `CheckInOverlay` + `submitCheckIn` (`src/hooks/use-pomodoro-cycle.ts:604-661`)
- `cycle.countCompletedWork` queryable (`src/server/api/routers/cycle.ts:24-35`)
- `Session.interruptionCount` column exists but is **never incremented**
- No suggestion router, scorer, or client consumer of `checkIn.list`
- Break-end overlay is generic "Continue" only (`src/app/_components/cycle-complete-overlay.tsx:32-59`)

### Key Discoveries:

- Integration hook: `submitCheckIn` after `checkIn.create` success â€” fetch suggestion async, do not block `confirmComplete` (`src/hooks/use-pomodoro-cycle.ts:641-656`)
- Mid-cycle path `onMidCycleEndCycleAndBreak` also sets `awaitingCheckIn` â€” must trigger suggestion there too (`use-pomodoro-cycle.ts:703-704`)
- Active-task filter precedent: client-side `status === "active"` (`task-list.tsx:117-118`)
- Guest: no check-in, no suggestion â€” mirror `enableCheckInGate` pattern (`pomodoro-dashboard.tsx:151-165`)
- Override path: `TaskList` Focus â†’ `selectTask` (`task-list.tsx:340-351`)

## Desired End State

1. Authenticated user completes check-in â†’ break starts immediately â†’ suggestion card appears (or loading skeleton, then card).
2. Card shows task title, work-type/weight badges, one-line rationale, "Focus this" CTA.
3. Accept pre-focuses suggested task; break-end overlay primary button reads "Continue with [title]" when pre-focused.
4. User clicks Focus on a different task â†’ override recorded via `suggestion.recordDecision`; suggestion highlight clears.
5. Scorer uses energy, completed work cycles, interruption count, local hour, and last override work type.
6. Guest users: no suggestion UI or API calls.
7. Verification: `pnpm check`, `pnpm typecheck`, `pnpm test`, `set CI=true && pnpm test:e2e`.

## What We're NOT Doing

- AI/ML scoring (PRD non-goal)
- Showing ranked list of all tasks
- Guest-mode suggestions (PRD FR-003b)
- Server-side prerequisite on `cycle.complete` for check-in or suggestion
- Historical analytics / suggestion accuracy dashboards
- Post-launch coefficient tuning from production telemetry
- Optimistic TanStack mutations (S-09)
- Restoring deferred `check-in-gate.spec.ts` (suggestion e2e is separate)

## Implementation Approach

Four phases: data model â†’ server scorer/API â†’ client hook/UI â†’ tests/e2e. Pure scoring logic lives in `src/lib/scoring/` (framework-agnostic, vitest-friendly). tRPC router `suggestion` exposes `next` and `recordDecision`. Hook owns fetch timing and decision recording; dashboard renders inline card (not modal).

## Critical Implementation Details

**Non-blocking fetch:** After `checkIn.create` succeeds, await `confirmComplete` (break must start first so the WORK cycle counts toward `countCompletedWork`). Then fire `suggestion.next` without awaiting â€” store result in hook state when resolved; show skeleton on card until loaded. Suggestion failure must not roll back break start â€” show retry on card.

**Break-only task selection:** Today `selectTask` and `TaskList` Focus are blocked whenever `state === "running"` (`use-pomodoro-cycle.ts:331-332`, `task-list.tsx:119`). During breaks the timer is `running`, so accept/override via Focus cannot work without a narrow exception for `SHORT_BREAK` / `LONG_BREAK` only.

**State sequencing:** Clear suggestion state when session ends, when user starts a WORK cycle (consumes pre-focus), or when break overlay dismisses to idle without pre-focus.

## Phase 1: Schema + Session Context

### Overview

Add `SuggestionDecision` persistence and wire `Session.interruptionCount` increment for FR-019 inputs used by the scorer.

### Changes Required:

#### 1. Prisma â€” SuggestionDecision model

**File**: `prisma/schema.prisma` (extend)

**Intent**: Persist accept/override decisions per suggestion point for override feedback loop.

**Contract**: New model `SuggestionDecision` mapped to `flow_state_suggestion_decision` with fields: `id`, `userId`, `cycleId` (unique â€” one decision per work-cycle completion point), `suggestedTaskId`, `chosenTaskId`, `accepted` (boolean, `chosenTaskId === suggestedTaskId`), `createdAt`. Relations: `cycle Cycle`, optional `suggestedTask Task`, optional `chosenTask Task`. Cascade on cycle delete. Index on `[userId, createdAt]`.

Run migration via `pnpm db:migrate`.

#### 2. Interruption count increment

**File**: `src/server/api/routers/cycle.ts` (extend)

**Intent**: FR-019 interruption signal must reflect mid-cycle task switches.

**Contract**: In `rebindTask` mutation, after successful task rebind, increment `session.interruptionCount` by 1 in the same transaction. Add optional input flag `incrementInterruption?: boolean` (default `true`) on `rebindTask` for test control if needed â€” or always increment (simpler).

**File**: `src/server/api/routers/cycle.ts` â€” `complete` mutation (extend)

**Intent**: Mid-cycle "end cycle and break" path completes WORK early; counts as interruption when cycle had a task rebind or was interrupted mid-cycle.

**Contract**: Add optional input `incrementInterruption?: boolean` to `complete`. When `true`, increment `session.interruptionCount` in the complete transaction. Client passes `incrementInterruption: true` from mid-cycle end-break path only (not normal cycle-end complete).

**File**: `src/hooks/use-pomodoro-cycle.ts` (extend)

**Intent**: Pass interruption flag from mid-cycle end-break client calls.

**Contract**: `onMidCycleEndCycleAndBreak` and related early-complete paths call `cycles.complete` with `incrementInterruption: true` when ending WORK early via mid-cycle prompt.

#### 3. Integration tests

**File**: `src/server/api/routers/cycle.test.ts` (extend)

**Intent**: Prove interruption increment on rebind and flagged complete.

**Contract**: Tests for rebind â†’ session `interruptionCount` +1; complete with flag â†’ +1; normal complete â†’ unchanged.

### Success Criteria:

#### Automated Verification:

- `pnpm db:migrate` applies cleanly (dev)
- `pnpm check` passes
- `pnpm typecheck` passes
- `pnpm exec vitest run src/server/api/routers/cycle.test.ts` passes

#### Manual Verification:

- Prisma Studio shows `SuggestionDecision` table after migrate
- No regression in existing cycle flows

**Implementation Note**: Pause for manual confirmation before Phase 2.

---

## Phase 2: Scoring Engine + tRPC API

### Overview

Implement deterministic v1 scorer, rationale templates, and `suggestion` router procedures.

### Changes Required:

#### 1. Pure scorer module

**File**: `src/lib/scoring/score-task.ts` (new)

**Intent**: Rank active task candidates from session context; no I/O.

**Contract**: Export types `ScoringContext` (`energy`, `completedWorkCycles`, `interruptionCount`, `localHour`, `lastOverrideWorkType?`) and `ScoringTask` (`id`, `workType`, `weight`, `createdAt`). Export `scoreTask(task, context) â†’ number` using coefficients from research doc (TYPE_FIT matrix, fatigue thresholds at 2 and 4 cycles, interruption penalty, late day at `localHour >= 17`, override boost 1.15). Export `pickBestTask(tasks, context) â†’ ScoringTask | null` with tie-break: higher weight, then earlier `createdAt`.

#### 2. Rationale templates

**File**: `src/lib/scoring/rationale.ts` (new)

**Intent**: Map scorer's dominant factor to user-visible one-line copy.

**Contract**: Export `RationaleKey` enum/string union (e.g. `energy_deep`, `energy_light`, `fatigue`, `late_day`, `interruptions`, `override_preference`, `default`). Export `buildRationale(key, context) â†’ string` returning PRD-style copy ("Deep work â€” you're focused with few interruptions", "Light ops â€” energy fading after N cycles", etc.). Use `completedWorkCycles` in fatigue strings when N â‰¥ 2.

#### 3. Dominant factor helper

**File**: `src/lib/scoring/dominant-factor.ts` (new)

**Intent**: Determine which rationale key to show for the winning task.

**Contract**: Export `getDominantRationaleKey(task, context) â†’ RationaleKey` by comparing partial score contributions (energy fit vs fatigue vs late day vs interruptions vs override).

#### 4. Unit tests â€” scorer

**File**: `src/lib/scoring/score-task.test.ts` (new)

**Intent**: Golden-matrix tests for FR-021 directional behavior.

**Contract**: Cases: FOCUSED + fresh session â†’ DEEP_WORK heavy wins; FADING + 4 cycles â†’ OPERATIONAL/REACTIVE wins; tie-break on weight; empty array â†’ null; single task â†’ that task; override boost changes winner when scores close.

#### 5. tRPC suggestion router

**File**: `src/server/api/routers/suggestion.ts` (new)

**Intent**: Server entry point for next suggestion and decision recording.

**Contract**:

- `next` â€” protected mutation. Input: `{ cycleId: number, localHour: number (0-23) }`. Load cycle (owned), include session + checkIn. Require checkIn on cycle (else `BAD_REQUEST` with message â€” match existing router error style). Load active tasks (`status: 'active'`). Load latest `SuggestionDecision` in session where `accepted === false` to get `lastOverrideWorkType` from chosen task. Build context via `countCompletedWork` + session fields. Run scorer; return `{ taskId, title, workType, weight, rationaleKey, rationale } | null` when no candidates.

- `recordDecision` â€” protected mutation. Input: `{ cycleId, suggestedTaskId, chosenTaskId }`. Upsert `SuggestionDecision` for cycleId (unique). Set `accepted = suggestedTaskId === chosenTaskId`. Verify ownership of cycle and tasks.

**File**: `src/server/api/root.ts` (extend)

**Contract**: Register `suggestion: suggestionRouter`.

#### 6. Router tests

**File**: `src/server/api/routers/suggestion.test.ts` (new)

**Intent**: Integration tests for next + recordDecision.

**Contract**: Happy path with seeded tasks/check-in; null when no active tasks; NOT_FOUND for wrong user; recordDecision accept vs override rows.

**File**: `src/server/api/routers/suggestion-isolation.test.ts` (new)

**Contract**: Cross-user IDOR denial (mirror `check-in-isolation.test.ts` pattern).

### Success Criteria:

#### Automated Verification:

- `pnpm check` passes
- `pnpm typecheck` passes
- `pnpm exec vitest run src/lib/scoring/` passes
- `pnpm exec vitest run src/server/api/routers/suggestion.test.ts src/server/api/routers/suggestion-isolation.test.ts` passes

#### Manual Verification:

- tRPC caller smoke: `suggestion.next` returns expected task for fixture data (optional dev script or Prisma Studio seed)

**Implementation Note**: Pause for manual confirmation before Phase 3.

---

## Phase 3: Hook + UI Integration

### Overview

Wire suggestion fetch after check-in, display during break, accept/override flows, and enhanced break-end overlay.

### Changes Required:

#### 1. Hook â€” suggestion state machine

**File**: `src/hooks/use-pomodoro-cycle.ts` (extend)

**Intent**: Own suggestion lifecycle alongside check-in and break transitions.

**Contract**: New state: `pendingSuggestion` (null | loading | result | error), `suggestionCycleId` (tracks which cycle the suggestion belongs to), `suggestedTaskId` (from loaded result). New exports: `acceptSuggestion()`, `clearSuggestion()`, `preFocusTask(taskId, task?)`. After successful `checkIn.create` in `submitCheckIn`, await `confirmComplete`, then kick off `fetchSuggestion(cycleId)` (fire-and-forget). Same ordering in mid-cycle end-break check-in path. **`selectTask` break exception:** allow pre-focus when `state === "running"` and `cycleKind` is `SHORT_BREAK` or `LONG_BREAK`; keep block during WORK `running` and during `completed` overlay. On accept: `preFocusTask(suggestedId)` + `recordDecision`. On override (Focus on different task during break): only when `pendingSuggestion` has a result â€” call `recordDecision` with override + update pre-focus. Do not call `recordDecision` while suggestion still loading. Clear suggestion on `endSession`, on WORK `start()` (new cycle consumes focus), when break ends to idle without pre-focus. Export `hasPreFocusedSuggestion` for overlay.

#### 2. TaskSuggestionCard component

**File**: `src/app/_components/task-suggestion-card.tsx` (new)

**Intent**: Inline non-modal card shown during break cycles.

**Contract**: Props: `suggestion` (task + rationale) | `loading` | `error` | `empty`, `onAccept`, `onRetry`, `isAccepting`. Render `data-testid="task-suggestion-card"`. Show badges matching `TaskBadges` styling. CTA `data-testid="suggestion-accept-btn"`. Loading skeleton after 300ms; spinner/message if >1s per NFR. Empty copy: "No active tasks â€” add one or end session."

#### 3. Break-end overlay enhancement

**File**: `src/app/_components/cycle-complete-overlay.tsx` (extend)

**Intent**: One-click accept at natural break-end decision point.

**Contract**: Optional props: `preFocusedTask: FocusedTask | null`. When break cycle and `preFocusedTask` set: primary button label `Continue with ${title}`, `data-testid="break-continue-suggested-btn"`; secondary "Choose different task" calls `onDismissPreFocus` (clears pre-focus, keeps generic Continue). When no pre-focus: existing "Continue" behavior unchanged.

#### 4. Dashboard wiring

**File**: `src/app/_components/pomodoro-dashboard.tsx` (extend)

**Intent**: Render suggestion card auth-only; wire overlay props.

**Contract**: Add `enableSuggestionGate` prop (true for authenticated, false for guest â€” same as check-in). Show `TaskSuggestionCard` when `enableSuggestionGate && pomodoro.state === 'running' && break kind && pendingSuggestion`. Pass preFocusedTask to `CycleCompleteOverlay` on break end. Wire `onFocusTask` through hook's wrapped selectTask for override detection. Highlight suggested row: pass `highlightedTaskId={pomodoro.suggestedTaskId}` to TaskList.

#### 5. Task list highlight

**File**: `src/app/_components/task-list.tsx` (extend)

**Intent**: Visual affordance for suggested task without hiding alternatives.

**Contract**: Optional prop `highlightedTaskId?: number | null`. When set, add distinct border/ring on matching active row (`data-testid="suggested-task-row"`). **Relax Focus lock during breaks:** change `cycleLocked` for the Focus button only â€” disabled when `(cycleState === "running" && cycleKind === "WORK") || cycleState === "completed"`. Mark-complete / edit / delete stay locked for all `running`/`completed` states as today.

#### 6. Component tests

**File**: `src/app/_components/task-suggestion-card.test.tsx` (new)

**Contract**: Renders loading, result with rationale, empty, error+retry states.

**File**: `src/hooks/use-pomodoro-cycle.test.tsx` (extend)

**Contract**: Mock suggestion API; assert fetch after check-in, accept calls recordDecision, override on different selectTask.

### Success Criteria:

#### Automated Verification:

- `pnpm check` passes
- `pnpm typecheck` passes
- `pnpm test` passes (including new component/hook tests)

#### Manual Verification:

- Complete WORK cycle â†’ check-in â†’ break starts â†’ suggestion card appears with rationale
- "Focus this" pre-focuses task; break end shows "Continue with [title]"
- Focus different task during break â†’ override, highlight moves
- Guest mode: no suggestion card
- Suggestion API failure: break still runs; card shows error + retry
- Mid-cycle end-break â†’ check-in â†’ suggestion appears same as normal path

**Implementation Note**: Pause for manual confirmation before Phase 4.

---

## Phase 4: E2E + Test-Plan Cookbook

### Overview

Browser proof for FR-021/022 and document pattern in test-plan.

### Changes Required:

#### 1. E2E helper

**File**: `e2e/helpers/suggestion.ts` (new)

**Intent**: Reusable steps for suggestion assertions.

**Contract**: Export `expectSuggestionVisible(page)`, `acceptSuggestion(page)`, `waitForSuggestionNext(page)` (optional network wait).

#### 2. E2E spec

**File**: `e2e/task-suggestion.spec.ts` (new)

**Intent**: Risk proof for adaptive suggestion wedge.

**Contract**: Authenticated fixture. Setup: create 2+ active tasks with different work types/weights. Complete fast WORK cycle + check-in (reuse `completeCheckIn`). Assert `task-suggestion-card` visible with rationale text. Assert suggested row highlighted. Test accept path: click accept â†’ break end â†’ continue suggested â†’ timer ready. Test override path: focus other task â†’ highlight clears. Use stable testids; timeout 60s.

#### 3. Update existing pomodoro spec (non-breaking)

**File**: `e2e/pomodoro-cycle.spec.ts` (extend)

**Intent**: S-01 flows tolerate suggestion card presence after check-in.

**Contract**: After `completeCheckIn`, allow suggestion card to appear but do not require interaction for S-01 regression tests (or dismiss if blocks assertions).

#### 4. Test-plan cookbook

**File**: `context/foundation/test-plan.md` (extend Â§6)

**Intent**: Document S-06 e2e pattern for future agents.

**Contract**: Add Â§6 entry for adaptive suggestion: spec path, helper path, run command, reference test name. Link to Risk mapping for suggestion accept/override (new row or extend existing wedge risks if present).

### Success Criteria:

#### Automated Verification:

- `pnpm check` passes
- `pnpm typecheck` passes
- `pnpm test` passes
- `set CI=true && pnpm test:e2e` passes (including `e2e/task-suggestion.spec.ts`)

#### Manual Verification:

- Full manual smoke: 2-task session, 2 cycles, verify suggestion changes with FADING check-in
- No regression in guest dashboard

**Implementation Note**: Final phase â€” ready for `/10x-implement` completion and roadmap status update.

---

## Testing Strategy

### Unit Tests:

- Scorer matrix: energy Ã— work type Ã— fatigue Ã— late day Ã— override
- Rationale key selection for each dominant factor
- Tie-breaking and empty/single candidate edge cases

### Integration Tests:

- `suggestion.next` with real Prisma test DB / mocked ctx pattern used in existing router tests
- `recordDecision` accept vs override persistence
- Isolation: cross-user cycle/task access denied
- `interruptionCount` increment on rebind and flagged complete

### Manual Testing Steps:

1. Two active tasks (one DEEP/heavy, one REACTIVE/light) â€” FOCUSED check-in â†’ suggests deep task
2. Same tasks â€” FADING check-in after 3+ cycles â†’ suggests lighter task
3. Override by Focus â†’ next cycle suggestion shifts toward overridden work type
4. Complete all tasks â†’ empty suggestion message
5. Guest login path â†’ no suggestion card

## Performance Considerations

- `suggestion.next` is O(n) over active tasks (typically <50) â€” sub-50ms server-side
- Fetch is async and non-blocking; no impact on break start latency
- Client shows skeleton if fetch exceeds ~300ms; spinner message if >1s (NFR)

## Migration Notes

- New `SuggestionDecision` table â€” no backfill required
- Existing sessions continue with `interruptionCount: 0` until first rebind/mid-cycle interrupt

## References

- Research: `context/changes/adaptive-task-suggestion/research.md`
- PRD FR-021, FR-022, Business Logic Â§: `context/foundation/prd.md`
- S-05 check-in pattern: `context/archive/2026-06-06-testing-active-slice-browser-proofs/plan.md`
- Check-in hook: `src/hooks/use-pomodoro-cycle.ts:604-661`
- Dashboard overlays: `src/app/_components/pomodoro-dashboard.tsx:106-125`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` â€” <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Schema + Session Context

#### Automated

- [x] 1.1 Migration applies cleanly: `pnpm db:migrate` - 6f8cfd3
- [x] 1.2 `pnpm check` passes - 6f8cfd3
- [x] 1.3 `pnpm typecheck` passes - 6f8cfd3
- [x] 1.4 `pnpm exec vitest run src/server/api/routers/cycle.test.ts` passes - 6f8cfd3

#### Manual

- [ ] 1.5 Prisma Studio shows `SuggestionDecision` table; no cycle flow regression

### Phase 2: Scoring Engine + tRPC API

#### Automated

- [x] 2.1 `pnpm check` passes - 6782d17
- [x] 2.2 `pnpm typecheck` passes - 6782d17
- [x] 2.3 `pnpm exec vitest run src/lib/scoring/` passes - 6782d17
- [x] 2.4 `pnpm exec vitest run src/server/api/routers/suggestion.test.ts src/server/api/routers/suggestion-isolation.test.ts` passes - 6782d17

#### Manual

- [ ] 2.5 Optional smoke: `suggestion.next` returns expected task for fixture data

### Phase 3: Hook + UI Integration

#### Automated

- [x] 3.1 `pnpm check` passes - 0199724
- [x] 3.2 `pnpm typecheck` passes - 0199724
- [x] 3.3 `pnpm test` passes - 0199724

#### Manual

- [ ] 3.4 Full accept/override/guest/mid-cycle/error-retry manual smoke passes

### Phase 4: E2E + Test-Plan Cookbook

#### Automated

- [x] 4.1 `pnpm check` passes
- [x] 4.2 `pnpm typecheck` passes
- [x] 4.3 `pnpm test` passes
- [x] 4.4 `set CI=true && pnpm test:e2e` passes

#### Manual

- [ ] 4.5 Two-cycle manual smoke: suggestion shifts with FADING check-in; guest unchanged





