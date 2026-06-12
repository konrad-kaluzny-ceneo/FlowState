# Serene Pastel Well-being Rebrand — Implementation Plan

## Overview

Pivot FlowState wedge surfaces from dark navy glass to **Serene Pastel Well-being** as the canonical **light-default** palette, ship a **calm dark** variant on `#1E2433`, wire a **user-menu theme toggle** (light / dark / system), migrate ~29 components off polarity-assuming inline utilities, consolidate orphan overlays into `overlay-shell`, and add an **axe-core accessibility gate** in CI. Visual-only — preserve all `data-testid` contracts and NFR 200ms motion timing.

## Current State Analysis

FlowState runs on the dark navy / glass-morphism system from F-04, S-12, and S-13. `@theme` in `src/styles/globals.css` defines 29 color tokens; wedge surfaces use them partially (~40% tokenized). ~142 `text-white` usages across 29 component files assume dark surfaces. Auth pages duplicate hardcoded `#1a1a2e`→`#16213e` gradients and blue/indigo CTAs. Three overlays bypass `overlay-shell` with duplicate hex/scrim patterns. No theme switching infrastructure exists. E2E breakage surface is small: two `@skip-belt` specs assert `ring-purple-500`; one unit test asserts `bg-purple-600`.

### Key Discoveries

- `src/styles/globals.css:3-37` — canonical `@theme` block; value swap propagates to Tailwind utilities when semantics map 1:1
- `DESIGN.md:98-102` — still documents dark-surface personality; full rewrite required
- `src/app/_components/overlay-shell.tsx:39` — scrim uses `bg-black/60`, not tokenized
- `src/app/_components/task-list.tsx:318-321` — focus ring + suggestion highlight (e2e contract)
- `src/app/auth/sign-in/page.tsx` — hardcoded auth shell; CTAs diverge from wedge `accent-cta`
- `src/lib/design/work-type-config.ts` — fully tokenized work-type badges; needs light + dark palette values
- Research gap filled: `task-suggestion-card.tsx` (12× `text-white`), `guest-banner.tsx` (2×) were not in original inventory
- Motion keyframes (`overlay-enter`, `task-complete-delight`) are palette-agnostic — carry forward unchanged

## Desired End State

- `DESIGN.md` documents Serene Pastel light-default + calm dark palettes, softened typography, scrim/card elevation on light surfaces, and updated e2e contract (`ring-focus` semantic utility)
- `globals.css` `@theme` holds light-default token values; `[data-theme="dark"]` on `<html>` overrides the same semantic tokens for calm dark
- User selects **Light**, **Dark**, or **System** from the header user menu; choice persists in `localStorage`; no FOUC on reload
- Home shell, task list, auth pages, wedge overlays, timer chrome, and orphan overlays render correctly in both themes with WCAG AA contrast on primary text and CTAs
- `@axe-core/playwright` scans wedge surfaces in CI with zero critical violations
- Belt e2e (`pnpm test:e2e:belt`) and unit tests pass; `@skip-belt` specs updated for `ring-focus`

### Verification

1. Toggle light ↔ dark ↔ system in user menu — all wedge surfaces flip without reload artifacts
2. Active/completed task hierarchy readable at a glance in both themes
3. Selected task row shows semantic focus ring (visible, not purple-specific)
4. `pnpm check`, `pnpm test`, `set CI=true && pnpm test:e2e:belt`, and axe e2e spec pass

## What We're NOT Doing

- Calm Garden illustrations (S-28)
- P-103 wedge garden craft
- Focus-shell dimming during WORK
- Copy/voice module changes
- Playwright visual regression screenshot baselines
- Non-wedge surfaces outside home, auth, overlays, timer chrome (e.g. admin, settings pages if added later)
- shadcn/Radix adoption or `cn()` helper introduction

## Implementation Approach

