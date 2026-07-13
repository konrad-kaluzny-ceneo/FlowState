# Frame Brief: "Sugerowane następne zadanie" on the break view

> Framing step before /10x-plan. This document captures what is *actually*
> at issue, separated from what was initially assumed.

## Reported Observation

The next-task suggestion card ("Sugerowane następne zadanie") appears on the
break view, and stays visible **throughout the running break** (user-confirmed:
"the whole break", not a transient flash at the boundary).

## Initial Framing (preserved)

- **User's stated cause or approach**: "To bug" — the suggestion showing on the
  break view is a defect.
- **User's proposed direction**: Hide the suggestion on the break view.
- **Pre-dispatch narrowing**: User reports the card shows *throughout the whole
  break* (rules out a transient lifecycle leak); user is *not sure* whether this
  is new behavior or long-standing.

## Dimension Map

The observation could originate at any of these dimensions:

1. **Intended design** — suggestion-on-break was deliberately built and other
   features were designed around it.  ← **confirmed origin**
2. **Recent regression** — a change (ui-refactor / ui-improvement, S-33, S-40)
   flipped priority so the suggestion now shows when it previously didn't.
3. **Conductor inconsistency** — suggestion bypasses the F-07 "one gate per beat"
   intent and wrongly competes with the calm break.
4. **Lifecycle leak** — `pendingSuggestion` fails to clear at break start and
   lingers as stale state.

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| 1. Intended design | Gate `showSuggestionCard = … && isBreakRunning …` added at feature birth ([pomodoro-dashboard.tsx:376-388](../../../src/app/_components/pomodoro-dashboard.tsx)); documented in `user-flow.md:174-182` ("break running + suggestion ready → pre-focus next WORK"), S-06 research ("show suggestion as a persistent, non-blocking card during the break"), S-15 mutual-exclusion with kickoff. | **STRONG** |
| 2. Recent regression | Introduced 2026-06-07 in commit `0199724f` (S-06/FLO-13), ~29 days ago and before the "recent" window. Later commits only *tightened* the gate. ui-refactor/ui-improvement rearranged rendering but preserved the gate. | **NONE** |
| 3. Conductor inconsistency | F-07 conductor manages only closure/wind-down/check-in/cycle-complete ([transition-conductor.ts:1-6, 53-58](../../../src/lib/wedge/transition-conductor.ts)); suggestion is *deliberately inline*, like session steering — not a conductor violation. | **WEAK** |
| 4. Lifecycle leak | `pendingSuggestion` is populated at break start (`fetchPostCheckInSuggestion`) and only cleared on cycle advance/reset/wind-down — no mid-break clear. Persisting through the break is the *designed* lifecycle. ([use-pomodoro-cycle.ts:1239-1358](../../../src/hooks/use-pomodoro-cycle.ts)) | **NONE** |

## Narrowing Signals

- User confirms the card persists **throughout the break** → matches the
  `isBreakRunning` gate exactly; rules out a transient/stale leak (dimensions 4).
- Independent git-history investigation (primed to look for a *regression*)
  concluded the behavior is original and long-standing — a cross-check from the
  opposite bias landed on "intentional," not "regression."
- S-33 break atmosphere (2026-06-23) was **retrofitted to yield** to the
  already-existing suggestion card ([break-atmosphere.ts:14](../../../src/lib/design/break-atmosphere.ts)),
  not to remove it — the two were not co-designed; S-33 accepted the suggestion
  as a deliberate part of the break.

## Cross-System Convention

The wedge promise is "system suggests the *next* task with rationale, user keeps
override freedom." That handoff is currently delivered **during the break**. It
is **not solely** dependent on the break card: `computeKickoffEligible` includes
a `postBreakIdleFlag` ([transition-conductor.ts:132-152](../../../src/lib/wedge/transition-conductor.ts)),
so after a break ends → idle, a **kickoff suggestion** can present the next task.
This means relocating the handoff off the break is feasible without dropping the
wedge promise — the post-break idle beat already exists to carry it.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: a product decision — *not a bug fix.*
> The next-task suggestion should surface **only** as the star (gwiazdka) in the
> "Gotów skupić się na" (Ready to focus) view, and **never** as a standalone
> inline panel — on the break *or* anywhere else.

The suggestion-on-break is intentional, documented, long-standing design (S-06),
and S-33's calm break atmosphere was built to coexist with it. So "it's a bug"
is a misframe — but the observation is real and the user has made a deliberate
design decision (below) to collapse the feature to a single surface.

## Product Decision (user, 2026-07-06)

