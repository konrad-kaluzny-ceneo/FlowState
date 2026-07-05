# UI Redesign — Align the App with the `makiety` Mockups — Implementation Plan

## Overview

Transform FlowState from a deliberately single-screen SPA (one `/` route, a cycle-phase state machine composing modules on the home dashboard) into the mockups' **5-section, multi-view wellbeing app**: Fokus / Zadania / Plan dnia / Podsumowanie / Ustawienia, reached via a sidebar (desktop) + bottom nav (mobile), with a large **ring timer**, minimal task cards, an analytics dashboard, a settings page, and a **muted-green accent**.

This lands as **one big PR** across **12 internal phases**. Sequencing is **restyle-first, shell-last**: cheap high-payoff token/aesthetic work first; each view built as a self-contained component (temporarily reachable on home); the pivotal **cycle-state lift** (Phase 10) and **nav shell + routes** (Phase 11) land last, wiring finished views together. The app stays runnable and green at every phase boundary.

## Current State Analysis

- **Single content route.** `/` ([src/app/page.tsx](src/app/page.tsx)) → `HomeShell` → `PomodoroDashboard`. No `/tasks`, `/plan`, `/summary`, `/settings`; no nav shell (`AppNavbar` is a brand link + right-side controls only).
- **Home is a state machine, not a dashboard.** `deriveHomeSessionState` ([src/lib/home/home-session-state.ts:155](src/lib/home/home-session-state.ts)) maps cycle state → 5 states (`idle | steering | active_work | break | returning`) and assigns 9 modules to primary/secondary/hidden slots in a 2-col grid ([pomodoro-dashboard.tsx:955](src/app/_components/pomodoro-dashboard.tsx)).
- **Cycle state is page-scoped.** `usePomodoroCycle` ([src/hooks/use-pomodoro-cycle.ts:360](src/hooks/use-pomodoro-cycle.ts), ~3,600 lines, returns 50+ props) is instantiated once in `PomodoroDashboardBody` ([pomodoro-dashboard.tsx:43](src/app/_components/pomodoro-dashboard.tsx)), driven by a Web Worker ([src/workers/timer-worker.ts](src/workers/timer-worker.ts)) + fallback `setInterval`. `DataModeProvider`, `OnboardingProvider`, `GuestMergeUiProvider`, `HomeIllustrationVariantProvider` are all page-scoped under `HomeShell` ([home-shell.tsx:106](src/app/_components/home-shell.tsx)).
- **Timer is numeric, not a ring.** `text-6xl font-mono tabular-nums` ([timer-panel.tsx:152](src/app/_components/timer-panel.tsx)); reads `remainingMs` (a number ticked ~1Hz).
- **Task cards are busy; creation/edit are inline.** `SortableActiveTaskRow` shows chip + urgency + importance + ASAP + effort + daily + persona + custom ([task-list.tsx:274](src/app/_components/task-list.tsx)); create is a top-of-list form ([task-list.tsx:885](src/app/_components/task-list.tsx)); edit is inline `TaskFieldsPanel` ([task-fields-panel.tsx:194](src/app/_components/task-fields-panel.tsx)). Status enum = `active | completed | archived` ([types.ts:26](src/lib/data-mode/types.ts)); two stacked sections, no tabs.
- **Design substrate is close.** Tailwind v4 CSS-first `@theme` tokens ([globals.css:12](src/styles/globals.css)), full light/dark/system engine (shipped toggle), botanical SVG illustration system ([src/lib/design/illustrations/](src/lib/design/illustrations/)), and a modal primitive ([overlay-shell.tsx](src/app/_components/overlay-shell.tsx)) already exist. The accent is **taupe `#736d62`**, not green.
- **Analytics data mostly exists.** `Cycle` rows carry `startedAt`/`endedAt`/`kind`/`taskId` ([prisma/schema.prisma:125](prisma/schema.prisma)); `Task.workType` exists but the recap query selects only `{id,title}` ([build-daily-recap.ts:38](src/lib/recap/build-daily-recap.ts)). Best-time-of-day (multi-day) and per-day history navigation are genuinely net-new.
- **Settings are scattered but relocatable.** Theme (`header-preference-controls`), language (`language-switch` + `use-language-preference`), durations (`duration-storage` via `timer-panel`), out-of-tab break alerts, cycle-end audio — all use scope-aware storage + hooks. The mockup's *auto-start breaks* and *time-format 24h/12h* toggles **do not exist**.
- **Graphics delivered.** All 5 heroes (light + `-dark`) in [public/images/heroes/](public/images/heroes/). No `next/image` usage or `next.config` images block today.
- **Stack.** Next 16 App Router, React 19, tRPC 11, Prisma 7 (Neon), next-intl (pl/en), Biome, vitest + Playwright, lucide-react icons, dnd-kit. Package manager **pnpm**. No chart lib.

## Desired End State

A user lands on **Fokus** (a clean, calm, timer-centric screen with a ring timer), can navigate via sidebar/bottom-nav to **Zadania** (minimal cards, Aktywne/Planowane/Ukończone tabs, add-task modal, detail side panel with a Projekt field), **Plan dnia** (restyled focus-hours budget), **Podsumowanie** (KPI + charts dashboard), and **Ustawienia** (all preferences in one place). The timer keeps ticking across navigation. The whole app wears the muted-green, airy, rounded aesthetic in both light and dark mode. Verified by: all `pnpm test` / `pnpm test:e2e` green, `pnpm build` succeeds, and a manual walkthrough matching the mockups.

### Key Discoveries:

- **Cycle lift is a wrap, not a rewrite.** A layout-level `PomodoroCycleProvider` can call the existing `usePomodoroCycle` hook and expose it via context; the hook's own `renderHook` tests ([use-pomodoro-cycle.test.tsx](src/hooks/use-pomodoro-cycle.test.tsx)) stay valid — only consumers switch to `usePomodoroCycleContext()`.
- **`planned` needs no migration.** Prisma `Task.status` is a free-form `String @default("active")` ([schema.prisma:70](prisma/schema.prisma)); only Zod/enum validators change. `project` needs one trivial `VarChar` column.
- **Analytics is build-to-data.** KPIs + per-hour bars + session-type donut derive from existing `Cycle` timestamps + `Task.workType` (augment the recap query). Best-time + date navigation are deferred/stubbed.
- **Accent retint is one place.** `--color-accent-cta` / `segment-active` / focus-ring tokens in [globals.css](src/styles/globals.css) + `DESIGN.md`.
- **Reusable dismiss-gate pattern exists.** `FocusBudgetPrompt` ([focus-budget-prompt.tsx:22](src/app/_components/focus-budget-prompt.tsx)) is the once-per-day model for the day-start energy/goal gate.

## What We're NOT Doing

- **No timeline / week view / time-blocks** in Plan dnia — it stays a focus-hours **capacity budget** (PRD-compliant; mockup overridden).
- **No net-new settings** — Synchronizacja, Prywatność, backup/restore, delete-all-data, editable user name, **auto-start breaks toggle**, and **time-format 24h/12h** are out (mockup overridden). Settings only **relocates** existing controls.
- **No Podzadania (subtasks), Opis, or general Notatki** on tasks — only the existing `resumeNote` remains; the detail panel adds only **Projekt**.
- **No managed project entity** — `project` is a freeform string with typeahead, not a CRUD entity.
- **No multi-day analytics history or "best time of day" multi-day curve** in this change — Podsumowanie is today-scoped; those are stubbed/deferred.
- **No new photo/tracking backend** beyond the trivial `project` column and the light recap-query augmentation.

## Implementation Approach

