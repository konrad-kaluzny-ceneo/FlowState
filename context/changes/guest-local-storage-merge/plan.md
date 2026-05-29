# Guest usage with localStorage and merge on login — Implementation Plan

## Overview

Enable try-before-signup: unauthenticated users run the same core loop (tasks + Pomodoro work cycles) with data in a versioned **guest localStorage blob**, then **import into their account** via a single server mutation after sign-in or sign-up. Logged-in users continue to use **server/tRPC only** — guest storage is never read or written while a session exists. Includes PRD/roadmap amendment (new slice **S-08**).

## Current State Analysis

From `context/changes/guest-local-storage-merge/frame.md`:

- **Auth gates**: `proxy.ts:5-16` (Neon middleware → sign-in), `page.tsx:13-15` (redirect if no session).
- **Data path**: All task/cycle/session routers use `protectedProcedure`; UI (`task-list.tsx`, `use-pomodoro-cycle.ts`) calls tRPC only.
- **localStorage today**: duration preference only (`duration-storage.ts`).
- **PRD**: login required (`prd.md:156`); FR-001 kept registration-first — this slice adds an explicit try-before-signup path without removing account requirement for long-term use.

### Key Discoveries

- Integer server IDs (`prisma/schema.prisma`) require **UUID guest IDs** + remap on import.
- Merge must be **transactional** on the server to satisfy NFR “no silent data loss.”
- Title collisions: insert new rows; if title exists on account, append **` (2)`**, **` (3)`**, … (user decision in planning).
- E2E smoke assumes authenticated `/` (`e2e/smoke.spec.ts`) — guest flow needs a separate unauthenticated spec.

## Desired End State

An unauthenticated visitor opens `/`, creates tasks, runs a work cycle (including refresh recovery), then signs up or signs in and sees **all guest tasks and cycles** on their account (with remapped IDs). A user who is **already logged in** never reads or writes the guest domain blob; only server data applies. PRD and `roadmap.md` document slice **S-08** with prerequisites **S-01**, **F-02**.

### Verification

- Guest: create task → start cycle → refresh → state restored (local).
- Auth: sign-in/sign-up with pending guest blob → tasks/cycles visible via tRPC; guest blob cleared.
- Logged-in revisit: no guest blob mutation; existing account data unchanged by localStorage.

## What We're NOT Doing

- Guest check-ins, break cycles, or multi-session lifecycle (S-02+).
- Public/guest tRPC procedures that persist domain data without `userId`.
- IndexedDB or offline sync beyond a single localStorage blob.
- Changing Prisma ID type from `Int` to UUID globally.
- OAuth / anonymous Neon Auth tokens (not available per e2e research).
- Auto-merge while already logged in without going through auth (import runs once after auth transition only).

## Implementation Approach

Introduce a **repository layer** (`TaskRepository`, `CycleRepository`, `SessionRepository`) with two implementations: **guest** (localStorage + in-memory timer state) and **server** (existing tRPC). A `DataModeProvider` exposes `mode: "guest" | "authenticated"` from session presence. Hooks and components depend on repositories, not raw `api.task.*`.

**Phase order (plan-review F1):** Phase 3 **auth spike** proves `/` without session **before** Phase 4 wires repositories into the full dashboard.

**Session rule (answers open question):** If `auth.getSession()` has a valid user, `mode === "authenticated"` — guest localStorage is **not** used for tasks/sessions/cycles. Duration preference (`flowstate:lastDurationSec`) may remain shared. After successful `guest.import`, **delete** the guest blob key so a logged-in session cannot accidentally re-import.

## Critical Implementation Details

**Neon Auth middleware:** **Phase 3 auth spike (gate)** — prove unauthenticated GET `/` in dev before Phase 4 repository/UI wiring. Document the exact Neon API or wrapper used. Do not start Phase 4 until incognito `/` loads without redirect. Do not ship with double-redirect or a broken protected API surface.

**Import ordering:** Import tasks first (build `guestTaskId → serverTaskId` map), then session, then cycles (rewire `taskId` / `sessionId`). Running guest cycle: if `startedAt + duration` is still in the future, create `RUNNING` server cycle; if expired, create `COMPLETED` with `endedAt` set.

## Phase 1: Product docs (PRD)

### Overview

Amend PRD so guest trial is in contract. **Roadmap S-08 is already on disk** (`roadmap.md`) — verify only; do **not** re-add or duplicate Linear/GitHub issues (L-01).

### Changes Required

#### 1. PRD access model

**File**: `context/foundation/prd.md`

**Intent**: Add FR for try-before-signup and post-login import; clarify Access Control allows optional guest session on `/` while accounts remain required for durable cross-device data.

