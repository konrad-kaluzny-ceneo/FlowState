# Honest Focus and Break Time Totals — Plan Brief

> Full plan: `context/changes/focus-and-break-time-totals/plan.md`

## What & Why

Make the daily "Twój dzień" totals honest. Today they count only WORK cycles the
timer carried to completion — stopping a cycle early throws the time away, and break
time is never measured at all. This slice counts elapsed time from stopped-early
cycles toward focus, and reports total break time as its own figure, so the numbers
reflect the time actually spent. (Roadmap S-52, PRD US-07.)

## Starting Point

Totals are computed live from raw `Cycle` rows (no stored aggregate), and the rule
"only `COMPLETED WORK`" is enforced in five places: the shared reader
`computeCycleFocusedMinutes`, the `recap.getDayStats` query, the `buildDailyRecap`
main + footprint queries, and the guest `recap.ts` filters. Guests get no `DayStats`
at all — the Podsumowanie page shows them an empty state.

## Desired End State

On the summary page, both guest and authenticated users see focus time that
includes stopped-early cycles and a separate break-time figure beside it. Paused
time is excluded (including the paused-then-stopped case), session count/avg stay
completed-only, and the charts match the widened focus counting. Timer, cadence, and
the S-27 focus budget are unchanged.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Break display | Two separate totals (focus + break) | Matches the acceptance wording; honest and unambiguous | Plan |
| Guest parity | Guest totals only (focus + break) | Satisfies "both modes same totals"; charts stay auth-only | Plan |
| Charts | Follow the same widened counting | Charts and headline stay internally consistent | Plan |
| Session KPIs | Completed-only | "A session" stays a finished cycle; avg not dragged down by 30s stops | Plan |
| Forward-only | Accept ship-day straddle (no cutoff) | Rolling 24h window means past days are never re-shown | Frame/roadmap + Plan |
| Sub-minute | Keep the 1-minute floor | Single code path, consistent with completed cycles | Plan |
| Paused-then-stopped | Interrupt-from-PAUSED sets `endedAt = pausedAt` | Reader stays a pure elapsed calc; no trailing-pause over-count | Plan |
| S-27 focus budget | Unchanged (out of scope) | Budget is planned-capacity, a different semantic | Plan |

## Scope

**In scope:** count INTERRUPTED WORK toward focus; add `breakMinutes`; fix
paused-then-stopped `endedAt`; guest `DayStats` parity for totals; break KPI card +
EN/PL copy; charts follow widened counting.

**Out of scope:** schema migration; S-27 focus-hours budget; hard forward-only
cutoff; break time in per-task recap rows/footprints/day-memory; guest chart parity;
any timer/cadence/pause-UX change.

## Architecture / Approach

Work outward from the shared pure reader → write-path correctness fix → query &
aggregation widening → guest parity → UI. Core is a pure-function change
(`computeCycleFocusedMinutes` widened + a break-minutes companion), fed by broadened
`state` filters at each query site, aggregated into a `DayStats` that now carries
`breakMinutes`. The one write-path change makes `interrupt` record `pausedAt` as the
end when stopping from a paused state.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Shared reader | Widened focus reader + break reader (pure, tested) | Regressing the existing completed-cycle counting |
| 2. Pause-fix | interrupt-from-PAUSED ends at `pausedAt` (server + guest) | Timer-adjacent server file; must mirror on guest |
| 3. Queries + aggregation | Broaden filters; add `breakMinutes`; charts follow; sessions stay completed-only | Missing one of the 4 filter sites → silent mismatch |
| 4. Guest parity | `buildGuestDayStats` + hook wiring | Guest string `taskId` → `CycleRow` typing |
| 5. UI + copy | Break KPI card, EN/PL strings | KPI-grid layout at mobile/desktop |

**Prerequisites:** S-24, S-30, S-42, S-45, S-50 — all done. No migration. Linear/GitHub
issue pair still to be created before merge.
**Estimated effort:** ~2–3 sessions across 5 small phases.

## Open Risks & Assumptions

- `computeCycleFocusedMinutes` is read by every daily-total surface; widening it changes them all at once — the pure-function unit tests are the guard.
- The five filter sites must all be widened consistently, or guest/auth or recap/Podsumowanie totals silently diverge.
- Guest `taskId` is a string; adapting `GuestCycle` to `CycleRow` needs a low-churn typing choice.
- Ship-day straddle: on the day of release the rolling window may include a few pre-ship stopped cycles that now count once — accepted.

## Success Criteria (Summary)

- Focus time includes stopped-early cycles; break time shows as its own figure — in both guest and authenticated modes.
- Paused time (including paused-then-stopped) is never counted; session count/avg and the timer are unchanged.
- Guest and authenticated totals match for an equivalent day.
