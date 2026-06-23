# Research — break-restoration-atmosphere (S-33)

## Goal

Shift home shell to calm break atmosphere during SHORT_BREAK/LONG_BREAK; yield when wedge gates or break suggestion card are active.

## Current state

- `home-shell.tsx`: work gradient `from-shell-top to-shell-bottom` always.
- `timer-panel.tsx`: already uses `border-border-break bg-surface-break` + `text-accent-break` on breaks.
- `globals.css`: break semantic tokens exist (`surface-break`, `accent-break`, `border-break`); no shell break wash.
- `pomodoro-dashboard.tsx`: `isBreakRunning`, `wedgeGateActive` via `resolveWedgeBeat`, `showSuggestionCard` for post-check-in suggestion on break idle.

## Approach

1. Pure `shouldShowBreakAtmosphere()` — break kind + running/paused, not wedge gate, not suggestion card on break.
2. `useSyncBreakAtmosphere` sets `data-break-atmosphere` on `#home-shell-main`; CSS overrides shell gradient tokens.
3. `TaskList` optional `chromeSubdued` — opacity on list chrome during atmosphere.
4. Instant token swap; `transition-colors` with `motion-reduce:transition-none`.

## Out of scope

- S-28 Calm Garden illustrations
- Animated cross-fade beyond CSS color transition
- Guest-only divergence

## Confidence: 88%
