# Session Entry Wedge Bugs Implementation Plan

## Overview

Fix session-entry wedge failures: replace blocking kickoff/focus popups with one inline steering Card (energy + session focus), wire focus into kickoff scoring, relocate Continue context to the last-focused task row, and fix false “0 cycles” closure on timeout return. Single refactor — no interim popup hotfix.

## Current State Analysis

Frame brief (`frame.md`) confirms four independent defects:

| Stream | Root cause (verified) |
| --- | --- |
| Dead chips / wrong beat | `CycleIntentionPrompt` fires on `start()`; permission deferral deadlock (`pomodoro-dashboard.tsx:159-166,559`) |
| Focus not in suggestion | `suggestion.next` kickoff accepts `energy` only (`suggestion.ts:38-44`); `sessionIntention` is in-flow summary only |
| False 0-cycle closure | Timeout omits `closureLine` (`active-session.ts:26-31`); hydrate zeros counters before rebuild (`use-pomodoro-cycle.ts:914-922`) |
| Continue banner | `pickHandoffTaskContext` uses first active task (`return-handoff.ts:84-87`); `returnHandoffGateOpen` blocks kickoff (`transition-conductor.ts:172-174`) |

### Key Discoveries

- F-07 conductor gates `kickoff_readiness` and `cycle_intention` as blocking overlays (`transition-conductor.ts:61-67`) — inline steering requires retiring those gates for entry.
- `TaskList` already supports `highlightedTaskId` ring for suggestion (`task-list.tsx:449-454`) — reuse for Continue row styling.
- `ScoringContext` has `TYPE_FIT` energy×workType matrix (`score-task.ts:24-28`) — session-intention work-type boost follows same pattern.
- E2E belt `session-return-handoff.spec.ts` asserts banner blocks suggestion — must be rewritten.

## Desired End State

1. Idle kickoff-eligible user sees **inline** `SessionSteeringCard` (energy + focus chips + optional custom line) — no full-screen scrim.
2. No interaction within ~1s → implicit Skip (STEADY, no intention) → kickoff `suggestion.next` fetch ≤200ms perceived clear of steering card (L-04).
3. Session focus chips bias kickoff scoring via work-type boost (user decision: map chip → workType).
4. First `start()` does **not** reopen focus popup; intention already captured at entry.
5. After ended session with `lastFocusedTaskId`, matching task row shows ring + “Continue here” subtitle with icon (no resume note on that row).
6. No `ReturnHandoffBanner`; kickoff suggestion card loads without dismiss step.
7. Timeout-ended sessions persist `closureLine` server-side; client hydrate does not rebuild from zeroed counters.
8. Verification: `pnpm check`, `pnpm test`, `set CI=true && pnpm test:e2e:belt` (handoff + kickoff specs updated).

## What We're NOT Doing

- Keeping `KickoffReadinessOverlay` or `CycleIntentionPrompt` for entry/kickoff (removed in this change)
- Top-of-screen `ReturnHandoffBanner` task proposal
- Resume note on Continue row (user: short reminder only)
- 8h threshold for Continue row visibility (show whenever last ended session has `lastFocusedTaskId`)
- Scoring ML changes or new suggestion router
- Guest-mode kickoff suggestion (unchanged FR boundary) — guest gets `lastFocusedTaskId` on session blob for Continue row parity only
- Roadmap doc / Linear sync (unless user requests)

## Implementation Approach

Four phases: (1) persist last focus + closure on timeout, (2) inline steering + scoring wire + overlay removal, (3) Continue row + banner/conductor cleanup, (4) tests + docs. Phases 2–3 touch the same dashboard/hook files — implement sequentially in one branch.

## Critical Implementation Details

**Steering is not a conductor gate.** `SessionSteeringCard` renders inline when `kickoffEligible && !steeringCompleted`; it must not register in `GATE_PRIORITY`. Remove `kickoff_readiness` and entry-time `cycle_intention` from active conductor paths once steering ships.

**Permission prompt ordering.** `BreakAlertsPermissionPrompt` runs after steering completes and before the first `start()` that would start the worker — never while steering card is visible. Deferral pattern in `pomodoro-dashboard.tsx` must not leave a stuck boolean gate.

**`lastFocusedTaskId` snapshot.** Update on every successful `selectTask` while `hasActiveSession`; on `endSession` and server timeout, persist current `focusedTaskId` if set. Timeout path in `active-session.ts` must read last focused task from cycles or session column before ending.

---

## Phase 1: Last focus persistence + closure on timeout

### Overview

Add durable last-focus memory and server-side closure line for timeout-ended sessions.

### Changes Required:

#### 1. Prisma schema

**File**: `prisma/schema.prisma`

**Intent**: Store which task was focused when a session ended so Continue row and return context survive interrupted breaks.

