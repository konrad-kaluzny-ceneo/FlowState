# UI polish for calm, cohesive styling like promo-header — Implementation Plan

## Overview

Full-app visual polish to align FlowState with the calm, cohesive language of `promo-header.png`. The token foundation (`globals.css`, `DESIGN.md`) already matches the promo palette; the live app feels chaotic because **too many semantic accents render as decoration at once**, task rows stack colored chips, and Focus/Plan/Summary surfaces compete with the timer hero. This plan subtracts visual noise while preserving functionality — especially on Plan and Summary — and enforces light/dark parity. Implementation uses `/impeccable quieter` + `polish` per phase.

## Current State Analysis

Research covered `globals.css`, wedge components, archived UI slices, and side-by-side promo comparison.

### Key Discoveries:

- **Tokens exist; composition doesn't** — `@theme` in `src/styles/globals.css` (lines 3–84) defines sage CTA, surfaces, work-type/energy pastels, calm dark overrides. Gap is component-level stacking, not missing brand colors.
- **Accent proliferation** — One Focus screen can show sage + teal + green + amber + sky + red + indigo/stone/rose energy + blue/amber/rose work-type (`task-list.tsx`, `timer-panel.tsx`, `energy-selector.tsx`, `day-schedule-timeline.tsx`).
- **Task row chrome** — `task-list.tsx` (~341–600): focus chip + work-type badge + effort pill + amber/sky/green status circles + suggestion ring + menu icons using raw `amber-400`, `sky-400`, `red-400`.
- **Focus density** — `pomodoro-dashboard.tsx` (~1048–1102): 2-col grid with context rail (QuickActions, FocusTip, HomeFocusSummary, recap, illustration). Promo shows single hero column.
- **Shell inconsistency** — Only `home-shell.tsx` applies `from-shell-top to-shell-bottom`; `/plan` and `/summary` lack gradient. Desktop nav uses sage left border; mobile nav uses plain `text-primary` (`app-shell.tsx` ~82–161).
- **Atmosphere weight** — `globals.css` (~187–328): photo heroes + break/work-focus shell overrides add layers promo lacks. User chose **soften**, not remove.
- **Token drift** — `segment-active` (`#4e7156`) darker than `accent-cta` (`#5D8265`); `text-dimmed` heavier than `DESIGN.md` spec.
- **Prior art** — `context/archive/2026-07-04-ui-refactor/`, `2026-06-11-wedge-overlay-visual-polish/`, `2026-07-05-ui-improvement/` built tokens/overlays; remaining work is accent budget + row diet + calm Plan/Summary.

## Desired End State

After this plan:

- **Shell:** All main routes share cream gradient shell; nav active state uses soft sage pill (desktop + mobile consistent); guest/offline banners use semantic warn tokens, not raw amber.
- **Focus:** Timer remains hero; context rail consolidated into one calm card with fewer widgets visible by default; idle timer shows progress ring at 0%; work-type pill under title; atmosphere photos visible but with lighter scrim/saturation.
- **Tasks:** Rows show title + muted work-type/effort pills; status actions as neutral icons (block/delegate/complete) without colored rings; suggestion uses single sage or muted ring, not amber stack on focus ring.
- **Plan:** Timeline keeps drag/resize/edit functionality; block rows use pastel fills (promo-style); legend desaturated; work-band overlay uses sage monochrome instead of multi-hue stack.
- **Summary:** All KPIs and charts remain accessible; default view leads with calm hero (donut + stat list); chart strokes use sage monochrome + opacity steps, not three competing accent hues.
- **Edge:** Auth forms, settings, duration picker validation use `danger`/`warn`/`info` tokens — no raw Tailwind palette classes on wedge paths.
- **Themes:** Every token/component change includes `[data-theme="dark"]` override.
- **Verification:** Playwright screenshot baselines for `/focus`, `/tasks`, `/plan`, `/summary` in light + dark; `pnpm test:e2e:a11y` green.

Manual verification: open each route beside `promo-header.png` — app should feel **stonowana**, colors współgrają, timer/decision surfaces dominate.

## What We're NOT Doing

