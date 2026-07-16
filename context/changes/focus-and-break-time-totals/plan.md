# Honest Focus and Break Time Totals Implementation Plan

## Overview

Today the daily "Twój dzień" totals only count WORK cycles the timer carried to
completion. Stopping a cycle early discards the time, and break time is never
measured at all. This plan makes the totals honest: elapsed time from
stopped-early (`INTERRUPTED`) WORK cycles is counted toward focus time, and total
break time is reported as its own figure next to focus time — in both guest and
authenticated modes — while paused time stays excluded and the timer, cadence, and
S-27 focus-hours budget are untouched.

Roadmap: **S-52** (`focus-and-break-time-totals`), PRD **US-07**.

## Current State Analysis

The daily totals are computed live, on read, from raw `Cycle` rows — there is no
stored aggregate. The counting rule lives in one pure function but is enforced
redundantly at four query/reader layers:

- `computeCycleFocusedMinutes` ([src/lib/recap/compute-cycle-focused-minutes.ts:9](../../../src/lib/recap/compute-cycle-focused-minutes.ts)) returns `0` unless a cycle is `WORK` + `COMPLETED` + has `endedAt`. It clamps elapsed to `configuredDurationSec` and applies a `Math.max(1, …)` 1-minute floor.
- The DB/query layers **pre-filter** `kind:"WORK", state:"COMPLETED"` before the reader ever runs:
  - `recap.getDayStats` query ([src/server/api/routers/recap.ts:29](../../../src/server/api/routers/recap.ts))
  - `buildDailyRecap` main query ([src/lib/recap/build-daily-recap.ts:27](../../../src/lib/recap/build-daily-recap.ts)) and `buildFootprints` ([:197](../../../src/lib/recap/build-daily-recap.ts))
  - guest mirror `buildGuestDailyRecap` filter ([src/lib/guest/recap.ts:24](../../../src/lib/guest/recap.ts)) and `buildGuestFootprints` ([:164](../../../src/lib/guest/recap.ts))
- `aggregateDayStats` ([src/lib/recap/aggregate-day-stats.ts:73](../../../src/lib/recap/aggregate-day-stats.ts)) additionally re-filters to `COMPLETED WORK` and produces the `DayStats` shape (`focusMinutes`, `sessionCount`, `avgSessionMinutes`, `hourBuckets`, `workTypeStats`, `taskCompletionStat`) — but has **no** break figure.
- The Podsumowanie UI ([src/app/_components/podsumowanie-view.tsx:449](../../../src/app/_components/podsumowanie-view.tsx)) renders a `kpiFocusTime` card from `stats.focusMinutes` and no break card.
- Guests get **no** `DayStats` at all — `useDayStats` ([src/hooks/use-day-stats.ts:12](../../../src/hooks/use-day-stats.ts)) returns `null` for guests, so guest Podsumowanie shows an empty state.

### Cycle / pause mechanics (verified)

- States: `RUNNING | PAUSED | COMPLETED | INTERRUPTED`. Kinds: `WORK | SHORT_BREAK | LONG_BREAK` ([prisma/schema.prisma:30](../../../prisma/schema.prisma)).
- **Pause exclusion is already handled for resumed cycles:** `resume` rewrites `startedAt` forward by the pause gap ([src/server/api/routers/cycle.ts:414](../../../src/server/api/routers/cycle.ts)), so `endedAt − startedAt` naturally omits paused time. Guest `resume` mirrors this ([src/lib/repositories/guest-repositories.ts:759](../../../src/lib/repositories/guest-repositories.ts)).
- **The one gap:** `interrupt` from a `PAUSED` state sets `endedAt = now` and nulls `remainingDurationSec` ([src/server/api/routers/cycle.ts:315](../../../src/server/api/routers/cycle.ts); guest [:697](../../../src/lib/repositories/guest-repositories.ts)) — so a paused-then-stopped cycle's `endedAt − startedAt` would include the trailing pause. `pausedAt` holds the true focus-stop moment.
- "Finished the task mid-cycle" (S-50) already produces a `COMPLETED WORK` cycle via `cycle.complete` ([src/server/api/routers/cycle.ts:237](../../../src/server/api/routers/cycle.ts)) — already counted; no new work needed there.
- `complete` requires `RUNNING`, so there is no complete-from-paused path. The only way a paused cycle gets an `endedAt` is `interrupt` (end-session interrupts the cycle client-side, then ends the session — `session.endSession` does not touch cycle state, [src/server/api/routers/session.ts:74](../../../src/server/api/routers/session.ts)). So fixing `interrupt` is the complete fix.

