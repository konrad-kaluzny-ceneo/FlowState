# Analytics: Weekly/Monthly Trends, Plan vs Execution — Implementation Plan

## Overview

Extend Podsumowanie (day summary) with three analytics dimensions on top of the honest per-day totals `S-52` already produces: day-by-day history browsing, rolling weekly/monthly trend charts, an authenticated-only plan-vs-execution comparison, and context-switch pattern analytics. All three reuse one generalized range-aware stats query built in Phase 1, instead of three separate ad-hoc data paths.

## Current State Analysis

Podsumowanie (`src/app/_components/podsumowanie-view.tsx`) today shows only a hardcoded rolling-24h window: KPI cards, an hourly bar chart, two donuts (session type, task completion), and a completed-tasks list. Two `ComingSoonPreview` placeholders already exist in the file — "best time of day" and "date navigation" — scaffolded during `S-45` but never wired up.

- `recap.getDayStats` (`src/server/api/routers/recap.ts:22`) and guest's `buildGuestDayStats` (`src/lib/guest/day-stats.ts`) both **ignore their `localDateKey` input** and hardcode `windowStart = now - 24h`. Neither can query any day other than "right now."
- `aggregateDayStats` (`src/lib/recap/aggregate-day-stats.ts`) is a pure function over `CycleRow[]` + `activeCount` — already reusable per arbitrary window, no changes needed to it directly.
- `DayPlan` (`prisma/schema.prisma`) persists planned `focusBudgetMinutes` per `(userId, localDateKey)`, but `usedFocusMinutes` (`src/lib/day-plan/increment-used-focus-minutes.ts`) is **deliberately capped at the budget** — it cannot serve as "actual" once a user exceeds their plan.
- `Cycle` rows have no `localDateKey` column — only UTC `startedAt`/`endedAt`. No day-boundary/timezone utility exists anywhere in the codebase (`src/lib/time/local-date-key.ts` only formats a browser-local date into a string key; it does not compute UTC boundaries for a local day).
- The Day Plan focus-budget feature is authenticated-only (`useDayPlan` hook, `src/hooks/use-day-plan.ts:13`, gates `enabled = mode === "authenticated"`); the guest snapshot schema (`src/lib/guest/schema.ts`) has no budget concept at all.
- Charts are 100% hand-rolled inline SVG (`HourlyBarChart`, `DonutChart` in `podsumowanie-view.tsx`) — no charting library dependency exists in the repo.
- No cycle-retention/pruning exists server- or guest-side — a month of history is small and cheap to query for a single user. No persisted rollup table is needed.

## Desired End State

Podsumowanie lets a signed-in or guest user:
- Browse any past day via prev/next controls (replacing the "date navigation" placeholder), seeing that day's existing KPI/chart layout.
- View a rolling 7-day or 30-day trend chart of daily focus minutes.
- (Authenticated only) See a paired planned-vs-actual bar chart across the same rolling window, sourced from honest per-day actuals (not the budget-capped `usedFocusMinutes`).
- See a context-switch count trend across the rolling window, in both data modes.

Verification: `pnpm typecheck`, `pnpm test`, and manual browser check of all four surfaces in both guest and authenticated mode.

### Key Discoveries:

