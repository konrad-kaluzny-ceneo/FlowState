# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-06-06 (mutation baseline refresh)

## 1. Strategy

Tests follow three non-negotiable principles for this project:

1. **Cost × signal.** The cheapest test that gives a real signal for the
   risk wins. Do not promote to e2e because e2e "feels safer." Do not put a
   vision model on top of a deterministic visual diff that already catches
   the regression.
2. **User concerns are first-class evidence.** Risks anchored in "the
   team is worried about X, and the failure would surface somewhere in
   <area>" carry the same weight as PRD lines or hot-spot data.
3. **Risks are scenarios, not code locations.** This plan documents *what
   could fail* and *why we believe it's likely* — drawn from documents,
   interview, and codebase *signal* (churn, structure, test base). It does
   NOT claim to know which line owns the failure. That knowledge is
   produced by `/10x-research` during each rollout phase. If the plan and
   research disagree about where the failure lives, research is the
   ground truth.

Hot-spot scope used for likelihood weighting: `src/`, `e2e/`, `prisma/`.

## 2. Risk Map

The top failure scenarios this project must protect against, ordered by
risk = impact × likelihood. Risks are failure scenarios in user / business
terms, not test names. The Source column cites the *evidence that surfaced
this risk* — never a specific file as "where the failure lives" (that is
research's job, see §1 principle #3).

| # | Risk (failure scenario) | Impact | Likelihood | Source (evidence — not anchor) |
|---|-------------------------|--------|------------|--------------------------------|
| 1 | Page refresh or crash during an active Pomodoro leaves the user with a missing or wrong task list or cycle state | High | High | PRD guardrail (no silent data loss); interview Q1; roadmap S-01 NFR (crash/refresh recovery); Stryker 2026-06-06 — hot-spot dir `src/hooks/` (170 survived mutants on covered code); hot-spot dir `src/app/_components/` (359 no-coverage mutants) |
| 2 | Work cycle elapsed time drifts beyond ±2 seconds when the browser tab is backgrounded | High | High | PRD NFR (timer drift ≤ ±2s); interview Q3; hot-spot dir `src/hooks/` (21 commits/30d; 170 survived mutants); hot-spot dir `src/workers/` (5 commits/30d; timer-worker-logic 100% mutation score) |
| 3 | Marking a task done mid-cycle offers wrong choices or skips the mindful break/end prompt | Medium | High | PRD FR-015; roadmap S-03 active; interview Q4; Stryker 2026-06-06 — hot-spot dir `src/app/_components/` (359 no-coverage mutants including task-list UI) |
| 4 | Authenticated user reads or mutates another user's tasks, sessions, or cycles | High | High | PRD guardrail (strict per-user isolation); PRD access control; Stryker 2026-06-06 — hot-spot dir `src/server/api/routers/` (~150 survived mutants despite Phase 3 integration) |
| 5 | Guest trial tasks or cycles are lost or silently overwritten on sign-in merge | High | Medium | PRD FR-003c; roadmap S-08 proposed; PRD guardrail (no silent data loss); Stryker 2026-06-06 — hot-spot dir `src/lib/repositories/` (192 no-coverage mutants in guest persistence layer) |
| 6 | Attacker with a valid session manipulates resource IDs to access another user's tasks or cycles (IDOR) | High | Medium | PRD access control (abuse lens — ownership not just authentication) |
| 7 | End-of-cycle check-in can be skipped or declared energy fails to persist for the next suggestion | Medium | Medium | PRD FR-020; roadmap S-05 active |

### Risk Response Guidance

| Risk | What would prove protection | Must challenge | Context `/10x-research` must ground | Likely cheapest layer | Anti-pattern to avoid |
|------|-----------------------------|----------------|--------------------------------------|-----------------------|-----------------------|
| #1 | After refresh mid-active work cycle, user sees the same tasks and the cycle resumes at the correct phase and remaining time | "Hydration on mount" implies server and client state agree; empty task list on slow network is acceptable | Refresh entry point; persisted cycle + task state shape; guest vs authenticated persistence boundaries | Integration (server caller + DB fixture) before browser e2e; hook tests must kill conditional/branch mutants on recovery paths | Asserting save-format fields copied from implementation rather than user-visible restored state; e2e reload alone while hook branches survive (Stryker: 170 survived in `src/hooks/`) |
| #2 | At cycle end in a backgrounded tab, elapsed time is within ±2s of the configured work duration | Fake timers in jsdom prove throttled-tab behavior; client-only clock is authoritative | Clock authority (worker vs main thread vs server `startedAt`); visibility/throttle handling | Unit (timer worker) + hook integration with controlled time; e2e only if cheaper layers cannot simulate throttling | Testing raw `setInterval` without background-throttle or worker path; relying on worker unit tests while hook visibility/fallback branches survive |
| #3 | Completing a task during an active cycle always surfaces FR-015 choices; with no active tasks left, only "end cycle and break" is offered | Happy-path completion without in-flight cycle state | Mid-cycle UI gate; cycle in-flight detection; task list empty edge case | Playwright e2e with authenticated fixture | Unit-testing prompt component in isolation without cycle-in-flight context |
| #4 | No tRPC query or mutation returns another user's tasks, sessions, cycles, or check-ins | "Protected procedure" label implies row-level ownership checks on every read/write | Auth context injection; ownership filter on every list/get/mutate path | Integration (dual-user callers, expect forbidden/not-found); per-router mutation runs until survived count drops | Mocking auth middleware while skipping DB-level isolation assertions; happy-path-only router tests that pass when ownership checks are deleted (Stryker: ~150 survived in `src/server/api/routers/`) |
| #5 | After sign-in, guest tasks and cycles appear in the account; title collisions get numbered suffixes; guest blob cleared only after successful merge | Merge test passes when guest blob is empty; suffix logic mirrors production string concat | Guest blob schema version; merge transaction boundary; collision suffix policy | Integration (merge procedure + repository layer) + one browser merge e2e | Asserting suffix algorithm by copying production helper output as oracle; integration-only merge while guest repository layer has 192 no-coverage mutants |
| #6 | Mutating or fetching a task/cycle/session ID belonging to another user returns forbidden or not-found, not the foreign row | Logged-in user implies any ID is reachable if auth passes | ID parameters on mutations; ownership check before update/delete | Integration (cross-user ID swap on each router) | Only testing "unauthenticated → 401" without cross-user IDOR |
| #7 | Every completed work cycle requires an energy check-in before transition; stored value is readable for the next suggestion | Check-in UI mount implies persistence; skipping modal via keyboard is acceptable UX | Cycle-end transition gate; check-in persistence model; S-05 vs S-06 boundary | Playwright e2e once S-05 UI lands; integration for persistence until then | Snapshot of check-in modal without asserting gate blocks transition |

## 3. Phased Rollout

Each row is a discrete rollout phase that will open its own change folder
via `/10x-new`. Status moves left-to-right through the values below; the
orchestrator updates Status as artifacts appear on disk.

| # | Phase name | Goal (one line) | Risks covered | Test types | Status | Change folder |
|---|------------|-----------------|---------------|------------|--------|---------------|
| 1 | Critical-path persistence & timer | Prove refresh/crash recovery and background-tab timer accuracy at the cheapest layers that catch real regressions | #1, #2 | unit + integration + targeted e2e | complete | testing-critical-path-persistence-timer |
| 2 | Active-slice browser proofs | Browser-level proof for S-03 mid-cycle prompt and S-05 check-in gate before wedge work compounds | #3, #7 | Playwright e2e | complete | testing-active-slice-browser-proofs |
| 3 | Isolation, abuse & guest merge | Lock per-user isolation, IDOR rejection, and guest→account merge integrity | #4, #5, #6 | integration | complete | testing-isolation-abuse-guest-merge |
| 4 | Quality-gates wiring | Enforce lint, typecheck, unit/integration, and critical e2e in CI on every PR | cross-cutting | CI gates | complete | testing-quality-gates-wiring |
| 5 | Mutation oracle hardening | Raise covered-code mutation score from ~58% by killing survived mutants in hooks and server routers — tests exist but assertions are too weak | #1, #2, #3, #4, #5, #6 | unit + integration (targeted Stryker runs) | not started | — |
| 6 | Uncovered UI & auth paths | Exercise task-list, dashboard, and auth action paths so no-coverage mutants drop — largest score drag but narrower than Phase 5 per test | #1, #3, #5 | component smoke + integration | not started | — |

## 4. Stack

The classic test base for this project. AI-native tools (if any) carry a
`checked:` date so future readers can see which lines need re-verification.
Recommendations in this section must be grounded in local manifests/configs
plus the MCP/tools actually exposed in the current session.

| Layer | Tool | Version | Notes |
|-------|------|---------|-------|
| unit + integration | Vitest | 4.1.7 | jsdom environment; co-located `*.test.ts(x)` under `src/`; fast-check for properties |
| API / server integration | Vitest + tRPC createCaller | 4.1.7 | Router isolation tests pattern already in repo; exclude `e2e/` from Vitest |
| e2e | Playwright | 1.60.0 | Authenticated fixture from F-02; always `set CI=true && pnpm test:e2e` per AGENTS.md |
| property-based | fast-check | 4.8.0 | Via `@fast-check/vitest` where input spaces are wide |
| mutation testing | Stryker + Vitest runner | 9.6.1 | `pnpm test:mutate`; HTML report at `reports/mutation/mutation.html`; thresholds high 80 / low 60 / break null |
| accessibility | none yet | — | See Phase 2 if check-in/mid-cycle modals need axe — only if e2e misses a11y regressions |

**Mutation baseline (Stryker full run, 2026-06-06):**

| Metric | Value |
|--------|------:|
| Total mutants | 2,883 |
| Mutation score (of total) | 33.1% |
| Mutation score (of covered code) | 58.2% |
| Killed | 951 |
| Survived | 685 |
| No coverage | 1,243 |
| Runtime errors | 1 |

Interpretation: the suite has **breadth** (Phase 1–3 shipped) but **shallow oracles** on covered paths and **large UI/auth gaps** on uncovered paths. Phase 5 targets survived mutants (cheapest signal); Phase 6 targets no-coverage clusters. Do not chase 100% — review survivors for user-visible bugs only (AGENTS.md).

**Stack grounding tools (current session):**
- Docs: Context7 MCP (`project-0-FlowState-context7`) — available for Vitest/Playwright/Next.js API verification during rollout phases; checked: 2026-06-03
- Search: Web search MCP — available for current tool status when docs MCP insufficient; Exa.ai not available in current session; checked: 2026-06-03
- Runtime/browser: cursor-ide-browser MCP — available for manual/ad-hoc verification; prefer Playwright in CI for deterministic signal; checked: 2026-06-03
- Provider/platform: GitHub (`gh`), Linear MCP, Vercel skill — CI gate wiring and deployment verification in Phase 4; Neon MCP for DB fixture exploration; checked: 2026-06-03

Test-base profile: **meaningful** — Vitest + Playwright configured; ~35 test files spread across `src/` and `e2e/` (not the stale health-check snapshot).

## 5. Quality Gates

The full set of gates that must pass before a change reaches production.
"Required for §3 Phase N" means the gate is enforced once that rollout
phase lands; before that, the gate is `planned`.

| Gate | Where | Required? | Catches |
|------|-------|-----------|---------|
| lint + typecheck (`pnpm check`, `pnpm typecheck`) | local | required | syntactic / type drift |
| unit + integration (`pnpm test`) | local | required | logic regressions in routers, hooks, workers |
| e2e critical flows (`set CI=true && pnpm test:e2e`) | local + CI | required | broken auth, cycle, and active-slice UI paths |
| PR CI workflow | GitHub Actions | required | merges without test suite |
| mutation score floor (covered code ≥ 60%) | local + optional CI after §3 Phase 5 | planned after §3 Phase 5 | tests that pass when logic is deleted; shallow oracles |
| pre-prod smoke | Vercel preview | optional | environment-specific failures |

## 6. Cookbook Patterns

How to add new tests in this project. Each sub-section is filled in once
the relevant rollout phase ships; before that, the sub-section reads
"TBD — see §3 Phase N."

### 6.1 Adding a unit test

- **Location**: co-located next to source — `src/**/*.test.ts` or `*.test.tsx`; shared oracles in `src/test-utils/`.
- **Naming**: `<module>.test.ts(x)` (existing convention).
- **Reference tests**: `src/workers/timer-worker.test.ts` (`getTimerTickResult` at `endTime ± 2s`); `src/test-utils/countdown-tolerance.test.ts` (mm:ss parse + tolerance); `src/lib/format-remaining.test.ts` (display ceil rule).
- **Timer drift (Risk #2)**: assert hook `remainingMs` within ±2000ms of `endTime - now` — not parsed mm:ss from hook state (avoids `formatRemainingMs` ceil noise). Use `assertRemainingMsWithinTolerance` from `src/test-utils/countdown-tolerance.ts`.
- **Refresh recovery math**: guest snapshot edge cases in `src/lib/repositories/guest-repositories.test.ts`; auth/guest hook recovery in `src/hooks/use-pomodoro-cycle.test.tsx` and `use-pomodoro-cycle-guest.test.tsx`.
- **Run locally**: `pnpm test` or `pnpm exec vitest run src/path/to/module.test.ts`.

### 6.2 Adding a tRPC integration test

- **Location**: co-located with router — `src/server/api/routers/<feature>.test.ts`.
- **Mocking policy**: mock DB at Prisma boundary or use test fixtures; never skip auth/isolation when testing protected procedures.
- **Reference tests**: `src/server/api/routers/session-isolation.test.ts`, `src/server/api/routers/cycle-isolation.test.ts`; active-cycle + task shape after `create` → `getActive` in `src/server/api/routers/cycle.test.ts` (`integration: create → getActive → complete`).
- **Persistence (Risk #1)**: extend an existing integration flow with recovery-field assertions (`taskId`, `task.title`, `startedAt`, `configuredDurationSec`, `state: RUNNING`) — avoid a duplicate seeded-only `getActive` test when one already exists.
- **Cross-user IDOR (Risks #4, #6)**: dual-user `createCaller` with `VICTIM_ID` / `ATTACKER_ID`; expect `NOT_FOUND` on mutations (not `FORBIDDEN`) and empty/`null`/`0` on scoped queries. Reference: `task-mutation.test.ts` (stateful `findFirst` by `{ id, userId }`), `task-isolation.test.ts` (list), `cycle.test.ts` (`getActive`, `countCompletedWork`, `list(sessionId)` cross-user cases), `cycle-isolation.test.ts` (FK injection on `sessionId` and `taskId`), `session.test.ts` (`getOrCreateActive` smoke), `check-in-isolation.test.ts` (list isolation, cross-user `cycleId`, duplicate `CONFLICT`).
- **Check-in persistence (Risk #7, integration)**: imperative `create → list` round-trip in `check-in.test.ts` — assert `energy`/`cycleId`/`userId` on create return and list contents; mock `findMany` must honor `orderBy: { respondedAt: "desc" }` and `take: DEFAULT_LIST_LIMIT`. Reference tests: `create persists energy readable via list`, `round-trips energy FOCUSED/STEADY/FADING`, `list returns newest check-in first`, `list honors DEFAULT_LIST_LIMIT`. UI modal gate / skip prevention remains test-plan Phase 2 e2e.
- **Run locally**: `pnpm test`.

### 6.3 Adding an e2e test

- **Generation exemplar**: `e2e/seed.spec.ts` — model every new spec on this file (provenance header, fixture auth, helpers, business-outcome assertions). Rules in `AGENTS.md` § E2E Testing Rules; run deliberate-break VERIFY and record in `e2e/DELIBERATE-BREAK.md` before merging critical specs.
- **Location**: `e2e/*.spec.ts`.
- **Helpers**: `e2e/helpers/work-cycle.ts` — `setWorkDurationSec`, `startFocusedWorkCycle`, `advanceClockThroughFastWork`, `addTask`, `addTasks`, `markTaskCompleteMidCycle`. `e2e/helpers/check-in.ts` — `completeCheckIn(page, "focused" | "steady" | "fading")` after S-01 overlay confirm on auth WORK cycles. `e2e/helpers/idle-cycle.ts` — `ensureIdleCycle` dismisses stranded check-in (default `steady`), mid-cycle prompt, cycle-complete overlay, running cycle, and enabled end-session.
- **Auth mid-cycle reload (Risk #1 UI)**: `e2e/persistence-reload.spec.ts` — set work duration via `work-duration-min` / `work-duration-sec` (e.g. 0 min 30 sec) using `setWorkDurationSec` in `e2e/helpers/work-cycle.ts`, `page.reload()`, re-wait for `cycle.getActive`, assert task row + `timer-panel-running` (no ±2s countdown oracle; timer accuracy is hook/unit). Shared idle reset: `e2e/helpers/idle-cycle.ts`.
- **Guest reload**: `e2e/guest-trial.spec.ts` — same UI assertions; guest banner still visible.
- **Phase 2 browser proofs (Risks #3, #7)**: `e2e/mid-cycle-completion.spec.ts`, `e2e/mid-cycle-last-task.spec.ts`; S-01 regression with check-in step in `e2e/pomodoro-cycle.spec.ts`. Dedicated `check-in-gate.spec.ts` deferred — see §6.6 Phase 2 deferred e2e.
- **±2s tolerance**: use `src/test-utils/countdown-tolerance.ts` in Vitest only, not Playwright reload specs (scope addendum: `context/changes/testing-critical-path-persistence-timer/reviews/scope-addendum.md`).
- **Auth isolation**: per-test API sign-up/sign-in via `e2e/fixtures.ts` (no shared `playwright/.auth/user.json`).
- **Run locally**: `set CI=true && pnpm test:e2e` (starts `next dev` on 3001 — no full build). Fastest: `next dev --turbo -p 3001` with `NEXT_PUBLIC_E2E_MAIN_THREAD_TIMER=1`, then `set E2E_REUSE_SERVER=1 && set CI=true && pnpm test:e2e`. Prod parity: `set E2E_PRODUCTION_SERVER=1`.
- **Limitation**: e2e uses `NEXT_PUBLIC_E2E_MAIN_THREAD_TIMER=1` — does not exercise production Worker path; Risk #2 is covered by hook/unit tests (see §6.6).

### 6.4 Adding a test for a new tRPC procedure

- **Test type**: integration (preferred over e2e).
- **Pattern**: `createCaller` with session context; assert procedure result and DB side-effects; for protected procedures include cross-user denial case.
- **Reference test**: `src/server/api/routers/task-mutation.test.ts`.
- **When to add e2e instead**: user-visible flow that spans auth cookie + browser timing (cycle UI, modals, audio prompt).

### 6.5 Adding a guest/localStorage test

- **Location**: `src/server/api/routers/guest.test.ts` (router `import` procedure); core merge logic in `src/server/api/lib/import-guest-snapshot.ts`.
- **Mocking policy**: mock `$transaction` with in-memory `tasks` / `sessions` / `cycles` arrays; `cycle.updateMany` must mutate the store (not no-op `{ count: 0 }`) when testing account RUNNING closure.
- **Dual-user**: N/A for merge — caller is always the importing account; test pre-seeded account rows vs guest snapshot payload.
- **Reference tests** (Risk #5):
  - Title collision suffix + FK remap: `imports guest tasks with title suffix on collision and remaps cycle FKs`
  - Account RUNNING closure before import: `closes account RUNNING cycles before importing guest snapshot`
  - Expired guest RUNNING → COMPLETED: `normalizes expired guest RUNNING cycle to COMPLETED with endedAt` (use `startedAt` far enough in the past that `startedAt + configuredDurationSec * 1000 <= Date.now()`)
  - Empty snapshot short-circuit: `returns zero counts for empty snapshot without DB writes`
  - Unmapped cycle taskId: `sets taskId null when guest cycle references unmapped task UUID`
- **Run locally**: `pnpm exec vitest run src/server/api/routers/guest.test.ts`
- **Limitation**: browser guest→auth merge e2e deferred to a follow-up change; integration-only in Phase 3 rollout.

### 6.6 Per-rollout-phase notes

**Phase 1 — Critical-path persistence & timer** (shipped 2026-06-04, change `testing-critical-path-persistence-timer`)

- Risks covered: **#1** (refresh/crash recovery), **#2** (background-tab timer drift ≤ ±2s).
- Layers: unit tick math + countdown oracle (Vitest); integration `getActive` + guest snapshot; hook visibility recalc (fallback path) + guest/auth recovery; auth + guest e2e `reload` asserts task list + `timer-panel-running` only.
- **Explicit limitation**: no Playwright project without `E2E_MAIN_THREAD_TIMER` — Worker throttle in production is validated via `getTimerTickResult` + hook `visibilitychange` / fallback recalc, not browser Worker e2e.
- **E2E durations**: short work cycles use the same min+sec custom UI as users (`work-duration-min`, `work-duration-sec` via `setWorkDurationSec`); no `E2E_FAST_DURATIONS` env flag.
- **Deferred**: dedicated Worker e2e project (cost × signal).

**Phase 3 — Isolation, abuse & guest merge** (shipped 2026-06-05, change `testing-isolation-abuse-guest-merge`)

- Risks covered: **#4** (per-user isolation on reads/mutations), **#5** (guest→account merge integrity), **#6** (IDOR via resource IDs).
- Layers: Vitest integration with in-memory Prisma mocks (`createCaller` + dual-user pattern); no real Neon/Postgres fixtures.
- **Explicit limitation**: no Playwright guest→auth merge e2e in this change — integration merge matrix only; browser proof deferred.
- **Stale RUNNING documented**: `cycle.test.ts` `documents getActive when session ended but cycle still RUNNING` asserts current `getActive` behavior (filters `userId` + `RUNNING` only — no session state join); product fix is a separate change if desired.
- **Consolidation**: `task-query.test.ts` removed; `task-isolation.test.ts` is canonical for Property 10 list isolation.

**Risk #7 integration — check-in persistence** (shipped 2026-06-05, change `testing-check-in-persistence`)

- Risks covered: **#7** (energy check-in persists server-side and is readable via `checkIn.list` for future suggestion logic).
- Layers: Vitest integration with in-memory Prisma mocks in `check-in.test.ts`; security/isolation properties remain in `check-in-isolation.test.ts`.
- **Explicit limitation**: no Playwright check-in modal gate in this change — UI skip-prevention proof deferred to test-plan Phase 2 (e2e risks #3/#7).
- **Not a §3 rollout row**: ad-hoc slice documented here; S-05 UI will add browser proof later.

**Phase 2 — Active-slice browser proofs** (shipped 2026-06-06, change `testing-active-slice-browser-proofs`)

- Risks covered: **#3** (mid-cycle FR-015 prompt — both choices vs end-break-only), **#7** (check-in gate blocks WORK→break until energy selected; `checkIn.create` oracle).
- Product slices: S-03 (`MidCycleCompletionPrompt`, `cycles.rebindTask`), S-05 (`CheckInOverlay`, `onCycleCompleteConfirm` / `submitCheckIn` on auth WORK cycles only).
- E2e specs: `e2e/mid-cycle-completion.spec.ts`, `e2e/mid-cycle-last-task.spec.ts`; updated `e2e/pomodoro-cycle.spec.ts` (check-in after S-01 confirm). Risk #7 gate partially covered via S-01 flows + `completeCheckIn` helper.
- **Run**: `set CI=true && pnpm test:e2e` or targeted `pnpm test:e2e e2e/mid-cycle-completion.spec.ts`. Use `E2E_WORKERS=1` if per-test sign-up hits 429 under default CI parallelism.
- **Deferred e2e — `check-in-gate.spec.ts` (Risk #7 dedicated gate oracle)**: UI path — complete 1s WORK cycle → S-01 overlay → "Continue later" → assert `check-in-overlay` visible and "Short Break" hidden until `completeCheckIn(page, "steady")` → assert break `timer-panel-running`. Network persistence oracle — match batched tRPC POST body on `/api/trpc` for `STEADY` + numeric `cycleId` (not `/api/trpc/checkIn.create` URL; app uses `httpBatchStreamLink`). Prior attempts failed on `waitForRequest` timeout and `response.json()` on batch stream. Re-add when e2e infra supports batched mutation oracles.
- **Deferred**: guest-mode Playwright check-in/mid-cycle proofs; escape/refresh skip-vector e2e; server-side `cycle.complete` check-in prerequisite; `interruptionCount` increment; CI gate wiring (Phase 4 test-plan row).

### 6.7 Mutation testing (Stryker)

- **When to run**: after changing code under a test-plan risk; before closing a testing rollout phase; when reviewing survived mutants from the last baseline.
- **Commands**: `pnpm test:mutate` (full `src/**` scope per `stryker.conf.json`); narrowed: `pnpm exec stryker run --mutate "src/hooks/use-pomodoro-cycle.ts"` or `--mutate "src/server/api/routers/task.ts"`.
- **Report**: open `reports/mutation/mutation.html` — mutant view lists survived / no-coverage by file.
- **Review rule**: each **survived** mutant is a candidate bug *or* a bad oracle — add an assertion only when breaking the mutant would catch a user-visible regression. Ignore no-coverage in UI-only files until Phase 6 unless the change touches that component.
- **Phase 5 priority order** (survived mutants, highest ROI first):
  1. `src/hooks/` — cycle state machine, recovery, visibility recalc (Risks #1–#3)
  2. `src/server/api/routers/` — task, cycle, trpc middleware ownership branches (Risks #4, #6)
  3. `src/server/api/lib/` — guest import snapshot edge cases (Risk #5)
- **Phase 6 priority order** (no-coverage clusters):
  1. `src/app/_components/` — task-list, pomodoro-dashboard (Risks #1, #3 UI)
  2. `src/lib/repositories/` — guest persistence helpers (Risk #5)
  3. `src/app/auth/` — sign-in/sign-up actions and schema validation (pre-S-08 merge flows)
- **Strong areas** (use as oracle examples): `src/workers/timer-worker-logic.ts` (100%), `src/lib/duration-input.ts` (92%), `src/server/api/lib/active-session.ts` (92%).
- **Known anomaly**: one RuntimeError in hook layer during full run — Vitest runner crash on a conditional mutant; investigate separately, not a coverage gap.

## 7. What We Deliberately Don't Test

Exclusions agreed during the rollout (Phase 2 interview, Q5). Future
contributors should respect these unless the underlying assumption changes.

- **Generated Prisma client** — the generator and `prisma generate` build step are the contract; do not unit-test generated query builders. Re-evaluate if custom client extensions are added. (Source: Phase 2 interview Q5.)
- **Delight animation (FR-016)** — nice-to-have deferred until core loop is solid; not in MVP rollout scope. (Source: PRD non-goals / roadmap priority.)

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-06-06
- Stack versions last verified: 2026-06-06
- AI-native tool references last verified: 2026-06-06
- Mutation baseline last run: 2026-06-06 (`reports/mutation/mutation.html` — 33.1% total / 58.2% covered)
- CI quality gates wired: 2026-06-06 (`.github/workflows/ci.yml` — lint, typecheck, Vitest, Playwright; `/10x-e2e` levers: `e2e/seed.spec.ts`, `AGENTS.md` E2E rules, `e2e/DELIBERATE-BREAK.md`)
- **Next session:** §3 Phase 5 (Mutation oracle hardening) — highest product ROI after CI floor is locked
- **Phase 5 change-id proposal:** `testing-mutation-oracle-hardening`

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive,
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework, new test runner),
- §7 negative-space no longer matches what the team believes,
- a full Stryker run shifts covered-code score by more than 10 points vs the baseline above.