**Contract**: New FR(s) under Authentication or a short “Guest trial” subsection; update Access Control bullet to “login required for account-backed data; guest trial uses device-local storage only.”

#### 2. Roadmap S-08 verification (read-only)

**File**: `context/foundation/roadmap.md`

**Intent**: Confirm S-08 row, slice section, and Backlog Handoff entry exist and match this change-id. Edit only if outcome/prerequisites text is wrong — do not create a second S-08 or new FLO/GitHub issue in this phase.

**Contract**: No duplicate roadmap IDs; Linear/GitHub IDs filled later via normal backlog workflow.

### Success Criteria

#### Automated Verification

- `pnpm check` passes (markdown-only edits should not fail).

#### Manual Verification

- S-08 already visible in roadmap At a glance with correct prerequisites (verify, not create).
- PRD no longer contradicts guest trial as an intentional path.

---

## Phase 2: Guest persistence and types

### Overview

Define versioned guest snapshot schema, localStorage adapter, and UUID-based guest entity types.

### Changes Required

#### 1. Guest snapshot schema

**File**: `src/lib/guest/schema.ts` (new)

**Intent**: Zod schema `GuestSnapshotV1` with `tasks[]`, `sessions[]`, `cycles[]` using string UUIDs; fields mirror Prisma shapes needed for import (title, status, workType, weight, cycle kind/state/timestamps/duration).

**Contract**: Export `GUEST_STORAGE_KEY = "flowstate:guest-v1"`, `parseGuestSnapshot`, `serializeGuestSnapshot`; reject unknown versions with safe empty default + console warning in dev.

#### 2. Guest store

**File**: `src/lib/guest/store.ts` (new)

**Intent**: CRUD helpers: `loadSnapshot`, `saveSnapshot`, `clearGuestSnapshot`, `hasGuestData`; handle quota/private-mode failures with user-visible error string (align with duration-storage try/catch pattern).

**Contract**: All mutations read-modify-write full blob (acceptable for MVP scale).

#### 3. Unit tests

**File**: `src/lib/guest/store.test.ts`, `src/lib/guest/schema.test.ts` (new)

**Intent**: Round-trip, corrupt JSON, version mismatch, clear.

**Contract**: Vitest coverage for happy path and corrupt blob.

### Success Criteria

#### Automated Verification

- `pnpm test` — guest store/schema tests pass
- `pnpm check`
- `pnpm typecheck`

#### Manual Verification

- None required for this phase.

---

## Phase 3: Auth spike — guest can load `/` (gate)

### Overview

**≤1 session spike before repository/UI wiring (plan-review F1).** Prove unauthenticated GET `/` works: relax proxy + page redirect, render a minimal guest shell (placeholder OK). Document exact Neon Auth configuration. **Phase 4 must not start** until this gate passes.

### Changes Required

#### 1. Proxy / middleware

**File**: `proxy.ts`

**Intent**: Stop redirecting unauthenticated users away from `/` while keeping auth routes and API auth paths working.

**Contract**: Document chosen Neon Auth configuration in code comment; extend `proxy.test.ts` expectations for `/` allowed without session cookie.

#### 2. Home page

**File**: `src/app/page.tsx`

**Intent**: Remove blanket `redirect("/auth/sign-in")`; when session present prefetch tRPC as today; when absent render guest shell inside `DataModeProvider` without server prefetch (full `PomodoroDashboard` wiring lands in Phase 4).

**Contract**: `dynamic = "force-dynamic"` retained; no `UNAUTHORIZED` prefetch for guests.

#### 3. Guest chrome

**Files**: `src/app/_components/guest-banner.tsx` (new), `src/app/layout.tsx` or dashboard shell

**Intent**: Persistent CTA: “Sign in to save across devices” linking to `/auth/sign-in` and sign-up.

**Contract**: `data-testid="guest-banner"` for E2E.

### Success Criteria

#### Automated Verification

- `pnpm test` — proxy tests updated
- `pnpm check`
- `pnpm typecheck`

#### Manual Verification

- Open `/` in incognito: page loads with guest banner, **no redirect** to sign-in.
- Log in as existing user: guest banner absent; authenticated path unchanged.

---

## Phase 4: Repository layer and data mode

### Overview

Abstract task/cycle/session access; wire full dashboard after Phase 3 gate. Authenticated users never hit guest store for domain data.

### Changes Required

#### 1. Repository interfaces

**Files**: `src/lib/data-mode/types.ts`, `src/lib/repositories/task-repository.ts`, `cycle-repository.ts`, `session-repository.ts` (new)