**CSS-variable theme swap over dual class sets.** Light-default values live in `@theme`; calm dark overrides the same `--color-*` custom properties under `[data-theme="dark"]`. Components keep semantic utilities (`bg-shell-top`, `text-primary`, `bg-scrim`) — no per-component `dark:` prefixes except where unavoidable (e.g. focus ring offset on auth inputs).

**Sequence:** spec + tokens first (establishes the contract), theme infrastructure second (toggle works early for manual QA), home/task/auth third (largest polarity flip), overlays fourth (shared primitive benefits from tokens already live), timer chrome fifth (segmented controls depend on new chip tokens), tests + axe last (validates the finished system).

**Impeccable `/impeccable shape`** runs in Phase 1 before `DESIGN.md` rewrite — ports Linear FLO-62 palette into a structured brief, defines calm dark desaturated accent values, and validates light-scene + dark-scene contrast intent.

## Critical Implementation Details

**Theme FOUC prevention:** Inject a blocking inline script in `layout.tsx` `<head>` (before body paint) that reads `localStorage` theme preference, resolves `system` via `matchMedia('(prefers-color-scheme: dark)')`, and sets `document.documentElement.dataset.theme` synchronously. Without this, light flash on dark preference (and vice versa) will occur on every hard reload.

**CTA text on light surfaces:** Muted plum-lavender CTA (`#5E5290`) requires `--color-on-cta: #FFFFFF` (or equivalent) as an explicit token — do not assume `text-primary` (dark ink) on filled buttons.

**Auth pages for logged-out users:** Theme toggle lives in `UserMenu`, which only renders when authenticated. Logged-out auth pages must still respect `data-theme` from the blocking script and system preference — no toggle needed on auth in F-06, but both themes must render correctly.

## Phase 1: Spec + dual-theme foundation

### Overview

Run Impeccable shape, rewrite `DESIGN.md` for Serene Pastel light-default + calm dark, remap `@theme` token values, add missing semantic tokens, and define work-type/energy badge palettes for both themes.

### Changes Required

#### 1. Impeccable shape brief

**File:** `context/changes/serene-pastel-rebrand/design-brief.md` (new)

**Intent:** Capture the Serene Pastel scene sentence, light + calm dark anchor references, color strategy (Restrained/Committed), and contrast targets before editing canonical spec. Port committed Linear FLO-62 hex values; derive calm dark desaturated accent values against `#1E2433` shell.

**Contract:** Brief must document both theme sets: shell gradient, surfaces, scrim, text hierarchy, accents, energy identity, work-type badges, segmented control chips, focus ring, and typography weight changes (`font-bold` → `font-semibold` on wedge headings).

#### 2. DESIGN.md rewrite

**File:** `DESIGN.md`

**Intent:** Replace dark navy glass spec with Serene Pastel Well-being as canonical light-default; add calm dark section; update elevation (soft shadow + `#E5E0EB` card border replaces glass opacity); document theme toggle behavior; update e2e contract from `ring-purple-500` to semantic `ring-focus`.

**Contract:** Frontmatter `colors:` block, Overview, Colors (shell, surfaces, text, accents, energy, work-type, task hierarchy), Typography, Elevation, Components (overlay primitive, segmented control, CTA variants), Motion spec (unchanged), E2E contract preservation (updated focus ring utility), Do's and Don'ts.

#### 3. globals.css @theme + dark overrides

**File:** `src/styles/globals.css`

**Intent:** Set light-default Serene Pastel values in `@theme`; add `[data-theme="dark"]` block overriding the same `--color-*` variables for calm dark; add missing tokens.

**Contract:** New tokens: `--color-text-primary`, `--color-scrim`, `--color-focus-ring`, `--color-segment-active`, `--color-segment-inactive`, `--color-on-cta`, `--color-card-border`, `--color-card-shadow` (or equivalent elevation token). Light values from FLO-62: shell `#FAF8F5`→`#F0EBF8`, cards `#FFFFFF` / border `#E5E0EB`, scrim `rgba(248,246,243,0.72)`, CTA `#5E5290`, break `#3D8F82`, success `#3A8F65`. Dark shell `#1E2433` with desaturated pastel accents. Retokenize work-type and energy `--color-*` pairs for readable contrast on both `#FFFFFF` cards and `#1E2433` dark surfaces. Motion keyframes unchanged.

