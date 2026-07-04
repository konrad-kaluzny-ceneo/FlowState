# Task UI Quick Fixes — Implementation Plan

## Overview

Fix wave 1 from the post-MVP defect register: four small, independent UI quality fixes that do not touch layout, schema, or session logic. **D-05** — fix `StyledCheckbox` duplicate HTML `id` bug so the daily-standing toggle in inline edit affects only the edited task, not the create composer. **D-03** — default the create-form “Uwzględnij w Daily” checkbox to checked (UI only). **D-11** — internationalize all user-visible strings in `OutOfTabBreakAlertsControl` under the existing `BreakAlerts` namespace. **D-02** — remove the preset educational coach banner and clean up dead UI paths (hook, copy helper, i18n key, e2e dismiss helper).

## Current State Analysis

From `context/changes/mvp-defect-intake/research.md` and verified at current `main`:

- **D-05 (STRONG):** `styled-checkbox.tsx:22` sets `inputId = id ?? dataTestId`. `task-fields-panel.tsx:260-265` renders `StyledCheckbox` with `data-testid="daily-standing-toggle"` and no `id`. The create form (`task-list.tsx:911-917`) is always mounted; opening inline edit on any active task mounts a second panel (`task-list.tsx:416-442`, `:1103-1125`) with the same testid → duplicate DOM ids; label `htmlFor` targets the composer checkbox first.
- **D-03 (decided):** `task-list.tsx:608` initializes `newIsDailyStanding` with `useState(false)`; `resetCreateFormState()` at `:619` resets to `false`. Prior `ui-polish-fixes` slice intended UI default `true` but only partially landed.
- **D-11 (STRONG):** `out-of-tab-break-alerts-control.tsx:46-68` hardcodes four EN strings. `BreakAlerts` namespace in `messages/en.json:536-541` and `messages/pl.json:536-541` has permission-overlay keys only. `break-alerts-permission-prompt.tsx:23` shows the i18n pattern (`useTranslations("BreakAlerts")`). Tests in `out-of-tab-break-alerts-control.test.tsx` assert hardcoded EN without `IntlTestWrapper`.
- **D-02 (decided):** `persona-preset-picker.tsx:104-121` renders coach banner when `coachLine` prop set. `task-list.tsx:572-573,939-944` wires `usePresetCoachOnboarding` + `getPresetCoachLine`. E2E `dismissPresetCoachIfVisible` in `e2e/helpers/onboarding.ts:56-63` called from `work-cycle.ts:243`. Onboarding storage still has `presetCoachDismissed` field — harmless dead data after UI removal.

### Key Discoveries:

- Only **two** `StyledCheckbox` call sites exist: `task-fields-panel.tsx` and `out-of-tab-break-alerts-control.tsx` — class-level `useId()` fix covers both.
- `resumeNoteFieldId` pattern already established in `task-list.tsx:438` — reuse for daily-standing ids.
- Belt e2e already compensates for daily default via `uncheckDailyStandingDefault` (`work-cycle.ts:62-72`) — must scope selector to create panel after D-05.
- `task-list.test.tsx` already wraps renders in `IntlTestWrapper` — D-11 tests need the same pattern in their own file.

## Desired End State

- Clicking “Uwzględnij w Daily” label in an **inline edit panel** toggles only that task’s checkbox; composer checkbox is unaffected.
- New tasks created via UI have daily standing **checked by default**; reset after submit returns to checked.
- Break-alerts settings control shows **PL copy** when locale is PL (toggle label + permission hints + retry button).
- Preset picker shows **no coach banner**; no e2e step dismisses a nonexistent banner.
- `pnpm check`, `pnpm test`, and `set CI=true && pnpm test:e2e:belt` green.

## What We're NOT Doing

- **D-08 / D-09** — deferred to `task-edit-interaction-fixes` (requires browser repro).
- **Prisma / DB default** for `isDailyStanding` — UI create-form default only; existing rows unchanged.
- **Removing `presetCoachDismissed` from onboarding storage schema** — dead field is harmless; full schema migration not worth the churn (remove UI paths only).
- **Changing preset picker behavior** beyond banner removal — chips, custom panel, preset application unchanged.
- **Break-alerts permission overlay** (`break-alerts-permission-prompt.tsx`) — already i18n’d; out of scope except shared namespace keys.

## Implementation Approach

Four phases, each independently green. Order matches risk: fix the functional accessibility bug first (D-05), then defaults (D-03), then i18n (D-11), then banner removal + e2e cleanup (D-02). Phases 2–3 touch disjoint files and could swap if needed; phase 4 must be last so e2e cleanup removes `dismissPresetCoachIfVisible` after banner is gone.

## Critical Implementation Details