Build the aesthetic substrate (tokens, primitives) first, then the two touchy isolated components (ring timer, task model), then each view as a standalone component temporarily hosted on the home screen, then lift cycle state to a provider, then introduce the nav shell + routes that wire everything into its final home, then polish + regression. Every view is authored against the shared primitives and tokens so the shell phase is pure composition, not rework.

## Critical Implementation Details

- **Cycle-lift ordering (Phase 10).** The provider must be mounted **above** every route that renders the timer or reads cycle state, but **below** `TRPCReactProvider`/`ThemeProvider`. `DataModeProvider` moves up with it (the cycle hook depends on data-mode repositories). The Worker/fallback-interval lifecycle must remain a **single instance** — mounting the provider twice would double-tick. Guard with the existing visibility-recalc path ([use-pomodoro-cycle.ts:817](src/hooks/use-pomodoro-cycle.ts)).
- **Wedge/overlay discipline (Phases 6, 10, 11).** Lessons L-"wedge" ([context/foundation/lessons.md](context/foundation/lessons.md)) warns transition/overlay changes regress into dead-ends. The day-start gate (Phase 6) and any nav-driven state transition (Phase 11) each need a **dismiss-oracle test** proving the gate cannot trap the user.
- **Latency contract (L-04).** Each new interactive surface (modal save, nav switch, inline promote-to-active, chart render) needs its own perceived-latency guard, not just a slice-level one.
- **Planned lifecycle fork.** Tasks created in the **Zadania view** default to `planned` and are **excluded from the Fokus suggestion/kickoff pool**; **daily-standing** tasks are created `active`; **focusing/starting** a planned task auto-promotes it to `active`. The `isDailyStanding ? active : planned` default must be written in **three synchronized places** (server router, guest repo, optimistic client — all default to `active` today); miss one and modes diverge.
- **`planned` breaks on read at two enforcement sites the schema change doesn't cover.** The mapper allow-list (`task-mapper.ts:9-13`) **throws in dev** on an unknown DB status; the guest Zod enum (`guest/schema.ts:16`) **silently discards the whole guest snapshot** (data loss) on an unknown status. Both must gain `"planned"` in Phase 4, not just the domain type.
- **Route split must not lock out guests (Phase 11).** Only `/` is guest-public today (`public-paths.ts:6`); `proxy.ts` redirects all other unauthenticated paths to sign-in. All 5 new routes must be added to the guest allow-list (per decision) or the no-account trial regresses.
- **Cycle provider single-mount (Phase 10).** The hook spawns a per-instance Worker and a document `visibilitychange` listener; the provider must mount **exactly once**. It also consumes 4 page-derived props + the auth/guest task source, which must be lifted alongside `DataModeProvider` — this is not a pure context wrap.

---

## Phase 1: Design Tokens & Scale

### Overview

Retint the accent taupe → muted green and move the radius/type/spacing scale toward the airier mockup, in both light and dark, with `DESIGN.md` kept as the source of truth. Highest visual payoff, lowest risk, no data or component structure changes.

### Changes Required:

#### 1. Token retint + scale

**File**: `src/styles/globals.css`

**Intent**: Replace the taupe CTA/active/focus accents with the mockup's muted green, and introduce a radius/type scale so the UI "breathes." Verify the dark `@theme` block gets a parallel retint so dark-mode parity holds.

**Contract**: Edit the light `@theme` tokens ([globals.css:3-67](src/styles/globals.css)) and dark tokens ([globals.css:70-119](src/styles/globals.css)). Retarget the three green targets by their **exact token names**: `--color-accent-cta` (from `#736d62`, plus `--color-accent-cta-hover`/`--color-on-cta`), `--color-segment-active` (**currently the same taupe `#736d62` — must be retinted in the same pass or it mismatches the CTA**), and `--color-focus-ring` (the alias `--color-focus` follows it). Keep the existing semantic greens `--color-accent-break` (`#3d8f82`) and `--color-accent-success` (`#3a8f65`) distinct so break/success semantics don't collide with the new primary.

**Scale — introduce tokens (per decision):** no radius or base-text-size tokens exist today (radii/type are ad-hoc Tailwind utility classes). Add new `--radius-*` and `--text-*` (or equivalent) tokens to the `@theme` block for the airier mockup scale, and migrate the key consumers (cards, timer, task rows) to read them, so the scale has a single source of truth per DESIGN.md. Also retint the one non-tokenized hard-coded color in a touched component: the `bg-red-600 hover:bg-red-500` interrupt button ([timer-panel.tsx:182](src/app/_components/timer-panel.tsx)) → a danger token, since a token-only retint won't reach it. (The only other hex outside `globals.css` is the Google-logo SVG in `google-sign-in-button.tsx` — intentional brand color, leave it.)

#### 2. Canonical spec sync

**File**: `DESIGN.md`

**Intent**: Update the token table + rationale so the doc matches the new accent and scale (DESIGN.md is the canonical spec other work reads).

**Contract**: Update the color/space/type sections; note the taupe→green change and the new scale values.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Lint/format passes: `pnpm check`
- Unit tests pass: `pnpm test`
- Production build succeeds: `pnpm build`

#### Manual Verification:

- Primary CTAs, segmented controls, and focus rings render muted green in light mode.
- Dark mode shows a parallel green with no contrast regressions (buttons, chips, focus rings legible).
- Cards/type feel airier (larger rounding, larger base text) without layout breakage on the existing home screen.

**Implementation Note**: After automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 2: Shared UI Primitives

### Overview

Extract the copy-pasted Button/Segmented patterns into shared primitives and build the two genuinely missing, accessible primitives the redesign needs everywhere: **Tabs** (`role="tablist"`) and **Select/Dropdown** (listbox/menu). Add a small modal-composition helper on the existing `overlay-shell`. No shadcn/Radix — hand-rolled per DESIGN.md.

### Changes Required:

#### 1. Button & SegmentedControl primitives

**File**: `src/app/_components/ui/button.tsx`, `src/app/_components/ui/segmented-control.tsx` (new)

**Intent**: Consolidate the repeated button and segmented-control markup into token-driven primitives with variant props, so tasks/settings/analytics/nav compose from one source.

**Contract**: `Button` supports primary/secondary/ghost/danger variants + size; `SegmentedControl` is a controlled single-select group. Both are keyboard/focus accessible and read only tokens. Refactor `TaskFieldsPanel`'s work-type segmented control ([task-fields-panel.tsx:270](src/app/_components/task-fields-panel.tsx)) to the new primitive as the first consumer/proof.

#### 2. Tabs primitive

**File**: `src/app/_components/ui/tabs.tsx` (new)

**Intent**: Accessible tablist for the Zadania Aktywne/Planowane/Ukończone tabs and settings section nav.

**Contract**: Roving-tabindex `role="tablist"`/`tab`/`tabpanel`, arrow-key navigation, controlled active value. No external dep.

#### 3. Select/Dropdown primitive

**File**: `src/app/_components/ui/select.tsx` (new)

**Intent**: Accessible menu/listbox for the Zadania "Wszystkie typy" filter + "Sortuj" dropdown and settings selects (language, etc.).

**Contract**: Button-triggered popover listbox with keyboard support (Up/Down/Enter/Esc), controlled value, token-driven. No external dep.

#### 4. Modal helper

**File**: `src/app/_components/overlay-shell.tsx` (extend)

**Intent**: A thin composition wrapper over the existing `OverlayScrim`/`OverlayCard` so the add-task modal and future modals share consistent header/footer/focus-trap behavior.

