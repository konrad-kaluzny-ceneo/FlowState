# UI Redesign — Align the App with the `makiety` Mockups — Plan Brief

> Full plan: `context/changes/ui-refactor/plan.md`
> Research: `context/changes/ui-refactor/research.md`

## What & Why

Transform FlowState from a deliberately single-screen SPA into the mockups' **5-section wellbeing app** (Fokus / Zadania / Plan dnia / Podsumowanie / Ustawienia) with a nav shell, a large ring timer, minimal task cards, and a muted-green aesthetic. The redesign's north star: *"jeden ekran = jedna decyzja"* — separate planning from doing, keep the focus screen calm, and make the timer the heart of the app. Ships as **one PR** across **12 phases**.

## Starting Point

Today the app has one `/` route; the home screen is a cycle-phase state machine (`deriveHomeSessionState`) that composes 9 modules into a 2-column grid. The timer is a numeric mono countdown, task cards are busy, and settings are scattered across the header/timer/user-menu. The design substrate is strong: Tailwind v4 `@theme` tokens, a full light/dark engine, a botanical SVG illustration system, and a modal primitive — but the accent is taupe, not green, and there is no nav shell.

## Desired End State

A calm, timer-centric **Fokus** screen (ring timer, current task, day progress, once-per-day energy/goal gate, immersive backdrop during work); a **Zadania** planning view (minimal cards, Aktywne/Planowane/Ukończone tabs, add-task modal, detail side panel with a Projekt field); a **Plan dnia** focus-hours budget; a **Podsumowanie** KPI + charts dashboard; and an **Ustawienia** page. A sidebar + mobile bottom nav connect them, and the timer keeps ticking across navigation. The whole app wears the muted-green, airy look in light and dark.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Navigation architecture | Multi-route App Router, cycle state lifted to a layout provider | Real URLs + deep-linking; layout doesn't unmount so the timer survives navigation | Research |
| Plan dnia | Budget only, no timeline | PRD-compliant; mockup timeline overridden | Research |
| Podsumowanie | Full charts via **visx** | Themeable, hand-rolled-friendly; PRD amended | Research |
| Ustawienia | Relocate existing controls only | No net-new settings; PRD amended | Research |
| Task fields | `Projekt` in, `Planowane` tab in; subtasks/opis/notatki out | Redesign value without net-new subsystems | Research |
| Fokus state machine | Keep it, re-stage per mockup | Matches mockup while preserving cycle correctness + wedge safety | Plan |
| Analytics scope | Build-to-data + light aggregation | Charts derive from existing cycle/type data; best-time + history deferred | Plan |
| `project` field | Freeform string + typeahead | Minimal model/migration; no CRUD entity | Plan |
| `planned` lifecycle | Planned = manual backlog; daily-standing stay active; focusing auto-promotes | Coherent plan-vs-execute split without starving the focus engine | Plan |
| Focus hero | Immersive full-bleed only during active work | Uses the asset meaningfully without cluttering idle | Plan |
| Guest route access | All 5 routes guest-public | Preserves today's no-account trial through the route split | Plan (review) |
| Airier scale | Introduce `--radius-*`/`--text-*` tokens | No such tokens exist today; keeps scale single-source per DESIGN.md | Plan (review) |
| Sequencing | Restyle-first, shell-last | Earliest payoff; riskiest cycle-lift lands last against finished pieces | Plan |

## Scope

**In scope:** green retint + scale; shared primitives (Button/Segmented/Tabs/Select/modal); ring timer; `project` + `planned` (model→backend→UI); Zadania view (cards/tabs/modal/detail); Fokus recomposition + heroes; Plan dnia budget restyle; Podsumowanie charts (today-scoped); Ustawienia relocation; cycle-state lift; nav shell + routes; polish + regression.

