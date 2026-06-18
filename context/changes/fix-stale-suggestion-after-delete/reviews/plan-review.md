<!-- PLAN-REVIEW-REPORT -->
# Plan Review: fix-stale-suggestion-after-delete

- **Plan**: `context/changes/fix-stale-suggestion-after-delete/plan.md`
- **Brief**: `context/changes/fix-stale-suggestion-after-delete/plan-brief.md`
- **Mode**: Deep (sub-agent code verification)
- **Date**: 2026-06-18
- **Reviewer**: Cursor Agent (sub-agent [090c66a6-fb48-4f39-945e-436873ff206e](090c66a6-fb48-4f39-945e-436873ff206e))
- **Verdict**: APPROVE WITH FIXES
- **Findings**: 0 critical, 4 major, 4 minor, 3 nit

## Verdicts

| Dimension | Verdict |
| --- | --- |
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS (after F-01, F-02) |
| Blind Spots | WARNING → PASS (after F-03, F-04) |
| Plan Completeness | WARNING → PASS (after F-04, F-05, F-08) |

## Grounding

Grounding: plan paths ✓, symbols ✓ (`fetchKickoffSuggestion`, `fetchPostCheckInSuggestion`, `fetchSuggestion`, `retryKickoffSuggestion`, `activeTaskIds`, `cycleLocked`), brief↔plan ✓, research↔plan ✓

## Findings

### F-01 — `options.activeTaskIds` needs ref pattern

- **Severity**: ⚠️ MAJOR
- **Dimension**: Architectural Fitness
- **Location**: Phase 2 — invalidation effect + accept guards
- **Detail**: Plan passes `activeTaskIds` via options but accept callbacks must read current membership without stale closures. Existing hook already uses `getCycleEndAudioModeRef` (`use-pomodoro-cycle.ts:229-241`).
- **Fix A ⭐ Recommended**: Add `activeTaskIdsRef` updated in `useEffect`; read from invalidation effect and accept guards.
  - Strength: Matches established hook options pattern; stable callback deps.
  - Tradeoff: One extra ref + effect.
  - Confidence: HIGH.
- **Decision**: PENDING

### F-02 — Effect dependency list under-specified

- **Severity**: ⚠️ MAJOR
- **Dimension**: Blind Spots
- **Location**: Critical Implementation Details vs Phase 2 contract
- **Detail**: Plan says run when `activeTaskIds` or `pending*Suggestion.status === "ready"` changes, but Phase 2 contract only mentions `options.activeTaskIds`. If suggestion becomes `ready` while id already missing from set, effect may not re-run.
- **Fix A ⭐ Recommended**: Document deps: `activeTaskIds` (or serialized membership), both pending statuses, and suggested `taskId` fields.
  - Strength: Covers transition-to-ready with stale membership.
  - Tradeoff: Slightly broader effect surface; guard with id ∉ set check inside.
  - Confidence: HIGH.
- **Decision**: PENDING

### F-03 — Kickoff refetch needs `_activeSessionId` null guard

- **Severity**: ⚠️ MAJOR
- **Dimension**: Blind Spots
- **Location**: Phase 2 — invalidation helper
- **Detail**: `retryKickoffSuggestion` already guards `if (_activeSessionId != null)` (`use-pomodoro-cycle.ts:2692-2698`). Plan omits fallback when session id missing during refetch path.
- **Fix A ⭐ Recommended**: If refetch needed but `_activeSessionId == null`, set kickoff suggestion to `empty` instead of calling `fetchKickoffSuggestion`.
  - Strength: Prevents silent no-op leaving stale `ready`.
  - Tradeoff: Edge case only; must document in contract.
  - Confidence: HIGH.
- **Decision**: PENDING

### F-04 — Accept-guard test missing from phase contracts

- **Severity**: ⚠️ MAJOR
- **Dimension**: Plan Completeness
- **Location**: Testing Strategy vs Phase 1/2
- **Detail**: Strategy lists “Accept no-op when id missing from set” but Phase 1 cases omit it; Phase 2 adds guards without test step.
- **Fix A ⭐ Recommended**: Add Phase 1 red + Phase 2 green case: `acceptKickoffSuggestion()` with suggested id ∉ `activeTaskIds` → no `preFocusedTask`, no `recordDecisionMutation`.
  - Strength: Locks race guard from Critical Implementation Details.
  - Tradeoff: One more test case in large file.
  - Confidence: HIGH.
- **Decision**: PENDING

### F-05 — Pre-focus cleanup scope incomplete in test contract

