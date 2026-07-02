---
date: 2026-07-02T07:29:17Z
researcher: Claude (10x-research)
git_commit: bcf18c6508be00f2f4804d981cb4311d71a72d08
branch: features/mindful-day-memory
repository: FlowState
topic: "S-42 mindful-day-memory — presentation/formatter layer over existing DailyRecap (S-30 phase 2)"
tags: [research, codebase, recap, day-memory, i18n, home-composition, resume-note, s-30, s-18, f-14, s-40, s-41]
status: complete
last_updated: 2026-07-02
last_updated_by: Claude (10x-research)
---

# Research: S-42 Mindful day memory

**Date**: 2026-07-02T07:29:17Z
**Researcher**: Claude (10x-research)
**Git Commit**: bcf18c6508be00f2f4804d981cb4311d71a72d08
**Branch**: features/mindful-day-memory
**Repository**: FlowState

## Research Question

How should S-42 `mindful-day-memory` be implemented as a pure, presentation-only formatter layer over the existing `DailyRecap` (S-30), producing a collapsed one-line day memory on home plus an expandable three-section narrative view (Domknięte / Zostaje / Wróć tutaj), with "Wróć tutaj" naming the last focused task after interruption — without adding any new tRPC/Prisma queries?

## Summary

The substrate for S-42 is almost entirely in place and unusually well-prepared by prior slices:

1. **`DailyRecap` (S-30)** already exposes exactly the data a formatter needs: `last24Hours` (done/worked tasks, pre-sorted most-recent-first), `todayPlan` (remaining tasks), and `footprints` (per-task last-focused + cumulative minutes). It is served by a single tRPC procedure `recap.getDaily` and has both an authenticated (Prisma) and guest (pure, in-memory) builder with matching shapes.
2. **The `DayMemory.*` message catalog (F-14)** is not just reserved — it is fully implemented with real EN/PL copy, and there are ready-to-call pure accessor functions (`getDayMemorySectionDone/Remains/ReturnTo`, `buildDayMemoryCollapsedLine`) in `src/lib/session/narrative-copy.ts:119-147`, already unit-tested in `src/lib/voice/acceptance-copy.test.ts`. A code comment literally names S-42 as the intended consumer. **Nothing in `src/app` or `src/hooks` imports these yet** — S-42's job is exactly to wire this up.
3. **S-18's resume-note infrastructure is directly reusable for "Wróć tutaj."** `Task.resumeNote` (persistent, cleared on completion) plus `Session.lastFocusedTaskId` (server-resolved at session end, falls back through RUNNING/PAUSED/most-recent WORK cycle **regardless of INTERRUPTED state**) are already composed by existing pure helpers `resolveContinueTaskId` and `pickHandoffTaskContext` in `src/lib/session/return-handoff.ts:67-105`. These are a better source for "last focused task after interruption" than `DailyRecap` alone, because `DailyRecap`'s cycle queries filter to `COMPLETED` cycles only and have no visibility into interrupted-but-uncompleted work.
4. **Home composition (S-40/S-41)** explicitly reserved space and copy namespace for S-42 but left exact placement undecided. Both prior slices' plans note "`DayMemory.*` reserved for S-42" and "no day-memory narrative yet." The existing `DailyRecapPanel` is collapsed-by-default, hidden during active work, and duplicated in DOM (mobile secondary region vs. desktop context rail, `lg:hidden` toggle) — S-42's one-line element likely needs its own placement near the header/purpose area to guarantee true "no scroll" visibility, distinct from the recap panel's rail/secondary-region slot.
5. **The main design risk flagged by the roadmap** ("duplicate S-30 substrate or accidental new data pipeline") is avoidable: everything needed is already fetched today (`DailyRecap` via existing hook, task list with `resumeNote`/`status` already in home client state, `Session.lastFocusedTaskId` already resolved server-side into `continueTaskId`). A pure formatter can compose these without any new query.

## Detailed Findings

