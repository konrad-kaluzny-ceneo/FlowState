# S-30 Daily Work Timing Recap — Plan Brief

> Full plan: `context/changes/daily-work-timing-recap/plan.md`
> Research: `context/changes/daily-work-timing-recap/research.md`

## What & Why

Add a calm, collapsible daily recap on home so users see **what they worked on** (last 24h timing per task) and **what's on today's plan** — list-only, standup-friendly, dismissible. Delivers PRD v3 US-03 light footprint without an analytics dashboard.

## Starting Point

Cycle timestamps live in Prisma and guest snapshots; S-27 shipped standing tasks, focus budget, and `buildSuggestionPool`. No recap API or UI exists yet.

## Desired End State

Home shows a dismissible recap panel (Last 24h + Today) between focus budget and task list. Focused task rows show last-focused time and cumulative minutes. Guest and auth parity via dual-mode hook.

## Key Decisions Made

| Decision | Choice | Why | Source |
|----------|--------|-----|--------|
| Last 24h window | Rolling 24 hours | Matches slice outcome wording | Research |
| Today membership | `buildSuggestionPool` | Canonical S-27 plan pool | Research |
| Cycle states in totals | COMPLETED WORK only | Avoid ambiguous INTERRUPTED partials | Research |
| Footprint placement | Focus row v1 only | Reduce visual noise | Research |
| Guest parity | Client aggregate from snapshot | data-mode convention | Research |
| P-104 trail | Deferred | Scope control | Plan |
| Schema changes | None | Read-only aggregation | Plan |

## Scope

**In scope:** `recap` tRPC router, guest aggregator, `DailyRecapPanel`, footprint on focused rows, vitest + belt e2e, test-plan §6 update.

**Out of scope:** Charts/dashboards, context-switch trail, type-mix line, footprint on all rows, new Prisma tables.

## Architecture / Approach

```
computeCycleFocusedMinutes (shared lib)
  ├── buildDailyRecap (server) → recap.getDaily tRPC
  └── buildGuestDailyRecap (client)
        └── useDailyRecap hook
              ├── DailyRecapPanel (home)
              └── TaskList footprints (focused row)
```

## Phases (5)

1. **Aggregation lib + recap router** — TDD (`10x-tdd`)
2. **Guest + hook** — TDD
3. **Recap panel UI** — implement
4. **Footprint on rows** — implement
5. **Belt e2e + cookbook** — e2e

## Prerequisites

Feature branch `features/daily-work-timing-recap`; `git switch main; git pull; git switch -c features/daily-work-timing-recap` before first code edit.
