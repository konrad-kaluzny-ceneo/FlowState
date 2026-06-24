---
date: 2026-06-23T09:00:48+02:00
researcher: Auto
git_commit: 5af007eb304283f2ae1d5a5d6736d9a7c841d311
branch: main
repository: konrad-kaluzny-ceneo/FlowState
topic: "Done for today button — blast radius, data model, and unification options"
tags: [research, codebase, done-for-today, task-day-completion, daily-standing, daily-recap, suggestion-pool]
status: complete
last_updated: 2026-06-23
last_updated_by: Auto
---

# Research: Done for today button — blast radius, data model, and unification options

**Date**: 2026-06-23T09:00:48+02:00  
**Researcher**: Auto  
**Git Commit**: `5af007eb304283f2ae1d5a5d6736d9a7c841d311`  
**Branch**: main  
**Repository**: konrad-kaluzny-ceneo/FlowState

## Research Question

What is the full implementation surface of “Done for today” / `markDoneForToday` / `TaskDayCompletion`, what breaks if the button is removed naively, and what are viable paths to reduce dual-completion UX confusion while preserving (or consciously changing) standing-task semantics?

Informed by `change.md` notes, `frame.md` reframe (list-level UX duplication, not recap-driven button), and leading concern: duplicate completion affordances on the task list.

## Summary

1. **Two button types appear on the list, not on one row.** Standing tasks (`isDailyStanding`) show a text “Done today” button; non-standing tasks show an icon-only “Mark complete” checkbox (`task-list.tsx:333-379`). New tasks default `isDailyStanding: true` in the create form (`task-list.tsx:570`), so users frequently see both patterns on one screen.

2. **“Done for today” was intentional S-27 design**, not Daily recap scaffolding. It writes `TaskDayCompletion` per `localDateKey` while keeping `Task.status: "active"`. Primary consumers: suggestion pool exclusion, kickoff eligibility, row dimming — not Last 24h recap.

3. **Daily recap Last 24h already ignores day completions.** It uses COMPLETED WORK cycles (rolling 24h) plus globally `status: completed` tasks (`build-daily-recap.ts:27-70`). `markDoneForToday` only affects the **Today** section via `buildSuggestionPool` + `doneForToday` badge (`build-daily-recap.ts:74-88`). The recap “Done today” label on Today rows is effectively dead code today because the pool already excludes done-today tasks (`daily-recap-panel.tsx:51-52`).

4. **Removing only the UI button breaks HIGH-severity behavior** without a replacement write path: standing tasks can never be marked done-today → they stay in suggestion pool and kickoff candidates. Belt e2e `standing task marked done for today is excluded from kickoff suggestions` fails (`e2e/daily-standing-capacity.spec.ts:111-160`).

5. **A third completion path exists:** cycle-complete overlay “Done — mark task complete” always sets global `status: completed"` regardless of standing (`cycle-complete-overlay.tsx:101-108`, `cycle.ts:207-211`).

6. **Four implementation options** with different blast radius are documented below (unify checkbox UI, feed completions into Last 24h, default-off standing, naive removal). Product choice still required before `/10x-plan`.

## Detailed Findings

### UI layer — task list

- **Mutually exclusive row control** (`task-list.tsx:333-379`):
  - `isDailyStanding && !doneForToday` → text button, `data-testid="done-for-today-button"`, visible label “Done today”, `aria-label="Done for today"`
  - `!isDailyStanding && !doneForToday` → empty circle, `aria-label="Mark complete"`
  - `doneForToday` → static ✓ (standing or non-standing orphan path at `353-359`)
- **Handler** (`task-list.tsx:774-780`): `markDoneForToday({ id, localDateKey })` via `useTaskMutations`
- **Create default**: `isDailyStanding: true` (`task-list.tsx:570`) vs Prisma default `false` (`schema.prisma:77`)
- **Styling**: row `opacity-60`, dimmed title/badges when `doneForToday` (`task-list.tsx:311,426,471`)
- **Edit panel**: Daily standing toggle only — no complete action (`task-fields-panel.tsx:241-247`)

### Mutation & client cache

- `use-task-mutations.ts:281-301` — optimistic `doneForToday: true` on dated `task.list` cache
- `use-task-mutations.ts:385-403` — guest → `guest-repositories.markDoneForToday`; auth → `task.markDoneForToday`
- `handleSettled` invalidates `task.list` + `recap.getDaily` (`use-task-mutations.ts:165-188`)