### 1. `DailyRecap` (S-30) data substrate

**Type definition** — `src/lib/recap/types.ts:1-29` (full file):

```ts
export type RecapTaskId = string | number;

export type RecapTaskRow = {
	taskId: RecapTaskId;
	title: string;
	firstStartedAt: Date;
	lastEndedAt: Date;
	focusedMinutes: number;
	completedWithoutCycle?: boolean;
};

export type TodayPlanRow = {
	taskId: RecapTaskId;
	title: string;
	isDailyStanding: boolean;
	doneForToday: boolean;
	effortMinutes: number | null;
};

export type TaskFootprint = {
	lastFocusedAt: Date;
	cumulativeMinutes: number;
};

export type DailyRecap = {
	last24Hours: RecapTaskRow[];
	todayPlan: TodayPlanRow[];
	footprints: Record<string, TaskFootprint>;
};
```

- `last24Hours` → source for "Domknięte" (done). Sorted **descending by `lastEndedAt`** (`src/lib/recap/build-daily-recap.ts:72`), so `last24Hours[0]` is already "most recently worked/completed task." `completedWithoutCycle?: boolean` distinguishes tasks marked done without a finished WORK cycle.
- `todayPlan` → source for "Zostaje" (remains). Filter `doneForToday === false` for the open-work count/list.
- `footprints` (keyed by `String(taskId)`) → P-107 sub-phase data, `{ lastFocusedAt, cumulativeMinutes }` per task, but **built only from `COMPLETED` WORK cycles** (`build-daily-recap.ts:30-36,170-172`) — has no visibility into `INTERRUPTED` cycles.
- **No dedicated "last focused task" field exists on `DailyRecap`.** See §3 for the correct source instead.

**Builder (authenticated, DB-calling — not pure)** — `src/lib/recap/build-daily-recap.ts:19-100`:
```ts
export async function buildDailyRecap(
	db: DbClient,
	userId: string,
	localDateKey: string,
	now: Date = new Date(),
): Promise<DailyRecap>
```
Queries `db.cycle.findMany` (COMPLETED WORK cycles in rolling 24h window) + `db.task.findMany` (tasks completed without a cycle) + `buildFootprints()` (lines 150-215, second query over all-time COMPLETED WORK cycles for touched task IDs).

**Guest mirror (pure, in-memory)** — `src/lib/guest/recap.ts:16-79`:
```ts
export function buildGuestDailyRecap(
	snapshot: GuestSnapshotV1,
	_localDateKey: string,
	doneTodayIds: ReadonlySet<string>,
	now: Date = new Date(),
): DailyRecap
```
Same shape/sort/aggregation logic mirrored from the DB builder — established precedent that a formatter can be designed against `DailyRecap` alone, independent of which builder produced it.

**tRPC procedure** — `src/server/api/routers/recap.ts` (full file, 17 lines):
```ts
export const recapRouter = createTRPCRouter({
	getDaily: protectedProcedure
		.input(z.object({ localDateKey: localDateKeySchema }))
		.query(async ({ ctx, input }) => {
			return buildDailyRecap(ctx.db, ctx.session.user.id, input.localDateKey);
		}),
});
```
This is the **only** recap procedure — confirms S-42 has exactly one existing procedure to reuse and must not add another.

**Client hook** — `src/hooks/use-daily-recap.ts:63-108`, `useDailyRecap()` — wraps `api.recap.getDaily.useQuery` (auth) or `buildGuestDailyRecap` via `useSyncExternalStore` (guest), returns `{ localDateKey, recap: DailyRecap, isLoading }`. This is the hook S-42's formatter/component should consume — no new hook needed for the recap half of the data.

