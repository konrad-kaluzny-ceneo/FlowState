# Frame Brief: Dual task completion affordances

> Framing step before /10x-plan. This document captures what is *actually*
> at issue, separated from what was initially assumed.

## Reported Observation

On the task list, users see two different controls for “finishing” work on tasks:
**“Mark complete”** (checkbox-style) on some rows and **“Done today”** / **“Done for today”**
(text button) on others. This feels like a redundant, erroneous second way to close a task.

## Initial Framing (preserved)

- **User's stated cause or approach**: The extra button likely came from a misread of the Daily recap requirement — someone thought recap needed its own completion action instead of reading tasks completed in the last 24 hours.
- **User's proposed direction**: Remove the “Done for today” button; let Daily recap derive from tasks marked complete in the rolling 24h window.
- **Pre-dispatch narrowing**: Leading concern is the **duplicate completion buttons visible on tasks** (not recap content mismatch as the primary symptom).

## Dimension Map

The observation could originate at any of these dimensions:

1. **List-level UX duplication** — two completion metaphors on one screen (per-day vs global) without enough differentiation; reads as “two ways to close a task.”
2. **Recap requirement misread** — “Done for today” was added to feed Daily recap instead of using completion timestamps. ← initial framing
3. **Intentional standing-task semantics (S-27)** — daily standing tasks need per-calendar-day completion without `status: completed` (suggestion pool, midnight rollover).
4. **Same-row implementation bug** — both controls rendered on a single task row (plan drift from “hide global complete on standing rows”).

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| List-level UX duplication | `task-list.tsx:333-379` — `isDailyStanding` branch shows “Done today” text button; non-standing shows icon-only “Mark complete”. New tasks default `isDailyStanding: true` (`task-list.tsx:570`). User sees both patterns across the list. | **STRONG** (matches leading concern) |
| Recap requirement misread | S-27 archive (`plan.md:50`, `plan-brief.md` Desired End State) introduced button for **suggestion pool / standing semantics**; explicitly deferred recap to S-30. `build-daily-recap.ts:27-70` — Last 24h from COMPLETED WORK cycles + global `status: completed`; `markDoneForToday` not a Last 24h source (`build-daily-recap.ts:74-88` uses `doneForToday` only for Today section). | **NONE** for stated cause |
| Intentional standing-task semantics | `TaskDayCompletion` + `markDoneForToday` (`task.ts:250-288`); pool excludes done-today (`build-suggestion-pool.ts:48-64`); research resolved “archive vs todayDone” (`archive/.../research.md` §2). Shipped per impl-review PASS. | **STRONG** |
| Same-row implementation bug | Ternary is mutually exclusive per row (`task-list.tsx:333-379`). No context-menu second complete. Edit panel has no complete action (`task-fields-panel.tsx`). Stale ✓ possible if standing toggled off after mark (`task-list.tsx:353-359`). | **NONE** for dual buttons on one row; **WEAK** edge case for orphan checkmark |

## Narrowing Signals

- User confirmed leading symptom is **duplicate button types on the list**, not recap showing wrong data.
- Step 3 evidence is conclusive on cause: button was **not** created for recap; recap Last 24h already uses cycles + global complete.
- Independent trace confirms perception is **list-level** (mixed row types), not one row with two buttons.

## Cross-System Convention

- **US-03 / S-27**: Daily standing tasks roll at local midnight; completion for standing items is **per-day**, not archival (`prd.md` US-03; `archive/2026-06-19-daily-standing-tasks-capacity-plan/plan.md:50`).
- **S-30**: Daily recap Last 24h = timing footprint from WORK cycles plus globally completed tasks; Today section = suggestion pool (includes standing + `doneForToday` badge). No separate “recap button” in shipped design (`archive/2026-06-20-daily-work-timing-recap/plan.md`).
- **Cycle overlay** still offers global “mark task complete” for the focused task regardless of standing (`cycle-complete-overlay.tsx:101-108`) — a third completion path outside the row control.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: The task list presents **two completion models** (per-day standing done vs global archive) that users experience as redundant “close task” affordances — but naively removing “Done for today” would break standing-task day semantics unless those semantics are redesigned or re-homed.

The user’s recap theory does not match the archive or code: `markDoneForToday` exists to keep standing tasks **active** while excluding them from today’s suggestion pool (`TaskDayCompletion`), not to populate Daily recap. Daily recap **already** builds Last 24 hours from completed WORK cycles and globally marked-complete tasks (`build-daily-recap.ts:27-70`). Standing tasks marked “done today” without a cycle in the window **do not** appear in Last 24h — that is a separate gap from “remove the button,” not evidence the button was built for recap.

The valid part of the report is **UX confusion** at list level (especially with Daily standing default-on). The invalid part is treating the button as spurious recap scaffolding.

## Confidence

**MEDIUM**

- **HIGH** confidence that the stated cause (recap misread) is wrong and the button was intentional S-27 design.
- **MEDIUM** confidence on the right product fix: options include clearer affordance/naming for standing rows, product direction change on standing completion, feeding standing day-completions into Last 24h, or unifying controls — each has different blast radius. Needs a product choice before /10x-plan.

Before planning, confirm desired standing-task behavior: should “done for the day” remain distinct from “archived forever,” and should that action appear in Last 24h recap?

## What Changes for /10x-plan

Do **not** plan a one-line “delete Done for today button.” Plan around **reconciling standing daily completion with a single mental model** — e.g. rename/reframe the standing affordance, change default-off for Daily standing, include `TaskDayCompletion` in Last 24h rows, or retire standing-specific completion if product direction changed. Any plan must address suggestion pool + `TaskDayCompletion` + guest parity, not only UI removal.

## References

- Source files: `src/app/_components/task-list.tsx:333-379`, `src/hooks/use-task-mutations.ts:281-403`, `src/server/api/routers/task.ts:250-288`, `src/lib/recap/build-daily-recap.ts:27-88`, `src/lib/suggestion/build-suggestion-pool.ts:48-64`
- Archive: `context/archive/2026-06-19-daily-standing-tasks-capacity-plan/` (introduction), `context/archive/2026-06-20-daily-work-timing-recap/` (recap consumption)
- Investigation tasks: Explore agents (Done for today trace, recap data source, archive origin, independent UX perception)
