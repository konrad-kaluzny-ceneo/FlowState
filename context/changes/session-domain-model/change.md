---
change_id: session-domain-model
title: Wire Pomodoro session domain (Task attrs + Session/Cycle/CheckIn)
status: impl_reviewed
created: 2026-05-26
updated: 2026-05-27
roadmap_ref: F-01
prd_refs:
  - "NFR (data isolation)"
  - "NFR (no silent data loss)"
  - "NFR (90-day session retention)"
  - FR-017
  - FR-018
  - FR-019
  - FR-020
unlocks:
  - S-01 (first-pomodoro-cycle)
  - S-02 (full-session-with-breaks)
  - S-03 (mid-cycle-completion-prompt)
  - S-04 (task-attributes-for-scoring)
  - S-05 (end-of-cycle-checkin)
  - S-06 (adaptive-task-suggestion)
prerequisites: []
parallel_with:
  - S-07 (account-recovery-flow)
---

# Change: session-domain-model

Foundation slice F-01 from `context/foundation/roadmap.md`. Wires the Pomodoro session domain through Prisma + tRPC: extends `Task` with `workType` and `weight`, adds `Session` / `Cycle` / `CheckIn` models with strict per-user isolation, and registers minimal create/list routers in `~/server/api/root.ts`.

No user-visible UI changes. Lifecycle logic (timer, transitions, scoring) lands in slice S-01 onward.

## Artefakty

- `plan.md` — implementation plan (4 fazy)
- `plan-brief.md` — two-pager