**Existing tests** (pattern precedent):
| Path | Covers |
|---|---|
| `src/lib/recap/build-daily-recap.test.ts` | DB builder |
| `src/app/_components/daily-recap-panel.test.tsx` | Component, collapsed-by-default oracle |
| `src/hooks/use-daily-recap.test.tsx` | Hook, guest/auth branching |
| `src/lib/guest/recap.test.ts` | Guest builder |
| `src/server/api/routers/recap.test.ts` + `.integration.test.ts` | Router |
| `e2e/daily-work-timing-recap.spec.ts:70-93` | Playwright, panel visibility/toggle/dismiss |

No TODO/phase-2 hints exist in the recap source itself — all "phase 2" framing lives in `context/foundation/roadmap-references/items/S-30.md` and `S-42.md`.

### 2. `DayMemory.*` message catalog and voice contract (F-14)

**Already fully implemented, not just reserved.** Message catalogs:

`messages/en.json:331-336`:
```json
"DayMemory": {
	"sectionDone": "Done",
	"sectionRemains": "Remains",
	"sectionReturnTo": "Return to",
	"collapsedLine": "Done: {done}. Remains: {remaining}. Return calmly to: {next}."
},
```
`messages/pl.json:331-336`:
```json
"DayMemory": {
	"sectionDone": "Domknięte",
	"sectionRemains": "Zostaje",
	"sectionReturnTo": "Wróć tutaj",
	"collapsedLine": "Zrobione: {done}. Zostało: {remaining}. Wróć spokojnie do: {next}."
},
```

**i18n stack**: `next-intl` v4.13.0 (`package.json:53`). Two consumption patterns:
- React components: `useTranslations(namespace)` (e.g. `daily-recap-panel.tsx:72-73`).
- Non-React/pure copy modules: project wrapper `createNamespaceTranslator(namespace, locale)` — `src/i18n/create-translator.ts:23-39` — internally calls next-intl's `createTranslator`. This is the pattern already used for `DayMemory`.

**Ready-to-call formatter primitives** — `src/lib/session/narrative-copy.ts:119-147`:
```ts
function dayMemoryT(locale: UserLocale) {
	return createNamespaceTranslator("DayMemory", locale);
}

export function getDayMemorySectionDone(locale: UserLocale = "en"): string {
	return dayMemoryT(locale)("sectionDone");
}
export function getDayMemorySectionRemains(locale: UserLocale = "en"): string {
	return dayMemoryT(locale)("sectionRemains");
}
export function getDayMemorySectionReturnTo(locale: UserLocale = "en"): string {
	return dayMemoryT(locale)("sectionReturnTo");
}

export type DayMemoryCollapsedInput = {
	done: string;
	remaining: string;
	next: string;
};

/** F-14 acceptance: collapsed day-memory one-liner for home (S-42 formatter cites this). */
export function buildDayMemoryCollapsedLine(
	input: DayMemoryCollapsedInput,
	locale: UserLocale = "en",
): string {
	return dayMemoryT(locale)("collapsedLine", input);
}
```
The docstring literally names S-42 as the consumer. `DayMemoryCollapsedInput` takes already-formatted strings (`done`, `remaining`, `next`), not raw numbers/objects — S-42's `format-day-memory.ts` needs to produce these three strings (e.g. "2 tasks", task title, etc.) from `DailyRecap` + task/session data, then pass them to `buildDayMemoryCollapsedLine`.

**Existing copy-contract tests to extend the same pattern for** — `src/lib/voice/acceptance-copy.test.ts:72-112` (`describe("F-14 voice acceptance — day memory closure", ...)`): exact-string assertions per locale for the three section labels, plus `buildDayMemoryCollapsedLine` exact-render assertion for PL and a **120-character length-budget assertion** for EN (line 110). S-42's own formatter tests should follow this exact style (locale-parameterized pure functions, exact-string + length-budget assertions).

**Parity test**: `src/i18n/messages-parity.test.ts:30-41` — generic recursive EN/PL key-diff test already covers `DayMemory.*` automatically.

**F-14 change folder**: `context/archive/2026-06-27-product-voice-contract/` (already archived). `change.md:30,47` confirms DayMemory copy shipped and explicitly unlocks S-40/S-41/S-42. Neither `plan.md` nor `research.md` mention DayMemory by name — it was added during implementation, documented only in the archived `change.md` summary and in code/tests.