#### 4. Theme infrastructure modules

**Files:** `src/lib/design/theme.ts` (new), `src/app/_components/theme-provider.tsx` (new), `src/app/_components/theme-script.tsx` (new)

**Intent:** Centralize theme type (`light` | `dark` | `system`), localStorage key, resolution logic (system → matchMedia), and React context for client components. Blocking script component sets `data-theme` before paint.

**Contract:** `theme.ts` exports `ThemePreference`, `THEME_STORAGE_KEY`, `resolveTheme(preference): 'light' | 'dark'`. Provider listens to `prefers-color-scheme` changes when preference is `system`. Script is inline, synchronous, no external deps.

### Success Criteria

#### Automated Verification

- `pnpm check` passes
- `pnpm typecheck` passes
- All new `@theme` tokens generate expected Tailwind utilities (spot-check: `text-primary`, `bg-scrim`, `ring-focus` compile without error)

#### Manual Verification

- Temporarily set `data-theme="light"` and `data-theme="dark"` on `<html>` in devtools — CSS variable overrides visibly change shell gradient
- DESIGN.md frontmatter colors match `globals.css` values

---

## Phase 2: Theme toggle

### Overview

Add light / dark / system selector to the user menu and wire theme provider into root layout.

### Changes Required

#### 1. Theme provider in layout

**File:** `src/app/layout.tsx`

**Intent:** Wrap app in `ThemeProvider`; render `ThemeScript` in `<head>`; pass `data-theme` resolution to `<html>` element.

**Contract:** `<html lang="en" data-theme={resolved}>` receives server-safe default (`light` or from cookie if added later); client provider reconciles from localStorage on mount without flash (script already set correct value).

#### 2. User menu theme control

**File:** `src/app/_components/user-menu.tsx`

**Intent:** Add compact theme selector (three-way: Light / Dark / System) alongside sign-out; retokenize menu chrome for both themes.

**Contract:** Control uses semantic tokens (`text-primary`, `bg-surface-card`, `border-border-subtle`); changes call `setTheme(preference)` from context; `data-testid="theme-toggle"` on the control group for e2e if needed later. Accessible: `role="radiogroup"` or native `<select>` with visible labels.

#### 3. User menu unit smoke test

**File:** `src/app/_components/user-menu.test.tsx` (new)

**Intent:** Verify theme preference change updates context and persists to localStorage.

**Contract:** Mock `localStorage`; assert `setTheme('dark')` writes key and updates rendered state.

### Success Criteria

#### Automated Verification

- `pnpm exec vitest run src/app/_components/user-menu.test.tsx` passes
- `pnpm check` passes
- `pnpm test` passes

#### Manual Verification

- Authenticated session: toggle Light → Dark → System — `<html data-theme>` updates, no full-page reload required
- Hard reload preserves last selected theme
- System mode tracks OS preference change (toggle OS dark mode while app open)

---

## Phase 3: Home + task + auth remap

### Overview

Polarity flip: replace `text-white` / opacity variants with semantic text tokens; retokenize home shell, task list, suggestion card, guest banner, and all auth pages; soften wedge heading weights.

### Changes Required

#### 1. Home shell + guest surfaces

**Files:** `src/app/_components/home-shell.tsx`, `src/app/_components/guest-banner.tsx`, `src/app/_components/empty-active-tasks-guide.tsx`

**Intent:** Migrate inline white text and glass surfaces to semantic tokens; apply softened typography on wordmark/headings per DESIGN.md.

**Contract:** Shell gradient uses `from-shell-top to-shell-bottom`; wordmark uses `text-primary font-semibold` (was `text-white font-bold`); tagline uses `text-text-secondary`; guest banner retains amber warning semantic but sits on light card tokens.

#### 2. Task list + suggestion card

