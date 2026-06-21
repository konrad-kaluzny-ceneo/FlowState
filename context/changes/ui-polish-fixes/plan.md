# UI polish — beige palette, task editing, icons, simplified overlays — Implementation Plan

## Overview

Ship nine UI polish items from `change.md`: replace plum primary with a cool-stone beige palette, unify task create/edit styling, enable completed-task editing, improve done-state readability, add session button icons, polish the timer focus card, style checkboxes (Daily standing default-on), simplify break-alert settings, and polish daily recap hub card (raised elevation, X dismiss, section UX). All changes are UI-layer; no tRPC or schema changes except optional token/documentation updates.

## Current State Analysis

**Phase 1 landed (bdd58b3):** cool-stone beige tokens and `--color-focus` alias live in `globals.css`; `DESIGN.md` YAML updated; hardcoded purple removed from `pomodoro-dashboard.tsx`. Remaining slice work is UI polish on checkbox, recap hub card, task-list, timer, and icons — no further token migration unless contrast regressions surface.

FlowState uses Tailwind v4 CSS-first tokens in `src/styles/globals.css` (pre–Phase 1: plum `#5E5290` as `accent-cta`, lavender-tinted shell gradients). Task create (bordered input, persona presets) and edit (borderless textarea, always-visible attribute panel) diverge inside `task-list.tsx`. Completed tasks render as read-only `<li>` rows despite the server accepting updates. Session buttons are text-only except persona presets' lucide usage. Break alerts settings show legend, status paragraph, checkbox, and permission hints even when healthy.

### Key Discoveries:

- Token hub: `src/styles/globals.css:3-62` — single recolor point for ~15 accent consumers
- Hardcoded purple leak: `pomodoro-dashboard.tsx:407,534` — must migrate to semantic tokens
- Completed split: `task-list.tsx:803-804,1200-1254` — UI-only edit lock
- Strikethrough: `task-list.tsx:609,1224` + `DESIGN.md:202` — intentional spec divergence for item 6
- E2E mixed selectors: testids for pause/end-session; role names for Add/Focus/Interrupt
- Daily recap panel uses flat `bg-surface-panel` — post–Phase 1 cool-stone tokens reduced contrast vs white task cards (`daily-recap-panel.tsx:86`)

## Desired End State

After all six phases:

1. Light theme uses cool-stone beige accent (OKLCH h ~95–110) with retinted neutrals; dark theme desaturated equivalents; `DESIGN.md` YAML and prose updated.
2. `StyledCheckbox` styles Daily standing and break-alert toggles; new tasks default Daily standing checked (UI only).
3. Break alerts control is a single styled checkbox with intent label; permission denied/default hints appear only when relevant.
4. Daily recap panel uses DESIGN.md raised-card elevation (`bg-surface-card border-card-border shadow-sm`); title only (no subtitle); lucide `X` icon-only dismiss with `aria-label="Dismiss daily recap"`; Last 24h section omitted when `last24Hours.length === 0`; Today section always visible with chevron expand/collapse (no link-style underline hover).
5. Create and edit share `TaskFieldsPanel` with bordered title field; persona presets remain create-only.
6. Completed section rows support click-to-edit using the same panel; done state uses `text-text-dimmed` + checkmark, no `line-through`.
7. Pause, Resume, Interrupt, Focus, Add use lucide icons (icon-only with aria-label); End session keeps text.
8. Timer idle/running card uses `border-card-border shadow-sm` and aligned heading tiers per DESIGN.md.

Verification: `pnpm check`, `pnpm test`, `set CI=true && pnpm test:e2e:belt`, `set CI=true && pnpm test:e2e:a11y`.

## What We're NOT Doing