**Confirmed unconsumed**: repo-wide search for `DayMemory` / `getDayMemory*` / `buildDayMemoryCollapsedLine` / `DayMemoryCollapsedInput` found matches **only** in `src/lib/session/narrative-copy.ts` and `src/lib/voice/acceptance-copy.test.ts`. No component, hook, or `format-day-memory.ts` exists yet (confirmed via direct `find`/glob — absent).

### 3. "Wróć tutaj" (return-to) — reusable S-18 + session-end infrastructure

**`Task.resumeNote`** — `prisma/schema.prisma:79`, persistent nullable field on `Task` (`resumeNote String? @map("resume_note") @db.VarChar(120)`), not a separate snapshot table. This was S-18's final resolved decision (`context/archive/2026-06-12-task-resume-context-note/plan.md` Decision Log, 88% confidence), superseding the "Unknown" still listed in the (stale) roadmap item doc.

- Written only via the "mark done mid-cycle → pick next task → continue" path, attached to the **newly selected next task** — `src/hooks/use-pomodoro-cycle.ts:3015-3039` (`onMidCycleContinueWithTask`).
- Auto-cleared on task completion — `src/server/api/routers/task.ts:180-189`.
- Read/displayed today in `task-suggestion-card.tsx` (`resumeNote?: string | null` on `TaskSuggestionData`, line 47) and `task-list.tsx:460-471` (muted italic subtitle on the focused row).

**`Session.lastFocusedTaskId`** — `prisma/schema.prisma:113` — server-resolved at session end via `resolveLastFocusedTaskId` (`src/server/api/lib/session-end-metadata.ts:15-48`):
```ts
async function resolveLastFocusedTaskId(database, userId, sessionId): Promise<number | null> {
	const activeWorkCycle = await database.cycle.findFirst({
		where: { userId, sessionId, kind: "WORK", state: { in: ["RUNNING", "PAUSED"] }, taskId: { not: null } },
		orderBy: { startedAt: "desc" },
		select: { taskId: true },
	});
	if (activeWorkCycle?.taskId != null) return activeWorkCycle.taskId;

	const lastWorkCycle = await database.cycle.findFirst({
		where: { userId, sessionId, kind: "WORK", taskId: { not: null } },
		orderBy: [{ endedAt: "desc" }, { startedAt: "desc" }],
		select: { taskId: true },
	});
	return lastWorkCycle?.taskId ?? null;
}
```
Critically, this resolver considers **any** WORK cycle regardless of `INTERRUPTED` state — unlike `DailyRecap.footprints`/`last24Hours`, which filter to `COMPLETED` only. This is the correct data source for "names the last focused task **after interruption**."

**Already-composed pure helpers** (best reuse target) — `src/lib/session/return-handoff.ts:62-105`:
```ts
export type HandoffTaskContext = {
	resumeNote: string | null;
	taskTitle: string | null;
};

export function resolveContinueTaskId(
	lastEnded: { lastFocusedTaskId?: DomainTaskId | null } | null,
	tasks: Array<{ id: DomainTaskId; status: string }>,
): DomainTaskId | null { /* matches lastFocusedTaskId to an active task */ }

export function pickHandoffTaskContext(
	tasks: Array<{ status: string; title: string; resumeNote?: string | null }>,
): HandoffTaskContext { /* prefers active task with a resume note, else first active task title */ }
```
These are consumed today by `continueTaskId` (`use-pomodoro-cycle.ts:471-495`, surfaced as the "Continue here" row in `task-list.tsx`) and by the existing return/closure narrative (`composeReturnHandoffLine`, `buildReturnHandoff` in `narrative-builder.ts`). **S-42's formatter can call `resolveContinueTaskId` + `pickHandoffTaskContext` directly** (or a close variant) rather than reinventing "who was I last working on" logic — this is exactly the kind of duplicate-substrate risk the roadmap item warns against.

