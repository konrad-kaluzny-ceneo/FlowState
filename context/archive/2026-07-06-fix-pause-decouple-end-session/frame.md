# Frame Brief: Decouple pause from end — the coupled button is redundant

> Framing step before /10x-plan. This document captures what is *actually*
> at issue, separated from what was initially assumed.

## Reported Observation

During a running session, the text button labeled **"Wstrzymaj i zakończ sesję"**
(Pause & end session) pauses the timer and then immediately opens the end-session
confirmation popup. Directly below it sits a separate **"Zakończ sesję"** (End session)
button.

## Initial Framing (preserved)

- **User's stated cause or approach**: The end popup does not belong in a "pause"
  function — the button should just pause.
- **User's proposed direction**: Relabel "Wstrzymaj i zakończ sesję" → "Wstrzymaj"
  and strip the end popup out of it; the "Zakończ sesję" button below already handles ending.
- **Pre-dispatch narrowing**: When shown that a pure Pause⇄Resume control already exists
  as the ⏸/▶ icon button inside the timer card, the user chose **"It's redundant — remove it"**:
  the coupled button is surplus and should be dropped, not relabeled.

## Dimension Map

The observation ("this button does two things") could originate at any of these dimensions:

1. **Label/behavior of the coupled button** — assumes the fix is to change *this* button's
   label + drop the popup. ← initial framing
2. **Redundancy with the existing timer-card pause** — a pure Pause⇄Resume already exists
   inside the `TimerPanel`; the coupled button duplicates the pause half.
3. **Discoverability of the existing pause** — maybe the icon-only pause isn't recognized as
   "pause", so a labeled text pause is genuinely wanted.
4. **The end-session flow itself** — whether "Zakończ sesję" is reachable and correct while
   running *and* paused (i.e. does removing the coupled path lose the calm "pause-then-end"
   journey B-09 built).

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| D1: Fix is relabel + decouple *this* button | Literal request. But `TimerPanel` already renders a pure pause (`timer-pause`, `src/app/_components/timer-panel.tsx:162-172`) ⇄ resume (`timer-resume`, `:152-161`). Relabeling would create a **second, duplicate** pure-pause next to the icon one. | WEAK (technically works, but redundant) |
| D2: Coupled button is redundant → remove it | Pause exists (timer card, `timer-panel.tsx:152-172`); End exists (`end-session-btn`, `pomodoro-dashboard.tsx:341-349`). The coupled button `handlePauseAndEndSessionClick` (`:322-328`) just does pause→open-end-overlay — a convenience combo of two controls that already stand alone. User explicitly chose removal. | STRONG |
| D3: Icon pause not discoverable → want labeled pause | No evidence the user wants a labeled pause; when shown the icon pause exists, user chose "remove", not "relabel". | NONE |
| D4: End flow broken while paused | `handleEndSessionClick` handles running *and* paused, selecting the `"after-pause"` confirm variant when paused (`pomodoro-dashboard.tsx:310-320`); e2e proves the standalone end path works (`e2e/session-closure.spec.ts:37-64`). Pause-then-end journey fully preserved via two controls. | NONE (flow is healthy) |

## Narrowing Signals

- **Decisive:** A pure Pause⇄Resume control already exists inside the timer card
  (`timer-panel.tsx:152-172`), independent of the button block below. This is what makes
  the literal relabel redundant and reframes the fix toward removal.
- User, shown this, explicitly chose **"It's redundant — remove it."**
- The "pause → end" journey survives removal: ⏸ (timer card) then "Zakończ sesję" already
  yields the same `after-pause` closure overlay B-09 designed (`pomodoro-dashboard.tsx:310-320`).

## Cross-System Convention

B-09 (`context/archive/2026-06-23-pause-and-end-session/`) shipped the coupled button as a
"dual calm exit — freeze the timer, then confirm closure." That intent is now served by two
already-present independent controls (card pause + "Zakończ sesję"), so the combined shortcut
is convention drift/redundancy rather than a load-bearing path. The e2e suite already covers
the standalone end-session path (`e2e/session-closure.spec.ts:37-64`).

## Reframed Problem Statement

> **The actual problem to plan around is**: the "Wstrzymaj i zakończ sesję" button is a
> redundant third control — pause and end already exist as independent affordances (the
> ⏸/▶ icon in the timer card and the "Zakończ sesję" button) — so it should be **removed**,
> not relabeled.

Relabeling it to "Wstrzymaj" (the literal request) would place a second pure-pause button
directly beside the timer card's existing icon pause. Removing the coupled button instead
leaves two clean, single-purpose controls and preserves the calm "pause-then-end" journey
(pause via the card, then "Zakończ sesję", which already renders the `after-pause` confirm
copy while paused).

## Confidence

**HIGH** — strong file-cited evidence that a pure pause already exists and that end works
standalone while paused; a decisive user choice; and confirmation that removal loses no
capability. The only open item is cleanup scope, not direction.

## What Changes for /10x-plan

Plan a **removal**, not a relabel: delete the "Wstrzymaj i zakończ sesję" button and its
`handlePauseAndEndSessionClick` handler (`pomodoro-dashboard.tsx:322-328, 1330-1340`), retire
the now-orphaned `dashboard.pauseEndSession` message key (`messages/pl.json:115`,
`messages/en.json`), and **rewrite** the e2e coupled-path case (`e2e/session-closure.spec.ts:79-105`)
to drive the two-step journey (⏸ `timer-pause` → `end-session-btn` → confirm) so the
pause-then-end coverage survives. Verify `handleEndSessionClick`'s `after-pause` variant
still fires when the user pauses via the timer card and then ends.

## References

- Source files: `src/app/_components/pomodoro-dashboard.tsx:310-343`, `:1328-1351`;
  `src/app/_components/timer-panel.tsx:96-183`; `src/lib/session/end-session-copy.ts`;
  `messages/pl.json:113-117`; `e2e/session-closure.spec.ts:37-105`
- Bug report: `context/changes/fix-pause-decouple-end-session/bug.md`
- Prior feature (introduced the coupling): `context/archive/2026-06-23-pause-and-end-session/` (B-09)
- Investigation: read directly (small surface; no sub-agents dispatched per guardrails #6/#7)
