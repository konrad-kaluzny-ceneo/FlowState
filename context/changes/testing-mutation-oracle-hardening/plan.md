# Mutation Oracle Hardening Implementation Plan

## Overview

This change completes test-plan §3 Phase 5 / roadmap Q-09 by hardening weak test oracles on covered code, not by broadening coverage or chasing a perfect mutation score. The plan targets the S4 kill-list where survived mutants map to user-visible risks #1-#6: `trpc.ts` auth middleware, `use-pomodoro-cycle` timer/recovery branches, router ownership call arguments, and guest import transaction edges.

The rollout is test-first and test-only by default. Production code changes are allowed only when a new oracle exposes a real shipped bug; any such fix must be minimal, local, and documented before the phase is marked complete.

## Current State Analysis

S4 research is complete with confidence 82% and gives the codebase baseline for this plan. The current full `pnpm test` baseline is green at 923 tests / 126 files, while targeted Stryker runs show 1,202 covered survivors across eight scoped files. The most important gap is not missing tests in general; it is that many existing tests assert final behavior while allowing critical guard, ownership, and boundary logic to mutate away.

The scoped covered mutation scores are uneven:

- `src/server/api/trpc.ts` is at 18.37% covered score with 40 survivors and has no focused middleware tests.
- `src/hooks/use-pomodoro-cycle.ts` is at 51.77% with 924 survivors after Q-08 expanded the hook surface.
- Router files range from 38.71% to 80.79%, with ownership tests often relying on mocked results instead of asserting Prisma `where` clauses.
- `src/server/api/lib/import-guest-snapshot.ts` is at 63.79%, with guest merge edge cases around empty snapshots, account cycle closure, expiry, and unmapped task IDs.

### Key Discoveries:

- `context/changes/testing-mutation-oracle-hardening/research.md` maps the highest-ROI user-visible survivors to risks #1-#6 and estimates ~280-360 addressable survivors in scope.
- `context/foundation/test-plan.md` §6.7 says to add assertions only when breaking the mutant catches a user-visible regression; equivalent/noise survivors are intentionally deferred.
- `context/foundation/test-plan.md` §6.1, §6.2, and §6.5 already define the local unit, tRPC integration, and guest merge test patterns this plan should extend.
- `context/foundation/lessons.md` requires transition-gate changes to prove actionability, but this Phase 5 plan does not change wedge transition logic; it only adds hook oracles where survived mutants intersect risks #1-#3.
- Prior plans favor phase-local Vitest commands, a final repository gate, and cookbook updates after the executable proofs land.

## Desired End State

Phase 5 is complete when targeted tests fail for the scoped user-visible mutants that matter most, targeted Stryker reruns show meaningful score improvement, and the durable test-plan cookbook tells future contributors how to repeat the mutation review pattern. The target is not to eliminate all 1,202 scoped survivors; the target is to kill roughly 280-360 user-visible survivors and raise the most important scoped files to the exit bands: `use-pomodoro-cycle.ts` at least 65%, `trpc.ts` at least 70%, and scoped router files at least 75% where the file has meaningful covered business logic.

Verification is phase-local first, then repository-wide:

- Each phase has a focused `pnpm exec vitest run ...` command for the files touched in that phase.
- The final phase reruns targeted Stryker for the scoped files and records before/after results.
- Final gates are `pnpm check` and `pnpm test`.

## What We're NOT Doing

- No full-repo Stryker chase to 100%.
- No other `src/hooks/*` modules beyond `src/hooks/use-pomodoro-cycle.ts`.
- No Playwright e2e or belt additions.
- No UI component smoke work; that remains Phase 6 territory.
- No CI mutation gate wiring; this plan may document it as an optional future note only.
- No broad router refactor, Prisma mock framework rewrite, or shared test harness extraction unless a tiny local helper keeps a touched test file readable.
- No production fixes unless a new test exposes a genuine user-visible bug in shipped behavior.
- No equivalent-mutant cleanup for SSR guards, string-literal noise, display-only copy, dev timing middleware, or mock-swallowed implementation details called out by S4.

