# Plan Review: ui-polish-fixes

**Date**: 2026-06-21  
**Reviewer**: ship-slice-orchestrator (auto-triage)  
**Verdict**: APPROVED

## Summary

Plan is feasible for a UI-only polish slice: token-layer palette swap, localized component extractions (`StyledCheckbox`, `TaskFieldsPanel`), and session icon work with preserved e2e contracts via `data-testid` and `aria-label`. Six phases are correctly ordered (tokens → primitives → copy → task refactor → completed UX → icons). No wedge/timer-hub transition logic touched. No CRITICAL findings.

## Findings

| ID | Severity | Finding | Action |
|----|----------|---------|--------|
| F1 | WARNING | `@theme` defines `--color-focus-ring` but components use `ring-focus` (no `--color-focus`) — ring may be invisible on some surfaces | **Fixed** — Phase 1 contract now requires `--color-focus` alias |
| F2 | WARNING | Phase 2 removes `out-of-tab-break-alerts-status` while Testing Strategy says preserve testids | **Fixed** — Phase 2 contract documents intentional testid removal |
| F3 | WARNING | Phase 6 timer-panel step referenced "idle Focus path" — Focus lives in `task-list.tsx` | **Fixed** — clarified Focus/Add ownership in Phase 6 |
| F4 | INFO | Change folder exists but no roadmap row for `ui-polish-fixes` | Accepted — ad-hoc polish batch; create/sync backlog at S9 before PR |
| F5 | INFO | Research open questions (beige hue, standing default, done-state) resolved in plan-brief decisions | Accepted |
| F6 | INFO | L-04 component smoke for title control covered by Phase 4 `task-fields-panel.test.tsx` | Accepted |
| F7 | INFO | Pause e2e uses `timer-pause` testid; Focus/Add/Interrupt use role names — plan aria-label strategy preserves both | Accepted |

## CRITICAL

None.

## Recommendation

Proceed to S7 implementation on `features/ui-polish-fixes` per plan phases 1→6 after stakeholder approval (ship-with-breaks gate).
