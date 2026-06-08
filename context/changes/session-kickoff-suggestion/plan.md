# Session Kickoff Suggestion (S-15) Implementation Plan

## Overview

Extend the authenticated suggestion wedge to **idle kickoff moments** — session cold start and post-break idle without pre-selected task — with work-type duration preset chips (45/25/15 min tap-to-apply) and per-type remembered defaults in scoped localStorage. Reuses `suggestion.next` scoring pipeline, `TaskSuggestionCard`, and S-19 override acknowledgement (kickoff surface deferred from S-19 ships here).

## Current State Analysis

S-06 ships post-check-in suggestions only:

- `suggestion.next` requires `cycleId` + completed check-in (`src/server/api/routers/suggestion.ts:19-44`)
- `recordDecision` upserts on `cycleId` with WORK + check-in guards (`suggestion.ts:117-200`)
- `SuggestionDecision` is cycle-keyed (`prisma/schema.prisma:117-131`; `cycleId @unique`)
- Client: `pendingSuggestion` fetched after check-in; card gated to break-running (`pomodoro-dashboard.tsx:69-72`)
- Override ack (S-19) fires on break-running `selectTask` override only (`use-pomodoro-cycle.ts:529-535`)
- Duration: global `flowstate:lastDurationSec` only; generic 15/25/45/60 presets (`duration-bounds.ts`, `duration-storage.ts`)
- Guest: no suggestion gates (`pomodoro-dashboard.tsx` — `enableSuggestionGate` auth-only)

### Key Discoveries:

- `pickBestTask` is context-agnostic — kickoff is input construction with synthetic `energy: STEADY` (`src/lib/scoring/score-task.ts`)
- Post-break idle without pre-focus already clears focus (`use-pomodoro-cycle.ts:767-785`) — natural kickoff trigger (b)
- Session lazy-starts on first WORK `cycle.create`; `hasActiveSession` false until then — cold-start trigger (a)
- S-19 `showOverrideAck()` + banner (`data-testid="suggestion-override-ack"`) ready to reuse; kickoff `selectTask` branch missing
- Test-plan Risk #6 (IDOR) applies to new `sessionId` input on kickoff procedures

## Desired End State

1. Authenticated user lands idle with active tasks, no focus, no running cycle → kickoff suggestion card appears with rationale (session-start or post-break only).
2. User accepts → task pre-focused; duration preset chips appear for accepted task's work type (PRD defaults or "your usual" if remembered).
3. User taps preset chip → duration staged for next `start()`; chip tap persists per-type memory (guest + auth scoped localStorage).
4. User overrides via Focus on different task → `recordDecision` with kickoff context + S-19 ack banner; override feeds `lastOverrideWorkType` for subsequent suggestions.
5. Mid-session manual focus clear, `dismissPreFocus`, interrupt paths do **not** show kickoff card.
6. Post-check-in break suggestion (S-06) and kickoff suggestion are mutually exclusive via state gates.
7. Guest users: unchanged — no kickoff UI or API calls.
8. Verification: `pnpm check`, `pnpm test`, `set CI=true && pnpm test:e2e e2e/session-kickoff.spec.ts`.

## What We're NOT Doing

- Dedicated `suggestion.kickoff` router (extend existing router)
- Guest-mode kickoff (FR-003b boundary)
- Server-side `UserPreference` / cross-device per-type sync (Phase 2 follow-up)
- Kickoff scoring from last session check-in energy (defer — synthetic STEADY for MVP)
- Mid-session focus-clear kickoff trigger
- Reset-to-PRD-defaults UI for per-type memory
- Auto-applying duration on suggestion accept (FR-010 tap-to-apply only)
- `proposed-FR-session-start-guidance` PRD edit (roadmap outcome is source)
- AI/ML scoring changes

## Implementation Approach

Five phases aligned to research P1–P5: schema/API foundation → client eligibility/triggers → idle UI + override ack → duration presets/memory → e2e + cookbook. Extract shared scoring-context builder from `suggestion.next` to avoid duplicated session queries. Kickoff decisions insert (not upsert on `cycleId`) because no WORK cycle exists yet.

## Critical Implementation Details

**Wedge moment discipline:** Kickoff fetch runs only on `kickoffEligible` transition (session-start idle flag OR post-break idle flag), never on every `focusedTaskId → null`. Clear kickoff state on `start()`, session end, and when post-check-in suggestion takes over.

