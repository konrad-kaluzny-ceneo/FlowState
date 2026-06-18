# Fix Stale Suggestion After Task Delete — Plan Brief

> Full plan: `context/changes/fix-stale-suggestion-after-delete/plan.md`  
> Research: `context/changes/fix-stale-suggestion-after-delete/research.md`

## What & Why

When FlowState suggests the next task and the user deletes that task from the list, the top suggestion card still shows the removed task. The card reads from a local API snapshot that never hears about task deletes.

## Starting Point

Suggestion state (`pendingKickoffSuggestion`, `pendingSuggestion`) lives in `usePomodoroCycle` and clears only on Pomodoro lifecycle events. Task delete goes through `useTaskMutations` and updates the task list cache only. Dashboard already builds `activeTaskIds` but uses it for mark-done, not suggestion validity.

## Desired End State

Deleting the suggested task on kickoff idle immediately invalidates the card — refetching a new suggestion when other tasks remain, or showing the empty state when none remain. Pre-focus staging clears if the deleted task was accepted. Vitest locks the behaviour.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Sync location | `activeTaskIds` option on `usePomodoroCycle` + effect | Single testable point; dashboard already has the set | Research |
| After invalidation | Refetch if tasks remain, else `empty` | Best UX without new API; reuses `fetchKickoffSuggestion` / post-check-in fetch | Plan |
| `recordDecision` on delete | No | Delete is not choosing another task (unlike Focus override) | Research |
| Post-check-in break delete | Out of scope | S-06 locks delete during break; sync handles list drift only | Research |
| Guest mode | No UI change | Suggestion gate already off for guest | Research |
| Pre-focus on delete | Clear staging when id matches | Prevents stale focus/chips after idle delete | Research |
| E2E | `@skip-belt` kickoff delete test | Belt unchanged; browser regression optional in Phase 2 | Plan |

## Scope

**In scope:** Kickoff + post-check-in suggestion invalidation when suggested id ∉ active tasks; accept guards; Vitest; optional non-belt e2e.

**Out of scope:** Delete-on-break unlock, guest suggestion UI, `recordDecision` analytics, override card persistence fix.

## Architecture / Approach

```
tasks prop → activeTaskIds (dashboard) → usePomodoroCycle effect
                                              ↓
                         suggested id missing? → pre-focus clear
                                              → refetch OR empty
```

No changes to `useTaskMutations` or server routers.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Characterization | Failing Vitest oracle for stale kickoff suggestion | Test setup must mock kickoff ready state realistically |
| 2. Enforcement | Sync effect + dashboard wiring + green tests | Refetch race if gen ref not bumped before fetch |

**Prerequisites:** None — standalone bug fix on current main patterns.  
**Estimated effort:** ~1 session, 2 phases.

## Open Risks & Assumptions

- User report may have been kickoff idle (Path B), not break (Path A delete is disabled).
- Refetch during kickoff requires valid `_activeSessionId` and `lastKickoffEnergyRef` — plan-review adds explicit `empty` fallback when session id missing.
- Plan updated 2026-06-18 after plan-review (F-01–F-08): ref pattern, effect deps, accept-guard tests, `empty` vs `idle` oracle.

## Success Criteria (Summary)

- Delete suggested task on kickoff idle → card no longer shows removed title.
- Delete unrelated task → suggestion unchanged.
- `pnpm test` green including new hook tests.
