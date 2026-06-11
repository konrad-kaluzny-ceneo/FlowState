---
date: 2026-06-11T12:00:00+02:00
researcher: ship-slice-orchestrator
git_commit: d80a31e
branch: features/wedge-overlay-visual-polish
repository: FlowState
topic: "S-12 wedge overlay visual polish — styling substrate and e2e contracts"
tags: [research, design-system, overlays, S-12]
status: complete
last_updated: 2026-06-11
last_updated_by: ship-slice-orchestrator
---

# Research: Wedge overlay visual polish (S-12)

## Summary

F-04 shipped `DESIGN.md` with overlay primitive spec, energy identity tints, motion timing, and e2e preservation rules. Runtime still uses inline hex (`bg-[#1a1a2e]`) and duplicated `WORK_TYPE_CONFIG` across components. S-12 scope is wedge transition surfaces only — parallel S-13 owns home shell / task list.

## In-scope components

| Component | Role | Current debt |
| --- | --- | --- |
| `cycle-complete-overlay.tsx` | Work/break cycle end | Inline hex, duplicated scrim/card |
| `check-in-overlay.tsx` | Post-work energy gate | Same |
| `kickoff-readiness-overlay.tsx` | Session kickoff energy | Same |
| `wind-down-overlay.tsx` | Session wind-down | Same |
| `mid-cycle-completion-prompt.tsx` | Mid-cycle task switch | Same |
| `task-suggestion-card.tsx` | Break suggestion card | Duplicated work-type badges |
| `energy-selector.tsx` | Shared energy picker | Generic hover, no energy identity |

**Out of scope (S-13):** `home-shell.tsx`, `task-list.tsx`, auth pages, `first-run-overlay.tsx`, `merge-success-overlay.tsx`.

## DESIGN.md contracts

- Map tokens to `globals.css` `@theme` (`surface-overlay`, `accent-cta`, energy borders/backgrounds).
- Extract overlay scrim + card primitive with break/suggestion variants.
- Motion: 200ms enter, `prefers-reduced-motion` instant.
- Preserve all existing `data-testid` values; keep `ring-purple-500` on mid-cycle selection (e2e).

## E2E touchpoints

`e2e/seed.spec.ts`, `pomodoro-cycle.spec.ts`, `task-suggestion.spec.ts`, `session-kickoff.spec.ts`, `mindful-session-wind-down.spec.ts`, helpers in `e2e/helpers/{check-in,suggestion,wind-down,kickoff,idle-cycle}.ts` — all assert visibility via testids, not CSS classes.

## Parallel worktree note

S-13 (`focus-home-visual-craft`) active on separate worktree. Both slices share `globals.css` @theme — merge conflict likely; coordinate token names with S-13 branch. This slice adds overlay-specific tokens only.

## Confidence

**88%** — straight visual refactor on stable wedge logic; main risk is `@theme` merge with S-13.
