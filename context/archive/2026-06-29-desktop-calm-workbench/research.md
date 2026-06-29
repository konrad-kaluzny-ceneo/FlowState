---
date: 2026-06-29T13:50:00+02:00
researcher: Cursor (S4 research, /10x-ship-slice-base)
git_commit: 69b177b31fb68f4e39bf5127cc081dfe07bef53b
branch: features/desktop-calm-workbench
repository: FlowState
topic: "S-41 Desktop calm workbench — lg≥1024 three-zone layout (decision column primary, task inventory, context rail ≤3 blocks); collapse to S-40 priority order below 1024px; auth vs guest rail content"
tags: [research, codebase, desktop-layout, responsive, home-ia, pomodoro-dashboard, context-rail, data-mode]
status: complete
last_updated: 2026-06-29
last_updated_by: Cursor (S4 research)
---

# Research: S-41 Desktop calm workbench

**Date**: 2026-06-29T13:50:00+02:00
**Researcher**: Cursor (S4 research, `/10x-ship-slice-base`)
**Git Commit**: 69b177b31fb68f4e39bf5127cc081dfe07bef53b
**Branch**: features/desktop-calm-workbench
**Repository**: FlowState

## Research Question

Produce the S4 research baseline for S-41 (`desktop-calm-workbench`). Outcome: at desktop width
(lg≥1024) the home renders a calm **three-zone workbench** — decision column primary (~60–65%), task
inventory, and a context rail capped at **3 blocks** — while "Co teraz?" stays dominant. Below 1024px
it must collapse to the **S-40 priority order** (single column). Rail content differs for
authenticated vs guest users. Identify the exact files, the S-40 home-IA module API the desktop
layout must consume, current responsive/Tailwind conventions, auth/guest detection, rail data
sources (mode/illustration slot, S-30 recap line, S-27 standing/focus-hours), wedge/timer-hub
constraints, and the test conventions that map acceptance to tests.

## Summary

- **S-41 is a presentation-only slice over the S-40 IA.** S-40 already shipped the pure derivation
  `deriveHomeSessionState` (`src/lib/home/home-session-state.ts`) and a two-region renderer
  (`home-primary-region` / `home-secondary-region`) inside `PomodoroDashboardBody`
  (`src/app/_components/pomodoro-dashboard.tsx:762-833`). S-41 adds a **desktop grid wrapper** around
  those same modules; it must **reuse the existing `homeIa.modules` priority matrix unchanged** and
  only re-distribute already-rendered modules into three columns at `lg`. No new session-state logic.
- **The codebase has ZERO `lg:` (or any responsive breakpoint) usage today.** Grep for `\blg:` across
  `src/` returns no matches. The entire app is single-column mobile-first: `container` on the shell
  (`home-shell.tsx:95`) plus `max-w-lg` on every panel and on `PomodoroDashboardBody`'s root
  (`pomodoro-dashboard.tsx:763`). **S-41 introduces the first responsive desktop breakpoint in the
  product** — there is no existing grid/column primitive to copy. Tailwind is v4 CSS-config
  (`src/styles/globals.css:1` `@import "tailwindcss"`); there is no `tailwind.config.*`, so the
  default `lg = 1024px` breakpoint applies and the slice's `lg≥1024` target is the stock Tailwind
  `lg:` prefix.
- **Two width caps must change for the workbench to widen.** Both `home-shell.tsx:95`
  (`container ... px-4 py-16`) and `pomodoro-dashboard.tsx:763` (`max-w-lg`) clamp content to ~512px.
  A centered 1120–1280px workbench at `lg` requires responsive overrides on **both** (e.g.
  `lg:max-w-[1280px]` on the dashboard root and a wider container at `lg`), plus the inner panels'
  hard-coded `max-w-lg` (recap, focus-budget, guest-banner, etc.) which will visually cap columns
  unless they switch to `w-full` inside their zone.
- **The decision/primary, inventory, and rail map cleanly onto existing module groups.** Decision
  column = `home-primary-region` content (steering / nextFocus / timer); inventory =
  `inventory`/`archive` modules; rail = a NEW third zone that hosts the **secondary context** that
  S-40 currently stacks in `home-secondary-region` (recap, focus-budget, status lines). The
  `HomeLayoutRegion` helper (`pomodoro-dashboard.tsx:83-98`) is the local seam to extend or wrap.
