# Risk #7 Check-In Persistence — Integration Test Rollout

## Overview

Ship integration test coverage for **test-plan Risk #7** (energy check-in persists and is readable for the next suggestion) at the cheapest layer: Vitest + in-memory Prisma mocks + `createCaller`. This is an **ad-hoc test rollout** tied to roadmap **S-05** / **S-06** substrate — not a numbered row in test-plan §3.

**Tests and cookbook documentation only** — no product, schema, or UI changes unless a failing test exposes a separate bug. Playwright check-in gate proof stays in test-plan **Phase 2** (e2e risks #3/#7).

## Current State Analysis

The check-in router exposes two procedures (`list`, `create`) with ownership via `userId` filter and `cycle.findFirst({ id, userId })` (`src/server/api/routers/check-in.ts`). Schema enforces one check-in per cycle (`cycleId @unique`); duplicate create maps `P2002` → `CONFLICT`.

`check-in-isolation.test.ts` already covers list isolation, cross-user `cycleId` injection (`NOT_FOUND`), double-create (`CONFLICT`), and empty-list cases via fast-check properties. It does **not** exercise `create → list` round-trips or list query semantics.

### Key Discoveries:

- `check-in-isolation.test.ts:37-43` — mock `findMany` ignores `orderBy` and `take`; router passes both (`check-in.ts:8-13`)
- `check-in-isolation.test.ts` seeds `allCheckIns` directly for list tests — never asserts persisted `energy` after `create`
- No client/UI references to `checkIn` in `src/` yet — integration is the only pre-S-05 automated signal
- `DEFAULT_LIST_LIMIT` = 100 (`src/server/api/config.ts:4`)
- Phase 3 precedent: imperative tests in dedicated `*.test.ts`; security properties stay in `*-isolation.test.ts`

## Desired End State

After this plan completes:

1. **Risk #7 (integration slice):** Tests fail if `checkIn.create` does not persist `energy`/`cycleId`/`userId` or if `checkIn.list` does not return created rows for the caller.
2. **Ordering contract:** Tests fail if `list` stops sorting by `respondedAt desc` (newest first when mock honors `orderBy`).
3. **Limit contract:** Tests fail if `list` returns more than `DEFAULT_LIST_LIMIT` rows when store has >100 check-ins.
4. **Enum coverage:** All three `EnergyLevel` values round-trip through create → list.
5. **Cookbook:** `test-plan.md` §6.2 references persistence tests; §6.6 notes this ad-hoc rollout (Risk #7 integration, e2e gate deferred).
6. Full suite green: `pnpm typecheck`, `pnpm test`; rollout-changed files pass `biome check` (full-repo `pnpm check` pre-existing debt documented if needed).

## What We're NOT Doing

- Playwright check-in modal / skip-prevention (test-plan Phase 2)
- Real Neon/Postgres Vitest fixtures
- Duplicating isolation/IDOR/CONFLICT property tests already in `check-in-isolation.test.ts`
- S-06 scoring formula or suggestion UI tests
- Guest check-in paths (PRD excludes check-ins from guest slice)
- Cycle-complete → check-in chained flow (no UI; direct create/list is sufficient signal)
- test-plan §3 rollout table row (ad-hoc Risk #7 slice — document in §6.6 only)
- Shared mock extraction module (inline mock in `check-in.test.ts` unless duplication becomes painful)
- Product/router fixes unless test failure forces a separate change

## Implementation Approach

| Package | Focus | Primary file |
|---------|-------|--------------|
| Persistence integration | Risk #7 create/list contract | `check-in.test.ts` (new) |
| Cookbook | Contributor guidance | `test-plan.md` §6.2, §6.6 |

**Imperative test pattern** (mirror `session.test.ts`, `guest.test.ts`):

- Module-scoped `allCycles[]`, `allCheckIns[]`, `checkInCycleIds` Set
- Mock `findMany` filters by `userId`, sorts `respondedAt desc`, applies `take`
- Mock `create` enforces unique `cycleId` (P2002) — needed for store integrity but **do not re-test CONFLICT** (isolation file owns that)
- `createCallerFactory(checkInRouter)` + `setTimeout` stub
- Seed owned cycle before each `create`; assert return shape then `list` contents

## Critical Implementation Details

**Mock `findMany` must honor router call shape:** Production passes `{ where: { userId }, orderBy: { respondedAt: "desc" }, take: DEFAULT_LIST_LIMIT }`. Tests for ordering and limit are meaningless if the mock ignores these args — implement sort + slice in the new file's mock only (leave isolation file unchanged to avoid scope creep).

**Limit test seeding:** Pre-seed 101 check-ins for one user with distinct `respondedAt` timestamps; call `list()`; assert `result.length === 100` and that the omitted row is the oldest (validates desc sort + take together).

**Do not duplicate isolation tests:** `NOT_FOUND`, `CONFLICT`, and cross-user list filtering remain the responsibility of `check-in-isolation.test.ts`.

## Phase 1: Check-In Persistence Integration Tests

### Overview

Add `check-in.test.ts` with imperative integration cases for Risk #7 server persistence contract.

### Changes Required:

#### 1. New persistence integration test file

**File**: `src/server/api/routers/check-in.test.ts`

**Intent**: Imperative Vitest tests proving `create` persists declared energy and `list` returns it for the authenticated user — the server contract S-05/S-06 will depend on.

**Contract**:

- `create` happy path: seed owned cycle; call `create({ cycleId, energy })`; assert returned `{ cycleId, userId, energy }` matches input and `respondedAt` is defined
- `create → list` round-trip: after create, `list()` contains exactly one row with matching `energy` and `cycleId`
- All three energies: parameterized or three `it` blocks for `FOCUSED`, `STEADY`, `FADING` — each round-trips via create → list
- Multiple check-ins ordering: two cycles, two creates with distinct `respondedAt` (control via mock or small delay); `list()` returns newest first (`result[0].cycleId` matches later create)
- `DEFAULT_LIST_LIMIT`: seed 101 check-ins for caller; `list()` length === 100; newest row present, oldest absent

Mock requirements in this file only:

- `cycle.findFirst` filters `{ id, userId }`
- `checkIn.create` appends to `allCheckIns`, enforces unique `cycleId`
- `checkIn.findMany` filters by `userId`, sorts `respondedAt desc`, applies `take` when present

### Success Criteria:

#### Automated Verification:

- `pnpm typecheck` passes
- Rollout-changed files pass `pnpm exec biome check src/server/api/routers/check-in.test.ts`
- `pnpm exec vitest run src/server/api/routers/check-in.test.ts` passes
- `pnpm test` full suite passes
- No changes to `check-in-isolation.test.ts` (isolation properties remain green unchanged)

#### Manual Verification:

- None required

**Implementation Note**: Pause for confirmation after automated checks before Phase 2.

---

## Phase 2: Cookbook & Test-Plan Sync

### Overview

Document check-in persistence integration patterns for future contributors; record ad-hoc Risk #7 rollout in §6.6.

### Changes Required:

#### 1. Extend §6.2 tRPC integration bullet

**File**: `context/foundation/test-plan.md`

**Intent**: Add Risk #7 persistence references alongside existing isolation/IDOR bullets — point to `check-in.test.ts` for create→list contract and `check-in-isolation.test.ts` for security properties.

**Contract**: §6.2 mentions check-in persistence tests by file and test names added in Phase 1; clarify UI gate remains Phase 2 e2e.

#### 2. Add §6.6 ad-hoc rollout note

**File**: `context/foundation/test-plan.md`

**Intent**: New subsection (after Phase 3 note): **Risk #7 integration — check-in persistence** with change folder `testing-check-in-persistence`, date, layers, explicit limitation (no modal gate e2e).

**Contract**: Mirror Phase 1/3 §6.6 format; update `Last updated` frontmatter date.

#### 3. Change status on ship

**File**: `context/changes/testing-check-in-persistence/change.md`

**Intent**: `/10x-implement` advances `implementing` → `implemented`; stamp `updated` on ship.

**Contract**: No §3 table row added.

### Success Criteria:

#### Automated Verification:

- `pnpm typecheck`, `pnpm test` all pass
- `test-plan.md` §6.2 references `check-in.test.ts`; §6.6 contains Risk #7 ad-hoc note

#### Manual Verification:

- Spot-read §6.2 check-in bullet — another contributor could add a persistence case from cookbook alone

---

## Testing Strategy

### Integration Tests (primary):

- `check-in.test.ts`: create return shape, create→list, three energies, multi-row ordering, list limit
- Existing `check-in-isolation.test.ts`: unchanged; run in full suite for regression

### E2E:

- **None in this change** — check-in modal gate deferred to test-plan Phase 2

### Manual Testing Steps:

1. Optionally break `energy` field mapping in router locally; confirm new tests fail (revert before commit)
2. Run full `pnpm test` before marking Phase 2 complete

## Performance Considerations

Vitest-only in-memory mocks; negligible CI impact.

## Migration Notes

Test-only rollout. No database migrations.

## References

- Research: `context/changes/testing-check-in-persistence/research.md`
- Quality contract: `context/foundation/test-plan.md` (Risk #7, Phase 2 deferral)
- Phase 3 precedent: `context/changes/testing-isolation-abuse-guest-merge/plan.md`
- Router: `src/server/api/routers/check-in.ts`
- Isolation tests: `src/server/api/routers/check-in-isolation.test.ts`
- Imperative pattern: `src/server/api/routers/session.test.ts`, `guest.test.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Check-In Persistence Integration Tests

#### Automated

- [x] 1.1 `pnpm typecheck` passes — 3fbd851
- [x] 1.2 Biome check passes on `check-in.test.ts` — 3fbd851
- [x] 1.3 `pnpm exec vitest run src/server/api/routers/check-in.test.ts` passes — 3fbd851
- [x] 1.4 Full `pnpm test` passes; isolation file unchanged — 3fbd851

### Phase 2: Cookbook & Test-Plan Sync

#### Automated

- [x] 2.1 Full verification: `pnpm typecheck`, `pnpm test` — 82b5aa5
- [x] 2.2 `test-plan.md` §6.2 and §6.6 updated — 82b5aa5

#### Manual

- [x] 2.3 Cookbook spot-read — check-in persistence pattern clear from §6 alone — 82b5aa5