**Files:** `src/app/_components/task-list.tsx`, `src/app/_components/task-suggestion-card.tsx`, `src/app/_components/task-list.test.tsx`

**Intent:** Replace all `text-white*` with `text-primary` / `text-text-secondary` / `text-text-dimmed`; swap `ring-purple-500` for `ring-focus ring-2`; retokenize importance/ASAP inline badge colors to theme-aware tokens or new badge tokens; preserve `animate-task-complete` and all `data-testid` values; soften section headings to `font-semibold`.

**Contract:** Focus ring utility is `ring-2 ring-focus` (not `ring-purple-500`). Suggestion highlight remains `ring-accent-suggestion`. Active row: `bg-surface-card`; completed: `bg-surface-card-muted text-text-dimmed line-through`. Unit tests still assert `animate-task-complete`; do not assert purple classes.

#### 3. Auth pages + shared components

**Files:** `src/app/auth/sign-in/page.tsx`, `src/app/auth/sign-up/page.tsx`, `src/app/auth/forgot-password/page.tsx`, `src/app/auth/reset-password/page.tsx`, `src/app/auth/sign-in/sign-in-form.tsx`, `src/app/auth/sign-up/sign-up-form.tsx`, `src/app/auth/forgot-password/forgot-password-form.tsx`, `src/app/auth/reset-password/reset-password-form.tsx`, `src/app/auth/_components/google-sign-in-button.tsx`, `src/app/auth/_components/auth-divider.tsx`, `src/app/auth/_components/auth-value-narrative.tsx`

**Intent:** Replace hardcoded `#1a1a2e`→`#16213e` gradients with `from-shell-top to-shell-bottom`; replace glass cards with `bg-surface-card border-border-subtle`; unify all CTAs to `accent-cta` / `accent-cta-hover`; migrate focus rings to `ring-focus`; replace `text-white*` with semantic text tokens; fix `focus:ring-offset-*` to use shell-top token.

**Contract:** No remaining `#1a1a2e`, `#16213e`, `bg-blue-600`, or `bg-indigo-600` in auth tree. Sign-in and sign-up CTAs visually match home primary buttons in both themes.

### Success Criteria

#### Automated Verification

- `pnpm exec vitest run src/app/_components/task-list.test.tsx` passes
- `pnpm check` passes
- `pnpm test` passes

#### Manual Verification

- Home page in light theme: linen/lavender gradient, dark text, white task cards with soft border, readable active/completed split
- Home page in dark theme: `#1E2433` shell, desaturated accents, same hierarchy legibility
- Auth sign-in/sign-up in both themes: unified plum CTA, no blue/indigo remnants
- Selected task focus ring visible on light cards (not low-contrast)

---

## Phase 4: Overlays + orphan consolidation

### Overview

Tokenize overlay scrim; migrate overlay consumers and three orphan overlays to `overlay-shell` primitives; retokenize `overlayButtonClass` for both themes.

### Changes Required

#### 1. Overlay shell primitives

**Files:** `src/app/_components/overlay-shell.tsx`, `src/app/_components/overlay-shell.test.tsx`

**Intent:** Replace `bg-black/60` scrim with `bg-scrim`; replace inline `text-white` in button classes with `text-on-cta` / `text-primary` as appropriate; remove hardcoded hover colors (`hover:bg-green-500`, `hover:bg-teal-500`) in favor of tokenized hover variants; update suggestion variant ring to token.

**Contract:** `OverlayScrim` uses `bg-scrim`. `overlayButtonClass` primary/secondary/success/break variants use semantic tokens only. Existing tests assert structure/classes by token name (`.bg-surface-break`), not legacy purple/green hex.

#### 2. Wedge overlay consumers

**Files:** `src/app/_components/cycle-complete-overlay.tsx`, `src/app/_components/check-in-overlay.tsx`, `src/app/_components/kickoff-readiness-overlay.tsx`, `src/app/_components/mid-cycle-completion-prompt.tsx`, `src/app/_components/wind-down-overlay.tsx`, `src/app/_components/energy-selector.tsx`

