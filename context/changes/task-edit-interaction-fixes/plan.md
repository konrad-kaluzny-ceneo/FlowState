# Task Edit Interaction Fixes — Implementation Plan

## Overview

Fix wave 3 from the post-MVP defect register: **D-09** — preset name (e.g. "Gaszenie") must remain visible on tasks created from a persona preset, including after inline attribute edits and in guest mode. **D-08** — horizon option "Gdy się da" (`WHEN_POSSIBLE`) reported as not clickable; wiring is correct but UX and interaction edge cases need hardening (weak active styling, possible blur-save race, row overflow clipping).

## Current State Analysis

From `context/changes/task-edit-interaction-fixes/research.md` and `context/changes/mvp-defect-intake/change.md`:

- **D-09 (STRONG — display oracle):** `getTaskBadgeDisplayMode` in `persona-presets.ts:176-198` returns `"custom-detail"` (shows "Własny") when live attributes diverge from the stored preset bundle (`ignoreEffort: true`). This was intentional in S-36/persona-presets-v2 but **conflicts with the 2026-07-03 product decision**. `personaPresetId` stays in DB on edit — display-only demotion.
- **D-09 (STRONG — guest gap):** Guest `createTask` in `use-task-mutations.ts:496-506` omits `personaPresetId`; guest repo supports it at `guest-repositories.ts:204`.
- **D-09 (auth create works):** When attrs match preset at create time, badge shows correctly (`task-list.test.tsx:541-562`).
- **D-08 (wiring OK):** All three horizon values in `task-fields-panel.tsx:10-14,88-96,148-159`; SegmentedControl buttons have `onClick` + `onMouseDown preventDefault`.
- **D-08 (confirmed static):** Active `WHEN_POSSIBLE` styling (`bg-surface-panel text-text-section` at `:152`) ≈ inactive (`bg-surface-panel text-text-secondary` at `:44`). Default horizon is `WHEN_POSSIBLE` — clicks when already selected fire no `onChange`.
- **D-08 (residual risk):** Panel `onBlur` at `task-list.tsx:407-412` may commit before chip click when `relatedTarget` is `null` (Safari/touch). `overflow-hidden` on task row at `:338` may clip third chip hit target at ~320px.
- **Test gap:** `task-list.test.tsx:333-348` covers SegmentedControl save for work type only — no horizon chip test (L-04).

### Key Discoveries:

- D-09 fix is **display oracle + guest hook** — no schema, tRPC, or `personaPresetId` persistence changes.
- Unwinding S-36 divergence rule requires updating `persona-presets.test.ts:178-194` (currently asserts demotion).
- `markCreateFormCustom()` on create form still sends `personaPresetId: "custom"` when user opens Własny panel — **out of scope** (create-flow design, not inline edit).
- Blur-save architecture from fix-task-edit-blur-save (`commitEditIfDirty`, document `pointerdown`) must be preserved when hardening D-08.

## Desired End State

- Task created with preset "Gaszenie" shows **"Gaszenie"** badge after create, after reload, and **after inline edit** that changes urgency/horizon/work type (effort-only edits already worked).
- Guest mode: preset create persists and displays persona badge same as auth.
- Horizon "Gdy się da" has **visually distinct active state**; inline edit from ASAP → WHEN_POSSIBLE updates selection and persists on save.
- Edit-mode task rows do not clip horizon chip hit targets at narrow widths.
- Blur-save does not close edit panel before SegmentedControl horizon click (Safari-safe).
- `pnpm check`, `pnpm test`, and `set CI=true && pnpm test:e2e:belt` green.

## What We're NOT Doing

- **Create-form custom panel behavior** — selecting preset then opening Własny and changing attrs still sends `"custom"` at Add; separate product question.
- **Clearing or rewriting `personaPresetId` on inline edit** — persistence unchanged; display only.
- **D-10 status vocabulary**, **D-04 illustrations**, **layout/navbar** — other fix waves.
- **New Eisenhower "preset + detail when diverged" fourth mode** — simpler rule: valid catalog id → always `"persona"` mode (preset label + effort badge as today).
- **E2E spec for every D-08 repro variant** — component tests + manual checklist; belt unchanged unless regressions found.