## Implementation Approach

Work highest ROI first, using the S4 kill-list rather than the older broad §6.7 priority order. The first phase adds the missing middleware test artifact because `trpc.ts` is the lowest-scoring scoped file and protects risks #4/#6 across every protected procedure. The next phases strengthen the large hook state-machine surface, then router ownership oracles, then guest merge transaction boundaries. The last phase reruns targeted Stryker, updates the cookbook, and closes the planning loop.

The plan uses structural oracles where behavioral mocks are too permissive:

- Middleware auth tests assert thrown `UNAUTHORIZED` from the tRPC protected boundary.
- Hook tests assert public hook state, mutation call counts, and timer/recovery invariants rather than internal line coverage.
- Router tests assert Prisma `where` and no-write call contracts where mock return values alone would pass after deleting ownership logic.
- Guest import tests assert transaction absence/presence and update scopes where final counts alone are too weak.

## Decisions Recorded

| Decision | Choice | Confidence | Rationale |
| --- | --- | ---: | --- |
| Planning source | Use S4 research as authoritative; no new codebase research | 88% | The user explicitly marked S4 complete at 82% confidence and requested no re-research; the findings include file scores, clusters, test targets, and equivalent lists. |
| Phase order | Start with `trpc.ts`, then hook, routers, guest import, verification/cookbook | 90% | `trpc.ts` has the lowest score and no test file; hook has the largest survivor count; router/guest phases then follow the remaining risk density. |
| Mutation goal | Kill user-visible survivors only, not all survivors | 92% | Test-plan §6.7 review rule and change.md both reject a 100% Stryker chase. |
| Middleware coverage | Add `src/server/api/trpc.test.ts` as a focused unit/integration-style test | 87% | Router createCaller tests inject sessions and bypass middleware failure paths; direct middleware tests are the missing artifact. |
| Router oracle shape | Prefer Prisma call-argument and no-write assertions over only result assertions | 90% | S4 found mocks can still return NOT_FOUND/empty when production `userId` or `sessionId` filters are deleted. |
| Hook scope | Target PAUSED timer math, recovery idempotency, visibility/expiry, and the top gate/reconcile branches only | 84% | These clusters map directly to risks #1-#3 and avoid boiling the ocean across 924 hook survivors. |
| Production fixes | Plan none up front; allow minimal local fixes only after a new test proves shipped behavior is wrong | 86% | S4 flagged latent vulnerabilities but no confirmed live bug without mutation applied. |
| Stryker exit metric | Use targeted per-file reruns and scoped thresholds, then full `pnpm test` | 85% | Full Stryker is expensive and not required; targeted reruns give the signal Phase 5 needs. |
| Cookbook update | Update §6.7 Phase 5 notes, §3 row status, and §8 ledger during the final phase | 88% | The test-plan is the durable quality contract; updates should reflect landed reference tests and fresh mutation results. |
| Plan review fix: tRPC timing middleware | Install the existing immediate `setTimeout` test helper, or otherwise neutralize dev timing delay, in the new direct middleware tests | 90% | `protectedProcedure` always runs through `timingMiddleware`; without the established test helper each assertion can pay a random 100-500ms delay. |
| Plan review fix: conditional suggestion work | If `suggestion-isolation.test.ts` or `suggestion.ts` is touched, rerun targeted Stryker for `src/server/api/routers/suggestion.ts` and record the result | 88% | The phase makes suggestion ownership optional, but any touched router file still needs mutation evidence before final sign-off. |
| Plan review fix: gate-actionability rule | If a production fix touches a wedge/check-in/cycle transition gate, add or extend the affected actionability/dismiss oracle in the same phase | 86% | `context/foundation/lessons.md` requires transition beats to prove the visible control closes or unblocks the next beat before shipping gate logic changes. |

## Phase 1: tRPC Auth Middleware Oracles

### Overview

Add the missing direct middleware tests for `enforceAuth` and context session hydration. This phase closes the most obvious test artifact gap: protected router tests currently create callers with mocked sessions, so middleware auth mutants can survive without affecting those tests.