- **Rail content sources already exist; no new data plumbing needed.**
  - **Auth rail (3 blocks):** (1) mode/illustration slot → `HomeHeroSprig`
    (`home-shell.tsx:21,98`; S-43 will make it stateful — define the slot now), (2) collapsed
    day-memory line → the S-30 `DailyRecapPanel` (`daily-recap-panel.tsx`) already collapsed-by-paint
    from S-40, (3) standing/focus-hours summary → S-27 `useDayPlan` (`src/hooks/use-day-plan.ts`) +
    `FocusBudgetPrompt` (`focus-budget-prompt.tsx`) + standing-task facts (`isDailyStanding`/
    `doneForToday` on tasks, surfaced in recap `todayPlan`).
  - **Guest rail (3 blocks):** (1) sign-in value prop + (2) activation/merge hint → `GuestBanner`
    (`guest-banner.tsx`, `Guest.banner.*` catalog), (3) calm empty-state guidance →
    `EmptyTasks.guest` copy (`messages/en.json:377`). Guest mode has **no** day-plan/recap server
    data, so the rail must show sign-in/activation content, **not** empty persisted-data panels
    (explicit acceptance).
- **`touches_timer_hub` is TRUE only via `pomodoro-dashboard.tsx`.** That file is on the AGENTS.md
  timer-hub list, so **`pnpm change-impact` must run before editing it**. S-41 does **not** touch
  `src/hooks/use-pomodoro-cycle.ts` or `src/lib/wedge/**`, and must keep all wedge overlays
  (`pomodoro-dashboard.tsx:835-975`) outside the new grid — they are fixed/absolute, conductor-owned,
  and governed by the transition-beat mutex (≤1 interstitial + 1 gate). Layout is not a transition
  beat; the wedge dismiss matrix (test-plan §6.10) is not in scope unless code reaches gate logic.
