---
date: 2026-06-20T12:00:00+02:00
researcher: ship-slice-orchestrator
git_commit: 708ebbe850623d2fb4fda8d434b5df428163e76a
branch: main
repository: FlowState
topic: "S-30 daily work timing recap — data sources, UI mount, S-27 reuse"
tags: [research, codebase, recap, day-plan, cycles, task-list, footprint]
status: complete
last_updated: 2026-06-20
last_updated_by: ship-slice-orchestrator
---

# Research: S-30 Daily Work Timing Recap

**Date**: 2026-06-20  
**Researcher**: ship-slice-orchestrator  
**Git Commit**: `708ebbe`  
**Branch**: main  
**Repository**: FlowState

## Research Question

What exists in the codebase for implementing S-30 (daily work timing recap + focus footprint on home), and what must be built? How does S-27 daily standing / focus budget integrate?

## Summary

S-30 is a **greenfield UI + aggregation layer** on top of shipped S-27 primitives. Cycle timing data exists in Prisma (`Cycle.startedAt`/`endedAt`) and guest `flowstate:guest-v1` blobs, but **no rolling-24h or per-task aggregate API** exists. `DayPlan.usedFocusMinutes` is calendar-day user total — wrong source for recap rows. S-27's `buildSuggestionPool` is the canonical **Today plan** membership; task list Active filter alone is insufficient for standing tasks. Recommended mount: new collapsible panel in `PomodoroDashboardBody` between `FocusBudgetPrompt` and `TaskList`. Footprint v1 targets Focus button row in `SortableActiveTaskRow`, not every row.

## Detailed Findings

### Data layer — cycles and completion

- **Prisma** (`prisma/schema.prisma`): `Cycle` stores `kind`, `state`, `startedAt`, `endedAt`, `taskId`; focused minutes derived via elapsed formula in `cycle.complete` (`src/server/api/routers/cycle.ts:218-227`).
- **No per-task stored minutes** — must aggregate COMPLETED WORK cycles in a time window.
- **`cycle.list`** returns last 100 cycles, no time filter, no aggregation (`cycle.ts:12-23`).
- **Task completion paths**: global `task.status = completed` + `updatedAt`; standing `TaskDayCompletion.completedAt` via `markDoneForToday`.
- **Pause accounting**: `cycle.resume` rewrites `startedAt` — recap must reuse same elapsed formula as `cycle.complete`, not raw `configuredDurationSec`.
- **Repository gap**: `server-repositories.ts` `complete` may not forward `localDateKey` to tRPC — day-plan increment risk (verify in plan).

### Guest / data-mode

- Guest cycles in `flowstate:guest-v1` (`src/lib/guest/schema.ts`) with `startedAt`/`endedAt`.
- No guest day-plan equivalent; client-side aggregation from `loadSnapshot()` required for parity.
- `useDomainTasks` dual-mode pattern is the hook model for recap (`src/lib/data-mode/use-domain-tasks.ts`).

### S-27 reuse (Today + standing)

| Reuse | Location |
|-------|----------|
| Standing flag + done-today | `task.list({ localDateKey })`, `markDoneForToday` |
| Today plan pool | `buildSuggestionPool` (`src/lib/suggestion/build-suggestion-pool.ts:46-54`) |
| Focus budget context | `useDayPlan`, `FocusBudgetPrompt`, `DayPlan` router |
| Local date key | `formatLocalDateKey()` |
| E2E helpers | `e2e/helpers/daily-plan.ts` |

### UI mount and patterns

- **Primary mount**: `pomodoro-dashboard.tsx` between `FocusBudgetPrompt` (483-491) and `TaskList` (493-511).
- **Collapsible**: mirror `TaskSuggestionCard` `aria-expanded` + bordered `bg-surface-panel` panel.
- **Dismiss**: mirror `FocusBudgetPrompt` sessionStorage keyed by `localDateKey`.
- **Footprint v1**: `task-list.tsx` Focus button footer (654-666), focused/expanded row only.
- **S-17 boundary**: keep `session-inflow-summary` as session prose; recap is list/stats only (P-202).

### Gaps to build

1. New `recap` tRPC router (or `cycle.summarizeLast24h`) with per-task rollup.
2. Shared `computeCycleFocusedMinutes(cycle)` lib.
3. Guest client aggregator `src/lib/guest/recap.ts`.
4. `use-daily-recap.ts` dual-mode hook.
5. `DailyRecapPanel` component + footprint sub-phase on task rows.
6. Tests: server aggregate + guest snapshot + dismiss/collapse e2e.

## Decision proxy — roadmap unknowns resolved

| Unknown | Decision | Rationale | Confidence |
|---------|----------|-----------|------------|
| Rolling last-24h vs calendar day for done section | **Rolling last 24h** for "Last 24 hours"; **calendar today** for "Today" via `localDateKey` | Matches slice outcome wording; PRD US-03 "light footprint" | 88% |
| INTERRUPTED vs COMPLETED in totals | **COMPLETED WORK only** in v1; exclude INTERRUPTED | Slice risk: cycle-only timing; INTERRUPTED is partial/ambiguous | 85% |
| Guest parity | **Yes** — client aggregate from guest snapshot | data-mode parity is project convention | 90% |
| Footprint on all rows vs picker | **Focus button row + expanded/focused row only** in v1 | S-30 risk + roadmap detail | 92% |

## Code References

- `prisma/schema.prisma:119-142` — Cycle model
- `src/server/api/routers/cycle.ts:12-257` — cycle CRUD, elapsed minutes on complete
- `src/server/api/routers/day-plan.ts:12-90` — day budget (not recap)
- `src/lib/suggestion/build-suggestion-pool.ts:46-54` — Today plan pool
- `src/app/_components/pomodoro-dashboard.tsx:483-511` — recap mount slot
- `src/app/_components/task-list.tsx:654-666` — footprint hook point
- `src/app/_components/focus-budget-prompt.tsx:21-30` — dismiss pattern
- `src/lib/catch-up/format-ended-ago.ts` — relative time for footprint

## Architecture Insights

- Dual-mode (auth tRPC / guest local) is mandatory for all new data surfaces.
- Collapsible inline panels use native `aria-expanded`, not Radix — per DESIGN.md.
- Day-level `usedFocusMinutes` and per-task recap minutes are separate concerns; do not conflate.
- Today section should use `buildSuggestionPool`, not `task-list` Active filter.

## Historical Context

- `context/archive/2026-06-19-daily-standing-tasks-capacity-plan/` — S-27 shipped standing + budget; explicitly deferred S-30 recap UI.
- `context/foundation/roadmap-references/items/S-30.md` — expand merges P-104 trail, P-107 footprint, P-202 beat separation.

## Open Questions

- Whether to fix `server-repositories` `localDateKey` forwarding as part of S-30 or separate hygiene (verify in plan phase).
- P-104 "Today trail" — defer to phase 2 unless plan scope is tight.
