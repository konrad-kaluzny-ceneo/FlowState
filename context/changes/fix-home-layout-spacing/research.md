---
date: 2026-07-03T16:48:24+02:00
researcher: Claude Fable 5
git_commit: a7b07567c71a0b84030021105267d5945e624353
branch: claude/nice-mayer-9c0cd2
repository: FlowState
topic: "Home page layout spacing defects — mobile header overlap, desktop column alignment, card width mismatch, task-list bottom spacing"
tags: [research, codebase, home-shell, pomodoro-dashboard, task-list, layout, responsive, tailwind]
status: complete
last_updated: 2026-07-03
last_updated_by: Claude Fable 5
last_updated_note: "Integrated prior frame.md (D-01) and mvp-defect-intake register (binding decisions: hero removal D-07, navbar D-06, illustration visibility D-04)"
---

# Research: Home page layout spacing defects

**Date**: 2026-07-03T16:48:24+02:00
**Researcher**: Claude Fable 5
**Git Commit**: a7b07567c71a0b84030021105267d5945e624353
**Branch**: claude/nice-mayer-9c0cd2
**Repository**: FlowState

## Research Question

Post-MVP defect #1: the home page shows several spacing/alignment problems (evidenced by user screenshots):

1. **Mobile header overlap** — on narrow viewports the top bar (EN/PL switch, Jasny/Ciemny/Systemowy theme toggle, user name, "Wyloguj się") overlaps the "Codzienne podsumowanie" card instead of stacking above the content.
2. **Desktop column alignment** — on wide screens the hero (sprig + "FlowState" title) centers over the full page while content sits in a 62% column; a second decorative sprig floats alone in the right column; the right side looks sparse.
3. **Summary bar width** — the collapsible "Zrobione: N zadań…" bar is wider than the energy card / task list below it, so left edges don't line up on desktop.
4. **Task list section spacing** — "Zarchiwizowane zadania" cramped at the bottom; tight badge wrapping on narrow widths.

Plus a general audit of anything else visible in the screenshots.

## Summary