### Changes Required:

#### 1. Protected Procedure Middleware Tests

**File**: `src/server/api/trpc.test.ts`

**Intent**: Create focused tests that exercise the protected procedure boundary with unauthenticated and incomplete sessions. These tests should fail if `enforceAuth` stops requiring a real session user with usable identity data.

**Contract**: A minimal test router using the existing tRPC router/procedure exports must reject protected calls with `UNAUTHORIZED` when `ctx.session` is `null`, when the session has no user, and when required user identity data is missing. A valid session should reach the resolver so the test proves the boundary, not just the error helper.

**Plan Review Note**: Because `protectedProcedure` includes `timingMiddleware`, install the existing `installImmediateSetTimeout` helper before importing `~/server/api/trpc` or use an equivalent local test setup that removes the random dev delay. Do not weaken the middleware oracle to avoid the timing layer.

#### 2. Context Hydration Edge Tests

**File**: `src/server/api/trpc.test.ts`

**Intent**: Cover the session hydration branch that S4 found in `createTRPCContext`, especially partial auth responses that should not accidentally count as authenticated.

**Contract**: Mock or construct the auth/session input at the boundary already used by `createTRPCContext`; assert that partial auth produces a context shape that protected procedures reject, while a complete auth session produces a context shape that can pass the protected boundary. Keep the test at the tRPC context/middleware layer; do not duplicate per-router ownership tests here.

### Success Criteria:

#### Automated Verification:

- tRPC middleware oracle passes: `pnpm exec vitest run src/server/api/trpc.test.ts`
- Targeted Stryker rerun for middleware shows `src/server/api/trpc.ts` covered mutation score at or above 70%, or any shortfall is documented as equivalent/deferred per §6.7: `pnpm exec stryker run --mutate "src/server/api/trpc.ts"`

#### Manual Verification:

- Review that the tests exercise middleware failure paths directly rather than only protected routers with injected sessions.
- Review any surviving `trpc.ts` mutants and classify dev-only timing/logging or equivalent branches instead of adding low-signal assertions.

**Implementation Note**: If the tests reveal that incomplete sessions currently pass protected procedures, make the smallest local fix in `src/server/api/trpc.ts` and document it in the implementation notes before marking this phase complete.

---

## Phase 2: Hook Timer and Recovery Oracles

### Overview

Strengthen `use-pomodoro-cycle` tests around the highest-risk timer and recovery survivors: PAUSED `cycleEndTimeMs`, recovery idempotency, idle hydrate closure, visibility recalc, exact expiry, and optimistic end-time reconciliation. This phase targets risks #1, #2, and the top #3 gate branches only where S4 identified user-visible mutants.

### Changes Required:

#### 1. PAUSED Timer Math and Resume Freeze

**File**: `src/hooks/use-pomodoro-cycle.test.tsx`

**Intent**: Add or strengthen a hook oracle proving that PAUSED cycles hydrate and resume from `remainingDurationSec`, not from stale wall-clock `startedAt` math.

**Contract**: Given a recovered or hydrated PAUSED active cycle, public hook state must preserve the frozen remaining time and must not expire immediately because wall time advanced. When resumed, the next running end time must derive from the remaining duration. Assert hook state and cycle mutation arguments at the existing public test boundary.

#### 2. Recovery Idempotency and No-Active Closure

**File**: `src/hooks/use-pomodoro-cycle.test.tsx`

**Intent**: Prove recovery does not double-fetch or double-apply active cycles across double mount or mode flip, and that the no-active branch still performs timeout closure / idle session-start cleanup.

**Contract**: Given recovery runs twice for the same mode/session, `getActive` or equivalent recovery call should happen once for the protected branch S4 identified. Given no active cycle returns, the hook should still clear/close stale idle-start state rather than silently skipping that branch.

#### 3. Visibility, Expiry, and Exact Boundary

**File**: `src/hooks/use-pomodoro-cycle.test.tsx`