**Contract**: Add nullable `lastFocusedTaskId Int? @map("last_focused_task_id")` on `Session` with optional relation to `Task`. Run `pnpm prisma migrate dev` (never hand-write SQL).

#### 2. Server timeout + end session

**File**: `src/server/api/lib/active-session.ts`

**Intent**: On inactivity timeout, set `closureLine` from session stats and `lastFocusedTaskId` before flipping `ENDED_BY_TIMEOUT`.

**Contract**: Before `session.update` to timeout state, compute closure via shared builder (inject or import `buildClosureLine` inputs from cycles/check-ins on that session). Persist both fields.

**File**: `src/server/api/routers/session.ts`

**Intent**: `end` mutation sets `lastFocusedTaskId` from client input or last active cycle; `getLastEnded` returns `lastFocusedTaskId` and `closureLine`.

**Contract**: `end` input optional `lastFocusedTaskId: z.number().int().optional()`; `getLastEnded` select includes new field.

#### 3. Guest parity

**File**: `src/lib/guest/schema.ts`, `src/lib/repositories/guest-repositories.ts`

**Intent**: Guest ended sessions store `lastFocusedTaskId` alongside `closureLine`.

**Contract**: Extend `guestSessionSchema`; set on guest `endSession` / timeout equivalent in guest repos.

#### 4. Client hydrate fallback

**File**: `src/hooks/use-pomodoro-cycle.ts`

**Intent**: When presenting timeout closure on hydrate, prefer `lastEnded.closureLine` from server; only rebuild client-side if null and server stats unavailable.

**Contract**: `maybePresentTimeoutClosure` must not call `buildSessionClosureLine` with counters already forced to 0 when DB line exists.

#### 5. Tests

**Files**: `src/server/api/routers/session.test.ts`, `src/server/api/lib/active-session.test.ts` (new if needed), `src/hooks/use-pomodoro-cycle.test.tsx`

**Intent**: Timeout persists non-null `closureLine`; `getLastEnded` exposes `lastFocusedTaskId`; hydrate does not show “0 cycles” when server line exists.

### Success Criteria:

#### Automated Verification:

- `pnpm prisma migrate dev` applies cleanly
- `pnpm exec vitest run src/server/api/routers/session.test.ts`
- `pnpm exec vitest run src/hooks/use-pomodoro-cycle.test.tsx` (closure hydrate cases)
- `pnpm check` passes

#### Manual Verification:

- End session with focused task → reload → `getLastEnded` shows correct `lastFocusedTaskId`
- Simulate timeout (or test hook) → closure line is not “0 cycles” when work occurred

---

## Phase 2: Inline session steering + scoring wire

### Overview

Replace kickoff/focus popups with inline Card; pass intention into kickoff scorer; remove blocking gates.

### Changes Required:

#### 1. Chip → workType map

**File**: `src/lib/session/narrative-copy.ts`

**Intent**: Central map from intention chip to scoring work-type preference.

**Contract**: Export `INTENTION_CHIP_WORK_TYPE_MAP: Record<string, WorkType>` — e.g. Deep work → `DEEP_WORK`, Clear inbox → `OPERATIONAL`, Ship a feature → `DEEP_WORK` (document mapping in comment).

#### 2. Scoring context

**File**: `src/lib/scoring/score-task.ts`

**Intent**: Apply session-intention work-type boost alongside energy `TYPE_FIT`.

**Contract**: Optional `preferredWorkType?: WorkType` on `ScoringContext`; multiplier when task.workType matches (same order of magnitude as `TYPE_FIT` deltas). Unit tests in `score-task.test.ts`.

#### 3. Suggestion API

**File**: `src/server/api/routers/suggestion.ts`

**Intent**: Kickoff context accepts optional session intention string; map to `preferredWorkType` for `pickBestTask`.

**Contract**: Extend kickoff branch of `nextInputSchema` with `sessionIntention: z.string().max(80).optional()`; map via `INTENTION_CHIP_WORK_TYPE_MAP` (custom text: no boost or heuristic — default no boost).

#### 4. SessionSteeringCard component

**File**: `src/app/_components/session-steering-card.tsx` (new), `session-steering-card.test.tsx`

**Intent**: Inline card combining `EnergySelector` + intention chips + optional custom input; explicit Skip button; no `OverlayScrim`.

**Contract**: `data-testid="session-steering-card"`; chip test ids reuse `cycle-intention-chip-*` or new `steering-intention-*`; fires `onComplete({ energy, intention })` or `onSkip()`.

#### 5. Hook + dashboard integration

**Files**: `src/hooks/use-pomodoro-cycle.ts`, `src/app/_components/pomodoro-dashboard.tsx`

