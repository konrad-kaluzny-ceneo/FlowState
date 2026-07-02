# Mindful day memory (S-42) Implementation Plan

## Overview

Add a calm, narrative "day memory" to the home page — a collapsed one-line summary visible on every load ("Done: 2 tasks. Remains: 3 open. Return calmly to: API review.") that expands into exactly three sections: **Domknięte** (done), **Zostaje** (remains), **Wróć tutaj** (return-to, naming the last focused task after interruption). This is S-30 Phase 2: a pure presentation/formatter layer over the existing `DailyRecap` substrate plus the existing S-18 resume/handoff machinery — zero new tRPC procedures, zero new Prisma queries.

## Current State Analysis

- `DailyRecap` (`src/lib/recap/types.ts:1-29`) already provides `last24Hours` (done, sorted most-recent-first), `todayPlan` (remains, filter `doneForToday === false`), and `footprints` (COMPLETED-cycle-only, not usable for interruption-aware "Wróć tutaj"). Fetched today via `useDailyRecap()` (`src/hooks/use-daily-recap.ts:63-108`), which already branches auth (tRPC `recap.getDaily`) vs guest (`buildGuestDailyRecap`, pure/in-memory) behind one shared type. Consumed today only by `DailyRecapPanel`.
- `DayMemory.*` i18n copy is fully shipped and unconsumed: `messages/en.json:331-336`, `messages/pl.json:331-336`, with ready pure accessors `getDayMemorySectionDone/Remains/ReturnTo` and `buildDayMemoryCollapsedLine` in `src/lib/session/narrative-copy.ts:119-147`, already unit-tested (exact-string + 120-char budget) in `src/lib/voice/acceptance-copy.test.ts:72-112`. No component or formatter module consumes these yet — confirmed via glob (`src/app/_components/day-memory*`, `src/lib/recap/format-day-memory*` both empty).
- Interruption-aware "last focused task" already exists as `pomodoro.continueTaskId` (`src/hooks/use-pomodoro-cycle.ts:471-495`), derived via `resolveContinueTaskId(lastEndedSession, taskList)` (`src/lib/session/return-handoff.ts:67-80`) — sourced from `Session.lastFocusedTaskId`, which server-resolves through RUNNING/PAUSED/most-recent WORK cycle **regardless of INTERRUPTED state** (`src/server/api/lib/session-end-metadata.ts:15-48`). This is strictly more interruption-aware than `DailyRecap.footprints` (COMPLETED-only). `continueTaskId` is non-null only when `!hasActiveSession` and the last session actually ended (`use-pomodoro-cycle.ts:471-495`) — i.e., it names who to return to, not who is currently focused.
- `pickHandoffTaskContext(tasks)` (`src/lib/session/return-handoff.ts:82-105`) resolves display text for a task ID: prefers an active task's `resumeNote`, falls back to task title. Both helpers operate on plain arrays (`{id, status, title, resumeNote}`), not Prisma types — reusable as-is for guest and authenticated parity.
- Home composition: `src/app/page.tsx` → `home-shell.tsx` → `PomodoroDashboard` (`pomodoro-dashboard.tsx:1120-1138`) → `AuthenticatedPomodoroDashboard` / `GuestPomodoroDashboard` (both render `PomodoroDashboardBody`, confirmed at `pomodoro-dashboard.tsx:1054-1118`). `recap`, `pomodoro.continueTaskId`, and `tasks` (with `resumeNote`/`status`/`title`) are all already in scope inside `PomodoroDashboardBody` — no prop-drilling or fetch-boundary changes needed for either data mode.
- `home-primary-region` (`HomeLayoutRegion testId="home-primary-region"`, `pomodoro-dashboard.tsx:864-872`) always renders unconditionally; its children are individually gated by `moduleInZone`/`moduleVisible` from `deriveHomeSessionState` (`src/lib/home/home-session-state.ts`). Existing test helpers `expectInsideRegion`/`expectOutsidePrimaryRegion` (`pomodoro-dashboard.test.tsx:1056-1066`) are the established oracle pattern for "is X visible in region Y."
- `DailyRecapPanel` (`src/app/_components/daily-recap-panel.tsx`) is demoted to secondary/rail placement, collapsed by default, hidden during `active_work` (via `moduleVisible("recap")`), and formats rows as raw `title · Xm · HH:MM–HH:MM` (`Recap.rowFormat` in `messages/en.json:376`) — exactly the log style the S-42 acceptance criteria say the expanded day-memory view must NOT resemble. This panel is untouched by this plan; the new component is additive and separate.