## Implementation Approach

Four phases. **D-09 first** (high confidence, isolated oracle + hook). **D-08 UX bundle second** (styling, overflow, horizon component test). **Blur-save hardening third** (deferred commit with cancel-on-interaction). **Belt + manual repro fourth** to close wave 3.

## Critical Implementation Details

**Badge oracle contract** — After revision, `getTaskBadgeDisplayMode` returns `"persona"` for any valid catalog `personaPresetId` (not `"custom"`, not `null`, known in `TASK_PERSONA_PRESETS`). `"legacy"`, `"custom-detail"` paths unchanged for null/custom/unknown ids. Update the divergence test to expect `"persona"` instead of `"custom-detail"`.

**Guest create parity** — Add `personaPresetId: input.personaPresetId ?? null` to guest branch of `createTask` at `use-task-mutations.ts:497-506`. Auth path already forwards via `createMutation`.

**WHEN_POSSIBLE active color** — Use existing work-type token pair for visual parity with ASAP/THIS_WEEK: `bg-worktype-ops-bg text-worktype-ops-text` (defined in `globals.css:63-64`, used in `work-type-config.ts:11-13`).

**Edit-mode overflow** — Conditionally omit `overflow-hidden` from `<li>` when `editingId === task.id` (or use `overflow-visible` override). Keep `overflow-hidden` in read mode for rounded-corner clipping.

**Deferred blur commit** — On edit panel `onBlur`, schedule `commitEditIfDirty` via `requestAnimationFrame` or `setTimeout(0)`; store timer id; cancel if a SegmentedControl `mousedown`/`pointerdown` fires on the panel before timer runs. Do not remove existing `relatedTarget` containment check — defer only when leaving panel.

## Phase 1: Preset Badge Oracle + Guest Parity (D-09)

### Overview

Revise display oracle per product decision; forward `personaPresetId` in guest create; update unit/component tests.

### Changes Required:

#### 1. Badge display oracle

**File**: `src/lib/task/persona-presets.ts`

**Intent**: Valid catalog preset id always yields `"persona"` display mode regardless of attribute divergence from preset bundle.

**Contract**: In `getTaskBadgeDisplayMode` (`:176-198`), after unknown-id guard, return `"persona"` for valid catalog ids. Remove or bypass the `taskAttributesMatchPreset` divergence branch that returns `"custom-detail"`.

#### 2. Oracle unit tests

**File**: `src/lib/task/persona-presets.test.ts`

**Intent**: Encode new contract; replace divergence → custom-detail expectation at `:178-194`.

**Contract**: Test renamed/revised: diverged attrs + valid preset id → `"persona"`. Keep existing tests for null, custom, unknown id, matching attrs.

#### 3. Guest create hook

**File**: `src/hooks/use-task-mutations.ts`

**Intent**: Guest tasks retain preset identity same as auth.

**Contract**: Guest `taskRepo.create({...})` at `:497-506` includes `personaPresetId: input.personaPresetId ?? null`.

#### 4. TaskList badge regression tests

**File**: `src/app/_components/task-list.test.tsx`

**Intent**: Oracle change visible in UI — preset label survives inline edit.

**Contract**: New test: render task row with `personaPresetId: "firefight"` and attrs diverging from firefight bundle → `task-persona-badge` shows preset label (EN: "Firefight", use messages import). Optional: guest-mode create with preset if test harness supports guest `DataModeProvider`.

#### 5. Guest hook test (if co-located pattern exists)

**File**: `src/hooks/use-task-mutations.test.ts` (new only if no existing guest create test file — prefer extending nearest existing test)

**Intent**: Assert guest `createTask` forwards `personaPresetId` to repo mock.