**Schema migration:** Making `cycleId` nullable breaks the existing `@unique` upsert path for post-check-in only if multiple nulls collide — PostgreSQL allows multiple NULLs in unique columns. Post-check-in `recordDecision` must continue upserting on non-null `cycleId`. Kickoff `recordDecision` always `create`s with `cycleId: null`, `sessionId`, `context: KICKOFF`.

**`lastOverride` query:** Extend session-scoped override lookup to include kickoff rows (`sessionId` + `context: KICKOFF`) in addition to `cycle.sessionId` join — same `accepted: false` + `orderBy createdAt desc` contract.

## Phase 1: API + Schema

### Overview

Extend `suggestion.next` and `recordDecision` with kickoff context; migrate `SuggestionDecision` for session-anchored kickoff rows; add kickoff rationale keys; prove with router tests.

### Changes Required:

#### 1. Prisma — SuggestionDecision extension

**File**: `prisma/schema.prisma`

**Intent**: Persist kickoff accept/override decisions without a WORK cycle so override signal feeds scoring immediately.

**Contract**: Add enum `SuggestionContext` (`POST_CHECK_IN`, `KICKOFF`). On `SuggestionDecision`: make `cycleId` optional (`Int?`, keep `@unique` for post-check-in upsert); change `cycle Cycle` → `cycle Cycle?`; add optional `sessionId Int?` with `session Session?` relation; add `context SuggestionContext @default(POST_CHECK_IN)`. Index `[sessionId, createdAt]`. Run `pnpm prisma migrate dev`.

#### 2. Shared scoring-context builder

**File**: `src/server/api/routers/suggestion.ts` (extend)

**Intent**: DRY session queries (`lastOverride`, `completedWorkCycles`, active tasks) shared by both context branches.

**Contract**: Extract helper `buildScoringContextForSession(session, userId, localHour, energy)` returning `ScoringContext`. Kickoff branch passes `energy: "STEADY"`. `lastOverride` query must OR kickoff rows: `{ OR: [{ cycle: { sessionId } }, { sessionId, context: KICKOFF }] }` with `accepted: false`, `orderBy: { createdAt: 'desc' }` — same contract as Critical Implementation Details.

#### 3. `suggestion.next` discriminated input

**File**: `src/server/api/routers/suggestion.ts`

**Intent**: Single procedure serves post-check-in and kickoff without duplicating `pickBestTask` pipeline.

**Contract**: Replace flat input with discriminated union on `context`:

```typescript
z.discriminatedUnion("context", [
  z.object({ context: z.literal("post_check_in"), cycleId: z.number().int(), localHour: ... }),
  z.object({ context: z.literal("kickoff"), sessionId: z.number().int(), localHour: ... }),
])
```

- `post_check_in`: existing path unchanged (check-in gate, return includes `cycleId`).
- `kickoff`: load session by `sessionId` + `userId`; verify not ended; skip check-in gate; build context with `STEADY`; return `{ sessionId, taskId, title, workType, weight, rationaleKey, rationale }` (no `cycleId`).
- Add kickoff rationale keys `kickoff_fresh` / `kickoff_resume` to `RationaleKey` in `src/lib/scoring/rationale.ts` with kickoff-specific copy. Kickoff `next` calls `formatKickoffRationale(session, context)`: `kickoff_fresh` when `completedWorkCycles === 0`, else `kickoff_resume`; fall back to `formatTaskRationale` when override/fatigue/interruption dominates (existing dominant-factor keys).

#### 4. `recordDecision` kickoff branch

**File**: `src/server/api/routers/suggestion.ts`

**Intent**: Record kickoff accept/override for FR-022 and override feedback loop.

**Contract**: Extend input with discriminated union mirroring `next`. Kickoff branch: verify session ownership (IDOR); verify task ownership; `create` row with `cycleId: null`, `sessionId`, `context: KICKOFF`, `accepted`. Post-check-in branch: unchanged upsert on `cycleId`; pass `context: POST_CHECK_IN` explicitly on create/update after enum added.

#### 5. Router tests

**File**: `src/server/api/routers/suggestion.test.ts`, `suggestion-isolation.test.ts` (extend)

**Intent**: Lock kickoff contract and security boundaries before client work.

**Contract**: Tests for kickoff `next` without check-in; synthetic STEADY scoring; kickoff `recordDecision` create; cross-user `sessionId` → NOT_FOUND; post-check-in regression unchanged. Integration: kickoff override `recordDecision` → subsequent kickoff `next` in same session surfaces `lastOverrideWorkType` on matching work type.

