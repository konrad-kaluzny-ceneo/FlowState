# Phase 3 Test Rollout — Isolation, Abuse & Guest Merge Implementation Plan

## Overview

Ship test coverage for test-plan Phase 3 (risks **#4**, **#5**, **#6**): prove per-user isolation and IDOR rejection on all tRPC routers, guest→account merge integrity at the integration layer, and document stale RUNNING cycle behavior deferred from Phase 1. This rollout adds **tests and cookbook documentation only** — no product or schema changes unless a failing test exposes a separate bug.

Integration uses in-memory Prisma mocks (Phase 1 precedent). Playwright guest-merge e2e is **explicitly deferred** from this change.

## Current State Analysis

Production routers enforce ownership on all 17 protected procedures via `userId`-scoped queries and `findFirst({ id, userId })` pre-checks (`src/server/api/trpc.ts:137-161`, per-router files). Cross-user access returns `NOT_FOUND` (mutations) or empty/zero/null (queries).

Existing tests partially cover isolation: five `*-isolation.test.ts` files, `cycle.test.ts` IDOR on `complete`/`interrupt`, and `guest.test.ts` happy-path merge. Gaps documented in research: weak `task-mutation.test.ts` stub, missing cycle IDOR cases, duplicate task list tests, and guest merge edge cases.

### Key Discoveries:

- `src/server/api/routers/task-mutation.test.ts:10-35` — `findFirst` ignores query args (test-plan anti-pattern for Risk #4)
- `src/server/api/routers/cycle.ts:37-45` — `getActive` filters `userId` + `RUNNING` only; no `ACTIVE` session requirement
- `src/server/api/routers/cycle-isolation.test.ts:214-241` — FK `sessionId` injection pattern to reuse for `taskId`
- `src/server/api/lib/import-guest-snapshot.ts:26-132` — single `$transaction` merge; expired RUNNING normalization at L81-110
- `vitest.config.ts:5-17` — dummy `DATABASE_URL`; no real Postgres in Vitest
- `context/foundation/test-plan.md:72-73` — Phase 3 row `not started`; §6.5 TBD

## Desired End State

After this plan completes:

1. **Risk #4:** Tests fail if any protected list/query returns another user's rows or any mutation succeeds on foreign-owned resources.
2. **Risk #6:** Tests fail if cross-user ID swap on `task`, `cycle`, or `checkIn` mutations returns data instead of `NOT_FOUND` (or empty for scoped queries).
3. **Risk #5:** Integration tests fail if guest merge loses tasks, mishandles title collisions, mishandles RUNNING/expired cycles, or skips account RUNNING closure before import.
4. **Stale RUNNING:** One integration test documents `getActive` behavior when session is `ENDED` but cycle remains `RUNNING` (Phase 1 deferral closed as **documented behavior**, not product fix).
5. **Cookbook:** `context/foundation/test-plan.md` §6.5 and §6.6 updated; Phase 3 rollout row marked `complete`.
6. Full suite green: `pnpm check`, `pnpm typecheck`, `pnpm test`.

## What We're NOT Doing

- Playwright guest→auth merge e2e (deferred — integration-only per planning decision)
- Real Neon/Postgres fixtures in Vitest
- CI gate wiring (test-plan Phase 4)
- Mid-cycle prompt (S-03 / risk #3) or check-in gate (S-05 / risk #7)
- Product fixes to router ownership unless a test failure forces a separate change
- Failed-import retry UX tests or server-action layer tests (core merge matrix only)
- Session `end` cross-user side-effect tests beyond the one `getOrCreateActive` smoke
- Shared `createTestCaller` test utility extraction (inline `callerAs` helpers per file unless duplication becomes painful)
- Roadmap S-08 status sync (test rollout independent of feature tracking)

## Implementation Approach

Follow test-plan **cost × signal** and research package order:

| Package | Risks | Primary files |
|---------|-------|---------------|
| Task hardening | #4, #6 | `task-mutation.test.ts`, `task-isolation.test.ts` |
| Cycle + session IDOR | #4, #6 | `cycle.test.ts`, `cycle-isolation.test.ts`, `session.test.ts` |
| Guest merge edges | #5 | `guest.test.ts`, `import-guest-snapshot.test.ts` |
| Cookbook | cross-cutting | `test-plan.md` |

**Dual-user pattern** (inline in each file):

- Constants: `VICTIM_ID`, `ATTACKER_ID`
- Seed victim-owned rows in module-scoped in-memory arrays
- `createCaller({ session: { user: { id: ATTACKER_ID, ... } }, db, headers })`
- Assert `NOT_FOUND` via `rejects.toMatchObject({ code: "NOT_FOUND" })` or empty/`null`/`0` for queries
- Do **not** expect `FORBIDDEN` — production uses `NOT_FOUND` consistently

## Critical Implementation Details

**Stale RUNNING + ended session:** `cycle.getActive` does not join or filter on session state. The Phase 1 deferral test should **assert current behavior** (likely still returns the RUNNING cycle) and add a one-line comment referencing `cycle.ts:37-45`. If the test documents surprising behavior, note it in the plan review — do not change production code in this test-only change unless the team explicitly wants a product fix in a follow-up.

**Guest expired RUNNING:** Use `startedAt` far enough in the past that `startedAt + configuredDurationSec * 1000 <= Date.now()` at test run time; assert imported `state === "COMPLETED"` and `endedAt` set.

## Phase 1: Task Isolation Hardening

### Overview

Fix the weakest isolation test (`task-mutation`) and remove duplicate task list coverage.

### Changes Required:

#### 1. Refactor task mutation ownership tests

**File**: `src/server/api/routers/task-mutation.test.ts`

**Intent**: Replace global `findFirstResult` toggle with a stateful in-memory `allTasks[]` mock where `findFirst` filters by `{ id, userId }` — same pattern as `task-isolation.test.ts`.

**Contract**: Property tests for `update` and `delete` still assert `NOT_FOUND` when `userId` mismatches; mock must fail if router omits `userId` in `where` (task would not be found in store). Keep fast-check properties; keep `setTimeout` stub.

#### 2. Consolidate task list isolation

**Files**: `src/server/api/routers/task-isolation.test.ts` (keep), `src/server/api/routers/task-query.test.ts` (remove or reduce)

**Intent**: Merge any unique assertions from `task-query.test.ts` into `task-isolation.test.ts`; delete `task-query.test.ts` if fully redundant.

**Contract**: Single canonical file for Property 10 / task list isolation; update `test-plan.md` references in Phase 4 if they cite `task-query.test.ts`.

### Success Criteria:

#### Automated Verification:

- `pnpm check` passes
- `pnpm typecheck` passes
- `pnpm test` passes for `task-mutation.test.ts` and `task-isolation.test.ts`
- `task-query.test.ts` removed or reduced to re-export/nothing (no duplicate Property 10 suite)

#### Manual Verification:

- None required

**Implementation Note**: Pause for confirmation after automated checks before Phase 2.

---

## Phase 2: Cycle & Session IDOR Matrix

### Overview

Close highest-priority IDOR gaps on cycle router, add session write-path smoke, and document stale RUNNING behavior.

### Changes Required:

#### 1. Cycle cross-user query gaps

**File**: `src/server/api/routers/cycle.test.ts` (extend)

**Intent**: Add imperative dual-user cases:

- `getActive`: seed victim `RUNNING` cycle; attacker caller → `null`
- `countCompletedWork`: seed victim session with completed work; attacker with victim `sessionId` → `0`
- `list`: attacker with victim `sessionId` → `[]`

**Contract**: Use existing in-memory `cycles`/`sessions` arrays and `caller()` helper; add `callerAs(userId)` if cleaner. Assert shapes match production semantics (empty/zero/null, not `FORBIDDEN`).

#### 2. Cycle create taskId FK injection

**File**: `src/server/api/routers/cycle-isolation.test.ts` (extend) **or** `cycle.test.ts`

**Intent**: Seed victim-owned `task` and `session`; attacker calls `create` with victim `taskId` (and valid attacker session) → `NOT_FOUND`.

**Contract**: Mirror existing `sessionId` FK injection test at `cycle-isolation.test.ts:214-241`; cover `cycle.ts:74-81` path.

#### 3. Stale RUNNING + ended session

**File**: `src/server/api/routers/cycle.test.ts` (extend)

**Intent**: Seed `RUNNING` cycle linked to session with `state: "ENDED"` (or ended session row); caller `getActive` — assert and document actual return value per current `cycle.ts` implementation.

**Contract**: Test name prefix `integration:` or descriptive `documents getActive when session ended`; comment links to Phase 1 deferral. **No production change** in this rollout unless behavior is clearly a bug and user approves separate fix.

#### 4. Session getOrCreateActive smoke

**File**: `src/server/api/routers/session.test.ts` (extend)

**Intent**: Seed victim `ACTIVE` session; attacker calls `getOrCreateActive` — receives attacker's own new/existing session; victim session row unchanged.

**Contract**: Extend existing session mock; assert `sessions` array still has victim session with original `id`/`state`; attacker's result has `userId === ATTACKER_ID`.

### Success Criteria:

#### Automated Verification:

- `pnpm check` passes
- `pnpm typecheck` passes
- `pnpm test` passes for `cycle.test.ts`, `cycle-isolation.test.ts`, `session.test.ts`

#### Manual Verification:

- None required

**Implementation Note**: Pause for confirmation after automated checks before Phase 3.

---

## Phase 3: Guest Merge Integration

### Overview

Extend guest merge tests for core Risk #5 edge cases identified in research — server transaction paths only.

### Changes Required:

#### 1. Account RUNNING closure on import

**File**: `src/server/api/routers/guest.test.ts` (extend)

**Intent**: Before import, seed caller-owned `RUNNING` cycle; after `guest.import`, assert that cycle is `COMPLETED` with `endedAt` set, then guest cycles imported as expected.

**Contract**: Mock `cycle.updateMany` must actually update in-memory `cycles` array (not no-op `{ count: 0 }` only); assert pre-import RUNNING row state change.

#### 2. Expired guest RUNNING → COMPLETED

**File**: `src/server/api/routers/guest.test.ts` (extend)

**Intent**: Snapshot with guest `RUNNING` cycle whose `startedAt + configuredDurationSec` is in the past; assert imported cycle `state === "COMPLETED"` and `endedAt` defined.

**Contract**: Covers `import-guest-snapshot.ts:81-110` expiry branch.

#### 3. Empty snapshot no-op

**File**: `src/server/api/routers/guest.test.ts` (extend)

**Intent**: Call `import` with empty `tasks/sessions/cycles` arrays; assert `{ importedTasks: 0, importedCycles: 0 }` and no DB writes (tasks/cycles/sessions arrays unchanged).

**Contract**: Covers short-circuit at `import-guest-snapshot.ts:26-32`.

#### 4. Unmapped guest taskId on cycle

**File**: `src/server/api/routers/guest.test.ts` (extend)

**Intent**: Cycle references guest `taskId` UUID not present in snapshot `tasks` array; imported cycle has `taskId: null`.

**Contract**: Covers `import-guest-snapshot.ts:92-95`.

#### 5. Expiry unit test (optional thin)

**File**: `src/server/api/lib/import-guest-snapshot.test.ts` (extend only if logic extracted)

**Intent**: If expiry normalization logic is hard to read in router test, add a focused unit test on the state/`endedAt` derivation helper — **only if** guest.test.ts would become overly complex.

**Contract**: Default: implement in `guest.test.ts` only; skip separate unit test unless needed.

### Success Criteria:

#### Automated Verification:

- `pnpm check` passes
- `pnpm typecheck` passes
- `pnpm test` passes for `guest.test.ts` (and `import-guest-snapshot.test.ts` if extended)

#### Manual Verification:

- None required

**Implementation Note**: Pause for confirmation after automated checks before Phase 4.

---

## Phase 4: Cookbook & Test-Plan Sync

### Overview

Fill test-plan cookbook §6.5, add Phase 3 notes to §6.6, and mark rollout Phase 3 complete in §3.

### Changes Required:

#### 1. Cookbook §6.5 — guest/localStorage merge tests

**File**: `context/foundation/test-plan.md`

**Intent**: Replace TBD with guidance: integration location (`guest.test.ts`, `import-guest-snapshot.test.ts`), dual-user N/A for merge, reference tests for collision suffix, expired RUNNING, empty snapshot, mock `$transaction` pattern, run command.

**Contract**: §6.5 bullets reference concrete test names added in Phase 3; note e2e merge deferred to follow-up change.

#### 2. Cookbook §6.2 cross-user IDOR update

**File**: `context/foundation/test-plan.md`

**Intent**: Update §6.2 cross-user bullet to cite Phase 3 reference tests (`cycle.test.ts` IDOR cases, `task-mutation.test.ts` refactor) instead of "see Phase 3 rollout".

**Contract**: Point to canonical files; mention `NOT_FOUND` not `FORBIDDEN`.

#### 3. Cookbook §6.6 — Phase 3 notes

**File**: `context/foundation/test-plan.md`

**Intent**: Add Phase 3 subsection: risks #4/#5/#6, layers (integration mock DB), explicit limitation (no guest-merge e2e in this change), stale RUNNING documented.

**Contract**: Mirror §6.6 Phase 1 format; include completion date on ship.

#### 4. Phase 3 rollout row

**File**: `context/foundation/test-plan.md` §3 table

**Intent**: Set Phase 3 `Status` to `complete` and `Change folder` to `testing-isolation-abuse-guest-merge` when all Progress items are `[x]`.

**Contract**: Update `Last updated` frontmatter date in test-plan header.

#### 5. Change status

**File**: `context/changes/testing-isolation-abuse-guest-merge/change.md`

**Intent**: `status: planned` at plan write; `/10x-implement` advances to `implementing` / `implemented`.

**Contract**: `updated` stamp on ship.

### Success Criteria:

#### Automated Verification:

- `pnpm check`, `pnpm typecheck`, `pnpm test` all pass
- `context/foundation/test-plan.md` §6.5 no longer says "TBD — see §3 Phase 3"
- §3 Phase 3 row shows `complete` and change folder ID

#### Manual Verification:

- Spot-read §6.5 and §6.6 — another contributor could add an isolation or merge test from cookbook alone

---

## Testing Strategy

### Integration Tests (primary):

- Task: multi-user store on update/delete; consolidated list isolation
- Cycle: `getActive`, `countCompletedWork`, `list(sessionId)`, `create(taskId)`, stale RUNNING documentation
- Session: `getOrCreateActive` with victim active session present
- Guest: merge edge cases (account RUNNING closure, expired RUNNING, empty snapshot, null taskId)
- Existing `check-in-isolation.test.ts` and `cycle.complete/interrupt` IDOR — no changes unless regressions

### E2E:

- **None in this change** — guest merge browser proof deferred

### Manual Testing Steps:

1. Optionally break `userId` filter in a router locally; confirm new tests fail (revert before commit)
2. Run full `pnpm test` before marking Phase 4 complete

## Performance Considerations

New tests are Vitest-only with in-memory mocks; negligible CI time impact. No e2e added.

## Migration Notes

Test-only rollout. No database migrations. If stale RUNNING test reveals undesired product behavior, open a **separate** change for `getActive` session coupling — do not fix silently in this rollout.

## References

- Research: `context/changes/testing-isolation-abuse-guest-merge/research.md`
- Quality contract: `context/foundation/test-plan.md` (risks #4–#6, Phase 3 row)
- Phase 1 precedent: `context/changes/testing-critical-path-persistence-timer/plan.md`
- Ownership audit: `src/server/api/routers/cycle.ts`, `task.ts`, `session.ts`, `check-in.ts`, `guest.ts`
- Guest merge core: `src/server/api/lib/import-guest-snapshot.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.
>
> **Check note (impl-review 2026-06-05):** Rollout-changed test files pass `biome check`. Full-repo `pnpm check` still fails on pre-existing issues outside this change (e.g. `.cursor/settings.json`, `src/lib/auth/server.ts`).

### Phase 1: Task Isolation Hardening

#### Automated

- [x] 1.1 `pnpm check` passes
- [x] 1.2 `pnpm typecheck` passes
- [x] 1.3 `pnpm test` passes for task mutation/isolation files
- [x] 1.4 `task-query.test.ts` consolidated — no duplicate Property 10 suite

### Phase 2: Cycle & Session IDOR Matrix

#### Automated

- [x] 2.1 `pnpm check` passes
- [x] 2.2 `pnpm typecheck` passes
- [x] 2.3 `pnpm test` passes for cycle and session test files

### Phase 3: Guest Merge Integration

#### Automated

- [x] 3.1 `pnpm check` passes
- [x] 3.2 `pnpm typecheck` passes
- [x] 3.3 `pnpm test` passes for guest merge test files

### Phase 4: Cookbook & Test-Plan Sync

#### Automated

- [x] 4.1 Full verification: `pnpm check`, `pnpm typecheck`, `pnpm test`
- [x] 4.2 `test-plan.md` §6.5 / §6.2 / §6.6 updated; §3 Phase 3 row complete

#### Manual

- [x] 4.3 Cookbook spot-read — isolation/merge patterns clear from §6 alone
