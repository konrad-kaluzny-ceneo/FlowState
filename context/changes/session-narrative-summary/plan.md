# Session Narrative Summary (S-17) Implementation Plan

## Overview

Deliver FR-040 session narrative: in-flow one-line summary during active sessions, calm closure on session end (user + timeout paths), and dismissible 8h return handoff composing stored closure + S-18 `Task.resumeNote`. Pure builder module first; UI follows existing wedge overlay mutual-exclusion patterns.

## Decision Log (orchestrator proxy)

| Question | Decision | Confidence |
|----------|----------|------------|
| Closure persistence | Store `Session.closureLine` at end time (nullable VarChar 120) | 90% |
| Tasks completed count | Count WORK cycles in session where linked task is now `completed` | 85% |
| Latest energy for narrative | Query latest CheckIn via session cycles join, ordered by `respondedAt desc` | 88% |
| Timeout closure UX | On session id change from `getOrCreateActive`, show closure for prior ended session once | 82% |
| Guest closure | On guest `end()` only (no wind-down); derive narrative from blob | 85% |
| Cycle intention prompt | First WORK cycle of session only; skippable; stored on `Cycle.intention` | 88% |
| Handoff dismiss | localStorage `flowstate:handoff-dismissed-at` + server optional later | 90% |
| In-flow summary placement | Inline strip (override-ack pattern); hidden when any gate/suggestion active | 95% |

## Current State Analysis

- Session lifecycle complete; `endSession()` resets with no closure UI (`use-pomodoro-cycle.ts:1868-1917`).
- S-18 `Task.resumeNote` shipped; clears on task complete.
- Overlay mutual-exclusion guards in `pomodoro-dashboard.tsx` (check-in, wind-down, suggestion, catch-up).
- No narrative builder; wind-down copy module is closest pattern (`src/lib/session/`).
- 4h server timeout silent; distinct from 8h client return handoff on `Session.endedAt`.

## Desired End State

1. During active session (idle on break, no gates): user sees one-line in-flow summary (cycles done, tasks completed, latest energy, optional intention).
2. On session end (user button, wind-down path, or detected timeout): user sees dismissible closure overlay with calm one-liner; line persisted on `Session.closureLine`.
3. On return after 8h since last `endedAt`: user sees dismissible handoff banner (resume note clause first, task title second, max two clauses).
4. Guest parity from local blob; no analytics/charts.
5. `pnpm check`, `pnpm test` green; e2e belt covers closure + handoff paths.

## What We're NOT Doing

- Charts, streaks, comparative stats, analytics screens
- Mid-cycle focus-switch intention capture (S-18 scope)
- Guest wind-down gate (auth-only S-16)
- Scorer / rationale template changes
- Cycle intention on every cycle start (frame: first only)
- S-21 mindful transition copy (separate slice)

## Phase 1: Schema + narrative builder (pure)

### Changes

- `prisma/schema.prisma`: add `Cycle.intention String? @map("intention") @db.VarChar(80)`; add `Session.closureLine String? @map("closure_line") @db.VarChar(120)`
- Migration: `pnpm prisma migrate dev --name session_narrative_fields`
- `src/lib/session/narrative-builder.ts` (new): pure functions
  - `buildInFlowSummary({ cyclesCompleted, tasksCompleted, latestEnergy, intention? })`
  - `buildClosureLine({ cyclesCompleted, tasksCompleted, latestEnergy, endedBy })`
  - `buildReturnHandoff({ closureLine, resumeNote?, taskTitle? })` — max two clauses, resume first
- `src/lib/session/narrative-copy.ts` (new): calm template strings
- `src/lib/guest/schema.ts`: optional `intention` on `guestCycleSchema`; optional `closureLine` on `guestSessionSchema`
- Unit tests: `narrative-builder.test.ts` — fixtures for all three beats + edge cases (empty energy, note-only handoff)

### Success Criteria

- Migration applies; builder tests pass
- `pnpm check`, `pnpm typecheck`

## Phase 2: Server queries + tRPC

### Changes

- `src/server/api/routers/session.ts`:
  - Extend `end` to accept optional precomputed `closureLine` or compute server-side from session stats
  - Add `getLastEnded` — returns most recent ended session with `closureLine`, `endedAt`, `state`
- `src/server/api/routers/cycle.ts`:
  - Extend `create` input with optional `intention` (first cycle only enforced client-side)
  - Add `countTasksCompletedInSession({ sessionId })` — WORK cycles where task.status = completed
  - Add `getLatestCheckInEnergy({ sessionId })` — join cycles → checkIn, latest `respondedAt`
- Wire guest repos: map intention + closureLine
- Router tests for new procedures