### Success Criteria:

#### Automated Verification:

- `pnpm prisma migrate dev` applies cleanly
- `pnpm check` passes
- `pnpm typecheck` passes
- `pnpm exec vitest run src/server/api/routers/suggestion.test.ts src/server/api/routers/suggestion-isolation.test.ts` passes

#### Manual Verification:

- Prisma Studio shows nullable `cycleId`, `sessionId`, `context` on `SuggestionDecision`
- Post-check-in suggestion e2e still passes (no regression)

**Implementation Note**: Pause for manual confirmation before Phase 2.

---

## Phase 2: Hook + Eligibility

### Overview

Add `pendingKickoffSuggestion` client state, eligibility gates, and fetch triggers for session-start idle and post-break idle — auth-only, mutually exclusive with S-06 break suggestion.

### Changes Required:

#### 1. Kickoff eligibility flags

**File**: `src/hooks/use-pomodoro-cycle.ts`

**Intent**: Fire kickoff only at true wedge moments; prevent nag on mid-session focus clear.

**Contract**: Add `sessionStartIdleFlag` and `postBreakIdleFlag` (boolean refs/state). Set `postBreakIdleFlag` in break `confirmComplete` when `preFocusedTask == null` (existing branch ~L780-783). Set `sessionStartIdleFlag` on mount/recovery when no RUNNING cycle and (`!hasActiveSession` OR `completedWorkCycles === 0`). Clear both on `selectTask`, `acceptKickoffSuggestion`, `start`, session end.

Derived `kickoffEligible`:

```
mode === "authenticated"
&& state === "idle"
&& cycleKind === null
&& focusedTaskId === null
&& !awaitingCheckIn
&& activeTasks.length > 0
&& (sessionStartIdleFlag || postBreakIdleFlag)
```

#### 2. Fetch + state machine

**File**: `src/hooks/use-pomodoro-cycle.ts`

**Intent**: Parallel kickoff suggestion lifecycle mirroring `pendingSuggestion`.

**Contract**: Add `pendingKickoffSuggestion` with statuses `idle | loading | ready | empty | error`. `fetchKickoffSuggestion(sessionId)` calls `suggestion.next` with `{ context: 'kickoff', sessionId, localHour }`. Effect triggers fetch on `kickoffEligible` false→true transition (not every render). `clearKickoffSuggestion()` on `start()` alongside existing `clearSuggestion()`.

#### 3. Session ID availability

**File**: `src/hooks/use-pomodoro-cycle.ts`

**Intent**: Kickoff API needs active session id before first WORK cycle.

**Contract**: On `kickoffEligible` false→true, call `sessions.getOrCreateActive()` (same as `start()` at `use-pomodoro-cycle.ts:611`) and store id via `setActiveSessionId`; use hook `_activeSessionId` state for `fetchKickoffSuggestion` input. Early session creation is intentional — kickoff API requires a materialized `sessionId` before first WORK cycle.

#### 4. Hook unit tests

**File**: `src/hooks/use-pomodoro-cycle.test.tsx` (extend)

**Intent**: Prove eligibility gates and fetch timing without e2e.

**Contract**: Tests: post-break idle without pre-focus triggers fetch; mid-session `clearTask` does not; kickoff cleared on `start()`; kickoff and post-check-in suggestion states independent.

### Success Criteria:

#### Automated Verification:

- `pnpm check` passes
- `pnpm exec vitest run src/hooks/use-pomodoro-cycle.test.tsx` passes (kickoff-related cases)

#### Manual Verification:

- Dev: complete break without pre-focus → idle shows kickoff fetch in network tab (before UI wired)
- Dev: clear focus mid-session → no kickoff fetch
- Guest dashboard unchanged

**Implementation Note**: Pause for manual confirmation before Phase 3.

---

## Phase 3: Kickoff UI + Override Acknowledgement

### Overview

Render idle-gated `TaskSuggestionCard` for kickoff; wire accept → pre-focus; extend `selectTask` override path with kickoff branch + S-19 ack (completing deferred S-19 kickoff surface).

### Changes Required:

#### 1. Dashboard kickoff card gate

**File**: `src/app/_components/pomodoro-dashboard.tsx`

**Intent**: Show kickoff suggestion in idle slot above task list; never alongside break-running S-06 card.