**Intent**: Tighten the browser-timing fallback oracle so background/visibility recalc only completes running cycles, catches up when hidden, and transitions exactly at expiry.

**Contract**: Use existing fake timer / visibility helpers. Paused or idle cycles must not complete on visibility return. Running cycles hidden until expiry must catch up. The exact `remainingMs === 0` boundary must transition as expired, protecting the `<=` vs `<` mutant.

#### 4. Optimistic End-Time Reconciliation

**File**: `src/hooks/use-pomodoro-cycle.test.tsx`

**Intent**: Add a focused oracle for server/client end-time drift greater than two seconds on work and break paths.

**Contract**: Given an optimistic cycle starts with one end time and the server response returns an end time more than 2000ms away, public remaining time should reconcile to the server-backed value. Use the established deferred-mock pattern from §6.8 rather than wall-clock sleeps.

#### 5. Focused Mid-Cycle and Check-In Gate Branches

**File**: `src/hooks/use-pomodoro-cycle.test.tsx`

**Intent**: Kill the top user-visible #3 survivors where mark-complete or cycle-complete confirmation can skip FR-015/check-in decisions.

**Contract**: `onMidCycleMarkComplete` should be a no-op unless the cycle is running, WORK, and has an active cycle. `onCycleCompleteConfirm` for authenticated WORK completion should set the awaiting-check-in state before break transition. Break completion must not masquerade as WORK check-in.

**Plan Review Note**: If these oracles expose a genuine shipped bug and the production fix changes transition-gate behavior, add or extend the affected actionability/dismiss assertion in this phase per `context/foundation/lessons.md`. A transition gate fix is not complete if the visible control can remain stuck or fail to unblock the next beat.

### Success Criteria:

#### Automated Verification:

- Hook oracle suite passes: `pnpm exec vitest run src/hooks/use-pomodoro-cycle.test.tsx`
- Guest parity suite still passes if touched: `pnpm exec vitest run src/hooks/use-pomodoro-cycle-guest.test.tsx`
- Targeted Stryker rerun for the hook shows `src/hooks/use-pomodoro-cycle.ts` covered mutation score at or above 65%, or documents remaining survivors as equivalent/deferred per §6.7: `pnpm exec stryker run --mutate "src/hooks/use-pomodoro-cycle.ts"`

#### Manual Verification:

- Review that new hook tests assert user-visible state and public mutation/call boundaries, not private implementation branches.
- Review remaining hook survivors and defer SSR guards, display-only copy, alarm URL literals, timeout anomalies, and non-risk wedge branches unless they map to risks #1-#3.

**Implementation Note**: This phase may be split during implementation if `use-pomodoro-cycle.test.tsx` becomes too large for one comfortable pass, but the phase remains one verification unit because all items share the same hook target and Stryker rerun.

---

## Phase 3: Router Ownership and NOT_FOUND Oracles

### Overview

Strengthen server router tests where mocked DB behavior can hide deleted ownership filters. This phase focuses on call-argument and no-write assertions for cycle, task, session, check-in, and a small suggestion ownership survivor if it remains high signal.

### Changes Required:

#### 1. Cycle Router Ownership Call Args

**File**: `src/server/api/routers/cycle.test.ts`

**Intent**: Assert that `cycle.list` includes `sessionId` when provided, `cycle.complete` handles zero-count updates as `BAD_REQUEST`, and side-effect flags (`markTaskDone`, `incrementInterruption`) control the expected write paths.

**Contract**: Prisma mock assertions should inspect `findMany`, `updateMany`, task update, and session update call arguments. Tests must fail if `sessionId`, `userId`, zero-count handling, or side-effect guards are deleted while mocks still return benign results.

#### 2. Cycle Create Foreign FK Guards

**File**: `src/server/api/routers/cycle-isolation.test.ts`

**Intent**: Strengthen `cycle.create` isolation for foreign `sessionId` and `taskId` so the test proves preflight ownership checks, not only the final thrown result.

