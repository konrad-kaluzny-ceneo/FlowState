# Post-merge wedge coach — Implementation Plan

## Phase 1: State + copy resolvers

- Extend onboarding state with `authenticatedWedgeCoachEligible`, `hasSeenAuthenticatedWedge`
- `post-merge-wedge-coach.ts` resolvers + tests
- Post-merge copy in `copy.ts`

### Automated

- [x] 1.1 storage + resolver tests
- [x] 1.2 `pnpm check` + `pnpm test`

## Phase 2: Wire merge + dashboard

- `guest-import-on-mount` sets eligible on successful import
- `use-onboarding-state` exposes resolvers; complete bridge on suggestion seen
- `AuthenticatedPomodoroDashboard` uses post-merge lines

### Automated

- [x] 2.1 `pnpm test` + `pnpm check`

## Progress

### Phase 1

#### Automated

- [x] 1.1 storage + resolver tests
- [x] 1.2 `pnpm check` + `pnpm test`

### Phase 2

#### Automated

- [x] 2.1 `pnpm test` + `pnpm check`