**Intent**: On `kickoffEligible`, show steering card; ~1s auto-skip timer → STEADY + no intention → `fetchKickoffSuggestion`; remove `awaitingKickoffReadiness` overlay path and `awaitingCycleIntention` on `start()`; pass `sessionIntention` to kickoff mutate.

**Contract**: `fetchKickoffSuggestion(sessionId, energy, sessionIntention?)`; delete render of `KickoffReadinessOverlay` and `CycleIntentionPrompt` for kickoff/entry; `start()` no longer sets `awaitingCycleIntention`.

#### 6. Wedge conductor

**File**: `src/lib/wedge/transition-conductor.ts`

**Intent**: Remove `kickoff_readiness` and entry `cycle_intention` from blocking gate candidates (steering is inline).

**Contract**: Update `GATE_PRIORITY` and tests; `computeKickoffEligible` no longer checks `returnHandoffGateOpen` (Phase 3).

#### 7. Permission prompt

**File**: `src/app/_components/pomodoro-dashboard.tsx`

**Intent**: Show break-alerts permission after steering completes, before `start()` — never hidden behind a non-existent overlay gate.

**Contract**: `permissionPromptVisible` independent of removed `showCycleIntention`.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/lib/scoring/score-task.test.ts`
- `pnpm exec vitest run src/app/_components/session-steering-card.test.tsx`
- `pnpm exec vitest run src/lib/wedge/transition-conductor.test.ts`
- `pnpm exec vitest run src/app/_components/pomodoro-dashboard.test.tsx`
- `pnpm exec vitest run src/hooks/use-pomodoro-cycle.test.tsx`
- `pnpm check` passes

#### Manual Verification:

- Idle with tasks → inline steering card (not popup); chips respond; auto-skip after ~1s fetches suggestion
- Custom focus chip changes suggested task class vs no intention (smoke)
- Start cycle → no second focus popup

---

## Phase 3: Continue on task row + remove handoff banner

### Overview

Relocate Continue semantics to list row; remove banner and pol-10 kickoff block.

### Changes Required:

#### 1. Continue task resolution

**File**: `src/lib/session/return-handoff.ts` (refactor)

**Intent**: Replace `pickHandoffTaskContext` list-order fallback with `lastFocusedTaskId` from ended session.

**Contract**: New `resolveContinueTaskId(lastEnded, tasks): DomainTaskId | null` — returns id only if task still active; no banner line composition for task title.

#### 2. Hook exposure

**File**: `src/hooks/use-pomodoro-cycle.ts` or new `use-continue-task.ts`

**Intent**: Expose `continueTaskId` from `getLastEnded.lastFocusedTaskId` when ended session exists (always, not 8h gate).

**Contract**: `continueTaskId: DomainTaskId | null` for dashboard/task list.

#### 3. TaskList row UI

**File**: `src/app/_components/task-list.tsx`, `task-list.test.tsx`

**Intent**: When `continueTaskId === task.id`, show accent ring (reuse suggestion ring token) + subtitle row with icon + “Continue here” under title; **no** resume note on Continue row.

**Contract**: `data-testid="continue-here-row"` on subtitle; `continueTaskId?: DomainTaskId | null` prop.

#### 4. Remove banner + pol-10

**Files**: `src/app/_components/home-shell.tsx`, `return-handoff-banner-mount.tsx`, `use-return-handoff.ts`, `transition-conductor.ts`, `use-pomodoro-cycle.ts`

**Intent**: Remove `ReturnHandoffBannerMount` from shell; delete `returnHandoffGateOpen` from kickoff eligibility; remove handoff dismiss localStorage flow for banner (or keep storage cleanup only if needed).

**Contract**: `computeKickoffEligible` drops `returnHandoffGateOpen` input; kickoff runs immediately when eligible (after steering).

#### 5. Deprecate unused overlay components (optional cleanup)

**Files**: `kickoff-readiness-overlay.tsx`, `cycle-intention-prompt.tsx`

**Intent**: Remove if no remaining references; else leave files but unreferenced (prefer delete if tests updated).

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/lib/session/return-handoff.test.ts`
- `pnpm exec vitest run src/app/_components/task-list.test.tsx`
- `pnpm test` passes

#### Manual Verification:

- Return after ended session → no top banner; suggestion card visible; correct row shows “Continue here”
- Last focused task not first in list → Continue row on correct task

---

## Phase 4: E2E belt + user-flow doc

### Overview

Update belt specs and product flow doc to match new entry sequence.

### Changes Required:

#### 1. E2E handoff spec rewrite

**File**: `e2e/session-return-handoff.spec.ts`

**Intent**: Replace banner assertions with continue-row + kickoff suggestion visible without dismiss.

