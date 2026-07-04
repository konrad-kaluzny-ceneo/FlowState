---
date: 2026-07-04T16:16:24+0200
researcher: Konrad Zieliński
git_commit: 321105c6b314f48004ca7342d27181b20bdaa71e
branch: features/mvp-defect-intake
repository: FlowState
topic: "UI redesign — align the app with the makiety mockups (gap analysis + phasing)"
tags: [research, codebase, ui-refactor, design-system, navigation, tasks, timer, redesign]
status: complete
last_updated: 2026-07-04
last_updated_by: Konrad Zieliński
last_updated_note: "Added Scope Decisions section resolving the PRD-conflict questions"
---

# Research: UI redesign — align the app with the `makiety` mockups

**Date**: 2026-07-04T16:16:24+0200
**Researcher**: Konrad Zieliński
**Git Commit**: 321105c6b314f48004ca7342d27181b20bdaa71e
**Branch**: features/mvp-defect-intake
**Repository**: FlowState

## Research Question

Compare the redesign vision in `context/foundation/makiety/` (8 ChatGPT-generated mockups + `redesign.md` + `branding.md`) against the current UI, determine which mockup features are real vs. hallucinated, and map the gap so the work can be split into phases ordered by simplicity/impact. Flag every phase that depends on user-supplied graphics as an entry gate.

## Summary

The mockups describe a **5-section, multi-view "wellbeing app"** (sidebar/bottom nav → Fokus / Zadania / Plan dnia / Podsumowanie / Ustawienia) with a big circular timer, minimal task cards, a day timeline, a stats dashboard, and a green accent.

The current app is a **deliberately single-screen SPA**: one real route (`/`), no navigation shell, a numeric (not ring) timer, busy task cards, and a **taupe/stone accent (not green)**. Everything is composed on the home dashboard by a cycle-phase state machine (`deriveHomeSessionState`).

Three findings dominate the plan:

1. **The design foundation is closer than it looks.** Tailwind-v4 CSS-first tokens, a full **light/dark/system** theme engine (already shipped with a working toggle), a **botanical SVG illustration system**, and a reusable **modal primitive** already exist. The mockup's *aesthetic* (soft beige, rounded cards, soft shadows, plant motif, dark-mode) is largely a **token retint + component reshuffle**, not a rebuild. The single biggest "look" gap is **accent color** (taupe `#736d62` → muted green), which is a one-place token edit.

2. **Three mockup views directly contradict the current PRD.** `prd.md` explicitly forbids a **full analytics dashboard** ("no charts, trends, or weekly reports"), forbids a **separate settings page in v1**, and defines "day plan" as a **focus-hours capacity budget, not a timeline**. The mockups' **Podsumowanie (charts)**, **Plan dnia (timeline)**, and **Ustawienia (settings page)** are net-new surfaces that conflict with the shipped product contract. **This conflict must be resolved by the user before those phases are planned** (redesign.md is a foundation aspiration; prd.md is the current contract — they disagree).

3. **Several task-detail features in the mockups are hallucinated** — no data model backs them: **Projekt, Podzadania/subtasks, Opis/description, general Notatki, and a "Planowane" status tab**. These are net-new model+backend+UI, not restyles, and should be treated as out-of-scope-for-a-UI-refactor unless explicitly promoted.

Net: a large slice of "make it look like the mockup" is achievable with **low-risk restyle + recomposition** work on the existing single screen. The **navigation shell** (sidebar/bottom-nav + multi-view) is the pivotal architectural decision that unlocks the rest, and it forces the PRD-conflict question because the extra nav sections only have somewhere to live once a shell exists.

---

## Scope Decisions (2026-07-04)

The PRD-vs-mockup conflicts and the hallucinated task fields were resolved with the user. **These decisions are binding for `/10x-plan`** and override the "conflict"/"hallucinated" cautions in the tables below.

