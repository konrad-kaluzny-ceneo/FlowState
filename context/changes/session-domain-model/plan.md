# Pomodoro Session Domain Model — Implementation Plan

## Overview

Wire the Pomodoro session domain end-to-end through the data layer and tRPC API surface so every later slice (S-01 first cycle, S-02 sessions with breaks, S-03 mid-cycle prompt, S-04 task attributes, S-05 check-ins, S-06 adaptive suggestion) has a stable contract to build on. This change adds two columns to the existing `Task` model and three new models — `Session`, `Cycle`, `CheckIn` — with matching tRPC routers that enforce strict per-user isolation. No user-visible UI changes; lifecycle logic (timer authority, transitions, scoring) is explicitly out of scope and lands in S-01 onward.

## Current State Analysis

The codebase ships with a single domain model and a clean tRPC + Prisma scaffold:

- **Schema** (`prisma/schema.prisma`): one `Task` model with `id / title / status / userId / createdAt / updatedAt`, mapped to `flow_state_task` with `task_status_idx` and `task_user_id_idx`. No session, cycle, or check-in entities.
- **tRPC** (`src/server/api/routers/task.ts`): `taskRouter` exposes `list / create / update / delete`. Every procedure is a `protectedProcedure` and scopes reads/writes by `ctx.session.user.id`. Update/delete first run `findFirst({ where: { id, userId } })` and throw `NOT_FOUND` if the row does not belong to the caller — this is the canonical isolation pattern.
- **Router registration** (`src/server/api/root.ts`): one entry — `task: taskRouter`. Unregistered routers are silently unreachable (per `AGENTS.md`).
- **Prisma client** (`src/server/db/index.ts`): single `PrismaClient` cached on `globalThis` in dev, instantiated with `PrismaNeon` adapter. Imported via the `@prisma/generated` alias (`vitest.config.ts:21`).
- **Migrations** (`prisma/migrations/0_init/migration.sql`): one initial migration. Build does NOT run migrations on Vercel — only `prisma generate` (per `package.json` `"build"` script). Production migrations go through `pnpm db:migrate:prod` (`scripts/migrate.ts`).
- **Tests**: property-based isolation pattern is established — `src/server/api/routers/task-isolation.test.ts` uses `fast-check` to generate multi-user task fixtures and asserts the querying user only ever sees their own rows. This is the template to clone for each new router.
- **Auth context** (`src/server/api/trpc.ts`): `ctx.session.user.id` is the canonical user identifier. All new entities reference it as a `String @db.VarChar(255)` (matches `Task.userId`).
- **Type contracts**: Prisma client generates to `./generated/prisma/client` and is imported via the `@prisma/generated` path alias (`vitest.config.ts:21`, `db/index.ts:2`). Enums declared in `schema.prisma` flow through to tRPC procedures and to React without runtime Zod ↔ string mapping.

What is missing for the Pomodoro domain (FR-017 through FR-020):

- `Task.workType` (deep work / admin / reactive) — FR-017
- `Task.weight` (1–3 scale) — FR-018
- `Session` (one row per Pomodoro session, FR-019: tracks cycles completed, interruption count, session start/end)
- `Cycle` (one row per work or break cycle within a session)
- `CheckIn` (one row per cycle-end mindful check-in: Focused / Steady / Fading) — FR-020
- Three matching tRPC routers, registered in `root.ts`

## Desired End State

When this plan is complete, the following is true and verifiable:

- `pnpm prisma migrate dev` applies cleanly against a fresh local DB and produces a schema with: `Task` (gaining `workType` and `weight` columns, both NOT NULL with backfill defaults), `Session`, `Cycle`, and `CheckIn` tables, all using the `flow_state_<name>` table-naming convention.
- `pnpm prisma generate` produces a typed Prisma client at `./generated/prisma/client` exporting `WorkType`, `EnergyLevel`, `SessionState`, and `CycleState` enums plus the four model types.
- `pnpm typecheck` passes — `~/server/api/root.ts` exports `appRouter` with four sub-routers: `task`, `session`, `cycle`, `checkIn`.
- `pnpm test` passes — every new router has a property-based isolation test mirroring the structure of `task-isolation.test.ts`. Total new test files: 3.
- `pnpm check` passes (Biome).
- The existing UI (`src/app/page.tsx` + `src/app/_components/task-list.tsx`) continues to render task list with no regression. New `Task.workType` / `Task.weight` columns are present in the API response but not surfaced in the UI yet (S-04 owns surfacing).