**`CycleState` enum** (interruption detection) — `prisma/schema.prisma:30-35`: `RUNNING | PAUSED | COMPLETED | INTERRUPTED`. Set via `cycle.interrupt` mutation — `src/server/api/routers/cycle.ts:327-357`.

**Tension to resolve explicitly in `/10x-plan`**: `DailyRecap` (COMPLETED-only) vs. `Session.lastFocusedTaskId`/`return-handoff.ts` (any WORK cycle including INTERRUPTED) are two different data sources with different interruption visibility. The formatter's "Wróć tutaj" input likely needs to come from the latter, composed alongside (not instead of) `DailyRecap`'s done/remains data — both are already-fetched, so this stays within the "no new tRPC/Prisma" constraint as long as the home page already has both in client state (it does — task list with `resumeNote`/`status`, and the session-end/continue machinery already power the existing "Continue here" row).

**Test precedent for "narrative over existing data"**: `src/lib/session/return-handoff.test.ts`, `src/lib/session/narrative-builder.test.ts` (`buildReturnHandoff` — "prefers resume note as first clause", "falls back to task title when resume note is absent"), `src/lib/voice/acceptance-copy.test.ts` (DayMemory section, see §2).

### 4. Home page composition slot (S-40/S-41 IA)

**Composition tree** — `src/app/page.tsx:8-35` (server component, prefetches `task.list`, `cycle.getActive`, `recap.getDaily`) →
```
HydrateClient → HomeShell (home-shell.tsx:118)
  → OnboardingProvider → GuestMergeUiProvider → HomeShellContent (home-shell.tsx:65)
    → DataModeProvider (home-shell.tsx:79)
      ├─ GuestImportOnMount / MergeSuccessOverlayMount / FirstRunOverlay
      └─ <main id="home-shell-main"> (home-shell.tsx:91-93)
         └─ <div class="container ... lg:max-w-7xl"> (home-shell.tsx:95)
            ├─ OfflineBanner
            ├─ <header> (home-shell.tsx:97-109): HomeHeroSprig, app name h1,
            │     purposeHeader p (S-40 5-second purpose test), tagline p
            ├─ GuestBanner (guest only)
            └─ PomodoroDashboard (home-shell.tsx:111)
```
`PomodoroDashboardBody` root DOM order (`pomodoro-dashboard.tsx:830-1050`):
1. Error/recovery banner
2. `home-workbench-grid` (`lg:grid lg:grid-cols-[62fr_38fr]`, S-41):
   - `home-primary-region` (steering/nextFocus/timer/suggestion/kickoff/archive)
   - `home-inventory-zone` (desktop-only, currently empty)
   - `home-secondary-region` (status lines, timer/steering secondary, override ack, focus-budget prompt `lg:hidden`, **`recapPanel` mobile fallback `lg:hidden`**, task inventory/archive)
   - `home-context-rail` (desktop-only: illustration → **`recapPanel`** → `HomeFocusSummary`, capped at exactly 3 blocks per S-41)
3. Overlay/gate stack (mid-cycle prompt, cycle-complete, permission prompts, closure/check-in/wind-down/end-session overlays)

**Existing `DailyRecapPanel` placement**: rendered twice, CSS-gated (`lg:hidden` mobile copy in secondary region vs. desktop copy in context rail), gated on `dataMode === "authenticated"` and `moduleVisible("recap")` from `deriveHomeSessionState` (`src/lib/home/home-session-state.ts`) — hidden entirely during `active_work` state. Collapsed by default (`last24Expanded`/`todayExpanded` both `useState(false)`, changed to default-collapsed by S-40). This panel is **not** currently "one collapsed line" — it's a card with a title bar plus two independently-toggled sub-sections; the card chrome is always visible when shown (not a single summary line).

