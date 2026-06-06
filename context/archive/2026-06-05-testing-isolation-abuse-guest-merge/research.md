---
date: 2026-06-05T10:00:00+02:00
researcher: Cursor Agent (Auto)
git_commit: 1e5ddd4872a4e34f1be7fa7630de6f7b76357e8a
branch: unified-duration-picker-ux
repository: FlowState
topic: "Phase 3 — isolation, abuse & guest merge (risks #4, #5, #6)"
tags: [research, codebase, isolation, idor, guest-merge, trpc, integration, test-plan]
status: complete
last_updated: 2026-06-05
last_updated_by: Cursor Agent (Auto)
---

# Research: Phase 3 — isolation, abuse & guest merge (risks #4, #5, #6)

**Date**: 2026-06-05T10:00:00+02:00  
**Researcher**: Cursor Agent (Auto)  
**Git Commit**: `1e5ddd4872a4e34f1be7fa7630de6f7b76357e8a`  
**Branch**: `unified-duration-picker-ux`  
**Repository**: [konrad-kaluzny-ceneo/FlowState](https://github.com/konrad-kaluzny-ceneo/FlowState)

## Research Question

Ground test-plan Phase 3 (`testing-isolation-abuse-guest-merge`) for:

- **Risk #4**: Authenticated user reads or mutates another user's tasks, sessions, or cycles.
- **Risk #5**: Guest trial tasks or cycles are lost or silently overwritten on sign-in merge.
- **Risk #6**: Attacker with a valid session manipulates resource IDs to access another user's tasks or cycles (IDOR).

Per `test-plan.md` §2: integration (`createCaller` + dual-user fixtures) is the cheapest layer for #4 and #6; integration on merge procedure (+ one browser merge e2e) for #5. Research must locate where failures would live — not assume test-plan anchors.

## Summary

FlowState enforces ownership on **all 17 protected procedures** via `userId`-scoped queries and `findFirst({ id, userId })` / `updateMany({ id, userId })` pre-checks. Cross-user access returns **`NOT_FOUND`** (mutations) or **empty/zero** (queries) — never `FORBIDDEN` and never foreign row data. Implementation is sound at the router layer.

**Existing test signal is partial and mock-heavy.** Five `*-isolation.test.ts` files plus targeted cases in `cycle.test.ts` and `task-mutation.test.ts` cover list isolation and some FK/IDOR paths. Gaps: `cycle.getActive` cross-user leak, `cycle.countCompletedWork`, `cycle.create` with victim `taskId`, `cycle.list({ sessionId })`, weak `task-mutation` stub, and no real-DB integration (consistent with Phase 1 precedent).

**Guest merge (Risk #5)** is implemented: `importGuestSnapshot` runs in a single `$transaction`, closes account `RUNNING` cycles, normalizes expired guest `RUNNING` → `COMPLETED`, remaps UUID FKs, applies ` (2)`/` (3)` title suffixes. UI clears localStorage **only after** successful server action. Tests cover happy-path merge and suffix logic; gaps include expired RUNNING, pre-existing account RUNNING closure, empty snapshot, and sign-in e2e.

**Recommended `/10x-plan` scope:** extend existing co-located router tests with imperative dual-user cases (stateful in-memory Prisma mocks — repo convention); fix `task-mutation.test.ts` anti-pattern; extend `guest.test.ts` for merge edge cases; defer one Playwright guest→auth merge e2e until integration passes. No new Vitest real-DB infra unless CI policy changes.

## Detailed Findings

### Risk #4 & #6 — Router ownership (production code)

#### Auth gate

`protectedProcedure` (`src/server/api/trpc.ts:137-161`) throws `UNAUTHORIZED` when session lacks `id`, `email`, or `name`. All API procedures use `protectedProcedure` — no `publicProcedure` on domain routers.

#### Ownership patterns

| Pattern | Procedures | Cross-user result |
|---------|------------|-------------------|
| `findMany` / `count` + `userId` filter | `task.list`, `session.list`, `cycle.list`, `cycle.countCompletedWork`, `checkIn.list`, `cycle.getActive` | Empty array, `0`, or `null` |
| Create stamps `userId` from session | `task.create`, `session.create`, `cycle.create`, `checkIn.create`, `guest.import` | N/A (no foreign resource IDs except FKs) |
| `findFirst({ id, userId })` before mutate | `task.update/delete`, `cycle.create` (sessionId/taskId), `cycle.complete/interrupt`, `checkIn.create` | `NOT_FOUND` |
| `updateMany({ id, userId, state })` | `cycle.complete`, `cycle.interrupt`, `session.end` (user-scoped, no session ID param) | `NOT_FOUND` or `BAD_REQUEST` |

#### Per-router procedure inventory (17 total)

**task** (`src/server/api/routers/task.ts`):

| Procedure | Ownership | Cross-user |
|-----------|-----------|------------|
| `list` | `where: { userId }` (L7-11) | Empty array |
| `create` | `data.userId` from session (L22-30) | N/A |
| `update` | `findFirst({ id, userId })` → `NOT_FOUND` (L45-51) | NOT_FOUND |
| `delete` | `findFirst({ id, userId })` → `NOT_FOUND` (L62-68) | NOT_FOUND |

**session** (`src/server/api/routers/session.ts`):

| Procedure | Ownership | Cross-user |
|-----------|-----------|------------|
| `list` | `where: { userId }` (L7-12) | Empty array |
| `create` | `userId` from session (L15-19) | N/A |
| `getOrCreateActive` | `findOrCreateActiveSession(db, userId)` | N/A |
| `end` | `updateMany({ userId, state: ACTIVE })` (L39-57) | Only caller's session; NOT_FOUND if none |

**cycle** (`src/server/api/routers/cycle.ts`):

| Procedure | Ownership | Cross-user |
|-----------|-----------|------------|
| `list` | `where: { userId, sessionId? }` (L11-21) | Foreign `sessionId` → `[]` |
| `countCompletedWork` | `count({ userId, sessionId, ... })` (L24-34) | Foreign `sessionId` → `0` |
| `getActive` | `findFirst({ userId, state: RUNNING })` (L37-45) | Victim RUNNING → `null` for attacker |
| `create` | Session/task `findFirst` + `userId` on cycle (L62-104) | Foreign sessionId/taskId → NOT_FOUND |
| `complete` / `interrupt` | `findFirst({ id, userId })` + `updateMany` (L137-206) | Foreign cycleId → NOT_FOUND |

**checkIn** (`src/server/api/routers/check-in.ts`):

| Procedure | Ownership | Cross-user |
|-----------|-----------|------------|
| `list` | `where: { userId }` (L8-13) | Empty array |
| `create` | `cycle.findFirst({ id: cycleId, userId })` (L25-31) | Foreign cycleId → NOT_FOUND |

**guest** (`src/server/api/routers/guest.ts`):

| Procedure | Ownership | Cross-user |
|-----------|-----------|------------|
| `import` | All rows created with `ctx.session.user.id` via `importGuestSnapshot` | N/A (guest UUIDs, not DB IDs) |

#### Phase 3 nuance: query vs mutation error semantics

`cycle.list({ sessionId: victimId })` and `countCompletedWork({ sessionId: victimId })` return **empty/0**, not `NOT_FOUND`. This does not leak row data but may leak existence semantics — acceptable per test-plan (“forbidden or not-found”); document as intentional in tests.

Secondary writes after ownership check use `update({ where: { id } })` without `userId` (task update/delete). Safe given pre-check; no TOCTOU tests exist.

---

### Risk #4 & #6 — Existing test coverage and gaps

#### Test infrastructure (Vitest)

- Config: `vitest.config.ts` — jsdom, `e2e/**` excluded, dummy `DATABASE_URL` (no real Postgres in Vitest).
- Pattern: `vi.mock("~/server/db/index")` + in-memory arrays; `createCallerFactory(router)` with injected `session` (`cycle.test.ts:207-223`).
- `integration:` prefix in `cycle.test.ts` = **chained caller flows on mocks**, not real DB (test-plan §6.2 reference).

#### Coverage matrix

| Procedure | List isolation | Cross-user IDOR | Test file(s) | Gap |
|-----------|---------------|-----------------|--------------|-----|
| `task.list` | Yes (property) | N/A | `task-isolation.test.ts`, `task-query.test.ts` | Duplicate files |
| `task.update/delete` | — | Partial (weak mock) | `task-mutation.test.ts` | `findFirst` ignores query args — anti-pattern |
| `session.list` | Yes | N/A | `session-isolation.test.ts` | — |
| `session.create/getOrCreateActive/end` | — | No cross-user seed | `session.test.ts` | Victim session side-effects untested |
| `cycle.list` | Yes | No `sessionId` IDOR | `cycle-isolation.test.ts` | Foreign sessionId → `[]` |
| `cycle.countCompletedWork` | — | **None** | — | **Highest IDOR gap** |
| `cycle.getActive` | Single-user | **None** | `cycle.test.ts` | Victim RUNNING must not appear |
| `cycle.create` | — | sessionId yes; **taskId no** | `cycle-isolation.test.ts` | FK taskId IDOR |
| `cycle.complete/interrupt` | — | Yes | `cycle.test.ts:350-439` | — |
| `checkIn.list` | Yes | N/A | `check-in-isolation.test.ts` | — |
| `checkIn.create` | — | Yes (cycleId) | `check-in-isolation.test.ts:182-205` | — |
| `guest.import` | N/A | N/A | `guest.test.ts` | Risk #5 scope |

#### Anti-patterns observed (vs test-plan §2)

1. **`task-mutation.test.ts`** — global `findFirstResult` toggle; does not verify `where.userId` in query. Matches Risk #4 anti-pattern: “Mocking auth middleware while skipping DB-level isolation assertions.”
2. **All isolation files** — mocked Prisma only; no SQL-layer proof. Acceptable per Phase 1 precedent if mocks enforce same `userId` filters as production.
3. **`protected-procedure.test.ts`** — UNAUTHORIZED only; no IDOR (expected for that file).

#### Priority gap list for `/10x-plan`

1. `cycle.getActive` — seed victim RUNNING, attacker caller → `null`
2. `cycle.countCompletedWork` — victim sessionId → `0`
3. `cycle.create` — victim `taskId` → NOT_FOUND
4. `cycle.list({ sessionId: victimId })` → `[]`
5. Refactor `task-mutation.test.ts` to stateful multi-user store (mirror `task-isolation.test.ts`)
6. Consolidate `task-isolation.test.ts` / `task-query.test.ts` duplication
7. Optional: `session.getOrCreateActive` with victim active session present — assert attacker gets own session only

---

### Risk #5 — Guest merge implementation

#### End-to-end flow

```mermaid
sequenceDiagram
  participant LS as localStorage (flowstate:guest-v1)
  participant GIM as GuestImportOnMount
  participant SS as sessionStorage (import guard)
  participant SA as importGuestSnapshotAction
  participant Core as importGuestSnapshot
  participant DB as Prisma $transaction

  GIM->>SS: markGuestImportAttempted()
  GIM->>LS: loadGuestSnapshotForImport()
  GIM->>SA: importGuestSnapshotAction(snapshot)
  SA->>Core: importGuestSnapshot(db, userId, parsed)
  Core->>DB: single transaction
  alt success
    GIM->>SS: markGuestImportDone()
    GIM->>LS: clearGuestSnapshot()
  else failure
    Note over LS: blob kept; attempted flag blocks retry
  end
```

**Entry points:**

| Layer | File | Notes |
|-------|------|-------|
| Core | `src/server/api/lib/import-guest-snapshot.ts` | All merge logic |
| tRPC | `src/server/api/routers/guest.ts:6-10` | `guest.import` |
| Server action (UI path) | `src/app/_actions/import-guest-snapshot.ts` | Auth + Zod → same core |
| Client | `src/app/_components/guest-import-on-mount.tsx` | Post-auth one-shot import |
| Mount | `src/app/_components/home-shell.tsx` | Renders when authenticated |

Production UI uses **server action**, not tRPC (`guest-import-on-mount.tsx:43`).

#### Transaction boundary

Empty snapshot returns `{ importedTasks: 0, importedCycles: 0 }` **outside** transaction (`import-guest-snapshot.ts:26-32`).

Inside `$transaction` (order):

1. Close all caller `RUNNING` cycles (`updateMany` L36-39)
2. Load existing task titles (L41-45)
3. Create guest tasks with `resolveUniqueTitle` (L48-63)
4. Create session from `snapshot.sessions[0]` if present (L65-79)
5. Create cycles with FK remap + RUNNING expiry normalization (L84-126)

#### Title collision policy

`resolveUniqueTitle` (`import-guest-snapshot.ts:5-19`): exact match → `Title (2)`, then `(3)`, … Account tasks never renamed.

Unit tests: `import-guest-snapshot.test.ts:5-19`. Integration: `guest.test.ts:159-163`.

#### RUNNING cycle handling

| Case | Behavior | Tested? |
|------|----------|---------|
| Account has RUNNING before import | Force COMPLETED + `endedAt` (L36-39) | No assertion |
| Guest RUNNING, not expired | Import as RUNNING | Yes (`guest.test.ts:165`) |
| Guest RUNNING, expired | Import as COMPLETED, `endedAt` from expiry | **No** |
| Unknown guest taskId on cycle | `taskId: null` (L92-95) | **No** |

#### Guest blob clear timing

- Success: `markGuestImportDone()` then `clearGuestSnapshot()` (`guest-import-on-mount.tsx:54-55`)
- Failure: blob kept; `markGuestImportAttempted()` already set — **same blob won't retry** in session (`import-guard.ts:29-31`)
- Guard keys: `flowstate:guest-import-done`, `flowstate:guest-import-attempted` (`import-guard.ts:4-5`)

#### E2E vs integration

`e2e/guest-trial.spec.ts` covers guest-only reload (Risk #1 UI path) — **not** sign-in merge. Phase 3 needs one browser flow: guest task → auth → server tasks visible + localStorage empty.

---

## Code References

- `src/server/api/trpc.ts:137-161` — `protectedProcedure` / `enforceAuth`
- `src/server/api/root.ts:13-19` — router mount (task, session, cycle, checkIn, guest)
- `src/server/api/routers/task.ts:7-68` — task ownership
- `src/server/api/routers/cycle.ts:11-206` — cycle ownership + IDOR paths
- `src/server/api/routers/check-in.ts:8-39` — check-in FK guard
- `src/server/api/routers/cycle.test.ts:350-368` — interrupt NOT_FOUND cross-user
- `src/server/api/routers/cycle.test.ts:422-439` — complete NOT_FOUND cross-user
- `src/server/api/routers/cycle-isolation.test.ts:214-241` — FK sessionId injection
- `src/server/api/routers/check-in-isolation.test.ts:182-205` — FK cycleId injection
- `src/server/api/routers/task-mutation.test.ts:10-35` — weak findFirst mock (anti-pattern)
- `src/server/api/lib/import-guest-snapshot.ts:26-132` — merge transaction
- `src/app/_components/guest-import-on-mount.tsx:29-62` — import orchestration + clear
- `vitest.config.ts:5-17` — test env (no real DB)
- `context/foundation/test-plan.md:54-60` — risk response guidance
- `context/foundation/test-plan.md:72-73` — Phase 3 definition

## Architecture Insights

1. **Consistent NOT_FOUND policy** — IDOR is indistinguishable from missing resource; no `FORBIDDEN` anywhere. Tests should assert `NOT_FOUND` or empty, not expect `FORBIDDEN`.
2. **Per-router test mocks** — each `*.test.ts` owns a tailored Prisma mock matching that router's DB calls; no shared dual-user helper exists yet.
3. **Dual-user pattern** — seed victim rows in module arrays, call `createCaller` with attacker session, assert denial. Property-based variant uses fast-check for FK injection (`cycle-isolation.test.ts`).
4. **Guest merge is server-authoritative** — client only ships snapshot; all integrity rules live in `importGuestSnapshot` inside one transaction.
5. **Cost × signal** — integration-first for #4/#6; one merge e2e after integration for #5; do not block Phase 3 on Playwright for isolation proofs.

## Historical Context (from prior changes)

- `context/changes/testing-critical-path-persistence-timer/research.md` — deferred guest merge and session-timeout stale RUNNING to Phase 3; established `createCaller` + mock DB as integration pattern.
- `context/changes/testing-critical-path-persistence-timer/plan.md` — cross-user IDOR explicitly deferred to Phase 3 cookbook §6.2.
- `context/changes/guest-local-storage-merge/plan.md` — S-08 feature plan; called for real DB integration tests; implementation uses mocks in `guest.test.ts` instead.
- `context/changes/guest-local-storage-merge/change.md` — feature status `implementing`; roadmap S-08 still `proposed`.
- `context/foundation/test-plan.md:165` — Phase 1 deferred session-timeout + stale RUNNING cycle to Phase 3.

## Related Research

- [Phase 1 persistence & timer research](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/766ac44d3ab151cc9a0fe09523cd8ed78a886396/context/changes/testing-critical-path-persistence-timer/research.md)

## Open Questions

1. **Real DB in Vitest?** Phase 1 and current convention use in-memory mocks only. Neon branch fixtures would add CI complexity — confirm stay mock-only unless team wants SQL-layer proof.
2. **`cycle.list` empty vs NOT_FOUND** — product/security accept empty array for foreign `sessionId`? No code change needed if tests document intent.
3. **Failed import retry UX** — `markGuestImportAttempted` blocks retry without refresh; is that acceptable for Risk #5 or should `/10x-plan` add recovery path?
4. **S-08 roadmap sync** — guest feature code exists but roadmap `proposed`; test rollout can proceed independently of roadmap status activation.
5. **Session router cross-user** — `getOrCreateActive` / `end` have no ID params; low IDOR risk — include only if time permits.

## Recommended `/10x-plan` work packages

| Package | Risks | Files to extend | Layer |
|---------|-------|-----------------|-------|
| A — Cycle IDOR gaps | #4, #6 | `cycle.test.ts` or `cycle-isolation.test.ts` | Integration (mock DB) |
| B — Task mutation hardening | #4, #6 | `task-mutation.test.ts` | Replace stub with multi-user store |
| C — Session side-effect smoke | #4 | `session.test.ts` | Optional dual-user seed |
| D — Guest merge edge cases | #5 | `guest.test.ts`, `import-guest-snapshot.test.ts` | Integration |
| E — Guest merge e2e | #5 | new `e2e/guest-merge.spec.ts` | Playwright (after A–D) |
| F — Cookbook §6.5 | #5 | `test-plan.md` §6.5 | Docs after ship |

**Suggested implementation order:** B → A → D → (optional C) → E → F.
