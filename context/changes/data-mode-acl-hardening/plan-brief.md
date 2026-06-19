# Plan brief — data-mode ACL hardening

**Change:** `data-mode-acl-hardening` | **Branch:** `features/data-mode-acl-hardening`  
**Parent:** K2 from `refactor-opportunities` (Phase 5 char + Phase 5e/7 ACL + Path C)  
**Prerequisite:** F-07 (`wedge-transition-conductor`) merged ✓

## Intent

Harden anti-corruption layer: domain enums in `src/lib/domain/`, Prisma mapping only in `src/lib/persistence/prisma/`, routers map at wire boundary, consumers use domain types. `task.list` returns `DomainTask`. Auth dashboard uses unified `useDomainTasks(mode)`.

## Phases (4)

1. **Char** — `data-mode-context.test.tsx` (guest/auth wiring)
2. **ACL mechanism** — domain module + persistence mappers + tests
3. **Router + consumer enforcement** — task/check-in/suggestion routers, sweep 14 importers
4. **Path C** — `useDomainTasks(mode)`, dashboard auth path, mutation cache fix

## Exit gate

- `rg "@prisma/generated" src` → only `server/db` + `persistence/prisma`
- `pnpm test` + `pnpm check` green
- E2E belt green on PR
