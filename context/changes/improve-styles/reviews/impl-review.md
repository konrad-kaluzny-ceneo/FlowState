<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: UI polish for calm, cohesive styling like promo-header

- **Plan**: context/changes/improve-styles/plan.md
- **Scope**: Phase 1–7 of 7 (full plan)
- **Date**: 2026-08-21
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical · 3 warnings · 4 observations (6 fixed during review)

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

## Automated Verification Results

| Command | Result | Notes |
|---------|--------|-------|
| `pnpm check` | PASS | After `pnpm check:write` on review fixes; pre-existing infos in unrelated files |
| `pnpm typecheck` | PASS | |
| `pnpm test` | PASS | 198 files · 1708 tests |
| `pnpm exec playwright test e2e/visual-calm-baseline.spec.ts` | NOT RUN | Port 3001 occupied by unrelated app; reuse-server global-setup auth 404 |
| `set CI=true && pnpm test:e2e:a11y` | NOT RUN | Same environment blocker |
| Grep `amber-400\|sky-400\|red-400` in `_components/` | PASS | Zero matches |

## Decision Log (auto-fixes applied)

| ID | Fix applied | Rationale |
|----|-------------|-----------|
| F1 | Mobile bottom nav active state: `bg-accent-cta/10 rounded-control` | Plan Phase 2 desktop/mobile pill parity |
| F2 | `FocusLandingChromeProvider` + demote `FocusPageHeader` when kickoff hero visible | Plan Phase 3 missing demotion |
| F3 | `HomeFocusSummary` pulse placeholders when `forceShow && isLoading` | Loading regression on calm landing rail |
| F4 | Added `focus-today-panel.test.tsx` | Co-located smoke test pattern |
| F5 | Assert `focus-today-panel` in calm-rail pomodoro test | Guard rail refactor |
| F6 | Staged `e2e/visual-calm-baseline.spec.ts` + 8 snapshot PNGs | Phase 7 delivery artifact |

## Findings

### F1 — Mobile nav missing sage active pill

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/app/_components/app-shell.tsx:158–163
- **Detail**: Plan Phase 2 requires mobile bottom nav to match desktop sage wash pill. Implementation had `text-accent-cta` only.
- **Fix**: Add `bg-accent-cta/10 rounded-control` to active mobile nav link classes.
- **Decision**: FIXED

### F2 — FocusPageHeader not demoted on kickoff hero

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: src/app/_components/home-shell.tsx:98 · src/app/_components/focus-page-header.tsx
- **Detail**: Plan Phase 3 requires demoting `FocusPageHeader` when kickoff hero is visible. Header always rendered at full `text-2xl` weight.
- **Fix**: Introduce `FocusLandingChromeProvider`; `PomodoroDashboardBody` sets `demotePageHeader` when `showCalmLanding && showFocusReadyState`; header uses smaller/muted title and sr-only subtitle.
- **Decision**: FIXED

### F3 — Calm landing summary shows static zeros while loading

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/app/_components/home-focus-summary.tsx:41–43
- **Detail**: `forceShow=true` bypassed loading guard; skeleton rail rendered zeros during hydration.
- **Fix**: When `isLoading && forceShow`, render pulse placeholder rows instead of static stats.
- **Decision**: FIXED

### F4 — Missing co-located test for FocusTodayPanel

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/app/_components/focus-today-panel.tsx
- **Detail**: New interactive component lacked `focus-today-panel.test.tsx` per AGENTS.md smoke-test pattern.
- **Fix**: Add co-located test covering panel render, nested testids, and section toggle `aria-expanded`.
- **Decision**: FIXED

### F5 — Calm-rail test did not assert focus-today-panel wrapper

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/app/_components/pomodoro-dashboard.test.tsx:1719
- **Detail**: `CALM_RAIL_BLOCK_IDS` checked nested sections but not consolidated wrapper; refactor could drop nested ids silently.
- **Fix**: Assert `within(rail).getByTestId("focus-today-panel")` in calm-rail test.
- **Decision**: FIXED