**StyledCheckbox id contract** — After `useId()`, `data-testid` must never become `id`. When `id` prop is omitted, React generates a stable unique id. Explicit ids from callers remain supported for test scoping.

**Daily-standing id wiring** — Add optional `dailyStandingFieldId?: string` to `TaskFieldsPanel` (mirror `resumeNoteFieldId`). Pass from `task-list.tsx`:
- Create: `daily-standing-create`
- Edit (active + completed panels): `daily-standing-edit-${task.id}`

Keep shared `data-testid="daily-standing-toggle"` on both inputs; e2e scopes to `task-fields-panel-create` for create flows.

**Belt daily-standing helper** — Update `uncheckDailyStandingDefault` in `e2e/helpers/work-cycle.ts:63-72` to:
```ts
const toggle = page.getByTestId("task-fields-panel-create").getByTestId("daily-standing-toggle");
```
This avoids strict-mode violations when an edit panel is open during belt runs.

## Phase 1: StyledCheckbox Duplicate-ID Fix (D-05)

### Overview

Fix the root cause in `StyledCheckbox` and wire explicit ids for daily-standing instances. Add regression tests.

### Changes Required:

#### 1. StyledCheckbox component

**File**: `src/app/_components/styled-checkbox.tsx`

**Intent**: Stop using `data-testid` as HTML `id` fallback. Generate stable unique ids via `useId()` when caller omits `id`.

**Contract**: `inputId = id ?? useId()`; `data-testid` remains separate attribute on `<input>`. Label `htmlFor` binds to `inputId`.

#### 2. Co-located unit test (new)

**File**: `src/app/_components/styled-checkbox.test.tsx`

**Intent**: Guard the class bug — two instances with same `data-testid` must produce different `id` values; when only testid provided, `id !== data-testid`.

**Contract**: Vitest + `@testing-library/react`; render two `StyledCheckbox` with identical `data-testid`.

#### 3. TaskFieldsPanel id prop

**File**: `src/app/_components/task-fields-panel.tsx`

**Intent**: Accept optional `dailyStandingFieldId` and pass as `id` to `StyledCheckbox` at `:260-265`.

**Contract**: New optional prop `dailyStandingFieldId?: string`; forwarded to `StyledCheckbox` `id` prop.

#### 4. TaskList wiring

**File**: `src/app/_components/task-list.tsx`

**Intent**: Pass unique ids to each `TaskFieldsPanel` instance — create form and both edit panels (active `:416`, completed `:1103`).

**Contract**:
- Create panel: `dailyStandingFieldId="daily-standing-create"`
- Edit panels: ``dailyStandingFieldId={`daily-standing-edit-${String(task.id)}`}``

#### 5. TaskFieldsPanel test update

**File**: `src/app/_components/task-fields-panel.test.tsx`

**Intent**: Assert explicit id is forwarded when `dailyStandingFieldId` provided.

**Contract**: Optional test case with `dailyStandingFieldId="test-daily-id"` → input `#test-daily-id` exists.

#### 6. TaskList test scope

**File**: `src/app/_components/task-list.test.tsx`

**Intent**: Scope daily-standing toggle assertion to create panel to avoid ambiguity once edit panels can coexist in future tests.

**Contract**: Use `within(screen.getByTestId("task-fields-panel-create")).getByTestId("daily-standing-toggle")` at `:687-690`.

#### 7. E2E helper scope

**File**: `e2e/helpers/work-cycle.ts`

**Intent**: Scope `uncheckDailyStandingDefault` to create panel only.

**Contract**: Line `:64` — prefix with `task-fields-panel-create` locator.

#### 8. Component test: edit isolation (new or extended)

**File**: `src/app/_components/task-list.test.tsx`

**Intent**: Regression oracle for D-05 — with create form daily unchecked and edit panel open with daily checked, clicking edit-panel label toggles edit checkbox only.

**Contract**: Open inline edit on standing task; verify composer and edit checkboxes have different `id` attributes and independent checked state.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/app/_components/styled-checkbox.test.tsx src/app/_components/task-fields-panel.test.tsx src/app/_components/task-list.test.tsx`
- `pnpm check`
- `pnpm test`

#### Manual Verification:

- Open inline edit on a task; click “Uwzględnij w Daily” label — only edit-row checkbox toggles; composer checkbox unchanged
- Repeat in PL locale

**Implementation Note**: Pause for manual confirmation before Phase 2.

---

## Phase 2: Daily Standing Default Checked (D-03)

### Overview

Change create-form default from unchecked to checked in both initializer and reset.

### Changes Required:

#### 1. TaskList create form state

**File**: `src/app/_components/task-list.tsx`

**Intent**: Default new tasks to daily standing in UI.

**Contract**: Line `:608` — `useState(true)`; line `:619` in `resetCreateFormState()` — `setNewIsDailyStanding(true)`.

#### 2. Unit test expectation

**File**: `src/app/_components/task-list.test.tsx`

**Intent**: Update test at `:687-690` to expect `toggle.checked).toBe(true)`.

**Contract**: Test title unchanged; assertion flips from `false` to `true`.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/app/_components/task-list.test.tsx`
- `pnpm check`
- `pnpm test`