| Topic | Decision | Consequence for the plan |
|---|---|---|
| **Plan dnia** | **Section, budget only** | Create a `Plan dnia` nav section, but populate it with the **existing focus-hours capacity budget** restyled to the mockup look. **No timeline / time-blocks / week view.** PRD-compliant — **no PRD amendment needed.** |
| **Podsumowanie** | **Full charts dashboard (amend PRD)** | Build KPI cards + charts (bar/donut/best-time) as drawn. **Requires a `prd.md` amendment** (removing the "no analytics dashboard" clause, `prd.md:206`) and a **charting library** decision. In scope. |
| **Ustawienia** | **Settings page, relocate existing** | Build a dedicated `Ustawienia` page that **relocates today's controls** (theme/lang, session durations, break/notification, audio). **Amend the PRD v1 note** (`prd.md:650`,`:585`). **No net-new settings** — Synchronizacja / Prywatność / backup-restore / delete-all-data are **out of scope**. |
| **Task fields — Projekt** | **IN scope** | Net-new: add a `project` field to the task model + backend + UI (create modal + detail panel), and it may drive grouping/filtering. |
| **Task fields — Planowane tab** | **IN scope** | Net-new: add a `planned` value to `DomainTaskStatus` + lifecycle transitions, and surface the Aktywne/**Planowane**/Ukończone tri-tab from the mockup. |
| **Task fields — Podzadania (subtasks)** | **OUT of scope** | Not built. Detail panel omits subtasks. |
| **Task fields — Opis & Notatki** | **OUT of scope** | Not built. Only the existing `resumeNote` remains. |

**PRD amendments — DONE (2026-07-04):** both landed in `context/foundation/prd.md` as change thread "UI redesign (ui-refactor)" — (1) analytics-dashboard non-goal carved out for **Podsumowanie**; (2) "no separate settings page in v1" carved out for **Ustawienia** (relocation only). Plan dnia (budget-only) needs none. The redesign is also registered on the roadmap as **S-45 `ui-refactor`** (Stream T) and in `prd.md` frontmatter `active_change_threads`.

**Still needs restyle, not new features:** the task work is otherwise a pure restyle (simplify cards, add-task modal, detail side panel over existing fields) **plus** the two promoted fields above.

---

## Detailed Findings

### Area 1 — App shell, routing & navigation

- **Framework**: Next.js App Router, React 19, tRPC, next-intl (pl/en). Effectively a **single-screen SPA**.
- **Only one content route**: `/` ([src/app/page.tsx:8](src/app/page.tsx)) → `HomeShell` → `PomodoroDashboard`. Everything else is `/auth/*` and `/api/*`. **No** `/tasks`, `/plan`, `/summary`, `/settings`.
- **No navigation shell exists.** Root layout ([src/app/layout.tsx:71](src/app/layout.tsx)) renders a single top `AppNavbar` + `{children}`. `AppNavbar` ([src/app/_components/app-navbar.tsx:21](src/app/_components/app-navbar.tsx)) is a top bar with **only** a brand link + right-side controls (theme/lang/user menu). The `Navbar` i18n namespace has only `brand`. **No sidebar, no bottom nav, no nav items.**
- **The home screen is a state machine, not a dashboard.** `deriveHomeSessionState` ([src/lib/home/home-session-state.ts:328](src/lib/home/home-session-state.ts)) maps cycle state → one of 5 states (`idle | steering | active_work | break | returning`) and assigns each module to primary/secondary/hidden slots in a 2-column grid ([pomodoro-dashboard.tsx:955–1039](src/app/_components/pomodoro-dashboard.tsx)). Modules swap by cycle phase, not by navigation.

Per-section "exists today?":