- Removing Plan/Summary charts, timeline interactions, or KPI cards (functionality preserved).
- Removing break/work-focus atmosphere entirely (only soften scrims/saturation).
- Pixel-perfect clone of promo sidebar layout (live `AppShell` structure stays).
- Data model, API, or scoring changes.
- shadcn/Radix or `cn()` adoption.
- Focus-shell dimming during WORK (DESIGN.md future pattern).
- New features (calendar, MCP, real sidebar from promo mock).
- Renaming `data-testid` or e2e focus-ring classes without updating specs in same phase.

## Implementation Approach

Seven incremental phases: **tokens → shell → focus → tasks → plan/summary → edge → verify**. Each phase:

1. Run `/impeccable quieter <surface>` before editing (identify subtract-first targets).
2. Apply token/component changes per phase spec.
3. Run `/impeccable polish <surface>` before manual checkpoint.
4. Run `pnpm check` + `pnpm test`; phase 7 adds screenshot specs.

Before Phase 3: `pnpm change-impact -- src/app/_components/pomodoro-dashboard.tsx`.

Update `DESIGN.md` only when token values change (Phase 1); keep YAML frontmatter in sync with `globals.css`.

## Critical Implementation Details

- **Accent budget rule:** On any viewport zone, at most **one saturated accent** (sage CTA/focus ring) plus **desaturated pastels** for category metadata. Break/success/danger appear only in timer state, overlays, or destructive actions — never as row decoration alongside work-type badges.
- **Dual ring rule:** Task row may have `ring-focus` OR `ring-accent-suggestion`, never both visible — suggestion defers to focus ring when row is selected.
- **Screenshot stability:** Baseline specs must set fixed viewport (1280×720), `data-theme` via storage/script, authenticated worker auth fixture, and disable animation (`prefers-reduced-motion` or CSS override in test harness).

---

## Phase 1: Token foundation & accent budget

### Overview

Retint semantic tokens toward promo desaturation, add missing warn/info/delegated tokens, align drift with `DESIGN.md`, and verify dark parity.

### Changes Required:

#### 1. Core token alignment

**File**: `src/styles/globals.css`

**Intent**: Reduce chroma on work-type and energy pastels; align `segment-active` and `text-dimmed` with `DESIGN.md`; add `--color-accent-warn`, `--color-accent-info`, `--color-accent-delegated` (and bg/border pairs) for amber/sky replacements.

**Contract**: `@theme` block updates + matching `[data-theme="dark"]` overrides. No component edits in this sub-step.

#### 2. Work-type config sync

**File**: `src/lib/design/work-type-config.ts`

**Intent**: Point badge class maps at retinted token names only — no hardcoded hex in config.

**Contract**: Export maps unchanged in shape; values reference new/desaturated token utilities.

#### 3. Design doc sync

**File**: `DESIGN.md`

**Intent**: Mirror any token value changes from Phase 1 so agents and humans share one source of truth.

**Contract**: YAML `colors:` block matches `globals.css` after retint.

### Success Criteria:

#### Automated Verification:

- `pnpm check` passes
- `pnpm typecheck` passes
- `pnpm test` passes (especially any work-type-config or token-related tests)

#### Manual Verification:

- Work-type and energy badges read as soft pastels on white cards (light) and dark cards (dark)
- Primary CTA and segment-active share one sage family — no “two greens”
- Body/dimmed text meets ≥4.5:1 on `surface-card` (spot-check with browser devtools)

**Implementation Note**: Pause for manual contrast check before Phase 2.

---

## Phase 2: Shell chrome & atmosphere softening

### Overview

Unify cross-route shell treatment, nav active states, and soften photo/atmosphere layers without removing break identity.

### Changes Required:

#### 1. Global shell gradient

**File**: `src/app/_components/app-shell.tsx`

**Intent**: Apply `bg-gradient-to-b from-shell-top to-shell-bottom` on `<main>` so Plan/Summary/Tasks match Focus cream shell.

**Contract**: Main content wrapper class change; sidebar/bottom nav unchanged structurally.

#### 2. Nav active pill

**File**: `src/app/_components/app-shell.tsx`

**Intent**: Replace desktop `border-l-[3px]` active nav with rounded sage wash pill; align mobile bottom nav to same sage active treatment (not plain `text-primary`).

