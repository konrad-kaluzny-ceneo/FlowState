# Plan brief: Mindful transition copy (S-21)

**Change ID:** `mindful-transition-copy`  
**Roadmap:** S-21 | FLO-36 | #47  
**PRD:** US-01 mutex + FR-041 (calm skippable break-start + energy-keyed break→work re-entry)

## Goal

Replace generic break transition strings with calm, skippable one-liners at two beats:

1. **Break start** — when the break timer begins (after work confirm + check-in path).
2. **Break→work re-entry** — subtitle on the break `CycleCompleteOverlay`, keyed to last check-in energy.

## Approach

- Pure copy module + hook state + dashboard interstitial (break start) + overlay subcopy (re-entry).
- Dashboard mutex: hide break-start line when any wedge gate active or suggestion card visible.
- No new conductor gate; no timer blocking.

## Out of scope

- S-33 break atmosphere shell
- S-35 network recovery
- Consolidating S-19/S-17 into one mega copy module (P-205 follow-up)
- Rotating copy pools / A-B lines

## Phases

1. Copy module + unit tests (TDD)
2. Hook wiring (break-start state, energy source, dismiss)
3. Dashboard + overlay UI + component tests
4. Belt e2e smoke for one authenticated path

## Confidence

88% — follows established interstitial patterns; main risk is mutex edge cases with suggestion card during break.