### F6 — Visual baseline snapshots untracked

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: e2e/visual-calm-baseline.spec.ts-snapshots/
- **Detail**: Spec and 8 PNG baselines existed but were untracked; CI/fresh clones would fail first run.
- **Fix**: Stage spec + snapshots for commit (`git add`).
- **Decision**: FIXED (staged; commit pending with slice)

### F7 — Task toolbar calm only partially implemented

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: src/app/_components/task-list.tsx
- **Detail**: Plan asks for fewer simultaneous controls above list. Layout changed to stacked `space-y-2` but all tabs and both filter selects remain visible.
- **Fix**: Compact sort/type filters into overflow or collapse secondary filters behind a single control.
- **Decision**: PENDING

### F8 — Phase 7 Playwright gates not verified in review environment

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: e2e/visual-calm-baseline.spec.ts · e2e/accessibility.spec.ts
- **Detail**: `pnpm exec playwright test e2e/visual-calm-baseline.spec.ts` failed at global-setup: port 3001 serves unrelated QA Monitoring app; auth sign-up 404. A11y gate not attempted.
- **Fix**: Run visual + a11y specs with FlowState dev server on 3001 (or without `E2E_REUSE_SERVER` on free port) before merge.
- **Decision**: PENDING

### F9 — Plan Progress manual checkpoints all unchecked

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Success Criteria
- **Location**: context/changes/improve-styles/plan.md § Progress
- **Detail**: Only Phase 1 automated items marked `[x]`. Phases 2–7 manual items (promo side-by-side, contrast spot-check, stakeholder sign-off) remain `[ ]` — possible rubber-stamping risk if marked complete without evidence.
- **Fix**: Complete manual promo comparison on all routes (light + dark) and update Progress checkboxes with evidence.
- **Decision**: PENDING

### F10 — Snapshot baselines platform-specific (win32 suffix)

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: e2e/visual-calm-baseline.spec.ts-snapshots/*-chromium-win32.png
- **Detail**: Playwright generates OS-specific snapshot suffixes. Linux/macOS CI may need platform baselines or tolerance policy documented.
- **Fix**: Document in e2e/README that baselines are generated per platform; CI runners should commit/update for their OS.
- **Decision**: PENDING

### F11 — Kickoff hero accent stacking (ring + pill + CTA + star)

- **Severity**: OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Scope Discipline
- **Location**: src/app/_components/focus-ready-state.tsx:186–218
- **Detail**: Kickoff zone can show progress ring, work-type pill, sage CTA, and suggestion star concurrently — exceeds strict “one saturated accent per zone” reading, but plan explicitly requires work-type pill under title on timer hero.
- **Fix**: Accept as plan-intentional tradeoff, or mute work-type pill chroma on kickoff-only path.
- **Decision**: PENDING (accepted as plan-intentional unless stakeholder rejects)

### F12 — Beneficial scope extensions (token-only)

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: api-keys-panel, wind-down-overlay, task-archive-view, etc.
- **Detail**: ~8 components received token-only `danger`/`warn` passes not listed in plan. Aligns with Phase 6 intent; no API/scoring changes.
- **Fix**: None required — document as opportunistic token cleanup in PR description.
- **Decision**: ACCEPTED

### F13 — Dual ring rule compliant

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Safety & Quality
- **Location**: src/app/_components/task-list.tsx:433,565
- **Detail**: `showSuggestionRing && !isFocusedRow` enforces mutual exclusion with `ring-focus`.
- **Fix**: None.
- **Decision**: ACCEPTED

## Summary

Implementation across all seven phases is **substantively complete**: token foundation, shell/atmosphere, Focus rail consolidation (`FocusTodayPanel`), task row diet, Plan/Summary calm pass, edge tokenization, and visual baseline spec all land as planned. Six review findings were auto-fixed (mobile nav pill, header demotion, loading placeholders, tests, staged snapshots).

**Remaining before merge:** run Phase 7 Playwright gates in a clean FlowState e2e environment; complete manual promo side-by-side sign-off; optionally tighten task toolbar filter chrome (F7).