> "Jedyne miejsce, gdzie ma wyświetlać się ten feature, to jako gwiazdka w
> widoku 'Gotów skupić się na', nie ma być widoczny jako osobny panel. Jeżeli
> gdzieś znajduje się informacja o innej decyzji, będzie trzeba ją usunąć."

Translated + concretized against the code:

- **Keep** the suggestion as the **star** — `FocusReadySuggestionStar`
  ([focus-ready-state.tsx:107-127](../../../src/app/_components/focus-ready-state.tsx))
  shown next to the auto-suggested task in the "Gotów skupić się na" view
  (`Timer.idleReadyToFocusOn`), which opens the explanation popup
  ([focus-ready-state.tsx:375-393](../../../src/app/_components/focus-ready-state.tsx)).
  The `TaskSuggestionCard` used *inside that star popup* is allowed — it is part
  of the star surface, not a standalone panel.
- **Scope confirmed (2026-07-06):** remove **both** standalone panels below —
  the break panel *and* the idle kickoff panel (the star is already the idle
  surface; the kickoff panel is suppressed whenever the ready-to-focus view
  shows, so it's a rarely-rendered fallback).
- **Remove** the standalone inline `TaskSuggestionCard` panel everywhere it is
  rendered as its own block in the dashboard:
  - `breakSuggestionCard` (on the running break)
    ([pomodoro-dashboard.tsx:872-913](../../../src/app/_components/pomodoro-dashboard.tsx))
  - `kickoffSuggestionCard` (idle kickoff, when not embedded in FocusReadyState)
    ([pomodoro-dashboard.tsx:915-950](../../../src/app/_components/pomodoro-dashboard.tsx))
- **Purge contradicting docs** that state the suggestion should appear as a
  panel / during the break, so the repo has one source of truth: at minimum
  `context/foundation/user-flow.md:174-182` (break-running suggestion row) and
  any S-06 UX notes describing a "persistent card during the break." (Archived
  research is historical record — update forward-looking docs; note, don't
  rewrite, the archive.)

## Confidence

**HIGH** — that this is intentional design (not a regression/defect) AND the
user's target decision is now unambiguous and maps to concrete code seams. Two
independent investigations (one adversarially primed for regression) agree on
the design origin; the single-surface decision is the user's explicit product
call, captured verbatim above.

## What Changes for /10x-plan

Plan this as a **deliberate single-surface consolidation**, not a bug revert.
Scope:
1. **Break**: make `showSuggestionCard` never true → the inline break panel is
   gone and S-33 break atmosphere ([break-atmosphere.ts](../../../src/lib/design/break-atmosphere.ts))
   shows on the break unconditionally (its `suggestionCardOnBreak` input becomes
   constant-false → prune it).
2. **Idle kickoff**: stop rendering `kickoffSuggestionCard` as a standalone
   panel; the FocusReadyState star already carries the kickoff suggestion (via
   `autoSuggestedTaskId` + `suggestionPopup`). Verify the calm-landing path
   (`showFocusReadyState`) covers the cases the standalone card previously did,
   so no next-task handoff is silently dropped.
3. **Handoff integrity**: confirm the wedge promise ("suggest next task +
   override") still holds through the star surface alone across break-end → idle;
   check the post-break idle path (`postBreakIdleFlag` in `computeKickoffEligible`).
4. **Docs**: update `user-flow.md` and any forward-looking S-06 UX notes to the
   single-surface decision; remove statements asserting the panel/during-break
   behavior.
5. **Tests**: prune/repoint tests that assert the standalone break/kickoff panel
   (e.g. `pomodoro-dashboard.test.tsx`, suggestion e2e helpers) to the star
   surface instead. Heed lesson L (test every wedge transition) — the break-end
   → next-focus handoff must keep a dismiss/accept oracle.

## References

- Source files:
  - [pomodoro-dashboard.tsx:376-388, 468-474, 872-913](../../../src/app/_components/pomodoro-dashboard.tsx)
  - [break-atmosphere.ts:8-22](../../../src/lib/design/break-atmosphere.ts)
  - [transition-conductor.ts:53-58, 132-152](../../../src/lib/wedge/transition-conductor.ts)
  - [use-pomodoro-cycle.ts:1239-1358](../../../src/hooks/use-pomodoro-cycle.ts)
- Design intent: `context/foundation/user-flow.md:174-182`;
  `context/archive/2026-06-07-adaptive-task-suggestion/research.md:44,99-101`;
  `context/archive/2026-06-23-break-restoration-atmosphere/research.md:5-7`
- Introducing commit: `0199724f` (S-06 / FLO-13, 2026-06-07)
- Related research: none (`research.md` not present for this change)
- Investigation agents: design-intent (a...20b), git-history (a...c1)