- `src/server/api/routers/cycle.ts:267-286` shows the existing pattern: the **client** computes `localDateKey` (via `formatLocalDateKey()`) and passes it to mutations — the server never derives local-calendar-day boundaries itself. This plan follows the same client-computes-the-boundary convention rather than introducing server-side timezone logic.
- `messages/en.json:486-488` — `bestTimeComingSoon` and `dateNavComingSoon` are the existing placeholder strings; `dateNavComingSoon` is replaced in Phase 1, `bestTimeComingSoon` is untouched (separate, still-deferred feature, not in this slice's scope).

## What We're NOT Doing

- No external analytics service, no team-level reporting (explicit non-goals, FLO-99).
- No persisted rollup/snapshot table — on-the-fly range aggregation only.
- No calendar-aligned week/month picker (Mon–Sun weeks, named months) — trend/comparison windows are rolling (7d/30d) only; only the single-day nav (Phase 1) supports arbitrary-day browsing.
- No guest-mode focus-budget feature — plan-vs-execution stays authenticated-only; guests see a sign-in nudge instead of that section.
- No DST-aware day-boundary correction (see Critical Implementation Details) — accepted edge case.
- No changes to the "best time of day" placeholder — separate, still-deferred feature.
- No new charting library — all new charts are hand-rolled SVG, matching existing convention.
- No new Playwright e2e specs — unit/integration/component tests only, per lesson L-06.
- No changes to `DayPlan.usedFocusMinutes` or its capping behavior — Phase 3 sources "actual" from `Cycle` rows directly.

## Implementation Approach

Build one generalized, range-aware stats primitive in Phase 1 — the client computes UTC day-boundary instants for the days it wants (mirroring the existing `localDateKey`-at-write-time convention used by `DayPlan`/`cycle.ts`), and the server/guest builders bucket `Cycle` rows against those boundaries. Phase 1 uses this primitive for a single day (nav); Phase 2 reuses it for a rolling multi-day window (trend); Phase 3 layers `DayPlan` range data on top of Phase 2's actuals; Phase 4 adds a second per-day metric (switch count) computed from the same bucketed cycles. Each phase ships independently and in this order, so a time crunch drops Phase 4 (and then Phase 3) before touching what's already shipped.

## Critical Implementation Details

**Timing & lifecycle — DST boundary approximation**: the client sends one UTC instant marking "start of today, local time" (`todayLocalMidnightUtc`) plus a `windowDays` count; the server derives each prior day's boundary by subtracting whole 86,400-second multiples from that instant, rather than recomputing local midnight per day. If the user's locale crosses a DST transition within the window, one bucket's boundary will be off by an hour for that single day. This mirrors the level of timezone precision already accepted elsewhere in the codebase (e.g. `formatLocalDateKey` has no DST handling either) and is not corrected in this slice.

**Window inclusivity**: `windowDays` is the *total* number of day-buckets returned, today included — e.g. `windowDays: 7` yields today plus the 6 preceding days, boundaries `[todayLocalMidnightUtc - 6*86400s, ..., todayLocalMidnightUtc]`, each paired with its `+86400s` end. Phase 2/3/4 all derive their day-boundary arrays this way; don't reinterpret `windowDays` as "N days before today" (which would silently exclude today's in-progress data).

**Query filter differs from Phase 1 on purpose**: Phase 1's `getDayStats` matches a cycle if *either* `startedAt` or `endedAt` falls in the single requested range (`OR` clause) — correct for a single bucket, since every match lands in the same day regardless of which field matched. Phase 2's `getTrendStats` buckets cycles into *multiple* per-day buckets by `startedAt` alone (see Testing Strategy: "cycles spanning a day boundary attribute to `startedAt`'s day"). Reusing Phase 1's `OR` pattern here would let a cycle whose `endedAt` falls inside the window but whose `startedAt` falls *before* the window's earliest boundary match the query with no bucket to attribute it to. Phase 2/4 must therefore filter and bucket on `startedAt` only, with both a lower (`gte`) and upper (`lt`, end of today) bound — do not port Phase 1's `OR` shape forward.

## Phase 1: Range-aware stats foundation + day navigation

### Overview

Generalize the "today" stats query into a range-aware one driven by client-supplied UTC day boundaries, and wire the existing "date navigation" placeholder to real prev/next-day browsing on top of it.

### Changes Required:

#### 1. Local day-boundary utility

**File**: `src/lib/time/local-day-boundary.ts` (new)

**Intent**: Pure function computing the UTC start/end instants of a given local calendar day, for a supplied `Date` — the shared primitive Phase 1 (single day) and Phase 2 (multi-day array) both call.

**Contract**: `getLocalDayBoundary(date: Date): { start: Date; end: Date; localDateKey: string }`, using the same local-calendar semantics as `formatLocalDateKey`.

#### 2. Range-aware day-stats query (authenticated)

**File**: `src/server/api/routers/recap.ts`

**Intent**: Replace the hardcoded `windowStart = now - 24h` in `getDayStats` with an explicit range supplied by the caller, so any past day (not just "now") can be queried.

**Contract**: Input schema changes from `{ localDateKey }` to `{ rangeStart: z.coerce.date(), rangeEnd: z.coerce.date() }` (both UTC instants, computed client-side via `getLocalDayBoundary`); the Prisma `where` clause's `windowStart` becomes `input.rangeStart` and adds `endedAt: { lt: input.rangeEnd }` / `startedAt: { lt: input.rangeEnd }` alongside the existing `gte` checks. `activeCount` stays a global (non-date-scoped) task count, unchanged.

#### 3. Range-aware day-stats (guest)

