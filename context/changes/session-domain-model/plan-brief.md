# Pomodoro Session Domain Model — Plan Brief

> Full plan: `context/changes/session-domain-model/plan.md`
> Roadmap slice: F-01 (foundation, status `ready`, blocks 6 of 7 remaining slices)

## What & Why

Wire the Pomodoro session domain through Prisma + tRPC so every later slice (S-01 first cycle through S-06 adaptive suggestion) has a stable contract to build on. F-01 adds `workType` + `weight` to `Task`, plus three new models — `Session`, `Cycle`, `CheckIn` — with matching tRPC routers under strict per-user isolation. No UI, no lifecycle logic, no scoring — those land in the slices F-01 unblocks.

## Starting Point

The repo ships one domain model (`Task`) with `id / title / status / userId`, one tRPC router (`taskRouter`) following a canonical `protectedProcedure` + per-user `findFirst` pattern, and a property-based isolation test (`task-isolation.test.ts`) that the new routers will clone. Prisma 7 schema is set up with `@@map("flow_state_<name>")` convention, `@prisma/generated` alias, and Neon adapter — F-01 is purely additive on top of this foundation.

## Desired End State

`pnpm prisma migrate dev` applies cleanly with existing `Task` rows backfilled (`workType = ADMIN`, `weight = 2`); `appRouter` exposes four sub-routers (`task`, `session`, `cycle`, `checkIn`); three new property-based isolation tests pass; existing task-list UI renders with zero regression and now returns `workType` / `weight` in the API response. Zero user-visible UI change beyond the API surface widening.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
|---|---|---|
| Cascade chain | User → Session → Cycle → CheckIn cascade; Cycle → Task is `SetNull` | Deleting a Task (FR-006) must not erase historical cycles per NFR no-silent-loss. |
| Soft vs hard delete | Hard delete everywhere | PRD §FR-006 + §Non-Goals; 90-day retention is a hook (`archivedAt` column), not a soft-delete flag. |
| `Task` backfill | `workType = ADMIN`, `weight = 2` defaults at column add | Backfill is atomic via Postgres `DEFAULT`; no separate data-fill SQL. |
| Enum strategy | Prisma `enum` for new fields; `Task.status` stays `String` | Type-safety end-to-end without churning a populated column. |
| Active-session uniqueness | Partial unique index `(userId) WHERE state = 'ACTIVE'` (hand-edited migration) | DB-level race-proof guard; alternatives carry application-locking risk. |
| Procedure surface | `create` + `list` only on Session/Cycle/CheckIn | Past Pomodoro records are not user-editable per PRD; smaller surface = less to test. |
| `cycle.taskId` | Nullable, `SetNull` on Task delete | Preserves session history when a task is deleted. |
| Test scope | Property-based isolation test per new router (3 files), 100 fast-check runs each | NFR data isolation guaranteed from F-01 onward; lifecycle tests live in slices that introduce lifecycle. |

## Scope

**In scope:**
- Schema: `Task.workType`, `Task.weight`; new models `Session`, `Cycle`, `CheckIn`; four enums (`WorkType`, `EnergyLevel`, `SessionState`, `CycleState`); partial unique on active session.
- API: `sessionRouter`, `cycleRouter`, `checkInRouter` with `create` + `list`; `taskRouter.create` + `update` extended with optional `workType` / `weight`.
- Tests: property-based isolation (3 files), cross-user FK guards, double-create CONFLICT.
- Migration: one new file, hand-edited for the partial unique index, applied locally with `pnpm prisma migrate dev`.

**Out of scope:**
- All cycle/session lifecycle logic (timer, transitions, 4h-inactivity end, long-break-every-4 rule) — S-01 / S-02.
- Mid-cycle completion prompt — S-03.
- UI for `workType` / `weight` on task forms — S-04.
- Check-in UI and scoring rationale — S-05 / S-06.
- 90-day retention background job — post-MVP.
- Production migration run.
- `update` / `delete` on Session, Cycle, CheckIn.

## Architecture / Approach

Schema-first, four-phase additive migration: (1) extend `Task` and add three models with their enums, generate the migration, hand-edit for the partial unique index, apply locally; (2) `sessionRouter` + isolation test (locks the pattern); (3) `cycleRouter` + `checkInRouter` + isolation tests (amortized boilerplate); (4) wire all three into `appRouter` and verify zero regression on the existing UI. Every router clones `taskRouter`'s `protectedProcedure` + `findFirst({ id, userId })` pattern; every isolation test clones `task-isolation.test.ts`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Schema and migration | Prisma schema extended; migration generated, hand-edited, applied locally | Migration generates NOT NULL without `DEFAULT` and fails on existing rows — mitigated by `--create-only` + manual SQL inspection |
| 2. sessionRouter + isolation test | First new router, isolation pattern locked | Pattern-drift from `taskRouter` — mitigated by side-by-side visual diff in manual verification |
| 3. cycleRouter + checkInRouter + isolation tests | Two routers + cross-user FK guards + uniqueness CONFLICT tests | Cross-user FK injection slips through if ownership check is forgotten — mitigated by an explicit property-based test for each |
| 4. Wire routers into root + zero-regression verify | `appRouter` exposes 4 sub-routers; build, typecheck, lint, full test suite green; UI smoke OK | Forgetting to register routers in `root.ts` (silently unreachable per AGENTS.md) — mitigated by Phase 4 manual UI smoke |

**Prerequisites:** None — F-01 has no upstream dependencies. Local Postgres reachable for `prisma migrate dev`. Auth context available (`ctx.session.user.id`) — already in place.
**Estimated effort:** ~2 sessions across 4 phases. Phase 1 is the longest (migration hand-edit, careful inspection). Phases 2–4 are pattern-replication + verification.

## Open Risks & Assumptions

- **Assumption**: Prisma 7 generates `ALTER TABLE ADD COLUMN ... DEFAULT ... NOT NULL` as a single statement when a `@default` is declared. If it splits this into ADD + ALTER SET DEFAULT (a known Prisma quirk on some versions), the migration may fail on a DB with existing rows. **Mitigation**: Phase 1 uses `--create-only` and inspects the SQL before applying.
- **Risk**: Prisma 7's partial unique index syntax requires hand-edited SQL — if a future `prisma migrate dev` regenerates the migration, the partial index could be lost. **Mitigation**: the migration file is committed as-edited; future schema changes generate ADDITIONAL migration files, not rewrites of this one. Document the hand-edit in a comment in the SQL file.
- **Assumption**: 90-day retention is a soft minimum, not a hard delete-after-90-days requirement. PRD wording supports this read. If reversed (hard delete), `archivedAt` becomes insufficient and a separate `deletedAt` plus job is needed — out of F-01 either way.

## Success Criteria (Summary)

- `pnpm test` and `pnpm build` green; the existing UI renders with zero regression after F-01 lands.
- `appRouter` exposes `task`, `session`, `cycle`, `checkIn`; existing rows in `flow_state_task` carry backfilled `workType = ADMIN` and `weight = 2`.
- F-01's downstream slices (S-01, S-02, S-03, S-04, S-05, S-06) can move from `proposed` to `ready` in the roadmap — the data and API layers they need are present.