#### Manual Verification:

- Fresh page load: create-form daily checkbox is checked
- Add task without unchecking → task shows daily-standing badge
- After submit, new create form resets with checkbox checked again

**Implementation Note**: Pause for manual confirmation before Phase 3.

---

## Phase 3: BreakAlerts i18n (D-11)

### Overview

Move all user-visible strings in `OutOfTabBreakAlertsControl` to `BreakAlerts` namespace; add PL translations.

### Changes Required:

#### 1. Message keys

**Files**: `messages/en.json`, `messages/pl.json`

**Intent**: Add four keys under existing `BreakAlerts` object (after `:540`).

**Contract**: New keys:
- `settingsToggleLabel`
- `permissionDeniedHint`
- `tryAgain`
- `permissionDefaultHint`

PL copy aligned with product voice (calm, direct). EN values match current hardcoded strings.

#### 2. Component i18n

**File**: `src/app/_components/out-of-tab-break-alerts-control.tsx`

**Intent**: Replace all hardcoded strings with `useTranslations("BreakAlerts")` (pattern: `break-alerts-permission-prompt.tsx:23`).

**Contract**: Import `useTranslations` from `next-intl`; no remaining literal user-facing EN in component body.

#### 3. Component tests

**File**: `src/app/_components/out-of-tab-break-alerts-control.test.tsx`

**Intent**: Wrap renders in `IntlTestWrapper` from `~/i18n/test-intl`; assert against message keys or imported `enMessages`.

**Contract**: All five existing tests updated; no hardcoded EN assertions unless sourced from messages import.

#### 4. Parity

**File**: `src/i18n/messages-parity.test.ts`

