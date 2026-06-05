# Frame Brief: Unified duration picker (work + breaks)

> Framing step before /10x-plan. This document captures what is *actually*
> at issue, separated from what was initially assumed.

## Reported Observation

On the idle timer panel, work cycle presets are labeled in minutes (15/25/45/60), but the custom work field shows and accepts **raw seconds** (e.g. `1500` for 25 minutes). Short/long break settings use **minutes** with a different layout. The user must mentally convert minutes to seconds for custom work time. Work and break configuration do not feel like one system.

## Initial Framing (preserved)

- **User's stated cause or approach**: The problem is inconsistent units (seconds for work custom vs minutes for presets and breaks) and mismatched UI patterns between work and break sections.
- **User's proposed direction**: Define UX best practice for **presets vs custom** duration; allow **second-level** precision without in-head conversion; use the **same UI system** for work cycle and break durations.
- **Pre-dispatch narrowing**: **Leading concern = unit_math** (mental minute→second conversion on custom work). **Sub-minute work**: needed but **rare**. **Work/break parity**: **full symmetry** — presets + custom for breaks as well as work, not only the same input widget.

## Dimension Map

The observation could originate at any of these dimensions:

1. **Display/input unit layer** — labels and fields disagree with the user's minute mental model (presets in min, custom in sec).
2. **Preset vs custom interaction model (work only)** — dual state (`selectedSec` + `customSec`) and highlight rules cause minor idle-state confusion.
3. **Work vs break configuration parity** — breaks were added as minute-only rows; work later gained presets + seconds custom in a separate phase.
4. **Product spec / precision constraints** — FR-010 allows 1s–90m work; FR-011 is 1–30m breaks; spec does not mandate seconds in the UI but does require sub-minute work capability.
5. **Historical rollout / test contract** — Phase 4 (`testing-critical-path-persistence-timer`) intentionally standardized custom **work** on seconds for E2E; breaks were explicitly out of scope.

Initial framing landed on **dimension 1**; user narrowing adds **dimension 3** (full parity) as co-equal scope for planning.

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| **Display/input unit layer** | `timer-panel.tsx:177-207` label and errors in seconds; presets `duration-bounds.ts:34-37` in minutes; selecting 25 min fills `1500` (`timer-panel.tsx:28-37`, `166-168`); breaks `timer-panel.tsx:241-280` use `min` + `×60` on save | **STRONG** |
| **Preset vs custom coupling (work)** | Sync on preset click; start uses `parsedCustomSec` when not `usingPreset` (`timer-panel.tsx:213-218`); empty custom falls back to `selectedSec` — edge confusion only; tests cover start, not highlight desync | **WEAK** |
| **Work vs break parity** | Breaks: no preset row, different label layout, minute state only (`timer-panel.tsx:76-81`, `236-284`); `full-session-with-breaks/plan.md:144-148` specified minute inputs only; Phase 4 plan excluded break seconds (`testing-critical-path-persistence-timer/plan.md:45`, `320`) | **STRONG** |
| **Spec forces seconds UI** | FR-010 `prd.md:98` — presets in minutes, custom range "1 second–90 minutes"; FR-011 `prd.md:100` — minutes only; storage/API always seconds (`duration-storage.ts:12-14`, `cycle.ts:53-57`) | **PARTIAL** — capability yes, seconds-only field no |
| **Rollout artifact** | Independent agent: same root as dims 1+3; E2E `work-duration-custom-sec` (`e2e/helpers/work-cycle.ts:6-8`); no unified duration control tests | **STRONG** (explains *why*, not a separate user-facing bug) |

## Narrowing Signals

- Leading pain is **typing/thinking in seconds** while everything else says minutes — not timer drift or wrong `onStart` duration (pipeline is consistently seconds end-to-end).
- Sub-minute work is **real but rare** — unified UI must not sacrifice FR-010 floor without an explicit, discoverable sub-minute affordance (not raw `90` for 90 seconds confusion).
- User wants **break presets + custom** like work, not only aligned number fields — expands scope beyond unit labels.

## Cross-System Convention

**In this codebase:** Persistence and timers already use **seconds** everywhere; the bug class is **presentation and idle-state shape**, not storage math.

**UX convention (product category, not implementation):**

- **Mental-model alignment:** Pomodoro users think in **minutes**; presets, custom entry, validation copy, and persisted display should use the **same primary unit** unless a deliberate "advanced" sub-minute control exists.
- **One pattern per duration kind:** Presets are **shortcuts into the same value** the custom control shows — not a parallel channel that leaves the field showing `1500` when the UI says 25 min.
- **Symmetry across settings:** When the user asked for "the same system," parity means **shared structure** (presets row + custom control + bounds copy), not necessarily identical preset lists (work 15/25/45/60 vs break 5/10/15 etc. are product choices for `/10x-plan`).
- **Precision layering:** Second accuracy is a **storage/runtime** requirement (FR-010, NFR drift); sub-minute editing can be **progressive disclosure** when rare (user signal: yes, rare).

Pressure-test: Fresh codebase search without naming "unit mismatch" still identified **`timer-panel.tsx` three-pattern layout** and **phased plans** as the top cause — aligns with the leading hypothesis.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: Design a **single, reusable duration-configuration pattern** for work, short break, and long break that is **minute-first in the UI**, keeps **presets and custom in one coupled model**, and preserves **second-level work duration** (including rare sub-minute) — replacing today's mix of minute presets, raw-second work custom, and minute-only break rows.

The initial framing (inconsistent units) was **correct but incomplete**. Unit mismatch is the sharpest symptom; the user's **full parity** answer means the plan must also treat **break configuration** as first-class preset+custom surfaces, not only relabeling the work seconds field. This is **not** "the timer math is wrong" — conversion and API bounds are already consistent.

## Confidence

**HIGH** — strong file evidence, independent investigation agrees, user narrowing consistent with PRD constraints.

## What Changes for /10x-plan

Plan around a **shared duration picker component (or equivalent)** used three times (work / short break / long break), each with its own preset list and bounds from `duration-bounds.ts` / FR-010 / FR-011. Research **minute-first input patterns** that still satisfy 1s work minimum (e.g. minutes + optional seconds step, `mm:ss`, or advanced toggle — choice belongs in plan, not frame). Include **test/E2E migration** off `work-duration-custom-sec` raw seconds. Consider a **small PRD addendum** for break presets if FR-011 today only lists defaults, not preset chips.

Do **not** treat this as a one-line "multiply by 60 in the label" fix — that would miss break parity and sub-minute FR-010.

## References

- Source: `src/app/_components/timer-panel.tsx` (idle: 157–284)
- Bounds: `src/lib/duration-bounds.ts`, `src/lib/duration-storage.ts`
- PRD: `context/foundation/prd.md` FR-010, FR-011
- Prior decisions: `context/changes/full-session-with-breaks/plan.md` (~144–148), `context/changes/testing-critical-path-persistence-timer/plan.md` (Phase 4, ~45, 316–321)
- Tests/E2E: `src/app/_components/timer-panel.test.tsx`, `e2e/helpers/work-cycle.ts`
- Investigation: sub-agents 0d5f8b8f, 093d08ba, 1712d4f6, f8e0c4ae