- Prisma `@default(true)` migration for `isDailyStanding`
- Break-alerts permission overlay (`break-alerts-permission-prompt.tsx`) "Not now" → "Close" consistency
- Wedge transition conductor (F-07) or timer-hub session-end UX (B-08/B-09)
- Extracting all of `task-list.tsx` beyond `TaskFieldsPanel` / `StyledCheckbox`
- Changing suggestion scoring, recap data, or guest merge logic
- Daily recap visible text dismiss label `"Close"` (icon X per change.md item 2 + post–Phase 1 feedback)
- Last 24h empty-state copy when section is omitted (`"No focused work in the last 24 hours yet."` not shown — section absent instead)
- Chevron rotation / motion polish beyond basic expand/collapse (static chevron acceptable)
- `DESIGN.md` dedicated "hub recap card" tier — reuse existing raised-card elevation row

## Implementation Approach

Work token-first (high leverage, a11y gate), then shared primitives (checkbox), then daily recap hub-card polish, then the heavy `task-list.tsx` refactor in two phases (unify fields, then completed edit + done-state), finishing with timer/icon polish that depends on stable accent tokens. Preserve all `data-testid` values. Icon-only buttons must expose the same accessible names e2e already targets.

## Critical Implementation Details

### User experience spec

Icon-only session buttons must include `aria-label` matching current visible text ("Pause", "Interrupt", "Focus", "Add", "Resume") so Playwright `getByRole` selectors remain stable. End session keeps visible text — no aria-only regression for that control.

### State sequencing

Phase 5 (completed edit) should land after Phase 4 (`TaskFieldsPanel`) so completed rows reuse the same edit panel and commit handlers — do not duplicate inline edit markup in the completed section.

---

## Phase 1: Cool stone token recolor

### Overview

Replace plum-lavender primary with cool-stone beige across semantic tokens, retint shell neutrals toward the new hue, update DESIGN.md, and eliminate hardcoded purple classes.

### Changes Required:

#### 1. Light theme tokens

**File**: `src/styles/globals.css`

**Intent**: Retint accent and shell tokens from plum/lavender to cool stone (OKLCH hue ~95–110, restrained chroma per Impeccable). Update `accent-cta`, `accent-cta-hover`, `segment-active`, `energy-steady` (+ border/bg derivations), `focus-ring`, and lavender-tinted neutrals (`shell-bottom`, `surface-card-muted`, `surface-panel`, `border-subtle`, `card-border`).

**Contract**: Preserve token **names** unchanged. Re-evaluate `on-cta` — cool stone fill may require `text-primary` (ink) instead of white for ≥4.5:1 contrast. Add `--color-focus: var(--color-focus-ring)` in `@theme` — components use `ring-focus` but theme today only defines `--color-focus-ring` (auth forms and selected task row depend on visible ring).

#### 2. Dark theme overrides

**File**: `src/styles/globals.css` (`[data-theme="dark"]` block)

**Intent**: Desaturate cool-stone accent equivalents for calm dark mode, mirroring F-06 dark pattern.

**Contract**: Same semantic token names; dark values remain readable on `#1E2433` shell.

#### 3. Design contract

**File**: `DESIGN.md`

**Intent**: Update YAML `colors:` block and strategy prose (lines ~4–37, ~109–176) from "muted plum-lavender primary" to cool-stone beige restrained palette. Note revised CTA/on-cta pairing if ink text is chosen.

**Contract**: YAML hex values match `globals.css` after recolor.

#### 4. Hardcoded purple removal

**File**: `src/app/_components/pomodoro-dashboard.tsx`

**Intent**: Replace `border-purple-400/30 bg-purple-500/10 text-purple-100/90` (break transition + override ack, ~lines 407 and 534) with semantic accent/surface tokens.

**Contract**: No `purple-*` Tailwind classes remain in wedge components touched by this slice.

### Success Criteria:

#### Automated Verification:

- `pnpm check` passes
- `pnpm typecheck` passes
- `pnpm test` passes
- `set CI=true && pnpm test:e2e:a11y` passes (no new critical/serious axe violations)

#### Manual Verification:

- Home shell gradient reads cool stone, not lavender-plum
- Primary CTAs (Focus, Add, auth buttons) have adequate contrast on light background
- Focus ring visible on selected task row
- Dark theme toggle still coherent

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Shared checkbox, daily standing default, break alerts simplify

### Overview