**Contract**: Add `showKickoffCard = enableSuggestionGate && state === 'idle' && focusedTaskId == null && pendingKickoffSuggestion !== idle && !showSuggestionCard`. Reuse `TaskSuggestionCard` with kickoff-specific coach line optional. Highlight `suggestedTaskId` from kickoff data on `TaskList`.

#### 2. Accept kickoff flow

**File**: `src/hooks/use-pomodoro-cycle.ts`

**Intent**: Accept pre-focuses task and records decision — parallel to `acceptSuggestion`.

**Contract**: `acceptKickoffSuggestion()` → `preFocusTask` + `recordDecision` with kickoff context + set `hasPreFocusedKickoff` flag. Clear `pendingKickoffSuggestion` flags on accept. Expose `retryKickoffSuggestion`, `isAcceptingKickoffSuggestion`.

#### 3. Kickoff override + S-19 ack

**File**: `src/hooks/use-pomodoro-cycle.ts`

**Intent**: FR-022 override on kickoff with validating acknowledgement (S-19 deferred scope).

**Contract**: In `selectTask`, add idle branch: when `kickoffEligible && pendingKickoffSuggestion.status === 'ready' && taskId !== suggested` → `recordKickoffDecision` + `showOverrideAck()` + clear kickoff highlight. In `dismissPreFocus`, mirror S-06: when `hasPreFocusedKickoff && pendingKickoffSuggestion.status === 'ready'` → `recordKickoffDecision(suggested, preFocused)` before clearing focus. Reuse existing `overrideAcknowledgement` state and dashboard banner — no new component.

#### 4. Mutual exclusion

**File**: `src/hooks/use-pomodoro-cycle.ts`, `pomodoro-dashboard.tsx`

**Intent**: Prevent double suggestion cards.

**Contract**: When break-running post-check-in suggestion active, suppress kickoff fetch/display. When kickoff pending, do not fetch post-check-in until break starts.

#### 5. Component / hook tests

**File**: `src/hooks/use-pomodoro-cycle.test.tsx` (extend)

**Intent**: Lock override ack on kickoff path.

**Contract**: Test: kickoff override sets `overrideAcknowledgement`; kickoff accept does not; ack auto-dismisses after 3s (existing timer). Test: `dismissPreFocus` after kickoff accept records kickoff override decision (mirrors S-06).

### Success Criteria:

#### Automated Verification:

- `pnpm check` passes
- `pnpm exec vitest run src/hooks/use-pomodoro-cycle.test.tsx` passes (kickoff UI/override cases)

#### Manual Verification:

- Idle kickoff card shows rationale + highlighted row
- Accept pre-focuses task; Focus on different task shows override ack banner
- Break-running post-check-in card still works; no simultaneous cards
- Override ack copy matches S-19 (`OVERRIDE_ACK_LINE`)

**Implementation Note**: Pause for manual confirmation before Phase 4.

---

## Phase 4: Duration Presets + Per-Type Memory

### Overview

Work-type duration chips on kickoff accept path; scoped localStorage for remembered per-type defaults; tap-to-apply staging for next `start()`.

### Changes Required:

#### 1. Kickoff preset constants

**File**: `src/lib/duration-bounds.ts`

**Intent**: PRD-aligned work-type defaults for kickoff chips only.

**Contract**: Export `KICKOFF_PRESET_SEC: Record<WorkType, number>` — `DEEP_WORK: 2700`, `OPERATIONAL: 1500`, `REACTIVE: 900`. Export `getKickoffPresetSec(workType)` helper.

#### 2. Per-type duration storage module

**File**: `src/lib/work-type-duration-storage.ts` (new)

**Intent**: Remember last chip tap per work type without polluting guest domain blob.

**Contract**: Keys: `flowstate:workTypeDurationSec` (guest), `flowstate:workTypeDurationSec:{userId}` (auth) — mirror `onboarding/keys.ts` pattern. JSON shape `{ DEEP_WORK?: number, OPERATIONAL?: number, REACTIVE?: number }`. Export `getWorkTypeDuration(workType, scope)`, `setWorkTypeDuration(workType, sec, scope)`, `resolveKickoffChipSec(workType, scope)` with read order: remembered → `KICKOFF_PRESET_SEC` → `getLastDuration()` global fallback. Write only on explicit chip tap.

#### 3. Duration chip row component

**File**: `src/app/_components/kickoff-duration-chips.tsx` (new)