**Contract**: Mock guest repo; call `createTask` with `personaPresetId: "firefight"`; expect repo received field.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/lib/task/persona-presets.test.ts src/app/_components/task-list.test.tsx`
- `pnpm check`
- `pnpm test`

#### Manual Verification:

- Auth: Select "Gaszenie" → Add → badge shows "Gaszenie"
- Inline edit urgency on that task → save → badge still "Gaszenie" (not "Własny")
- Guest (if available): same preset flow shows persona badge

**Implementation Note**: Pause for manual confirmation before Phase 2.

---

## Phase 2: Horizon UX + Edit Row Overflow (D-08)

### Overview

Distinct WHEN_POSSIBLE active styling, conditional overflow on edit rows, component test for horizon chip interaction and save.

### Changes Required:

#### 1. WHEN_POSSIBLE active color

**File**: `src/app/_components/task-fields-panel.tsx`

**Intent**: Active third horizon segment visually distinct from inactive (fixes "click did nothing" UX when selection changes).

**Contract**: `colorMap.WHEN_POSSIBLE` at `:152` → `"bg-worktype-ops-bg text-worktype-ops-text"`.

#### 2. Task row overflow in edit mode

**File**: `src/app/_components/task-list.tsx`

**Intent**: Prevent horizon chip hit-target clipping when edit panel expands row content.

**Contract**: `<li>` className at `:338` — apply `overflow-hidden` only when `editingId !== task.id` (read/focus mode). Edit mode uses `overflow-visible` or omits overflow class.

#### 3. Horizon SegmentedControl component test

**File**: `src/app/_components/task-list.test.tsx`

**Intent**: Regression oracle for D-08 — horizon chip click updates value and persists on commit (L-04 per-surface coverage).

**Contract**: New test mirroring `:333-348` pattern but for horizon: task with `commitmentHorizon: "ASAP"` → open edit → click "When possible" / PL equivalent → assert `aria-pressed` on WHEN_POSSIBLE segment → trigger commit → `updateTask` called with `commitmentHorizon: "WHEN_POSSIBLE"`.

#### 4. TaskFieldsPanel smoke (optional)

**File**: `src/app/_components/task-fields-panel.test.tsx`

**Intent**: Assert WHEN_POSSIBLE segment receives ops color classes when selected.

**Contract**: Render panel with `commitmentHorizon="WHEN_POSSIBLE"` → active button has `bg-worktype-ops-bg`.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/app/_components/task-list.test.tsx src/app/_components/task-fields-panel.test.tsx`
- `pnpm check`
- `pnpm test`

#### Manual Verification:

- Inline edit task with horizon ASAP → click "Gdy się da" (PL) → segment highlights distinctly → save persists
- ~320px viewport: third chip clickable; edit panel does not close prematurely
- Create custom panel: change horizon to "Gdy się da" works

**Implementation Note**: Pause for manual confirmation before Phase 3.

---

## Phase 3: Blur-Save Hardening for SegmentedControl (D-08)

### Overview

Defer panel blur commit so Safari/touch flows where `relatedTarget` is null do not save-and-close before horizon chip click.

### Changes Required:

#### 1. Deferred blur commit on edit panel

**File**: `src/app/_components/task-list.tsx`

**Intent**: Prevent race between panel `onBlur` and SegmentedControl click.

**Contract**: Edit panel wrapper `onBlur` (`:407-412`): if `relatedTarget` is inside panel, return; else schedule deferred `commitEditIfDirty()`; store ref to timer; clear on panel unmount. SegmentedControl already has `onMouseDown preventDefault` (`task-fields-panel.tsx:48`).

#### 2. Cancel deferral on in-panel interaction

**File**: `src/app/_components/task-list.tsx`

**Intent**: If user clicks a SegmentedControl button, cancel pending blur commit so click handler runs first.

**Contract**: Add `onPointerDown` capture on edit panel container (same wrapper as blur) that clears pending blur timer when target is inside a segmented control button (`role` or testid pattern).

#### 3. Component test for blur + horizon

**File**: `src/app/_components/task-list.test.tsx`

**Intent**: Simulate blur with null relatedTarget followed by horizon click — edit stays open and value updates.