| Target section | Exists today? | Current state |
|---|---|---|
| **Fokus** (home) | ✅ Full | The whole app — timer, steering, tasks, overlays live here |
| **Zadania** | ⚠️ Inline only | `TaskList` embedded on home; full task backend exists; no page, no tabs, no "planned" status |
| **Plan dnia** (timeline) | ❌ Missing | Only a focus-hours **budget** (`useDayPlan`, `FocusBudgetPrompt`, `HomeFocusSummary`); no schedule/time-blocks/week toggle |
| **Podsumowanie** (charts) | ❌ Missing | Only a light collapsible text recap (`DailyRecapPanel`); no KPI cards, no charts |
| **Ustawienia** (settings page) | ❌ Missing | Settings scattered inline (navbar theme/lang, timer break-alerts, audio prefs); no page, no sub-tabs |

### Area 2 — Home / Focus view & timer

- **Timer is NOT a ring.** It's a bordered card with a **monospace numeric countdown** (`text-6xl font-mono tabular-nums`, [timer-panel.tsx:152](src/app/_components/timer-panel.tsx)). Idle shows a `DurationPicker` + full-width Start; running shows numeric + Pause/Interrupt icons. The timer is often *secondary* in prominence (mounts once a task is focused). The mockup's **large central ring is missing entirely**.
- **Energy + session-goal selection are the clutter source.** `SessionEnergyCard` / `SessionFocusCard` ([session-steering-card.tsx:20](src/app/_components/session-steering-card.tsx), `:60`) inject as **`primary` modules into the home column on every session / check-in** — exactly the redesign complaint (`redesign.md` "show once at start of day then hide"). The once-per-day dismiss pattern to imitate already exists: `FocusBudgetPrompt` ([focus-budget-prompt.tsx:22](src/app/_components/focus-budget-prompt.tsx)).
- **Session-in-progress "nature background"** is a **CSS shell attribute, not an illustration**: `useSyncWorkFocusShell` / `useSyncBreakAtmosphere` toggle `data-work-focus-shell` / break-atmosphere on `#home-shell-main`, restyling the gradient ([src/lib/design/break-atmosphere.ts](src/lib/design/break-atmosphere.ts)). Illustrations are a small botanical sprig, **not** a full-bleed scene.

Mockup element → status:

| Fokus mockup element | Status |
|---|---|
| Large circular timer ring + "Rozpocznij" | **Missing** (numeric card; label is `Timer.startLabel`) |
| "Aktualne zadanie" card | **Partial** (title shown inside TimerPanel; no standalone card) |
| "Twój dzień" progress panel (X/8, sesje, czas, bar) | **Partial** (`HomeFocusSummary` = text budget lines; no bar, no session count, no "X/8") |
| "Wskazówka na dziś" tip/quote | **Missing** |
| "Szybkie akcje" quick actions | **Missing** |
| Empty state "Gotowy na skupienie?" + recents | **Partial** (idle purpose header + task list; no dedicated hero/recents) |
| Energy (Skupiony/Stabilny/Słabnący) | **Exists** but per-session inline (needs relocation to day-start gate) |
| Session goal ("cel sesji" / Głęboka praca) | **Exists** but split: `SessionFocusCard` (intention) + task `workType` label; no day-start step |
| Full-bleed nature session background | **Partial** (CSS atmosphere, not an illustrated scene) |

### Area 3 — Tasks feature