- **Cheapest test layer is component (RTL), reusing the S-40 region oracles.** The existing matrix in
  `pomodoro-dashboard.test.tsx` asserts module membership in `home-primary-region` /
  `home-secondary-region` (`:1047-1258`). S-41 adds desktop-zone oracles (rail testid, ≤3 blocks,
  rail content per mode, "one dominant CTA" preserved) at the component layer. jsdom cannot observe
  CSS grid widths/breakpoints, so width/%-split is **structural** (zone membership + class
  presence), not pixel-measured. **No new belt e2e is justified** — this is layout over unchanged
  behavior (test-plan §1 #5, §7).

## Detailed Findings

### Home / dashboard composition (where zones render today)

- **Route entry**: `src/app/page.tsx` — server component; resolves auth and (authenticated)
  prefetches `task.list` / `cycle.getActive` / `recap.getDaily`, then renders `HomeShell`.
- **Page chrome / outer width cap**: `src/app/_components/home-shell.tsx`.
  - `HomeShell` → `OnboardingProvider` → `GuestMergeUiProvider` → `HomeShellContent`
    (`home-shell.tsx:118-130`).
  - `HomeShellContent` renders `<main id="home-shell-main">` (`:91-94`) → a centered
    `<div className="container flex flex-col items-center justify-center gap-8 px-4 py-16">`
    (`:95`) containing: `OfflineBanner` (`:96`) → `<header>` with `HomeHeroSprig` + `appName` +
    `home-purpose-header` ("Co teraz?") + `tagline` (`:97-109`) → guest banner (guest only, `:110`)
    → `<PomodoroDashboard/>` (`:111`).
  - **`mode` is derived here**: `const mode = isAuthenticated ? "authenticated" : "guest"`
    (`:73`) and passed to `DataModeProvider` (`:79`). This is the auth/guest source of truth for the
    rail variant. `HomeHeroSprig` (`:98`) is the **mode/illustration slot** (S-43 dependency).
- **Module owner / inner width cap**: `src/app/_components/pomodoro-dashboard.tsx`.
  - `PomodoroDashboard` (`:1046`) branches on `useDataMode()` → `GuestPomodoroDashboard` (`:1029`,
    no gates) or `AuthenticatedPomodoroDashboard` (`:980`, Suspense, enables
    `enableCheckInGate / enableSuggestionGate / enableWindDownGate`, supplies `dayPlan`).
  - Both render `PomodoroDashboardBody` (`:100`). Its root is
    `<div className="flex w-full max-w-lg flex-col items-center gap-8">` (`:763`) — **this `max-w-lg`
    is the inner width cap S-41 must widen at `lg`.**
  - **Two render regions already exist** (S-40):
    - `HomeLayoutRegion testId="home-primary-region"` (`:792-799`): steering (primary), kickoff
      duration chips, timer (primary), break-suggestion card, kickoff-suggestion card, archive
      (primary). This is the **decision column** content.
    - `HomeLayoutRegion testId="home-secondary-region"` (`:801-833`): status lines, timer
      (secondary), steering (secondary), override-ack, `FocusBudgetPrompt` (`:815-823`),
      `DailyRecapPanel` (`:824-830`), task inventory (secondary), archive (secondary). This is the
      **inventory + context** content that S-41 splits into inventory column + rail.
  - `HomeLayoutRegion` (`:83-98`) is a thin `flex w-full flex-col items-center gap-8` wrapper keyed
    by testid — the natural seam to add a desktop grid parent and a third `home-context-rail` region.
  - Wedge overlays and end-session controls follow the regions (`:835-975`) — fixed/absolute,
    conductor-owned; **keep outside any grid**.

### S-40 home-IA module — the API S-41 must consume

- **File**: `src/lib/home/home-session-state.ts`. Pure, side-effect-free.
- **Exports**: `HOME_MODULE_KEYS` (`:3-13`), `HomeModuleKey`, `HomeModulePriority`
  (`"primary"|"secondary"|"hidden"`), `HomeSessionState`
  (`"idle"|"steering"|"active_work"|"break"|"returning"`), `HomeModulePriorities` (Record),
  `DeriveHomeSessionStateInput` (`:26-44`), `DeriveHomeSessionStateOutput`
  (`{ state, modules }`, `:46-49`), and `deriveHomeSessionState(input)` (`:320-327`).
- **Module keys** (`:3-13`): `purposeHeader`, `timer`, `nextFocus`, `steering`, `recap`,
  `inventory`, `archive`, `statusLine`, `returnBanner`.
- **Consumption today**: `pomodoro-dashboard.tsx:489-533` builds the input and memoizes
  `homeIa = deriveHomeSessionState(...)`; helpers `moduleInZone(key, zone)` (`:535`) and
  `moduleVisible(key)` (`:537`) drive which region each module renders in.
- **Design implication for S-41**: the priority matrix is **layout-agnostic** (S-40 research Open
  Q#4 explicitly preserved this for S-41). The desktop layout reads the same `homeIa.modules` map and
  only changes the **physical placement** (which CSS grid column) per priority — it does **not** add a
  sixth state, change priorities, or add module keys. Decision: keep `deriveHomeSessionState`
  untouched; introduce the desktop zone mapping in the renderer (or a small pure
  `zone → grid-area` helper) so it stays testable.

### Responsive / Tailwind conventions (today: none) and layout primitives

- **No breakpoints anywhere.** `rg "\blg:"` over `src/` = 0 matches. No `md:`/`xl:`/`sm:` grid usage
  for layout. The app is uniformly single-column.
- **Tailwind v4, CSS-config**: `src/styles/globals.css:1` `@import "tailwindcss"`; `@theme { … }`
  defines design tokens (`:3-63`) and dark overrides (`:66-115`). **No `tailwind.config.*` file**, so
  Tailwind defaults hold → `lg` = `1024px` (matches the slice's `lg≥1024` requirement directly).
- **Width primitives in use**: `container` (`home-shell.tsx:95`) and `max-w-lg` (dashboard root +
  every panel: `daily-recap-panel.tsx:128`, `focus-budget-prompt.tsx:83`, `guest-banner.tsx:11`,
  `home-shell.tsx:56` offline banner, status lines `pomodoro-dashboard.tsx:587,597,809`). Centering
  via `items-center justify-center` on `main` (`home-shell.tsx:92`) and the inner `container`.
- **Shell theming hooks** keyed off `#home-shell-main` data-attributes (`globals.css:162-182`:
  `data-break-atmosphere`, `data-work-focus-shell`). The desktop grid must not break these selectors
  — keep `id="home-shell-main"` on `<main>` and the atmosphere classes intact.
- **Implication**: S-41 must (a) widen the shell container and the dashboard root at `lg`
  (e.g. `lg:max-w-[1280px]`), (b) introduce a `lg:grid lg:grid-cols-[…]` parent that is `flex-col`
  (current behavior) below `lg`, and (c) relax inner `max-w-lg` panels to `w-full` within their zone
  so they fill the wider columns. This is net-new responsive infrastructure; there is no existing
  grid component to extend.

### Auth vs guest detection and rail data sources

- **Auth/guest source**: `home-shell.tsx:73` (`mode`) → `DataModeProvider mode={mode}`
  (`data-mode-context.tsx:28`); read anywhere via `useDataMode()`
  (`data-mode-context.tsx:164-166`). Inside the dashboard, `dataMode` is recomputed from
  `onboardingScope.mode` (`pomodoro-dashboard.tsx:171-172`) and already fed to
  `deriveHomeSessionState` (`:493`). The rail variant should branch on the same `dataMode`.
- **Auth rail block sources**:
  - **(1) mode/illustration slot** → `HomeHeroSprig` (`src/lib/design/illustrations/home-hero-sprig`,
    used at `home-shell.tsx:98`). Today it's a static header illustration; S-43
    (`stateful-illustration-system`) will bind it to session state. S-41 should **define a rail
    illustration slot** (the S-41↔S-43 parallelization point per roadmap `roadmap.md:96,158`) without
    implementing stateful art.
  - **(2) collapsed day-memory line** → S-30 `DailyRecapPanel` (`daily-recap-panel.tsx`), already
    collapsed-on-first-paint since S-40 (`:75-76` both sections default `false`). Fed by
    `useDailyRecap()` (`pomodoro-dashboard.tsx:164-168`). **Note:** the `DayMemory.*` catalog
    namespace (`messages/en.json:322-327`, incl. `collapsedLine`) is **reserved for S-42
    (`mindful-day-memory`, still `proposed`)** — do NOT consume it in S-41 (S-40 plan explicitly
    forbids `DayMemory.*`; product-voice keeps S-30 recap and S-42 day-memory separate). S-41's
    "day-memory line" = the existing collapsed S-30 recap.
  - **(3) standing/focus-hours summary (S-27)** → `useDayPlan()` (`src/hooks/use-day-plan.ts:9-67`)
    returns `budgetMinutes/remainingMinutes/usedMinutes/hasBudget`; surfaced via `FocusBudgetPrompt`
    (`focus-budget-prompt.tsx`). Standing-task facts (`isDailyStanding`, `doneForToday`) live on
    tasks and appear in recap `todayPlan` rows (`daily-recap-panel.tsx:93-109`, `Recap.todayDailyTag`
    / `Recap.todayDoneTag`). `useDayPlan` is **auth-only** (`use-day-plan.ts:12` `enabled = mode ===
    "authenticated"`) — reinforces that this block is auth-only.
- **Guest rail block sources**:
  - **(1) sign-in value prop + (2) activation/merge hint** → `GuestBanner` (`guest-banner.tsx`,
    `Guest.banner.deviceOnly/signIn/or/signUp/saveAcrossDevices`). Currently rendered once in the
    shell header for guests (`home-shell.tsx:110`); S-41 can relocate/duplicate this content into the
    rail at `lg` (decide: move vs. keep header + add rail block).
  - **(3) calm empty-state guidance** → `EmptyTasks.guest` (`messages/en.json:377`); the empty active
    list already renders `EmptyActiveTasksGuide` inside `TaskList`. Rail guidance is copy-only and
    must avoid persisted-data panels (no recap/day-plan in guest).

### Wedge / transition-beat constraints (AGENTS.md)

- **Timer-hub touch**: editing `pomodoro-dashboard.tsx` triggers the AGENTS.md maintainer rule →
  **run `pnpm change-impact` before the edit** (advisory test selection). S-41 does **not** edit
  `src/hooks/use-pomodoro-cycle.ts` or `src/lib/wedge/**`.
- **Transition beat rules** (AGENTS.md "Wedge domain rules"; user-flow T-01–T-05): at most one
  interstitial + one gate; new surfaces only via F-07 conductor. **A responsive layout is not a
  transition beat** — it re-flows persistent modules, not overlays. Constraint for S-41: keep all
  wedge overlays (`pomodoro-dashboard.tsx:835-975`) and end-session controls **outside** the desktop
  grid; do not fold conductor-owned overlays into zones (mirrors the S-40 rule that the priority
  matrix governs inline modules only). No new gates/overlays in this slice.

### Test conventions (component + e2e) and acceptance mapping

- **Component (canonical S-40 oracle)**: `src/app/_components/pomodoro-dashboard.test.tsx` already
  asserts zone membership: `countEnabledPrimaryCtas()` over `home-primary-region` (`:1048-1054`),
  `expectInsideRegion("home-primary-region"|"home-secondary-region", testId)` (`:1061+`),
  `expectOutsidePrimaryRegion(testId)` (`:1056-1059`). S-40 scenarios cover idle/returning/active
  work/break/steering/archive (`:1116-1258`). **S-41 extends this file** with desktop-zone oracles:
  a `home-context-rail` testid, "rail ≤3 blocks", rail content per `dataMode` (auth vs guest), and
  "one dominant CTA preserved" in the decision column at `lg`.
- **Shell component**: `src/app/_components/home-shell.test.tsx` mocks dashboard + asserts
  `home-purpose-header` (`:135-157`). Pattern for any rail content that moves into the shell.
- **§6.9 decision tree**: dashboard is a "composite with hook side effects" → `vi.mock` hooks at
  nearest boundary, assert DOM + structure. **jsdom does not compute CSS grid / media queries**, so
  S-41 oracles must be structural (zone membership, block count, class presence) — not pixel widths.
- **Test-plan risk posture**: S-41 maps to no top-12 risk directly; nearest is the §1 #5 belt-vs-
  component rule and §7 negative space (no belt e2e for layout-only regressions). Keep
  `task-list.test.tsx` (`src/app/_components/task-list.test.tsx`) green to prove inventory survives
  demotion to a column. E2E exemplar `e2e/seed.spec.ts` unchanged.
- **Expected targeted command** (cheapest blast radius):
  `pnpm exec vitest run src/lib/home/home-session-state.test.ts src/app/_components/pomodoro-dashboard.test.tsx src/app/_components/home-shell.test.tsx src/app/_components/task-list.test.tsx src/app/_components/daily-recap-panel.test.tsx`

## Code References

- `src/app/_components/home-shell.tsx:73` — auth/guest `mode` derivation (rail-variant source)
- `src/app/_components/home-shell.tsx:95` — outer `container` width cap to widen at `lg`
- `src/app/_components/home-shell.tsx:97-109` — header "Co teraz?" `home-purpose-header` + `HomeHeroSprig` illustration slot
- `src/app/_components/pomodoro-dashboard.tsx:83-98` — `HomeLayoutRegion` seam for zones
- `src/app/_components/pomodoro-dashboard.tsx:489-538` — `deriveHomeSessionState` consumption + `moduleInZone`/`moduleVisible`
- `src/app/_components/pomodoro-dashboard.tsx:763` — dashboard root `max-w-lg` (inner width cap to widen at `lg`)
- `src/app/_components/pomodoro-dashboard.tsx:792-799` — `home-primary-region` (decision column content)
- `src/app/_components/pomodoro-dashboard.tsx:801-833` — `home-secondary-region` (inventory + rail-candidate context)
- `src/app/_components/pomodoro-dashboard.tsx:835-975` — wedge overlays / end-session (keep OUT of grid)
- `src/lib/home/home-session-state.ts:3-49,320-327` — module keys + `deriveHomeSessionState` API
- `src/lib/data-mode/data-mode-context.tsx:28-166` — `DataModeProvider` / `useDataMode`
- `src/hooks/use-day-plan.ts:9-67` — S-27 standing/focus-hours (auth-only) rail data
- `src/app/_components/focus-budget-prompt.tsx` — focus-hours budget UI
- `src/app/_components/daily-recap-panel.tsx:75-76,122-195` — S-30 recap, collapsed-by-paint (rail "day-memory line")
- `src/app/_components/guest-banner.tsx` — guest sign-in value prop / activation hint (rail blocks 1–2)
- `messages/en.json:316-380` — `Home` / `DayMemory` (S-42 reserved) / `Recap` / `EmptyTasks` namespaces
- `src/styles/globals.css:1,162-182` — Tailwind v4 import; `#home-shell-main` atmosphere selectors to preserve
- `src/app/_components/pomodoro-dashboard.test.tsx:1047-1258` — region-membership oracle to extend for rail
- `src/app/_components/home-shell.test.tsx:135-157` — purpose-header / shell render pattern

## Architecture Insights

- **House style = pure derivation + thin renderer.** S-40 already factored IA into a pure module; S-41
  should keep the same separation — the grid is a renderer concern; the priority matrix stays pure and
  layout-agnostic. If a "which zone" mapping is non-trivial, extract a tiny pure helper
  (`module-priority + viewport-intent → zone`) so it is unit-testable, mirroring `work-focus-shell.ts`.
- **First responsive surface in the product.** There is no grid primitive to reuse; S-41 sets the
  convention (`lg:` prefix, centered max-width, `flex-col` → `grid` at `lg`). Document the chosen
  width and column ratio so S-42/S-43 follow it.
- **Rail is a re-flow, not new data.** Every rail block already has a data source and a component; the
  slice is composition + responsive CSS, not new hooks/queries. This keeps it off the timer hub's
  behavior and out of the wedge mutex.
- **Guest vs auth asymmetry is structural.** `useDayPlan`/recap are auth-only; the guest rail is
  copy/CTA only. The branch already exists (`dataMode`) — reuse it rather than inventing guest stubs.

## Historical Context (from prior changes)

- `context/archive/2026-06-27-home-ia-reset/plan.md` — S-40 plan; explicitly defers desktop layout to
  S-41 ("No desktop three-zone workbench; S-41 owns `lg >= 1024`", `:54`) and keeps the derivation
  layout-agnostic for reuse.
- `context/archive/2026-06-27-home-ia-reset/research.md:312-326` — S-40 Open Questions #4 (desktop
  layout owned by S-41; keep matrix layout-agnostic — confirmed) and #2 (zone-wrapper vs in-place;
  S-40 chose `HomeLayoutRegion` wrappers, which S-41 extends).
- `context/foundation/roadmap.md:94,156,202` — S-41 row, "desktop web layout only", hard dep S-40
  (shipped PR #181); `:96,158` S-43 may parallel S-41 once the rail illustration slot exists.
- `context/foundation/product-voice.md` (F-14) — `Home.purposeHeader` shipped; "header is not a hero
  rewrite — hierarchy + dominant CTA are the layout slice's job"; recap (S-30) vs day-memory (S-42)
  kept separate (constrains rail block 2 to S-30 recap, not `DayMemory.*`).

## Related Research

- `context/archive/2026-06-27-home-ia-reset/research.md` — IA ownership, module map, returning-state
  (no banner), pure-helper pattern — the direct predecessor baseline for this slice.
- `context/changes/roadmap-ux-ui-story-expand/research.md` — Stream R UX/UI story chapter source
  (expand batch 7 / P-702).
- `context/foundation/test-plan.md` §1 #5, §6.9 (component decision tree), §6.11 (S-30 recap cookbook).

## Decisions (evidence-based; never asked the user)

| Decision | Choice | Rationale / evidence | Confidence |
| --- | --- | --- | --- |
| Reuse S-40 IA matrix | Consume `deriveHomeSessionState` unchanged; map module priority → grid zone in the renderer (optionally a tiny pure `zone` helper) | S-40 left the matrix layout-agnostic for S-41 (research Open Q#4); house style is pure derivation + thin renderer | High |
| Breakpoint | Use stock Tailwind `lg:` (=1024px); no config change | No `tailwind.config.*`; v4 defaults give `lg=1024` = slice target | High |
| Collapse strategy | Mobile-first single column (current S-40 stack/regions) is the default; apply `lg:grid` three columns only at `lg`. Below `lg`, render exactly today's `home-primary-region`→context→`home-secondary-region` order | Acceptance: "below 1024px collapses to S-40 priority order"; zero existing breakpoints means additive `lg:` classes leave mobile untouched | High |
| Width cap | Center a ~1120–1280px workbench: add `lg:max-w-[1280px]` (and relax inner `max-w-lg`→`w-full` in zones) on dashboard root + widen shell `container` at `lg` | Both `home-shell.tsx:95` and `pomodoro-dashboard.tsx:763` clamp to ~512px today; acceptance wants 1120–1280 centered | High |
| Column ratio | Decision column ~60–65%; rail ≤~40% (hard cap) and ≤3 blocks; inventory between/below per IA | Acceptance: "decision column visually primary; rail never >~40% width; rail max 3 blocks" | Med (exact grid template = implementer unknown per item card) |
| Rail block 2 (day-memory) | Reuse S-30 collapsed `DailyRecapPanel`; do NOT use `DayMemory.*` (S-42) | S-40 plan forbids `DayMemory.*`; product-voice separates S-30/S-42; S-42 still `proposed` | High |
| Rail illustration slot | Define a static slot reusing `HomeHeroSprig`; leave stateful art to S-43 | Roadmap: S-43 parallels S-41 "once rail slot exists"; item card "parallel with S-43 once rail illustration slot defined" | High |
| Guest rail | Branch on `dataMode`; render sign-in value prop + activation hint (`GuestBanner` content) + `EmptyTasks.guest` guidance; never render empty auth panels | Acceptance: "guest rail shows sign-in/activation content, not empty persisted-data panels"; `useDayPlan` auth-only | High |
| Test layer | Extend `pomodoro-dashboard.test.tsx` region oracles with a `home-context-rail` testid + block-count + per-mode content; structural assertions only (jsdom can't measure grid). No belt e2e | Test-plan §1 #5 / §7; layout-only over unchanged behavior | High |
| Timer-hub procedure | Run `pnpm change-impact` before editing `pomodoro-dashboard.tsx`; keep overlays out of grid; no cycle/wedge edits | AGENTS.md maintainer + wedge-domain rules | High |

## Open Questions (with recommended resolutions)

1. **Exact grid template within the `lg` band** (item-card unknown; owner: implementer, non-blocking).
   *Recommend:* `lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]` or a 12-col split giving decision
   ~62% / rail ~38%, with inventory in the decision column below the fold or as a middle column —
   prototype both; assert structure (zone membership) not pixels in tests.
2. **Inventory placement: middle column vs. stacked under the decision column** (acceptance lists
   three zones but does not pin inventory's grid position). *Recommend:* keep inventory in/under the
   decision column (left/main), rail on the right — preserves S-40's "inventory secondary, not
   co-primary with next focus" and keeps the rail purely contextual.
3. **Guest banner: relocate to rail vs. keep in header AND add rail block** (`home-shell.tsx:110`).
   *Recommend:* at `lg`, render the value-prop/activation content in the rail and suppress the header
   banner to avoid duplication; below `lg`, keep the current header banner. Decide in `/10x-plan`.
4. **Which recap fragment lands in the rail vs decision column** (item-card unknown; owner:
   implementer after S-40). *Recommend:* the collapsed S-30 recap line → rail; footprint rows stay on
   task rows in the inventory (unchanged).
5. **Inner panels' hard `max-w-lg`** (recap/focus-budget/banner) will visually cap a wide rail/column.
   *Recommend:* switch those to `w-full` within their zone at `lg` (keep `max-w-lg` below `lg`); verify
   no regression to `daily-recap-panel.test.tsx` / `focus-budget-prompt` behavior.
6. **Does a wider layout need an e2e/a11y check?** *Recommend:* no new belt row; optionally extend the
   existing `e2e/accessibility.spec.ts` home scan is out of scope — component RTL + structural oracles
   are sufficient per test-plan §1 #5.
