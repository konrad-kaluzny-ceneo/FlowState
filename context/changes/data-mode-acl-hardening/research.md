# Research — data-mode ACL hardening (K2)

## Goal

Isolate `@prisma/generated` behind `src/lib/persistence/prisma/`; establish `src/lib/domain/` as SSOT for `WorkType`, `EnergyLevel`, `CommitmentHorizon`, `CycleEndAudioMode`; return `DomainTask` from task router; unify auth task reads via Path C `useDomainTasks(mode)`.

## Findings

### Prisma leak surface (pre-change)

14 production files imported `@prisma/generated` outside `server/db`: routers (`task`, `check-in`, `suggestion`), `data-mode/types`, scoring, session narrative, hooks, UI chips, server libs (`active-session`, `import-guest-snapshot`, `increment-used-focus-minutes`), `cycle-audio-preference/types`, `server-repositories`.

`task.list` returned raw Prisma rows; dashboard and hook cast at call sites. `CycleEndAudioMode` already had correct ACL pattern in `preference.ts` — not generalized.

### Existing patterns to extend

| Pattern | Location | Reuse |
|---------|----------|-------|
| Audio enum ACL | `cycle-audio-preference/types.ts` + `preference.ts` mappers | Template for domain enums |
| Domain task type | `data-mode/types.ts` `DomainTask` | Router output target |
| Guest repos | `data-mode-context.tsx` | Char tests pin wiring |
| Optimistic task cache | `use-task-mutations.ts` | Must accept `DomainTask` from `task.list` |

### Mechanism vs enforcement split

1. **Mechanism:** `src/lib/domain/*`, `src/lib/persistence/prisma/enum-mappers.ts`, `task-mapper.ts`, `client-types.ts` + unit tests — no consumer edits required for green CI on mapper layer alone.
2. **Enforcement:** Router Zod uses domain schemas; `mapTaskFromPrisma` on wire; consumer sweep removes direct Prisma imports; Path C wires dashboard to `useDomainTasks`.
3. **Char (Phase 5):** `data-mode-context.test.tsx` — guest vs auth repo shapes, `refreshGuest` no-op.

### Risks

| Risk | Mitigation |
|------|------------|
| Optimistic cache type drift (`weight` 1\|2\|3 vs `number`) | `normalizeUpdatePatch` in `use-task-mutations.ts` |
| tRPC output type change breaks repos | `server-repositories.ts` `normalizeDomainTask` |
| Guest path regression | Char tests + existing guest localStorage path unchanged |
| E2E task CRUD belt | No UX change; belt re-run on PR |

### Verification commands

```powershell
rg "@prisma/generated" src
# Expected: server/db + persistence/prisma only

pnpm exec vitest run src/lib/persistence/prisma
pnpm exec vitest run src/lib/data-mode/data-mode-context.test.tsx
pnpm test
pnpm check
```

## Confidence

**88%** pre-implementation — patterns proven by `CycleEndAudioMode`; main unknown was optimistic mutation typing after `DomainTask` router output.
