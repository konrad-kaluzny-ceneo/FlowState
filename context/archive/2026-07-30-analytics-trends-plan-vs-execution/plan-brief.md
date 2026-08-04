# Analytics: Weekly/Monthly Trends, Plan vs Execution — Plan Brief

> Full plan: `context/changes/analytics-trends-plan-vs-execution/plan.md`
> Research: `context/foundation/roadmap-references/items/S-48.md`

## What & Why

Extend Podsumowanie (day summary) with weekly/monthly trend charts, a plan-vs-execution comparison, and context-switch pattern analytics — the last piece of Stream V (Analytics depth), building on `S-52`'s honest daily totals. Today Podsumowanie only ever shows "the last 24 hours"; this closes that gap so users can see patterns across days, not just a single snapshot.

## Starting Point

Podsumowanie already renders per-day KPIs and charts via a pure aggregation function (`aggregateDayStats`), but the query behind it hardcodes a rolling-24h-from-now window — it cannot look at any other day. Two `ComingSoonPreview` placeholders ("best time of day", "date navigation") were scaffolded in `S-45` but never wired up. `DayPlan` already persists a planned focus budget per day, but its "used" counter is capped at the budget, so it can't represent true overrun. Guest mode has no budget concept at all — the Day Plan feature is authenticated-only.

## Desired End State

A user (guest or signed-in) can browse any past day in Podsumowanie via real prev/next controls, see a 7-day or 30-day trend of daily focus time, and see how many times per day they switched between tasks. A signed-in user additionally sees a paired planned-vs-actual bar chart showing whether they hit their focus budget each day — with true actual time shown even on days they went over.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Date-range architecture | Client-supplied UTC day boundaries, no schema change | Matches the existing convention (client computes `localDateKey`, server never derives timezone) and avoids a migration + unsafe historical backfill | Plan |
| Date-nav placeholder | Absorbed as Phase 1 | It's the natural foundation every other view needs anyway — no point building trend queries before single-day queries work | Plan |
| Guest plan-vs-execution | Hidden, sign-in nudge shown instead | Day Plan is already authenticated-only elsewhere; inventing a parallel guest budget concept is out of proportion to the ask | Plan |
| Time window | Rolling (7d/30d), not calendar-aligned | Simplest query, no week-start-day decision, pairs with the day-nav control instead of a second navigation scheme | Plan |
| Context-switch definition | Every consecutive WORK-cycle task change | Directly derivable from existing `Cycle` rows, zero schema change, matches the research conclusion | Plan |
| Chart tech | Hand-rolled SVG, no new library | Consistent with the existing `HourlyBarChart`/`DonutChart`, zero bundle cost | Plan |
| Plan-vs-execution viz | Paired bars per day | Most direct comparison, reuses the existing bar-chart pattern | Plan |
| Phase order | Trends → plan-vs-execution → context-switch | Trends are the lowest-risk extension of working code; context-switch is net-new with no UI precedent, safest last | Plan |
| Testing depth | Unit + integration + component only, no new e2e | Matches lesson L-06 — demote to Vitest layer, don't grow the e2e belt for chart rendering | Plan |

## Scope

**In scope:**
- Range-aware stats query (server + guest), replacing the hardcoded 24h window
- Day-by-day navigation UI (wires the existing placeholder)
- Rolling 7d/30d trend chart of daily focus minutes
- Authenticated-only plan-vs-execution paired-bar comparison
- Context-switch count trend, both data modes
- i18n strings in both locales for all new UI

**Out of scope:**
- External analytics service, team-level reporting (explicit PRD non-goals)
- Persisted rollup/snapshot table
- Calendar-aligned week/month picker with its own navigation
- Guest-mode focus-budget feature
- DST-perfect day-boundary correction
- The still-deferred "best time of day" placeholder
- New charting library
- New Playwright e2e specs

## Architecture / Approach

One generalized range-aware stats primitive, built once in Phase 1: the client computes UTC day-boundary instants (mirroring the existing pattern where the client already computes `localDateKey` and passes it to mutations), and the server/guest builders bucket `Cycle` rows against those boundaries. Every later phase reuses this primitive — Phase 2 with a multi-day window, Phase 3 by joining `DayPlan` range data onto Phase 2's actuals, Phase 4 by adding a second per-day metric computed from the same bucketed cycles.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Range-aware foundation + day nav | Real prev/next-day browsing in Podsumowanie | Query-shape change touches both guest and authenticated paths |
| 2. Weekly/monthly trend chart | 7d/30d rolling trend of focus minutes | Multi-series SVG chart is more complex than the existing single-series one |
| 3. Plan vs execution | Paired planned/actual bars, authenticated-only | Must source "actual" from `Cycle` rows, not the capped `DayPlan.usedFocusMinutes` |
| 4. Context-switch analytics | Per-day switch-count trend, both modes | Net-new metric with no existing precedent to validate against |

**Prerequisites:** `S-45` (Podsumowanie view) and `S-52` (honest daily totals) — both already shipped.
**Estimated effort:** ~4 sessions, one per phase.

## Open Risks & Assumptions

- DST transitions within a rolling window produce a one-hour boundary approximation on the transition day (accepted, documented in the plan).
- No performance testing is planned beyond the assumption (validated in research) that per-user `Cycle` volume over 30 days is small enough for on-the-fly aggregation.

## Success Criteria (Summary)

- A user can look at any past day's stats, not just today's.
- A user can see whether their last week/month of focus time is trending up or down, and (if signed in) whether they're hitting their planned budget.
- A user can see how often they're switching between tasks per day, as a proxy for reactive vs focused days.