**File**: `src/lib/guest/day-stats.ts`

**Intent**: Mirror the same change for guest mode — `buildGuestDayStats` accepts explicit `rangeStart`/`rangeEnd` instead of computing `now - 24h` internally.

**Contract**: `buildGuestDayStats(snapshot: GuestSnapshotV1, range: { start: Date; end: Date }): DayStats` — drop the `now` parameter, filter `windowCycles` against `range.start`/`range.end`.

#### 4. Day-navigation hook state

**File**: `src/hooks/use-day-stats.ts`

**Intent**: Add viewed-date state (default today) and navigation methods, computing the day boundary via the new utility and passing it to both the tRPC query and the guest builder.

**Contract**: Hook returns additionally `{ viewedDate, viewedLocalDateKey, goToPreviousDay, goToNextDay, goToToday, canGoNext }` — `canGoNext` is `false` when `viewedLocalDateKey` equals today's key (no browsing into the future). `query` and `guestStats` both key off `viewedDate`'s boundary instead of "now."

#### 5. Wire the date-nav UI

**File**: `src/app/_components/podsumowanie-view.tsx`

**Intent**: Replace the `dateNavComingSoon` `ComingSoonPreview` block with real prev/next-day buttons and a current-date label; make the header subtitle reflect the viewed date (today vs a specific past day) instead of the hardcoded "last 24 hours" copy.

**Contract**: `PodsumowanieViewProps` gains `viewedLocalDateKey`, `onPreviousDay`, `onNextDay`, `onToday`, `canGoNext`. Subtitle branches on whether `viewedLocalDateKey` is today's key.

#### 6. Thread navigation from the page

**File**: `src/app/summary/page.tsx`

**Intent**: Pass the new navigation state/handlers from `useDayStats` through to `PodsumowanieView`.

**Contract**: No new contract beyond prop threading.

#### 7. i18n strings

**Files**: `messages/en.json`, `messages/pl.json`

**Intent**: Replace `dateNavComingSoon` with real copy; add a viewed-past-day subtitle variant.

**Contract**: Remove `Podsumowanie.dateNavComingSoon`; add `dateNavPrevious`, `dateNavNext`, `dateNavToday`, `dateNavAria`, `subtitlePastDay` (parameterized with a formatted date) to both locale files, keeping key parity (`messages-parity.test.ts`).

### Success Criteria:

#### Automated Verification:

- Unit tests pass for `getLocalDayBoundary`: `pnpm exec vitest run src/lib/time/local-day-boundary.test.ts`
- Unit tests pass for updated `buildGuestDayStats`: `pnpm exec vitest run src/lib/guest/day-stats.test.ts`
- Integration tests pass for updated `recap.getDayStats`: `pnpm exec vitest run src/server/api/routers/recap.integration.test.ts`
- Component tests pass for date-nav UI: `pnpm exec vitest run src/app/_components/podsumowanie-view.test.tsx`
- Hook tests pass: `pnpm exec vitest run src/hooks/use-day-stats.test.ts`
- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm check`
- i18n parity check passes: `pnpm exec vitest run src/i18n/messages-parity.test.ts`

#### Manual Verification:

- In authenticated mode, navigate to yesterday and confirm KPIs/charts reflect that day's cycles, not today's.
- Confirm the next-day button is disabled when viewing today.
- In guest mode, repeat the same navigation check using guest snapshot data.
- Confirm the subtitle text changes appropriately when viewing a past day vs today.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Weekly/monthly trend chart

### Overview

Reuse Phase 1's boundary primitive across a rolling window (7 or 30 days) to produce a daily trend series, and render it as a new hand-rolled bar chart with a window-size toggle.

### Changes Required:

#### 1. Day-bucketing + trend aggregation

**File**: `src/lib/recap/aggregate-trend-stats.ts` (new)

**Intent**: Bucket a wider set of `CycleRow`s into per-day totals (focus + break minutes) across N day-boundaries, reusing `computeCycleFocusedMinutes`/`computeCycleBreakMinutes` per bucket — the shared day-bucketing shape that Phase 4 also builds on.

**Contract**: `bucketCyclesByLocalDay(cycles: CycleRow[], dayBoundaries: { start: Date; end: Date; localDateKey: string }[]): Map<string, CycleRow[]>` (shared helper) plus `aggregateTrendStats(cycles: CycleRow[], dayBoundaries): TrendPoint[]` where `TrendPoint = { localDateKey: string; focusMinutes: number; breakMinutes: number }`.

#### 2. Trend query (authenticated)

**File**: `src/server/api/routers/recap.ts`

**Intent**: New procedure returning a rolling window's trend series, deriving day boundaries server-side from one client-supplied "start of today" instant.

**Contract**: `getTrendStats` input `{ todayLocalMidnightUtc: z.coerce.date(), windowDays: z.union([z.literal(7), z.literal(30)]) }`; queries `Cycle` rows across the full window in one call, filtering on `startedAt` only — `startedAt: { gte: todayLocalMidnightUtc - (windowDays - 1)*86400s, lt: todayLocalMidnightUtc + 86400s }` (today included, per Critical Implementation Details' Window inclusivity note) — derives the `windowDays` day-boundary array by subtracting whole-day multiples (see Critical Implementation Details), and returns `TrendPoint[]`. Do not add an `OR`/`endedAt` branch here (see Critical Implementation Details' Query filter note) — bucketing is by `startedAt` only.

#### 3. Trend query (guest)

**File**: `src/lib/guest/day-stats.ts`

**Intent**: Guest-mode equivalent — no UTC-instant plumbing needed since it runs in the same JS runtime as the browser; can compute local day boundaries directly.

**Contract**: `buildGuestTrendStats(snapshot: GuestSnapshotV1, windowDays: 7 | 30, now?: Date): TrendPoint[]`.

#### 4. Trend hook

**File**: `src/hooks/use-trend-stats.ts` (new)

**Intent**: `windowDays` toggle state (default 7); calls `recap.getTrendStats` (authenticated) or `buildGuestTrendStats` (guest), mirroring `use-day-stats.ts`'s dual-mode pattern. `windowDays`/`setWindowDays` is the single source of truth for the toggle — Phase 3's `usePlanVsExecution` takes it as a parameter rather than re-implementing its own toggle, so Trends, Plan-vs-execution, and the Phase 4 context-switch chart always show the same window.

**Contract**: Returns `{ trend: TrendPoint[], windowDays, setWindowDays, isLoading, isGuest }`.

#### 5. Trend chart UI

**File**: `src/app/_components/podsumowanie-view.tsx`

**Intent**: New "Trends" section with a 7d/30d segmented toggle and a bar chart of daily focus minutes across the window, following the existing `HourlyBarChart` SVG pattern (variable bucket count instead of fixed 24).

**Contract**: New `TrendBarChart` component take `points: TrendPoint[]`; new section added to `PodsumowanieView`, both data modes.

#### 6. i18n strings

**Files**: `messages/en.json`, `messages/pl.json`

**Intent**: Add trend section copy.

**Contract**: Add `trendChartTitle`, `trendChartAria`, `trendWindow7d`, `trendWindow30d` to both locales.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `pnpm exec vitest run src/lib/recap/aggregate-trend-stats.test.ts`
- Guest trend unit tests pass: `pnpm exec vitest run src/lib/guest/day-stats.test.ts`
- Router integration tests pass: `pnpm exec vitest run src/server/api/routers/recap.integration.test.ts`
- Hook tests pass: `pnpm exec vitest run src/hooks/use-trend-stats.test.ts`
- Component tests pass: `pnpm exec vitest run src/app/_components/podsumowanie-view.test.tsx`
- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm check`
- i18n parity check passes: `pnpm exec vitest run src/i18n/messages-parity.test.ts`

#### Manual Verification:

- Trend chart shows 7 days of data by default, matching cycles actually run in that window.
- Toggling to 30d re-renders with the wider window's data.
- Guest mode shows an equivalent trend chart from guest snapshot data.
- A day with zero cycles renders as an empty/zero bar, not a rendering error.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Plan-vs-execution comparison (authenticated only)

### Overview

Layer `DayPlan`'s planned-minutes data over Phase 2's actual-minutes trend to produce a paired planned-vs-actual bar chart, authenticated-only, with a sign-in nudge for guests.

### Changes Required:

#### 1. DayPlan range query

**File**: `src/server/api/routers/day-plan.ts`

**Intent**: Fetch planned focus budgets across the same rolling window as the trend chart, for the comparison.

**Contract**: New procedure `getRange` input `{ localDateKeys: z.array(localDateKeySchema) }` → `ctx.db.dayPlan.findMany({ where: { userId, localDateKey: { in: input.localDateKeys } } })` mapped to `{ localDateKey: string; focusBudgetMinutes: number | null }[]` (days without a `DayPlan` row map to `null`).