**S-40 (`home-ia-reset`)** and **S-41 (`desktop-calm-workbench`)** explicitly reserved but did not consume the namespace:
- S-40 plan.md: *"No new recap/day-memory narrative for S-42; do not use `DayMemory.*` here."*
- S-41 plan.md: *"Use the existing S-30 `DailyRecapPanel` collapsed state in the rail; do not consume `DayMemory.*`. `DayMemory.*` is reserved for S-42."* / *"No S-42 `DayMemory.*` namespace consumption and no S-43 stateful illustration logic."*
- Neither plan specifies an exact DOM slot for S-42 — placement is left to this slice's own plan.

**Reusable disclosure pattern** (no Radix/shadcn in `package.json`; hand-rolled):
- `SectionToggle` — `daily-recap-panel.tsx:39-65` — `<button aria-expanded aria-controls data-testid>` with rotating chevron, `useState` boolean, conditional detail render.
- Sibling: rationale expander in `task-suggestion-card.tsx:172-179`.

**"No scroll, no log" layout reality**: `main` uses `min-h-screen flex flex-col items-center justify-center` (home-shell.tsx:92) — page **can** scroll if content exceeds viewport (no scroll-lock exists today); "no scroll" is a UX goal S-42 must achieve through placement/sizing, not an existing constraint. Everything below the primary region already risks pushing past typical viewport heights (this is why S-40 demoted recap to collapsed/secondary and S-41 moved it into a rail). **Implication**: the S-42 one-line element most plausibly belongs in or near the header/purpose area (`home-shell.tsx:97-109`) or the very top of the primary region — not inside the existing (already secondary/rail-demoted, `lg:hidden`-duplicated) `DailyRecapPanel` slot, and not the `home-context-rail` (invisible below `lg`, already capped at 3 blocks).

**Tests to extend/not break**:
- `e2e/daily-work-timing-recap.spec.ts:70-93` — recap panel visibility/toggle; does not assert page order, but documents the dual-DOM-copy behavior.
- `src/app/_components/pomodoro-dashboard.test.tsx` — structural oracles for `home-primary-region`/`home-secondary-region`/`home-workbench-grid`/`home-context-rail` (including the "rail max 3 blocks" invariant) that any new S-42 DOM insertion must respect or extend.
- `src/app/_components/daily-recap-panel.test.tsx`, `src/app/_components/home-shell.test.tsx` — collapsed-first-paint and purpose-header assertions.
- No existing spec asserts "no scroll" pixel-wise — S-42's plan should introduce a structural (not pixel-based) oracle for this, consistent with S-41's "no pixel assertions in jsdom" precedent.

## Code References

- `src/lib/recap/types.ts:1-29` — `DailyRecap`, `RecapTaskRow`, `TodayPlanRow`, `TaskFootprint` types
- `src/lib/recap/build-daily-recap.ts:19-100` — authenticated recap builder (Prisma), sort order, footprint aggregation
- `src/lib/recap/build-daily-recap.ts:150-215` — `buildFootprints()`
- `src/lib/recap/compute-cycle-focused-minutes.ts:9-27` — minute-rounding helper
- `src/lib/guest/recap.ts:16-79` — pure guest recap builder (mirrors DB builder shape)
- `src/server/api/routers/recap.ts` — sole `recap.getDaily` tRPC procedure
- `src/hooks/use-daily-recap.ts:63-108` — client hook (auth + guest branching)
- `src/app/_components/daily-recap-panel.tsx` — existing S-30 panel, collapsed-by-default sections, `SectionToggle` (lines 39-65)
- `messages/en.json:331-336`, `messages/pl.json:331-336` — `DayMemory.*` catalog (fully populated)
- `src/lib/session/narrative-copy.ts:119-147` — `dayMemoryT`, `getDayMemorySectionDone/Remains/ReturnTo`, `buildDayMemoryCollapsedLine`, `DayMemoryCollapsedInput`
- `src/lib/voice/acceptance-copy.test.ts:72-112` — F-14 DayMemory acceptance test pattern (exact-string + 120-char budget)
- `src/i18n/create-translator.ts:23-39` — `createNamespaceTranslator` wrapper over next-intl
- `prisma/schema.prisma:79` — `Task.resumeNote`
- `prisma/schema.prisma:103-123` — `Session` model, `lastFocusedTaskId`, `closureLine`
- `prisma/schema.prisma:30-35` — `CycleState` enum (`RUNNING/PAUSED/COMPLETED/INTERRUPTED`)
- `src/server/api/lib/session-end-metadata.ts:15-48` — `resolveLastFocusedTaskId` (interruption-aware)
- `src/lib/session/return-handoff.ts:62-105` — `resolveContinueTaskId`, `pickHandoffTaskContext` (best reuse target for "Wróć tutaj")
- `src/hooks/use-pomodoro-cycle.ts:471-495,3015-3039` — `continueTaskId` derivation; resume-note write path
- `src/server/api/routers/task.ts:14,87,141,180-189` — resume-note write/clear mutation logic
- `src/app/page.tsx:8-35` — home page server component, prefetch list
- `src/app/_components/home-shell.tsx:65-118` — provider/shell composition, header with purpose test
- `src/app/_components/pomodoro-dashboard.tsx:830-1050` — dashboard body DOM order, workbench grid, `recapPanel` placement (lines 784-791, 809, 896-898)
- `src/lib/home/home-session-state.ts` — `deriveHomeSessionState`, module visibility priorities including `recap`