### Success Criteria

- Router unit tests pass
- `pnpm test` for session/cycle routers

## Phase 3: In-flow summary + cycle intention

### Changes

- `use-pomodoro-cycle.ts`:
  - Fetch narrative context when session active (counts + latest energy)
  - Optional intention capture on first WORK cycle start (skippable inline chips or compact prompt before timer)
  - Expose `inFlowSummaryLine: string | null` with gate-aware nulling
- `pomodoro-dashboard.tsx`: render muted inline strip between timer and suggestion (`data-testid="session-inflow-summary"`) with guards matching `showSuggestionCard` / gate booleans
- Component test: summary visible on break idle; hidden during check-in/suggestion

### Success Criteria

- Component tests pass
- No overlap with suggestion card on same beat (manual guard in test)

## Phase 4: Session closure overlay

### Changes

- `src/app/_components/session-closure-overlay.tsx` (new): `OverlayScrim` z=58, single dismiss CTA, calm closure line
- `use-pomodoro-cycle.ts`:
  - After successful `sessions.end()`, set `pendingClosureLine` before state reset; show overlay
  - `onWindDownEndSession` path: same closure after end
  - Timeout detection: when `getOrCreateActive` returns new session id, call `getLastEnded` **before** resetting client session counters; show closure once per ended session id (dedupe key in sessionStorage)
- Persist `closureLine` via extended `session.end` mutation
- Guest: compute + store closure on `guestSession.end()`
- E2E: `e2e/session-closure.spec.ts` — end session → see closure → dismiss

### Success Criteria

- E2E closure spec passes locally
- `pnpm test` green

## Phase 5: 8h return handoff banner

### Changes

- `src/lib/session/return-handoff.ts` (new): `shouldShowHandoff(endedAt, dismissedAt?)` — 8h threshold
- `src/app/_components/return-handoff-banner.tsx` (new): dismissible strip; mount in `home-shell.tsx` with mutual-exclusion vs active gates (pattern: `FirstRunOverlay`)
- On mount (auth): `session.getLastEnded`; compose handoff via builder + active tasks with `resumeNote`
- Guest: scan blob sessions for max `endedAt`; compose from local tasks
- Dismiss: `localStorage` key `flowstate:handoff-dismissed:{sessionId}` (per ended session, not global)
- E2E: `e2e/session-return-handoff.spec.ts` — mock/storage seed ended session >8h ago → banner → dismiss

### Success Criteria

- E2E handoff spec passes
- Handoff never stacks on suggestion card (assertion in spec)

## Phase 6: Verification + test-plan cookbook

### Changes

- Update `context/foundation/test-plan.md` §6 cookbook entry for session narrative (if applicable phase row)
- Run full `pnpm check`, `pnpm test`, `set CI=true && pnpm test:e2e:belt`
- Update `change.md` status → `implemented` after all Progress automated items done

### Success Criteria

- Full test suite green
- E2E belt passes

## References

- `context/changes/session-narrative-summary/frame.md`
- `context/changes/session-narrative-summary/research.md`
- `context/foundation/roadmap.md` §S-17
- `context/foundation/prd.md` FR-040
- `context/archive/2026-06-12-task-resume-context-note/`
- `context/foundation/lessons.md` L-04 (200ms per surface)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Schema + narrative builder (pure)

#### Automated

- [x] 1.1 Prisma migration (Cycle.intention, Session.closureLine) + generate
- [x] 1.2 narrative-builder + narrative-copy modules + unit tests

### Phase 2: Server queries + tRPC

#### Automated

- [x] 2.1 session.end closure persistence + getLastEnded
- [x] 2.2 cycle intention + session stats queries + router tests

### Phase 3: In-flow summary + cycle intention

#### Automated

- [x] 3.1 Hook narrative context + intention capture on first cycle
- [x] 3.2 Dashboard in-flow strip + component tests

### Phase 4: Session closure overlay

#### Automated

- [x] 4.1 SessionClosureOverlay + endSession/wind-down/timeout hooks
- [x] 4.2 Guest closure parity
- [x] 4.3 E2E session-closure.spec.ts — 5a0c025

### Phase 5: 8h return handoff banner

#### Automated

- [x] 5.1 return-handoff module + ReturnHandoffBanner in home-shell — 194e15b
- [x] 5.2 Guest handoff parity + dismiss persistence — 194e15b
- [x] 5.3 E2E session-return-handoff.spec.ts — 194e15b

### Phase 6: Verification + test-plan cookbook

#### Automated

- [x] 6.1 Full pnpm check + test + e2e belt
- [x] 6.2 Test-plan cookbook update (if §3 phase warrants)
