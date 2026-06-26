---
date: 2026-06-26T20:00:00+02:00
researcher: Cursor Agent (S4 ship-slice)
git_commit: 5ac82d4ccdc4f15e74dd8d2a4df4e5979bc49ea4
branch: features/testing-mutation-oracle-hardening
repository: FlowState
topic: "Mutation oracle hardening — survived-mutant landscape vs risks #1–#6"
tags: [research, mutation-testing, stryker, hooks, trpc, isolation, guest-merge]
status: complete
last_updated: 2026-06-26
last_updated_by: Cursor Agent (S4 ship-slice)
---

# Research: Mutation oracle hardening — survived-mutant landscape

**Date**: 2026-06-26T20:00:00+02:00  
**Researcher**: Cursor Agent (S4 ship-slice)  
**Git Commit**: `5ac82d4ccdc4f15e74dd8d2a4df4e5979bc49ea4`  
**Branch**: `features/testing-mutation-oracle-hardening`  
**Repository**: FlowState

## Research Question

Map the **current** survived-mutant landscape (targeted Stryker per file, 2026-06-26) to concrete weak-oracle test gaps for test-plan §3 Phase 5 / risks #1–#6, so a planner can target highest-ROI assertions. No test or production code changes in this phase.

## Summary

**Baseline gate**: `pnpm test` green — **923 tests / 126 files in ~32s** (2026-06-26).

**Stryker snapshot (targeted runs, commit `5ac82d4`)** vs **2026-06-06 full-repo baseline** (58.2% covered / 685 survived total):

| Target file | Covered mutation score | Survived (covered) | vs 2026-06-06 dir baseline |
|-------------|------------------------:|-------------------:|----------------------------|
| `src/hooks/use-pomodoro-cycle.ts` | **51.77%** | **924** | hooks dir had ~170 (whole dir); single hook file dominates |
| `src/server/api/routers/cycle.ts` | **75.51%** | **72** | routers dir ~150 total |
| `src/server/api/routers/task.ts` | **67.48%** | **53** | — |
| `src/server/api/routers/session.ts` | **60.87%** | **18** | — |
| `src/server/api/routers/check-in.ts` | **38.71%** | **19** | thin router; weak oracles |
| `src/server/api/routers/suggestion.ts` | **80.79%** | **34** | best router coverage |
| `src/server/api/lib/import-guest-snapshot.ts` | **63.79%** | **42** | Risk #5 |
| `src/server/api/trpc.ts` (middleware) | **18.37%** | **40** | **not in 2026-06 baseline** |
| **Scoped subtotal (8 files)** | — | **1,202** | addressable on covered code |

**Planner-facing totals**

