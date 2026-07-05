# Frame Brief: Home layout rhythm — "rozjechana" strona główna

> Framing step before /10x-plan. This document captures what is *actually*
> at issue, separated from what was initially assumed.

## Reported Observation

Verbatim: "aplikacja jest rozjechana, brak odpowiednich odstępów między sekcjami."

Home page looks misaligned at **all viewport widths**, on **local dev and
production** alike. Leading symptom (user-picked): uneven vertical spacing
between sections. Screenshot (PL locale, wide desktop, authenticated, idle
state) additionally shows: the collapsed recap bar ("Zrobione: 7 zadań…")
spanning far wider than the task composer/list column below it; large dead
space in the right column below the "Codzienne podsumowanie" card.

## Initial Framing (preserved)

- **User's stated cause or approach**: missing/inadequate spacing between sections.
- **User's proposed direction**: fix the spacing (implicit).
- **Pre-dispatch narrowing**: broken at all widths (not just wide desktop);
  leading symptom = uneven vertical spacing; reproduces on dev **and**
  production (rules out local build artifacts); this is the first item of a
  longer defect list — framed alone.

## Dimension Map

The observation could originate at any of these dimensions:

1. **Empty always-rendered layout regions** — `HomeLayoutRegion` wrappers render
   unconditionally inside `gap-8` flex columns; an empty region doubles the gap
   between its visible siblings, state-dependently.
2. **Flat spacing scale** — one `gap-8` (2rem) at every nesting level; no
   between-section vs within-section distinction.  ← initial framing lands here
3. **Inconsistent width caps between siblings** — components set their own
   `max-w-*`; some override to `lg:max-w-none`, most do not.
4. **Desktop 62/38 workbench grid alignment** — `lg:items-start` rail with short
   content floats in empty space (lg-only; secondary, cannot explain
   all-widths symptom).

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| 1. Empty regions double gaps | All four `HomeLayoutRegion`s unconditional (`pomodoro-dashboard.tsx:939,956,961,986`); `home-inventory-zone` (:956) is **always empty** yet renders on lg; `home-secondary-region` (:961) empty in idle/steering states when inventory hidden; parent column applies `gap-8` between them (:938) → 4rem gaps where 2rem intended, varying with app state | **STRONG** |
| 2. Flat spacing scale (initial framing) | `DESIGN.md:74-78` prescribes semantic `section-gap: 1.5rem` — token **never wired** into Tailwind/globals.css; home surface uses uniform `gap-8` at 5 nesting levels (`home-shell.tsx:100`, `pomodoro-dashboard.tsx:110,905,935,938`); no gap differentiation exists | **STRONG** |
| 3. Width-cap inconsistency | At lg, 3 panels expand (`lg:max-w-none`: `day-memory-line.tsx:43`, `daily-recap-panel.tsx:128`, `home-focus-summary.tsx:80`) while 11 siblings stay `max-w-lg` (task-list.tsx:837, timer-panel.tsx:127, session-steering-card.tsx:30, focus-budget-prompt.tsx:83, task-archive-view.tsx:130, …) → ragged edges; matches screenshot's wide-bar-over-narrow-list | **STRONG** |
| 4. Desktop grid rail alignment | `lg:items-start` grid (:935) pins short rail content top-left of its track; real but lg-only and downstream of 1–3 | WEAK (secondary) |

## Narrowing Signals

- User: broken at **all widths** → rules out "lg breakpoint only" as the full
  story; hypotheses 1–2 apply at every width (empty `home-secondary-region`
  participates in mobile flex flow too; `hidden lg:flex` inventory zone only
  affects lg).
- User: dev **and** production → rules out local CSS build artifacts.
- User picked "uneven vertical spacing" as leading symptom, not the detached
  right panel → the desktop grid (dim. 4) is not the core complaint.
- Screenshot corroborates dimension 3 independently (width raggedness).

## Cross-System Convention

- `DESIGN.md` is the binding design contract (F-04 foundation) and already
  defines the spacing hierarchy the code ignores (`section-gap: 1.5rem`).
- Prior work (S-40 home-ia-reset, S-41 desktop-calm-workbench) shipped the
  region/zone scaffolding with **structural tests only** — S-41 research states
  "jsdom can't measure grid… No belt e2e"
  (`context/archive/2026-06-29-desktop-calm-workbench/research.md:302`). No
  test layer observes visual rhythm, which is why a visually broken layout
  passes a fully green CI.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: the home layout composition layer
> has no enforced contract — regions render even when empty, spacing is one
> flat token applied at every nesting level (ignoring the `section-gap` token
> DESIGN.md prescribes), and width constraints are set per-component instead of
> per-zone.

The user's framing ("spacing between sections") is one of three interacting
defects in the same layer, and fixing gaps alone would leave the ragged widths
and the state-dependent double-gaps in place. The fix target is the
composition contract of `home-shell.tsx` + `pomodoro-dashboard.tsx` (regions,
spacing scale, width ownership), not individual margin tweaks per component.

## Confidence

**HIGH** — three independent sub-agent investigations returned STRONG with
file:line evidence; user's narrowing answers (all widths, dev+prod) match the
predictions of hypotheses 1–2; screenshot matches hypothesis 3; historical
docs explain the missing test signal.

## What Changes for /10x-plan

Plan a single change to the home layout composition contract: (a) regions
render only when non-empty (or contribute no gap), (b) spacing hierarchy wired
from DESIGN.md tokens (section vs intra-section), (c) width constraint owned
by the zone, not by each child. Include a regression oracle for visual rhythm
(the current structural-only test layer cannot catch this class of defect).
Dimension 4 (rail alignment at lg) should be re-checked after (a)–(c) land —
it may resolve itself.

## References

- Source files: `src/app/_components/pomodoro-dashboard.tsx:99-116,905,935,938-989`,
  `src/app/_components/home-shell.tsx:96-121`, `DESIGN.md:74-78`,
  `src/app/_components/day-memory-line.tsx:43`, `src/app/_components/task-list.tsx:837`,
  `src/app/_components/timer-panel.tsx:127`
- Related research: `context/archive/2026-06-29-desktop-calm-workbench/research.md`,
  `context/archive/2026-06-27-home-ia-reset/research.md`
- Investigation: 3 parallel read-only sub-agents (Haiku), hypotheses 1–3;
  findings confirmed via ast-grep 0.43.0 + grep (commands recorded in agent
  reports)
