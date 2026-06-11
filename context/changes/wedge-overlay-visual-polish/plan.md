# Wedge Overlay Visual Polish (S-12) Implementation Plan

## Overview

Apply `DESIGN.md` tokens and shared overlay primitive to wedge transition surfaces. Visual-only refactor — preserve gate logic and all `data-testid` contracts. Parallel with S-13 on separate worktree; do not edit home shell or task list.

## Desired End State

1. `globals.css` `@theme` exposes surface, accent, border, and energy identity tokens.
2. `overlay-shell.tsx` provides `OverlayScrim`, `OverlayCard`, and CTA class helpers.
3. All in-scope overlays use tokens + shared primitive; energy selector shows per-state tints.
4. `WORK_TYPE_CONFIG` lives in `src/lib/design/work-type-config.ts` (single source).
5. Overlay enter motion 200ms with reduced-motion fallback.
6. `pnpm check`, `pnpm test`, e2e belt green.

## What We're NOT Doing

- Home shell / task list craft (S-13)
- Auth page unification (S-13)
- First-run / merge-success overlay polish
- E2e selector renames
- Focus-shell dimming (parked in DESIGN.md)

## Progress

### Phase 1: Design tokens + overlay primitive
- [x] Add `@theme` tokens and overlay motion to `globals.css`
- [x] Create `overlay-shell.tsx` + smoke test
- [x] Extract `work-type-config.ts`

**Automated:** `pnpm exec vitest run src/app/_components/overlay-shell.test.ts`

### Phase 2: Migrate wedge overlays
- [x] Refactor cycle-complete, check-in, kickoff, wind-down, mid-cycle overlays
- [x] Refactor task-suggestion-card + energy-selector identity tints

**Automated:** `pnpm exec vitest run src/app/_components/{check-in-overlay,cycle-complete-overlay,task-suggestion-card,energy-selector,mid-cycle-completion-prompt,wind-down-overlay,kickoff-readiness-overlay}.test.ts`

### Phase 3: Verification + docs
- [x] Update change artifacts (research, plan, reviews)
- [x] `pnpm check`
- [x] `pnpm test`
- [x] `set CI=true && pnpm test:e2e:belt`

## Acceptance Criteria

| Criterion | PRD | Verification |
| --- | --- | --- |
| Calm cohesive wedge flow | FR-013, FR-020–FR-022 | Visual review + e2e belt |
| Suggestion feedback ≥1s visible | NFR | Existing loading timers unchanged |
| E2e contracts preserved | DESIGN.md | Belt specs pass without selector changes |
