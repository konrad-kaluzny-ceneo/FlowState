# Break restoration atmosphere (S-33) Implementation Plan

## Overview

Calm break atmosphere on home shell during breaks — not only the timer card.

## Phase 1: Atmosphere signal + shell wash

### Changes

- `src/lib/design/break-atmosphere.ts` — `shouldShowBreakAtmosphere`
- `src/hooks/use-sync-break-atmosphere.ts` — DOM sync to `#home-shell-main`
- `src/styles/globals.css` — break shell token overrides
- `src/app/_components/home-shell.tsx` — `id="home-shell-main"`, transition

### Automated

- [ ] 1.1 unit tests `break-atmosphere.test.ts`
- [ ] 1.2 `pnpm check`
- [ ] 1.3 `pnpm test`

## Phase 2: Dashboard + task chrome

### Changes

- `pomodoro-dashboard.tsx` — wire atmosphere hook; pass `chromeSubdued`
- `task-list.tsx` — subdued prop

### Automated

- [ ] 2.1 `pnpm test`
- [ ] 2.2 `pnpm check`

## Progress

### Phase 1

#### Automated

- [x] 1.1 `break-atmosphere.test.ts`
- [x] 1.2 `pnpm check`
- [x] 1.3 `pnpm test`

### Phase 2

#### Automated

- [x] 2.1 `pnpm test`
- [x] 2.2 `pnpm check`