**Contract**: Extend Phase 2 horizon test or add case: fire blur event with `relatedTarget: null` then click WHEN_POSSIBLE — panel remains, horizon updates.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/app/_components/task-list.test.tsx`
- `pnpm check`
- `pnpm test`

#### Manual Verification:

- Safari/iOS or Firefox: inline edit → tap "Gdy się da" → selection changes without panel closing early

**Implementation Note**: Pause for manual confirmation before Phase 4.

---

## Phase 4: Belt + Manual Repro Checklist

### Overview

Full verification gate and documented manual repro for D-08/D-09 variants from research.

### Changes Required:

#### 1. No code changes unless belt failures

**Intent**: Run full quality gates; fix only regressions introduced by phases 1–3.

### Success Criteria:

#### Automated Verification:

- `pnpm check`
- `pnpm test`
- `set CI=true && pnpm test:e2e:belt`

#### Manual Verification:

- **D-09 repro checklist:** Auth create → reload → edit attrs → badge; guest preset create; confirm custom-panel path still shows Własny (expected)
- **D-08 repro checklist:** Inline edit ASAP→WHEN_POSSIBLE; create Własny panel; already-selected WHEN_POSSIBLE (UX-only); mobile ~320px; Safari if available

**Implementation Note**: Final phase — manual checklist closes open questions from research.

---

## Testing Strategy

### Unit Tests:

- `persona-presets.test.ts` — oracle branches including divergence → persona
- `task-list.test.tsx` — badge after diverged attrs; horizon chip click + save; blur deferral

### Integration Tests:

- Full suite `pnpm test`
- E2E belt unchanged logic; must stay green

### Manual Testing Steps:

1. D-09: Gaszenie create → edit urgency → still Gaszenie (PL)
2. D-09: Guest preset create shows badge
3. D-08: Horizon chip distinct active state + persistence
4. D-08: Narrow viewport chip not clipped
5. D-08: Touch/Safari blur race (if device available)

## Performance Considerations

None material — display logic and CSS class changes only; deferred blur adds one timer per blur event.

## Migration Notes

No DB migration. Existing tasks with stored `personaPresetId` immediately show preset label after deploy. Revert = revert PR.

## References

- Research: `context/changes/task-edit-interaction-fixes/research.md`
- Defect register: `context/changes/mvp-defect-intake/change.md` (D-08, D-09)
- Parent research: `context/changes/mvp-defect-intake/research.md` (wave 3)
- Blur-save archive: `context/archive/2026-06-12-fix-task-edit-blur-save/`
- Persona presets v2: `context/archive/2026-06-14-persona-presets-v2/plan-brief.md`
- SegmentedControl test pattern: `task-list.test.tsx:333-348`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Preset Badge Oracle + Guest Parity (D-09)

#### Automated

- [x] 1.1 `pnpm exec vitest run src/lib/task/persona-presets.test.ts src/app/_components/task-list.test.tsx`
- [x] 1.2 `pnpm check`
- [x] 1.3 `pnpm test`

#### Manual

- [x] 1.4 Auth: Gaszenie create → edit urgency → badge still Gaszenie
- [x] 1.5 Guest: preset create shows persona badge

### Phase 2: Horizon UX + Edit Row Overflow (D-08)

#### Automated

- [x] 2.1 `pnpm exec vitest run src/app/_components/task-list.test.tsx src/app/_components/task-fields-panel.test.tsx`
- [x] 2.2 `pnpm check`
- [x] 2.3 `pnpm test`

#### Manual

- [x] 2.4 Inline edit ASAP → Gdy się da → distinct highlight + save persists
- [x] 2.5 ~320px viewport: third chip clickable without premature panel close

### Phase 3: Blur-Save Hardening (D-08)

#### Automated

- [x] 3.1 `pnpm exec vitest run src/app/_components/task-list.test.tsx`
- [x] 3.2 `pnpm check`
- [x] 3.3 `pnpm test`

#### Manual

- [x] 3.4 Safari/touch: tap horizon chip without panel closing early

### Phase 4: Belt + Manual Repro Checklist

#### Automated

- [x] 4.1 `pnpm check`
- [x] 4.2 `pnpm test`
- [x] 4.3 `set CI=true && pnpm test:e2e:belt`

#### Manual

- [x] 4.4 Complete D-09 repro checklist from plan
- [x] 4.5 Complete D-08 repro checklist from plan