Extract a reusable styled checkbox, apply it to Daily standing (default-on for new tasks) and out-of-tab break alerts, and strip verbose always-visible copy from break alerts settings.

### Changes Required:

#### 1. StyledCheckbox component

**File**: `src/app/_components/styled-checkbox.tsx` (new)

**Intent**: Provide accessible, on-brand checkbox styling shared by Daily standing toggle and break alerts control — replaces native unstyled `<input type="checkbox">`.

**Contract**: Props: `checked`, `onChange`, `disabled?`, `label`, `data-testid?`, `id?`. Uses semantic border/surface/accent tokens and visible focus ring. Co-located smoke test optional if trivial; break-alerts and task-list tests cover integration.

#### 2. Daily standing toggle + default

**File**: `src/app/_components/task-list.tsx`

**Intent**: Refactor `DailyStandingToggle` (~lines 260–278) to use `StyledCheckbox`. Change create form initial state `newIsDailyStanding` from `false` to `true` (~lines 752, 763 reset). Edit form still reflects task's stored value.

**Contract**: `data-testid="daily-standing-toggle"` preserved. No Prisma or guest-repo default changes — UI create path only.

#### 3. Break alerts simplification

**File**: `src/app/_components/out-of-tab-break-alerts-control.tsx`

**Intent**: Remove fieldset `<legend>` title and status `<p>` (`data-testid="out-of-tab-break-alerts-status"`). Keep styled checkbox with intent label "Alert me when break starts (other tab)". Retain permission-denied block (~lines 67–82) and default-permission hint (~lines 83–88) — show only when `permission === "denied"` or (`permission === "default" && enabled`).

**Contract**: `data-testid="out-of-tab-break-alerts-control"` and `out-of-tab-break-alerts-toggle` preserved. Remove `out-of-tab-break-alerts-status` intentionally (status no longer always visible). Toggle handler behavior unchanged.

#### 4. Tests

**Files**: `src/app/_components/out-of-tab-break-alerts-control.test.tsx`, `src/app/_components/task-list.test.tsx`, optionally `e2e/daily-standing-capacity.spec.ts`

**Intent**: Update assertions that expect status label always visible; adjust any tests assuming unchecked-by-default on create if they open create form and assert toggle state.

**Contract**: Tests pass without changing e2e belt coverage semantics for standing badge flows (e2e helpers may still explicitly set `isDailyStanding: true`).

### Success Criteria:

#### Automated Verification:

- `pnpm check` passes
- `pnpm exec vitest run src/app/_components/out-of-tab-break-alerts-control.test.tsx`
- `pnpm exec vitest run src/app/_components/task-list.test.tsx`

#### Manual Verification:

- Daily standing checkbox visually matches break alerts checkbox
- New task form opens with Daily standing checked
- Break alerts area shows only checkbox when permission granted; error copy appears when denied

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Daily recap visual polish

### Overview

Polish the inline daily recap hub card after Phase 1 token recolor exposed low elevation and excess copy. Raise the panel to DESIGN.md raised-card tier, remove the subtitle, replace text dismiss with a lucide `X` icon-only control, omit the Last 24h section when there is no data, and restyle section headers as chevron toggles without link underline hover.

### Changes Required:

#### 1. Panel elevation and header

**File**: `src/app/_components/daily-recap-panel.tsx`

**Intent**: Change root container (~line 86) from flat `bg-surface-panel border-border-subtle` to raised card: `bg-surface-card border border-card-border shadow-sm`. Keep `rounded-lg`, padding, and `data-testid="daily-recap-panel"`. Header row: title `"Daily recap"` only — **remove** subtitle paragraph (`"Light timing for standups — list only, no charts."`, ~lines 92–94).

**Contract**: Panel reads as an elevated hub card on cool-stone shell, not a flat inset panel.

#### 2. Icon-only dismiss (lucide X)

**File**: `src/app/_components/daily-recap-panel.tsx`