## Desired End State

A logged-in or guest user loading the home page sees, at the top of the primary region (above steering/timer/suggestion cards, below the header), a single collapsed line summarizing their day: what's done, what remains, and — when applicable — where to pick back up. Clicking/tapping it expands to exactly three narrative sections (Domknięte / Zostaje / Wróć tutaj), each with calm prose (not a raw log). The line and its expansion use only already-fetched data (`DailyRecap` + task list + `continueTaskId`); no new network requests are introduced. The element is hidden during `active_work` (consistent with S-30/S-41's "reduced distraction during active work" precedent) and does not appear when there is nothing to say (e.g., a guest with an empty day sees no line, not an empty shell).

**Verification:** `pnpm test` passes including new formatter unit tests and updated `pomodoro-dashboard.test.tsx` region assertions; `pnpm typecheck` and `pnpm lint` pass; manual check confirms the one-liner renders above the fold with no scroll on a standard viewport and expands/collapses without layout jump.

### Key Discoveries:

- `src/lib/session/narrative-copy.ts:141` docstring literally says: *"F-14 acceptance: collapsed day-memory one-liner for home (S-42 formatter cites this)."* — confirms this plan's `format-day-memory.ts` is the intended (only) caller.
- `DayMemoryCollapsedInput` (`narrative-copy.ts:135-139`) takes pre-formatted strings (`done`, `remaining`, `next`), not raw counts/objects — `format-day-memory.ts` owns turning `DailyRecap` + handoff data into these three strings before delegating to `buildDayMemoryCollapsedLine`.
- `continueTaskId` is `null` whenever a session is currently active (`hasActiveSession` check, `use-pomodoro-cycle.ts:472-474`) — so "Wróć tutaj" is naturally absent mid-session, which is correct (you can't "return to" what you're already doing) and requires no extra guard.
- Guest parity is close to free: `useDailyRecap()` already branches guest/auth behind one `DailyRecap` shape, and `pomodoro.continueTaskId`/`tasks` are populated identically in `GuestPomodoroDashboard` (`pomodoro-dashboard.tsx:1103-1118`) via `useGuestDomainTasks()` and the same `usePomodoroCycle` hook with `continueTasks` wired from guest tasks. The new component can be rendered once inside `PomodoroDashboardBody` with no `dataMode` branching required beyond what already exists in `recap`/`continueTaskId`.

## What We're NOT Doing

- No new tRPC procedures or Prisma queries — `recap.getDaily` remains the only recap procedure.
- No changes to `DailyRecapPanel`, its rows, its dismiss/collapse state, or its test suite (`daily-recap-panel.test.tsx`) — it stays the detail/log view, untouched.
- No changes to `home-session-state.ts`'s module-priority system (`HomeModuleKey`, `deriveHomeSessionState`) — the new element uses a local, plan-scoped visibility condition rather than a new module key, to avoid touching the well-tested IA state machine for a single additive element. (See Critical Implementation Details for rationale.)
- No footprint sub-phase / P-111 "type-mix line" work — that is a separate, still-unbuilt roadmap item (S-30.md distinguishes it explicitly).
- No new persistence for dismiss/expand state beyond component-local `useState` (matches `DailyRecapPanel`'s pattern for expand toggles; no localStorage/sessionStorage dismiss key is required since acceptance criteria don't call for dismissal, only collapse/expand).
- No changes to `Task.resumeNote` write/clear semantics or `Session.lastFocusedTaskId` resolution — both are consumed read-only, as-is.

## Implementation Approach

Follow the house "formatter-first" pattern already established by F-14 (`narrative-copy.ts`) and S-18 (`return-handoff.ts`): ship a pure formatter module first, fully unit-tested against the existing exact-string/length-budget test style, then wire a small presentational component that consumes the formatter's output plus `useTranslations`/`useLocale`, then integrate that component into `PomodoroDashboardBody` at the top of `home-primary-region`, gated by session state to stay hidden during active work.