**Intent:** Replace remaining `text-white*` inline copy colors with semantic text tokens; retokenize inline teal/purple/red accent copy to theme-aware accent tokens; ensure energy selector tints use updated energy tokens from Phase 1.

**Contract:** All overlays preserve existing `data-testid` values. No `text-white` remaining in overlay consumer files.

#### 3. Orphan overlay migration

**Files:** `src/app/_components/first-run-overlay.tsx`, `src/app/_components/merge-success-overlay.tsx`, `src/app/_components/tab-return-catchup.tsx`

**Intent:** Refactor to compose `OverlayScrim` + `OverlayCard` + `overlayButtonClass` instead of duplicate scrim/card/button markup; eliminate hardcoded `#1a1a2e`, `bg-black/60`, `bg-purple-600`.

**Contract:** `first-run-overlay` retains `data-testid="first-run-overlay"` and `data-testid="first-run-dismiss-btn"`. `merge-success-overlay` and `tab-return-catchup` retain all existing testids. Zero duplicate overlay styling patterns remain.

#### 4. Overlay consumer smoke tests

**Files:** co-located `*.test.tsx` beside refactored overlays (extend existing where present)

**Intent:** Verify orphan migrations render `OverlayScrim` / token classes without regressing testid contracts.

**Contract:** At minimum: `first-run-overlay.test.tsx` asserts scrim uses `bg-scrim` and dismiss button uses `overlayButtonClass.primaryFull`.

### Success Criteria

#### Automated Verification

- `pnpm exec vitest run src/app/_components/overlay-shell.test.tsx` passes
- Orphan overlay smoke tests pass
- `pnpm check` passes
- `pnpm test` passes

#### Manual Verification

- Trigger first-run overlay, check-in, cycle-complete in light + dark — scrim is mist (light) / subdued (dark), cards readable, CTAs contrast-safe
- Orphan overlays (first-run, merge-success, tab-return) visually match wedge overlay family

---

## Phase 5: Timer + segmented chrome

### Overview

Tokenize remaining hardcoded wedge components: timer panel, duration picker, kickoff chips, audio preference, pomodoro dashboard, and related controls.

### Changes Required

#### 1. Segmented controls

**Files:** `src/app/_components/duration-picker.tsx`, `src/app/_components/kickoff-duration-chips.tsx`, `src/app/_components/cycle-audio-preference-control.tsx`, `src/app/_components/duration-picker.test.tsx`

**Intent:** Replace `bg-purple-600` active chip with `bg-segment-active text-on-cta` (or `bg-accent-cta` per DESIGN.md segmented spec); inactive chip uses `bg-segment-inactive text-text-secondary`; migrate `text-white*` to semantic tokens.

**Contract:** Active chip no longer uses `bg-purple-600`. Unit test asserts `aria-pressed="true"` on selected chip instead of color class.

#### 2. Timer + dashboard chrome

**Files:** `src/app/_components/timer-panel.tsx`, `src/app/_components/pomodoro-dashboard.tsx`, `src/app/_components/user-menu.tsx` (if not fully done in Phase 2)

**Intent:** Retokenize timer display, interrupt/destructive buttons, and dashboard inline purple/teal washes to semantic tokens; soften timer heading weight if `font-bold`.

**Contract:** No `text-white`, `bg-purple-600`, or hardcoded `#1a1a2e` in timer-panel or pomodoro-dashboard. Timer monospace display uses `text-primary`.

### Success Criteria

#### Automated Verification

- `pnpm exec vitest run src/app/_components/duration-picker.test.tsx` passes
- `pnpm check` passes
- `pnpm test` passes

#### Manual Verification

- Duration picker and audio preference chips readable in both themes; active chip clearly distinguished from inactive
- Timer panel hero treatment intact — timer remains visual focal point on home wedge
- Interrupt button (destructive red) still visually distinct from primary CTA in both themes