## Desired End State

On the summary page (and any surface reading `DayStats`/recap), for both guest and
authenticated users:

- **Focus time** includes elapsed minutes from WORK cycles that were stopped early, in addition to completed ones.
- **Break time** appears as its own figure beside focus time, covering completed and stopped-early breaks.
- **Paused time** is counted as neither — including the paused-then-stopped case.
- **Session count / avg session** still reflect only completed WORK cycles.
- Hourly and work-type charts include the stopped-early WORK minutes (consistent with the headline).
- A cycle that never ended (`RUNNING`/`PAUSED`, `endedAt == null`) contributes nothing; timer accuracy and cadence are unchanged; the S-27 focus budget is unchanged.

Verify: unit tests over the reader and aggregation cover COMPLETED, INTERRUPTED,
paused-then-stopped, break kinds, and sub-minute cases; guest and authenticated
aggregations return matching totals for the same fixture day; the Podsumowanie view
renders both KPI cards; `pnpm typecheck`, `pnpm check`, `pnpm test`, and the e2e
belt pass.

### Key Discoveries:

- The counting rule is enforced at **five** places (one reader + four query/filter sites) — widening only the reader is insufficient. See Current State Analysis.
- Pause exclusion is free via the `resume` `startedAt` rewrite **except** the paused-then-stopped `interrupt` path, which must set `endedAt = pausedAt` (server + guest).
- Guest has no `DayStats` path yet; parity requires a new `buildGuestDayStats` plus `useDayStats` wiring, mirroring the existing `buildGuestDailyRecap` pattern.
- Break cycles carry no `taskId`, so break time is a `DayStats`-only concept — it does not belong in the per-task `last24Hours` recap rows or footprints.

## What We're NOT Doing

- **Not** changing the S-27 daily focus-hours *budget* (`incrementUsedFocusMinutes`) — it keeps counting completed cycles only (planned-capacity semantic).
- **Not** adding a hard forward-only cutoff timestamp — the rolling ~24h window means past days are never re-shown; the ship-day straddle is accepted.
- **Not** counting stopped-early cycles toward `sessionCount` or `avgSessionMinutes`.
- **Not** adding break time to the per-task `last24Hours` recap rows, footprints, or the S-42 day-memory narrative.
- **Not** building guest chart parity (hourly/donut) — guest gets the focus + break **totals** only.
- **Not** altering timer ticking, cadence, cycle creation, or the pause/resume UX.
- **Not** a schema migration — all needed fields (`state`, `pausedAt`, `endedAt`, `configuredDurationSec`) already exist.

## Implementation Approach

Work outward from the shared pure reader to the write-path correctness fix, then the
query/aggregation widening, then guest parity, then UI. Each phase is independently
testable. The reader and aggregation are pure functions with heavy unit coverage;
the write-path fix gets isolation coverage; the UI change is a small additive KPI
card plus bilingual copy.

## Critical Implementation Details

- **Pause exclusion depends on write-path ordering.** The reader computes elapsed as `endedAt − startedAt`. This is correct for resumed cycles (startedAt rewritten) and for interrupt-from-`RUNNING`, but is only correct for interrupt-from-`PAUSED` **after** Phase 2 sets `endedAt = pausedAt`. Land Phase 2 alongside Phase 1's INTERRUPTED widening so no interim build counts trailing pause time.
- **Focus minutes and session count diverge intentionally.** In `aggregateDayStats`, sum focus minutes over `COMPLETED ∪ INTERRUPTED` WORK, but derive `sessionCount`/`avgSessionMinutes` from `COMPLETED` WORK only. `focusMinutes ≠ sessionCount × avgSessionMinutes` is expected.
- **Break rows have `taskId == null`.** Break aggregation must not assume a task; it only sums elapsed minutes into a single `breakMinutes` figure.