**Intent**: Interfaces matching operations used by `TaskList` and `usePomodoroCycle` (list/create/update/delete tasks; getActive/create/complete/interrupt cycle; getOrCreateActive session). Server impl delegates to tRPC client; guest impl mutates `GuestSnapshotV1`.

**Contract**: Guest task/cycle IDs are `string` (UUID); server remain `number`. Export `DomainTaskId` union. Guest `CycleRepository.getActive()` returns RUNNING cycle from local snapshot (mirrors server `cycle.getActive` shape enough for `resumeFromActiveCycle`).

#### 2. Data mode provider

**Files**: `src/lib/data-mode/data-mode-context.tsx`, `src/lib/data-mode/use-data-mode.ts` (new)

**Intent**: Client provider sets `mode` from session: if user present → `authenticated` + server repos; else → `guest` + guest repos. Expose `useRepositories()` hook.

**Contract**: `mode` derived from Neon Auth client session — prefer existing client pattern in codebase.

#### 3. Refactor consumers

**Files**: `src/app/_components/task-list.tsx`, `src/hooks/use-pomodoro-cycle.ts`, `src/app/_components/pomodoro-dashboard.tsx`, `src/app/_components/timer-panel.tsx`, `src/app/_components/cycle-complete-overlay.tsx`

**Intent**: Replace direct `api.task.*` / `api.cycle.*` with repository calls; keep timer worker/audio logic unchanged. **`PomodoroDashboard` must not call `api.task.list.useSuspenseQuery`** — remove duplicate task fetch; derive `activeTaskIds` from shared repository/task-list source. Update `FocusedTask` / props to use `DomainTaskId` in timer and overlay components.

**Contract**: Authenticated path may keep Suspense via server repo; guest path uses local state + `useSyncExternalStore` or `useState`+snapshot reload. Hook `resumeFromActiveCycle` reads active cycle via repository (guest: blob; auth: tRPC) so refresh recovery works in both modes.

### Success Criteria

#### Automated Verification

- `pnpm test` — repository unit tests with mocked tRPC / in-memory guest store
- `pnpm check`
- `pnpm typecheck`

#### Manual Verification

- Incognito: create task and start cycle on full dashboard (local persistence).
- Refresh mid-cycle restores guest state via repository `getActive`.

---

## Phase 5: Server import (`guest.import`) and post-auth hook

### Overview

Single transactional merge mutation; client invokes after sign-in/sign-up; clear guest blob on success.

### Changes Required

#### 1. Import input schema

**File**: `src/server/api/routers/guest.ts` (new)

**Intent**: `guest.import` protectedProcedure accepting `GuestSnapshotV1` payload (same Zod as client). Register in `src/server/api/root.ts`.

**Contract**: Returns `{ importedTasks, importedCycles }` counts; uses `ctx.db.$transaction`.

#### 2. Import logic

**File**: `src/server/api/lib/import-guest-snapshot.ts` (new)

**Intent**: For each guest task, `create` with `userId`; on exact title match with existing user task, assign title `Title (2)`, `Title (3)`, … using max suffix scan. Map guest task UUIDs → server IDs. Create session if snapshot has one. For each cycle, attach remapped FKs; running cycle per frame rules (RUNNING if not expired else COMPLETED). Skip duplicate import if guest blob empty.

**Contract**: All rows scoped to `ctx.session.user.id`; no cross-user writes.

#### 3. Integration tests

**File**: `src/server/api/routers/guest.test.ts` or `guest-import.integration.test.ts`

**Intent**: Guest snapshot with 2 tasks (one colliding title), 1 running cycle → assert DB state and title suffixes.

**Contract**: Use existing test DB patterns from `task-isolation.test.ts`.

#### 4. Post-auth merge trigger

**Files**: `src/lib/guest/run-import-after-auth.ts` (new), `src/app/_components/guest-import-on-mount.tsx` (new)

**Intent**: Merge runs **client-side on landing** after auth redirect (server actions unchanged): when authenticated + blob present, `guest-import-on-mount` calls `api.guest.import` then `clearGuestSnapshot`.

**Contract**: Server actions stay as-is; merge runs in client effect once per blob (guard with `sessionStorage` flag `flowstate:guest-import-done` keyed by blob hash or clear blob after success to prevent double import).

### Success Criteria

#### Automated Verification

- `pnpm test` — guest import integration tests pass
- `pnpm check`
- `pnpm typecheck`

#### Manual Verification

- Guest: add task + start cycle → sign up → task and cycle visible on server account.
- Existing account with task “Foo” + guest task “Foo” → after import, “Foo” and “Foo (2)” (or next free suffix).
- After import, reload logged in: guest blob empty; no duplicate import on second load.

---

## Phase 6: E2E and regression