**Contract**: Reuse the existing focus-trap + Esc handling; expose a titled modal shape. No behavior change to current overlay consumers.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Lint/format passes: `pnpm check`
- Unit tests pass (incl. new primitive tests): `pnpm test`
- Accessibility e2e passes: `pnpm test:e2e:a11y`

#### Manual Verification:

- Tabs and Select are fully keyboard-operable (arrows, Enter, Esc) and screen-reader labelled.
- Refactored work-type control in the task editor behaves identically to before.

**Implementation Note**: After automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 3: Ring Timer

### Overview

Replace the numeric mono countdown with a circular SVG ring, driven by the existing `remainingMs` + configured duration. Page-scoped — no state lift yet. This touches the most-tested component, so existing timer/cycle tests must stay green and gain ring coverage.

### Changes Required:

#### 1. Ring timer rendering

**File**: `src/app/_components/timer-panel.tsx`

**Intent**: Render the countdown as the mockup's large central ring with the time and phase label inside, while keeping all start/pause/resume/interrupt controls and their behavior.

**Contract**: Compute `progress = (configuredDurationMs - remainingMs) / configuredDurationMs` and render an SVG ring (stroke-dasharray) tinted with the green accent token; keep the numeric time as the ring's center label ([timer-panel.tsx:151-158](src/app/_components/timer-panel.tsx)). **The total duration is NOT currently a `TimerPanel` prop** — only `remainingMs` is passed ([timer-panel.tsx:47](src/app/_components/timer-panel.tsx), fed from `pomodoro.remainingMs`). Thread the total in as a new prop from `activeCycle.configuredDurationSec` (exposed by the hook) — the panel cannot compute progress without it. No change to the Worker/fallback ticking lifecycle or to `remainingMs` semantics.

**Test/a11y contract to preserve** ([timer-panel.test.tsx](src/app/_components/timer-panel.test.tsx)): keep the `timer-countdown` testid holding the formatted time text; keep testids `timer-panel-idle`/`-running`/`-paused`, `timer-pause`/`-interrupt`/`-resume`; keep the `region` named "Focus timer" and the button labels. **Critical:** the countdown element must remain **without `aria-live`** (the tests assert its absence) — the animated ring must not introduce a live region around the time.

#### 2. Ring component (optional extraction)

**File**: `src/app/_components/ui/progress-ring.tsx` (new)

**Intent**: Reusable ring so Podsumowanie donuts and any future progress visuals share geometry.

**Contract**: Pure presentational SVG ring taking `progress` (0–1), size, stroke, and color-token props.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Lint/format passes: `pnpm check`
- Unit tests pass, incl. `timer-panel.test.tsx` + ring render test: `pnpm test`
- Pomodoro e2e passes: `pnpm test:e2e` (pomodoro-cycle spec)

#### Manual Verification:

- Ring fills smoothly across a work session; center shows remaining time + phase label.
- Pause/resume/interrupt still work and the ring reflects paused state.
- Light + dark ring legibility confirmed.

**Implementation Note**: After automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 4: Tasks Model & Backend (`project` + `planned`)

### Overview

Add the `project` freeform field and the `planned` status value across the model, persistence, and validation layers, and implement the planned lifecycle (planned backlog vs. active daily-standing; focus auto-promotes; planned excluded from suggestions). Backend-first, before any Zadania UI.

### Changes Required:

#### 1. Domain type + guest schema + status enforcement sites

**File**: `src/lib/data-mode/types.ts`, `src/lib/guest/schema.ts`, `src/lib/persistence/prisma/task-mapper.ts`

**Intent**: Extend the domain to carry `project` and the new status — and add `"planned"` at **every** enforcement site, not just the domain type, or planned tasks break on read.

**Contract**: `DomainTaskStatus` gains `"planned"` ([types.ts:26](src/lib/data-mode/types.ts)); `DomainTask` gains `project: string | null` (after `resumeNote`, [types.ts:43](src/lib/data-mode/types.ts)). Also widen the `TaskRepository.update` status union ([types.ts:103](src/lib/data-mode/types.ts)).

**Two enforcement sites the naive change misses (both fail hard):**
- **Mapper allow-list** — `DOMAIN_TASK_STATUSES` ([task-mapper.ts:9-13](src/lib/persistence/prisma/task-mapper.ts)) is a hardcoded `["active","completed","archived"]`; `toDomainTaskStatus` **throws `Unexpected task status from database` in dev** (silently coerces to `active` in prod) for any `planned` row read back. Add `"planned"` here. Map `project` in the mapper too ([task-mapper.ts:27-51](src/lib/persistence/prisma/task-mapper.ts)).
- **Guest Zod enum** — `guestTaskSchema.status` is `z.enum(["active","completed","archived"])` ([guest/schema.ts:16](src/lib/guest/schema.ts)); on a `planned` value `parseGuestSnapshot` **discards the ENTIRE snapshot** (`→ createEmptyGuestSnapshot()`, [schema.ts:162-168](src/lib/guest/schema.ts)) — silent guest data loss. Add `"planned"` to this enum **and** the `GuestTask` TS type ([schema.ts:37](src/lib/guest/schema.ts)). A new optional `project` key is safe (schema strips unknowns; not `.strict()`).

#### 2. Prisma column

**File**: `prisma/schema.prisma`, `prisma/migrations/<new>/migration.sql`

**Intent**: Persist `project`; `planned` needs no schema change (status is free-form String).

**Contract**: Add `project String? @db.VarChar(256)` to the `Task` model; generate a migration `ALTER TABLE ... ADD COLUMN "project" VARCHAR(256)`. No enum/constraint change for status.

#### 3. tRPC task router

**File**: `src/server/api/routers/task.ts`, `src/lib/persistence/prisma/task-mapper.ts`

**Intent**: Accept/return `project`, allow the `planned` status in transitions, and implement default-status + promotion rules.

**Contract**: Add `project` to `create`/`update` inputs; widen `update`'s status enum ([task.ts:134](src/server/api/routers/task.ts), currently `z.enum(["active","completed"])`) to include `"planned"`. Add/extend a promotion path so starting/focusing a task sets `status: "active"` (auto-promote). Keep `reorder`/`markDoneForToday` operating on `active` only. `isDailyStanding` already exists on the create input ([task.ts:89](src/server/api/routers/task.ts)).

**Default-status fork must be written in THREE synchronized places.** `create` sets **no** status today ([task.ts:104-125](src/server/api/routers/task.ts)) — it relies on the DB default `active`. The new rule `status = isDailyStanding ? "active" : "planned"` is a first-time explicit write, and it must be mirrored identically in all three creation paths or guest/optimistic tasks silently diverge to `active`:
- server router `create` ([task.ts:104-125](src/server/api/routers/task.ts));
- guest repo `create` ([guest-repositories.ts:196](src/lib/guest/guest-repositories.ts), currently hardcodes `status: "active" as const`);
- optimistic client `buildOptimisticCreateRow` ([use-task-mutations.ts:86](src/app/_components/use-task-mutations.ts), hardcodes `status: "active"`).

#### 4. Suggestion-pool exclusion (five filter sites + one leak)

**File**: `src/lib/suggestion/build-suggestion-pool.ts`, `src/server/api/routers/suggestion.ts`, `src/lib/guest/recap.ts`, `src/hooks/use-pomodoro-cycle.ts`

**Intent**: Ensure `planned` tasks never surface as Fokus suggestions/kickoff candidates until promoted.