**Contract**: Assert `findFirst` calls include both resource `id` and caller `userId`; when ownership misses, `create` must not be called and the procedure must throw `NOT_FOUND`.

#### 3. Task Router Sort and Mutation Ownership

**File**: `src/server/api/routers/task-mutation.test.ts`

**Intent**: Add structural oracles for active sort order scoping and update/delete ownership misses.

**Contract**: The `nextActiveSortOrder` aggregate call must include `where: { userId, status: "active" }`. Update/delete tests must assert `findFirst` scopes by caller `userId`, returns `NOT_FOUND` on miss, and does not call `update`/`delete` when ownership is missing.

#### 4. Task Query Edge Branch

**File**: `src/server/api/routers/task.test.ts`

**Intent**: Cover the `doneForToday` local-date branch and reorder set-size validation where S4 identified user-visible survivors.

**Contract**: A `doneForToday` query should assert `localDateKey` filtering behavior, and reorder validation should fail when submitted IDs do not match the active owned set. Assertions should stay at the tRPC result/error and Prisma call boundary.

#### 5. Session End Zero-Count Handling

**File**: `src/server/api/routers/session.test.ts`

**Intent**: Assert `session.end` returns `NOT_FOUND` when there is no active session or when `updateMany` affects zero rows.

**Contract**: The test must prove no stale or foreign active session can be ended for the caller. Assert error code and relevant Prisma call arguments.

#### 6. Check-In Ownership and Duplicate Oracles

**File**: `src/server/api/routers/check-in-isolation.test.ts`

**Intent**: Strengthen `checkIn.create` so cycle ownership is checked before insert.

**Contract**: Assert `cycle.findFirst` includes cycle `id` and caller `userId`; when the cycle is foreign or absent, `checkIn.create` must not be called and the procedure must throw `NOT_FOUND`.

**File**: `src/server/api/routers/check-in.test.ts`

**Intent**: Assert duplicate check-in conflict remains protected.

**Contract**: Given an existing check-in for the cycle, `create` should throw `CONFLICT` and avoid a second insert.

#### 7. Suggestion Ownership Smoke If Still High Signal

**File**: `src/server/api/routers/suggestion-isolation.test.ts`

**Intent**: Add a small ownership oracle only if targeted Stryker still shows user-visible survivors in `verifyOwnedTasks` after the core router work.

**Contract**: `verifyOwnedTasks` must require every referenced task to be active and owned by the caller. If this is already strongly covered or would duplicate low-value tests, document as deferred under §6.7 instead of adding it.

### Success Criteria:

#### Automated Verification:

- Cycle router tests pass: `pnpm exec vitest run src/server/api/routers/cycle.test.ts src/server/api/routers/cycle-isolation.test.ts`
- Task router tests pass: `pnpm exec vitest run src/server/api/routers/task.test.ts src/server/api/routers/task-mutation.test.ts`
- Session and check-in router tests pass: `pnpm exec vitest run src/server/api/routers/session.test.ts src/server/api/routers/check-in.test.ts src/server/api/routers/check-in-isolation.test.ts`
- Suggestion isolation test passes if touched: `pnpm exec vitest run src/server/api/routers/suggestion-isolation.test.ts`
- Targeted Stryker reruns for touched router files show scoped router covered mutation scores at or above 75% where applicable, or document remaining survivors as equivalent/deferred: `pnpm exec stryker run --mutate "src/server/api/routers/cycle.ts"`, `pnpm exec stryker run --mutate "src/server/api/routers/task.ts"`, `pnpm exec stryker run --mutate "src/server/api/routers/session.ts"`, `pnpm exec stryker run --mutate "src/server/api/routers/check-in.ts"`, and `pnpm exec stryker run --mutate "src/server/api/routers/suggestion.ts"` if suggestion ownership work is touched.

#### Manual Verification:

- Review that new router assertions catch deleted `userId`, `sessionId`, FK preflight, and no-write contracts.
- Review any production error-surface change carefully; if a test exposes a genuine leaked foreign-resource path, keep the production fix local to that router branch.

