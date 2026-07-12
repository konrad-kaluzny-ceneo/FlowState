# Remove the redundant "Wstrzymaj i zakończ sesję" button — Plan Brief

> Full plan: `context/changes/fix-pause-decouple-end-session/plan.md`
> Frame brief: `context/changes/fix-pause-decouple-end-session/frame.md`

## What & Why

The "Wstrzymaj i zakończ sesję" button is a redundant third control — pause and end already exist as independent affordances (the ⏸/▶ icon in the timer card and the "Zakończ sesję" button) — so it should be **removed**, not relabeled. Relabeling it to "Wstrzymaj" (the original request) would place a second pure-pause button next to the timer card's existing icon pause.

## Starting Point

During a running session the timer hub stacks three controls: the ⏸/▶ Pause⇄Resume icon inside the timer card (`timer-panel.tsx:152-172`), the coupled "Wstrzymaj i zakończ sesję" text button that pauses **and** opens the end confirm (`pomodoro-dashboard.tsx:322-328`), and the plain "Zakończ sesję" end button (`:310-320`). `handleEndSessionClick` already opens the calm `after-pause` confirm variant when paused, so ending-after-pause needs no new code.

## Desired End State

A running session shows exactly two controls below the timer: the ⏸/▶ pause icon and "Zakończ sesję". The pause→end journey still works — ⏸ then "Zakończ sesję" yields the after-pause confirm → closure. No `dashboard.pauseEndSession` string remains in either locale, and the after-pause variant stays covered at both the unit and e2e layers.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Relabel vs remove | Remove the coupled button | A pure pause already exists (⏸ icon), so the button is redundant, not mislabeled | Frame |
| Pause→end journey | Preserve via two taps | ⏸ then "Zakończ sesję" already reaches the after-pause confirm — no capability lost | Frame |
| E2E coupled-path test | Rewrite to two-tap journey | Keeps end-to-end proof of pause→end closure via the surviving controls | Plan |
| Unit after-pause coverage | Replace with paused-state test | The removed test was the only unit assertion of the after-pause variant; re-home it onto `end-session-btn` | Plan |

## Scope

**In scope:**
- Delete the `pause-and-end-session-btn` button JSX + `handlePauseAndEndSessionClick`
- Remove the orphaned `Session.dashboard.pauseEndSession` key from `pl.json` + `en.json`
- Update unit tests (drop 2 coupled tests, add a paused-state after-pause test)
- Rewrite the e2e journey test to the two-tap path

**Out of scope:**
- Relabeling the button; touching `TimerPanel` pause/resume/interrupt
- `handleEndSessionClick`, `EndSessionConfirmOverlay`, `end-session-copy.ts`, and the `after-pause` copy (all stay in use)
- Restyling/repositioning "Zakończ sesję" beyond it becoming the lone button
- Any change to pause/resume/end or closure semantics

## Architecture / Approach

Pure UI removal plus test re-homing. The coupled button was a convenience shortcut over two controls that already stand alone; deleting it leaves pause (timer card) and end ("Zakończ sesję") as clean single-purpose controls. No data, schema, or API changes.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Remove button + fix unit coverage | Button/handler/i18n key gone; unit suite green with a paused-state after-pause test | Missing a `pauseEndSession` reference (mitigated by grep gate) |
| 2. Rewrite e2e journey | Coupled-button e2e converted to ⏸ → "Zakończ sesję" two-tap path | `timer-pause` locator/ timing flakiness in Playwright |

**Prerequisites:** None — all touched files exist and are read.
**Estimated effort:** ~1 session across 2 phases.

## Open Risks & Assumptions

- Assumes `dashboard.pauseEndSession` has no references outside `pomodoro-dashboard.tsx:1338` (verified by repo-wide grep at plan time).
- Assumes the `timer-pause` icon is reliably clickable in e2e while running (it renders whenever `state === "running"`).

## Success Criteria (Summary)

- Running session shows only ⏸ and "Zakończ sesję"; the coupled button and its i18n key are gone.
- Pause (⏸) then "Zakończ sesję" still reaches the after-pause confirm → closure, verified at unit and e2e layers.
- `pnpm typecheck`, `pnpm check`, the dashboard unit spec, and the rewritten e2e spec all pass.