## Architecture Insights

- **Formatter-first pattern is already the house style.** F-14 shipped pure copy-accessor functions ahead of any UI consumer (`narrative-copy.ts`), and S-18 shipped pure composition helpers (`return-handoff.ts`) that are reused across suggestion cards, task rows, and closure narrative. S-42 should follow the same shape: a pure `format-day-memory.ts` taking already-fetched data (recap + task list + session-end/continue info) and returning display-ready strings, with all i18n calls delegated to the existing `narrative-copy.ts` functions.
- **Two "recap-shaped" data sources with different interruption visibility must be reconciled.** `DailyRecap` is COMPLETED-cycle-only; `Session.lastFocusedTaskId` / `return-handoff.ts` helpers are interruption-aware. The formatter needs both as inputs — this is a design decision for `/10x-plan`, not an unknown to leave open, since the acceptance criterion explicitly requires interruption-awareness.
- **Guest/auth parity is solved today via dual builders sharing one type** (`DailyRecap`). The same pattern (one pure formatter type, fed by different upstream sources per data mode) should carry into S-42's formatter to resolve the "guest parity" unknown cleanly.
- **Home IA has been deliberately staged across three slices** (S-40 IA reset → S-41 desktop rail → S-42 day memory), each explicit about not touching the next slice's copy namespace. This means S-42 has freedom to choose its own DOM slot (not constrained to reuse `DailyRecapPanel`'s slot) as long as it respects the `home-primary-region`/`home-secondary-region`/`home-context-rail` (3-block cap) test oracles already in place.

## Historical Context (from prior changes)

- `context/archive/2026-06-27-home-ia-reset/plan.md` — introduced `home-session-state.ts`, made `DailyRecapPanel` collapsed-by-default and hidden during active work; explicitly excluded S-42/DayMemory work.
- `context/archive/2026-06-29-desktop-calm-workbench/plan.md` — added the desktop 3-zone grid and context rail (3-block cap); explicitly reserved `DayMemory.*` for S-42.
- `context/archive/2026-06-27-product-voice-contract/change.md` — F-14, shipped `DayMemory.*` copy zone + accessor functions; unlocks S-40/S-41/S-42.
- `context/archive/2026-06-12-task-resume-context-note/plan.md` — S-18 Decision Log: `Task.resumeNote` (persistent, 88% confidence) over separate snapshot table; auto-clear on completion; attach to newly-selected next task on mid-cycle continue.
- `context/foundation/roadmap-references/items/S-30.md` — S-30 outcome text and expand-merge-scope table; distinguishes the still-unbuilt "Phase 2 type-mix line" (P-111, different feature) from S-42.
- `context/foundation/roadmap-references/items/S-42.md` — this slice's roadmap detail; frames S-42 as S-30 Phase 2, names `format-day-memory.ts`, lists non-blocking unknowns (guest parity, footprint coexistence).