**A prior `/10x-frame` for this change already exists** ([frame.md](frame.md), confidence HIGH, defect D-01 in the intake register) and reframes the problem as a missing **layout composition contract**, not per-component spacing tweaks. This research corroborates the frame's three STRONG hypotheses in live code and adds one genuinely new defect the frame didn't cover (the mobile fixed-header overlap, visible in today's screenshots). Binding product decisions from the defect register (see Historical Context) also fold hero **removal** (D-07) and a **navbar with logo** (D-06) into this change's scope — the register's fix-wave plan explicitly extends `fix-home-layout-spacing` with both.

Root causes, in order of leverage:

1. **Empty always-rendered layout regions** (frame hypothesis 1, STRONG): all four `HomeLayoutRegion` wrappers render unconditionally inside `gap-8` columns ([pomodoro-dashboard.tsx:939,957,961,986](../../../src/app/_components/pomodoro-dashboard.tsx)); an empty region doubles the gap between visible siblings, state-dependently, at every viewport width.
2. **Flat spacing scale** (frame hypothesis 2, STRONG, re-verified at this commit): `DESIGN.md:78` prescribes `section-gap: 1.5rem`, but the token is wired nowhere — `grep section-gap src/styles/globals.css` is empty; the home surface uses uniform `gap-8` (2rem) at five nesting levels.
3. **Width-cap inconsistency** (frame hypothesis 3, STRONG; detailed below): 3 panels opt into `lg:max-w-none` while their siblings stay `max-w-lg` — the "summary bar wider than the cards below" symptom.
4. **Mobile fixed-header overlap** (new, this research): the app header is `fixed top-0 right-0 z-50 p-4` with **zero responsive handling** ([layout.tsx:77](../../../src/app/layout.tsx)) and nothing reserves space for it below `lg`. Not in the frame's dimension map; note that D-06's navbar decision will likely replace this header anyway.

Context: the home layout was deliberately reshaped by three recent slices — S-40 (home IA reset, single-column priority order), S-41 (desktop three-zone workbench behind a single `lg ≥ 1024px` breakpoint, 62/38 grid), and S-43 (state-bound illustrations on hero + desktop rail). Two symptoms from the screenshots resolve against that history rather than as code bugs:

- The "stray" right-column sprig is the S-43 rail illustration slot (`data-testid="home-rail-illustration"`, [pomodoro-dashboard.tsx:877-882](../../../src/app/_components/pomodoro-dashboard.tsx)) — intentional placement, though D-04 in the register overrules its "subtle by design" sizing (visibility revision is a separate fix wave).
- Hero mis-centering is structural (hero centers on the full `lg:max-w-7xl` container, content lives in the 62fr column) — and moot, because D-07 removes the hero section entirely; branding moves to the D-06 navbar.

A minor extra: the archive entry ("Zarchiwizowane zadania") is a bare link button with no own margin, relying only on the parent `space-y-6` ([task-list.tsx:1178](../../../src/app/_components/task-list.tsx)).

There is **no test coverage for any non-desktop viewport** (Playwright runs Desktop Chrome 1280×720 only) and no test layer that observes visual rhythm at all (structural/jsdom oracles only, per S-41 research) — which is why both the mobile overlap and the desktop raggedness shipped through green CI. The frame requires the fix to include a visual-rhythm regression oracle.

## Detailed Findings

### 1. Missing composition contract — empty regions and unwired spacing token (frame hypotheses 1–2)

Carried over from [frame.md](frame.md) and re-verified at commit a7b0756:

- All four `HomeLayoutRegion` wrappers render **unconditionally**: `home-primary-region` ([pomodoro-dashboard.tsx:939](../../../src/app/_components/pomodoro-dashboard.tsx)), `home-inventory-zone` (:957, always empty, `hidden lg:flex`), `home-secondary-region` (:961, empty in idle/steering when inventory is hidden), `home-context-rail` (:986). The parent column applies `gap-8` between them, so an empty region produces a 4rem gap where 2rem was intended — and which gaps double depends on app state (`deriveHomeSessionState` module routing). This operates at **every viewport width**, matching the user's "broken at all widths, dev and prod" narrowing.
- `DESIGN.md:78` prescribes a semantic `spacing.section-gap: 1.5rem` token; it appears **nowhere** in `src/styles/globals.css` or any component. The home surface instead applies one flat `gap-8` (2rem) at five nesting levels ([home-shell.tsx:100](../../../src/app/_components/home-shell.tsx); [pomodoro-dashboard.tsx:110,905,935,938](../../../src/app/_components/pomodoro-dashboard.tsx)) with no between-section vs within-section distinction.
- Frame verdict: the fix target is the composition contract of `home-shell.tsx` + `pomodoro-dashboard.tsx` — (a) regions contribute no gap when empty, (b) spacing hierarchy wired from DESIGN.md tokens, (c) width owned by the zone, not each child (see section 3).

### 2. Header bar — fixed, no mobile handling (defect root cause for symptom 1; new beyond the frame)

- The header is rendered in the root layout, outside `<main>`: `<header className="fixed top-0 right-0 z-50 p-4">` — [src/app/layout.tsx:77](../../../src/app/layout.tsx). It does not participate in document flow, and no element reserves space for it.
- Authenticated contents: `UserMenu` — `flex items-center gap-3` holding `HeaderPreferenceControls` + user name + "Wyloguj się" button ([user-menu.tsx:10-53](../../../src/app/_components/user-menu.tsx)).
- `HeaderPreferenceControls` is `flex items-center gap-2` with two segmented fieldsets (language `data-testid="language-switch"`, theme `data-testid="theme-toggle"`) — [header-preference-controls.tsx:32-75](../../../src/app/_components/header-preference-controls.tsx).
- **No `sm:`/`md:` classes anywhere in this chain** — the row is too wide for phones, wraps text inside its own box, and sits on top of the first content card (on mobile that's the recap panel, which renders in the secondary region inside a `lg:hidden` wrapper — [pomodoro-dashboard.tsx:978](../../../src/app/_components/pomodoro-dashboard.tsx)).
- The content container's `py-16` (64px top padding, [home-shell.tsx:100](../../../src/app/_components/home-shell.tsx)) is the only thing that keeps the header off the content on desktop; on narrow screens the header grows taller than that.

### 3. Desktop card-width inconsistency (frame hypothesis 3; root cause for symptom 3, part of symptom 2)

S-41's convention for primary-column cards is `w-full max-w-lg … lg:max-w-none`. Applied inconsistently:

| Card | File | `lg:max-w-none`? |
|---|---|---|
| DayMemoryLine ("Zrobione: …") | [day-memory-line.tsx:42-44](../../../src/app/_components/day-memory-line.tsx) | ✅ yes |
| DailyRecapPanel ("Codzienne podsumowanie") | [daily-recap-panel.tsx:127-129](../../../src/app/_components/daily-recap-panel.tsx) | ✅ yes |
| HomeFocusSummary | [home-focus-summary.tsx:79-81](../../../src/app/_components/home-focus-summary.tsx) | ✅ yes |
| GuestContextRail | [guest-context-rail.tsx:15-22](../../../src/app/_components/guest-context-rail.tsx) | ✅ yes |
| **SessionSteeringCard ("Jaka jest Twoja energia na start?")** | [session-steering-card.tsx:28-32](../../../src/app/_components/session-steering-card.tsx) | ❌ **no** |
| **TaskList root** | [task-list.tsx:836](../../../src/app/_components/task-list.tsx) (`w-full max-w-lg space-y-6`) | ❌ **no** |
| **OfflineBanner** | [home-shell.tsx:60](../../../src/app/_components/home-shell.tsx) | ❌ **no** |

On desktop the summary bar stretches to the full 62fr column while the energy card and task list stay 512px wide and centered (`HomeLayoutRegion` uses `items-center`), producing the misaligned left edges in the screenshots.

### 4. Page shell and grid structure (context for symptom 2)

- Component tree: `page.tsx` → `HomeShell` → `HomeShellContent` → `<main id="home-shell-main">` → container → hero header + `PomodoroDashboard` ([home-shell.tsx:96-121](../../../src/app/_components/home-shell.tsx)).
- Container: `container flex flex-col items-center justify-center gap-8 px-4 py-16 lg:max-w-7xl` ([home-shell.tsx:100](../../../src/app/_components/home-shell.tsx)).
- Hero: `<header className="space-y-2 text-center">` with `HomeHeroSprig` (`mx-auto mb-1 h-12 w-20 opacity-90`, [home-hero-sprig.tsx:13-35](../../../src/lib/design/illustrations/home-hero-sprig.tsx)), `<h1 className="font-semibold text-4xl tracking-tight">`, purpose header, tagline ([home-shell.tsx:102-117](../../../src/app/_components/home-shell.tsx)). It spans/centers on the **full container width**.
- Dashboard wrapper: `flex w-full max-w-lg flex-col items-center gap-8 lg:max-w-7xl` ([pomodoro-dashboard.tsx:905](../../../src/app/_components/pomodoro-dashboard.tsx)).
- Workbench grid (`data-testid="home-workbench-grid"`): mobile `flex flex-col items-center gap-8`; desktop `lg:grid lg:grid-cols-[minmax(0,62fr)_minmax(0,38fr)] lg:items-start lg:gap-8` ([pomodoro-dashboard.tsx:934-935](../../../src/app/_components/pomodoro-dashboard.tsx)).
- `HomeLayoutRegion` primitive: `flex w-full flex-col items-center gap-8` + optional className (`hidden lg:flex` for inventory zone and context rail) — [pomodoro-dashboard.tsx:99-116](../../../src/app/_components/pomodoro-dashboard.tsx).
- Because the hero centers on 1280px but the content column is 62% of it, the "FlowState" title never aligns with the cards below on desktop. This is a structural consequence of S-41's grid, not a regression.

### 5. Rail illustration — intentional mount, overruled subtlety (symptom 2's "stray icon")

- Authenticated context rail renders, top to bottom: `HomeHeroSprig` in `<div className="w-full" data-testid="home-rail-illustration">`, then `recapPanel`, then `HomeFocusSummary` ([pomodoro-dashboard.tsx:875-895](../../../src/app/_components/pomodoro-dashboard.tsx)).
- This is the S-43 stateful-illustration placement (hero + desktop rail only, never wedge gates; rail slot is auth-only, `hidden lg:flex` via the rail region). The sprig centers itself (`mx-auto`) in the 38fr rail with `gap-8` (32px) to the recap card — visually a lone floating icon when the recap is collapsed or dismissed.
- Any spacing fix here must keep the mount point and the `variant`/`energyTint` prop threading intact ([S-43 plan](../../archive/stateful-illustration-system/plan.md) if archived; see Historical Context).
- **However**: the defect register's decisions log (D-04) overrules S-43's "subtle by design" sizing — illustrations must become clearly visible (size/contrast revision, possibly S-28 phase-2 scrims). That revision is scheduled as fix wave 5, *after* this layout change, because the layout change moves the illustration surfaces. This change should therefore preserve the mounts but not invest in their current visual parameters.

### 6. Task-list internals (symptom 4)

- Root: `w-full max-w-lg space-y-6` — 24px between: create form → "Aktywne (N)" section → "Ukończone (N)" section → archive entry ([task-list.tsx:836-1189](../../../src/app/_components/task-list.tsx)).
- Create form is internally `space-y-2` (8px): input row (`flex gap-2`), persona chips (`flex flex-wrap gap-2`, [persona-preset-picker.tsx:59](../../../src/app/_components/persona-preset-picker.tsx)), preset effort row ("Wysiłek" + input + "Wyczyść", [task-list.tsx:950-977](../../../src/app/_components/task-list.tsx)), daily-standing checkbox.
- Section headers use `mb-2`; card lists `space-y-2`; cards `px-4 py-3` with internal `gap-2`. Badge rows: `flex-wrap gap-x-2 gap-y-1 pl-9` (active) / `pl-7` (completed) — `gap-y-1` (4px) is tight when badges wrap on narrow screens.
- **Archive entry**: plain link-style `<button className="text-sm text-text-secondary underline-offset-2 …">` ("Zarchiwizowane zadania", `data-testid="task-archive-entry"`) inside a wrapper with **no own margin/padding** — spacing comes solely from the parent `space-y-6` ([task-list.tsx:1173-1187](../../../src/app/_components/task-list.tsx)). At the page bottom it sits 24px under the last completed card with nothing after it except the container's `py-16`.
- Long-title handling uses `min-w-0 flex-1 overflow-hidden whitespace-pre-wrap break-all` ([task-list.tsx:445-457](../../../src/app/_components/task-list.tsx)) — the old B-02 clipping bug is handled, though `break-all` gives jagged breaks.

### 7. Styling system and testing gaps

- Tailwind CSS **v4** (`^4.3.0`) via `@tailwindcss/postcss`; all theming through the `@theme` block of semantic tokens in [globals.css:3-63](../../../src/styles/globals.css) with a `[data-theme="dark"]` override block (lines 66-115). **Default breakpoints** — no custom screens.
- Layout responsiveness uses **only the `lg:` prefix**; `sm:` appears only in micro-interactions (energy selector, steering card buttons). No `md:`/`xl:` anywhere. Tablet range 768–1024px gets the mobile single-column layout.
- No shadcn/ui; shared primitives are the card class recipe (`w-full max-w-lg rounded-lg border border-card-border bg-surface-card px-4 py-3 shadow-sm lg:max-w-none`) and `HomeLayoutRegion`.
- **Viewport test coverage**: Playwright runs a single Desktop Chrome project at 1280×720 ([playwright.config.ts:59-74](../../../playwright.config.ts)); no mobile/tablet project. Component tests only assert class names (`lg:hidden`, `lg:max-w-7xl`) in [home-shell.test.tsx](../../../src/app/_components/home-shell.test.tsx), [guest-banner.test.tsx](../../../src/app/_components/guest-banner.test.tsx), [pomodoro-dashboard.test.tsx](../../../src/app/_components/pomodoro-dashboard.test.tsx). This is why the mobile header overlap had no oracle.

## Code References

- `src/app/layout.tsx:77` — fixed header, no responsive classes (mobile overlap root cause)
- `src/app/_components/user-menu.tsx:10-53` — authenticated header row (`flex items-center gap-3`)
- `src/app/_components/header-preference-controls.tsx:32-75` — language + theme segmented controls
- `src/app/_components/home-shell.tsx:96-121` — main shell, container (`px-4 py-16 lg:max-w-7xl`), hero
- `src/app/_components/home-shell.tsx:60` — OfflineBanner missing `lg:max-w-none`
- `src/lib/design/illustrations/home-hero-sprig.tsx:13-35` — sprig illustration (both mounts)
- `src/app/_components/pomodoro-dashboard.tsx:905` — dashboard wrapper (`max-w-lg … lg:max-w-7xl`)
- `src/app/_components/pomodoro-dashboard.tsx:934-935` — 62/38 workbench grid
- `src/app/_components/pomodoro-dashboard.tsx:99-116` — HomeLayoutRegion primitive
- `src/app/_components/pomodoro-dashboard.tsx:875-895` — authenticated context rail (rail sprig at 877-882)
- `src/app/_components/pomodoro-dashboard.tsx:975-978` — mobile-only (`lg:hidden`) focus budget + recap wrappers
- `src/app/_components/day-memory-line.tsx:42-44` — summary bar card (has `lg:max-w-none`)
- `src/app/_components/session-steering-card.tsx:28-32` — energy card (**missing** `lg:max-w-none`)
- `src/app/_components/task-list.tsx:836` — TaskList root (**missing** `lg:max-w-none`)
- `src/app/_components/task-list.tsx:1173-1187` — archive entry, no own spacing
- `src/app/_components/daily-recap-panel.tsx:126-194` — "Codzienne podsumowanie" card
- `src/app/_components/home-focus-summary.tsx:78-90` — rail budget summary
- `src/styles/globals.css:3-115` — Tailwind v4 `@theme` tokens + dark override
- `playwright.config.ts:59-74` — desktop-only E2E viewport

## Architecture Insights

- **Single responsive seam**: the codebase deliberately uses only `lg ≥ 1024px` for layout switching (S-41 decision). A fix should not introduce `md:`/`xl:` without acknowledging it's a new convention; `sm:` is acceptable for micro-adjustments (precedent: energy-selector.tsx).
- **Card width recipe**: `w-full max-w-lg … lg:max-w-none` is the established pattern; the defect is partial application, so the likely fix for symptom 3 is convergence on the recipe, not new layout machinery.
- **Semantic tokens only**: colors/surfaces come from `@theme` CSS variables (`bg-surface-card`, `text-text-secondary`, …), theme-aware via `data-theme`. No hardcoded palette classes in a fix.
- **Home IA is state-derived**: module placement (primary/secondary/hidden) comes from `deriveHomeSessionState()` (S-40); spacing fixes must not reorder modules or make the recap co-primary.
- **Testing convention**: layout behavior is guarded by className-assertion component tests plus desktop-only Playwright. A mobile fix without a mobile-viewport oracle repeats the pattern that let this defect ship (echoes lesson L-04's "each surface needs its own oracle").

## Historical Context (from prior changes)

### This change's own prior artifacts (IMPORTANT — found uncommitted on `main`)

- [frame.md](frame.md) — `/10x-frame` output for defect D-01 ("aplikacja jest rozjechana"), confidence HIGH. Reframes the problem as a missing layout composition contract (empty regions, flat spacing scale, per-component width ownership). **Copied into this worktree from the main working dir**, where it existed only as an untracked file.
- `D:\repos\10xdev\FlowState\context\changes\mvp-defect-intake\change.md` (untracked on `main`, NOT present in this worktree) — the closed post-MVP defect register (D-01…D-11) with a **binding decisions log**: user defect reports override prior design decisions. Directly relevant here:
  - **D-07**: remove the home hero section (title + taglines); S-13/F-06 hero decision overruled. Coupled to D-01 — this change's plan must account for hero removal.
  - **D-06**: add an app navbar with a logo linking to `/`, visible also on `/auth/*` pages. Branding moves from hero to navbar.
  - **D-04**: Calm Garden "subtlety by design" overruled — illustrations must be clearly visible (separate wave 5, after this change).
  - **Fix wave 2** = extend `fix-home-layout-spacing` to cover **D-01 + D-07 + D-06** as one layout/navigation change.
  - ⚠️ Artifact-location risk: both the frame and the register live as uncommitted files in the main working dir; this worktree's change folder was recreated independently. Reconcile before merging (the register should probably be committed, and the two copies of this change folder must not diverge).

### Prior slices

- `context/archive/2026-06-27-home-ia-reset/` (**S-40**) — single-column priority order below `lg`; recap defaults collapsed, hidden during `active_work`; one-dominant-CTA contract. Spacing fixes must not promote the recap or a second CTA to co-primary.
- `context/archive/2026-06-29-desktop-calm-workbench/` (**S-41**) — introduced the `lg` breakpoint, centered 1120–1280px workbench, 62/38 decision/rail split, rail capped at 3 blocks, mobile explicitly left unchanged. The width-recipe convention originates here.
- `context/archive/stateful-illustration-system/` (**S-43**, archived 2026-07-03) — sprig renders on home hero (`home-shell.tsx:98` area) and desktop rail (`pomodoro-dashboard.tsx:807-811` in that plan's numbering; currently 877-882); `hidden lg:flex` rail, auth-only; ≤200ms crossfade idiom. The right-column icon is this, by design.
- `context/archive/2026-06-11-focus-home-visual-craft/` — established `globals.css` design tokens; spacing changes should reuse tokens, not hardcode values.
- `context/foundation/product-voice.md` — "space to breathe" is a voice contract; fixes should favor generous, calm spacing over density.
- `context/foundation/prd.md` (v3) — desktop browsers in scope; recap must stay "light footprint"; mobile support never explicitly scoped in or out for MVP, but S-40/S-41 treat mobile-first order as load-bearing.
- `context/foundation/roadmap.md` — S-40/S-41 done, S-43 just archived; no open slice owns mobile polish, so this defect change is the natural home for the header fix.

## Related Research

- [frame.md](frame.md) — the framing brief for this change (D-01); its hypothesis table is the authoritative root-cause map, corroborated by this document.
- `context/archive/2026-06-29-desktop-calm-workbench/research.md` — S-41 research; notes "jsdom can't measure grid… no belt e2e" (the missing visual-rhythm oracle).
- `context/archive/2026-06-27-home-ia-reset/research.md` — S-40 research on home IA derivation.
- `context/foundation/refactor-opportunities/` — no layout-spacing debt recorded; the monolithic `use-pomodoro-cycle.ts` hook is unrelated to this fix (safe to proceed without waiting on decomposition).

## Open Questions

Resolved by the defect register's decisions log (no longer open): hero alignment (hero is removed, D-07), energy-card width intent (frame: width becomes zone-owned, not per-component), whether the rail sprig placement is a bug (intentional; visibility revised separately in wave 5).

Still open for `/10x-plan`:

1. **Mobile header/navbar composition** — D-06 mandates a navbar with logo (also on `/auth/*`), which supersedes the current fixed top-right header. Open: does the navbar absorb the preference controls (language/theme) and user menu on mobile, and in what arrangement below `lg`? The overlap defect disappears only if the navbar participates in layout flow or reserves its own space.
2. **Spacing token wiring** — DESIGN.md's `spacing.section-gap: 1.5rem` needs a home in `globals.css` `@theme`; decide the token set (section-gap vs intra-section gap) and whether other DESIGN.md spacing tokens (`overlay-padding`, `row-padding-*`) get wired in the same pass.
3. **Empty-region mechanism** — conditional rendering of `HomeLayoutRegion`s vs a CSS approach (e.g., `empty:hidden` / gap-collapsing) — pick one that keeps S-40's testable module-routing intact.
4. **Visual-rhythm oracle** — the frame requires a regression oracle this test stack can't currently express (jsdom is structural-only). Options: Playwright layout assertions (bounding-box checks at 1280 + a mobile viewport, e.g., 375×812), or screenshot diffing. Currently zero non-desktop coverage ([playwright.config.ts:59-74](../../../playwright.config.ts)).
5. **Artifact reconciliation** — commit the register (`mvp-defect-intake`) and unify the two copies of this change folder (worktree vs main working dir) before or at merge time.
