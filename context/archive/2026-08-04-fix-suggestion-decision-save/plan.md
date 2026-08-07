# Fix suggestion decision save — Implementation Plan

## Overview

Stop false "could not save suggestion preference" toasts on kickoff accept/override when the suggested or chosen task is `planned` (still in the suggestion pool). Align `recordDecision` ownership checks with `buildSuggestionPool` statuses. Skip guest-mode kickoff decision persistence (no auth server).

## Current State Analysis

- `buildSuggestionPool` includes `status: { in: ["active", "planned"] }` (`src/lib/suggestion/build-suggestion-pool.ts`).
- `verifyOwnedTasks` in `suggestion.ts` requires `status: "active"` only — any planned suggested/chosen task → `NOT_FOUND` → client `suggestionDecisionSaveFailed` toast.
- `recordKickoffDecision` in `use-pomodoro-cycle.ts` always calls tRPC; guest string IDs become `NaN` and also fail.

## Desired End State

- Kickoff / post-check-in `recordDecision` succeeds for tasks in the suggestion pool (`active` | `planned`).
- Guest mode never attempts `recordDecision` and never shows the save-failed toast for kickoff choices.
- Existing accept/override learning signal still persists for authenticated users.

## What We're NOT Doing

- No new preference UI
- No guest-side suggestion decision persistence
- No changes to scoring / pool membership beyond ownership check alignment

## Phase 1: Align recordDecision ownership with suggestion pool

### Changes Required

- Export or reuse pool statuses so `verifyOwnedTasks` accepts `active` and `planned`
- `recordKickoffDecision`: no-op when `mode === "guest"`
- Unit coverage: router accepts planned; hook guest path does not call mutate / set that error

### Success Criteria

- Authenticated `recordDecision` with planned suggested/chosen task succeeds
- Guest kickoff accept/override does not surface `suggestionDecisionSaveFailed`
- Existing suggestion router tests still pass

### Verification

#### Automated Verification:

- Router isolation/unit: planned task recordDecision succeeds
- Hook: guest does not call recordDecision on kickoff accept
- `pnpm exec vitest run` for touched test files
- `pnpm check` on touched paths

#### Manual Verification:

- Signed-in: kickoff suggest a planned task → accept → no error banner
- Signed-in: override kickoff with another planned task → no error banner
- Guest: select suggested task → no preference-save error toast

## Progress

### Phase 1: Align recordDecision ownership with suggestion pool

#### Automated

- [x] 1.1 Router: recordDecision succeeds when suggested/chosen tasks are planned — 7f203ce
- [x] 1.2 Hook: guest kickoff accept skips recordDecision (mode + finite-id guard in `recordKickoffDecision`) — 7f203ce
- [x] 1.3 Type checking / lint on touched files — 7f203ce

#### Manual

- [ ] 1.4 Auth planned-task kickoff accept/override shows no save-failed toast
- [ ] 1.5 Guest kickoff choice shows no save-failed toast
