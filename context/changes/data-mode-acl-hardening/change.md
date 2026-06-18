---
change_id: data-mode-acl-hardening
title: Harden data-mode ACL and isolate Prisma domain enums
status: new
created: 2026-06-17
updated: 2026-06-17
archived_at: null
---

## Notes

K2 z `context/changes/refactor-opportunities/plan.md` (Phase 5 char + Phase 7 Path C) plus rozszerzenie z `context/domain/03-anti-corruption-layer.md`: `src/lib/domain/` jako SSOT enumów (`WorkType`, `EnergyLevel`, `CommitmentHorizon`, `CycleEndAudioMode`), `src/lib/persistence/prisma/` jako jedyne miejsce `fromPrisma*`/`toPrisma*`, mapowanie routerów na granicy wire (`task`, `check-in`, `suggestion`), sweep konsumentów (`score-task`, session, hooks, UI). Prerequisite: F-07 merged. Cel weryfikacji: `rg "@prisma/generated" src` poza `server/db` i `persistence/prisma` → 0.