### Key Discoveries:

- `protectedProcedure` middleware narrows `ctx.session.user.id` to `string` (non-null), so every router can rely on it without extra guards (`src/server/api/trpc.ts:138-160`).
- Existing isolation test uses an in-memory `allTasks` array + mocked `db.task.findMany / findFirst / create / update / delete` and runs 100 fast-check iterations. The same fixture shape works for `session.findMany` etc. (`src/server/api/routers/task-isolation.test.ts:31-74`).
- `Task.status` is currently `String @db.VarChar(20)` (not enum) — keeping it as-is is intentional; only NEW state columns get Prisma `enum` to avoid a churn-y backfill on the existing column.
- `vitest.config.ts:21` aliases `@prisma/generated` to `./generated/prisma/client` — new enum imports in tests use the same alias.
- `package.json:"build"` is `prisma generate && next build`. Migrations are NOT in the build chain. This means a missing migration file does not break Vercel builds — but ALSO means production must explicitly run `pnpm db:migrate:prod` before a deploy that depends on new columns. This plan's manual verification step covers a local migrate-dev; production migrate is a deploy-time concern outside this plan.

## What We're NOT Doing

To prevent scope creep, the following are explicitly OUT of F-01 and belong to later slices:

- **No timer logic, no cycle authority, no transitions** — `Cycle` table exists, but nothing starts/ends cycles. That is S-01.
- **No session lifecycle enforcement** — no "4h inactivity ends session", no "long break every 4 cycles". That is S-02.
- **No mid-cycle completion prompt** — that is S-03.
- **No UI for `workType` / `weight`** on Task creation/edit — that is S-04. F-01 backfills sane defaults (`admin` / `2`) so existing rows remain valid; new rows from `taskRouter.create` also get those defaults until S-04 widens the input schema.
- **No check-in UI, no scoring rationale** — that is S-05 / S-06. F-01 stores the data, period.
- **No 90-day retention background job** — schema includes `Session.archivedAt DateTime?` as a hook for future archival, but no cron / no enforcement. Listing queries in S-02+ will filter `archivedAt: null`.
- **No update / delete procedures on Session, Cycle, CheckIn** — past Pomodoro records are not user-editable per PRD; only `create` and `list` (with per-user scoping) are exposed.
- **No production migration run** — this plan validates with `pnpm prisma migrate dev` (local). Running `pnpm db:migrate:prod` is a deploy-time decision, not a planning artifact.
- **No data migration of pre-existing Task rows beyond column defaults** — backfill for `workType` / `weight` happens at column-add time via Postgres `DEFAULT`; no separate data-fill SQL.

## Implementation Approach

The plan is sequenced **schema → migration → routers → registration**, mirroring the canonical "Database changes" pattern from the skill's Common Patterns. Four phases:

1. **Schema + migration** — extend `Task`, add three models, run `prisma migrate dev`. Validates the data shape end-to-end before any TypeScript depends on it.
2. **`sessionRouter` + isolation test** — first new router; locks in the per-user isolation pattern for the session aggregate root. CheckIn and Cycle reference Session, so this comes before them.
3. **`cycleRouter` + `checkInRouter` + isolation tests** — both routers in one phase because they share the pattern, the test scaffold, and the registration step. Implementing them together amortizes the boilerplate.
4. **Wire into `root.ts` + smoke verification** — register all three routers, run the full test/typecheck/lint suite, eyeball the existing task-list UI to confirm zero regression.

Decisions taken during planning that materially shape the schema:

