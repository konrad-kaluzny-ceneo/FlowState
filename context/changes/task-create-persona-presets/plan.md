# S-29 Task create persona presets — Implementation Plan

## Overview

Replace the create-form `+ Details` toggle with three persona preset chips (Deep planning, Mail & admin, Hotfix urgent) that pre-fill F-05 attributes, plus **Custom** to expand the existing attribute panel. Add P-204 dismissible coach on the preset row. Create-only v1 — inline edit unchanged. No backend/schema changes.

## Current State Analysis

From `context/changes/task-create-persona-presets/research.md`:

- Create form in `task-list.tsx` (~746–829): title + `+ Details` + Add; defaults OPERATIONAL / Medium / When possible.
- `EisenhowerAttributeFields` + `SegmentedControl` already wired to create state.
- `createTask` / guest repo accept all Eisenhower fields; scorer v2 consumes them.
- No preset constants in codebase; kickoff duration defaults align work types (45/25/15 min).
- S-11 onboarding pattern supports inline dismissible coach via `OnboardingState`.

### Key Discoveries

- Primary edit surface: `src/app/_components/task-list.tsx` — single file for create + edit.
- Chip UX reference: `duration-picker.tsx`, `kickoff-duration-chips.tsx` (`aria-pressed`).
- Blur race guard: `onMouseDown preventDefault` on SegmentedControl — extend to preset chips.
- `WORK_TYPE_CONFIG` is canonical for colors — do not duplicate hex.

## Desired End State

- User sees three persona chips + Custom on create form; tapping a preset pre-fills work type and Eisenhower fields before Add.
- Custom expands the same attribute panel previously behind `+ Details`.
- P-204: one dismissible coach line on preset row (first visit per device); dismiss persists flag.
- Guest and authenticated create paths both send preset-filled attributes.
- Component tests lock preset apply, Custom expand, coach dismiss, post-create reset.

### Verification

- `pnpm exec vitest run src/app/_components/task-list.test.tsx` — new preset oracles.
- `pnpm check`, `pnpm typecheck`, `pnpm test` green.

## What We're NOT Doing

- Inline edit preset row (create-only v1).
- DB column for `createdViaPreset` (S-32 phase 2).
- Calm Garden SVG icons (S-28) — Lucide v1.
- P-105 Eisenhower literacy coach (phase 2).
- Belt e2e for preset pickers (Vitest sufficient per F-05 precedent).
- Changing scorer logic or tRPC schemas.

## Implementation Approach

1. Extract preset definitions to pure module (testable mapping).
2. Add presentational picker component co-located with task list.
3. Rewire create form state: `selectedPreset`, `showCustomPanel`, apply-on-select.
4. Extend onboarding for P-204 coach.
5. Component tests via `/10x-tdd` in final phase.

## Critical Implementation Details

**Preset bundles (locked for v1):**

| Persona | workType | urgency | importance | effortMinutes | horizon |
|---------|----------|---------|------------|---------------|---------|
| Deep planning | DEEP_WORK | 2 | 3 | 60 | THIS_WEEK |
| Mail & admin | OPERATIONAL | 2 | 2 | 15 | WHEN_POSSIBLE |
| Hotfix urgent | REACTIVE | 3 | 2 | 30 | ASAP |

**UX spec:** Preset chip uses `aria-pressed`; only one preset active at a time. Selecting Custom sets `showCustomPanel` true and clears pressed preset styling (or marks Custom pressed). **Custom is expand-only in v1** — no collapse toggle; panel hides on preset select or post-create reset (impl-review F1 accepted). Manual edits inside Custom panel set selection to `custom`. Empty title on Add still blocked by existing validation.

**Reset after create:** Clear title, reset attributes to defaults, clear `selectedPreset`, collapse Custom panel.

**Coach (P-204):** Copy in `src/lib/onboarding/copy.ts` as `PRESET_COACH_LINE` (≤120 chars). Flag `presetCoachDismissed` in `OnboardingState`. Show coach below preset row when `!presetCoachDismissed`; dismiss button sets flag via `useOnboarding()` patch. Do not stack with check-in/suggestion coaches on same beat — hide preset coach when wedge overlays visible (mirror defer pattern if needed).

**Icons:** Lucide icons per preset, colored via `WORK_TYPE_CONFIG` text classes.

**SegmentedControl guard:** Preset chips use `onMouseDown={(e) => e.preventDefault()}` like existing pickers.

---

## Phase 1: Preset module and create form wiring

### Overview

Centralize preset config and replace `+ Details` with preset row + Custom expand.

### Pre-step

Create branch: `git switch main; git pull; git switch -c features/task-create-persona-presets` (skip if already on feature branch).

### Changes Required

#### 1. Persona preset definitions

**File**: `src/lib/task/persona-presets.ts` (new)

**Intent**: Export `TASK_PERSONA_PRESETS` array with id, label, Lucide icon name, and full attribute bundle. Export `applyPersonaPresetToCreateState(presetId)` helper returning field values.

**Contract**: Types use existing domain enums (`WorkType`, `CommitmentHorizon`, axis 1|2|3). `effortMinutes` in return value is **string** (e.g. `"60"`) to match `newEffortMinutes` state — empty string when preset has no effort hint.

#### 2. PersonaPresetPicker component

**File**: `src/app/_components/persona-preset-picker.tsx` (new)

**Intent**: Render preset chips + Custom button; `aria-pressed` per selection; work-type token styling from `WORK_TYPE_CONFIG`.

**Contract**: Props: `selectedPresetId`, `onSelectPreset`, `onSelectCustom`, optional `coachLine`, `onDismissCoach`.