- **Total covered survivors in scope (8 targeted files)**: **1,202**
- **Estimated user-visible addressable** (after §6.7 review rule): **~280–360** (~25–30% of covered survivors)
- **Estimated equivalent/defer**: **~840–920** (SSR guards, Prisma string-literal noise, display-only return fields, mock-swallowed auth)
- **Genuine production-risk flags**: **4 clusters** (see [Potential production bugs](#potential-production-bugs-flag-loudly))

**Headline**: Q-08 wedge work **expanded** `use-pomodoro-cycle.ts` (~3.7k LOC, 2,438 mutants) while tests gained breadth; **covered score on that file fell to ~52%** with **924 survivors**. Router ownership tests kill cross-user **mutation** paths but **do not assert Prisma `where` clauses** or **middleware auth** — integration callers bypass `enforceAuth` via mocked session. Highest ROI is **hook recovery/timer/wedge chains** (Risk #1–#3) plus **router `where` + NOT_FOUND oracle tightening** and **dedicated `trpc.ts` auth tests** (Risks #4, #6).

## Method

1. Confirmed `pnpm test` green (~32s).
2. Ran sequential targeted Stryker (`pnpm exec stryker run --mutate "<file>"`), logs at repo root `stryker-*.log`, HTML at `reports/mutation/mutation.html` (last run wins).
3. Parsed clear-text `[Survived]` blocks; clustered by line range and function.
4. Mapped clusters → responsible test file → missing oracle → risk # → user-visible vs equivalent per test-plan §6.7.

**Not run** (defer): other `src/hooks/*` modules, `guest.ts` router wrapper (logic in lib), full-repo Stryker. **Anomaly**: 6 hook mutants **timed out** (within §6.7 known hook-layer anomaly); 0 RuntimeError crashes in this session.

---

## Survived-mutant inventory (representative clusters)

Full raw counts: hook **924**, routers+lib+trpc **278**. Table lists **highest-ROI clusters** (not every mutant).

| file:line | mutator | risk # | responsible test file | missing oracle | user-visible? |
|-----------|---------|--------|----------------------|----------------|---------------|
| **Bucket 1 — `src/hooks/` (cycle state, recovery, timer)** |
| `use-pomodoro-cycle.ts:145` | ConditionalExpression | #1, #2 | `use-pomodoro-cycle.test.tsx` | PAUSED branch in `cycleEndTimeMs` — assert resume uses `remainingDurationSec`, not wall `startedAt` | **yes** |
| `use-pomodoro-cycle.ts:151` | ArithmeticOperator | #2 | same + guest test | E2E client-timer path endTime uses `configuredDurationSec` from server shape | **yes** |
| `use-pomodoro-cycle.ts:660` | ConditionalExpression | #2 | same | `handleCycleExpired` state guard — expire only when `running`; assert no complete when paused/idle | **yes** |
| `use-pomodoro-cycle.ts:791` | ConditionalExpression | #2 | same | `recalculateFromEndTime` guard when not running | **yes** |
| `use-pomodoro-cycle.ts:836` | EqualityOperator | #2 | same (`recalculates remaining within ±2s`) | Boundary at exact expiry (`<=` vs `<`) — assert transition at `remainingMs === 0` | **yes** |
| `use-pomodoro-cycle.ts:965` | LogicalOperator | #1 | same (`resumes running state from getActive`) | Recovery guard `activeCycleRecoveredForMode \|\| recoveredRef` — assert **single** `getActive` on double mount/mode flip | **yes** |
| `use-pomodoro-cycle.ts:999` | BlockStatement | #1 | same | No-active branch must still run timeout-closure / `sessionStartIdleFlag` | **yes** |
| `use-pomodoro-cycle.ts:1129` | BooleanLiteral | #2 | catchUp tests | `tabWasHiddenWhileRunningRef` cleared on visible return — catchUp vs no-catchUp | **yes** |
| `use-pomodoro-cycle.ts:2067` | ConditionalExpression | #2 | optimistic start tests | Reconcile worker when `\|endTime - optimisticEndTime\| > 2000` — assert `remainingMs` updates | **yes** |
| `use-pomodoro-cycle.ts:2474` | ConditionalExpression | #3 | mid-cycle tests | `incrementInterruption` forwarded to `cycles.complete` on end-break path | **yes** |
| `use-pomodoro-cycle.ts:2575` | ConditionalExpression | #3 | check-in / confirm tests | WORK vs break branch in `confirmComplete` — break must not skip check-in gate on auth WORK | **yes** |
| `use-pomodoro-cycle.ts:3011` | ConditionalExpression | #3 | mid-cycle tests | `onMidCycleMarkComplete` guards (`running` + `WORK` + activeCycle) | **yes** |
| `use-pomodoro-cycle.ts:3102` | BlockStatement | #3, #7 | check-in tests | `onCycleCompleteConfirm` sets `awaitingCheckIn` for auth WORK | **yes** |
| `use-pomodoro-cycle.ts:3140` | BooleanLiteral | #3 | wind-down tests | Wind-down path must set `isConfirming` during async check-in save | **yes** |
| `use-pomodoro-cycle.ts:2770` | ConditionalExpression | #7, #11 | wedge sync tests | `continueAfterCheckIn` requires `energy` when check-in not pre-saved | **yes** |
| `use-pomodoro-cycle.ts:2824` | ConditionalExpression | #2 | optimistic check-in tests | Break endTime reconcile `\> 2000ms` drift | **yes** |
| `use-pomodoro-cycle.ts:2894` | BlockStatement | #11 | wedge recovery tests | Rollback vs preserve break on partial failure phases | **yes** |
| `use-pomodoro-cycle.ts:3415` | LogicalOperator | #1 | endSession tests | `endSession` interrupts only when **both** activeCycle and `running`/`paused` | **yes** |
| `use-pomodoro-cycle.ts:3667` | ConditionalExpression | #3 | kickoff steering tests | `showSessionEnergy` = `sessionEnergyPending && kickoffEligible` — assert false when eligible but not pending | **yes** |
| `use-pomodoro-cycle.ts:90` | BlockStatement | #1 | closure tests | `markClosureShown` / sessionStorage write | equivalent (SSR) |
| `use-pomodoro-cycle.ts:3612` | ObjectLiteral | — | dashboard tests | `buildInFlowSummary` args | defer (display copy) |
| `use-pomodoro-cycle.ts:3618` | ArrayDeclaration | — | same | `useMemo` deps for `inFlowSummaryLine` | defer |
| **Bucket 2 — `src/server/api/routers/` + middleware** |
| `cycle.ts:19` | ConditionalExpression / ObjectLiteral | #4, #6 | `cycle.test.ts`, `cycle-isolation.test.ts` | `list` must filter `sessionId` in Prisma `where`; assert **call args**, not only empty result | **yes** |
| `cycle.ts:102` | ConditionalExpression / BlockStatement | #4, #6 | `cycle-isolation.test.ts` | `create` rejects foreign `sessionId` — assert `findFirst` where includes `userId` + throws before create | **yes** |
| `cycle.ts:111` | BlockStatement | #4, #6 | same | Foreign `taskId` on create — same `where` oracle | **yes** |
| `cycle.ts:200` | ConditionalExpression | #1 | `cycle.test.ts` | `complete` `count === 0` → BAD_REQUEST; assert no task side-effects | **yes** |
| `cycle.ts:207` | ConditionalExpression | #3 | same | `markTaskDone` only when flag true | **yes** |
| `cycle.ts:239` | ConditionalExpression | #3 | same | `incrementInterruption` on session update | **yes** |
| `cycle.ts:391` | ConditionalExpression | #1 | `cycle.test.ts` (pause) | `remainingDurationSec > configuredDurationSec` rejection | **yes** |
| `cycle.ts:451` | ArithmeticOperator | #1, #2 | pause round-trip test | `resume` clamps remaining / recomputes `startedAt` | **yes** |
| `task.ts:30` | ObjectLiteral | #4 | `task-mutation.test.ts`, `task.test.ts` | `nextActiveSortOrder` aggregate **must** scope `where: { userId, status: "active" }` | **yes** |
| `task.ts:153` | BlockStatement | #4, #6 | `task-mutation.test.ts` | `update` NOT_FOUND when `findFirst` null — assert no `update` call | **yes** |
| `task.ts:199` | ConditionalExpression | #4 | `task.test.ts` (reorder) | Reorder set-size validation | **yes** |
| `task.ts:53` | ConditionalExpression | #4 | `task.test.ts` | `localDateKey` branch for `doneForToday` | **yes** |
| `session.ts:57` | ConditionalExpression | #1 | `session.test.ts` | `end` when no ACTIVE session → NOT_FOUND | **yes** |
| `session.ts:88` | ConditionalExpression | #1 | same | `updateMany` count === 0 handling | **yes** |
| `check-in.ts:32` | BlockStatement | #4, #6 | `check-in-isolation.test.ts` | Cycle ownership check before create — assert `findFirst` where | **yes** |
| `check-in.ts:50` | ConditionalExpression | #7 | `check-in.test.ts` | Duplicate check-in CONFLICT | **yes** |
| `suggestion.ts:186` | ConditionalExpression | #7 | `suggestion.test.ts` | Post-check-in requires `cycle.checkIn` | **yes** |
| `suggestion.ts:282` | ConditionalExpression | #3 | same | Kickoff requires ACTIVE session | **yes** |
| `suggestion.ts:139` | ConditionalExpression | #4, #6 | `suggestion-isolation.test.ts` | `verifyOwnedTasks` both tasks active+owned | **yes** |
| `trpc.ts:139` | ConditionalExpression / LogicalOperator | #4, #6 | **none** (gap) | `enforceAuth` must throw UNAUTHORIZED when session incomplete — **direct middleware unit test** | **yes** |
| `trpc.ts:36` | ConditionalExpression | #4 | **none** | `createTRPCContext` session hydration when auth partial | **yes** |
| **Bucket 3 — guest import (`src/server/api/lib/`)** |
| `import-guest-snapshot.ts:26` | ConditionalExpression | #5 | `guest.test.ts`, `import-guest-snapshot.test.ts` | Empty snapshot early return — assert **`$transaction` not called** | **yes** |
| `import-guest-snapshot.ts:36` | StringLiteral / ObjectLiteral | #5 | `guest.test.ts` | Close account RUNNING+PAUSED before import — assert `updateMany` where `state in [RUNNING, PAUSED]` | **yes** |
| `import-guest-snapshot.ts:117` | EqualityOperator | #5 | same | Expired RUNNING normalization (`expiresAt <= now`) | **yes** |
| `import-guest-snapshot.ts:110` | ConditionalExpression | #5 | same | Unmapped `taskId` → null (not throw) | **yes** |
| `import-guest-snapshot.ts:84` | ConditionalExpression | #5 | same | Session row creation when snapshot has session | **yes** |
| `import-guest-snapshot.ts:8` | ConditionalExpression | #5 | unit test | `resolveUniqueTitle` suffix loop | equivalent (pure helper; partially covered) |

---

## Prioritized kill-list (user-visible only)

### 1) `src/hooks/` — cycle state machine, recovery, visibility (Risks #1–#3)

1. **`cycleEndTimeMs` PAUSED path** (`:145–151`) — assert frozen remaining on hydrate/recover; kills timer drift on pause resume (#1, #2).
2. **Recovery guard** (`:965–1021`) — single recovery, completedWorkCycles from server, timeout closure on idle hydrate (#1).
3. **Visibility / expiry** (`:659–683`, `:790–807`, `:1115–1138`) — running-only recalc; catchUp when hidden; exact expiry boundary (#2).
4. **Optimistic reconcile >2s** (`:2067`, `:2824`) — server `startedAt` drift adjusts worker (#2).
5. **Mid-cycle + check-in gates** (`:3010–3106`, `:2575`) — FR-015 paths cannot be bypassed (#3).
6. **`continueAfterCheckIn` wedge chain** (`:2671–2905`) — phase-specific failure preserves break/check-in intent (#3, #7, #11).
7. **`endSession` interrupt preconditions** (`:3415–3448`) — running/paused WORK interrupted before session end (#1).
8. **Kickoff steering visibility** (`:3667–3668`) — `showSessionEnergy/Focus` coupled to pending flags (#3).

**Primary test targets**: `src/hooks/use-pomodoro-cycle.test.tsx` (extend), `src/hooks/use-pomodoro-cycle-guest.test.tsx` (guest recovery parity).

### 2) `src/server/api/routers/` + `trpc.ts` (Risks #4, #6)

1. **`trpc.ts:139` `enforceAuth`** — new focused test file or `trpc.test.ts`: caller with `session: null` / missing email → UNAUTHORIZED on `protectedProcedure` (#4, #6). **Critical gap**: all router tests mock session; middleware survives complete bypass.
2. **`cycle.list` sessionId filter** (`cycle.ts:19`) — assert Prisma `findMany` args include `sessionId` when provided (#6).
3. **`cycle.create` FK ownership** (`:98–114`) — assert `findFirst` where `{ id, userId }` before create (#4, #6).
4. **`task.nextActiveSortOrder`** (`task.ts:30–34`) — assert aggregate scoped to `userId` (#4).
5. **`task.update/delete` NOT_FOUND** — assert zero `update`/`delete` when ownership miss (#6).
6. **`cycle.complete` side-effects** — `markTaskDone`, `incrementInterruption`, day-plan minutes (#3, #1).
7. **`check-in.create` ownership** — `findFirst` where before insert (#4, #6).

**Primary test targets**: extend `cycle.test.ts`, `cycle-isolation.test.ts`, `task-mutation.test.ts`, `check-in-isolation.test.ts`; **add** `src/server/api/trpc.test.ts`.

### 3) `src/server/api/lib/` guest import (Risk #5)

1. **Empty snapshot short-circuit** (`:25–30`) — no `$transaction` (#5).
2. **RUNNING/PAUSED closure** (`:35–38`) — state filter in `updateMany` (#5).
3. **Expired RUNNING → COMPLETED** (`:114–128`) — `endedAt` set (#5).
4. **Unmapped taskId → null** (`:109–112`) — cycle row shape (#5).

**Primary test targets**: `src/server/api/routers/guest.test.ts`, `src/server/api/lib/import-guest-snapshot.test.ts`.

---

## Potential production bugs (flag loudly)

These are **not** test-only gaps — mutants imply **live code could regress user-visible behavior** if the same edit were made in production:

| location | mutant effect | user impact | decision |
|----------|---------------|-------------|----------|
| `trpc.ts:139` | `enforceAuth` condition → `false` | Unauthenticated access to **all** protected procedures if context session empty | **Fix + test** — add middleware tests; consider runtime audit |
| `use-pomodoro-cycle.ts:145` | Skip PAUSED branch in `cycleEndTimeMs` | Paused cycle resume shows wrong remaining / expires immediately | **Test oracle** (likely already correct in prod; mutant proves gap) |
| `import-guest-snapshot.ts:26` | Empty-check → `false` | Sign-in merge runs DB transaction on empty snapshot — spurious closure of active cycles | **Test oracle** |
| `cycle.ts:102–112` | Remove NOT_FOUND throws on create | Foreign session/task FK may reach Prisma (P2003 path only) — error surface not NOT_FOUND | **Test oracle** — isolation tests pass but wrong error/leak window |

No confirmed **live** bug without mutation applied; Stryker shows **latent** vulnerabilities tests do not detect.

---

## Equivalent / ignore list (sample)

| cluster | rationale |
|---------|-----------|
| Hook `markClosureShown` / `wasClosureShown` SSR guards (`:90–101`) | jsdom always has `window`; sessionStorage oracles belong in component/e2e |
| Hook `retryOnce` (`:316–325`) | Resilience helper; defer unless flaky network tests added |
| Hook `inFlowSummaryLine` useMemo deps / empty args (`:3595–3631`) | Display-only copy; dashboard tests cover visibility |
| Hook `POMODORO_ALARM_URL` string literals | No user-visible branch |
| Router Prisma `orderBy: { startedAt: "" }` string mutants | Would fail real DB; mocks too permissive — **ignore in Phase 5** unless integration uses strict call validation |
| `suggestion.ts` scoring/rationale string literals | Business copy not safety-critical |
| `timingMiddleware` dev delay (`trpc.ts:107–116`) | Dev-only logging/delay |
| 6 hook **timeout** mutants | Investigate separately per §6.7 anomaly; not oracle backlog |

---

## Risk coverage map (risks #1–#6)

| Risk | Survivors (clusters) | Weak test files | Phase 5 action |
|------|---------------------|-----------------|----------------|
| **#1** Refresh/crash recovery | Hook recovery `:965–1021`, `:809–856`; `cycle.getActive`; `session.end`; pause persist | `use-pomodoro-cycle.test.tsx`, `cycle.test.ts` | Assert hydrated **phase**, **remainingMs**, **task binding**; Prisma `where` on getActive |
| **#2** Timer drift ±2s | Hook timer `:139–152`, `:659–807`, `:1115–1138`, optimistic reconcile | `use-pomodoro-cycle.test.tsx`, `countdown-tolerance` helpers | Tighten boundary/expiry; PAUSED freeze; worker reconcile |
| **#3** Mid-cycle / check-in prompts | Hook `:3010–3106`, `:2575`, `:2671–2905`; `cycle.complete`; `suggestion.next` gates | Hook tests + `cycle.test.ts` + `suggestion.test.ts` | Assert gate flags + server call order |
| **#4** Per-user isolation | Router `where: { userId }` survives; **`trpc enforceAuth`** | Isolation tests mock DB **without** call-arg assertions; **no trpc tests** | **Prisma call inspection** + middleware auth tests |
| **#5** Guest merge | `import-guest-snapshot` empty guard, RUNNING closure, expiry | `guest.test.ts` | Assert transaction boundaries + cycle states |
| **#6** IDOR | Same as #4 plus `cycle.list` sessionId filter; task/cycle NOT_FOUND branches | `cycle-isolation.test.ts`, `task-mutation.test.ts` | Cross-user + **assert no write** on NOT_FOUND |

---

## Detailed findings

### Hook layer (`use-pomodoro-cycle.ts`)

- **924 covered survivors** / 2,432 tested mutants; dominant mutator: **ConditionalExpression (353)**.
- Densest clusters: **kickoff/suggestion steering (1000–1199)**, **endSession/windDown (3400–3599)**, **continueAfterCheckIn (2671–2905)**, **start/interrupt (2000–2199)**.
- Existing tests (97+ cases in `use-pomodoro-cycle.test.tsx`) kill optimistic paths well (Q-08) but **assert outcomes not intermediate guards** — conditional mutants survive with 16+ tests ran.
- **Guest paths** share source file; `use-pomodoro-cycle-guest.test.tsx` covers recovery/catchUp only — guest wedge chains rely on auth tests or survive.

### Router layer

- **Isolation tests** verify NOT_FOUND/empty for attacker but **mock `findFirst` without verifying query shape** — deleting `userId` from production code may still return null in tests.
- **`cycle.ts` best (75.51%)**; **`check-in.ts` worst (38.71%)** — only 31 mutants, 19 survived.
- **`suggestion.ts` (80.79%)** — scoring paths well tested; remaining survivors mostly input validation edges.

### Middleware (`trpc.ts`)

- **18.37% covered / 40 survived** — integration suite **never exercises** `enforceAuth` failure paths because `createCaller` injects session directly.
- **Highest priority new test artifact** for Phase 5.

### Guest import lib

- Integration tests in `guest.test.ts` cover happy paths from §6.5 cookbook but **do not spy on `$transaction` absence** for empty snapshot or **`updateMany` where clause** for RUNNING closure.

---

## Architecture insights

- **Oracle pattern gap**: tests favor **behavioral outcomes** (state, error message) over **structural guarantees** (Prisma args, middleware throws, call counts).
- **Mock-at-DB-boundary** enables fast integration but **hides ownership regressions** unless combined with `toHaveBeenCalledWith` on `where`.
- **Monolithic hook** concentrates mutation debt; conductor/wedge additions post-Q-08 increased conditional surface faster than assertive coverage.
- **Strong reference oracles** elsewhere: `timer-worker-logic.ts` (100%), `active-session.ts` (92%) — copy **call-arg + boundary** patterns.

---

## Historical context

- **2026-06-06** full Stryker: 58.2% covered, 685 survived — Phase 5 opened as optional backlog post-Q-08 (`test-plan.md` §8).
- **Q-08** (`testing-prd-v3-wedge-coherence`) added wedge oracles but explicitly **did not** complete mutation hardening (§6.6 limitation).
- Phase 3 isolation (`testing-isolation-abuse-guest-merge`) established dual-user pattern; mutation runs show **pattern insufficient for oracle depth**.

---

## Open questions / blockers

1. **Other `src/hooks/*`** (~11 modules) not Stryker-scoped this session — include in plan Phase 2 or defer?
2. **Hook mutant timeouts (6)** — rerun with `--timeoutMS` / `--concurrency 1` or exclude lines?
3. **`reports/dependency-report.html`** breaks Stryker preprocessor (warn only) — add to `ignorePatterns` in plan?
4. **Full-repo Stryker** deferred — need refresh baseline after Phase 5 lands?
5. **`enforceAuth`**: plan middleware tests only, or also e2e unauthenticated API probe?

---

## Confidence

**82 / 100** that a planner can write a targeted Phase 5 plan from this research.

- **High** on file-level scores, cluster priorities, and middleware/guest-import gaps (direct Stryker evidence).
- **Medium** on exact user-visible survivor count (924 hook survivors need phased triage; ~30% rule applied by cluster sampling).
- **Lower** for hooks not run (`use-task-mutations`, etc.) and timeout mutants without line-level IDs.

---

## Code references

- `src/hooks/use-pomodoro-cycle.ts` — primary mutation surface (924 survived covered)
- `src/hooks/use-pomodoro-cycle.test.tsx` — 97+ hook oracles to extend
- `src/server/api/trpc.ts:137–161` — `enforceAuth` (40 survived, 18% covered)
- `src/server/api/routers/cycle.ts:19,98–114,200–244` — list/create/complete ownership
- `src/server/api/routers/task.ts:19–35,152–184` — sortOrder + update ownership
- `src/server/api/lib/import-guest-snapshot.ts:25–38,114–128` — merge integrity
- `stryker-*.log` (repo root) — full survived listings per file
- `context/foundation/test-plan.md` §6.7 — review rule and priority order
