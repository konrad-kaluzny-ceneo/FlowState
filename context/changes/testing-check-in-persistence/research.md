---
date: 2026-06-05T16:00:00+02:00
researcher: Cursor Agent (Auto)
git_commit: b478ad78486f30ea47f25cbdbae781d541f188ec
branch: features/testing-isolation-abuse-guest-merge
repository: FlowState
topic: "Risk #7 — check-in persistence (integration layer, no e2e)"
tags: [research, codebase, check-in, persistence, trpc, integration, test-plan, risk-7, s-05]
status: complete
last_updated: 2026-06-05
last_updated_by: Cursor Agent (Auto)
---

# Research: Risk #7 — check-in persistence (integration layer, no e2e)

**Date**: 2026-06-05T16:00:00+02:00  
**Researcher**: Cursor Agent (Auto)  
**Git Commit**: [`b478ad7`](https://github.com/konrad-kaluzny-ceneo/FlowState/commit/b478ad78486f30ea47f25cbdbae781d541f188ec)  
**Branch**: `features/testing-isolation-abuse-guest-merge`  
**Repository**: [konrad-kaluzny-ceneo/FlowState](https://github.com/konrad-kaluzny-ceneo/FlowState)

## Research Question

Ground `testing-check-in-persistence` for **test-plan Risk #7**: end-of-cycle energy check-in persists and is readable for the next suggestion. User constraint: **integration only** — no Playwright e2e (Phase 2 test-plan covers UI gate separately).

Research must locate where failures would live, what tests already exist, and the smallest high-signal gap to close before S-05 UI and S-06 scoring land.

## Summary

**Production surface is tiny and stable.** The check-in router exposes exactly two protected procedures — `list` and `create` — backed by a `CheckIn` model with a **unique `cycleId`** constraint. Ownership is enforced via `userId` on list and `cycle.findFirst({ id, userId })` before create; duplicate check-ins map Prisma `P2002` → `CONFLICT`.

**Isolation/IDOR signal already exists.** `check-in-isolation.test.ts` covers list isolation, cross-user `cycleId` injection (`NOT_FOUND`), double-create (`CONFLICT`), and empty-list edge cases — all via fast-check properties with in-memory mocks (same pattern as Phase 3).

**Risk #7 persistence gap is narrower than Phase 3.** What's missing is not security but **contract proof**: imperative `create → list` round-trips that assert `energy` survives for all three enum values, `userId`/`cycleId` stamping, and list query semantics (`orderBy: respondedAt desc`, `take: DEFAULT_LIST_LIMIT`). The current mock `findMany` ignores `orderBy`/`take`, so list ordering/limit behavior is untested even though the router passes them.

**No client/UI consumer yet.** No React components, hooks, or tRPC client calls reference `checkIn` outside the server router and isolation tests. S-05 (`end-of-cycle-checkin`) is `active` on the roadmap but UI is not in `src/`. S-06 suggestion logic does not read check-ins yet. Integration tests should target the **server persistence contract** S-05/S-06 will depend on — not the modal gate (e2e Phase 2).

**Recommended `/10x-plan` scope:** add imperative integration tests (new `check-in.test.ts` or a `describe("integration:")` block), enhance the in-memory mock to honor `orderBy` + `take`, document patterns in `test-plan.md` §6 (cookbook addendum). Defer UI skip-prevention e2e to test-plan Phase 2. No real Neon fixtures; no product changes unless a test exposes a defect.

## Detailed Findings

### Risk #7 — test-plan framing

From [`context/foundation/test-plan.md`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/b478ad7/context/foundation/test-plan.md#L48-L60):

| Aspect | Guidance |
|--------|----------|
| Failure scenario | Check-in skipped or declared energy fails to persist for next suggestion |
| Cheapest layer (now) | **Integration for persistence** until S-05 UI lands |
| Later layer | Playwright e2e once S-05 UI exists (test-plan Phase 2, risks #3 + #7) |
| Anti-pattern | Snapshot of check-in modal without asserting gate blocks transition |

This change covers the **integration-for-persistence** slice only. UI gate proof stays in Phase 2.

Roadmap link: **S-05** (`end-of-cycle-checkin`, `active`) — FR-020; **S-06** (`adaptive-task-suggestion`, `proposed`) will consume stored check-ins once both land.

---

### Production code — check-in router

[`src/server/api/routers/check-in.ts`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/b478ad7/src/server/api/routers/check-in.ts)

| Procedure | Behavior | Risk #7 relevance |
|-----------|----------|-------------------|
| `list` | `findMany({ where: { userId }, orderBy: { respondedAt: "desc" }, take: 100 })` | Readable history for suggestion input |
| `create` | Validates owned `cycleId`; inserts `{ cycleId, userId, energy }`; `P2002` → `CONFLICT` | Persists declared energy per completed cycle |

Key lines:

- List scoping + ordering: [`check-in.ts:8-13`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/b478ad7/src/server/api/routers/check-in.ts#L8-L13)
- Create ownership guard: [`check-in.ts:25-31`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/b478ad7/src/server/api/routers/check-in.ts#L25-L31)
- Uniqueness / conflict mapping: [`check-in.ts:33-52`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/b478ad7/src/server/api/routers/check-in.ts#L33-L52)

`DEFAULT_LIST_LIMIT` = 100 ([`src/server/api/config.ts:4`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/b478ad7/src/server/api/config.ts#L4)).

Router mounted at `checkIn` in [`src/server/api/root.ts:17`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/b478ad7/src/server/api/root.ts#L17).

---

### Data model

[`prisma/schema.prisma`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/b478ad7/prisma/schema.prisma)

```prisma
enum EnergyLevel { FOCUSED STEADY FADING }

model CheckIn {
  id          Int         @id @default(autoincrement())
  cycleId     Int         @unique @map("cycle_id")
  userId      String      @map("user_id")
  energy      EnergyLevel
  respondedAt DateTime    @default(now())
  cycle       Cycle       @relation(...)
}
```

- **One check-in per cycle** — enforced by `@unique` on `cycleId` and router `CONFLICT` handling.
- **Cascade** on cycle delete — check-in removed with cycle.
- **No sessionId on CheckIn** — linkage is cycle → session; S-06 must join via cycle if session-scoped history is needed.

PRD FR-020 ([`context/foundation/prd.md`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/b478ad7/context/foundation/prd.md)): three energy states after each cycle; guest mode explicitly excludes check-ins in MVP guest slice.

---

### Existing test coverage

**File:** [`src/server/api/routers/check-in-isolation.test.ts`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/b478ad7/src/server/api/routers/check-in-isolation.test.ts) (283 lines)

| Test (fast-check property) | What it proves | Risk #7 persistence? |
|----------------------------|----------------|----------------------|
| each user only sees their own check-ins | `list` filters by `userId` | Partial — seeds DB directly, never calls `create` |
| cross-user FK injection on create | Foreign `cycleId` → `NOT_FOUND` | IDOR (#6), not persistence |
| double-create on same cycle | Second create → `CONFLICT` | Integrity, not energy round-trip |
| user with no check-ins gets empty result | Empty `list` | Edge case only |

**Mock limitations relevant to persistence:**

1. `findMany` ([`check-in-isolation.test.ts:37-43`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/b478ad7/src/server/api/routers/check-in-isolation.test.ts#L37-L43)) filters by `userId` only — **does not sort by `respondedAt desc` or apply `take`**.
2. `create` mock sets `respondedAt: new Date()` but no test asserts it on the returned row or in subsequent `list`.
3. Successful `create` is exercised only as setup for CONFLICT test — **no assertion that returned `energy` matches input** or appears in `list`.

Phase 3 research ([`testing-isolation-abuse-guest-merge/research.md`](context/changes/testing-isolation-abuse-guest-merge/research.md)) marked `checkIn.list` and `checkIn.create` IDOR as covered — accurate for risks #4/#6, not for #7 persistence contract.

**No other check-in test files** under `src/` or `e2e/`.

---

### Client / UI layer (absent)

Grep across `src/` finds **zero** client references to `checkIn` procedures. No check-in modal, hook, or page component exists yet.

Implications:

- Integration tests are the only automated signal available pre-S-05.
- Tests should assert **API contract** (fields S-06 will query), not UI copy or modal behavior.
- When S-05 lands, Phase 2 e2e should assert gate + persistence together; this rollout avoids duplicating gate tests.

---

### Recommended test matrix (integration)

Priority ordered by signal × cost:

| # | Scenario | Assert | Why |
|---|----------|--------|-----|
| 1 | `create` happy path | Returns `{ cycleId, userId, energy }` matching input | Core persistence write |
| 2 | `create` → `list` round-trip | `list` contains row with same `energy` and `cycleId` | Risk #7 “readable for next suggestion” |
| 3 | All three energies | `FOCUSED`, `STEADY`, `FADING` each round-trip | Enum coverage / zod contract |
| 4 | Multiple cycles in session | Two creates, `list` returns both newest-first | Exercises ordering contract |
| 5 | `list` limit smoke | Mock with >100 rows, `take: 100` honored | Guards DEFAULT_LIST_LIMIT wiring |
| 6 | `create` without owned cycle | `NOT_FOUND` | Already in isolation — **do not duplicate** |
| 7 | Duplicate `create` | `CONFLICT` | Already in isolation — **do not duplicate** |

**Mock enhancement required for #4–#5:** extend `findMany` to:

```typescript
// Pseudocode — mirror production call shape
let rows = allCheckIns.filter(c => c.userId === userId);
rows.sort((a, b) => b.respondedAt.getTime() - a.respondedAt.getTime());
if (args.take) rows = rows.slice(0, args.take);
```

Reference imperative pattern: [`session.test.ts`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/b478ad7/src/server/api/routers/session.test.ts) (`describe` + `it`, module-scoped arrays, `beforeEach` reset).

**File placement options:**

- **A (recommended):** new `check-in.test.ts` for imperative persistence; keep `check-in-isolation.test.ts` for fast-check security properties.
- **B:** add `describe("integration: check-in persistence")` inside isolation file — works but mixes two test styles (Phase 3 kept them separate per router concern).

---

### What We're NOT Doing (scope guardrails)

Aligned with test-plan Phase 2 boundary and Phase 3 precedent:

- Playwright / check-in modal gate / keyboard skip (Phase 2 e2e)
- Real Neon/Postgres Vitest fixtures
- S-06 scoring formula tests (blocked on S-04 + S-05 product slices)
- Cross-user isolation re-tests (already in isolation file)
- Cycle-complete → check-in **UI flow** (no UI yet); optional thin `integration: complete cycle then checkIn.create` only if mock shares cycle store cleanly — low priority vs direct create/list

---

### Vitest infrastructure (unchanged)

- [`vitest.config.ts`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/b478ad7/vitest.config.ts) — jsdom, dummy `DATABASE_URL`, `e2e/**` excluded.
- Pattern: `vi.mock("~/server/db/index")` + `createCallerFactory(checkInRouter)` + setTimeout stub (timing middleware).
- Verification: `pnpm test`, scoped `pnpm exec vitest run src/server/api/routers/check-in.test.ts`.

---

## Code References

- [`src/server/api/routers/check-in.ts:8-54`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/b478ad7/src/server/api/routers/check-in.ts#L8-L54) — list + create procedures
- [`src/server/api/routers/check-in-isolation.test.ts:37-90`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/b478ad7/src/server/api/routers/check-in-isolation.test.ts#L37-L90) — mock DB (needs orderBy/take for persistence tests)
- [`src/server/api/routers/check-in-isolation.test.ts:215-240`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/b478ad7/src/server/api/routers/check-in-isolation.test.ts#L215-L240) — existing CONFLICT property (do not duplicate)
- [`prisma/schema.prisma:18-22`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/b478ad7/prisma/schema.prisma#L18-L22) — `EnergyLevel` enum
- [`prisma/schema.prisma:100-111`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/b478ad7/prisma/schema.prisma#L100-L111) — `CheckIn` model + unique `cycleId`
- [`src/server/api/config.ts:4`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/b478ad7/src/server/api/config.ts#L4) — `DEFAULT_LIST_LIMIT`
- [`context/foundation/test-plan.md:48-60`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/b478ad7/context/foundation/test-plan.md#L48-L60) — Risk #7 response guidance

## Architecture Insights

1. **Check-in is cycle-scoped, not session-scoped** — one row per completed work cycle. S-06 suggestion logic will likely read latest check-in(s) via `checkIn.list` or a future targeted query; list ordering by `respondedAt desc` is load-bearing.
2. **Security vs persistence split** — Phase 3 pattern: fast-check properties for isolation/IDOR; imperative tests for business contracts (see `guest.test.ts`, `session.test.ts`, `cycle.test.ts` IDOR block).
3. **Error semantics** — `NOT_FOUND` for foreign/missing cycle; `CONFLICT` for duplicate cycle check-in; matches rest of API (not `FORBIDDEN`).
4. **No guest check-ins** — guest trial path does not include check-in persistence; tests need authenticated caller only.

## Historical Context (from prior changes)

- [`context/changes/testing-isolation-abuse-guest-merge/research.md`](context/changes/testing-isolation-abuse-guest-merge/research.md) — catalogued `checkIn` ownership; marked list + create IDOR covered; did not address Risk #7 persistence round-trip.
- [`context/changes/testing-isolation-abuse-guest-merge/plan-brief.md`](context/changes/testing-isolation-abuse-guest-merge/plan-brief.md) — explicitly excluded risks #3/#7 from Phase 3 scope (deferred to Phase 2 e2e for UI aspects).
- [`context/changes/testing-critical-path-persistence-timer/`](context/changes/testing-critical-path-persistence-timer/) — Phase 1 precedent for in-memory mocks + cookbook §6 updates.

## Related Research

- [`context/changes/testing-isolation-abuse-guest-merge/research.md`](context/changes/testing-isolation-abuse-guest-merge/research.md) — router ownership inventory including `checkIn`
- [`context/foundation/test-plan.md`](context/foundation/test-plan.md) — Risk map, Phase 2 (e2e #3/#7), Phase 3 (complete)

## Open Questions

1. **Cookbook placement** — add §6.7 “check-in persistence” on ship, or extend §6.2 bullet for check-in reference tests? (Plan decision.)
2. **Test-plan §3 row** — this change is ad-hoc Risk #7 integration, not a numbered rollout phase. Mark in §6.6 notes only, or add interim row? (Plan decision.)
3. **S-05 timing** — when UI lands, confirm Phase 2 e2e reuses integration oracle (create/list fields) rather than duplicating server assertions in browser tests.
