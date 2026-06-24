# Unify task completion affordance — Plan Brief

> Full plan: `context/changes/remove-done-for-today-button/plan.md`
> Frame brief: `context/changes/remove-done-for-today-button/frame.md`
> Research: `context/changes/remove-done-for-today-button/research.md`

## What & Why

> **The actual problem to plan around is**: The task list presents **two completion models** (per-day standing done vs global archive) that users experience as redundant “close task” affordances — but naively removing “Done for today” would break standing-task day semantics unless those semantics are redesigned or re-homed.

This plan unifies the **visual** completion control (one checkbox per row) while preserving S-27 per-day standing semantics. It addresses the user’s UX confusion without breaking suggestion pool, kickoff, or guest parity.

## Starting Point

Standing tasks show a text “Done today” button; other tasks show a circle “Mark complete” checkbox (`task-list.tsx:335-381`). New tasks default Daily standing ON in the create form. `markDoneForToday` writes `TaskDayCompletion` and is required for pool exclusion — not for Daily recap Last 24h (frame investigation).

## Desired End State

Users see identical checkbox chrome on every active task row. Standing clicks mark done-for-today (task stays active, dims); regular clicks archive globally. New tasks default non-standing. Cycle-complete overlay on standing tasks primary-action marks done-for-today. Belt e2e for kickoff exclusion passes.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Primary fix | Unify checkbox UI; branch handler | Removes duplicate button types while keeping `TaskDayCompletion` write path | Plan (research Option B) |
| Recap Last 24h | No change | Recap already uses cycles + global complete; user’s recap theory unsupported | Frame / Research |
| Create default | Daily standing OFF | Fewer mixed-row lists; aligns with DB default | Plan (research Option D partial) |
| Backend | No mutation/schema changes | Smallest blast radius; pool/kickoff unchanged | Research |
| Cycle overlay | Standing → “Done for today” primary | Third global-complete path was confusing on standing tasks | Plan |
| Standing archive | No new row affordance | Toggle off standing or existing global paths suffice | Plan |

*Planning defaults applied — questioning round was skipped.*

## Scope

**In scope:**
- Unified checkbox on task rows (standing + non-standing)
- Create-form default `isDailyStanding: false`
- Cycle overlay branch for standing focused tasks
- Unit + belt e2e test updates (`task-complete-button` test id)

**Out of scope:**
- Deleting `markDoneForToday` / `TaskDayCompletion`
- Last 24h recap inclusion of day completions
- New permanent-archive UI for standing tasks
- Recap Today section changes

## Architecture / Approach

Single presentation layer in `task-list.tsx`: one circle button when not `doneForToday`. `onClick` forks on `isDailyStanding` → existing `markDoneForToday` mutation vs `status: "completed"` update. No server changes. Overlay wired through dashboard confirm handler with same fork. E2E helper retargeted to unified test id.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Unify row control | One checkbox; standing still calls `markDoneForToday` | Regress mid-cycle mark-complete on non-standing |
| 2. Default standing OFF | Fewer standing rows by default | Tests assuming default-on create form |
| 3. Overlay + e2e | Standing cycle end → done-for-today; belt green | Overlay prop wiring across dashboard/hook |

**Prerequisites:** On `features/remove-done-for-today-button` branch; no schema migration.
**Estimated effort:** ~1–2 sessions across 3 phases.

## Open Risks & Assumptions

- Frame confidence **MEDIUM** on product fix — plan assumes per-day standing semantics remain required (S-27).
- Users who relied on overlay to **globally** archive standing tasks lose that as the primary overlay action; archive still possible via toggle-off + complete or future affordance.
- `aria-label` differs per row type while visual is identical — intentional for screen readers.

## Success Criteria (Summary)

- No text “Done today” button on list rows; one checkbox pattern everywhere.
- Standing done-for-today still excludes task from kickoff suggestions (belt e2e).
- New tasks default non-standing unless user opts in.