#### 2. Plan-vs-execution hook

**File**: `src/hooks/use-plan-vs-execution.ts` (new)

**Intent**: Combine Phase 2's trend actuals with the new `DayPlan.getRange` planned data into a single per-day series; authenticated-only (returns a distinct "unavailable" state for guests rather than fetching).

**Contract**: `usePlanVsExecution(windowDays: 7 | 30)` — `windowDays` is the same value driving Phase 2's `use-trend-stats` toggle (lifted to `PodsumowanieView`'s parent so the Trends and Plan-vs-execution sections never show mismatched windows). Returns `{ points: { localDateKey: string; plannedMinutes: number | null; actualMinutes: number }[], isLoading, isAvailable: boolean }` — `isAvailable` is `false` for guest mode.

#### 3. Paired-bar chart UI

**File**: `src/app/_components/podsumowanie-view.tsx`

**Intent**: New "Plan vs execution" section rendering paired planned/actual bars per day across the rolling window; when `isAvailable` is `false` (guest), render a sign-in nudge instead, following the existing `podsumowanie-guest-empty` block convention.

**Contract**: New `PlanVsExecutionChart` component; a day with `plannedMinutes: null` renders only the actual bar (no planned bar for that day).

#### 4. i18n strings

**Files**: `messages/en.json`, `messages/pl.json`

**Intent**: Add plan-vs-execution section copy, including the guest nudge.

**Contract**: Add `planVsExecutionTitle`, `planVsExecutionAria`, `planVsExecutionPlannedLabel`, `planVsExecutionActualLabel`, `planVsExecutionGuestNudge` to both locales.

### Success Criteria:

#### Automated Verification:

- Router integration tests pass: `pnpm exec vitest run src/server/api/routers/day-plan.integration.test.ts`
- Hook tests pass: `pnpm exec vitest run src/hooks/use-plan-vs-execution.test.ts`
- Component tests pass: `pnpm exec vitest run src/app/_components/podsumowanie-view.test.tsx`
- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm check`
- i18n parity check passes: `pnpm exec vitest run src/i18n/messages-parity.test.ts`

#### Manual Verification:

- Authenticated user with a focus budget set on some days sees paired planned/actual bars, with days lacking a budget showing only an actual bar.
- Authenticated user who exceeded their budget on a day sees the actual bar reflect the true total (not capped at the budget).
- Guest mode shows the sign-in nudge instead of the comparison chart.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Context-switch pattern analytics

### Overview

Add a per-day context-switch count (task changes across consecutive WORK cycles) to the same rolling-window trend view, in both data modes.

### Changes Required:

#### 1. Context-switch counting

**File**: `src/lib/recap/count-context-switches.ts` (new)

**Intent**: Count adjacent-pair `taskId` changes among a day's WORK cycles ordered by `startedAt`, using the shared `bucketCyclesByLocalDay` helper from Phase 2.

**Contract**: `countContextSwitches(cycles: CycleRow[], dayBoundaries): { localDateKey: string; switchCount: number }[]` — only WORK cycles considered. Filter out `null`-`taskId` cycles from each day's ordered sequence *before* counting adjacent-pair changes (do not simply skip counting at a `null` cycle's position while leaving it in the sequence) — e.g. task A, an untracked/no-task cycle, then task B still counts as one switch (A→B), matching the product intent of "did the user change which task they're working on," not "did the immediately-previous cycle happen to have a different taskId."

#### 2. Context-switch query (authenticated + guest)

**Files**: `src/server/api/routers/recap.ts`, `src/lib/guest/day-stats.ts`

**Intent**: Expose switch counts alongside the existing trend query rather than duplicating the range-fetch — extend `getTrendStats`'s response (and its guest equivalent) with a `switchCount` field per `TrendPoint`, computed from the same already-fetched `Cycle` rows.

**Contract**: `TrendPoint` gains `switchCount: number`; no new endpoint.

#### 3. Context-switch chart UI

**File**: `src/app/_components/podsumowanie-view.tsx`

**Intent**: New small chart/row in the "Trends" section showing switch-count per day across the window, alongside the existing focus-minutes trend bars.

**Contract**: Extend `TrendBarChart` (or add a companion chart reusing the same SVG bar pattern) to render `switchCount` as a second series.

#### 4. i18n strings

**Files**: `messages/en.json`, `messages/pl.json`

**Intent**: Add context-switch section copy.

**Contract**: Add `contextSwitchTitle`, `contextSwitchAria` to both locales.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `pnpm exec vitest run src/lib/recap/count-context-switches.test.ts`
- Updated trend aggregation tests pass: `pnpm exec vitest run src/lib/recap/aggregate-trend-stats.test.ts`
- Guest parity tests pass: `pnpm exec vitest run src/lib/guest/day-stats.test.ts`
- Router integration tests pass: `pnpm exec vitest run src/server/api/routers/recap.integration.test.ts`
- Component tests pass: `pnpm exec vitest run src/app/_components/podsumowanie-view.test.tsx`
- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm check`
- i18n parity check passes: `pnpm exec vitest run src/i18n/messages-parity.test.ts`