**Intent**: Replace `"Not now"` text button (~lines 96–104) with lucide `X` icon-only button. Import `X` from `lucide-react`. No visible text label. Keep `data-testid="daily-recap-dismiss"`, `aria-label="Dismiss daily recap"`, and `sessionStorage` dismiss behavior unchanged. Style as a compact icon control: visible focus ring (`ring-focus` or equivalent), `text-text-dimmed` with hover toward `text-text-section`, adequate hit target (e.g. `p-1 rounded-md`).

**Contract**: E2E `e2e/daily-work-timing-recap.spec.ts:78` (testid click) unchanged. Do **not** use visible text `"Close"`.

#### 3. Last 24h — omit when empty

**File**: `src/app/_components/daily-recap-panel.tsx`

**Intent**: When `recap.last24Hours.length === 0`, do **not** render the Last 24h `<section>`, toggle, or empty-state copy (`"No focused work in the last 24 hours yet."`). When `length > 0`, render section with toggle and rows as today. Initial `last24Expanded` state: `true` when section is rendered (data present).

**Contract**: `data-testid="daily-recap-last24-toggle"` and `daily-recap-last24` exist only when `last24Hours.length > 0`. No collapsed empty shell.

#### 4. Today section — chevron toggle, no underline

**File**: `src/app/_components/daily-recap-panel.tsx`

**Intent**: Today section always renders (including empty plan with `"Nothing on today's plan yet."`). Replace toggle button classes `underline-offset-2 transition hover:underline` (~line 141) with chevron affordance: lucide `ChevronDown` (rotate when collapsed) beside label, flex row, **no** underline on hover. Apply same chevron pattern to Last 24h toggle when that section is present (~line 111). Preserve `aria-expanded`, `data-testid="daily-recap-today-toggle"`, and collapse behavior.

**Contract**: Section headers look like disclosure controls, not text links.

#### 5. Unit tests

**File**: `src/app/_components/daily-recap-panel.test.tsx`

**Intent**: **Replace** the existing `"shows empty states when sections have no rows"` case — it currently asserts `"No focused work in the last 24 hours yet."`; after Phase 3 that copy must not render and `daily-recap-last24-toggle` / `daily-recap-last24` must be absent when `last24Hours: []`. Keep Today empty copy (`"Nothing on today's plan yet."`). Also add/update: no subtitle text in document; dismiss via testid still works; recap with `last24Hours` data — section present, collapse still works (`collapses sections independently` fixture unchanged); optional assertion that root panel has raised-card utility classes if co-located smoke adds value.