**Contract**: Assert `continue-here-row` on last-focused task; `task-suggestion-card` visible; no `return-handoff-banner`.

#### 2. E2E kickoff spec

**File**: `e2e/session-kickoff.spec.ts`, `e2e/helpers/kickoff.ts`

**Intent**: Replace `kickoff-readiness-overlay` flow with `session-steering-card` interactions.

**Contract**: `completeKickoffSteering(page, { energy, intention } | 'skip')` helper.

#### 3. User flow doc

**File**: `context/foundation/user-flow.md`

**Intent**: Document inline steering → suggestion → Continue row; remove handoff banner beat and pol-10 defer sequence.

### Success Criteria:

#### Automated Verification:

- `set CI=true && pnpm test:e2e:belt` passes
- `pnpm check` passes

#### Manual Verification:

- Full entry flow on authenticated account: steering → suggestion → continue row → start cycle

---

## Testing Strategy

### Unit Tests

- `buildClosureLine` / timeout persist integration
- `resolveContinueTaskId` last-focus semantics
- `ScoringContext.preferredWorkType` bias
- Steering card chip/skip/auto-skip timer (hook or component)
- Conductor without kickoff_readiness / cycle_intention gates

### E2E

- Kickoff with steering skip and with FOCUSED energy
- Return after session end: continue row + suggestion (no banner)
- Session closure on end still works (`session-closure.spec.ts` regression)

### Manual Testing Steps

1. Fresh auth user with tasks → steering inline → suggestion loads
2. Pick “Deep work” → suggestion favors deep work type
3. End session on task B (not first in list) → reload → Continue here on B
4. Timeout path (or test DB) → no “0 cycles” false closure
5. Notification permission `default` → steering skip → start → permission prompt once

## Performance Considerations

- L-04: clearing steering card and setting kickoff `loading` synchronously on chip tap / auto-skip before `mutateAsync`
- Auto-skip timer cleared on unmount and kickoff ineligible transitions

## Migration Notes

- Prisma migration adds nullable `last_focused_task_id` — backfill not required; Continue row appears after next session end
- Remove `flowstate:handoff-dismissed:*` keys optionally (dead code)

## References

- Frame brief: `context/changes/session-entry-wedge-bugs/frame.md`
- F-07 conductor: `context/archive/2026-06-18-wedge-transition-conductor/plan.md`
- S-17 narrative: `context/archive/2026-06-12-session-narrative-summary/plan.md`
- Break-alerts overlay order: `context/archive/2026-06-18-break-alerts-out-of-tab/plan.md:187`
- `src/app/_components/pomodoro-dashboard.tsx`
- `src/hooks/use-pomodoro-cycle.ts`
- `src/lib/wedge/transition-conductor.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Last focus persistence + closure on timeout

#### Automated

- [x] 1.1 `pnpm prisma migrate dev` applies cleanly
- [x] 1.2 `pnpm exec vitest run src/server/api/routers/session.test.ts`
- [x] 1.3 `pnpm exec vitest run src/hooks/use-pomodoro-cycle.test.tsx` (closure hydrate cases)
- [x] 1.4 `pnpm check` passes

#### Manual

- [x] 1.5 End session with focused task → reload → lastFocusedTaskId correct
- [x] 1.6 Timeout path → closure line not false “0 cycles”

### Phase 2: Inline session steering + scoring wire

#### Automated

- [x] 2.1 `pnpm exec vitest run src/lib/scoring/score-task.test.ts`
- [x] 2.2 `pnpm exec vitest run src/app/_components/session-steering-card.test.tsx`
- [x] 2.3 `pnpm exec vitest run src/lib/wedge/transition-conductor.test.ts`
- [x] 2.4 `pnpm exec vitest run src/app/_components/pomodoro-dashboard.test.tsx`
- [x] 2.5 `pnpm exec vitest run src/hooks/use-pomodoro-cycle.test.tsx`
- [x] 2.6 `pnpm check` passes

#### Manual

- [x] 2.7 Inline steering; chips work; auto-skip ~1s; no focus popup on Start
- [x] 2.8 Deep work chip biases suggestion (smoke)

### Phase 3: Continue on task row + remove handoff banner

#### Automated

- [x] 3.1 `pnpm exec vitest run src/lib/session/return-handoff.test.ts`
- [x] 3.2 `pnpm exec vitest run src/app/_components/task-list.test.tsx`
- [x] 3.3 `pnpm test` passes

#### Manual

- [x] 3.4 No banner; suggestion visible; Continue here on last-focused row

### Phase 4: E2E belt + user-flow doc

#### Automated

- [x] 4.1 `set CI=true && pnpm test:e2e:belt` passes
- [x] 4.2 `pnpm check` passes

#### Manual

- [x] 4.3 Full authenticated entry flow smoke