## Related Research

- `context/changes/roadmap-ux-ui-story-expand/research.md` — lineage research for the batch-7 UX/UI story chapter that produced S-42 (P-704).

## Open Questions

None blocking. Two implementer-owned unknowns from the roadmap item remain genuinely open for `/10x-plan` to resolve with a concrete design (not further research):

1. **Exact placement of the one-line element** — header/purpose area vs. top of primary region. Research shows both are viable; `/10x-plan` should pick one and add a structural test oracle.
2. **Precise "Wróć tutaj" data composition** — whether to call `resolveContinueTaskId`/`pickHandoffTaskContext` directly, or write a thin S-42-specific wrapper that also folds in `DailyRecap` context for "remains" count consistency. Both stay within the "no new tRPC/Prisma" constraint.

## Decisions made on the skill's behalf (decision-proxy protocol)

Per instruction, no user-facing scope questions were asked; the following calls were made directly from PRD/roadmap/lessons/codebase evidence:

1. **PRD reference confirmed as US-03** ("User plans day with standing tasks and light recap") — cross-checked against `context/foundation/prd-refs.md:18,29,60`, which maps both S-30 and S-42's lineage to US-03. Confidence: 95.
2. **"Wróć tutaj" data source should be `Session.lastFocusedTaskId` + `return-handoff.ts` helpers, not `DailyRecap.footprints`** — because `DailyRecap`'s cycle queries are COMPLETED-only and cannot see interrupted cycles, while `resolveLastFocusedTaskId`/`resolveContinueTaskId` are explicitly interruption-aware (consider RUNNING/PAUSED/most-recent WORK cycle regardless of state). This directly satisfies the acceptance criterion "names the last focused task after interruption" where `DailyRecap` alone cannot. Confidence: 85. Alternative considered: deriving "last focused" purely from `DailyRecap.last24Hours[0]` — rejected because it silently drops interrupted-but-uncompleted work, the exact scenario the acceptance criterion calls out.
3. **New DOM slot for the collapsed one-liner, not reuse of the existing `DailyRecapPanel` slot** — because that panel is demoted to secondary/rail placement and hidden during active work by S-40/S-41 design, which conflicts with "no scroll, no log" visibility on home load. Confidence: 75. Alternative considered: extending `DailyRecapPanel` itself with a summary line — rejected because S-40/S-41 already treat that panel as a detail/log view (raw `title · Xm · timestamp` rows), and the acceptance criteria explicitly want the day-memory to replace that log style, not sit beside it.
4. **Guest parity treated as a real design decision for `/10x-plan`, not deferred indefinitely** — since `DailyRecap` already has full guest/auth parity via `buildGuestDailyRecap`, and `resolveContinueTaskId`/`pickHandoffTaskContext` operate on plain arrays (not Prisma types), a guest-parity formatter is low-cost to include now rather than punt. Recommend `/10x-plan` scope it in unless there's a clear reason not to. Confidence: 65 (this is explicitly marked non-blocking/implementer-decides in the roadmap, so lower confidence is acceptable here).

## Overall confidence for proceeding to planning: 90/100

Rationale: All four research dimensions returned concrete, cross-verified file:line evidence with no contradictions. The data substrate, copy catalog, resume-note/interruption logic, and home composition constraints are all fully mapped, and the two remaining "unknowns" from the roadmap item are explicitly non-blocking and implementer-decided (addressed above with recommended defaults). The only reason this isn't higher is that exact DOM placement and the precise shape of `format-day-memory.ts`'s public API are legitimate design choices for `/10x-plan` to make, not something further research would resolve.

## Blockers

None.