| Decision | Choice | Rationale |
|---|---|---|
| Cascade on User → Session → Cycle → CheckIn | `onDelete: Cascade` | Sessions are derivative of the user account; nothing references them across users. |
| Cycle → Task | `taskId Int?` with `onDelete: SetNull` | A user deleting a Task (FR-006) must NOT erase historical cycles — preserves session history per NFR no-silent-loss. |
| Soft-delete vs hard-delete | Hard-delete everywhere | PRD §FR-006 + §Non-Goals (no historical analytics). 90-day retention is enforced post-MVP, not via a deleted-flag. |
| Defaults for existing Task rows | `workType = 'admin'`, `weight = 2` | Middle-of-scale `weight`, lowest-cost `workType`. Backfilled in the migration so the column can be NOT NULL. Users can edit later (in S-04). |
| Enum strategy | Prisma `enum` for new fields (`WorkType`, `EnergyLevel`, `SessionState`, `CycleState`) | Type-safety end-to-end without runtime mapping. Existing `Task.status` stays `String @db.VarChar(20)` — intentional: enum-converting a populated column is its own migration. |
| `weight` representation | `Int @db.SmallInt` + Zod `z.number().int().min(1).max(3)` at API boundary | Postgres SMALLINT is right-sized; bounds-check happens in the router input schema (matches existing `taskRouter.update` pattern of bounding `title` length in Zod). |
| Active-session uniqueness | Partial unique index: `@@unique([userId])` WHERE `state = 'active'` | Race-proof guard: only one active session per user. Without this, S-01 would carry application-level locking and risk duplicate-active-session bugs. |
| Retention | `Session.archivedAt DateTime?` column only | Schema-side hook; no cron in F-01. Listing queries in later slices filter `archivedAt: null`. |
| Procedure surface | Per-router `create` + `list` only on Session/Cycle/CheckIn (Task gains workType/weight in existing `update` input) | Past records are not user-editable per PRD; smaller surface = less to test, less to break. |
| Test scope | One property-based isolation test per new router (3 files), cloned from `task-isolation.test.ts` | NFR data isolation must be guaranteed from F-01 onward; lifecycle/timer behavior is tested in the slices that introduce it. |

## Critical Implementation Details

- **Migration ordering** — when `prisma migrate dev` generates the SQL for adding NOT NULL columns to `flow_state_task`, the column must be added with `DEFAULT 'admin'` / `DEFAULT 2` so existing rows backfill atomically. If Prisma generates a sequence that adds NOT NULL without a default first, the migration fails on any DB with existing rows. After the migration is generated, **inspect the generated `.sql` and confirm the `ALTER TABLE` carries the `DEFAULT`** before committing.

- **Partial unique index syntax** — Prisma 7 supports partial indexes via raw SQL only (no first-class `@@unique([...]) where(...)`). Add the index via a `prisma migrate dev --create-only` step, then hand-edit the generated migration file to add `CREATE UNIQUE INDEX ... WHERE state = 'active'`. This is the one place hand-edited SQL is justified — alternatives (application-level locking, full unique without partial) are worse.

## Phase 1: Schema and migration

### Overview

Extend `Task` with `workType` and `weight`. Add `Session`, `Cycle`, and `CheckIn` models with their enums. Generate the migration, hand-verify the SQL for the partial unique index and the `Task` column defaults, apply locally, regenerate the Prisma client.

### Changes Required:

#### 1. Prisma schema — Task extension and new enums

**File**: `prisma/schema.prisma`

**Intent**: Add `workType` and `weight` columns to the existing `Task` model with backfill defaults so the migration is safe against existing rows. Declare four enums (`WorkType`, `EnergyLevel`, `SessionState`, `CycleState`) at the top of the schema for use across the new models.

**Contract**:
- `Task.workType WorkType @default(ADMIN)`
- `Task.weight Int @db.SmallInt @default(2)`
- New indexes: `task_work_type_idx` on `workType`, kept narrow.
- `enum WorkType { DEEP_WORK ADMIN REACTIVE }` (FR-017)
- `enum EnergyLevel { FOCUSED STEADY FADING }` (FR-020)
- `enum SessionState { ACTIVE ENDED_BY_USER ENDED_BY_TIMEOUT }` (FR-019: explicit end vs 4h-inactivity end)
- `enum CycleState { RUNNING COMPLETED INTERRUPTED }` (RUNNING is the bridge state S-01 will use; F-01 only needs the enum to exist)

#### 2. Prisma schema — Session model

**File**: `prisma/schema.prisma`

**Intent**: Per-user Pomodoro session aggregate root. Tracks lifecycle endpoints and counters consumed by S-06 scoring. Cascades from user (logical: same `userId` String FK pattern as `Task`).