- **Severity**: 💡 MINOR
- **Dimension**: Plan Completeness
- **Location**: Phase 1 pre-focus case; Desired End State #3
- **Detail**: `acceptKickoffSuggestion` sets `focusedTaskId` / `focusedTask` via `preFocusTask` (`use-pomodoro-cycle.ts:991-997`). Phase 1 test only asserts `preFocusedTask` and `hasPreFocusedKickoff`.
- **Fix A ⭐ Recommended**: Also assert `focusedTaskId === null` and `stagedKickoffDurationSec === null` after stale invalidation.
  - Strength: Matches manual step 3 and duration chips UX.
  - Tradeoff: Slightly broader assertions.
  - Confidence: HIGH.
- **Decision**: PENDING

### F-06 — Do not use `retrySuggestion` / `fetchSuggestion` for post-check-in refetch

- **Severity**: 💡 MINOR
- **Dimension**: End-State Alignment
- **Location**: Phase 2 contract
- **Detail**: `fetchSuggestion` calls `clearKickoffSuggestion()` + `clearKickoffIdleFlags()` (`use-pomodoro-cycle.ts:1089-1092`). Plan correctly specifies `fetchPostCheckInSuggestion` but should forbid `retrySuggestion` explicitly.
- **Fix A ⭐ Recommended**: Add “do not use `retrySuggestion`” note in Phase 2 invalidation contract.
  - Strength: Prevents implementer shortcut that wipes kickoff state.
  - Tradeoff: Documentation only.
  - Confidence: HIGH.
- **Decision**: PENDING

### F-07 — Phase 1 needs `rerender` hook pattern

- **Severity**: 💡 MINOR
- **Dimension**: Lean Execution
- **Location**: Phase 1 characterization tests
- **Detail**: No existing `rerender` usage in `use-pomodoro-cycle.test.tsx`; membership change requires `renderHook` with dynamic props.
- **Fix A ⭐ Recommended**: Document `renderHook((props) => usePomodoroCycle(props), { initialProps: { activeTaskIds } })` + `rerender` in Phase 1 contract.
  - Strength: Makes Phase 1 executable without implementer guesswork.
  - Tradeoff: New test pattern in file.
  - Confidence: HIGH.
- **Decision**: PENDING

### F-08 — Zero-task path should assert `empty`, not `idle`

- **Severity**: 💡 MINOR
- **Dimension**: Plan Completeness
- **Location**: Phase 1/2 success criteria
- **Detail**: `showKickoffCard` hides on `idle` (`pomodoro-dashboard.tsx:103-104`); `empty` shows “No active tasks” copy (`task-suggestion-card.tsx:257-260`). Plan says set `empty` but Phase 1 oracle only says “not `ready`”.
- **Fix A ⭐ Recommended**: Named test case: last active task deleted → `pendingKickoffSuggestion.status === "empty"`.
  - Strength: Prevents wrong UX (hidden card vs empty message).
  - Tradeoff: Stricter assertion.
  - Confidence: HIGH.
- **Decision**: PENDING

### F-09 — Post-check-in during break: correctly scoped

- **Severity**: 💡 NIT
- **Dimension**: End-State Alignment
- **Location**: Scope vs research
- **Detail**: Delete blocked during break (`task-list.tsx:702`); post-check-in sync is defensive only. Refetch may briefly block `selectTask` during loading — acceptable.
- **Decision**: ACCEPTED (no plan change)

### F-10 — Stale line reference in plan

- **Severity**: 💡 NIT
- **Dimension**: Plan Completeness
- **Location**: Key Discoveries — override test cite
- **Detail**: Plan cites `1896-1940`; override test is at `2133-2198`.
- **Fix**: Update reference when editing plan.
- **Decision**: PENDING

### F-11 — E2E kickoff-delete feasible

- **Severity**: 💡 NIT
- **Dimension**: Lean Execution
- **Location**: Phase 2 optional E2E
- **Detail**: `prepareSessionStartKickoff` exists (`e2e/session-kickoff.spec.ts:19-47`); delete via `getByLabel('Delete task')` on suggested row is viable.
- **Decision**: ACCEPTED (optional scope stands)

### F-12 — Dashboard `activeTaskIds` memo adequate

- **Severity**: 💡 NIT (positive)
- **Dimension**: Architectural Fitness
- **Location**: Performance Considerations
- **Detail**: `useMemo` over `tasks` (`pomodoro-dashboard.tsx:66-69`) gives stable-enough updates.
- **Decision**: ACCEPTED

## Triage Summary

```
═══════════════════════════════════════════════════════════
  TRIAGE PENDING
═══════════════════════════════════════════════════════════

  Pending:   F-01, F-02, F-03, F-04, F-05, F-06, F-07, F-08, F-10  (9)
  Accepted:  F-09, F-11, F-12                                      (3)

  ► Verdict after fixes: SOUND (ready for /10x-implement)
═══════════════════════════════════════════════════════════
```
