# Unified Duration Picker UX — Plan Brief

> Full plan: `context/changes/unified-duration-picker-ux/plan.md`
> Frame brief: `context/changes/unified-duration-picker-ux/frame.md`

## What & Why

Design a **single, reusable duration-configuration pattern** for work, short break, and long break that is **minute-first in the UI**, keeps **presets and custom in one coupled model**, and preserves **second-level precision** — replacing today's mix of minute presets, raw-second work custom, and minute-only break rows.

## Starting Point

`TimerPanel` idle state uses three different input patterns: minute preset chips + **seconds** custom field for work (`1500` for 25 min), and separate **minute-only** break rows without presets. Storage, API, and timers already use seconds correctly — the bug is presentation and interaction only.

## Desired End State

Users configure **work, short break, and long break through the identical picker**: preset chips + **minutes + seconds** custom fields. Presets populate human-readable values (e.g. 5 min 0 sec, not 300). Sub-minute settings (e.g. 45 s) work for **all three**. Break pickers live inside the collapsible section. Tests and E2E pass; `setWorkDurationSec(page, N)` still works.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Picker parity | **Identical UI for work + both breaks** | User requirement: same system including seconds | Plan (user correction) |
| Custom input | Minutes + seconds (0–59) everywhere | No mental ×60; one mental model | Frame + Plan |
| Break min | **1 second** (lower `MIN_BREAK_DURATION_SEC`) | Match work precision; API already allows 1s | Plan |
| Break max | 30 min 0 sec (1800s) | FR-011 ceiling unchanged | Plan |
| Break presets | Short 3/5/10 min; Long 10/15/20 min | Covers PRD defaults (5/15) | Plan |
| Component | `duration-picker.tsx` + `duration-input.ts` | One component, three instances | Frame + Plan |
| Break layout | Collapsible "Break settings" | Avoid idle UI overload | Plan |
| E2E | `setWorkDurationSec` keeps seconds param | Helper maps to min+sec fields | Plan |
| PRD | FR-011 → 1 s–30 min + presets | Align spec with unified picker | Plan |

## Scope

**In scope:**
- Break min bound 1s in `duration-bounds`
- Identical `DurationPicker` ×3 (work, short, long)
- Storage test updates for break 1s floor
- E2E helper + docs + FR-011 update

**Out of scope:**
- Timer running UI, drift logic, DB schema changes
- Separate settings page
- Different picker UX per duration kind

## Architecture / Approach

```
duration-bounds (presets, min/max per kind — all support 1s floor for breaks)
        ↓
duration-input (split/combine/validate)
        ↓
DurationPicker (min + sec, always)  ×3 in TimerPanel
        ↓
duration-storage (seconds) / onStart(durationSec)
```

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Bounds & utils | Break presets, MIN_BREAK=1s, helpers | Storage test expectations |
| 2. DurationPicker | One component shape for all kinds | 30 min / 90 min + sec boundary |
| 3. TimerPanel | Three identical pickers wired | UX regression |
| 4. E2E & docs | Helper, PRD FR-011 | Missed old testids |

**Estimated effort:** ~2 sessions across 4 phases.

## Success Criteria (Summary)

- Work and breaks: presets + min+sec custom; no raw seconds in fields
- 45 s break via 0 min 45 sec persists and runs
- `pnpm test`, `pnpm check`, E2E green