---

## Phase 1: Shared elapsed reader

### Overview

Widen the shared reader so stopped-early WORK cycles count toward focus time, and
add a companion reader for break time — both holding the clamp, 1-minute floor, and
pause exclusion (via `endedAt − startedAt`).

### Changes Required:

#### 1. Focus-minutes reader widening

**File**: `src/lib/recap/compute-cycle-focused-minutes.ts`

**Intent**: Count elapsed focus minutes for WORK cycles that are `COMPLETED` **or** `INTERRUPTED` (any ended WORK cycle), instead of `COMPLETED` only. Non-WORK and un-ended cycles still return 0. Preserve the `configuredDurationSec` clamp and the `Math.max(1, ceil(sec/60))` floor.

**Contract**: `computeCycleFocusedMinutes(cycle: CycleMinutesInput): number` — signature unchanged. Guard changes from `state !== "COMPLETED"` to accepting `COMPLETED | INTERRUPTED`. Extract the shared clamp+floor elapsed math into a private helper reused by the break reader below.

#### 2. Break-minutes reader

**File**: `src/lib/recap/compute-cycle-focused-minutes.ts` (or a sibling `compute-cycle-break-minutes.ts` — implementer's call based on import ergonomics)

**Intent**: Add a reader that returns elapsed minutes for `SHORT_BREAK`/`LONG_BREAK` cycles that are `COMPLETED` or `INTERRUPTED`, and 0 otherwise — sharing the same clamp+floor helper.

**Contract**: `computeCycleBreakMinutes(cycle: CycleMinutesInput): number`. Same input type. Returns 0 for WORK and for un-ended cycles.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `pnpm exec vitest run src/lib/recap/compute-cycle-focused-minutes.test.ts`
- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm check`

#### Manual Verification:

- N/A (pure functions; covered by unit tests).

**Implementation Note**: Pause here for confirmation after automated verification passes before proceeding.

---

## Phase 2: Pause-exclusion correctness at the write path

### Overview

Ensure a paused-then-stopped cycle records its true focus-stop moment, so the reader
never counts trailing pause time.

### Changes Required:

#### 1. Server interrupt handler

**File**: `src/server/api/routers/cycle.ts`

**Intent**: When interrupting a cycle whose current state is `PAUSED`, record `endedAt = pausedAt` (the moment focus actually stopped) rather than `now`. Interrupt from `RUNNING` is unchanged (`endedAt = now`).

**Contract**: In the `interrupt` mutation's `updateMany` data, derive `endedAt` from the loaded cycle: `cycle.state === "PAUSED" && cycle.pausedAt != null ? cycle.pausedAt : new Date()`. Continue nulling `pausedAt`/`remainingDurationSec`. The pre-loaded `cycle` row is already fetched above the update.

#### 2. Guest interrupt method

**File**: `src/lib/repositories/guest-repositories.ts`

**Intent**: Apply the identical rule in the guest `interrupt` method so guest totals match the server.

**Contract**: In the guest `interrupt` (around [:697](../../../src/lib/repositories/guest-repositories.ts)), set the interrupted cycle's `endedAt` to its `pausedAt` when it was `PAUSED`, else `now`.

### Success Criteria:

#### Automated Verification:

- Cycle router tests pass: `pnpm exec vitest run src/server/api/routers/cycle.test.ts`
- Cycle isolation tests pass: `pnpm exec vitest run src/server/api/routers/cycle-isolation.test.ts` (if present; otherwise add a case)
- Guest repository tests pass: `pnpm exec vitest run src/lib/repositories/guest-repositories.test.ts`
- Type checking passes: `pnpm typecheck`

#### Manual Verification:

- Start a WORK cycle, let ~1 min elapse, pause, wait, then end the session; confirm the summary counts ≈1 min focus (not the paused span).

**Implementation Note**: Pause here for confirmation after automated verification passes before proceeding.

---

## Phase 3: Widen queries + aggregation (auth + guest recap)

### Overview

Broaden the pre-filters so stopped-early WORK cycles reach the readers, add the
`breakMinutes` figure to `DayStats`, and keep session count completed-only. Charts
follow the widened focus counting.

### Changes Required:

#### 1. `aggregateDayStats` widening + break figure

**File**: `src/lib/recap/aggregate-day-stats.ts`

**Intent**: Include `INTERRUPTED` WORK cycles in the focus loop (focus minutes, hour buckets, work-type stats, focused-task set), add a `breakMinutes` total summed via `computeCycleBreakMinutes` over break cycles, and keep `sessionCount`/`avgSessionMinutes` derived from `COMPLETED` WORK only.

**Contract**: Add `breakMinutes: number` to the `DayStats` type. Change the internal work-cycle filter from `state === "COMPLETED"` to `state ∈ {COMPLETED, INTERRUPTED}` for the focus/chart accumulation; compute `sessionCount` from the `COMPLETED`-only subset. Accept break cycles in the input (the caller stops pre-filtering them out — see below) and sum their elapsed minutes into `breakMinutes`. `CycleRow` already carries `kind`/`state`.

#### 2. `recap.getDayStats` query

**File**: `src/server/api/routers/recap.ts`

**Intent**: Fetch the cycles `aggregateDayStats` now needs — ended WORK cycles (`COMPLETED`/`INTERRUPTED`) and ended break cycles — instead of only `COMPLETED WORK`.

**Contract**: Replace the `where: { kind:"WORK", state:"COMPLETED" }` clause with one that selects `state ∈ {COMPLETED, INTERRUPTED}` across WORK and break kinds within the rolling-24h `OR(startedAt|endedAt)` window. Keep `select` fields; ensure `kind` is selected (it is).

#### 3. `buildDailyRecap` main + footprint queries

**File**: `src/lib/recap/build-daily-recap.ts`

**Intent**: Include `INTERRUPTED` WORK cycles so a stopped-early cycle's elapsed time shows in the per-task `last24Hours` rows and footprints. (Breaks are excluded here — they have no task.)

**Contract**: Widen the two `db.cycle.findMany` `where` clauses from `state:"COMPLETED"` to `state: { in: ["COMPLETED","INTERRUPTED"] }`, keeping `kind:"WORK"`. The row builders already call `computeCycleFocusedMinutes` and skip `minutes <= 0`, so no builder logic changes.

#### 4. Guest recap filters

**File**: `src/lib/guest/recap.ts`

**Intent**: Mirror the auth widening in `buildGuestDailyRecap` and `buildGuestFootprints` so guest per-task recap matches.

**Contract**: Change the guest cycle filters from `cycle.state === "COMPLETED"` to include `INTERRUPTED` (WORK only) in both `buildGuestDailyRecap` ([:24](../../../src/lib/guest/recap.ts)) and `buildGuestFootprints` ([:164](../../../src/lib/guest/recap.ts)).

### Success Criteria:

#### Automated Verification:

- Aggregation tests pass: `pnpm exec vitest run src/lib/recap/aggregate-day-stats.test.ts`
- Recap builder tests pass: `pnpm exec vitest run src/lib/recap/build-daily-recap.test.ts`
- Guest recap tests pass: `pnpm exec vitest run src/lib/guest/recap.test.ts`
- Type checking passes: `pnpm typecheck`
- Full unit suite passes: `pnpm test`

#### Manual Verification:

- Authenticated: run a full cycle, then a stopped-early cycle, then a break; open `/summary` and confirm focus time includes the partial cycle and a break figure appears.

**Implementation Note**: Pause here for confirmation after automated verification passes before proceeding.

---

## Phase 4: Guest DayStats parity

### Overview

Give guests the same focus + break totals by aggregating their snapshot cycles into
`DayStats`, and wire the hook to use it.

### Changes Required:

#### 1. Guest DayStats builder

**File**: `src/lib/guest/recap.ts` (or sibling `src/lib/guest/day-stats.ts`)

**Intent**: Aggregate the guest snapshot's cycles for the rolling-24h window into the `DayStats` shape, reusing `aggregateDayStats` where possible by adapting `GuestCycle` rows to `CycleRow` (mapping the guest string `taskId` and per-task `workType`/`status` from the snapshot).

**Contract**: `buildGuestDayStats(snapshot: GuestSnapshotV1, now?: Date): DayStats`. Filter cycles to the window and to ended WORK/break states, adapt to `CycleRow` (guest `taskId` is a string — map to a stable numeric surrogate or relax `CycleRow.taskId` typing; implementer picks the lower-churn option), compute `activeCount` from snapshot tasks (`status ∈ {active, planned}`), and delegate to `aggregateDayStats`. Totals must match the authenticated path for an equivalent day.

#### 2. Hook wiring

**File**: `src/hooks/use-day-stats.ts`

**Intent**: For guest mode, compute `DayStats` locally from the guest snapshot instead of returning `null`.

**Contract**: When `mode === "guest"`, read the guest snapshot (via the guest repositories / data-mode context, following the `useDailyRecap` guest pattern) and return `buildGuestDayStats(...)`; authenticated path unchanged. `isGuest` flag semantics may change — verify `PodsumowanieView`'s `isGuest` branch still renders correctly (it should now show KPIs, not the empty state).

### Success Criteria:

#### Automated Verification:

- Guest day-stats tests pass: `pnpm exec vitest run src/lib/guest/recap.test.ts` (or the new sibling test)
- Parity test passes: an equivalent fixture day yields identical `focusMinutes`/`breakMinutes` from `aggregateDayStats` (auth) and `buildGuestDayStats` (guest)
- Type checking passes: `pnpm typecheck`

#### Manual Verification:

- As a guest (not signed in): run a completed cycle, a stopped-early cycle, and a break; open `/summary` and confirm the focus + break totals appear and match what an equivalent authenticated day would show.

**Implementation Note**: Pause here for confirmation after automated verification passes before proceeding.

---

## Phase 5: UI + bilingual copy

### Overview

Surface break time as its own KPI card beside focus time, with EN/PL strings.

### Changes Required:

#### 1. Break KPI card

**File**: `src/app/_components/podsumowanie-view.tsx`

**Intent**: Add a "Czas przerw" KPI card next to the existing focus-time card, reading `stats.breakMinutes`. Keep the existing focus card as the headline; both render for guest and authenticated once `stats` is non-null.

**Contract**: Add a `KpiCard` using a new `kpiBreakTime` label and the existing `kpiMinutes` value formatter. Ensure the guest branch of `PodsumowanieView` no longer short-circuits to the empty state when `stats` is present (coordinate with Phase 4's hook change).

#### 2. Bilingual strings

**File**: `src/i18n/` message catalogs (EN + PL)

**Intent**: Add the `Podsumowanie.kpiBreakTime` label in both locales, matching the product-voice tone (F-14).

**Contract**: New key `kpiBreakTime` (e.g. PL "Czas przerw", EN "Break time") added to both catalogs; no other keys renamed.

### Success Criteria:

#### Automated Verification:

- Podsumowanie view tests pass: `pnpm exec vitest run src/app/_components/podsumowanie-view.test.tsx`
- i18n completeness check passes (no missing-key errors): `pnpm typecheck` / `pnpm test`
- Linting passes: `pnpm check`
- E2E belt passes: `pnpm test:e2e:belt`

#### Manual Verification:

- `/summary` shows focus and break KPI cards side by side in both PL and EN locales, with correct values, in guest and authenticated modes.
- No layout regression in the KPI grid at mobile and desktop widths.

**Implementation Note**: Pause here for final confirmation after automated verification passes.

---

## Testing Strategy

### Unit Tests:

- **Reader** (`compute-cycle-focused-minutes.test.ts`): COMPLETED WORK (unchanged), INTERRUPTED WORK counts elapsed, un-ended returns 0, non-WORK returns 0, clamp to configured, 1-min floor for sub-minute, and break reader mirrors for break kinds only.
- **Write-path** (cycle router + guest repo): interrupt-from-PAUSED sets `endedAt = pausedAt`; interrupt-from-RUNNING keeps `endedAt = now`.
- **Aggregation** (`aggregate-day-stats.test.ts`): focus includes INTERRUPTED; `breakMinutes` summed; `sessionCount`/avg stay COMPLETED-only; hour buckets + work-type include partials; paused-then-stopped counted correctly (via Phase 2 data).
- **Guest parity**: `buildGuestDayStats` equals `aggregateDayStats` totals for an equivalent fixture day.

### Integration Tests:

- `recap.getDayStats` (createCaller) returns focus incl. partials + `breakMinutes` for a seeded day with a completed cycle, an interrupted cycle, and a break.

### Manual Testing Steps:

1. Completed cycle → focus counts full duration (regression check).
2. Cycle stopped at ~1 min → focus counts ≈1 min.
3. Pause mid-cycle, wait, then stop → focus counts only pre-pause elapsed.
4. Run a break, stop it early → break figure counts actual break time.
5. Repeat 1–4 as a guest → totals match the authenticated equivalents.

## Performance Considerations

Widening the `state` filters and adding break rows marginally increases the row
count per query within the same rolling-24h window — negligible. All aggregation
stays O(cycles) and purely functional.

## Migration Notes

No schema migration. Forward-only by construction: totals are computed on read from
raw cycles within a rolling ~24h window, so past days are never re-shown; the
ship-day straddle (a few pre-ship stopped cycles counting once) is accepted per the
resolved decision.

## References

- Roadmap item: `context/foundation/roadmap-references/items/S-52.md`
- Change identity: `context/changes/focus-and-break-time-totals/change.md`
- Prior seam work (S-30): `context/archive/2026-06-20-daily-work-timing-recap/plan.md`
- Reader: `src/lib/recap/compute-cycle-focused-minutes.ts:9`
- Aggregation: `src/lib/recap/aggregate-day-stats.ts:73`
- Cycle interrupt/pause/resume: `src/server/api/routers/cycle.ts:304`
- Lessons — pause/fake-clock pitfalls: `context/foundation/lessons.md` (L "Playwright's fake clock…")

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Shared elapsed reader

#### Automated

- [x] 1.1 Unit tests pass: compute-cycle-focused-minutes.test.ts — 8d8b321
- [x] 1.2 Type checking passes — 8d8b321
- [x] 1.3 Linting passes — 8d8b321

### Phase 2: Pause-exclusion correctness at the write path

#### Automated

- [x] 2.1 Cycle router tests pass — 55816dd
- [x] 2.2 Cycle isolation tests pass — 55816dd
- [x] 2.3 Guest repository tests pass — 55816dd
- [x] 2.4 Type checking passes — 55816dd

#### Manual

- [ ] 2.5 Paused-then-stopped cycle counts only pre-pause elapsed

### Phase 3: Widen queries + aggregation (auth + guest recap)

#### Automated

- [x] 3.1 Aggregation tests pass — 7b7764e
- [x] 3.2 Recap builder tests pass — 7b7764e
- [x] 3.3 Guest recap tests pass — 7b7764e
- [x] 3.4 Type checking passes — 7b7764e
- [x] 3.5 Full unit suite passes — 7b7764e

#### Manual

- [ ] 3.6 Authenticated /summary shows partial focus + break figure

### Phase 4: Guest DayStats parity

#### Automated

- [x] 4.1 Guest day-stats tests pass
- [x] 4.2 Auth/guest parity test passes
- [x] 4.3 Type checking passes

#### Manual

- [ ] 4.4 Guest /summary totals match authenticated equivalent

### Phase 5: UI + bilingual copy

#### Automated

- [x] 5.1 Podsumowanie view tests pass
- [x] 5.2 i18n completeness / test suite passes
- [x] 5.3 Linting passes
- [x] 5.4 E2E belt passes

#### Manual

- [ ] 5.5 Focus + break KPI cards render in PL and EN, guest and auth
- [ ] 5.6 No KPI-grid layout regression at mobile and desktop