**Contract**: All `daily-recap-panel.test.tsx` cases pass; no e2e spec changes required (belt recap spec exercises non-empty Last 24h path).

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/app/_components/daily-recap-panel.test.tsx`
- `pnpm check` passes

#### Manual Verification:

- Recap panel has visible elevation (white/surface-card fill, card border, subtle shadow) on timer hub after Phase 1 palette
- Header shows title only; dismiss is a clear X icon with keyboard focus ring
- Fresh session with no Last 24h work: no Last 24h section at all; Today section visible
- After a work cycle: Last 24h section appears with chevron toggle; expand/collapse works; no underline hover on section labels
- Dismiss still hides panel for the local calendar day

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Task create/edit field unification

### Overview

Extract shared task field markup so edit mode matches create mode's bordered card styling, reducing architectural duplication in `task-list.tsx`.

### Changes Required:

#### 1. TaskFieldsPanel component

**File**: `src/app/_components/task-fields-panel.tsx` (new)

**Intent**: Encapsulate shared fields: title input/textarea, Eisenhower segmented controls, effort minutes, commitment horizon, resume note, daily standing toggle. Accept mode prop or flags for create-only elements (persona preset picker).

**Contract**: Title field uses create-form chrome: `rounded-lg border border-border-subtle bg-surface-card px-4 py-2`. Edit mode uses same chrome (not borderless `bg-surface-panel`). Persona `PersonaPresetPicker` rendered only when `mode === 'create'`. Daily standing via `StyledCheckbox`.

#### 2. Wire create form

**File**: `src/app/_components/task-list.tsx` (create section ~lines 994–1130)

**Intent**: Replace inline field markup with `TaskFieldsPanel` in create mode.

**Contract**: Form submit, validation, and persona preset flow unchanged. `data-testid` values on create controls preserved or re-applied on panel internals.

#### 3. Wire edit panel

**File**: `src/app/_components/task-list.tsx` (edit section ~lines 528–603)

**Intent**: Replace inline edit markup with `TaskFieldsPanel` in edit mode. Keep commit-on-blur, pointerdown-outside, Enter, and focus-switch handlers in row component.

**Contract**: `<textarea rows={2}>` for title in edit (B-02 multiline) with create-matching border styling. Full attribute panel visibility unchanged (edit always shows attributes — no persona presets).

#### 4. Component test (L-04)

**File**: `src/app/_components/task-fields-panel.test.tsx` (new) or extend `task-list.test.tsx`

**Intent**: Smoke test that title control renders bordered card classes in both modes; daily standing toggle present when expected.

**Contract**: Per L-04 — oracle for interactive title surface change.

### Success Criteria:

#### Automated Verification:

- `pnpm check` passes
- `pnpm exec vitest run src/app/_components/task-fields-panel.test.tsx` (or task-list tests covering panel)
- `pnpm exec vitest run src/app/_components/task-list.test.tsx`
- `pnpm test` passes

#### Manual Verification:

- Click edit on active task — fields match create form visual weight (bordered title, consistent spacing)
- Create task flow unchanged functionally
- Persona presets still appear only on create

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 5: Completed task edit + done-state styling

### Overview

Enable click-to-edit on completed-section rows and replace strikethrough done signaling with dim text plus checkmark icon.

### Changes Required:

#### 1. Completed row edit wiring

**File**: `src/app/_components/task-list.tsx` (completed section ~lines 1200–1254)

**Intent**: Allow clicking completed task title (or row) to enter edit mode using shared `TaskFieldsPanel` and existing `saveEdit` / `onStartEditing` paths. Respect `cycleLocked` and `isMutating` guards consistent with active rows.

**Contract**: Completed rows use same `editingId` state as active rows. Revert-to-active button behavior preserved. Server update path unchanged (`task.ts` has no status guard on field updates).

#### 2. Done-state visual — active rows

**File**: `src/app/_components/task-list.tsx` (`doneForToday` styling ~lines 466, 609, 654)

**Intent**: Remove `line-through` from done-for-today titles. Keep row `opacity-60` or migrate to `text-text-dimmed`. Add checkmark visual reusing mark-complete button styling (filled success border) when `doneForToday`.

**Contract**: `animate-task-complete` preserved on transition (~lines 465, 796–801).

#### 3. Done-state visual — completed section

**File**: `src/app/_components/task-list.tsx` (~line 1224)

**Intent**: Remove `line-through` from completed title span. Use `text-text-dimmed` without strikethrough. Existing revert checkmark button already signals done — ensure title readability.

**Contract**: `bg-surface-card-muted` row background retained.

#### 4. Design contract update

**File**: `DESIGN.md` (task hierarchy table ~lines 197–204)

**Intent**: Replace completed row "Other" column from `line-through` to checkmark + dim text description.

**Contract**: Table documents new done-state pattern explicitly.

#### 5. Tests

**File**: `src/app/_components/task-list.test.tsx`

**Intent**: Add test: completed task row enters edit on click; assert no `line-through` class on done-for-today title rendering.

**Contract**: No regression on revert-to-active or mark-complete flows.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/app/_components/task-list.test.tsx`
- `pnpm test` passes
- `pnpm check` passes

#### Manual Verification:

- Click completed task title → edit panel opens with unified styling
- Done-for-today and completed titles readable (no strikethrough)
- Revert to active still works during idle cycle

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 6: Session icons + timer card polish

### Overview

Add lucide icons to obvious session/task actions (icon-only) and align timer focus card with DESIGN.md elevation and typography.

### Changes Required:

#### 1. Timer panel — icons

**File**: `src/app/_components/timer-panel.tsx` (~lines 152–178)