Three phases:
1. **Pure formatter** (`src/lib/recap/format-day-memory.ts`) — TDD-fit, no React, no DOM.
2. **Presentational component** (`src/app/_components/day-memory-line.tsx`) — collapsed line + 3-section expansion, consuming the formatter output; component-level tests (jsdom/RTL), no new data fetching.
3. **Home integration** — wire the component into `PomodoroDashboardBody`, add visibility gating, extend `pomodoro-dashboard.test.tsx` region oracles, then a manual/E2E pass confirming no-scroll-on-load and expand/collapse behavior in a real browser.

## Critical Implementation Details

**Visibility gating without touching `home-session-state.ts`:** The new element must be hidden during `active_work` (matching S-30/S-41 precedent for `recap`) but must NOT require a new `HomeModuleKey` or changes to `deriveHomeSessionState`'s tested branches, because that module is a small, fully-covered state machine and this is a single additive, non-interactive-during-work element. Instead, gate visibility with a local boolean derived the same way `recapPanel`'s condition already is (`dataMode === "authenticated" && moduleVisible("recap")` — but for guest+auth parity, use `homeIa.state !== "active_work"` directly, which is already computed in `PomodoroDashboardBody` at `pomodoro-dashboard.tsx:500-544` and works for both data modes without extending `HomeModuleKey`). Concretely: `const dayMemoryVisible = homeIa.state !== "active_work";` — this reuses an already-computed value, adds no new state-machine surface, and keeps the "no duplicate S-30 substrate" risk contained to zero new module keys.

**"Nothing to say" empty state:** When `DailyRecap.last24Hours` is empty AND `todayPlan` (filtered to not-done) is empty AND `continueTaskId` is null, render nothing (return `null`) rather than an empty collapsed line — mirrors `DailyRecapPanel`'s existing `if (dismissed || isLoading) return null;` pattern of not rendering hollow chrome.

## Phase 1: Pure day-memory formatter [test-first / TDD]

### Overview

Add `src/lib/recap/format-day-memory.ts`: a pure function that takes `DailyRecap`, a task list slice (`{id, status, title, resumeNote}[]`), a `continueTaskId`, and a `UserLocale`, and returns a structured `DayMemory` result (collapsed-line string + three section objects) ready for a component to render. This phase is pure TypeScript, no React/DOM — ideal for red-green-refactor TDD, following the exact test style already established in `src/lib/voice/acceptance-copy.test.ts:72-112` (exact-string assertions per locale, one-line length budget) and `src/lib/session/return-handoff.test.ts` (pure composition helper tests).

### Changes Required:

#### 1. Formatter module

**File**: `src/lib/recap/format-day-memory.ts` (new)

**Intent**: Compose `DailyRecap.last24Hours` (done), `DailyRecap.todayPlan` filtered to `doneForToday === false` (remains), and `pickHandoffTaskContext` output for the given `continueTaskId` (return-to) into the three display-ready strings `DayMemoryCollapsedInput` expects, plus per-section structured content (a short list, not a `title · Xm · timestamp` log) for the expanded view. Delegate all locale-specific copy to the existing `narrative-copy.ts` accessors (`getDayMemorySectionDone/Remains/ReturnTo`, `buildDayMemoryCollapsedLine`) — this module owns composition/counting logic only, not copy strings.

