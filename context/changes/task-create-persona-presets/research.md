---
date: 2026-06-13T00:00:00+00:00
researcher: ship-slice orchestrator
git_commit: 443ef2ab5cda689b29a852b4ab1e12897a370c75
branch: main
repository: FlowState
topic: "S-29 task create persona presets — UI substrate, F-05 fields, prior patterns"
tags: [research, codebase, task-list, eisenhower, onboarding, S-29]
status: complete
last_updated: 2026-06-13
last_updated_by: ship-slice orchestrator
---

# Research: S-29 task create persona presets

**Date**: 2026-06-13  
**Researcher**: ship-slice orchestrator  
**Git Commit**: `443ef2ab5cda689b29a852b4ab1e12897a370c75`  
**Branch**: main  
**Repository**: FlowState

## Research Question

How should S-29 replace the create-form `+ Details` toggle with three persona presets (Deep planning, Mail & admin, Hotfix urgent) plus Custom expand, pre-filling F-05 attributes without backend changes?

## Summary

S-29 is a **UI-layer change centered on `task-list.tsx`**. Task creation already accepts all Eisenhower fields via existing `createTask` / guest repo paths; no schema or tRPC changes required. Replace `showDetails` / `+ Details` with a preset chip row that sets create state (`newWorkType`, urgency, importance, effort, horizon), plus **Custom** to reveal the existing attribute panel unchanged. Inline edit already shows the full panel — **v1 scope: create-only presets** (edit unchanged). Reuse `WORK_TYPE_CONFIG`, `KickoffDurationChips`/`duration-picker` chip pattern, `EisenhowerAttributeFields`, and S-11 onboarding storage for P-204 dismissible coach. Preset attribute bundles should live in a new `src/lib/task/persona-presets.ts` module.

## Detailed Findings

### Task create / edit UI (`task-list.tsx`)

- Add-task form: lines ~746–829 — title input, optional Details panel, Add button.
- Create defaults: `OPERATIONAL`, urgency/importance `2`, effort empty → null, horizon `WHEN_POSSIBLE`.
- `+ Details` toggle: lines ~791–828 — expands bordered panel with work-type `SegmentedControl` + `EisenhowerAttributeFields`.
- Inline edit: always full attribute panel on title click; `commitEditIfDirty` handles blur/outside/focus saves (post fix-task-edit-blur-save).
- Extension point: insert preset row between title row and submit; rename `showDetails` → `showCustomPanel`; Custom reveals lines 798–827 unchanged.

### F-05 substrate (shipped)

- Prisma Task: `workType`, `importance`, `urgency`, `effortMinutes`, `commitmentHorizon`; legacy `weight` mirrors `urgency`.
- tRPC `task.create` / `task.update`: optional Eisenhower fields with defaults matching UI.
- Guest parity: full field support in `guest-repositories.ts` + `guest/schema.ts`.
- Scorer v2 consumes all fields — presets must set coherent bundles for ranking signal.

### Design / prior slice patterns

- **S-13**: semantic tokens only; `WORK_TYPE_CONFIG` single source; create panel uses `bg-surface-panel border-border-subtle`.
- **S-04 / F-05**: `SegmentedControl` uses `onMouseDown preventDefault` to avoid blur races; effort input same guard.
- **F-06**: persona chips use work-type token colors, not new hex; chip active/inactive like `duration-picker.tsx`.
- **S-11 / P-204**: inline dismissible coach via extended `OnboardingState` + `copy.ts`; pattern like `return-handoff-banner.tsx`; mark seen on dismiss; max one coach per load.

### Expand scope hooks

- **P-203**: `empty-active-tasks-guide.tsx` focuses add input — extend to highlight preset row after empty → preset → Focus nudge.
- **P-105**: phase 2 Eisenhower literacy coach — defer.
- **S-32 trust bridge**: optional phase 2; no preset persistence field today.

## Recommended preset bundles (decision proxy)

| Persona | workType | urgency | importance | effort (min) | horizon |
|---------|----------|---------|------------|--------------|---------|
| Deep planning | DEEP_WORK | 2 | 3 | 60 | THIS_WEEK |
| Mail & admin | OPERATIONAL | 2 | 2 | 15 | WHEN_POSSIBLE |
| Hotfix urgent | REACTIVE | 3 | 2 | 30 | ASAP |

Rationale: aligns work-type taxonomy with kickoff duration defaults (45/25/15); Deep gets high importance; Hotfix gets high urgency + ASAP; effort values are planning hints within 5–240 bounds.

Icons: **Lucide** in v1 (`Brain`, `Mail`, `Zap` or similar) tinted with `WORK_TYPE_CONFIG` — S-28 Calm Garden SVG deferred.

## Architecture Insights

- Centralize preset definitions in `persona-presets.ts`; UI applies via existing state setters.
- Selected preset is ephemeral UI state — no DB column for v1 (S-32 phase 2 may need session memory).
- Post-create reset must clear `selectedPreset` and collapse Custom panel.
- Component tests in `task-list.test.tsx` are the primary oracle (F-05 precedent: no belt e2e for pickers).

## Historical Context

- S-04 established expandable create details and SegmentedControl blur guard (`context/archive/2026-05-30-task-attributes-for-scoring/`).
- F-05 added Eisenhower fields end-to-end (`context/archive/2026-06-11-eisenhower-effort-task-attributes/`).
- fix-task-edit-blur-save fixed commit-on-outside for edit panel (`context/archive/2026-06-12-fix-task-edit-blur-save/`).
- S-11 onboarding coach pattern (`context/archive/2026-06-07-first-run-wedge-onboarding/`).

## Code References

- `src/app/_components/task-list.tsx` — create form, EisenhowerAttributeFields, SegmentedControl
- `src/lib/design/work-type-config.ts` — work-type colors
- `src/app/_components/duration-picker.tsx` — chip expand pattern
- `src/lib/onboarding/storage.ts`, `types.ts`, `copy.ts` — P-204 coach flags
- `src/app/_components/return-handoff-banner.tsx` — inline dismissible pattern
- `src/hooks/use-task-mutations.ts` — createTask bridge
- `src/server/api/routers/task.ts` — create/update schemas

## Open Questions

| Question | Resolution for plan |
|----------|---------------------|
| Exact preset → attribute mapping | Use table above; user can override in `/10x-plan` |
| Presets on inline edit? | **Create-only v1** |
| Lucide vs Calm Garden icons | **Lucide v1** |
| P-203 empty→cycle in v1? | Include as sub-phase if low cost; else phase 2 |

## Confidence

**88%** — clear extension point, no backend gap; preset numbers are product judgment, not code unknowns.