**Intent**: Import lucide icons: `Pause`, `Play` (resume), `Square` (interrupt). Render icon-only buttons with `aria-label` matching current text ("Pause", "Resume", "Resume break", "Pause break", "Interrupt", "End break early"). Preserve `data-testid` values. Focus/Add live in `task-list.tsx` (separate step below), not timer-panel.

**Contract**: Visible text removed for Pause/Interrupt/Resume; aria-label provides accessible name for e2e role queries.

#### 2. Task list — Focus and Add icons

**File**: `src/app/_components/task-list.tsx` (~lines 663–674 Focus, ~1032–1038 Add)

**Intent**: Icon-only Focus (`Target`) and Add (`Plus`) with aria-label "Focus" and "Add".

**Contract**: E2E specs using `getByRole('button', { name: 'Focus' })` / `'Add'` remain valid.

#### 3. End session — text retained

**File**: `src/app/_components/pomodoro-dashboard.tsx` (~lines 680–689)

**Intent**: Keep "End session" visible text per decision. Optional small icon prefix allowed but text must remain for discoverability.

**Contract**: `data-testid="end-session-btn"` unchanged.

#### 4. Timer card elevation + typography

**File**: `src/app/_components/timer-panel.tsx` (~lines 126–209 idle and running cards)

**Intent**: Apply DESIGN.md raised card spec: `border-card-border shadow-sm` on work-state cards; bump focus title toward overlay heading tier or add distinct section label styling for "Ready to focus on" / "Focusing on". Align interrupt button with destructive filled spec (`DESIGN.md:250`) if feasible without breaking testids.

**Contract**: `data-testid="timer-panel-idle"`, `timer-panel-running`, `timer-panel-paused`, `timer-countdown` preserved.

#### 5. Tests

**Files**: `src/app/_components/timer-panel.test.tsx` (if exists) or co-located smoke; belt e2e spot-check

**Intent**: Verify icon buttons retain aria-labels; no test asserts visible "Pause" text if migrated to icon-only.

**Contract**: Existing e2e using testids for pause/resume/end-session unaffected.

### Success Criteria:

#### Automated Verification:

- `pnpm check` passes
- `pnpm test` passes
- `set CI=true && pnpm test:e2e:belt` passes

#### Manual Verification:

- Pause/Interrupt/Focus/Add show clear icons; End session still labeled
- Timer card has subtle shadow and readable focus title hierarchy
- Icon buttons usable via keyboard focus ring

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- `task-fields-panel.test.tsx` — bordered title in create/edit modes (L-04)
- `task-list.test.tsx` — daily standing default, completed edit entry, no strikethrough classes
- `out-of-tab-break-alerts-control.test.tsx` — status label not always rendered
- `daily-recap-panel.test.tsx` — elevation/dismiss icon, Last 24h omit-when-empty, chevron toggles

### Integration Tests:

- Existing `task-mutation.test.ts` — no changes expected (UI-only standing default)
- Vitest suite: `pnpm test`

### E2E:

- Belt: `set CI=true && pnpm test:e2e:belt` — Focus/Add/Interrupt via role names must still resolve
- A11y: `set CI=true && pnpm test:e2e:a11y` — run after Phase 1 token change
- `@skip-belt` specs unchanged unless focus ring token alias affects class output

### Manual Testing Steps:

1. Toggle light/dark theme — verify cool stone palette coherence
2. Create task — Daily standing checked by default; bordered fields match edit
3. Mark task done-for-today — title readable, checkmark visible, no strikethrough
4. Complete task — click title to edit; revert still works
5. Start session — icon buttons on timer; break alerts checkbox minimal until error
6. Open daily recap — raised card elevation; X dismiss; no subtitle; Last 24h absent when empty; chevron toggles without underline hover

## Performance Considerations

Token and CSS changes have zero runtime cost. `TaskFieldsPanel` extraction should not introduce extra re-renders — keep panel pure, state in parent. lucide tree-shaking already used via named imports in persona picker pattern.

## Migration Notes

No database migration. Existing tasks retain stored `isDailyStanding` values; only new create form defaults to checked. Users with dismissed daily recap keys in sessionStorage unaffected.

