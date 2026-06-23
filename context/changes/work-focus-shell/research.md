---
topic: work-focus-shell
researcher: ship-slice
confidence: 85
---

# Research — S-31 work focus shell

## Problem

During WORK cycles the home screen reads as a full task manager; timer and active task should be the visual hero (FR-012, DESIGN.md focus-shell note).

## Pattern to mirror

S-33 (`break-atmosphere.ts`, `use-sync-break-atmosphere`, `data-break-atmosphere` on `#home-shell-main`, `chromeSubdued` on task list) — symmetric for WORK.

## Decisions

| Unknown | Decision |
|---------|----------|
| Dim scope | Subdue **create-task form + completed section** only; active rows stay full contrast (mid-cycle switch + S-18 resume note safe) |
| Cycle kinds | WORK only (`running` \| `paused`); not breaks (S-33 owns those) |
| Wedge yield | Suppress when `wedgeGateActive` (check-in, suggestion, wind-down, etc.) |
| Guest | Same signals from `pomodoro` cycle state — no auth branch |
| Shell wash | `data-work-focus-shell` CSS token override — warmer neutral focus gradient |

## Code references

- `src/lib/design/break-atmosphere.ts` — predicate + `HOME_SHELL_MAIN_ID`
- `src/hooks/use-sync-break-atmosphere.ts` — DOM attribute sync
- `src/app/_components/pomodoro-dashboard.tsx` — wires atmosphere + TaskList props
- `src/app/_components/task-list.tsx` — `chromeSubdued` (break); add `focusShellActive` for targeted sections
- `src/styles/globals.css` — shell token overrides

## Risks

Over-dimming active rows — mitigated by section-scoped classes + `prefers-reduced-motion` on transitions.