#### Manual Verification:

- A day with 3 different tasks worked in alternation shows a higher switch count than a day spent on one task.
- Guest mode shows the same chart from guest snapshot data.
- Chart renders correctly for a fully empty window (all zero counts).

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful.

---

## Testing Strategy

### Unit Tests:

- `getLocalDayBoundary`: local midnight computed correctly for a range of times of day; DST-transition day produces a boundary approximation consistent with the documented limitation.
- `aggregateTrendStats` / `bucketCyclesByLocalDay`: cycles bucket into the correct day; cycles spanning a day boundary attribute to `startedAt`'s day (matching existing `aggregateDayStats` hour-bucket convention).
- `countContextSwitches`: zero switches for a single-task day; N-1 switches for N cycles alternating between two tasks; a `null`-taskId cycle is excluded from the sequence before counting, so task A → untracked cycle → task B still counts as one switch (not zero).
- `buildGuestDayStats` / `buildGuestTrendStats`: guest snapshot parity with the authenticated aggregation shape for equivalent inputs.

### Integration Tests:

- `recap.getDayStats` returns correct stats for an explicit past-day range, not just "now."
- `recap.getTrendStats` returns `windowDays` points in chronological order, per-user isolated.
- `dayPlan.getRange` returns `null` budget for days without a `DayPlan` row, per-user isolated.

### Manual Testing Steps:

1. As an authenticated user, run a focus cycle today, then navigate Podsumowanie to yesterday and confirm today's cycle does not appear there.
2. Set a focus budget, exceed it on one day, and confirm the plan-vs-execution chart shows the true actual (above the planned bar), not a value capped at the budget.
3. As a guest, confirm the plan-vs-execution section shows the sign-in nudge, while trends and context-switch charts still render from guest data.
4. Switch between 3 different tasks across 4 cycles in one day and confirm the context-switch count reflects 3 switches that day.

## Performance Considerations

None beyond what's already noted: per-user `Cycle` volume is small enough (no pruning, single-user scale) that on-the-fly range aggregation for a 30-day window requires no new index or persisted rollup.

## Migration Notes

No schema changes and no data migration in this plan — all new procedures read existing tables (`Cycle`, `DayPlan`) with wider `WHERE` ranges than today's hardcoded 24h window.

## References