**Contract**: The pool is filtered to `status === "active"` in several places — since the filter is *inclusive of active only*, `planned` is excluded for free at the server pool ([build-suggestion-pool.ts:48-56](src/lib/suggestion/build-suggestion-pool.ts), which also powers recap's todayPlan via [build-daily-recap.ts:75](src/lib/recap/build-daily-recap.ts)), the ownership re-check ([suggestion.ts:128](src/server/api/routers/suggestion.ts),`:135`), and the guest path ([guest/recap.ts:86](src/lib/guest/recap.ts)). **The one real leak:** `taskPoolHasKickoffCandidates` ([use-pomodoro-cycle.ts:144-156](src/hooks/use-pomodoro-cycle.ts)) gates the kickoff wedge with `status === "active" || task.isDailyStanding` — a `planned` **and** `isDailyStanding` task would slip through the `|| isDailyStanding` branch. Per this plan's lifecycle daily-standing tasks are created `active`, so this shouldn't occur — but the invariant is implicit; add a test asserting a `planned` daily-standing row (if constructible) never enters kickoff, or tighten the branch.

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly: `pnpm db:migrate`
- Type checking passes: `pnpm typecheck`
- Lint/format passes: `pnpm check`
- Unit + router tests pass (task.ts, guest schema, mutations): `pnpm test`

#### Manual Verification:

- Creating a task in a normal flow yields `planned`; a daily-standing task yields `active`.
- Focusing/starting a planned task promotes it to `active`.
- A `planned` task never appears as a focus suggestion until promoted.
- Existing tasks (all `active`) are unaffected after migration.
- A `planned` task round-trips through the mapper without throwing, and a guest snapshot containing a `planned` task loads without being silently dropped.

**Implementation Note**: After automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 5: Zadania View

### Overview

Build the standalone Zadania view: minimal chip+effort cards, Aktywne/Planowane/Ukończone tabs, an add-task **modal**, and a task **detail side panel** exposing existing fields + the new Projekt (typeahead). Temporarily hosted on the home screen (behind a nav placeholder) until the shell lands.

### Changes Required:

#### 1. Minimal task cards

**File**: `src/app/_components/task-list.tsx`

**Intent**: Reduce the busy row to the mockup's single type-chip + effort, moving urgency/importance/ASAP/daily/persona detail into the detail panel.

**Contract**: Restyle `SortableActiveTaskRow` ([task-list.tsx:274](src/app/_components/task-list.tsx)); `TaskBadges` ([task-list.tsx:103](src/app/_components/task-list.tsx)) renders only the work-type chip + effort on the card. Keep drag handle, complete checkbox, focus, and delete affordances. Preserve dnd-kit reorder.

#### 2. Tri-tab sectioning

**File**: `src/app/_components/task-list.tsx` (or new `zadania-view.tsx`)

**Intent**: Replace the two stacked sections with Aktywne/Planowane/Ukończone tabs.

**Contract**: Use the Tabs primitive; filter `active`/`planned`/`completed` ([task-list.tsx:639](src/app/_components/task-list.tsx)); tab counts in labels ("Aktywne 5"). "Wszystkie typy" filter + "Sortuj" dropdown use the Select primitive (pure-UI, optional-but-in-scope per the mockup).

#### 3. Add-task modal

**File**: `src/app/_components/add-task-modal.tsx` (new), wired from Zadania

**Intent**: Replace the always-open inline create form with a "➕ Dodaj zadanie" button that opens a modal (name, type, effort, priority, project).

**Contract**: Build on the Phase-2 modal helper; on submit call the existing `create` mutation (status defaults to `planned`). Keep the inline "Dodaj zadanie / lub naciśnij Enter" quick-add affordance shown in the mockup as a secondary path.

**Deviation (intentional, post-implementation):** the modal-opening control is a gear icon (`Settings2`) button next to the quick-add `+`, not a visible "➕ Dodaj zadanie" label — layout is `[input] [+] [⚙]`. Opening the gear seeds the modal's title field with whatever text is currently in the quick-add input (and clears that input), so a partially-typed quick-add task can be "upgraded" into the full form without retyping the title. Requested and confirmed by the user on 2026-07-05; `addTaskButton` i18n key now holds the gear button's `aria-label` copy instead of visible button text.

#### 4. Detail side panel

**File**: `src/app/_components/task-detail-panel.tsx` (new), reusing `TaskFieldsPanel`

**Intent**: Clicking a task opens a right-side detail panel (status pill, title, type, effort, priority, Projekt, resumeNote) with a "Rozpocznij pracę nad tym zadaniem" action.

**Contract**: Reuse `TaskFieldsPanel` fields ([task-fields-panel.tsx:194](src/app/_components/task-fields-panel.tsx)); add a `project` typeahead input (suggest over previously-used project names from the current task list). The start action promotes `planned`→`active` (Phase 4 path) and focuses the task. **No** subtasks/opis/notatki.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Lint/format passes: `pnpm check`
- Unit tests pass (task-list, fields-panel, new modal/detail tests): `pnpm test`
- Accessibility e2e passes: `pnpm test:e2e:a11y`

#### Manual Verification:

- Cards show only chip + effort; full attributes appear in the detail panel.
- Tabs switch Aktywne/Planowane/Ukończone with correct counts; filter + sort work.
- Add-task modal creates a `planned` task; project typeahead suggests prior names.
- Detail-panel "start" promotes the task to active and begins focus.

**Implementation Note**: After automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 6: Fokus Recomposition

### Overview

Re-stage the existing 5-state cycle machine into the mockup's calm Fokus screen: a once-per-day energy/goal gate, a clean idle/active timer-centric layout, and dedicated full-screen break/returning states. Add the "Aktualne zadanie" card, "Dzisiaj/Twój dzień" progress card, "Wskazówka na dziś" tip, and "Szybkie akcje". Immersive `focus-session-bg` during active work; `break-restoration` hero on break. The full task list is now gone from Fokus (it lives in Zadania). Preserve cycle correctness; add wedge dismiss-oracle tests.

### Changes Required:

#### 1. Fokus layout re-staging

**File**: `src/app/_components/pomodoro-dashboard.tsx`, `src/lib/home/home-session-state.ts`

**Intent**: Keep the state machine but re-map module placement so idle/active render the clean timer-centric mockup, steering renders as a day-start gate, and break/returning render as dedicated states — instead of the current 2-col module grid.

**Contract**: Adjust the `HomeModulePriorities` mapping ([home-session-state.ts:155](src/lib/home/home-session-state.ts)) and the dashboard render ([pomodoro-dashboard.tsx:955](src/app/_components/pomodoro-dashboard.tsx)) so: `idle/active` = ring timer + Aktualne zadanie + Twój dzień + tip + quick actions; `steering` = day-start gate (see #2); `break`/`returning` = full-screen states. Remove the inline full task list from Fokus.

#### 2. Day-start energy/goal gate

**File**: `src/app/_components/session-steering-card.tsx`, new `day-start-gate.tsx`

**Intent**: Ask energy (Skupiony/Stabilny/Słabnący) and session goal once per day, then hide — replacing the per-session inline steering cards that are the clutter source.

**Contract**: Reuse the `FocusBudgetPrompt` once-per-day dismiss pattern ([focus-budget-prompt.tsx:22](src/app/_components/focus-budget-prompt.tsx)) to gate energy ([session-steering-card.tsx:20](src/app/_components/session-steering-card.tsx)) + goal ([session-steering-card.tsx:60](src/app/_components/session-steering-card.tsx)). Once chosen, the section collapses for the rest of the day. Must carry a **dismiss-oracle test** (gate cannot trap the user).

#### 3. "Twój dzień" / tip / quick actions

**File**: `src/app/_components/home-focus-summary.tsx` (restyle), new `focus-tip.tsx`, `quick-actions.tsx`

**Intent**: Assemble the mockup's progress card (X/8 zadań, sesje, czas skupienia + bar), a daily tip/quote, and quick actions from existing day-plan/recap data.

**Contract**: Restyle `HomeFocusSummary` ([home-focus-summary.tsx:32](src/app/_components/home-focus-summary.tsx)) into the "Dzisiaj/Twój dzień" card using `useDayPlan` metrics (budget/used/tasks) + session count from cycle data. Tip is a small static/rotating line. Quick actions link to Dodaj zadanie / Zadania.

#### 4. Immersive session backdrop + break hero

**File**: `src/lib/design/break-atmosphere.ts`, `src/hooks/use-sync-work-focus-shell.ts`, `src/hooks/use-sync-break-atmosphere.ts`; new hero rendering

**Intent**: During an active WORK session, fade in `focus-session-bg` full-bleed behind the ring (with readability scrim); on break, show the `break-restoration` hero as the break state's backdrop. Light/dark asset swap via `data-theme`.

**Contract**: Extend the existing work-focus-shell / break-atmosphere DOM sync to also drive a hero backdrop layer; add a scrim over `focus-session-bg` for text contrast. Render via CSS `background-image` or `next/image` (introduce config in Phase 11 if `next/image` chosen). Idle Fokus stays clean (no backdrop).

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Lint/format passes: `pnpm check`
- Unit tests pass (dashboard, home-session-state, gate dismiss-oracle): `pnpm test`
- Pomodoro + wedge e2e pass: `pnpm test:e2e`

#### Manual Verification:

- Idle Fokus is calm/timer-centric; energy+goal appear once per day then hide.
- Active work fades in the focus backdrop with legible ring/text; break shows the break hero.
- Progress card, tip, and quick actions read from real day data.
- No dead-end: the day-start gate always dismisses; break/returning always advance.

**Implementation Note**: After automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 7: Plan dnia View

### Overview

Build the standalone Plan dnia view as a **restyled focus-hours capacity budget** (no timeline). Reuse `useDayPlan`, `FocusBudgetPrompt`, and the budget summary, dressed in the mockup aesthetic.

### Changes Required:

#### 1. Plan dnia view component

**File**: `src/app/_components/plan-dnia-view.tsx` (new)

**Intent**: Present the day's focus-hours budget (planned vs. used vs. remaining) and the budget-setting prompt as a calm planning surface.

**Contract**: Compose `useDayPlan` ([use-day-plan.ts:9](src/hooks/use-day-plan.ts)) metrics + `FocusBudgetPrompt` into a titled view ("Plan dnia" + subtitle). **No** schedule, time-blocks, meetings, or week toggle. Temporarily reachable on home until the shell.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Lint/format passes: `pnpm check`
- Unit tests pass: `pnpm test`

#### Manual Verification:

- Plan dnia shows the focus-hours budget and lets the user set/adjust it.
- No timeline/schedule elements present (PRD-compliant).

**Implementation Note**: After automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 8: Podsumowanie Dashboard

### Overview

Build the analytics dashboard: KPI cards, per-hour focus bar chart, session-type donut, and tasks donut, all derived from existing `Cycle` + recap data via light aggregation (**build-to-data**). Add **visx**. Best-time-of-day (multi-day) and per-day date navigation are stubbed/deferred with clear empty states.

### Changes Required:

#### 1. Charting dependency

**File**: `package.json`

**Intent**: Add the low-level, CSS-variable-themeable visx primitives.

**Contract**: Add `@visx/*` packages (shape/scale/group/axis as needed) to **`dependencies`, not `devDependencies`** — the error-level `not-to-dev-dep` depcruise rule ([.dependency-cruiser.cjs:137-156](.dependency-cruiser.cjs)) fails the build if production `src/**` imports a devDependency. No wrapper UI kit; charts are hand-composed to match DESIGN.md.

#### 2. Recap-query augmentation + aggregation

**File**: `src/lib/recap/build-daily-recap.ts`, `src/server/api/routers/recap.ts`, new `src/lib/recap/aggregate-day-stats.ts`

**Intent**: Expose the data the charts need — per-hour focus buckets, per-`workType` totals, and task done/partial/undone counts — for today.

**Contract**: Extend the recap query to also select `task.workType` ([build-daily-recap.ts:38](src/lib/recap/build-daily-recap.ts), currently `{ id, title }` only; thread `workType` through `CycleWithTask`/`RecapTaskRow` too). Add an aggregation util that bins completed WORK `Cycle` rows (`kind=WORK`, `state=COMPLETED`, `startedAt` within today) by hour and by `workType`, and computes KPI totals (tasks X/Y, focus minutes, session count, avg length). **`Cycle.taskId` is nullable** — cycles with no task have no `workType`; give the session-type donut an explicit **"uncategorized"** bucket rather than dropping them. Map "partial" = tasks with focus cycles but not `completed`. Return via the recap tRPC procedure ([recap.ts:10](src/server/api/routers/recap.ts)); `buildDailyRecap` uses a rolling 24h window, so a new aggregation (or a sibling procedure) is the clean seam.

#### 3. Podsumowanie view + charts

**File**: `src/app/_components/podsumowanie-view.tsx` + chart components (new)

**Intent**: Render the mockup's KPI cards + charts from the aggregated data.

**Contract**: KPI cards (Wykonane zadania, Czas skupienia, Sesje skupienia, Średnia długość sesji) with green progress bars; per-hour bar chart (visx); session-type donut (reuse the progress-ring or visx pie) with legend + percentages; tasks donut (done/partial/undone). "Najlepsza pora dnia" and the date-picker/prev-next render an empty/"coming soon" state (deferred). `summary-footer` hero band appears in Phase 12 polish. Temporarily reachable on home until the shell.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Lint/format passes: `pnpm check`
- Unit tests pass (aggregation util + view render): `pnpm test`
- Production build succeeds (visx bundles): `pnpm build`

#### Manual Verification:

- KPI cards show correct today values (cross-check against a manual session run).
- Per-hour bars and session-type donut reflect actual completed cycles/types.
- Deferred widgets (best-time, date-nav) show a clear non-broken placeholder.

**Implementation Note**: After automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 9: Ustawienia Page

### Overview

Build the dedicated Settings view that **relocates** existing controls into sectioned groups (Ogólne, Sesje skupienia, Przerwy, Powiadomienia, Wygląd), removing them from the header/timer/user-menu. No net-new settings.

### Changes Required:

#### 1. Settings view + sections

**File**: `src/app/_components/ustawienia-view.tsx` (new)

**Intent**: One place for all preferences, using the Tabs/Select primitives and existing hooks/storage — a pure relocation.

**Contract**: Sections: **Ogólne** (language via `use-language-preference`; user name read-only + sign-out from `user-menu`); **Sesje skupienia** (work/short/long durations via `duration-storage`); **Przerwy / Powiadomienia** (out-of-tab break alerts w/ permission hints); **Wygląd** (theme via `ThemeProvider`); cycle-end audio under Powiadomienia or Sesje. Each control reuses its existing hook/storage — no new storage keys. **Exclude** Synchronizacja, Prywatność, backup/restore, delete-all, editable name, auto-start breaks, time-format.

#### 2. Remove relocated controls from prior homes

**File**: `src/app/_components/header-preference-controls.tsx`, `timer-panel.tsx`, `user-menu.tsx`, `app-navbar.tsx`

**Intent**: Avoid duplicate control surfaces once Settings owns them.

**Contract**: Remove the theme/lang controls from the header ([header-preference-controls.tsx:34](src/app/_components/header-preference-controls.tsx)); remove duration pickers from `timer-panel` (keep start/pause logic); keep sign-out reachable (in Settings and/or user menu). Coordinate with Phase 11 (nav shell replaces the top-bar controls).

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Lint/format passes: `pnpm check`
- Unit tests pass: `pnpm test`
- Accessibility e2e passes: `pnpm test:e2e:a11y`

#### Manual Verification:

- Every relocated control (theme, language, durations, break alerts, audio) works from Settings and persists.
- No duplicate/broken control remains in the header or timer.
- Sign-out works from its new home.

**Implementation Note**: After automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 10: Cycle-State Lift to Layout Provider

### Overview

Isolate the single riskiest change: lift `usePomodoroCycle` (and `DataModeProvider`) out of the page into a layout-level `PomodoroCycleProvider` so the timer keeps a single ticking instance that will survive route navigation. Still a single home screen at this phase — routes come in Phase 11 — but all cycle consumers now read from context.

### Changes Required:

#### 1. Cycle provider

**File**: `src/app/_components/pomodoro-cycle-provider.tsx` (new)

**Intent**: Wrap the existing hook once and expose its value via context, guaranteeing a single Worker/interval instance.

**Contract**: Provider (a `"use client"` wrapper) calls `usePomodoroCycle` ([use-pomodoro-cycle.ts:360](src/hooks/use-pomodoro-cycle.ts), ~3,750 lines, ~90-field return) and provides its return object; `usePomodoroCycleContext()` consumes it. The hook's own `renderHook` tests stay valid — they `vi.mock` `data-mode-context` and never mount a real provider ([use-pomodoro-cycle.test.tsx](src/hooks/use-pomodoro-cycle.test.tsx)). Mounted **exactly once** — a second mount double-ticks (per-instance Worker at [:791](src/hooks/use-pomodoro-cycle.ts)) and double-fires the document `visibilitychange` listener ([:1161](src/hooks/use-pomodoro-cycle.ts)).

**The hook is NOT a pure context consumer — it takes 4 page-derived props.** At its single call site ([pomodoro-dashboard.tsx:176-184](src/app/_components/pomodoro-dashboard.tsx)) it receives `getCycleEndAudioMode`, `getOutOfTabBreakAlertsEnabled`, `activeTaskIds`, and `continueTasks` — all derived inside the dashboard from `tasks` + preference hooks scoped to `onboardingScope`/`DataMode`. Those inputs (the task source and the two preference resolvers) must be lifted to the provider too, not just the hook call. This is the real cost of the phase, and it interacts with #2 below.

#### 2. Move providers up + switch consumers

**File**: `src/app/layout.tsx`, `src/app/_components/home-shell.tsx`, `pomodoro-dashboard.tsx` (+ every cycle consumer)

**Intent**: Relocate `DataModeProvider` and the new cycle provider to a shared layout position, and point consumers at the context.

**Contract**: Place `PomodoroCycleProvider` (+ `DataModeProvider`) below `NextIntlClientProvider`/`TRPCReactProvider`/`ThemeProvider` and around `{children}` ([layout.tsx:72-77](src/app/layout.tsx)) — the layout stays an async server component, so the provider is a client wrapper inserted around children. `DataModeProvider` currently lives page-scoped at [home-shell.tsx:79](src/app/_components/home-shell.tsx); lifting it means restructuring `home-shell.tsx` and touching `page.tsx`. `PomodoroDashboardBody` stops instantiating the hook ([pomodoro-dashboard.tsx:176](src/app/_components/pomodoro-dashboard.tsx)) and reads `usePomodoroCycleContext()`. Keep `OnboardingProvider`/`GuestMergeUiProvider`/`HomeIllustrationVariantProvider` scoping intact (move only what the cycle depends on).

**Resolve the auth/guest task source above the branch.** Today `PomodoroDashboard` branches on `useDataMode()` into `AuthenticatedPomodoroDashboard` (`useDomainTasks`/Suspense) vs `GuestPomodoroDashboard` (`useGuestDomainTasks`) ([pomodoro-dashboard.tsx:1252-1257](src/app/_components/pomodoro-dashboard.tsx)), each building `tasks` differently. Since the hook now lives above this branch, the task source + preference resolvers it needs must be resolved at the provider level for both modes.

#### 3. Test wrapper updates

**File**: `pomodoro-dashboard.test.tsx` + affected consumer tests

**Intent**: Consumer tests now need the provider wrapper.

**Contract**: `pomodoro-dashboard.test.tsx` currently mocks the hook by module path (`vi.mock("~/hooks/use-pomodoro-cycle", …)`) and injects `usePomodoroCycleMock` — this breaks when the body reads from context instead of calling the hook. Switch those tests to **mock the new context hook** (`usePomodoroCycleContext`) or wrap render trees in `PomodoroCycleProvider` with a test double. `home-shell.test.tsx` is affected by the provider re-nesting too. `use-pomodoro-cycle.test.tsx`/`-guest.test.tsx` (hook-level, `renderHook`) remain as-is.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Lint/format passes: `pnpm check`
- Unit tests pass (hook tests unchanged; consumer tests via provider): `pnpm test`
- Pomodoro e2e passes: `pnpm test:e2e`

#### Manual Verification:

- Timer starts/pauses/completes exactly as before (single instance — no double-ticking).
- Tab-visibility recovery still re-syncs remaining time.
- No regression in check-in/wind-down/steering gates.

**Implementation Note**: After automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 11: Navigation Shell + Route Split

### Overview

Introduce the sidebar (desktop) + bottom nav (mobile) and split the app into real routes (`/focus`, `/tasks`, `/plan`, `/summary`, `/settings`), wiring each finished view into its route. Because cycle state now lives in a layout provider (Phase 10), the timer keeps ticking across navigation. This is the composition phase — pieces already exist.

### Changes Required:

#### 1. Nav shell

**File**: `src/app/_components/app-shell.tsx` (new), `src/app/layout.tsx`, `app-navbar.tsx`

**Intent**: Replace the bare top bar with the mockup's sidebar + mobile bottom nav (Fokus / Zadania / Plan dnia / Podsumowanie / Ustawienia) with lucide icons and active-state highlighting.

**Contract**: Sidebar on desktop, fixed bottom nav on mobile (same 5 sections); brand mark (`CalmGardenSprig`) at top; notification/user controls in the header row per mockup. Nav labels via next-intl — extend the `Navbar` namespace (currently only `brand`) in **both** repo-root catalogs `messages/en.json` and `messages/pl.json`, or the `messages-parity.test.ts` fails. Active section derived from the route.

#### 2. Routes + guest-public allow-list

**File**: `src/app/focus/page.tsx`, `src/app/tasks/page.tsx`, `src/app/plan/page.tsx`, `src/app/summary/page.tsx`, `src/app/settings/page.tsx` (new); `src/app/page.tsx` (redirect); `src/lib/auth/public-paths.ts`, `src/proxy.test.ts`

**Intent**: Give each view a real URL and deep-linkability; the shared layout keeps the timer alive — **without bouncing guests to sign-in.**

**Contract**: Each route renders its finished view component (Phases 5–9) inside the shell. `/` redirects to `/focus`. English canonical slugs; user-facing labels localized. Ensure the layout wrapping these routes hosts the Phase-10 providers so state persists across navigation.

**Auth gate (per decision — all 5 routes guest-public).** Today `isGuestPublicPath` hardcodes `pathname === "/"` as the *only* guest-public path ([public-paths.ts:4-6](src/lib/auth/public-paths.ts)); `proxy.ts` (Next 16 renamed middleware → `proxy.ts` at repo root) redirects every other unauthenticated request to `/auth/sign-in` ([proxy.ts:15-17](proxy.ts)). Add `/focus`, `/tasks`, `/plan`, `/summary`, `/settings` to the guest allow-list so the no-account trial (which the `proxy.ts` comment explicitly protects) survives the split, and update the asserting `src/proxy.test.ts` / `public-paths` tests.

#### 3. Remove temporary home-hosting

**File**: `home-shell.tsx`, `pomodoro-dashboard.tsx`

**Intent**: Drop the scaffolding that temporarily rendered non-Fokus views on the home screen.

**Contract**: Home/Fokus renders only the Fokus view; other views are reached via routes. Clean up placeholders.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Lint/format passes: `pnpm check`
- Unit tests pass: `pnpm test`
- Dependency rules pass: `pnpm depcruise`
- E2e nav + "timer keeps ticking across navigation" pass: `pnpm test:e2e`
- Accessibility e2e passes: `pnpm test:e2e:a11y`

#### Manual Verification:

- All 5 sections reachable via sidebar (desktop) and bottom nav (mobile); active state correct.
- Start a session on Fokus, navigate to Zadania/Podsumowanie and back — timer kept ticking.
- Deep-linking to each route works and renders inside the shell.
- A signed-out **guest** can reach all 5 routes (no bounce to `/auth/sign-in`); deep-linking `/tasks` as a guest renders, not redirects.

**Implementation Note**: After automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 12: Onboarding Hero, Polish & Regression

### Overview

Wire the remaining heroes, run a full responsive/dark/a11y sweep across every view, add final latency guards, sync the PRD/roadmap docs, and confirm no regressions. Closes the PR.

### Changes Required:

#### 1. Remaining hero assets

**File**: anon/onboarding hero surface, `podsumowanie-view.tsx`, "Twój dzień" card

**Intent**: Place the last three delivered heroes.

**Contract**: `onboarding-hero` on the anon/landing surface (with scrim over text); `summary-footer` band at the bottom of Podsumowanie; `day-summary-thumb` on the "Twój dzień" card. All light/dark via `data-theme`. If `next/image` is used, add the `next.config` images block here.

#### 2. Responsive + dark + a11y sweep

**File**: all new views/components

**Intent**: Confirm the airy mockup look holds at mobile/tablet/desktop and in dark mode, and that a11y passes everywhere.

**Contract**: Fix spacing/overflow/contrast issues; ensure focus order and labels across nav, tabs, modals, charts.

#### 3. Doc + housekeeping sync

**File**: `context/foundation/prd.md`, `context/foundation/roadmap.md`, `context/changes/ui-refactor/change.md`

**Intent**: Reflect shipped state (PRD amendments already landed; mark S-45 progress; close the change identity).

**Contract**: Confirm PRD amendment threads are consistent with the built surfaces; update roadmap S-45 status; set `change.md` status appropriately.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Lint/format passes: `pnpm check`
- Full unit suite passes: `pnpm test`
- Full e2e + a11y pass: `pnpm test:e2e` and `pnpm test:e2e:a11y`
- Production build succeeds: `pnpm build`
- Dependency rules pass: `pnpm depcruise`

#### Manual Verification:

- Every view matches the mockups in light + dark at mobile/tablet/desktop.
- Heroes render crisply with legible overlaid text; no broken images.
- End-to-end walkthrough (add task → plan → focus session → break → summary → settings) is calm and regression-free.

**Implementation Note**: After automated verification passes, pause for final manual confirmation. This is the last phase — the PR is ready for review.

---

## Testing Strategy

### Unit Tests:

- **Primitives** (Phase 2): Tabs/Select keyboard + a11y; Button/Segmented variants.
- **Ring timer** (Phase 3): progress math, paused state, label rendering; keep `timer-panel.test.tsx` green.
- **Task model** (Phase 4): default-status fork (planned vs. daily-standing active), auto-promote on focus, planned excluded from suggestions, `project` round-trips; guest-schema defaults.
- **Analytics aggregation** (Phase 8): hour-binning, per-`workType` totals, KPI math, partial-task classification.
- **Cycle provider** (Phase 10): single-instance ticking; consumer tests via provider wrapper; hook tests unchanged.
- **Day-start gate** (Phase 6): dismiss-oracle (gate always dismissible; no dead-end).

### Integration / E2E Tests:

- Pomodoro cycle (start/work/break/complete) survives the ring refactor (Phase 3) and the cycle lift (Phase 10).
- **Timer keeps ticking across route navigation** (Phase 11) — the core cross-route guarantee.
- Add-task modal → task appears in Zadania Planowane; promote → Aktywne; focus from detail panel.
- Nav reachability of all 5 sections on desktop + mobile; deep-linking.
- Accessibility sweep (`pnpm test:e2e:a11y`) after primitives, tasks, settings, and shell.

### Manual Testing Steps:

1. Run a full session on Fokus; confirm ring fill, immersive backdrop on active work, break hero on break.
2. Create tasks; verify planned-vs-active defaults and focus auto-promotion.
3. Open Podsumowanie after sessions; cross-check KPI/chart values against what you ran.
4. Change every setting in Ustawienia; confirm persistence and no duplicate controls elsewhere.
5. Navigate between sections mid-session; confirm the timer never resets.
6. Repeat the walkthrough in dark mode and at mobile width.

## Performance Considerations

- **Single ticking instance** (Phase 10) is a correctness *and* performance guard — a double-mounted provider would double the Worker/interval load.
- **visx bundle** (Phase 8): import only the needed `@visx/*` modules; charts are today-scoped (small datasets).
- **Hero rasters** (Phases 6, 12): `focus-session-bg` is 1672×941 — acceptable for MVP; if soft on large displays, revisit. Use `data-theme` asset swap; add `next/image` config only if that renderer is chosen.
- **Latency guards (L-04)**: modal save, nav switch, promote-to-active, and chart render each need a perceived-latency check.

## Migration Notes

- **`project` column**: single additive `VARCHAR(256)` migration (`pnpm db:migrate`); existing rows get `NULL`. No backfill.
- **`planned` status**: no schema/migration (free-form String); existing tasks stay `active`. Only Zod/enum validators widen.
- **Default-status change**: only affects *new* task creation; no retroactive change to existing tasks. Daily-standing creates remain `active`.
- **Guest local snapshots**: `guestTaskSchema` tolerates missing `project` (→ `null`) and unknown status values so pre-existing `flowstate:guest-v1` data loads cleanly.

## References

- Research: `context/changes/ui-refactor/research.md`
- Change identity: `context/changes/ui-refactor/change.md`
- Target vision: `context/foundation/makiety/redesign.md`, `branding.md`, and the 9 mockup PNGs
- Canonical design spec: `DESIGN.md`
- PRD (amended for this change): `context/foundation/prd.md`; roadmap slice **S-45 `ui-refactor`**
- Lessons: `context/foundation/lessons.md` (L-04 latency, L-"wedge")
- Key code: `src/hooks/use-pomodoro-cycle.ts:360`, `src/lib/home/home-session-state.ts:155`, `src/app/_components/pomodoro-dashboard.tsx:43`, `src/app/_components/timer-panel.tsx:152`, `src/lib/data-mode/types.ts:26`, `src/server/api/routers/task.ts`, `src/lib/recap/build-daily-recap.ts:38`, `src/styles/globals.css:12`, `src/app/_components/overlay-shell.tsx`, `src/app/_components/focus-budget-prompt.tsx:22`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Design Tokens & Scale

#### Automated

- [x] 1.1 Type checking passes: `pnpm typecheck`
- [x] 1.2 Lint/format passes: `pnpm check`
- [x] 1.3 Unit tests pass: `pnpm test`
- [x] 1.4 Production build succeeds: `pnpm build`

#### Manual

- [x] 1.5 Primary CTAs / segmented / focus rings render muted green (light)
- [x] 1.6 Dark-mode parity, no contrast regressions
- [x] 1.7 Airier scale without layout breakage

### Phase 2: Shared UI Primitives

#### Automated

- [x] 2.1 Type checking passes: `pnpm typecheck` — 4f440fb
- [x] 2.2 Lint/format passes: `pnpm check` — 4f440fb
- [x] 2.3 Unit tests pass (incl. new primitive tests): `pnpm test` — 4f440fb
- [x] 2.4 Accessibility e2e passes: `pnpm test:e2e:a11y` — 4f440fb

#### Manual

- [x] 2.5 Tabs + Select fully keyboard-operable and labelled — 4f440fb
- [x] 2.6 Refactored work-type control behaves identically — 4f440fb

### Phase 3: Ring Timer

#### Automated

- [x] 3.1 Type checking passes: `pnpm typecheck` — 8b77465
- [x] 3.2 Lint/format passes: `pnpm check` — 8b77465
- [x] 3.3 Unit tests pass (timer-panel + ring): `pnpm test` — 8b77465
- [x] 3.4 Pomodoro e2e passes: `pnpm test:e2e` — 8b77465

#### Manual

- [x] 3.5 Ring fills smoothly; center shows time + phase — 8b77465
- [x] 3.6 Pause/resume/interrupt reflected in ring — 8b77465
- [x] 3.7 Light + dark ring legibility — 8b77465

### Phase 4: Tasks Model & Backend

#### Automated

- [x] 4.1 Migration applies cleanly: `pnpm db:migrate` — 81149b6
- [x] 4.2 Type checking passes: `pnpm typecheck` — 81149b6
- [x] 4.3 Lint/format passes: `pnpm check` — 81149b6
- [x] 4.4 Unit + router tests pass: `pnpm test` — 81149b6

#### Manual

- [x] 4.5 Normal create → `planned`; daily-standing → `active` — 81149b6
- [x] 4.6 Focusing a planned task promotes it to `active` — 81149b6
- [x] 4.7 Planned tasks excluded from focus suggestions — 81149b6
- [x] 4.8 Existing tasks unaffected post-migration — 81149b6
- [x] 4.9 Planned task round-trips the mapper (no throw) and guest snapshot with a planned task loads (not dropped) — 81149b6

### Phase 5: Zadania View

#### Automated

- [x] 5.1 Type checking passes: `pnpm typecheck` — 57a7116
- [x] 5.2 Lint/format passes: `pnpm check` — 57a7116
- [x] 5.3 Unit tests pass (list/fields/modal/detail): `pnpm test` — 57a7116
- [ ] 5.4 Accessibility e2e passes: `pnpm test:e2e:a11y` (pending CI)

#### Manual

- [x] 5.5 Cards show chip + effort only; detail panel holds the rest
- [x] 5.6 Tabs + counts + filter + sort work
- [x] 5.7 Add-task modal creates planned; project typeahead suggests prior names
- [x] 5.8 Detail "start" promotes to active and focuses

### Phase 6: Fokus Recomposition

#### Automated

- [x] 6.1 Type checking passes: `pnpm typecheck` — 34d1698
- [x] 6.2 Lint/format passes: `pnpm check` — 34d1698
- [x] 6.3 Unit tests pass (dashboard/state/gate dismiss-oracle): `pnpm test` — 34d1698
- [ ] 6.4 Pomodoro + wedge e2e pass: `pnpm test:e2e` (pending CI)

#### Manual

- [x] 6.5 Idle Fokus calm; energy+goal once/day then hide — 34d1698
- [x] 6.6 Active work backdrop legible; break hero on break — 34d1698
- [x] 6.7 Progress card / tip / quick actions read real data — 34d1698
- [x] 6.8 No dead-end in gate or break/returning transitions — 34d1698

### Phase 7: Plan dnia View

#### Automated

- [x] 7.1 Type checking passes: `pnpm typecheck`
- [x] 7.2 Lint/format passes: `pnpm check`
- [x] 7.3 Unit tests pass: `pnpm test`

#### Manual

- [ ] 7.4 Budget shown and adjustable
- [ ] 7.5 No timeline/schedule elements (PRD-compliant)

### Phase 8: Podsumowanie Dashboard

#### Automated

- [ ] 8.1 Type checking passes: `pnpm typecheck`
- [ ] 8.2 Lint/format passes: `pnpm check`
- [ ] 8.3 Unit tests pass (aggregation + view): `pnpm test`
- [ ] 8.4 Production build succeeds (visx): `pnpm build`

#### Manual

- [ ] 8.5 KPI cards match a manual session run
- [ ] 8.6 Per-hour bars + session-type donut reflect real cycles/types
- [ ] 8.7 Deferred widgets show clear placeholders

### Phase 9: Ustawienia Page

#### Automated

- [ ] 9.1 Type checking passes: `pnpm typecheck`
- [ ] 9.2 Lint/format passes: `pnpm check`
- [ ] 9.3 Unit tests pass: `pnpm test`
- [ ] 9.4 Accessibility e2e passes: `pnpm test:e2e:a11y`

#### Manual

- [ ] 9.5 Every relocated control works from Settings and persists
- [ ] 9.6 No duplicate/broken control in header or timer
- [ ] 9.7 Sign-out works from new home

### Phase 10: Cycle-State Lift to Layout Provider

#### Automated

- [ ] 10.1 Type checking passes: `pnpm typecheck`
- [ ] 10.2 Lint/format passes: `pnpm check`
- [ ] 10.3 Unit tests pass (hook unchanged; consumers via provider): `pnpm test`
- [ ] 10.4 Pomodoro e2e passes: `pnpm test:e2e`

#### Manual

- [ ] 10.5 Timer behaves as before — single instance, no double-tick
- [ ] 10.6 Tab-visibility recovery still re-syncs
- [ ] 10.7 Check-in/wind-down/steering gates unregressed

### Phase 11: Navigation Shell + Route Split

#### Automated

- [ ] 11.1 Type checking passes: `pnpm typecheck`
- [ ] 11.2 Lint/format passes: `pnpm check`
- [ ] 11.3 Unit tests pass: `pnpm test`
- [ ] 11.4 Dependency rules pass: `pnpm depcruise`
- [ ] 11.5 E2e nav + cross-route ticking pass: `pnpm test:e2e`
- [ ] 11.6 Accessibility e2e passes: `pnpm test:e2e:a11y`

#### Manual

- [ ] 11.7 All 5 sections reachable (sidebar + bottom nav); active state correct
- [ ] 11.8 Timer keeps ticking across navigation mid-session
- [ ] 11.9 Deep-linking each route renders inside the shell
- [ ] 11.10 Signed-out guest reaches all 5 routes with no bounce to sign-in

### Phase 12: Onboarding Hero, Polish & Regression

#### Automated

- [ ] 12.1 Type checking passes: `pnpm typecheck`
- [ ] 12.2 Lint/format passes: `pnpm check`
- [ ] 12.3 Full unit suite passes: `pnpm test`
- [ ] 12.4 Full e2e + a11y pass: `pnpm test:e2e` and `pnpm test:e2e:a11y`
- [ ] 12.5 Production build succeeds: `pnpm build`
- [ ] 12.6 Dependency rules pass: `pnpm depcruise`

#### Manual

- [ ] 12.7 Every view matches mockups (light+dark, mobile/tablet/desktop)
- [ ] 12.8 Heroes crisp with legible overlaid text; no broken images
- [ ] 12.9 Full end-to-end walkthrough calm and regression-free