**Out of scope:** Plan dnia timeline; net-new settings (sync, privacy, backup, delete-all, editable name, auto-start breaks, time-format); subtasks/opis/notatki; managed project entity; multi-day analytics history + best-time curve; any new tracking backend beyond the `project` column + recap-query augmentation.

## Architecture / Approach

Build the aesthetic substrate (tokens → primitives) first, then the two touchy isolated pieces (ring timer, task model), then each view as a **standalone component temporarily hosted on home**. Phase 10 lifts `usePomodoroCycle` into a layout-level `PomodoroCycleProvider` (wrapping the existing hook — its own tests stay valid). Phase 11 adds the nav shell + routes that wire the finished views into their final homes. Every view is authored against the shared primitives/tokens so the shell phase is pure composition, not rework.

## Phases at a Glance

| Phase | Delivers | Key risk |
| --- | --- | --- |
| 1. Design tokens & scale | Green retint + airier scale, dark parity | Contrast regressions in dark mode |
| 2. Shared primitives | Button/Segmented/Tabs/Select/modal | A11y correctness of hand-rolled Tabs/Select |
| 3. Ring timer | SVG ring countdown | Touches the most-tested component |
| 4. Tasks model & backend | `project` + `planned` + lifecycle | Default-status fork rippling into suggestions/Daily |
| 5. Zadania view | Cards/tabs/modal/detail panel | Reworking dense task UI without losing behavior |
| 6. Fokus recomposition | Calm timer screen + day-start gate + heroes | Wedge/dead-end in the day-start gate |
| 7. Plan dnia view | Restyled focus-hours budget | Low — restyle only |
| 8. Podsumowanie dashboard | KPI + charts (visx) | Chart data fidelity; bundle size |
| 9. Ustawienia page | Relocated settings | Duplicate/broken controls left behind |
| 10. Cycle-state lift | Layout-level cycle provider | Single-instance ticking correctness (highest risk) |
| 11. Nav shell + routes | Sidebar/bottom nav + real routes | Timer must survive navigation |
| 12. Hero + polish + regression | Remaining heroes, responsive/dark/a11y sweep | Regression surface across all views |

**Prerequisites:** Graphics delivered (`public/images/heroes/`); PRD amendments landed; visx to be added in Phase 8 (in `dependencies`, not `devDependencies`). Work lands on `features/ui-refactor`.
**Estimated effort:** Large — ~12 phases; roughly 8–12 focused sessions, front-loaded on aesthetics, back-loaded on the shell/lift integration.

## Open Risks & Assumptions

- Lifting the ~3,750-line cycle hook is more than a context wrap: the hook takes 4 page-derived props and sits above the auth/guest task-source branch, so those must be lifted too, and `pomodoro-dashboard.test.tsx`'s module-path hook mock needs reworking. The hook's own `renderHook` tests do stay valid. Still the riskiest phase, and must mount exactly once (per-instance Worker + `visibilitychange` listener).
- Defaulting new tasks to `planned` touches `status` at 4+ enforcement sites — two fail hard if missed: the mapper allow-list throws in dev, and the guest Zod enum silently discards the whole snapshot (data loss). The default fork must be mirrored in 3 creation paths.
- The route split will bounce guests to sign-in unless the guest-public allow-list (`public-paths.ts`) is widened to all 5 routes — decided in, but easy to forget.
- Some Podsumowanie widgets (best-time-of-day, date navigation) are deferred with placeholders — the dashboard won't be 100% pixel-complete vs. the mockup this pass. The session-type donut needs an "uncategorized" bucket for cycles with no task (`taskId` is nullable).

## Success Criteria (Summary)

- Every mockup section is reachable and matches the design in light + dark at mobile/tablet/desktop.
- A user can plan in Zadania/Plan dnia, focus on Fokus with the ring timer + immersive backdrop, and review in Podsumowanie — with the timer never resetting across navigation.
- All `pnpm test` / `pnpm test:e2e` / `pnpm test:e2e:a11y` green and `pnpm build` succeeds.
