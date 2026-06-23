# Work focus shell (S-31) Implementation Plan

## Overview

Calm WORK-cycle focus surface on home — timer hero, non-essential task chrome recedes.

## Phase 1: Focus signal + shell wash

### Changes

- `src/lib/design/work-focus-shell.ts` — `shouldShowWorkFocusShell`
- `src/hooks/use-sync-work-focus-shell.ts` — DOM sync to `#home-shell-main`
- `src/styles/globals.css` — work focus shell token overrides

### Automated

- [ ] 1.1 unit tests `work-focus-shell.test.ts`
- [ ] 1.2 hook test `use-sync-work-focus-shell.test.ts`
- [ ] 1.3 `pnpm check`
- [ ] 1.4 `pnpm test`

## Phase 2: Dashboard + task chrome

### Changes

- `pomodoro-dashboard.tsx` — wire focus shell hook; pass `focusShellActive`
- `task-list.tsx` — section-scoped subdued chrome

### Automated

- [ ] 2.1 `pnpm test`
- [ ] 2.2 `pnpm check`

## Progress

### Phase 1

#### Automated

- [x] 1.1 `work-focus-shell.test.ts`
- [x] 1.2 `use-sync-work-focus-shell.test.ts`
- [x] 1.3 `pnpm check`
- [x] 1.4 `pnpm test`

### Phase 2

#### Automated

- [x] 2.1 `pnpm test`
- [x] 2.2 `pnpm check`