### Server — `task.markDoneForToday`

- `task.ts:250-288` — requires `status: "active"` + `isDailyStanding`; upserts `TaskDayCompletion` on `(userId, taskId, localDateKey)`
- `task.ts:53-72` — `task.list({ localDateKey })` joins completions → `doneForToday` via `task-mapper.ts:30`

### Data model

- **`TaskDayCompletion`** (`schema.prisma:199-210`): unique `(userId, taskId, localDateKey)`; `completedAt` set on insert, existence matters for reads
- **Migration**: `prisma/migrations/20260619120000_daily_standing_day_plan/migration.sql`
- **Guest parity**: `flowstate:guest-day-completions-v1` localStorage (`day-completions.ts:1-90`); lazy rollover in `readStore()` when `localDateKey !== today` (`day-completions.ts:49-52`)
- **Midnight rollover (auth)**: lazy via `visibilitychange` in `use-day-plan.ts:17-38` and `use-daily-recap.ts:80-100` — invalidates queries for new `localDateKey`; old DB rows persist, not queried for new day
- **No cron/TTL** — historical completion rows accumulate

### Suggestion pool & kickoff

- `getDoneTodayTaskIds` reads `taskDayCompletion` (`build-suggestion-pool.ts:27-37`)
- Pool filter excludes `doneTodayIds` (`build-suggestion-pool.ts:56-58`)
- Used by `suggestion.ts` kickoff and post-check-in (`suggestion.ts:193-197`, `289-293`)
- `use-pomodoro-cycle.ts:123-133` — `taskPoolHasKickoffCandidates` skips `doneForToday` tasks
- `transition-conductor.ts:149` — kickoff wedge gated on `hasActiveTasks`

### Daily recap

- **Last 24h** (`build-daily-recap.ts:27-70`): COMPLETED WORK cycles + `status: completed` with `updatedAt` in window; label “Marked done · {title}” when no cycle (`daily-recap-panel.tsx:39-43`)
- **Today** (`build-daily-recap.ts:74-88`): `buildSuggestionPool` → rows with `doneForToday` flag (always `false` for rows actually in pool)
- Guest mirror: `guest/recap.ts`

### Cycle overlay (third path)

- `cycle-complete-overlay.tsx:101-108` — global complete for focused task
- `cycle.ts:207-211` — sets `status: "completed"`
- Standing row has no mid-cycle Mark complete (`task-list.tsx:366-368` only on non-standing branch)

## Code References

| Path | Lines | Role |
|------|-------|------|
| `src/app/_components/task-list.tsx` | 333-379, 570, 774-780 | Row completion UI + handler |
| `src/hooks/use-task-mutations.ts` | 281-403 | Client mutation + optimistic cache |
| `src/server/api/routers/task.ts` | 53-72, 250-288 | List derivation + markDoneForToday |
| `prisma/schema.prisma` | 77, 199-210 | isDailyStanding + TaskDayCompletion |
| `src/lib/suggestion/build-suggestion-pool.ts` | 27-64 | getDoneTodayTaskIds + pool exclusion |
| `src/lib/recap/build-daily-recap.ts` | 27-88 | Last 24h vs Today data sources |
| `src/lib/guest/day-completions.ts` | 1-90 | Guest day-completion store |
| `src/hooks/use-pomodoro-cycle.ts` | 123-133 | Kickoff candidate filter |
| `src/app/_components/cycle-complete-overlay.tsx` | 101-108 | Overlay global complete |
| `e2e/daily-standing-capacity.spec.ts` | 111-160, 163-189 | Belt + skip-belt standing UX |
| `e2e/helpers/daily-plan.ts` | 178-181 | `markStandingDoneForToday` helper |

GitHub permalinks (commit `5af007eb`):