**Implementation Note**: Favor extending existing router test files over creating broad new harnesses. A tiny local `expectWhereContainsUser` helper is acceptable inside a file if it makes call-arg assertions readable. If the optional suggestion ownership oracle is implemented, treat `suggestion.ts` as a touched router for both Stryker evidence and survivor classification.

---

## Phase 4: Guest Import Transaction Oracles

### Overview

Close the Risk #5 guest merge survivors where final imported counts are not enough: empty snapshots should short-circuit, account RUNNING/PAUSED cycles should close before import, expired RUNNING guest cycles should normalize, and unmapped guest task IDs should become `null`.

### Changes Required:

#### 1. Empty Snapshot Short-Circuit

**File**: `src/server/api/lib/import-guest-snapshot.test.ts`

**Intent**: Add a direct lib-level oracle that an empty guest snapshot returns zero counts without opening a Prisma transaction or closing existing account cycles.

**Contract**: Given empty `tasks`, `sessions`, and `cycles`, `importGuestSnapshot` returns `{ importedTasks: 0, importedCycles: 0 }` and `$transaction` is not called.

#### 2. Account RUNNING and PAUSED Closure Scope

**File**: `src/server/api/routers/guest.test.ts`

**Intent**: Strengthen the router/integration path so account cycle closure before import targets both `RUNNING` and `PAUSED`, and only for the importing user.

**Contract**: Assert `cycle.updateMany` where clause includes caller `userId` and state in `[RUNNING, PAUSED]`. The in-memory transaction mock should update matching rows so the final state proof is not only a call-arg assertion.

#### 3. Expired RUNNING Normalization

**File**: `src/server/api/routers/guest.test.ts`

**Intent**: Preserve the guest import rule that expired RUNNING cycles import as `COMPLETED` with `endedAt`.

**Contract**: Seed a guest RUNNING cycle with `startedAt + configuredDurationSec * 1000 <= Date.now()`. The imported row should be `COMPLETED`, `endedAt` should be set, and active unexpired RUNNING behavior should remain unchanged if already covered.

#### 4. Unmapped Task ID Nulling

**File**: `src/server/api/routers/guest.test.ts`

**Intent**: Assert a guest cycle referencing a missing guest task UUID imports safely instead of throwing or preserving a dangling ID.

**Contract**: The imported cycle row has `taskId: null` when the guest cycle references a task UUID absent from the snapshot task list.

### Success Criteria:

#### Automated Verification:

- Guest import lib test passes: `pnpm exec vitest run src/server/api/lib/import-guest-snapshot.test.ts`
- Guest router import tests pass: `pnpm exec vitest run src/server/api/routers/guest.test.ts`
- Combined guest phase command passes: `pnpm exec vitest run src/server/api/lib/import-guest-snapshot.test.ts src/server/api/routers/guest.test.ts`
- Targeted Stryker rerun for guest import shows `src/server/api/lib/import-guest-snapshot.ts` covered mutation score meaningfully improved, or documents remaining survivors as equivalent/deferred: `pnpm exec stryker run --mutate "src/server/api/lib/import-guest-snapshot.ts"`

#### Manual Verification:

- Review that empty snapshot tests assert no transaction/no writes, not just zero returned counts.
- Review that account closure assertions include both state scope and user scope.

**Implementation Note**: If current production code does not close PAUSED account cycles before guest import, add the smallest local fix in `import-guest-snapshot.ts` only after the failing oracle demonstrates the user-visible merge risk.

---

## Phase 5: Targeted Stryker, Cookbook, and Final Gates

### Overview

Rerun scoped mutation verification, classify remaining survivors, update the durable test-plan cookbook/ledger, and run final repository gates. This phase is where Phase 5 rollout status moves from plan to documented implementation evidence.

### Changes Required:

#### 1. Targeted Mutation Verification

**File**: repository root / Stryker reports

**Intent**: Re-run targeted Stryker for every scoped file changed or materially covered by this plan, then capture before/after scores and remaining survivor classification in the implementation notes or review evidence.

