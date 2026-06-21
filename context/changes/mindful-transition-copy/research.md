---
date: 2026-06-21T12:00:00+02:00
researcher: ship-slice-orchestrator
git_commit: 285cb2276c66ee4d9d0dee74d3fe1dc787f09ae0
branch: features/mindful-transition-copy
repository: FlowState
topic: "S-21 mindful transition copy — break start + break→work re-entry"
tags: [research, wedge, transition-copy, S-21, F-07, US-01]
status: complete
last_updated: 2026-06-21
last_updated_by: ship-slice-orchestrator
---

# Research: S-21 Mindful Transition Copy

**Date**: 2026-06-21  
**Researcher**: ship-slice-orchestrator  
**Git Commit**: 285cb2276c66ee4d9d0dee74d3fe1dc787f09ae0  
**Branch**: features/mindful-transition-copy  
**Repository**: FlowState

## Research Question

How should S-21 (mindful break-start + break→work re-entry copy) integrate with F-07 conductor, existing copy modules, and energy/check-in state without violating US-01 beat-mutex rules?

## Summary

S-21 is **not implemented**. Break→work uses hardcoded strings in `cycle-complete-overlay.tsx`; break-start has no in-tab interstitial (only out-of-tab notification in `notify-break-start.ts`). F-07 conductor owns **four blocking gates** only — S-21 should follow the **inline interstitial pattern** (S-19 override ack, S-17 in-flow summary) with dashboard mutex guards, not a new gate.

Extension points: new pure copy module (`transition-copy.ts`), hook state for break-start line + dismiss, energy from `narrativeLatestEnergy` for re-entry, `CycleCompleteOverlay` subtitle swap, conductor-adjacent suppression when `wedgeGateActive` or competing surfaces active.

## Detailed Findings

### F-07 conductor (gates only)

`src/lib/wedge/transition-conductor.ts` — priority: closure → wind-down → check-in → cycle complete. Pause suppresses all gates. Post-check-in suppresses cycle-complete flash (B-04). **No interstitial slot** — S-21 deferred at F-07 ship.

### Existing copy modules (tone contract)

| Module | Pattern |
|--------|---------|
| `override-ack-copy.ts` | Single constant; validating tone; 3s dismiss |
| `wind-down-copy.ts` | Gate title/body/CTA; no preachy "should/mistake" |
| `narrative-copy.ts` | `ENERGY_LABELS`; closure/handoff prefixes |
| `catch-up/copy.ts` | Gate-keyed calm handoff strings |

S-21 should add `transition-copy.ts` with energy-keyed lines + neutral fallback; tone tests mirror override-ack guards.

### Break transitions (hook)

- **Work → break**: check-in gate → `continueAfterCheckIn` / `startBreakAfterWorkComplete` starts break timer.
- **Break → work**: `state === completed` → `CycleCompleteOverlay` break variant → `confirmComplete` → idle + optional kickoff.

Energy for re-entry: `narrativeLatestEnergy` (from last check-in via `refreshNarrativeStats`); guest uses neutral fallback.

### Mutex rules (product)

`user-flow.md` + flow-coherence: **≤1 interstitial + ≤1 gate per beat**. Dashboard already hides in-flow summary when `wedgeGateActive` or `showSuggestionCard`. Break-start line must hide under same conditions; re-entry copy lives **inside** cycle-complete gate (subcopy, not second gate).

### Risks

- Interstitial fatigue if shown alongside check-in — break-start only after check-in closes.
- Fading re-entry must not duplicate S-16 wind-down preachiness — separate copy buckets, invitational tone.
- Guest: no check-in energy — neutral lines only for re-entry; break-start can use break-kind-only copy.

## Code References

- `src/lib/wedge/transition-conductor.ts:53-58` — gate priority
- `src/app/_components/cycle-complete-overlay.tsx:41-53` — hardcoded break→work copy
- `src/app/_components/pomodoro-dashboard.tsx:291-319` — interstitial mutex
- `src/lib/suggestion/override-ack-copy.ts` — interstitial pattern
- `src/lib/session/narrative-copy.ts:5-9` — energy labels
- `src/hooks/use-pomodoro-cycle.ts` — break start / confirm paths

## Architecture Insights

- **Presentation tiers**: gate overlays (blocking) vs inline interstitial (skippable one-liner) vs inline card (suggestion).
- F-07 explicitly deferred S-21; dashboard mutex is sufficient for MVP — no conductor extension required if suppression mirrors `showInFlowSummary`.
- P-205 vision (unified calm module) — MVP adds `transition-copy.ts`; full S-19/S-17 consolidation out of scope.

## Historical Context

- F-07 archive: conductor pure module; S-21 out of scope at ship.
- S-16: wind-down gate sequence; Fading + corroborating signals; decline ≠ override ack.
- S-19: inline ack banner pattern and tone contract.
- S-21 roadmap: pair ship with S-33 (atmosphere) — words first, shell later.

## Open Questions (resolved for planning via decision proxy)

| Unknown | Decision |
|---------|----------|
| Fixed vs rotating lines | MVP: one fixed line per energy bucket (+ break kind for break-start) |
| Guest variant | Re-entry: neutral fallback; break-start: same break-kind lines (no energy) |
| Same voice break vs re-entry | Yes — shared module, different selectors |
| Fading overlap S-16 | Invitational re-entry only; no "you should stop" language |

## Related Research

- `context/archive/2026-06-18-wedge-transition-conductor/research.md`
- `context/archive/2026-06-08-mindful-session-wind-down/research.md`
- `context/archive/2026-06-08-suggestion-override-acknowledgement/research.md`
