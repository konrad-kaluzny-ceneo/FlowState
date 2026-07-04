# Daily standing task list completion fix — Plan Brief

> Full plan: `context/changes/daily-tasks-bug/plan.md`

## What & Why

Tasks marked “Uwzględnij w Daily” stay in **Aktywne** after the user clicks complete and show a checkmark that cannot be undone. Daily inclusion must not affect list placement — completed tasks always belong in **Ukończone** with a working revert action.

## Starting Point

`SortableActiveTaskRow` treats `isDailyStanding` as a separate completion path: it calls `markDoneForToday` (sets `doneForToday: true`, keeps `status: "active"`) instead of `updateTask({ status: "completed" })`. Sections split on `status` only, so standing tasks never leave **Aktywne**.

## Desired End State

Every active-row checkbox uses the same complete pipeline. Daily standing tasks land in **Ukończone** and revert like any other task. The Daily badge and recap/plan semantics for `isDailyStanding` stay unchanged.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Completion semantics (list) | Always `status: "completed"` | Matches user expectation and section filters | Change notes |
| Pomodoro cycle-complete overlay | Out of scope | Separate surface; bug report is list checkbox only | Plan |
| API / schema | No changes | Bug is UI routing, not data model | Plan |
| Legacy `doneForToday` active rows | No migration | Edge case from pomodoro path; fix prevents new cases | Plan |
| E2E belt | Unit tests only | One-handler fix; co-located test is canonical guard | Plan |

## Scope

**In scope:** `task-list.tsx` complete handler, prop cleanup, `task-list.test.tsx` updates, `pnpm check` + `pnpm test`.

**Out of scope:** `pomodoro-dashboard.tsx` `markDoneForToday` on cycle complete, recap midnight reset, new e2e spec.

## Architecture / Approach

Remove the `isDailyStanding` branch in the active-row complete button so all tasks call the existing `updateTask({ status: "completed" })` path (with the same animation/mid-cycle hooks). No backend changes.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Unify handler | Standing tasks complete into **Ukończone** | Accidentally breaking mid-cycle complete hook |
| 2. Tests | Regression guard on unified path | Miss updating aria-label assertion |

**Prerequisites:** Work on `features/mvp-defect-intake`.
**Estimated effort:** ~1 session, 2 phases.

## Open Risks & Assumptions

- Pomodoro cycle-complete may still mark daily tasks “done for today” without moving them to **Ukończone** — acceptable unless product asks for alignment.
- Rows already stuck with `doneForToday` + `active` are not auto-healed.

## Success Criteria (Summary)

- Daily standing task checkbox → **Ukończone** section.
- Revert restores task to **Aktywne** with Daily badge.
- Unit tests and full `pnpm test` green.