**Contract**: At minimum rerun `trpc.ts`, `use-pomodoro-cycle.ts`, touched router files, and `import-guest-snapshot.ts`. The expected exit bands are `trpc.ts >= 70%`, `use-pomodoro-cycle.ts >= 65%`, and touched router files `>= 75%` where practical. If a file misses its band, the implementer must document the remaining survivor clusters as equivalent/deferred with §6.7 rationale, not silently mark complete.

#### 2. Mutation Cookbook Update

**File**: `context/foundation/test-plan.md`

**Intent**: Update §6.7 with Phase 5 notes so future mutation hardening follows the landed oracle patterns.

**Contract**: Add Phase 5 notes covering direct middleware tests, hook timer/recovery boundaries, router Prisma call-arg/no-write oracles, guest transaction oracles, targeted Stryker commands, and the rule for classifying equivalent/deferred survivors. Preserve the existing §6.7 review rule.

#### 3. Rollout Row and Freshness Ledger

**File**: `context/foundation/test-plan.md`

**Intent**: Update test-plan §3 Phase 5 row and §8 freshness ledger after implementation evidence lands.

**Contract**: Set Phase 5 row status to `complete` and change folder to `testing-mutation-oracle-hardening` only when Progress automated items are complete. Add a §8 ledger line with the Phase 5 completion date, scoped Stryker before/after summary, and note that full-repo Stryker / CI mutation gate remain optional/deferred unless separately approved.

#### 4. Final Repository Gates

**File**: repository root

**Intent**: Verify the non-e2e quality gates after all test and documentation changes land.

**Contract**: Run `pnpm check` and `pnpm test`. Do not run Playwright belt for this plan unless implementation discovers a contract that cannot be observed below browser level and the plan is explicitly amended.

### Success Criteria:

#### Automated Verification:

- Targeted Stryker results recorded for every scoped changed file, with exit bands met or misses classified under §6.7
- `context/foundation/test-plan.md` §6.7 includes Phase 5 mutation-oracle notes
- `context/foundation/test-plan.md` §3 Phase 5 row is updated after implementation completion
- `context/foundation/test-plan.md` §8 freshness ledger is updated after implementation completion
- Quality gate passes: `pnpm check`
- Unit/integration gate passes: `pnpm test`

#### Manual Verification:

- Review that the cookbook update teaches reusable oracle patterns rather than listing one-off implementation details.
- Review that remaining survivors were classified by user-visible risk, not by convenience.

**Implementation Note**: The cookbook and status updates should be the last implementation step, after Stryker and repository gates produce current evidence.

---

## Testing Strategy

### Unit and Hook Tests:

- `src/server/api/trpc.test.ts` for middleware and context auth boundary oracles.
- `src/hooks/use-pomodoro-cycle.test.tsx` for PAUSED timer math, recovery idempotency, visibility/expiry, optimistic reconciliation, and focused gate branches.
- `src/server/api/lib/import-guest-snapshot.test.ts` for empty snapshot no-transaction behavior.

### Integration Tests:

- Router ownership and IDOR call-arg/no-write oracles in `cycle.test.ts`, `cycle-isolation.test.ts`, `task.test.ts`, `task-mutation.test.ts`, `session.test.ts`, `check-in.test.ts`, and `check-in-isolation.test.ts`.
- Guest merge transaction and row-shape oracles in `guest.test.ts`.

### Mutation Tests:

- Use targeted Stryker per scoped file, not a full-repo score chase.
- Review survivors through the §6.7 rule: add assertions only when the mutant represents a user-visible regression.
- Classify SSR guards, dev-only timing, string-literal noise, display-only copy, and timeout anomalies as equivalent/deferred unless implementation evidence proves otherwise.

### E2E:

- None planned. Risks #1-#6 in this change are observable through cheaper hook/unit/integration layers, and e2e/belt additions are explicitly out of scope.

## Performance Considerations

Runtime product performance should not change because the plan is test-only unless a bug is exposed. Test runtime will increase from additional Vitest and targeted Stryker runs, but phase-local Vitest commands keep iteration practical. Stryker runs are intentionally targeted and sequential to avoid turning Phase 5 into an expensive full-suite mutation gate.