**Contract**:
- `id Int @id @default(autoincrement())`
- `userId String @map("user_id") @db.VarChar(255)`
- `state SessionState @default(ACTIVE)`
- `startedAt DateTime @default(now()) @db.Timestamptz`
- `endedAt DateTime? @db.Timestamptz`
- `lastActivityAt DateTime @default(now()) @db.Timestamptz` (FR-019: 4h inactivity → end)
- `interruptionCount Int @default(0)` (FR-019)
- `archivedAt DateTime? @db.Timestamptz` (90-day retention hook; not enforced in F-01)
- Relation: `cycles Cycle[]` (one-to-many)
- Indexes: `session_user_id_idx`, `session_state_idx`
- Partial unique on `userId` WHERE `state = 'ACTIVE'` (added via hand-edit of generated migration; see Critical Implementation Details)
- `@@map("flow_state_session")`

#### 3. Prisma schema — Cycle model

**File**: `prisma/schema.prisma`

**Intent**: One row per work-or-break cycle within a session. Holds the configured duration so refresh recovery (NFR no-silent-loss) can rehydrate the active cycle from the DB. `taskId` is nullable so deleting a Task does not destroy historical cycle records.

**Contract**:
- `id Int @id @default(autoincrement())`
- `sessionId Int @map("session_id")`
- `userId String @map("user_id") @db.VarChar(255)` (denormalized for cheap isolation checks — same pattern as `Task.userId`; avoids JOIN-through-session in every protected query)
- `taskId Int? @map("task_id")` (NULL when cycle is a break, OR when underlying task was deleted post-completion)
- `kind String @db.VarChar(10)` (`work` | `short_break` | `long_break`; kept as String not enum because the value is mechanical and unlikely to grow)
- `state CycleState @default(RUNNING)`
- `configuredDurationSec Int` (work or break length set at start, FR-010 / FR-011 range 5–90 min / 1–30 min — bounds enforced in router Zod)
- `startedAt DateTime @default(now()) @db.Timestamptz`
- `endedAt DateTime? @db.Timestamptz`
- Relations: `session Session @relation(fields: [sessionId], references: [id], onDelete: Cascade)`, `task Task? @relation(fields: [taskId], references: [id], onDelete: SetNull)`
- Indexes: `cycle_session_id_idx`, `cycle_user_id_idx`, `cycle_task_id_idx`
- `@@map("flow_state_cycle")`

#### 4. Prisma schema — CheckIn model

**File**: `prisma/schema.prisma`

**Intent**: Mindful end-of-cycle response (FR-020). One per cycle. Cascades from cycle.

**Contract**:
- `id Int @id @default(autoincrement())`
- `cycleId Int @unique @map("cycle_id")` (one check-in per cycle — DB-level invariant)
- `userId String @map("user_id") @db.VarChar(255)` (denormalized — see Cycle.userId rationale)
- `energy EnergyLevel`
- `respondedAt DateTime @default(now()) @db.Timestamptz`
- Relation: `cycle Cycle @relation(fields: [cycleId], references: [id], onDelete: Cascade)`
- Index: `check_in_user_id_idx`
- `@@map("flow_state_check_in")`

#### 5. Update Task model with reverse relation

**File**: `prisma/schema.prisma`

**Intent**: Add reverse relation `cycles Cycle[]` to `Task` so Prisma knows about the FK. No DB-level change beyond what the Cycle FK already produces.

**Contract**: Adds `cycles Cycle[]` to the existing `Task` model.

#### 6. Generate migration and hand-edit partial unique index

**File**: `prisma/migrations/<timestamp>_session_domain_model/migration.sql` (auto-generated, then hand-edited)

**Intent**: Run `pnpm prisma migrate dev --create-only --name session_domain_model` to generate the SQL without applying it. Inspect the file: confirm `ALTER TABLE flow_state_task ADD COLUMN "workType" ... DEFAULT 'ADMIN' NOT NULL` and same shape for `weight`. Then append the partial unique index for active sessions.

