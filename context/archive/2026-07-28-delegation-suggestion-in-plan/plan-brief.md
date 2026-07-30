# Delegation Suggestion in Plan dnia — Plan Brief

> Full plan: `context/changes/delegation-suggestion-in-plan/plan.md`

## What & Why

In the Plan dnia view, the scorer proposes one task suitable for delegation (to an AI agent or a human) with a one-line rationale; the user accepts or skips. This is S-47, the follow-up to S-46 (MCP server for agents) — it's the first place FlowState actively surfaces delegation opportunities rather than just exposing task data to agents that ask for it.

## Starting Point

Plan dnia today is mostly a placeholder — the only real content is `BudgetPanel` (focus-budget setting). Task status is a closed set (`active`/`completed`/`archived`/`planned`/`blocked`) with an established 7-seam pattern for adding a new value (last used for `"blocked"` in S-51). The Fokus next-task suggestion pipeline (scoring → dominant factor → rationale) is energy/session-aware; delegation scoring is deliberately simpler and doesn't need any of that context.

## Desired End State

An authenticated user on Plan dnia sees a card proposing one delegatable task with a rationale like "low effort, operational work." Accept sets the task to a new `"delegated"` status (it leaves the Fokus pool and the Active tab). Skip dismisses that candidate for today only. `/tasks` gets a "Delegated" tab that mirrors the existing "Blocked" tab exactly, with a revert-to-active action.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Delegatability signal | Reuse `workType`/`effortMinutes`/`commitmentHorizon` | No new task attribute needed — existing Eisenhower/effort fields are sufficient | Plan (12-Q round) |
| Accept persistence | New `"delegated"` task status (no column migration) | `Task.status` is already free-form VARCHAR; mirrors the S-51 `"blocked"` precedent exactly | Plan |
| MCP scope | No MCP changes; `"delegated"` excluded from the `update_task` write enum | Agents must not be able to set/unset delegation themselves; reads get it for free via `list_tasks` | Plan |
| UI placement | New real section beside `BudgetPanel` | `DayCalendarMock`/`ComingSoonPreview` stays untouched placeholder | Plan |
| Guest mode | Authenticated only | Matches `useDayPlan`'s existing gating; no guest delegation path | Plan |
| Revert/undo | Mirror the `/tasks` blocked-tab pattern exactly | Reuses an established, tested UX rather than inventing a new one | Plan |
| Skip semantics | Dismiss for today only, new `TaskDelegationSkip` table | Mirrors `TaskDayCompletion`'s day-scoped shape; this is the one real migration | Plan |
| Candidate count | Single top candidate, one card | Matches Fokus's next-task suggestion shape (one card, not a list) | Plan |
| Rationale | Extend `RationaleKey`/`buildRationale`, new `formatDelegationRationale` wrapper | Reuses the existing i18n'd rationale pipeline instead of a parallel copy system | Plan |
| Testing depth | Unit + integration only, no e2e | Pure scoring + a status mutation; no wedge/timer involvement (lesson L-06) | Plan |
| Scope | Everything ships as one slice | No fast-follow split | Plan |

## Scope

**In scope:** delegation-scoring module, rationale extension, `dayPlanRouter` query + mutation, Plan dnia card, `/tasks` Delegated tab + revert, task-detail status pill, i18n (EN/PL).

**Out of scope:** guest mode, MCP write support, candidate lists, AI-vs-human classification, rationale breakdown/expander, e2e coverage, a new "delegate" button on active rows, calendar-mock changes.

## Architecture / Approach

Data model → business logic → API → UI, in three phases:
1. Add `"delegated"` across the 7 existing status seams + the new `TaskDelegationSkip` migration.
2. New `delegation-score.ts` (context-free scoring) + rationale extension + two new `dayPlanRouter` procedures (`getDelegationSuggestion`, `skipDelegationSuggestion`).
3. New `useDelegationSuggestion` hook + `delegation-suggestion-card.tsx` (sibling to, not an extension of, `TaskSuggestionCard` — lesson L-07) wired into Plan dnia; `/tasks` mirrors the blocked-tab pattern for a Delegated tab.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Data model | `"delegated"` status across all seams + skip-table migration | Missing one of the 7 seams silently breaks guest/server parity (no compile error) |
| 2. Scoring + API | Delegation scorer, rationale keys, 2 new tRPC procedures | Rationale's stub-context nuance (see plan's Critical Implementation Details) |
| 3. UI | Plan dnia card + `/tasks` Delegated tab + i18n | Must stay a fully separate surface from the Fokus suggestion star (L-07) |

**Prerequisites:** S-45 (Plan dnia exists), S-46 (MCP server, archived) — both done.
**Estimated effort:** ~2-3 sessions across 3 phases.

## Open Risks & Assumptions

- Delegation-score weighting (the specific multipliers in Phase 2) is a first-pass heuristic — may need tuning after real usage, but no user-facing tuning UI is in scope for v1.
- `formatDelegationRationale`'s stub `ScoringContext` is a minor type-satisfying workaround, not a design decision — flagged explicitly in the plan so it isn't "fixed" into something more complex later.

## Success Criteria (Summary)

- A user can see, accept, and skip a delegation suggestion on Plan dnia; accepted tasks show up in a new `/tasks` Delegated tab and can be reverted.
- Delegated tasks are excluded from the Fokus suggestion pool and the Active tab without any suggestion-pool code changes (falls out of the existing status-filter for free).
- Guest mode is untouched; MCP agents can read but not write the `"delegated"` status.
