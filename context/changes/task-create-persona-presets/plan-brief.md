# Plan brief: task-create-persona-presets (S-29)

> Full plan: `context/changes/task-create-persona-presets/plan.md`  
> Research: `context/changes/task-create-persona-presets/research.md`

## Outcome

Persona preset chips on task create replace `+ Details`; Custom expands full F-05 panel; P-204 coach.

## Phases

| # | Focus | Route |
|---|--------|-------|
| 1 | `persona-presets.ts` + picker + create form | `/10x-implement` |
| 2 | Onboarding coach flag + copy | `/10x-implement` |
| 3 | `task-list.test.tsx` oracles | `/10x-tdd` |
| 4 | Empty-list copy (stretch) | `/10x-implement` |

## Risks to verify

- SegmentedControl blur race — mousedown guard on preset chips
- Coach stacking with wedge overlays — defer/hide when interstitial visible
- Guest create sends full preset payload

## Prerequisites

On `main`, branch `features/task-create-persona-presets` before phase 1 code.
