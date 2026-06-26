# Mutation Oracle Hardening — Plan Brief

> Full plan: `context/changes/testing-mutation-oracle-hardening/plan.md`  
> Research: `context/changes/testing-mutation-oracle-hardening/research.md`

## What & Why

This plan completes test-plan §3 Phase 5 / roadmap Q-09 by hardening weak test oracles on covered code. The goal is to kill the user-visible survived mutants that matter across risks #1-#6, not to chase 100% Stryker or add new e2e coverage.

## Starting Point

S4 research found `pnpm test` green, but targeted Stryker shows 1,202 covered survivors across eight scoped files. The biggest gaps are missing `trpc.ts` middleware tests, weak hook timer/recovery assertions, permissive router ownership mocks, and guest import tests that do not assert transaction boundaries.

## Desired End State

Scoped tests fail when protected procedures allow incomplete sessions, timers drift through PAUSED/recovery branches, router ownership filters disappear, or guest merge writes happen on empty/unsafe snapshots. Targeted Stryker reruns show meaningful improvement: `trpc.ts >= 70%`, `use-pomodoro-cycle.ts >= 65%`, and touched routers around `>= 75%` or documented equivalent/deferred survivors.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Planning source | Use S4 research, no re-research | The research is fresh, complete, and already maps mutants to files, risks, and test targets. | User / Research |
| Phase order | `trpc.ts` → hook → routers → guest import → verification/cookbook | This starts with the lowest-scoring missing artifact, then handles the largest survivor surface and remaining risk clusters. | Research / Plan |
| Mutation goal | Kill user-visible survivors only | Test-plan §6.7 says equivalent/noise mutants should be classified, not chased. | Test Plan |
| Router strategy | Assert Prisma call args and no-write paths | Mocked results can pass even when `userId`, `sessionId`, or FK guards are deleted. | Research |
| Production fixes | None planned up front | S4 found latent risks but no confirmed live bug without new tests; fixes are allowed only if a test proves shipped behavior wrong. | Research / Plan |

## Scope

**In scope:**

- New `src/server/api/trpc.test.ts` middleware/context tests.
- Stronger `src/hooks/use-pomodoro-cycle.test.tsx` timer, recovery, visibility, reconcile, and focused gate oracles.
- Router ownership and NOT_FOUND call-arg/no-write oracles in existing router test files.
- Guest import empty snapshot, account cycle closure, expiry, and unmapped task ID oracles.
- Targeted Stryker reruns, `pnpm check`, `pnpm test`, and test-plan §6.7/§3/§8 updates.

**Out of scope:**

- Full-repo Stryker or 100% mutation chase.
- Other hook modules, e2e/belt additions, UI component smoke, CI mutation gate wiring.
- Production refactors or fixes unless a new oracle exposes a real user-visible bug.

## Architecture / Approach

The plan strengthens tests at the cheapest layer that observes each risk: direct tRPC middleware tests for auth, hook tests for timer/recovery behavior, router integration tests for ownership filters, and guest import unit/integration tests for transaction safety. Each phase has a focused Vitest command and targeted Stryker check before the final repository gates.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. tRPC Auth Middleware Oracles | Direct protected-procedure rejection tests | Incomplete sessions bypass auth |
| 2. Hook Timer and Recovery Oracles | PAUSED, recovery, visibility, expiry, reconcile, and gate assertions | Timer drift or refresh recovery regressions |
| 3. Router Ownership and NOT_FOUND Oracles | Prisma `where` and no-write assertions | IDOR/per-user isolation hidden by mocks |
| 4. Guest Import Transaction Oracles | Empty no-op, closure scope, expiry, null task ID proofs | Guest data loss or unsafe merge |
| 5. Targeted Stryker, Cookbook, and Final Gates | Before/after mutation evidence and durable docs | Survivors misclassified or rollout not recorded |

**Prerequisites:** Existing S4 research, green baseline test suite, and branch `features/testing-mutation-oracle-hardening`.  
**Estimated effort:** ~5 focused implementation phases, each independently verifiable with Vitest plus targeted Stryker.

## Open Risks & Assumptions

- The hook file is large enough that hitting 65% may require careful survivor classification even after high-value oracles land.
- Some Prisma string-literal/mock survivors may remain equivalent or low-signal.
- Production fixes are not planned, but `trpc.ts`, PAUSED timer math, empty snapshot guard, or `cycle.create` guards could expose a local bug once tested.

## Success Criteria (Summary)

- Targeted Stryker scores improve meaningfully on scoped files, with misses classified under §6.7.
- `pnpm check` and `pnpm test` pass after implementation.
- `context/foundation/test-plan.md` records Phase 5 cookbook notes, rollout status, and freshness ledger evidence.