- [task-list.tsx completion branch](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/5af007eb304283f2ae1d5a5d6736d9a7c841d311/src/app/_components/task-list.tsx#L333-L379)
- [task.markDoneForToday](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/5af007eb304283f2ae1d5a5d6736d9a7c841d311/src/server/api/routers/task.ts#L250-L288)
- [build-daily-recap Last 24h](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/5af007eb304283f2ae1d5a5d6736d9a7c841d311/src/lib/recap/build-daily-recap.ts#L27-L70)
- [build-suggestion-pool exclusion](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/5af007eb304283f2ae1d5a5d6736d9a7c841d311/src/lib/suggestion/build-suggestion-pool.ts#L56-L58)

## Architecture Insights

### Two completion models (by design)

| Model | Write path | Task status | Scope | Primary consumer |
|-------|-----------|-------------|-------|------------------|
| **Done for today** | `markDoneForToday` → `TaskDayCompletion` | Stays `active` | Per calendar `localDateKey` | Suggestion pool, kickoff |
| **Mark complete** | `task.update` / cycle `markTaskDone` | `completed` | Permanent | Completed section, Last 24h (no cycle) |

### Data flow (auth)

```
task-list "Done today" → useTaskMutations.markDoneForToday
  → task.markDoneForToday → TaskDayCompletion
    → task.list(localDateKey) → doneForToday flag
    → getDoneTodayTaskIds → buildSuggestionPool → suggestion + recap Today
    → taskPoolHasKickoffCandidates → kickoff wedge
```

### Blast radius if button removed without replacement

| Severity | Impact |
|----------|--------|
| **HIGH** | No write path for standing day completion; pool/kickoff regress; belt e2e fails |
| **MEDIUM** | Row styling, recap cache invalidation, guest subscription paths degrade |
| **LOW** | Dead recap “Done today” label; unused `isGuestTaskDoneForToday` export |

### Test surface

- **7 dedicated Vitest cases** across `task-list.test.tsx`, `task-mutation.test.ts`, `suggestion.test.ts`, `guest/recap.test.ts`
- **2 Playwright cases** in `daily-standing-capacity.spec.ts` (1 belt, 1 skip-belt)
- **6 files** with mock/fixture-only references to trim if feature changes
- **Gap**: no test for recap UI “Done today” copy; no unit test for `use-pomodoro-cycle` `doneForToday` filter

## Implementation Options (for /10x-plan)

| Option | Intent | ~Files | Fixes list duplication? | Fixes Last 24h gap? |
|--------|--------|--------|---------------------------|---------------------|
| **A** | Unify checkbox; branch to `markDoneForToday` vs global complete | 8–14 | Yes | No |
| **B** | Same as A but explicitly no backend change | 6–10 | Yes | No |
| **C** | Feed `TaskDayCompletion` into Last 24h rows | 6–9 | No | Yes |
| **D** | Default `isDailyStanding` off + rename affordance | 4–7 | Partial | No |

**None of A–D alone fixes:** cycle overlay global complete on standing tasks; create-form default-on vs DB default-off; global archive affordance for standing tasks from row/edit.

**Combinations** (e.g. B + C, or B + D + overlay alignment) are plausible but need explicit product decisions from `frame.md` open questions.

## Historical Context (from prior changes)

- **S-27** (`context/archive/2026-06-19-daily-standing-tasks-capacity-plan/`): Introduced `TaskDayCompletion`, `markDoneForToday`, “Done for today” on standing rows; deferred recap to S-30 (`plan.md:50`, `plan-brief.md` Desired End State). Impl review **APPROVED**.
- **S-30** (`context/archive/2026-06-20-daily-work-timing-recap/`): Last 24h from cycles + global complete; Today from suggestion pool (`research.md:37`, `plan.md` Today vs Last 24h). Did not require a recap button.
- **ui-polish-fixes** (`context/archive/2026-06-21-ui-polish-fixes/`): Removed strikethrough on done-for-today rows; checkmark styling (`plan.md` Phase 5).
- **Frame brief** (`context/changes/remove-done-for-today-button/frame.md`): Confirmed recap misread theory is unsupported; reframed to UX reconciliation problem.

## Related Research

- `context/archive/2026-06-19-daily-standing-tasks-capacity-plan/research.md` — original “separate done for today from completion” decision
- `context/archive/2026-06-20-daily-work-timing-recap/research.md` — two completion paths noted for recap
- `context/changes/remove-done-for-today-button/frame.md` — framing step output

## Open Questions

1. **Product**: Should standing “done for the day” remain distinct from global archive? If yes, what is the single affordance?
2. **Recap**: Should standing day-completions appear in Last 24h (Option C), or is cycle timing sufficient?
3. **Overlay**: Should cycle-complete “mark task complete” branch for standing tasks (per-day vs global)?
4. **Defaults**: Change create-form `isDailyStanding` default to `false` (Option D)?
5. **Standing archive**: How should users permanently retire a daily standing task — edit-only global complete, or new affordance?
