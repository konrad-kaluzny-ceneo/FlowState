# Data-mode ACL hardening — Implementation Plan

## Overview

K2 child change: establish domain enum SSOT, Prisma persistence adapter, router wire mapping, consumer sweep, and Path C unified task reads. Aligns with `context/domain/03-anti-corruption-layer.md` §6.3.

## Current State Analysis

14 production files imported `@prisma/generated` outside `server/db`. `task.list` returned Prisma rows. No tests for `data-mode-context` wiring.

## Desired End State

1. `src/lib/domain/` owns `WorkType`, `EnergyLevel`, `CommitmentHorizon`, `CycleEndAudioMode` + Zod schemas
2. `src/lib/persistence/prisma/` sole `fromPrisma*` / `toPrisma*` + `mapTaskFromPrisma`
3. Routers `task`, `check-in`, `suggestion` use domain schemas at input; task outputs `DomainTask`
4. `rg "@prisma/generated" src` limited to `server/db` and `persistence/prisma`
5. Auth dashboard + hook share `useDomainTasks(mode)` for task list

## What We're NOT Doing

- Path A: CheckIn/Suggestion repositories in data-mode
- K3 guest merge consolidation
- SessionState / CycleKind ACL
- Hook decomposition (K1 — separate change)

## Phase 1: Data-mode characterization

### Changes

**File:** `src/lib/data-mode/data-mode-context.test.tsx` (new)

Pin guest vs auth repository wiring and `refreshGuest` no-op.

### Success Criteria

#### Automated

- [x] `pnpm exec vitest run src/lib/data-mode/data-mode-context.test.tsx` passes

---

## Phase 2: Domain + persistence mechanism

### Changes

**Files:** `src/lib/domain/*`, `src/lib/persistence/prisma/enum-mappers.ts`, `task-mapper.ts`, `client-types.ts`, `enum-mappers.test.ts`

Domain enums and Prisma mappers with unit tests. `CycleEndAudioMode` keeps lowercase client wire values.

### Success Criteria

#### Automated

- [x] `pnpm exec vitest run src/lib/persistence/prisma` passes
- [x] `pnpm check` passes

---

## Phase 3: Router enforcement + consumer sweep

### Changes

**Routers:** `task.ts`, `check-in.ts`, `suggestion.ts` — domain Zod, `mapTaskFromPrisma` on outputs  
**Consumers:** scoring, session, hooks, UI, `data-mode/types`, `cycle-audio-preference/types`, server libs → domain or persistence imports  
**Tests:** `preference.test.ts` — remove direct Prisma import

### Success Criteria

#### Automated

- [x] `rg "@prisma/generated" src` — only `server/db` + `persistence/prisma`
- [x] `pnpm test` passes (725 tests)

---

## Phase 4: Path C — unified task reads

### Changes

**Files:** `use-domain-tasks.ts`, `pomodoro-dashboard.tsx`, `server-repositories.ts`, `use-task-mutations.ts`

- `useDomainTasks(mode, { localDateKey, hasMounted })` for auth + guest
- Dashboard auth path uses `useDomainTasks` instead of direct `api.task.list`
- `normalizeUpdatePatch` for optimistic cache after `DomainTask` router output

### Success Criteria

#### Automated

- [x] `pnpm typecheck` passes
- [x] `pnpm exec vitest run src/lib/data-mode/data-mode-context.test.tsx` — no regression
- [x] `pnpm test` passes

#### Manual

- [ ] Auth task list consistent after create/update/reorder (smoke on PR deploy)

---

## Progress

- [x] Phase 1 — Char tests
- [x] Phase 2 — Domain + persistence mechanism
- [x] Phase 3 — Router enforcement + consumer sweep
- [x] Phase 4 — Path C unified reads