#### 3. TaskList create form integration

**File**: `src/app/_components/task-list.tsx`

**Intent**: Remove `showDetails` / `+ Details` toggle. Add `selectedPresetId` and `showCustomPanel` state. Render `PersonaPresetPicker`; on preset select, set all `new*` attribute state fields. Custom reveals existing panel (work type + `EisenhowerAttributeFields`). Post-create reset clears preset state.

**Contract**: `createTask` payload unchanged; still passes `weight: newUrgency`.

### Success Criteria

#### Automated Verification

- [ ] `pnpm check` passes
- [ ] `pnpm typecheck` passes

#### Manual Verification

- [ ] Each preset pre-fills visible badges after Add (browser)
- [ ] Custom panel matches prior Details behavior

---

## Phase 2: P-204 dismissible coach

### Overview

One inline coach on preset row; persisted dismiss flag.

### Changes Required

#### 1. Onboarding types and storage

**Files**: `src/lib/onboarding/types.ts`, `storage.ts`, `keys.ts`

**Intent**: Add `presetCoachDismissed: boolean` default false. Extend `parseStoredState` whitelist (same pattern as existing flags — do not spread unknown keys).

#### 2. Onboarding hook

**File**: `src/hooks/use-onboarding-state.ts`

**Intent**: Add `shouldShowPresetCoach` (`!state.presetCoachDismissed && !isFirstRunVisible`) and `markPresetCoachDismissed` callback (patch storage). Export via `useOnboarding()`.

#### 3. Coach copy

**File**: `src/lib/onboarding/copy.ts`

**Intent**: Add `PRESET_COACH_LINE` explaining presets vs Custom.

#### 4. Wire coach in TaskList

**File**: `src/app/_components/task-list.tsx`

**Intent**: `useOnboarding()` for `shouldShowPresetCoach` / `markPresetCoachDismissed`. Pass coach line + dismiss to `PersonaPresetPicker`. Hide coach when first-run overlay is visible (`isFirstRunVisible`).

**Contract**: Mark dismissed on button click only; `data-testid="preset-coach-dismiss-btn"`. TaskList is under `OnboardingProvider` via `home-shell.tsx` — safe at runtime.

### Success Criteria

#### Automated Verification

- [ ] `pnpm test` passes (onboarding unit tests if present)

#### Manual Verification

- [ ] Coach shows once; dismiss hides until storage cleared

---

## Phase 3: Component test oracles

### Overview

Lock preset behavior with Vitest in task-list tests.

### Changes Required

#### 1. Task list tests

**File**: `src/app/_components/task-list.test.tsx`

**Intent**: Tests for: preset click sets create state; Custom expands Eisenhower fields; Add sends preset attributes; coach dismiss sets flag; post-create reset.

**Contract**: Follow L-04 — co-located component smoke for unbounded UI. Wrap renders with `OnboardingProvider scope={{ mode: "guest" }}` (or mock `~/hooks/use-onboarding-state`) for coach tests.

### Success Criteria

#### Automated Verification

- [ ] `pnpm exec vitest run src/app/_components/task-list.test.tsx` passes
- [ ] `pnpm test` passes

#### Manual Verification

- [ ] None if automated covers paths

---

## Phase 4: P-203 empty-list activation nudge (stretch)

### Overview

When active task list empty, guide mentions presets before Focus.

### Changes Required

#### 1. EmptyActiveTasksGuide copy/action

**File**: `src/app/_components/empty-active-tasks-guide.tsx`

**Intent**: Update helper copy to reference persona presets; focus add input (existing ref) — no new modal.

**Contract**: Skip if copy-only change risks scope creep; defer to follow-up if timeboxed.

### Success Criteria

#### Automated Verification

- [ ] `pnpm test` passes

#### Manual Verification

- [ ] Empty list shows updated guidance

---

## Testing Strategy

### Unit / component

- Primary: `task-list.test.tsx` phase 3
- Optional: `persona-presets.ts` pure mapping unit test

### Manual

- Create task via each preset; verify badges and suggestion ranking inputs
- Guest mode preset create

## Performance Considerations

Negligible — a few extra buttons on create form; no listeners.

## Migration Notes

None — UI-only.

## References

- Research: `context/changes/task-create-persona-presets/research.md`
- S-29 detail: `context/foundation/roadmap-references/items/S-29.md`
- F-05 archive: `context/archive/2026-06-11-eisenhower-effort-task-attributes/`
- S-11 onboarding: `context/archive/2026-06-07-first-run-wedge-onboarding/`
- L-04: `context/foundation/lessons.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Preset module and create form wiring

#### Automated

- [x] 1.1 `pnpm check` passes
- [x] 1.2 `pnpm typecheck` passes

#### Manual

- [x] 1.3 Preset pre-fill verified in browser
- [x] 1.4 Custom panel parity with former Details verified

### Phase 2: P-204 dismissible coach

#### Automated

- [x] 2.1 `pnpm test` passes

#### Manual

- [x] 2.2 Coach dismiss persistence verified in browser

### Phase 3: Component test oracles

#### Automated

- [x] 3.1 `pnpm exec vitest run src/app/_components/task-list.test.tsx` passes
- [x] 3.2 `pnpm test` passes

#### Manual

- [x] 3.3 None required if automated covers paths

### Phase 4: P-203 empty-list activation nudge (stretch)

#### Automated

- [x] 4.1 `pnpm test` passes — deferred (stretch; plan allows follow-up)

#### Manual

- [x] 4.2 Empty list guidance verified in browser — deferred (stretch; P-203 follow-up)