**Intent**: Show presets after kickoff accept when work type is known; label "your usual" when remembered value exists.

**Contract**: Props: `workType`, `selectedSec?`, `onSelect(sec)`. Render chips for resolved preset values (45m / 25m / 15m labels). Visible when kickoff accepted + idle + task pre-focused; hidden before accept. Chip tap does not auto-start cycle.

#### 4. Staged duration for start

**File**: `src/hooks/use-pomodoro-cycle.ts`, `src/app/_components/pomodoro-dashboard.tsx`

**Intent**: Selected chip applies to next `start(durationSec)` only.

**Contract**: Add `stagedKickoffDurationSec` state; chip tap sets it + persists per-type memory; `start()` prefers staged value when set, then clears staging; `DurationPicker` on idle timer still available as alternative.

#### 5. Unit tests

**File**: `src/lib/work-type-duration-storage.test.ts` (new)

**Intent**: Lock key scoping and read-order contract.

**Contract**: Guest vs auth key isolation; remembered overrides PRD default; fallback chain.

### Success Criteria:

#### Automated Verification:

- `pnpm check` passes
- `pnpm exec vitest run src/lib/work-type-duration-storage.test.ts` passes

#### Manual Verification:

- Accept kickoff → chips show for task work type
- Tap chip → "your usual" label on return visit after reload
- Start cycle uses staged chip duration; accepting suggestion alone does not change duration
- Chips are suggestions only — user can still use generic duration picker

**Implementation Note**: Pause for manual confirmation before Phase 5.

---

## Phase 5: E2E + Cookbook

### Overview

Browser-level proof for kickoff wedge; test-plan cookbook entry; full regression gate.

### Changes Required:

#### 1. E2E spec

**File**: `e2e/session-kickoff.spec.ts` (new)

**Intent**: Prove FR-021/FR-022 kickoff path end-to-end (test-plan cost×signal: e2e for wedge UX).

**Contract**: Model on `e2e/task-suggestion.spec.ts`; use `e2e/helpers/idle-cycle.ts`. Scenarios: (1) session-start idle with tasks → kickoff card + rationale; (2) accept → pre-focus + duration chips; (3) chip tap → start uses duration; (4) override → ack banner. Auth fixture via `e2e/fixtures.ts`.

#### 2. E2E helpers

**File**: `e2e/helpers/suggestion.ts` or `e2e/helpers/kickoff.ts` (extend/new)

**Intent**: Reusable kickoff wait/accept/assert helpers.

**Contract**: `waitForKickoffSuggestion`, `acceptKickoffSuggestion`, `expectKickoffDurationChips` with `data-testid` hooks added in Phase 3–4.

#### 3. Regression tolerance

**File**: `e2e/task-suggestion.spec.ts` (verify)

**Intent**: S-06 post-check-in path unaffected.

**Contract**: Existing spec passes without modification; kickoff does not appear during break suggestion flow.

#### 4. Test-plan cookbook

**File**: `context/foundation/test-plan.md` §6 (append entry)

**Intent**: Canonical pattern for future kickoff-related tests.

**Contract**: Document location (`e2e/session-kickoff.spec.ts`), reference test name, helpers, run command `set CI=true && pnpm test:e2e e2e/session-kickoff.spec.ts`.

### Success Criteria:

#### Automated Verification:

- `pnpm check` passes
- `pnpm test` passes
- `set CI=true && pnpm test:e2e e2e/session-kickoff.spec.ts` passes
- `set CI=true && pnpm test:e2e e2e/task-suggestion.spec.ts` passes (regression)

#### Manual Verification:

- Full authenticated session: cold start → kickoff → chip → cycle → break → post-break kickoff (no duplicate cards)
- Mid-session focus clear does not show kickoff

**Implementation Note**: Slice complete after manual sign-off and ship via PR.

---

## Testing Strategy

### Unit Tests:

- `suggestion.test.ts` — kickoff `next`/`recordDecision` branches, STEADY energy, rationale keys
- `suggestion-isolation.test.ts` — cross-user sessionId IDOR
- `work-type-duration-storage.test.ts` — key scoping, fallback order
- `use-pomodoro-cycle.test.tsx` — eligibility, fetch timing, override ack, clear on start

### Integration Tests:

- Kickoff `recordDecision` → `lastOverrideWorkType` visible on subsequent `suggestion.next` (same session)

### Manual Testing Steps:

1. Auth user, active tasks, fresh session → idle kickoff card appears
2. Complete work cycle + check-in + break, dismiss without pre-focus → post-break kickoff
3. Clear focus mid-session manually → no kickoff
4. Override kickoff suggestion → ack banner 3s
5. Accept + tap 45m deep chip → start uses 45m; reload → "your usual" on deep chip
6. Guest mode → no kickoff card

## Performance Considerations

Kickoff fetch is a single tRPC mutation on discrete idle transitions (not polling). localStorage reads are synchronous and scoped — no additional server round-trips for per-type memory in MVP.

## Migration Notes

- `SuggestionDecision.cycleId` becomes nullable; existing rows unchanged (`context` defaults `POST_CHECK_IN`)
- Post-check-in `recordDecision` upsert path must pass `context: POST_CHECK_IN` explicitly after enum added
- No data backfill required for kickoff rows

## References

- Research: `context/changes/session-kickoff-suggestion/research.md`
- Roadmap S-15: `context/foundation/roadmap.md` (lines 393-412)
- S-06 plan: `context/archive/2026-06-07-adaptive-task-suggestion/plan.md`
- S-19 ack: `context/archive/2026-06-08-suggestion-override-acknowledgement/plan.md`
- Test-plan Risks #6, #7: `context/foundation/test-plan.md`
- `suggestion.next`: `src/server/api/routers/suggestion.ts:19-115`
- Hook suggestion flow: `src/hooks/use-pomodoro-cycle.ts:461-575`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: API + Schema

#### Automated

- [ ] 1.1 `pnpm prisma migrate dev` applies cleanly
- [ ] 1.2 `pnpm check` passes
- [ ] 1.3 `pnpm typecheck` passes
- [ ] 1.4 `pnpm exec vitest run src/server/api/routers/suggestion.test.ts src/server/api/routers/suggestion-isolation.test.ts` passes

#### Manual

- [ ] 1.5 Prisma Studio shows nullable `cycleId`, `sessionId`, `context` on `SuggestionDecision`
- [ ] 1.6 Post-check-in suggestion e2e still passes (no regression)

### Phase 2: Hook + Eligibility

#### Automated

- [ ] 2.1 `pnpm check` passes
- [ ] 2.2 `pnpm exec vitest run src/hooks/use-pomodoro-cycle.test.tsx` passes (kickoff-related cases)

#### Manual

- [ ] 2.3 Post-break idle without pre-focus triggers kickoff fetch in network tab
- [ ] 2.4 Mid-session `clearTask` does not trigger kickoff fetch
- [ ] 2.5 Guest dashboard unchanged

### Phase 3: Kickoff UI + Override Acknowledgement

#### Automated

- [ ] 3.1 `pnpm check` passes
- [ ] 3.2 `pnpm exec vitest run src/hooks/use-pomodoro-cycle.test.tsx` passes (kickoff UI/override cases)

#### Manual

- [ ] 3.3 Idle kickoff card shows rationale + highlighted row
- [ ] 3.4 Accept pre-focuses task; Focus on different task shows override ack banner
- [ ] 3.5 Break-running post-check-in card still works; no simultaneous cards
- [ ] 3.6 Override ack copy matches S-19 (`OVERRIDE_ACK_LINE`)

### Phase 4: Duration Presets + Per-Type Memory

#### Automated

- [ ] 4.1 `pnpm check` passes
- [ ] 4.2 `pnpm exec vitest run src/lib/work-type-duration-storage.test.ts` passes

#### Manual

- [ ] 4.3 Accept kickoff → chips show for task work type
- [ ] 4.4 Tap chip → "your usual" label on return visit after reload
- [ ] 4.5 Start cycle uses staged chip duration; accepting suggestion alone does not change duration
- [ ] 4.6 Chips are suggestions only — user can still use generic duration picker

### Phase 5: E2E + Cookbook

#### Automated

- [ ] 5.1 `pnpm check` passes
- [ ] 5.2 `pnpm test` passes
- [ ] 5.3 `set CI=true && pnpm test:e2e e2e/session-kickoff.spec.ts` passes
- [ ] 5.4 `set CI=true && pnpm test:e2e e2e/task-suggestion.spec.ts` passes (regression)

#### Manual

- [ ] 5.5 Full session flow: cold start kickoff → cycle → post-break kickoff without duplicate cards
- [ ] 5.6 Mid-session focus clear does not show kickoff