## References

- Related research: `context/changes/ui-polish-fixes/research.md`
- Change log: `context/changes/ui-polish-fixes/change.md`
- Prior palette: `context/archive/2026-06-12-serene-pastel-rebrand/plan.md`
- Impeccable color rules: `.cursor/skills/impeccable/SKILL.md`
- L-04: `context/foundation/lessons.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Cool stone token recolor

#### Automated

- [x] 1.1 `pnpm check` passes — bdd58b3
- [x] 1.2 `pnpm typecheck` passes — bdd58b3
- [x] 1.3 `pnpm test` passes — bdd58b3
- [x] 1.4 `set CI=true && pnpm test:e2e:a11y` passes — bdd58b3

#### Manual

- [x] 1.5 Home shell gradient reads cool stone, not lavender-plum — bdd58b3
- [x] 1.6 Primary CTAs have adequate contrast on light background — bdd58b3
- [x] 1.7 Focus ring visible on selected task row — bdd58b3
- [x] 1.8 Dark theme toggle still coherent — bdd58b3

### Phase 2: Shared checkbox, daily standing default, break alerts simplify

#### Automated

- [x] 2.1 `pnpm check` passes — 66b4082
- [x] 2.2 `pnpm exec vitest run src/app/_components/out-of-tab-break-alerts-control.test.tsx` — 66b4082
- [x] 2.3 `pnpm exec vitest run src/app/_components/task-list.test.tsx` — 66b4082

#### Manual

- [x] 2.4 Daily standing checkbox visually matches break alerts checkbox — 66b4082
- [x] 2.5 New task form opens with Daily standing checked — 66b4082
- [x] 2.6 Break alerts area shows only checkbox when permission granted; error copy when denied — 66b4082

### Phase 3: Daily recap visual polish

#### Automated

- [x] 3.1 `pnpm exec vitest run src/app/_components/daily-recap-panel.test.tsx`
- [x] 3.2 `pnpm check` passes
- [x] 3.3 Empty-recap test: no `daily-recap-last24-toggle` or `daily-recap-last24` in DOM

#### Manual

- [x] 3.4 Panel uses raised card elevation (`bg-surface-card border-card-border shadow-sm`)
- [x] 3.5 Title only (no subtitle); dismiss is lucide X icon-only with `aria-label="Dismiss daily recap"`
- [x] 3.6 Last 24h section absent when empty; Today always visible with chevron toggle (no underline hover)
- [x] 3.7 Dismiss still hides panel for the local calendar day

### Phase 4: Task create/edit field unification

#### Automated

- [ ] 4.1 `pnpm check` passes
- [ ] 4.2 `pnpm exec vitest run src/app/_components/task-fields-panel.test.tsx`
- [ ] 4.3 `pnpm exec vitest run src/app/_components/task-list.test.tsx`
- [ ] 4.4 `pnpm test` passes

#### Manual

- [ ] 4.5 Edit on active task matches create form visual weight
- [ ] 4.6 Create task flow unchanged functionally
- [ ] 4.7 Persona presets appear only on create

### Phase 5: Completed task edit + done-state styling

#### Automated

- [ ] 5.1 `pnpm exec vitest run src/app/_components/task-list.test.tsx`
- [ ] 5.2 `pnpm test` passes
- [ ] 5.3 `pnpm check` passes

#### Manual

- [ ] 5.4 Click completed task title opens edit panel
- [ ] 5.5 Done-for-today and completed titles readable (no strikethrough)
- [ ] 5.6 Revert to active still works during idle cycle

### Phase 6: Session icons + timer card polish

#### Automated

- [ ] 6.1 `pnpm check` passes
- [ ] 6.2 `pnpm test` passes
- [ ] 6.3 `set CI=true && pnpm test:e2e:belt` passes

#### Manual

- [ ] 6.4 Pause/Interrupt/Focus/Add show clear icons; End session still labeled
- [ ] 6.5 Timer card has subtle shadow and readable focus title hierarchy
- [ ] 6.6 Icon buttons usable via keyboard focus ring