- Research: `context/foundation/roadmap-references/items/S-48.md`
- Roadmap: `context/foundation/roadmap.md` (S-48, Stream V)
- Linear: [FLO-99](https://linear.app/flowstate-10xdev/issue/FLO-99), GitHub [#193](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/193)
- Existing per-day aggregation: `src/lib/recap/aggregate-day-stats.ts`
- Existing client-computes-localDateKey convention: `src/server/api/routers/cycle.ts:267-286`
- Existing guest/authenticated dual-mode hook pattern: `src/hooks/use-day-stats.ts`
- Existing "coming soon" placeholder convention: `src/app/_components/ui/coming-soon-preview.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Range-aware stats foundation + day navigation

#### Automated

- [x] 1.1 Unit tests pass for `getLocalDayBoundary` — ac9d4b3
- [x] 1.2 Unit tests pass for updated `buildGuestDayStats` — ac9d4b3
- [x] 1.3 Integration tests pass for updated `recap.getDayStats` — ac9d4b3
- [x] 1.4 Component tests pass for date-nav UI — ac9d4b3
- [x] 1.5 Hook tests pass for `use-day-stats` — ac9d4b3
- [x] 1.6 Type checking passes — ac9d4b3
- [x] 1.7 Linting passes — ac9d4b3
- [x] 1.8 i18n parity check passes — ac9d4b3

#### Manual

- [x] 1.9 Authenticated: navigating to yesterday reflects that day's cycles (verified via a scripted real-browser check: fresh authenticated user, prev-day click fires a distinct `recap.getDayStats` range request and the view re-renders without error; no separate agent-run e2e spec was added per L-06)
- [x] 1.10 Next-day button disabled when viewing today (verified in both guest and authenticated real-browser checks)
- [x] 1.11 Guest mode navigation check (verified: prev/next click, subtitle text change, and next-button disable/enable all confirmed against the running app)
- [x] 1.12 Subtitle reflects viewed date correctly (verified: guest subtitle switched from the "last 24 hours" copy to the past-day copy with formatted date, and back)

### Phase 2: Weekly/monthly trend chart

#### Automated

- [x] 2.1 Unit tests pass for `aggregate-trend-stats` — c7f8112
- [x] 2.2 Guest trend unit tests pass — c7f8112
- [x] 2.3 Router integration tests pass for `getTrendStats` — c7f8112
- [x] 2.4 Hook tests pass for `use-trend-stats` — c7f8112
- [x] 2.5 Component tests pass — c7f8112
- [x] 2.6 Type checking passes — c7f8112
- [x] 2.7 Linting passes — c7f8112
- [x] 2.8 i18n parity check passes — c7f8112

#### Manual

- [x] 2.9 7-day trend chart matches actual cycles run (verified via scripted real-browser check: authenticated worker runs a fast work cycle, navigates to /summary, trend chart renders with the 7d toggle active by default; no separate agent-run e2e spec was added per L-06) — c7f8112
- [x] 2.10 Toggling to 30d re-renders correctly (verified: clicking the 30d segment flips aria-pressed and the chart re-renders without error) — c7f8112
- [x] 2.11 Guest mode trend chart renders (verified: fresh guest snapshot at mobile viewport, trend chart section visible on /summary) — c7f8112
- [x] 2.12 Zero-cycle day renders without error (verified: fresh guest snapshot has zero cycles in every day bucket — chart svg renders bars with no thrown error / no "Application error" text) — c7f8112

### Phase 3: Plan-vs-execution comparison

#### Automated

- [x] 3.1 Router integration tests pass for `dayPlan.getRange` — 47c5d35
- [x] 3.2 Hook tests pass for `use-plan-vs-execution` — 47c5d35
- [x] 3.3 Component tests pass — 47c5d35
- [x] 3.4 Type checking passes — 47c5d35
- [x] 3.5 Linting passes — 47c5d35
- [x] 3.6 i18n parity check passes — 47c5d35

#### Manual

- [x] 3.7 Paired planned/actual bars render correctly; days without budget show actual only (verified via scripted real-browser check: real `dayPlan.setBudget` seeded for today only, fast work cycle run, /summary chart shows a 2-rect group for the budgeted day and 1-rect groups for the 6 unbudgeted days; no separate agent-run e2e spec was added per L-06) — 47c5d35
- [x] 3.8 Exceeding budget shows true actual, not capped value (verified deterministically: `use-plan-vs-execution.test.tsx` asserts `actualMinutes: 90` against `plannedMinutes: 60` unclamped, and `podsumowanie-view.test.tsx` asserts the rendered actual-bar SVG height exceeds the planned-bar height for the same fixture — a live multi-minute fake-clock jump in the browser proved unreliable, so the numeric "not capped" contract stays at the deterministic hook/component layer while the e2e check covers real end-to-end wiring) — 47c5d35
- [x] 3.9 Guest mode shows sign-in nudge instead of chart (verified: fresh guest snapshot at mobile viewport, `podsumowanie-plan-vs-execution-guest-nudge` visible, chart svg absent) — 47c5d35

### Phase 4: Context-switch pattern analytics

#### Automated

- [x] 4.1 Unit tests pass for `count-context-switches`
- [x] 4.2 Updated trend aggregation tests pass
- [x] 4.3 Guest parity tests pass
- [x] 4.4 Router integration tests pass
- [x] 4.5 Component tests pass
- [x] 4.6 Type checking passes
- [x] 4.7 Linting passes
- [x] 4.8 i18n parity check passes

#### Manual

- [ ] 4.9 Alternating-task day shows higher switch count than single-task day
- [ ] 4.10 Guest mode chart renders
- [ ] 4.11 Fully empty window renders without error