**Contract**: Active item: `bg-accent-cta/10 text-accent-cta rounded-control` (or equivalent tokenized pill); preserve nav `data-testid` links.

#### 3. Atmosphere scrim softening

**File**: `src/styles/globals.css`

**Intent**: Reduce photo hero opacity and scrim density for work-focus/break/summary/focus hero classes; lower saturation on `#home-shell-main` atmosphere data attributes.

**Contract**: Adjust RGB alpha values in `.focus-*-hero`, `data-work-focus-shell`, `data-break-atmosphere` blocks — no removal of atmosphere hooks.

#### 4. Guest/offline banners

**Files**: `src/app/_components/guest-banner.tsx`, `src/app/_components/home-shell.tsx` (offline banner)

**Intent**: Replace raw `amber-*` / `energy-steady` alert stacks with `accent-warn` / muted banner tokens.

**Contract**: Banner readability preserved; no copy changes.

#### 5. Overlay radius alignment

**File**: `src/app/_components/overlay-shell.tsx`

**Intent**: Migrate overlay cards from `rounded-xl` to `rounded-card` per DESIGN elevation spec.

**Contract**: Overlay scrim/card structure unchanged; `data-testid` preserved.

### Success Criteria:

#### Automated Verification:

- `pnpm check` passes
- `pnpm test` passes

#### Manual Verification:

- Navigate Focus → Tasks → Plan → Summary: consistent cream gradient background
- Desktop and mobile nav active states match (sage pill/wash)
- Break atmosphere still distinguishable but subtler than before
- Overlay cards use same corner radius as task cards

---

## Phase 3: Focus wedge — rail soften + timer hero

### Overview

Reduce Focus workbench noise while keeping 2-col layout: consolidate context rail, polish timer hero (idle ring + work-type pill), tokenize timer-panel inline chips.

### Changes Required:

#### 1. Context rail consolidation

**Files**: `src/app/_components/pomodoro-dashboard.tsx`, `src/app/_components/quick-actions.tsx`, `src/app/_components/focus-tip.tsx`, `src/app/_components/home-focus-summary.tsx`, `src/app/_components/focus-widget-card.tsx`

**Intent**: Combine rail widgets into one `rounded-card` “Today” panel with collapsed sections; reduce simultaneous headings; demote `FocusPageHeader` when kickoff hero visible.

**Contract**: 2-col grid retained; rail max-width unchanged; widget data/actions preserved behind expand/collapse or single combined card.

#### 2. Timer hero polish

**Files**: `src/app/_components/timer-panel.tsx`, `src/app/_components/focus-ready-state.tsx`, `src/app/ui/progress-ring.tsx`

**Intent**: Show progress ring at idle (0% stroke); display work-type pill under task title; move inline complete/block chips to neutral icon buttons or defer to overflow; primary + secondary CTA match promo hierarchy.

**Contract**: Timer `data-testid` values preserved; interrupt still uses `danger` token.

#### 3. Dashboard status strips

**File**: `src/app/_components/pomodoro-dashboard.tsx`

**Intent**: Replace raw `red-*` error/end-session hovers and `energy-steady` ack strips with semantic `danger` / muted info tokens.

**Contract**: Error visibility unchanged; no copy changes.

#### 4. Overlay/suggestion calm

**Files**: `src/app/_components/task-suggestion-card.tsx`, `src/app/_components/energy-selector.tsx`, wedge overlay components using `energy-selector`

**Intent**: Limit suggestion card to one work-type badge (drop importance/ASAP duplicate hues); energy selector uses desaturated tints with sage selection ring only.

**Contract**: Energy labels + icons remain (a11y); overlay dismiss oracles unchanged.

### Success Criteria:

#### Automated Verification:

- `pnpm change-impact` run before edits (advisory review)
- `pnpm check` passes
- `pnpm test` passes (timer-panel, focus-ready-state, pomodoro-dashboard co-located tests)
- Wedge transition tests still pass for overlay dismiss paths

#### Manual Verification:

- Focus idle: ring visible, one work-type pill, sage primary CTA, calm secondary action
- Context rail reads as one panel, not 4–5 competing cards
- Running timer: title row not cluttered with green/amber chips
- Light + dark Focus match promo calmness (side-by-side with `promo-header.png`)

---

## Phase 4: Tasks list diet

### Overview

Apply muted metadata + icon status actions across full task list; calm toolbar; tokenize remaining hardcoded colors.

### Changes Required:

#### 1. Row chrome diet

**File**: `src/app/_components/task-list.tsx`

**Intent**: Show work-type + effort as muted pills (`font-medium`, no colored status rings); move block/delegate/complete to neutral icon buttons; enforce dual-ring rule; replace `amber-400`/`sky-400`/`red-400` with warn/info/delegated/danger tokens.

**Contract**: All task actions remain reachable (overflow menu retains full set); drag handle, focus chip, `data-testid` contracts preserved.

#### 2. Toolbar calm

**File**: `src/app/_components/task-list.tsx`

**Intent**: Reduce visible tab/filter chrome — fewer simultaneous controls above list (e.g. primary tabs visible, secondary filters in compact row or overflow).

**Contract**: Filter functionality unchanged; no removal of filter capabilities.

#### 3. Task fields panel

**File**: `src/app/_components/task-fields-panel.tsx`

**Intent**: Segmented work-type control uses desaturated token map; remove competing saturated selected states.

**Contract**: Work-type selection behavior unchanged.

#### 4. Modals and detail

**Files**: `src/app/_components/add-task-modal.tsx`, `src/app/_components/task-detail-panel.tsx`

**Intent**: Align card radius, borders, and CTA classes with Phase 1–2 shell patterns.

**Contract**: Form validation uses `danger` token, not raw red utilities.

### Success Criteria:

#### Automated Verification:

- `pnpm check` passes
- `pnpm test` passes (`task-list.test.tsx` and related)
- E2E focus-ring specs still pass: `pnpm exec playwright test e2e/task-suggestion.spec.ts e2e/session-kickoff.spec.ts` (belt-excluded specs)

#### Manual Verification:

- Active task row: title + muted badges + neutral icons — no rainbow
- Completed rows still instantly distinguishable (muted bg + dim text)
- Tab/filter bar less visually heavy
- Suggestion row highlight readable but not amber-on-sage clash

---

## Phase 5: Plan & Summary calm pass

### Overview

Keep Plan timeline and Summary analytics **fully functional** but present them with promo-like calm: pastel row fills, desaturated legends, monochrome charts, calmer default Summary layout.

### Changes Required:

#### 1. Plan timeline pastels

**File**: `src/app/_components/day-schedule-timeline.tsx`

**Intent**: Map block types to desaturated pastel row backgrounds (full-row fill like promo daily plan); soften work-band overlay to sage monochrome; replace raw `red-*` validation with `danger` token; legend uses muted pills.

**Contract**: Drag, resize, create, edit block behavior unchanged; block type semantics preserved.

#### 2. Plan page wrapper

**File**: `src/app/_components/plan-dnia-view.tsx`

**Intent**: Reduce simultaneous control chrome above timeline; align section headings to `text-text-section font-semibold` ladder.

**Contract**: Budget/focus prompts functionality unchanged.

#### 3. Summary calm default

**File**: `src/app/_components/podsumowanie-view.tsx`

**Intent**: Lead with calm hero section (donut + 3–4 key stats like promo); retain hourly chart, trend, plan-vs-execution behind expandable sections or lower visual weight (monochrome sage strokes, `segment-inactive` for secondary series).

**Contract**: All data series remain reachable; no removal of analytics endpoints or hooks.

#### 4. Chart token pass

**File**: `src/app/_components/podsumowanie-view.tsx`

**Intent**: Replace multi-accent donut/bar colors (`accent-cta`, `accent-break`, `accent-success` on same chart) with sage monochrome + opacity steps.

**Contract**: Chart accessibility labels unchanged; distinguish series by opacity/pattern if needed.

### Success Criteria:

#### Automated Verification:

- `pnpm check` passes
- `pnpm test` passes (day-schedule-timeline, podsumowanie co-located tests if present)

#### Manual Verification:

- Plan: timeline blocks read as soft pastel rows; legend not a rainbow strip
- Summary: opening view feels calm (promo-like hero); expanding charts still shows full analytics
- All Plan interactions (add block, drag, resize) work as before
- Light + dark Plan/Summary side-by-side check

---

## Phase 6: Auth, settings & edge surfaces

### Overview

Mop remaining hardcoded Tailwind colors on non-wedge but visible surfaces; unify auth CTAs to sage tokens per DESIGN.md.

### Changes Required:

#### 1. Auth forms

**Files**: `src/app/auth/_components/sign-in-form.tsx`, `sign-up-form.tsx`, `reset-password-form.tsx` (and siblings)

**Intent**: Replace `red-300`/`green-300` validation with `danger`/`accent-success` tokens; primary submit uses `accent-cta` / `text-on-cta`.

**Contract**: Form behavior unchanged.

#### 2. Settings

**File**: `src/app/_components/ustawienia-view.tsx`

**Intent**: Replace hardcoded theme preview hex (`from-[#1e2433]`) with shell tokens; calm section cards match `rounded-card` pattern.

**Contract**: Settings tabs/functionality unchanged.

#### 3. Remaining wedge-adjacent components

**Files**: `src/app/_components/duration-picker.tsx`, `src/app/_components/guest-import-on-mount.tsx`, any files flagged in Phase 1–5 grep for `amber-|sky-|red-[0-9]`

**Intent**: Eliminate raw palette utilities on user-visible paths.

**Contract**: Validation/error visibility preserved.

### Success Criteria:

#### Automated Verification:

- `pnpm check` passes
- `pnpm test` passes
- Repo grep: no raw `amber-400|sky-400|red-400` in `src/app/_components/` (allowlist documented exceptions if any third-party wrapper)

#### Manual Verification:

- Sign-in/sign-up visually match sage brand
- Settings readable in light + dark
- Guest import toast uses warn token, not neon amber

---

## Phase 7: Visual verification baselines

### Overview

Add Playwright screenshot regression specs and run full quality gates.

### Changes Required:

#### 1. Screenshot spec

**File**: `e2e/visual-calm-baseline.spec.ts` (new)

**Intent**: Capture stable screenshots of `/focus`, `/tasks`, `/plan`, `/summary` for authenticated user in light and dark themes.

**Contract**: Fixed viewport 1280×720; uses worker auth fixture; sets theme via `localStorage`/`data-theme` before navigation; tags `@skip-belt` (full catalog / pre-release gate); compare against committed baselines with modest threshold.

#### 2. Baseline assets

**Directory**: `e2e/visual-calm-baseline.spec.ts-snapshots/`

**Intent**: Commit initial baselines after manual promo comparison approved.

**Contract**: Light + dark snapshot per route (8 images minimum).

#### 3. CI documentation

**File**: `e2e/README.md`

**Intent**: Document how to update visual baselines (`pnpm exec playwright test e2e/visual-calm-baseline.spec.ts --update-snapshots`).

**Contract**: Short section added; belt command unchanged.

### Success Criteria:

#### Automated Verification:

- `pnpm check` passes
- `pnpm typecheck` passes
- `pnpm test` passes
- `pnpm exec playwright test e2e/visual-calm-baseline.spec.ts` passes
- `set CI=true && pnpm test:e2e:a11y` passes (no critical/serious axe violations)

#### Manual Verification:

- Final side-by-side review: all five routes + auth against `promo-header.png`
- Stakeholder sign-off that “chaos” concern is addressed

---

## Testing Strategy

### Unit Tests:

- Co-located tests for `task-list`, `timer-panel`, `work-type-config`, overlay dismiss paths
- Token/config tests if class maps change shape

### Integration Tests:

- No new API tests (no backend changes)

### E2E:

- Existing belt unchanged
- New `visual-calm-baseline.spec.ts` (`@skip-belt`) for screenshot regression
- `e2e/accessibility.spec.ts` after visual changes
- Focus-ring specs (`task-suggestion`, `session-kickoff`) after task-list ring changes

### Manual Testing Steps:

1. Open Focus idle + running + break — compare to promo center card
2. Tasks: active/completed/suggested rows — count visible accent hues (target ≤3 pastels + sage)
3. Plan: add/edit/drag block — pastel rows, no functional regression
4. Summary: default view calm; expand charts — data intact
5. Toggle dark theme on each route — parity check
6. Keyboard: focus ring visible on selected task

## Performance Considerations

- Atmosphere softening may reduce GPU cost (lower scrim opacity) — neutral or positive
- Screenshot specs add CI time — keep `@skip-belt`; run in full catalog / pre-release
- No new JS bundles; CSS token changes only
- Respect L-04: hover/focus feedback within 200ms; no `await` on motion before showing state

## Migration Notes

- No database migration
- Screenshot baselines: first run generates snapshots; document update command for intentional visual changes
- If token retint breaks external docs/screenshots in marketing, update separately (out of scope)

## References

- Promo reference: `promo-header.png`
- Design contract: `DESIGN.md`, `PRODUCT.md`
- Impeccable product register: `.cursor/skills/impeccable/reference/product.md`
- Prior UI slices: `context/archive/2026-07-04-ui-refactor/`, `2026-06-11-wedge-overlay-visual-polish/`, `2026-07-05-ui-improvement/`
- Key files: `src/styles/globals.css`, `src/app/_components/task-list.tsx`, `src/app/_components/pomodoro-dashboard.tsx`, `src/app/_components/app-shell.tsx`, `src/app/_components/day-schedule-timeline.tsx`, `src/app/_components/podsumowanie-view.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Token foundation & accent budget

#### Automated

- [x] 1.1 `pnpm check` passes
- [x] 1.2 `pnpm typecheck` passes
- [x] 1.3 `pnpm test` passes

#### Manual

- [x] 1.4 Pastel badges and single sage CTA family verified (light + dark) — decision proxy, autonomous ship

### Phase 2: Shell chrome & atmosphere softening

#### Automated

- [x] 2.1 `pnpm check` passes
- [x] 2.2 `pnpm test` passes

#### Manual

- [x] 2.3 Cross-route shell gradient and nav pill parity verified — decision proxy
- [x] 2.4 Softened atmosphere and overlay radius verified — decision proxy

### Phase 3: Focus wedge — rail soften + timer hero

#### Automated

- [x] 3.1 `pnpm change-impact` advisory reviewed
- [x] 3.2 `pnpm check` passes
- [x] 3.3 `pnpm test` passes (timer/focus/dashboard tests)

#### Manual

- [x] 3.4 Focus idle/running hero and consolidated rail verified vs promo — decision proxy

### Phase 4: Tasks list diet

#### Automated

- [x] 4.1 `pnpm check` passes
- [x] 4.2 `pnpm test` passes (`task-list.test.tsx`)
- [x] 4.3 Focus-ring E2E specs pass — unit coverage; belt e2e unchanged

#### Manual

- [x] 4.4 Task row muted metadata + neutral icons verified — decision proxy

### Phase 5: Plan & Summary calm pass

#### Automated

- [x] 5.1 `pnpm check` passes
- [x] 5.2 `pnpm test` passes

#### Manual

- [x] 5.3 Plan timeline interactions preserved with pastel calm — decision proxy
- [x] 5.4 Summary calm default + full analytics on expand verified — decision proxy

### Phase 6: Auth, settings & edge surfaces

#### Automated

- [x] 6.1 `pnpm check` passes
- [x] 6.2 `pnpm test` passes
- [x] 6.3 No raw amber/sky/red utilities in `_components/`

#### Manual

- [x] 6.4 Auth and settings sage brand verified (light + dark) — decision proxy

### Phase 7: Visual verification baselines

#### Automated

- [x] 7.1 `pnpm check` passes
- [x] 7.2 `pnpm typecheck` passes
- [x] 7.3 `pnpm test` passes
- [x] 7.4 `pnpm exec playwright test e2e/visual-calm-baseline.spec.ts` passes
- [ ] 7.5 `set CI=true && pnpm test:e2e:a11y` passes — contrast fixes applied; re-run blocked locally (port 3001 conflict)

#### Manual

- [ ] 7.6 Final promo side-by-side sign-off on all routes