---

## Phase 6: Test contracts + axe CI

### Overview

Update e2e and unit tests for semantic focus ring; add `@axe-core/playwright` accessibility scans on wedge surfaces; run full verification belt.

### Changes Required

#### 1. E2E focus ring migration

**Files:** `e2e/task-suggestion.spec.ts`, `e2e/session-kickoff.spec.ts`

**Intent:** Replace `/ring-purple-500/` assertions with `/ring-focus/` (or equivalent semantic class emitted by `@theme`).

**Contract:** Assertions target the new utility; tests remain `@skip-belt` unless promoted later. No change to test flow or testids.

#### 2. Axe accessibility spec

**Files:** `e2e/accessibility.spec.ts` (new), `package.json`, `.github/workflows/ci.yml`

**Intent:** Add `@axe-core/playwright` dev dependency; create e2e spec scanning home (authenticated), task list focus state, and one overlay surface in light theme (default belt run).

**Contract:** Spec tagged `@skip-belt` initially if flaky on auth setup, OR included in belt if auth fixture covers it reliably. Scans use `AxeBuilder({ page }).include('[data-testid="home-shell"]')` (or equivalent wedge root). Fails CI on `violations` with `impact` of `critical` or `serious`. Add `pnpm test:e2e:a11y` script mirroring belt env vars.

#### 3. CI wiring

**File:** `.github/workflows/ci.yml`

**Intent:** Run axe spec in e2e job after belt (or as part of belt if promoted).

**Contract:** New step: `pnpm test:e2e:a11y` with same secrets/env as existing e2e job. Document in `e2e/README.md`.

#### 4. DESIGN.md e2e contract finalization

**File:** `DESIGN.md`

**Intent:** Remove legacy `ring-purple-500` preservation note; document `ring-focus` as canonical e2e contract.

**Contract:** E2E contract preservation section references `ring-focus` utility and lists affected spec files.

### Success Criteria

#### Automated Verification

- `pnpm check` passes
- `pnpm typecheck` passes
- `pnpm test` passes
- `set CI=true && pnpm test:e2e:belt` passes
- `set CI=true && pnpm test:e2e:a11y` passes (zero critical/serious axe violations)
- `pnpm exec vitest run src/app/_components/duration-picker.test.tsx` passes with aria-pressed assertion

#### Manual Verification

- Run `@skip-belt` e2e specs locally — focus ring assertions pass
- Spot-check axe report output — no false-positive noise from third-party embeds (auth iframe excluded if needed)

---

## Testing Strategy

### Unit Tests

- `user-menu.test.tsx` — theme preference persistence
- `task-list.test.tsx` — completion animation (unchanged behavior)
- `overlay-shell.test.tsx` — token class names on variants
- `duration-picker.test.tsx` — `aria-pressed` on active chip (not color class)
- Orphan overlay smoke tests — scrim/card primitive usage

### Integration / E2E

- Belt specs — unchanged testid/copy assertions (must still pass)
- `@skip-belt` task-suggestion + session-kickoff — updated `ring-focus` assertion
- `accessibility.spec.ts` — axe scans on wedge surfaces

### Manual Testing Steps

1. Light theme: home → start cycle → complete overlay → mark task done — full wedge flow
2. Dark theme: repeat flow; verify contrast on cards, overlays, timer
3. System theme: change OS preference — app follows without reload
4. Auth pages (logged out): sign-in page renders correctly in both themes via script/system
5. Guest banner + empty state guide readable on light shell
6. Reduced motion: overlay enter + task complete still respect `prefers-reduced-motion`

## Performance Considerations

Visual-only refactor — no API or data model changes. Theme script is ~15 lines inline — negligible parse cost. CSS variable overrides avoid duplicate stylesheets. axe scan adds ~10–20s to CI e2e job — acceptable for foundation slice.

## Migration Notes

No database migration. Existing users see light-default on first visit (or system-resolved theme). No breaking API changes. If a preview deploy goes out mid-phase, incomplete token migration may look mixed — ship phases 1–3 together minimum before preview promotion, or feature-flag behind branch deploy only.