- **Cards are busy** (the redesign's target). A row (`SortableActiveTaskRow`, [task-list.tsx:274](src/app/_components/task-list.tsx)) can show: drag handle, complete checkbox, title, **type chip, Pilność (urgency), Waga (importance), ASAP flag, effort minutes, Daily flag, persona label, "Custom" flag**, plus Focus + delete buttons. Badge logic in `TaskBadges` ([task-list.tsx:103](src/app/_components/task-list.tsx)) has persona/legacy/custom modes. Mockup target = **single chip + effort only**; everything else hidden.
- **Creation is inline, not a modal.** Top-of-list form ([task-list.tsx:906](src/app/_components/task-list.tsx)) with an always-visible `PersonaPresetPicker` (8 chips + Custom), Daily checkbox, effort, and (when Custom) the full `TaskFieldsPanel` grid. No modal exists.
- **Edit is inline-in-place, no side panel.** Clicking a title swaps it for `TaskFieldsPanel` ([task-fields-panel.tsx:194](src/app/_components/task-fields-panel.tsx)); blur commits. No detail side panel; the only note field is `resumeNote` (≤120 chars) — **not** the mockup's "Notatki".
- **Lifecycle**: status enum is `active | completed | archived` ([src/lib/data-mode/types.ts:26](src/lib/data-mode/types.ts)). Two stacked sections (Active/Completed) + an archive overlay. **No tabs, no filters, no sort dropdown, no grid toggle** (grep for "Sortuj"/"Wszystkie typy"/"Planowane"/"Podzadania"/"Opis" → 0 source hits).

Hallucinated (no data model — net-new work, likely out of scope for a *UI* refactor):
- **Projekt** (no project entity), **Podzadania/subtasks** (no model), **Opis/description** (not in `DomainTask`), **general Notatki** (only `resumeNote`), **"Planowane" tab** (no `planned` status), **list/grid toggle + type filter + sort dropdown** (none implemented).

Restyle-able in place: drag handle, complete checkbox, title, type/persona chip, effort estimate, inline create → **rework into modal**, inline edit → **rework into side panel**.

### Area 4 — Design system & styling

- **Stack**: Tailwind CSS **v4**, CSS-first — **no `tailwind.config.js`**; tokens in an `@theme{}` block in [src/styles/globals.css](src/styles/globals.css). Canonical spec: `DESIGN.md` (repo root). **No shadcn/Radix/`cn()`** — deliberately hand-rolled (DESIGN.md:291). Font: Geist Sans.
- **Palette is already "serene beige/stone" — but the accent is taupe, not green.** Primary CTA = `--color-accent-cta #736d62` (muted taupe). Green appears **only** as semantics: `accent-break #3d8f82`, `accent-success #3a8f65`. Shell gradient `#faf8f5 → #edeae4`; surfaces white/`#f3f1ec`; borders `#e0ddd6`; soft card shadow `rgb(45 42 53 / 0.08)`. **The mockup's "muted green as the single accent" = retint `accent-cta` / `segment-active` / focus-ring tokens in one place.**
- **Dark mode is fully built** (matches Jasny/Ciemny/Systemowy): `theme.ts`, `theme-provider.tsx`, FOUC-guard `theme-script.tsx`, dark tokens `globals.css:70–119`, and a shipped 3-way toggle `header-preference-controls.tsx`. Only **relocation into a Settings page** would be new.
- **Illustration system is built** and matches the botanical direction: `src/lib/design/illustrations/` — `CalmGardenSprig` (the leaf logo mark, used in navbar), `CalmGardenBlob`, `EmptyGardenBed`, `HomeHeroSprig` — all **inline SVG**, theme-aware via tint tokens, with a stateful variant engine (`home-illustration-variant.tsx`). **No photo assets** exist (`public/` has only favicon + sounds). The mockups' **mountain-lake & coffee-break photo heroes are net-new assets** with no home in the repo.
- **Primitives**: no `components/ui` library. **Modal exists** (`overlay-shell.tsx` — `OverlayScrim` + `OverlayCard`, focus-trap, Esc, variants) → build the add-task modal on it. **Missing**: real **Tabs** (no `role="tablist"`), real **Select/Dropdown** (no listbox/menu/combobox anywhere), a **Sidebar nav**, and extracted **Button/Segmented** components (currently copy-pasted patterns).
- **Scale gaps**: radius caps at `0.75rem` (`xl`); body text `0.875rem`. Mockup wants **bigger rounding + larger/airier type** → token bumps.

---

## Real vs. Hallucinated — verdict table

| Mockup feature | Verdict | Rationale |
|---|---|---|
| 5-section sidebar/bottom nav | **Real (documented)** but greenfield | `redesign.md:254–262` specifies it; no nav shell exists yet |
| Fokus: ring timer, current-task card, "Twój dzień", tips, quick actions | **Real, buildable** | Data exists (recap/day-plan); UI is new but low-risk |
| Zadania as a page + minimal cards + add-task modal + detail side panel | **Real, buildable** | Full task backend exists; restyle + recompose |
| Zadania: **Planowane** tab | **Hallucinated (no model)** | Status enum has no `planned` |
| Zadania: filters / sort dropdown / grid toggle | **Plausible new UI** (not backed today) | Pure-UI additions; optional |
| Task detail: **Projekt, Podzadania, Opis, Notatki** | **Hallucinated (no model)** | Net-new data model + backend |
| **Plan dnia** as day/week **timeline** | **Conflicts PRD** | `prd.md:144,188` = capacity **budget**, not a schedule |
| **Podsumowanie** as **charts/KPI dashboard** | **Conflicts PRD** | `prd.md:206` "no full analytics dashboard — no charts/trends/reports" |
| **Ustawienia** as a **dedicated settings page** | **Conflicts PRD** | `prd.md:650,585` "not a separate settings page in v1" |
| Green accent, rounded cards, soft shadows, dark mode, plant motif | **Real, mostly present** | Token retint + reuse of existing theme/illustration systems |
| Nature-**photo** heroes (mountain-lake, coffee) | **Real but asset-gated** | No photo assets exist; **user must supply** |

---

## Suggested phasing (effort × impact — for `/10x-plan` to refine)

Ordered by "cheapest path to looking like the mockup." Detailed sequencing belongs to `/10x-plan`; this is the effort map.

**Tier 0 — Pure token/aesthetic restyle (low risk, high visual payoff, no new data)**
- Retint accent taupe→muted green (`--color-accent-cta`, `segment-active`, focus-ring) in `globals.css` + `DESIGN.md`.
- Bump radius scale + type scale + spacing toward the airier mockup.
- Verify dark-mode parity after retint.
> Biggest "it looks like the mockup" win for the least work.

**Tier 1 — Recompose the single screen (medium, backend already exists)**
- Simplify task cards to single chip + effort; move urgency/importance/ASAP/daily into edit.
- Replace numeric timer with a **circular ring** treatment (`timer-panel.tsx`).
- Assemble "Twój dzień" progress card, "Wskazówka na dziś" tip, "Szybkie akcje" from existing recap/day-plan data.
- Move energy + session-goal steering to a **once-per-day gate** (reuse `FocusBudgetPrompt` dismiss pattern) instead of per-session inline cards.
- Add-task **modal** (on `overlay-shell.tsx`); task **detail side panel** (reuse `TaskFieldsPanel`).

**Tier 2 — Navigation shell + view split (large, architectural — pivotal decision)**
- Build the **sidebar (desktop) + bottom nav (mobile)**; requires deciding multi-route vs. single-screen view-switching.
- Promote `TaskList` into a standalone **Zadania** view with tabs (Aktywne/Ukończone — *not* Planowane).
- New primitives needed first: **Tabs**, **Select/Dropdown**, extracted **Button/Segmented**.
- **Relocate** existing theme/lang/notification/audio controls into a **Settings** view *(⚠ PRD-conflict — see below)*.

**Tier 3 — PRD-conflicting / net-new (gated; may be out of scope for this refactor)**
- **Plan dnia timeline** (conflicts PRD "capacity budget"; net-new UI + likely schedule model).
- **Podsumowanie charts dashboard** (conflicts PRD "no analytics dashboard"; needs a chart lib).
- Task **Projekt/Podzadania/Opis/Notatki** (net-new data model + backend).
- **Nature-photo hero backgrounds** (net-new assets).

---

## 🚦 Graphics entry gates — DELIVERED (2026-07-04)

**Status: all assets supplied by the user.** Light + dark variants for all 5 heroes (incl. the two optional ones) live in **`public/images/heroes/`**. Format is **PNG for now** (optional PNG→WebP conversion is a nice-to-have, not a blocker). The entry gates below are therefore **cleared** — `/10x-plan` can sequence the photo-dependent phases without waiting.

| Asset (light + `-dark`) | File | Delivered size | Target aspect |
|---|---|---|---|
| Focus session background | `focus-session-bg.png` / `-dark.png` | 1672×941 | ~16:9 ✓ |
| Break-screen image | `break-restoration.png` / `-dark.png` | 1122×1402 | ~4:5 ✓ |
| Onboarding / anon hero | `onboarding-hero.png` / `-dark.png` | 1774×887 | 2:1 ✓ |
| "Twój dzień" thumbnail | `day-summary-thumb.png` / `-dark.png` | 1774×887 | 2:1 ✓ |
| Podsumowanie footer band | `summary-footer.png` / `-dark.png` | 2172×724 | ~3:1 |

Notes for the plan:
- **Dark variants exist** → wire each hero via the app's `data-theme` attribute (light/dark asset swap); no CSS scrim workaround needed. A soft readability scrim over `focus-session-bg` / `onboarding-hero` (text overlays) is still advisable.
- `focus-session-bg` at 1672×941 is slightly below the 2560×1440 ideal for a full-bleed 4K background — acceptable for MVP; flag if it looks soft on large displays.
- The app has **no `next/image` usage or `next.config` images block today** and stores static assets in `public/` — the plan introduces raster hero rendering (via `next/image` or CSS `background-image`).

## 🚦 Graphics entry gates (original — user must supply assets)

Per the brief, any phase consuming a specific graphic is gated on the user delivering it. Current illustration system is **inline SVG botanical only** — the following mockup visuals have **no asset in the repo** and are blockers:

- **Full-bleed session background** (mountain-lake nature scene behind the timer — `grafiki-aplikacji.png`, `main-page-anon.png`). → **ENTRY GATE: user supplies hero illustration/photo.**
- **Break screen photo** (coffee cup / window greenery — `grafiki-aplikacji.png`). → **ENTRY GATE: user supplies break illustration/photo.**
- **Anon/onboarding hero** (landscape in `main-page-anon.png`). → **ENTRY GATE: user supplies onboarding hero.**
- Any **Podsumowanie/Plan dnia decorative scenes** if those tiers proceed. → **ENTRY GATE** as applicable.
- *Not gated:* the leaf/sprig logo mark and small botanical accents already exist as SVG (`CalmGardenSprig`, `HomeHeroSprig`) and are theme-aware — reuse, no new asset needed.

---

## Code References

- `src/app/page.tsx:8` — sole content route `/`
- `src/app/layout.tsx:71` — root layout; single top navbar, no shell
- `src/app/_components/app-navbar.tsx:21` — top bar (brand + controls, no nav items)
- `src/app/_components/pomodoro-dashboard.tsx:122` / `:955` — home body + 2-col workbench grid
- `src/lib/home/home-session-state.ts:328` — cycle-phase → module placement state machine
- `src/app/_components/timer-panel.tsx:152` — numeric mono timer (not a ring)
- `src/app/_components/session-steering-card.tsx:20` / `:60` — energy + session-goal cards (clutter source)
- `src/app/_components/focus-budget-prompt.tsx:22` — once-per-day gate pattern to reuse
- `src/app/_components/task-list.tsx:103` / `:274` / `:906` — task badges, row, inline create form
- `src/app/_components/task-fields-panel.tsx:194` — inline attribute editor (edit mode)
- `src/lib/data-mode/types.ts:26` — `DomainTaskStatus = active|completed|archived` (no `planned`)
- `src/styles/globals.css:12` — light `@theme` tokens (accent `#736d62`)
- `DESIGN.md` (repo root) — canonical token/spec source
- `src/lib/design/theme.ts`, `theme-provider.tsx`, `theme-script.tsx` — full light/dark/system engine
- `src/app/_components/header-preference-controls.tsx:10` — shipped theme toggle
- `src/app/_components/overlay-shell.tsx` — reusable modal primitive (`OverlayScrim`/`OverlayCard`)
- `src/lib/design/illustrations/` — botanical SVG illustration system + leaf logo mark

## Architecture Insights

- **State-driven composition, not routing.** The home screen re-composes per cycle phase. A multi-view redesign must decide whether nav sections become **routes** (App Router pages, prefetch per view) or **client view-switches** layered over the existing state machine. This choice ripples through the whole plan and is the first thing `/10x-plan` must settle.
- **Token architecture is a force multiplier.** Because color/space/type are centralized (globals.css `@theme` + DESIGN.md), the "aesthetic" half of the redesign is cheap and low-risk.
- **Wedge/overlay discipline is a live hazard.** Lessons L-"wedge" ([context/foundation/lessons.md:66](context/foundation/lessons.md)) warns that transition/overlay changes routinely regress into dead-ends. Moving steering to a day-start gate and adding an add-task modal touch this machinery — every gate needs a dismiss-oracle test.
- **Latency contract** (L-04): each new interactive surface (modal save, nav switch, inline edit) needs its own perceived-latency guard, not just the slice.

## Historical Context (from prior changes)

- **PRD is the binding constraint** and *disagrees with the mockups* on three views:
  - `context/foundation/prd.md:206` — "No full analytics dashboard — no charts, trends, or weekly reports. Daily recap is a light narrative footprint only." → blocks **Podsumowanie** charts.
  - `context/foundation/prd.md:650` / `:585` — settings live on the hub, "not a separate settings page in v1." → blocks **Ustawienia** page.
  - `context/foundation/prd.md:144` / `:188` — "daily standing tasks with focus-hours capacity budget." → **Plan dnia** = budget, not timeline.
- `context/foundation/redesign.md:254–262` — the aspirational 5-section nav (sidebar + mobile bottom bar); a foundation vision doc, **not** yet reconciled with the PRD.
- `context/foundation/roadmap.md` (S-40 `home-ia-reset`) — most recent IA work rearranged modules *within* the single home screen, confirming multi-section nav is greenfield.
- Prior design changes to reuse rather than redo: `serene-pastel-rebrand`, `impeccable-design-foundation`, `focus-home-visual-craft`, `wellness-illustration-foundation`, `stateful-illustration-system` (all in `context/archive/`).

## Related Research

- `context/foundation/makiety/redesign.md`, `branding.md` — the target vision & voice (source material for this change).
- `context/foundation/prd.md`, `roadmap.md` — the current product contract this redesign must be reconciled against.

## Open Questions

1. ~~**PRD reconciliation (blocking):**~~ **RESOLVED** — see [Scope Decisions](#scope-decisions-2026-07-04). Plan dnia = budget-only (no PRD change); Podsumowanie = full charts (amend PRD); Ustawienia = relocate existing settings (amend PRD).
2. ~~**Hallucinated task fields:**~~ **RESOLVED** — Projekt and "Planowane" tab are **IN**; Podzadania and Opis/Notatki are **OUT**.
3. ~~**Navigation architecture:**~~ **RESOLVED (2026-07-04)** — **Multi-route App Router** with cycle/session state **lifted into a shared layout** (layouts don't unmount on child-route navigation → timer keeps ticking across sections). Real URLs + deep-linking; costs an upfront lift of `usePomodoroCycle` out of the dashboard into a layout-level provider.
4. ~~**Timer ring:**~~ **RESOLVED** — **In scope, bundled into the restyle tier** (not a separate deferred phase). Note: this changes the most-tested component alongside styling; the phase must carry timer/cycle test coverage.
5. ~~**Charting library:**~~ **RESOLVED** — **visx** (D3 primitives): low-level, unstyled, composable, CSS-variable-themeable — fits the hand-rolled/no-Radix `DESIGN.md` stance. Adds one dependency (`@visx/*`).
6. ~~**Graphics:**~~ **RESOLVED + DELIVERED (2026-07-04)** — assets supplied by the user; see [Graphics — delivered](#graphics-entry-gates-delivered-2026-07-04). Photo entry gates are now **satisfied**; the only follow-up is an optional PNG→WebP conversion.