**Contract**: The generated migration must contain (in addition to Prisma's generated DDL):
```sql
CREATE UNIQUE INDEX "session_user_id_active_unique"
  ON "flow_state_session"("user_id")
  WHERE state = 'ACTIVE';
```
After hand-edit, run `pnpm prisma migrate dev` to apply. Commit the migration file as-edited.

### Success Criteria:

#### Automated Verification:

- Schema is valid: `pnpm prisma validate`
- Migration generates without errors: `pnpm prisma migrate dev --name session_domain_model`
- Generated client compiles: `pnpm db:generate`
- TypeScript compiles: `pnpm typecheck`
- Linter passes: `pnpm check`

#### Manual Verification:

- Inspect the generated migration `.sql` and confirm: `ALTER TABLE flow_state_task ADD COLUMN "workType" ... DEFAULT 'ADMIN' NOT NULL` (same for `weight`); the hand-added partial unique index for `flow_state_session` is present.
- `pnpm prisma studio` shows: existing `Task` rows backfilled with `workType = ADMIN` and `weight = 2`; new tables `flow_state_session`, `flow_state_cycle`, `flow_state_check_in` exist and are empty.
- Existing app still loads — `pnpm dev`, sign in, open `/`, see task list rendering with no console errors.

**Implementation Note**: After Phase 1's automated checks pass and manual verification of the migration SQL is done, pause for confirmation before starting Phase 2.

---

## Phase 2: sessionRouter + isolation test

### Overview

First new tRPC router. Establishes the per-user isolation pattern for the session aggregate root before the dependent routers (`cycleRouter`, `checkInRouter`) are added.

### Changes Required:

#### 1. New file — sessionRouter

**File**: `src/server/api/routers/session.ts`

**Intent**: Two procedures — `create` (start a new session for the calling user) and `list` (return the caller's sessions ordered by `startedAt DESC`). Both gated by `protectedProcedure`. `create` does NOT enforce "no other active session" at the application level — the partial unique index does that at the DB level (a duplicate-active insert raises a unique-constraint error, which the router translates into `TRPCError({ code: "CONFLICT" })`).

**Contract**:
- `list: protectedProcedure.query(...)` → returns `Session[]` filtered by `userId = ctx.session.user.id`, `archivedAt: null`, ordered by `startedAt DESC`.
- `create: protectedProcedure.mutation(...)` → no input; inserts a row with `userId: ctx.session.user.id`, `state: ACTIVE` and Prisma defaults for the rest. On Prisma `P2002` (unique constraint), throw `TRPCError({ code: "CONFLICT", message: "An active session already exists" })`.
- Imports follow existing pattern: `import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc"`, `import { TRPCError } from "@trpc/server"`.

#### 2. New file — sessionRouter isolation test

**File**: `src/server/api/routers/session-isolation.test.ts`

**Intent**: Property-based test mirroring `task-isolation.test.ts`. Generates 2–5 distinct user IDs, distributes 5–20 sessions across them, asserts every querying user sees only their own sessions. Plus a "user with no sessions gets empty result" property.

**Contract**: File structure mirrors `task-isolation.test.ts` exactly — mocks `~/lib/auth/server`, mocks `~/server/db/index` with an in-memory `allSessions` array, uses `fc.uniqueArray(userIdArb, ...)` and 100 `numRuns` per property. Uses `EnergyLevel`/`SessionState`/`WorkType` enum imports from `@prisma/generated` where needed.

### Success Criteria:

#### Automated Verification:

- Type checks pass: `pnpm typecheck`
- Linter passes: `pnpm check`
- New isolation test passes: `pnpm test src/server/api/routers/session-isolation.test.ts`
- Full test suite stays green: `pnpm test`

#### Manual Verification:

- Visually inspect `session.ts` against `task.ts` — patterns match (same import order, same `protectedProcedure` usage, same `findFirst` style if added later).
- Visually inspect `session-isolation.test.ts` against `task-isolation.test.ts` — same fixture shape, same assertion structure.

**Implementation Note**: After Phase 2 passes, pause for confirmation before Phase 3.

---

## Phase 3: cycleRouter + checkInRouter + isolation tests

### Overview

Add the two remaining routers and their isolation tests in one phase — they share the pattern, scaffold, and amortize the boilerplate. Cycle depends on Session existing in the DB (FK `sessionId`); CheckIn depends on Cycle existing (FK `cycleId`). The router-level `create` validates these references via Zod input + a `findFirst` ownership check before insert.

### Changes Required:

#### 1. New file — cycleRouter

**File**: `src/server/api/routers/cycle.ts`

**Intent**: `create` accepts `sessionId`, `kind`, `configuredDurationSec`, optional `taskId`. Validates: caller owns the session (findFirst by `id + userId`, throw `NOT_FOUND` if missing), and if `taskId` is provided, caller owns that task too. Inserts cycle with denormalized `userId: ctx.session.user.id`. `list` accepts an optional `sessionId` filter; without it, returns the caller's recent cycles.

**Contract**:
- `create: protectedProcedure.input(z.object({ sessionId: z.number().int(), kind: z.enum(["work", "short_break", "long_break"]), configuredDurationSec: z.number().int().min(60).max(90 * 60), taskId: z.number().int().optional() })).mutation(...)` — work cycle bounds 5–90 min from FR-010; break bounds 1–30 min from FR-011; the union `[60, 5400]` covers both since the kind is also passed. Tighter per-kind validation can be layered in S-01/S-02; F-01 keeps the Zod loose-but-bounded.
- `list: protectedProcedure.input(z.object({ sessionId: z.number().int().optional() })).query(...)` → ordered by `startedAt DESC`, scoped to caller's `userId`.
- Translates Prisma FK violation (`P2003`) on missing/foreign session or task into `TRPCError({ code: "NOT_FOUND" })` — though the up-front `findFirst` ownership check should prevent this; the catch is defense-in-depth.

#### 2. New file — cycleRouter isolation test

**File**: `src/server/api/routers/cycle-isolation.test.ts`

**Intent**: Same property-based shape as `task-isolation.test.ts` and `session-isolation.test.ts`. Plus one extra property: a user with `sessionId` belonging to another user gets `NOT_FOUND` on `create`, even if all other inputs are valid (cross-user FK injection guard).

**Contract**: Mirrors `task-isolation.test.ts` structure. Adds the cross-user FK property using `fc.tuple` over two distinct userIds.

#### 3. New file — checkInRouter

**File**: `src/server/api/routers/check-in.ts`

**Intent**: `create` accepts `cycleId` and `energy: EnergyLevel`. Validates caller owns the cycle (findFirst on `id + userId`), then inserts. The DB-level `@unique` on `cycleId` enforces "one check-in per cycle"; on `P2002` translate to `TRPCError({ code: "CONFLICT" })`. `list` returns the caller's check-ins ordered by `respondedAt DESC`.

**Contract**:
- `create: protectedProcedure.input(z.object({ cycleId: z.number().int(), energy: z.enum(["FOCUSED", "STEADY", "FADING"]) })).mutation(...)`. Zod string enum is mapped to Prisma's `EnergyLevel` enum at the boundary — Prisma client accepts the string form because the enum values match.
- `list: protectedProcedure.query(...)` → caller-scoped, ordered.

#### 4. New file — checkInRouter isolation test

**File**: `src/server/api/routers/check-in-isolation.test.ts`

**Intent**: Same property-based shape. Adds: cross-user `cycleId` injection on `create` returns `NOT_FOUND`; double-create on the same cycle returns `CONFLICT`.

**Contract**: Mirrors `cycle-isolation.test.ts`. The double-create property uses sequential calls within one `fcTest.prop` body.

### Success Criteria:

#### Automated Verification:

- Type checks pass: `pnpm typecheck`
- Linter passes: `pnpm check`
- Both new isolation tests pass: `pnpm test src/server/api/routers/cycle-isolation.test.ts src/server/api/routers/check-in-isolation.test.ts`
- Full test suite stays green: `pnpm test`

#### Manual Verification:

- Read `cycle.ts` and `check-in.ts` side-by-side with `session.ts` — patterns identical (input schema → ownership check → insert → error mapping).

**Implementation Note**: After Phase 3 passes, pause for confirmation before Phase 4.

---

## Phase 4: Wire routers into root and verify zero regression

### Overview

Register all three new routers in `appRouter`. Run the full verification suite. Eyeball the existing UI to confirm zero regression.

### Changes Required:

#### 1. Update appRouter registration

**File**: `src/server/api/root.ts`

**Intent**: Import and register `sessionRouter`, `cycleRouter`, `checkInRouter` alongside the existing `taskRouter`. AGENTS.md requires this — "unregistered routers are silently unreachable".

**Contract**: `appRouter` exports four sub-routers: `task`, `session`, `cycle`, `checkIn`. Naming follows camelCase convention from `task`.

#### 2. (Optional) Extend taskRouter input schemas to surface the new columns in API

**File**: `src/server/api/routers/task.ts`

**Intent**: Allow `taskRouter.update` to accept optional `workType` and `weight`, and `taskRouter.create` to accept the same as optional inputs. UI for this lives in S-04, but exposing the API surface here keeps S-04 focused on UI only. If S-04 is starting in parallel, this lets the UI dev work against a real contract.

**Contract**:
- `create: protectedProcedure.input(z.object({ title: z.string().min(1).max(256), workType: z.enum(["DEEP_WORK", "ADMIN", "REACTIVE"]).optional(), weight: z.number().int().min(1).max(3).optional() }))` — when omitted, Prisma defaults apply.
- `update: protectedProcedure.input(z.object({ id: z.number(), title: z.string().min(1).max(256).optional(), status: z.enum(["active", "completed"]).optional(), workType: z.enum(["DEEP_WORK", "ADMIN", "REACTIVE"]).optional(), weight: z.number().int().min(1).max(3).optional() }))`.
- Existing `taskRouter` tests must continue to pass; add at least one inline assertion in an existing test that round-trips `workType` if low-cost.

### Success Criteria:

#### Automated Verification:

- Type checks pass: `pnpm typecheck`
- Linter passes: `pnpm check`
- Full test suite passes: `pnpm test`
- Build succeeds: `pnpm build`

#### Manual Verification:

- `pnpm dev`, sign in, navigate to `/`, confirm task list renders, create a task, edit a task, mark a task done — zero regression vs pre-F-01 behavior.
- Browser DevTools → Network → tRPC call to `task.list` — response includes the new `workType` and `weight` fields with backfilled values.
- (Optional sanity) — open `pnpm prisma studio`, manually insert a Session row for the signed-in `userId`, confirm `session.list` returns it. Delete the row before moving on.

**Implementation Note**: After Phase 4 passes, F-01 is done. Open S-01 (`/10x-new first-pomodoro-cycle`) or S-04 (`/10x-new task-attributes-for-scoring`) — both are unblocked.

---

## Testing Strategy

### Unit Tests:

- Each new router gets a property-based isolation test (3 files), cloned from `task-isolation.test.ts`. Each runs 100 `fast-check` iterations per property.
- Cross-user FK injection guard for `cycle.create` and `checkIn.create` (a user trying to attach a cycle to another user's session, or a check-in to another user's cycle, gets `NOT_FOUND`).
- DB-level uniqueness — `checkIn.create` twice on the same cycle returns `CONFLICT`. `session.create` twice while one is `ACTIVE` returns `CONFLICT`.

### Integration Tests:

- Out of scope for F-01 — no end-to-end flow exists yet (S-01 introduces the first one).

### Manual Testing Steps:

1. Run `pnpm prisma migrate dev --create-only --name session_domain_model`. Open the generated `.sql` and confirm: `Task` ALTER carries `DEFAULT 'ADMIN'` and `DEFAULT 2`; partial unique index on `flow_state_session` was hand-added.
2. Run `pnpm prisma migrate dev` to apply.
3. Open `pnpm prisma studio`. Confirm 4 tables visible. Open `flow_state_task`, confirm existing rows have `workType = ADMIN`, `weight = 2`.
4. `pnpm dev`, sign in, hit `/`. Task list renders. Create / edit / complete / delete a task — no errors.
5. In DevTools → Network, click on the `task.list` POST request → response payload includes `workType` and `weight`.
6. (Optional sanity) — manually insert a `flow_state_session` row in Prisma Studio for the signed-in user's `userId`. Reload the app — no client-side error (the UI doesn't read sessions yet, so this only verifies the schema doesn't break things). Delete the row.

## Performance Considerations

F-01 introduces no hot paths. The new tables are write-rare (one session per user per few hours; one cycle per ~25 min), and the indexes added — `(userId)` on every model, `(state)` partial unique on Session — are sized for the canonical query pattern (`findMany({ where: { userId } })`) which mirrors the existing `Task` shape. No realistic load problem in MVP scope.

## Migration Notes

- **Existing `Task` rows are backfilled in-place** via Postgres `DEFAULT` at column-add time. No separate data-fill SQL.
- **Production migration is a deploy-time concern.** Vercel build does not run migrations (`package.json:"build"` is `prisma generate && next build`). Whoever ships F-01 to prod runs `pnpm db:migrate:prod` explicitly per `AGENTS.md` ("Build script runs `prisma generate` only — migrations are NOT run at build time on Vercel").
- **Rollback**: the migration is fully additive (new columns with defaults, new tables, no data deletion). Rolling back means dropping the new columns/tables — Prisma's `migrate diff` against `0_init` produces the down-SQL if needed.

## References

- Roadmap: `context/foundation/roadmap.md` (slice F-01)
- PRD: `context/foundation/prd.md` (FR-017 through FR-020, NFRs on data isolation, no-silent-loss, 90-day retention)
- Tech-stack rationale: `context/foundation/tech-stack.md`
- Existing schema (baseline): `prisma/schema.prisma`
- Initial migration (style baseline): `prisma/migrations/0_init/migration.sql`
- Canonical router pattern: `src/server/api/routers/task.ts`
- Canonical isolation test pattern: `src/server/api/routers/task-isolation.test.ts`
- tRPC bootstrap (do not edit): `src/server/api/trpc.ts`
- Router registration point: `src/server/api/root.ts`
- Prisma client bootstrap: `src/server/db/index.ts`
- Repository conventions: `AGENTS.md`
- Progress format contract: `references/progress-format.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Schema and migration

#### Automated

- [x] 1.1 Schema is valid: `pnpm prisma validate`
- [x] 1.2 Migration generates without errors: `pnpm prisma migrate dev --name session_domain_model`
- [x] 1.3 Generated client compiles: `pnpm db:generate`
- [x] 1.4 TypeScript compiles: `pnpm typecheck`
- [x] 1.5 Linter passes: `pnpm check`

#### Manual

- [x] 1.6 Inspect generated migration SQL — Task ALTER carries DEFAULT, partial unique index present
- [x] 1.7 Prisma Studio shows backfilled Task rows and three new empty tables
- [x] 1.8 Existing app loads with task list and zero console errors

### Phase 2: sessionRouter + isolation test

#### Automated

- [ ] 2.1 Type checks pass: `pnpm typecheck`
- [ ] 2.2 Linter passes: `pnpm check`
- [ ] 2.3 New isolation test passes: `pnpm test src/server/api/routers/session-isolation.test.ts`
- [ ] 2.4 Full test suite stays green: `pnpm test`

#### Manual

- [ ] 2.5 sessionRouter visually matches taskRouter pattern
- [ ] 2.6 session-isolation test visually matches task-isolation test structure

### Phase 3: cycleRouter + checkInRouter + isolation tests

#### Automated

- [ ] 3.1 Type checks pass: `pnpm typecheck`
- [ ] 3.2 Linter passes: `pnpm check`
- [ ] 3.3 Both new isolation tests pass: `pnpm test src/server/api/routers/cycle-isolation.test.ts src/server/api/routers/check-in-isolation.test.ts`
- [ ] 3.4 Full test suite stays green: `pnpm test`

#### Manual

- [ ] 3.5 cycleRouter and check-inRouter side-by-side with sessionRouter — patterns identical

### Phase 4: Wire routers into root and verify zero regression

#### Automated

- [ ] 4.1 Type checks pass: `pnpm typecheck`
- [ ] 4.2 Linter passes: `pnpm check`
- [ ] 4.3 Full test suite passes: `pnpm test`
- [ ] 4.4 Build succeeds: `pnpm build`

#### Manual

- [ ] 4.5 UI smoke — task list renders, CRUD works, zero regression
- [ ] 4.6 task.list response includes new workType and weight fields
- [ ] 4.7 (Optional) Prisma Studio session insert — session.list returns it