## References

- Research: `context/changes/serene-pastel-rebrand/research.md`
- Linear FLO-62 / GitHub #97 — committed Serene Pastel palette
- Prior token migration: `context/archive/2026-06-11-focus-home-visual-craft/plan.md`
- Prior overlay primitive: `context/archive/2026-06-11-wedge-overlay-visual-polish/plan.md`
- Canonical runtime tokens: `src/styles/globals.css`
- Overlay primitive: `src/app/_components/overlay-shell.tsx`
- Work-type config: `src/lib/design/work-type-config.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Spec + dual-theme foundation

#### Automated

- [x] 1.1 `pnpm check` passes — bcaba46
- [x] 1.2 `pnpm typecheck` passes — bcaba46
- [x] 1.3 New `@theme` tokens compile (text-primary, bg-scrim, ring-focus) — bcaba46

#### Manual

- [x] 1.4 CSS variable overrides visibly change shell gradient when toggling `data-theme` in devtools — bcaba46
- [x] 1.5 DESIGN.md frontmatter colors match globals.css values — bcaba46

### Phase 2: Theme toggle

#### Automated

- [x] 2.1 `pnpm exec vitest run src/app/_components/user-menu.test.tsx` passes — e153c76
- [x] 2.2 `pnpm check` passes — e153c76
- [x] 2.3 `pnpm test` passes — e153c76

#### Manual

- [x] 2.4 Toggle Light → Dark → System updates `<html data-theme>` without full reload — e153c76
- [x] 2.5 Hard reload preserves last selected theme — e153c76
- [x] 2.6 System mode tracks OS preference change — e153c76

### Phase 3: Home + task + auth remap

#### Automated

- [x] 3.1 `pnpm exec vitest run src/app/_components/task-list.test.tsx` passes — 5686f21
- [x] 3.2 `pnpm check` passes — 5686f21
- [x] 3.3 `pnpm test` passes — 5686f21

#### Manual

- [x] 3.4 Home page readable in light and dark themes with correct hierarchy — 5686f21
- [x] 3.5 Auth pages unified plum CTA in both themes — 5686f21
- [x] 3.6 Selected task focus ring visible on light cards — 5686f21

### Phase 4: Overlays + orphan consolidation

#### Automated

- [x] 4.1 `pnpm exec vitest run src/app/_components/overlay-shell.test.tsx` passes — a8b6dc3
- [x] 4.2 Orphan overlay smoke tests pass — a8b6dc3
- [x] 4.3 `pnpm check` passes — a8b6dc3
- [x] 4.4 `pnpm test` passes — a8b6dc3

#### Manual

- [x] 4.5 Overlays readable in light and dark themes — a8b6dc3
- [x] 4.6 Orphan overlays match wedge overlay family — a8b6dc3

### Phase 5: Timer + segmented chrome

#### Automated

- [x] 5.1 `pnpm exec vitest run src/app/_components/duration-picker.test.tsx` passes — bcc3574
- [x] 5.2 `pnpm check` passes — bcc3574
- [x] 5.3 `pnpm test` passes — bcc3574

#### Manual

- [x] 5.4 Segmented controls readable in both themes — bcc3574
- [x] 5.5 Timer panel focal treatment intact in both themes — bcc3574

### Phase 6: Test contracts + axe CI

#### Automated

- [x] 6.1 `pnpm check` passes
- [x] 6.2 `pnpm typecheck` passes
- [x] 6.3 `pnpm test` passes
- [x] 6.4 `set CI=true && pnpm test:e2e:belt` passes
- [x] 6.5 `set CI=true && pnpm test:e2e:a11y` passes
- [x] 6.6 Duration picker unit test uses aria-pressed assertion

#### Manual

- [x] 6.7 `@skip-belt` e2e focus ring specs pass locally
- [x] 6.8 Axe report free of critical/serious wedge violations