### Overview

Playwright coverage for guest path and authenticated regression; document manual cross-browser spot check.

### Changes Required

#### 1. Guest E2E

**File**: `e2e/guest-trial.spec.ts` (new)

**Intent**: Unauthenticated project or `storageState: undefined`; visit `/`, create task, start short cycle (clock fast-forward per `pomodoro-cycle.spec.ts` pattern), refresh, assert state; navigate to sign-in, complete test user auth, assert imported task visible.

**Contract**: May require `playwright.config` project without `auth.setup` dependency for guest spec only.

#### 2. Smoke unchanged

**File**: `e2e/smoke.spec.ts`

**Intent**: Authenticated smoke still passes.

**Contract**: No regression to F-02 fixture.

#### 3. Hook tests

**File**: `src/hooks/use-pomodoro-cycle.test.tsx`

**Intent**: Update mocks for repository layer (replace direct `api.cycle.*` mocks where applicable).

**Contract**: Guest and authenticated resume paths covered at unit level.

### Success Criteria

#### Automated Verification

- `pnpm test`
- `pnpm test:e2e` — smoke + guest-trial
- `pnpm check`
- `pnpm typecheck`

#### Manual Verification

- Incognito guest flow feels acceptable; sign-in CTA obvious.
- Confirm logged-in user editing tasks does not write `flowstate:guest-v1`.

---

## Testing Strategy

### Unit Tests

- Guest schema parse/serialize, store round-trip
- Title suffix algorithm (`Foo` → `Foo (2)` when `Foo` exists)
- Repository guest implementation CRUD

### Integration Tests

- `guest.import` transaction with collision + running cycle expiry edge cases

### Manual Testing Steps

1. Incognito: full guest loop without account.
2. Sign up with guest data → verify merge.
3. Sign in to existing account with overlapping task title → numbered suffix.
4. Log in with empty guest blob → no errors.
5. Log in with existing account, no guest blob → server-only behavior.

## Performance Considerations

Full blob read/write on each guest mutation is fine for MVP (tens of tasks). Import is one-shot per auth event.

## Migration Notes

No DB migration. Existing users unaffected. Guest blob is device-local; clearing browser data loses guest work (document in guest banner copy).

## References

- Frame: `context/changes/guest-local-storage-merge/frame.md`
- `proxy.ts`, `src/app/page.tsx`, `src/server/api/trpc.ts`
- `context/foundation/prd.md`, `context/foundation/roadmap.md`
- Prior pattern: `context/changes/first-pomodoro-cycle/plan.md` (localStorage duration, recovery)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Product docs (PRD)

#### Automated

- [ ] 1.1 `pnpm check` passes after PRD edits

#### Manual

- [ ] 1.2 S-08 already in roadmap At a glance — verified, not duplicated
- [ ] 1.3 PRD guest trial path does not contradict Access Control

### Phase 2: Guest persistence and types

#### Automated

- [ ] 2.1 `pnpm test` — guest store/schema tests pass
- [ ] 2.2 `pnpm check`
- [ ] 2.3 `pnpm typecheck`

### Phase 3: Auth spike — guest can load `/` (gate)

#### Automated

- [ ] 3.1 `pnpm test` — proxy tests updated
- [ ] 3.2 `pnpm check`
- [ ] 3.3 `pnpm typecheck`

#### Manual

- [ ] 3.4 Incognito `/` loads with guest banner, no redirect
- [ ] 3.5 Logged-in `/` unchanged (no guest banner)

### Phase 4: Repository layer and data mode

#### Automated

- [ ] 4.1 `pnpm test` — repository tests pass
- [ ] 4.2 `pnpm check`
- [ ] 4.3 `pnpm typecheck`

#### Manual

- [ ] 4.4 Incognito guest task + cycle + refresh recovery
- [ ] 4.5 Logged-in `/` uses server data only (no guest blob reads)

### Phase 5: Server import and post-auth hook

#### Automated

- [ ] 5.1 `pnpm test` — guest import integration tests pass
- [ ] 5.2 `pnpm check`
- [ ] 5.3 `pnpm typecheck`

#### Manual

- [ ] 5.4 Guest work survives sign-up/sign-in merge
- [ ] 5.5 Title collision produces numbered suffix
- [ ] 5.6 No duplicate import on second authenticated page load

### Phase 6: E2E and regression

#### Automated

- [ ] 6.1 `pnpm test`
- [ ] 6.2 `pnpm test:e2e` — smoke + guest-trial
- [ ] 6.3 `pnpm check`
- [ ] 6.4 `pnpm typecheck`

#### Manual

- [ ] 6.5 Logged-in task edits do not write guest domain key