**Intent**: Auto-passes if key structure matches — verify no manual change needed after adding keys to both locales.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/app/_components/out-of-tab-break-alerts-control.test.tsx src/i18n/messages-parity.test.ts`
- `pnpm check`
- `pnpm test`

#### Manual Verification:

- Switch to PL; open timer/break settings — toggle label and hints in Polish
- Denied-permission state shows PL hint + “Spróbuj ponownie” (or chosen PL for `tryAgain`)

**Implementation Note**: Pause for manual confirmation before Phase 4.

---

## Phase 4: Preset Coach Banner Removal + Belt (D-02)

### Overview

Remove preset educational banner and all UI wiring; clean e2e helpers; run full belt.

### Changes Required:

#### 1. PersonaPresetPicker

**File**: `src/app/_components/persona-preset-picker.tsx`

**Intent**: Remove coach banner block and related props.

**Contract**: Delete `coachLine`, `onDismissCoach` from props type (`:40-41`) and JSX (`:104-121`). Remove unused `useTranslations("Onboarding.firstRun")` if only used for dismiss label.

#### 2. TaskList wiring

**File**: `src/app/_components/task-list.tsx`

**Intent**: Remove preset coach hook and props passed to picker.

**Contract**: Remove imports `usePresetCoachOnboarding`, `getPresetCoachLine`; delete hook call `:572-573`; remove `coachLine` / `onDismissCoach` from `PersonaPresetPicker` at `:939-944`.

#### 3. Onboarding hook export

**File**: `src/hooks/use-onboarding-state.ts`

**Intent**: Remove `usePresetCoachOnboarding` export (`:166-182`) if no remaining callers. Keep `shouldShowPresetCoach` / `markPresetCoachDismissed` on context only if still used elsewhere — grep before deleting context fields.

**Contract**: If context still exposes preset coach for no consumer, remove from context value + provider logic at `:94-96,127-128` as dead code. Leave `presetCoachDismissed` in storage types as harmless dead field.

#### 4. Copy helper

**File**: `src/lib/onboarding/copy.ts`

**Intent**: Remove `getPresetCoachLine` and deprecated `PRESET_COACH_LINE` export.

**Contract**: Delete functions at `:54-56,75-76`; grep for remaining imports.

#### 5. i18n key removal

**Files**: `messages/en.json`, `messages/pl.json`

**Intent**: Remove `Onboarding.coach.preset` key (`:46`).

**Contract**: Grep `coach.preset` / `getPresetCoachLine` clean after removal.

#### 6. Unit test removal

**File**: `src/app/_components/task-list.test.tsx`

**Intent**: Delete preset coach test (`:517-528`) and related mock setup (`:14,23-31` preset coach mock if unused).

**Contract**: No references to `preset-coach` testids in unit tests.

#### 7. E2E helper cleanup

**Files**: `e2e/helpers/onboarding.ts`, `e2e/helpers/work-cycle.ts`

**Intent**: Remove `dismissPresetCoachIfVisible` function and all call sites.

**Contract**: Delete `onboarding.ts:56-63`; remove import + call at `work-cycle.ts:13,243`. Keep `presetCoachDismissed: true` in `seedOnboardingDismissed` — harmless for old stored state.

#### 8. Storage tests

**File**: `src/lib/onboarding/storage.test.ts`

**Intent**: Keep `presetCoachDismissed` parse/patch tests — field remains in schema; no change required unless removing field from types (out of scope).

### Success Criteria:

#### Automated Verification:

- Grep clean: `preset-coach`, `getPresetCoachLine`, `usePresetCoachOnboarding`, `dismissPresetCoachIfVisible`
- `pnpm check`
- `pnpm test`
- `set CI=true && pnpm test:e2e:belt`

#### Manual Verification:

- Create task flow: no preset coach banner appears for guest or authenticated user
- Belt specs that call `addTaskWithAttributes` still pass without dismiss step

**Implementation Note**: Final phase — belt green is merge gate.

---

## Testing Strategy

### Unit Tests:

- `styled-checkbox.test.tsx` — duplicate testid → unique ids (new)
- `task-list.test.tsx` — daily default true; edit/composer checkbox isolation (extend)
- `task-fields-panel.test.tsx` — id forwarding (optional)
- `out-of-tab-break-alerts-control.test.tsx` — i18n via IntlTestWrapper
- Remove preset coach test

### Integration Tests:

- Full Vitest suite via `pnpm test`
- E2E belt via `set CI=true && pnpm test:e2e:belt`

### Manual Testing Steps:

1. Inline edit daily-standing toggle isolation (EN + PL)
2. Create form default checked + reset after submit
3. Break alerts control in PL locale (granted + denied permission states)
4. Preset picker — no banner on first visit or returning visit

## Performance Considerations

None material — no new network calls, no additional renders beyond removed banner DOM.

## Migration Notes

No DB migration. Onboarding localStorage may retain `presetCoachDismissed: true/false` — ignored after UI removal. Revert = revert PR.

## References

- Parent research: `context/changes/mvp-defect-intake/research.md` (wave 1 section)
- Defect register: `context/changes/mvp-defect-intake/change.md` (D-02, D-03, D-05, D-11)
- Prior partial default intent: `context/archive/2026-06-21-ui-polish-fixes/plan.md`
- i18n test pattern: `src/i18n/test-intl.tsx`, `task-list.test.tsx:104`
- Resume-note id pattern: `task-list.tsx:438`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: StyledCheckbox Duplicate-ID Fix (D-05)

#### Automated

- [x] 1.1 `pnpm exec vitest run src/app/_components/styled-checkbox.test.tsx src/app/_components/task-fields-panel.test.tsx src/app/_components/task-list.test.tsx` — 27f4477
- [x] 1.2 `pnpm check` — 27f4477
- [x] 1.3 `pnpm test` — 27f4477

#### Manual

- [x] 1.4 Inline edit daily label toggles edit checkbox only (EN) — 27f4477
- [x] 1.5 Same verification in PL locale — 27f4477

### Phase 2: Daily Standing Default Checked (D-03)

#### Automated

- [x] 2.1 `pnpm exec vitest run src/app/_components/task-list.test.tsx` — 2ee2e26
- [x] 2.2 `pnpm check` — 2ee2e26
- [x] 2.3 `pnpm test` — 2ee2e26

#### Manual

- [x] 2.4 Create form defaults checked; resets checked after submit — 2ee2e26
- [x] 2.5 Created task shows daily-standing badge when left checked — 2ee2e26

### Phase 3: BreakAlerts i18n (D-11)

#### Automated

- [x] 3.1 `pnpm exec vitest run src/app/_components/out-of-tab-break-alerts-control.test.tsx src/i18n/messages-parity.test.ts`
- [x] 3.2 `pnpm check`
- [x] 3.3 `pnpm test`

#### Manual

- [x] 3.4 PL locale: toggle label and hints translated
- [x] 3.5 Denied-permission retry button translated in PL

### Phase 4: Preset Coach Removal + Belt (D-02)

#### Automated

- [ ] 4.1 Grep clean: no preset-coach / getPresetCoachLine / dismissPresetCoachIfVisible references
- [ ] 4.2 `pnpm check`
- [ ] 4.3 `pnpm test`
- [ ] 4.4 `set CI=true && pnpm test:e2e:belt`

#### Manual

- [ ] 4.5 No preset coach banner on create form (guest + auth)
- [ ] 4.6 Belt task-creation flows unaffected