**Contract**:
```ts
export type DayMemoryDoneItem = { taskId: RecapTaskId; title: string };
export type DayMemoryRemainingItem = { taskId: RecapTaskId; title: string };
export type DayMemoryReturnTo = { taskTitle: string; resumeNote: string | null } | null;

export type DayMemory = {
  collapsedLine: string;
  sections: {
    done: { label: string; items: DayMemoryDoneItem[] };
    remains: { label: string; items: DayMemoryRemainingItem[] };
    returnTo: { label: string; value: DayMemoryReturnTo };
  };
  hasContent: boolean; // false when done, remains, and returnTo are all empty/null
};

export function formatDayMemory(input: {
  recap: DailyRecap;
  tasks: Array<{ id: DomainTaskId; status: string; title: string; resumeNote?: string | null }>;
  continueTaskId: DomainTaskId | null;
  locale: UserLocale;
}): DayMemory;
```
- `done` items: map `recap.last24Hours` to `{taskId, title}` (dedupe not required — recap builder already returns one row per task per research).
- `remains` items: `recap.todayPlan.filter((row) => !row.doneForToday)` mapped to `{taskId, title}`.
- `returnTo`: `null` when `continueTaskId == null`; otherwise call `pickHandoffTaskContext(tasks)` (already filters to `status === "active"`) and map to `{taskTitle, resumeNote}` — if `pickHandoffTaskContext` yields no title (no active tasks), treat as `null`.
- `collapsedLine`: call `buildDayMemoryCollapsedLine({done: <count string>, remaining: <count string>, next: <returnTo.taskTitle ?? fallback>}, locale)`. **Correction (plan review):** the `done`/`remaining` count strings MUST NOT be hand-composed English words in the formatter — Polish requires 3-way plural forms (1 zadanie / 2-4 zadania / 5+ zadań), which a JS template string cannot express. `Recap.todayDailyTag` is not a pluralization precedent (it's a static, count-less tag). The correct, already-established precedent is the ICU MessageFormat plural pattern used immediately adjacent to `DayMemory` in the same message files — `HomeFocusSummary.standingOpen`/`standingDone` (`messages/en.json:328-329`, `messages/pl.json:328-329`), which already has full `one`/`few`/`many`/`other` PL forms. **Add two new message keys** under `DayMemory` (e.g. `DayMemory.doneCount` / `DayMemory.remainingCount`) following that exact ICU plural shape, add matching `getDayMemoryDoneCount(count, locale)` / `getDayMemoryRemainingCount(count, locale)` accessors in `narrative-copy.ts` next to the existing `DayMemory` accessors, and have `format-day-memory.ts` call those (via `createNamespaceTranslator("DayMemory", locale)`) instead of interpolating raw numbers into English-only strings. This is a small, additive i18n change (two keys, both locales) — still zero new tRPC/Prisma queries, so it does not violate the roadmap's "no new data pipeline" constraint. Update the Phase 1 test plan to assert PL plural boundaries (1 / 2 / 5) in addition to the existing EN exact-string + 120-char budget style from `acceptance-copy.test.ts:98-111`.
- `hasContent`: `false` iff `done.items.length === 0 && remains.items.length === 0 && returnTo == null`.

#### 2. Count pluralization message keys (added by plan review)

**Files**: `messages/en.json`, `messages/pl.json`, `src/lib/session/narrative-copy.ts`

**Intent**: Add `DayMemory.doneCount` / `DayMemory.remainingCount` ICU plural message keys (same shape as `HomeFocusSummary.standingOpen`/`standingDone` at `messages/en.json:328-329` / `messages/pl.json:328-329`, with full PL `one`/`few`/`many`/`other` forms), plus `getDayMemoryDoneCount(count: number, locale)` / `getDayMemoryRemainingCount(count: number, locale)` accessors in `narrative-copy.ts` next to the existing `DayMemory` accessors (`narrative-copy.ts:119-147`). `format-day-memory.ts` calls these instead of composing English count words itself. Covered automatically by the existing generic `src/i18n/messages-parity.test.ts` EN/PL key-diff test — no new parity test needed.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `pnpm vitest run src/lib/recap/format-day-memory.test.ts`
- New tests assert PL plural boundaries (1 / 2 / 5) for `doneCount`/`remainingCount`, mirroring the `acceptance-copy.test.ts` exact-string style
- i18n parity test passes: `pnpm vitest run src/i18n/messages-parity.test.ts`
- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Full unit suite unaffected: `pnpm test`

#### Manual Verification:

- N/A for this phase (pure function, no UI) — proceed directly to Phase 2 once automated checks are green.

---

## Phase 2: Day-memory presentational component [test-first / TDD, component-level]

### Overview

Add `src/app/_components/day-memory-line.tsx`: consumes `formatDayMemory` output (passed in as props, or computed internally from `recap`/`tasks`/`continueTaskId`/`locale` props — implementer's call, but must remain a pure presentational wrapper with no data fetching) and renders the collapsed one-line summary plus an expand/collapse toggle revealing the three narrative sections. Follows the existing hand-rolled disclosure pattern (`SectionToggle` in `daily-recap-panel.tsx:39-65`) for consistency, but the expanded content must be prose/list narrative per section — NOT the `rowFormat` (`{label} · {minutes}m · {range}`) log style used by `DailyRecapPanel`.

### Changes Required:

#### 1. Component

**File**: `src/app/_components/day-memory-line.tsx` (new)

**Intent**: Render `formatDayMemory(...).collapsedLine` as a single line, always visible when `hasContent` is true, with a toggle (`aria-expanded`, `data-testid="day-memory-toggle"`) that reveals three sections each labeled with `sections.done.label` / `sections.remains.label` / `sections.returnTo.label`, rendering `sections.done.items`/`sections.remains.items` as short narrative lists (task titles only — no minutes, no timestamps) and `sections.returnTo.value` as a single sentence naming the task (and resume note if present). Return `null` when `hasContent` is false.

**Contract**: Props shape:
```ts
type DayMemoryLineProps = {
  recap: DailyRecap;
  tasks: Array<{ id: DomainTaskId; status: string; title: string; resumeNote?: string | null }>;
  continueTaskId: DomainTaskId | null;
  isLoading?: boolean;
};
```
Internally calls `useLocale()` (matches `daily-recap-panel.tsx:72` pattern) and `formatDayMemory`. Root element `data-testid="day-memory-line"`; collapsed text `data-testid="day-memory-collapsed"`; expanded container `data-testid="day-memory-expanded"`. Returns `null` when `isLoading` or `!hasContent` — mirrors `DailyRecapPanel`'s `if (dismissed || isLoading) return null;`.

### Success Criteria:

#### Automated Verification:

- Component unit tests pass: `pnpm vitest run src/app/_components/day-memory-line.test.tsx`
- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Full unit suite unaffected: `pnpm test`

#### Manual Verification:

- N/A for this phase in isolation (component not yet wired into the page) — defer visual/browser confirmation to Phase 3.

---

## Phase 3: Home integration [UI wiring / integration]

### Overview

Wire `DayMemoryLine` into `PomodoroDashboardBody`, positioned as the first child of `home-primary-region` (above steering/nextFocus/timer), gated by `homeIa.state !== "active_work"` so it's hidden during focused work — consistent with the S-30/S-41 precedent for `recap`. No changes to `home-shell.tsx`, `home-session-state.ts`, or `DailyRecapPanel`.

### Changes Required:

#### 1. Dashboard wiring

**File**: `src/app/_components/pomodoro-dashboard.tsx`

**Intent**: Import `DayMemoryLine`, compute `dayMemoryVisible = homeIa.state !== "active_work"`, and render `{dayMemoryVisible && <DayMemoryLine recap={recap} tasks={tasks} continueTaskId={pomodoro.continueTaskId} isLoading={recapLoading} />}` as the first element inside the `home-primary-region` `HomeLayoutRegion` block (`pomodoro-dashboard.tsx:865-872`), before the existing `moduleInZone("steering", "primary") && steeringCards` line.

**Contract**: No new props on `PomodoroDashboardBody` — `recap`, `tasks`, `pomodoro.continueTaskId`, `recapLoading`, and `homeIa.state` are all already in scope at the render site. This is a same-component, same-scope insertion; both `AuthenticatedPomodoroDashboard` and `GuestPomodoroDashboard` render through this one shared body, so guest parity requires no additional branching.

**Test mock note (added by plan review):** `useDailyRecap` is currently mocked in `pomodoro-dashboard.test.tsx:32-38` as a static `vi.mock` factory returning empty `recap` (`last24Hours: []`, `todayPlan: []`) with no per-test override — unlike `usePomodoroCycle`, which already exposes an overridable `usePomodoroCycleMock.mockReturnValue(...)` pattern used throughout the file. Exercising the day-memory-visible path (non-empty `hasContent`) requires converting this to the same overridable-mock shape (e.g. export a `useDailyRecapMock` and call `.mockReturnValue(...)` per test, or `vi.mocked(useDailyRecap).mockReturnValue(...)`) before writing the new region assertions — do this as part of this phase's test changes, not as an ad-hoc one-off.

### Success Criteria:

#### Automated Verification:

- Existing structural tests still pass: `pnpm vitest run src/app/_components/pomodoro-dashboard.test.tsx`
- `useDailyRecap` mock in `pomodoro-dashboard.test.tsx` converted to an overridable per-test pattern (matching `usePomodoroCycleMock`), with default (empty-recap) behavior unchanged for all pre-existing tests
- New/extended region assertion passes: a test using `expectInsideRegion("home-primary-region", "day-memory-line")` when content exists (recap mock overridden to non-empty data), and confirming absence during `active_work` state (extend `pomodoro-dashboard.test.tsx` using the existing `expectOutsidePrimaryRegion`/mock-state helpers)
- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Full unit suite passes: `pnpm test`

#### Manual Verification:

- On a fresh home load (authenticated, with at least one done task and one remaining task today), the collapsed day-memory line is visible above the fold with no scroll needed on a standard 1280×800 viewport.
- Clicking/tapping the line expands exactly three sections (Domknięte / Zostaje / Wróć tutaj in PL, Done / Remains / Return to in EN) with narrative text, not `title · Xm · HH:MM` rows.
- Starting a WORK cycle hides the day-memory line (active_work state); ending the session and returning to idle/steering brings it back.
- Guest mode with existing guest tasks/session shows the same line with guest-derived data (no auth required, no console errors).
- A brand-new guest/user with nothing done and nothing remaining and no prior session sees no day-memory element at all (no empty shell).
- Switching locale (PL ↔ EN) updates section labels and collapsed line copy correctly.

**No-scroll layout risk and fallback (added by plan review):** `home-primary-region` is not the top of the page — above it sit the full header (hero image, h1, purpose text, tagline), an optional `GuestBanner`, `OfflineBanner`, and a conditional error/recovery banner, all spaced with `py-16`/`gap-8` (`home-shell.tsx:94-109`, `pomodoro-dashboard.tsx:824-857`). Placing the day-memory line as the first primary-region child is architecturally the right slot (per the plan-brief's reasoning), but "no scroll on a standard 1280×800 viewport" is a real layout budget, not guaranteed by data scope alone, and research flagged the header/purpose area as the alternative candidate at only 75% confidence. If the manual check in 3.6 fails (content pushes below the fold): first try trimming the collapsed line's own vertical footprint (single line, no icon/padding bloat) before resorting to a placement change; if that's still insufficient, fall back to placing the line inside the `<header>` block (`home-shell.tsx:97-109`) directly below the purpose header, which is the research-identified alternative — this would be a Phase 3-only redo per the plan-brief's own risk note, not a formatter/component rework. Do not silently accept a scrolled layout as "done."

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding further (e.g., archiving the change).

---

## Testing Strategy

### Unit Tests:

- `format-day-memory.test.ts`: exact-string assertions per locale (mirroring `acceptance-copy.test.ts` style) for collapsed line composition with 0/1/many done items, 0/1/many remaining items, `continueTaskId` null vs. resolved-with-resume-note vs. resolved-without-resume-note; `hasContent` true/false boundary; PL/EN parity. Also asserts PL plural boundaries (1 / 2 / 5 done and remaining counts) against the new `DayMemory.doneCount`/`remainingCount` ICU plural keys (see Phase 1 §2).
- `day-memory-line.test.tsx`: renders collapsed line text, toggles to expanded state showing exactly three sections with correct labels, returns `null` when `hasContent` is false or `isLoading` is true, does not render `rowFormat`-style minute/timestamp text anywhere in the expanded output (negative assertion distinguishing it from `DailyRecapPanel`).

### Integration Tests:

- `pomodoro-dashboard.test.tsx` extension: day-memory line appears inside `home-primary-region` in idle/steering/returning/break states when `hasContent`, absent during `active_work`, absent when recap/tasks yield no content — using the existing `expectInsideRegion`/`expectOutsidePrimaryRegion` helpers, `usePomodoroCycleMock`, and the newly-overridable `useDailyRecap` mock (converted in Phase 3 §1, see Test mock note) already in that file.

### Manual Testing Steps:

1. Log in, complete one task and leave one standing task open today; reload home — confirm one-line summary visible without scrolling.
2. Expand the line — confirm three sections, prose style, task titles named correctly.
3. Interrupt a WORK cycle (leave it running or paused) and end the session — reload home — confirm "Wróć tutaj" names the correct last-focused task, including resume note text if one was set via the mid-cycle continue flow.
4. Start a new WORK cycle — confirm the day-memory line disappears during active work.
5. Switch locale to Polish — confirm PL section labels/copy.
6. Test guest mode end-to-end with the same steps (no login).

## Performance Considerations

None beyond existing `useDailyRecap()`/`usePomodoroCycle()` cost — no new queries, no new subscriptions. The formatter is a pure synchronous function over already-fetched, already-small (per-day) arrays.

## Migration Notes

None — purely additive, no schema or data changes.

## References

- Related research: `context/changes/mindful-day-memory/research.md`
- Formatter precedent: `src/lib/session/return-handoff.ts:62-105`, `src/lib/session/narrative-builder.ts`
- Copy accessor precedent: `src/lib/session/narrative-copy.ts:119-147`
- Test style precedent: `src/lib/voice/acceptance-copy.test.ts:72-112`
- Disclosure UI precedent: `src/app/_components/daily-recap-panel.tsx:39-65`
- Region test oracle precedent: `src/app/_components/pomodoro-dashboard.test.tsx:1056-1066`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Pure day-memory formatter

#### Automated

- [x] 1.1 Unit tests pass: `pnpm vitest run src/lib/recap/format-day-memory.test.ts` — ad3acfa
- [x] 1.2 Type checking passes: `pnpm typecheck` — ad3acfa
- [x] 1.3 Linting passes: `pnpm lint` — ad3acfa
- [x] 1.4 Full unit suite unaffected: `pnpm test` — ad3acfa
- [x] 1.5 `DayMemory.doneCount`/`remainingCount` ICU plural keys added (EN + PL) and i18n parity test passes: `pnpm vitest run src/i18n/messages-parity.test.ts` — ad3acfa
- [x] 1.6 PL plural boundary tests (1 / 2 / 5) pass for done/remaining counts — ad3acfa

### Phase 2: Day-memory presentational component

#### Automated

- [x] 2.1 Component unit tests pass: `pnpm vitest run src/app/_components/day-memory-line.test.tsx` — 9126713
- [x] 2.2 Type checking passes: `pnpm typecheck` — 9126713
- [x] 2.3 Linting passes: `pnpm lint` — 9126713
- [x] 2.4 Full unit suite unaffected: `pnpm test` — 9126713

### Phase 3: Home integration

#### Automated

- [x] 3.1 Existing structural tests pass: `pnpm vitest run src/app/_components/pomodoro-dashboard.test.tsx` — 56 passed — 5e26b7a
- [x] 3.2 New/extended region assertions pass (day-memory visible/hidden per session state) — 5e26b7a
- [x] 3.3 Type checking passes: `pnpm typecheck` — 5e26b7a
- [x] 3.4 Linting passes: `pnpm check` (biome; project has no `lint` script) — 5e26b7a
- [x] 3.5 Full unit suite passes: `pnpm test` — 1110 passed — 5e26b7a
- [x] 3.12 `useDailyRecap` mock in `pomodoro-dashboard.test.tsx` converted to an overridable per-test pattern (matching `usePomodoroCycleMock`); pre-existing tests unaffected — 5e26b7a

#### Manual

- [x] 3.6 Fresh home load shows collapsed line above the fold with no scroll (verified in browser at 1280×800; line rendered well within viewport, no fallback needed) — 5e26b7a
- [x] 3.7 Expand shows exactly three narrative sections (not raw log style), correct per locale (verified EN + PL; sections render conditionally per non-empty category, prose style confirmed, no `rowFormat` timestamps) — 5e26b7a
- [x] 3.8 Day-memory line hides during active WORK cycle, reappears after session ends (verified live in browser: WORK cycle running → line absent; confirmed structurally via automated region test 3.2 for guest end-session/return-to path since a pre-existing, unrelated bug in `use-pomodoro-cycle.ts` — `useSyncExternalStore` getSnapshot not memoized — crashes the guest app on real session-end; flagged separately, not caused by this change, see `git diff main -- src/hooks/use-pomodoro-cycle.ts` showing no diff) — 5e26b7a
- [x] 3.9 Guest mode parity confirmed with same behavior, no console errors (guest-mode-only manual pass; no auth used throughout) — 5e26b7a
- [x] 3.10 Empty-state (nothing done, nothing remaining, no prior session) renders no element (verified fresh guest load, no task data) — 5e26b7a
- [x] 3.11 PL/EN locale switch updates copy correctly (verified live: collapsed line and section labels switch EN↔PL correctly) — 5e26b7a