## Migration Notes

No Prisma schema or data migration is planned. If a router or guest import production fix becomes necessary, it must preserve existing persisted data contracts and stay local to the exposed branch.

## Open Risks & Assumptions

- S4 estimates ~280-360 user-visible addressable survivors from cluster sampling; exact killed count may vary after implementation.
- `use-pomodoro-cycle.ts` has 924 covered survivors and six timeout mutants; hitting 65% may require careful classification if the highest-value oracles do not move the score enough.
- Some router string-literal and Prisma mock survivors may remain even after user-visible ownership oracles improve.
- `enforceAuth` production behavior is flagged as latent risk, but no live bug is confirmed before the Phase 1 test exists.
- PAUSED guest parity may be unnecessary if the auth hook test covers the shared state-machine branch; implementers should extend `use-pomodoro-cycle-guest.test.tsx` only when it adds distinct guest-mode signal.
- Confidence for this plan is 88/100, above the required 80, because the upstream research is fresh and directly maps mutation clusters to test targets.

## References

- Change brief: `context/changes/testing-mutation-oracle-hardening/change.md`
- Research: `context/changes/testing-mutation-oracle-hardening/research.md`
- Quality contract: `context/foundation/test-plan.md`
- Lessons: `context/foundation/lessons.md`
- Plan precedent: `context/archive/2026-06-05-testing-isolation-abuse-guest-merge/plan.md`
- Plan precedent: `context/archive/2026-06-26-testing-prd-v3-wedge-coherence/plan.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: tRPC Auth Middleware Oracles

#### Automated

- [x] 1.1 tRPC middleware oracle passes
- [x] 1.2 Targeted Stryker for `src/server/api/trpc.ts` meets or documents the 70% exit band — **67.35% covered** (33 killed / 16 survived / 3 no-cov); shortfall documented: 3 no-cov `errorFormatter` (uncovered Zod path), 8 dev-only `timingMiddleware` logging/delay (equivalent per §6.7), 2 `data?.user` optional-chaining (auth API always returns object envelope), 1 empty `catch` (session already `null`), 2 `enforceAuth` optional-chaining + 2 `next({ctx})` object-literal (equivalent when caller injects valid session shape)

### Phase 2: Hook Timer and Recovery Oracles

#### Automated

- [ ] 2.1 Hook oracle suite passes
- [ ] 2.2 Guest parity suite passes if touched
- [ ] 2.3 Targeted Stryker for `src/hooks/use-pomodoro-cycle.ts` meets or documents the 65% exit band

### Phase 3: Router Ownership and NOT_FOUND Oracles

#### Automated

- [ ] 3.1 Cycle router tests pass
- [ ] 3.2 Task router tests pass
- [ ] 3.3 Session and check-in router tests pass
- [ ] 3.4 Suggestion isolation test passes if touched
- [ ] 3.5 Targeted Stryker for touched router files meets or documents the router exit bands

### Phase 4: Guest Import Transaction Oracles

#### Automated

- [ ] 4.1 Guest import lib test passes
- [ ] 4.2 Guest router import tests pass
- [ ] 4.3 Combined guest phase command passes
- [ ] 4.4 Targeted Stryker for `src/server/api/lib/import-guest-snapshot.ts` improves or documents remaining survivors

### Phase 5: Targeted Stryker, Cookbook, and Final Gates

#### Automated

- [ ] 5.1 Targeted Stryker results recorded for every scoped changed file
- [ ] 5.2 `context/foundation/test-plan.md` §6.7 includes Phase 5 mutation-oracle notes
- [ ] 5.3 `context/foundation/test-plan.md` §3 Phase 5 row is updated after implementation completion
- [ ] 5.4 `context/foundation/test-plan.md` §8 freshness ledger is updated after implementation completion
- [ ] 5.5 Quality gate passes: `pnpm check`
- [ ] 5.6 Unit/integration gate passes: `pnpm test`
