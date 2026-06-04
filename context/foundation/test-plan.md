# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-06-04

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
| 1 | Page refresh or crash during an active Pomodoro leaves the user with a missing or wrong task list or cycle state | High | High | PRD guardrail (no silent data loss); interview Q1; roadmap S-01 NFR (crash/refresh recovery) |
| 2 | Work cycle elapsed time drifts beyond ±2 seconds when the browser tab is backgrounded | High | Medium | PRD NFR (timer drift ≤ ±2s); interview Q3; hot-spot dir `src/hooks/` (21 commits/30d); hot-spot dir `src/workers/` (5 commits/30d) |
| 3 | Marking a task done mid-cycle offers wrong choices or skips the mindful break/end prompt | Medium | High | PRD FR-015; roadmap S-03 active; interview Q4 |
| 4 | Authenticated user reads or mutates another user's tasks, sessions, or cycles | High | Medium | PRD guardrail (strict per-user isolation); PRD access control |
| 5 | Guest trial tasks or cycles are lost or silently overwritten on sign-in merge | High | Medium | PRD FR-003c; roadmap S-08 proposed; PRD guardrail (no silent data loss) |
| 6 | Attacker with a valid session manipulates resource IDs to access another user's tasks or cycles (IDOR) | High | Medium | PRD access control (abuse lens — ownership not just authentication) |
| 7 | End-of-cycle check-in can be skipped or declared energy fails to persist for the next suggestion | Medium | Medium | PRD FR-020; roadmap S-05 active |

### Risk Response Guidance

| Risk | What would prove protection | Must challenge | Context `/10x-research` must ground | Likely cheapest layer | Anti-pattern to avoid |
|------|-----------------------------|----------------|--------------------------------------|-----------------------|-----------------------|
| #1 | After refresh mid-active work cycle, user sees the same tasks and the cycle resumes at the correct phase and remaining time | "Hydration on mount" implies server and client state agree; empty task list on slow network is acceptable | Refresh entry point; persisted cycle + task state shape; guest vs authenticated persistence boundaries | Integration (server caller + DB fixture) before browser e2e | Asserting save-format fields copied from implementation rather than user-visible restored state |
| #2 | At cycle end in a backgrounded tab, elapsed time is within ±2s of the configured work duration | Fake timers in jsdom prove throttled-tab behavior; client-only clock is authoritative | Clock authority (worker vs main thread vs server `startedAt`); visibility/throttle handling | Unit (timer worker) + hook integration with controlled time; e2e only if cheaper layers cannot simulate throttling | Testing raw `setInterval` without background-throttle or worker path |
| #3 | Completing a task during an active cycle always surfaces FR-015 choices; with no active tasks left, only "end cycle and break" is offered | Happy-path completion without in-flight cycle state | Mid-cycle UI gate; cycle in-flight detection; task list empty edge case | Playwright e2e with authenticated fixture | Unit-testing prompt component in isolation without cycle-in-flight context |
| #4 | No tRPC query or mutation returns another user's tasks, sessions, cycles, or check-ins | "Protected procedure" label implies row-level ownership checks on every read/write | Auth context injection; ownership filter on every list/get/mutate path | Integration (dual-user callers, expect forbidden/not-found) | Mocking auth middleware while skipping DB-level isolation assertions |
| #5 | After sign-in, guest tasks and cycles appear in the account; title collisions get numbered suffixes; guest blob cleared only after successful merge | Merge test passes when guest blob is empty; suffix logic mirrors production string concat | Guest blob schema version; merge transaction boundary; collision suffix policy | Integration (merge procedure) + one browser merge e2e | Asserting suffix algorithm by copying production helper output as oracle |
| #6 | Mutating or fetching a task/cycle/session ID belonging to another user returns forbidden or not-found, not the foreign row | Logged-in user implies any ID is reachable if auth passes | ID parameters on mutations; ownership check before update/delete | Integration (cross-user ID swap on each router) | Only testing "unauthenticated → 401" without cross-user IDOR |
| #7 | Every completed work cycle requires an energy check-in before transition; stored value is readable for the next suggestion | Check-in UI mount implies persistence; skipping modal via keyboard is acceptable UX | Cycle-end transition gate; check-in persistence model; S-05 vs S-06 boundary | Playwright e2e once S-05 UI lands; integration for persistence until then | Snapshot of check-in modal without asserting gate blocks transition |

## 3. Phased Rollout

Each row is a discrete rollout phase that will open its own change folder
via `/10x-new`. Status moves left-to-right through the values below; the
orchestrator updates Status as artifacts appear on disk.

| # | Phase name | Goal (one line) | Risks covered | Test types | Status | Change folder |
|---|------------|-----------------|---------------|------------|--------|---------------|
| 1 | Critical-path persistence & timer | Prove refresh/crash recovery and background-tab timer accuracy at the cheapest layers that catch real regressions | #1, #2 | unit + integration + targeted e2e | complete | testing-critical-path-persistence-timer |
| 2 | Active-slice browser proofs | Browser-level proof for S-03 mid-cycle prompt and S-05 check-in gate before wedge work compounds | #3, #7 | Playwright e2e | not started | — |
| 3 | Isolation, abuse & guest merge | Lock per-user isolation, IDOR rejection, and guest→account merge integrity | #4, #5, #6 | integration + e2e | not started | — |
| 4 | Quality-gates wiring | Enforce lint, typecheck, unit/integration, and critical e2e in CI on every PR | cross-cutting | CI gates | not started | — |

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
| accessibility | none yet | — | See Phase 2 if check-in/mid-cycle modals need axe — only if e2e misses a11y regressions |

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
| e2e critical flows (`set CI=true && pnpm test:e2e`) | local + CI after Phase 4 | required after §3 Phase 4 | broken auth, cycle, and active-slice UI paths |
| PR CI workflow | GitHub Actions | required after §3 Phase 4 | merges without test suite |
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
- **Cross-user IDOR**: see Phase 3 rollout — `cycle-isolation.test.ts` patterns.
- **Run locally**: `pnpm test`.

### 6.3 Adding an e2e test

- **Location**: `e2e/*.spec.ts`.
- **Auth mid-cycle reload (Risk #1 UI)**: `e2e/persistence-reload.spec.ts` — start 15 min preset, `page.reload()`, re-wait for `cycle.getActive`, assert task row + `timer-panel-running` (no ±2s countdown oracle; timer accuracy is hook/unit). Shared idle reset: `e2e/helpers/idle-cycle.ts`.
- **Guest reload**: `e2e/guest-trial.spec.ts` — same UI assertions; guest banner still visible.
- **±2s tolerance**: use `src/test-utils/countdown-tolerance.ts` in Vitest only, not Playwright reload specs.
- **Run locally**: `set CI=true && pnpm test:e2e` (starts `next dev` on 3001 — no full build). Fastest: `next dev --turbo -p 3001` with `NEXT_PUBLIC_E2E_MAIN_THREAD_TIMER=1`, then `set E2E_REUSE_SERVER=1 && set CI=true && pnpm test:e2e`. Prod parity: `set E2E_PRODUCTION_SERVER=1`.
- **Limitation**: e2e uses `NEXT_PUBLIC_E2E_MAIN_THREAD_TIMER=1` — does not exercise production Worker path; Risk #2 is covered by hook/unit tests (see §6.6).

### 6.4 Adding a test for a new tRPC procedure

- **Test type**: integration (preferred over e2e).
- **Pattern**: `createCaller` with session context; assert procedure result and DB side-effects; for protected procedures include cross-user denial case.
- **Reference test**: `src/server/api/routers/task-mutation.test.ts`.
- **When to add e2e instead**: user-visible flow that spans auth cookie + browser timing (cycle UI, modals, audio prompt).

### 6.5 Adding a guest/localStorage test

- TBD — see §3 Phase 3 for guest merge and collision-suffix patterns.

### 6.6 Per-rollout-phase notes

**Phase 1 — Critical-path persistence & timer** (shipped 2026-06-04, change `testing-critical-path-persistence-timer`)

- Risks covered: **#1** (refresh/crash recovery), **#2** (background-tab timer drift ≤ ±2s).
- Layers: unit tick math + countdown oracle (Vitest); integration `getActive` + guest snapshot; hook visibility recalc (fallback path) + guest/auth recovery; auth + guest e2e `reload` asserts task list + `timer-panel-running` only.
- **Explicit limitation**: no Playwright project without `E2E_MAIN_THREAD_TIMER` — Worker throttle in production is validated via `getTimerTickResult` + hook `visibilitychange` / fallback recalc, not browser Worker e2e.
- **Deferred**: session-timeout + stale RUNNING cycle (Phase 3); dedicated Worker e2e project (cost × signal).

## 7. What We Deliberately Don't Test

Exclusions agreed during the rollout (Phase 2 interview, Q5). Future
contributors should respect these unless the underlying assumption changes.

- **Generated Prisma client** — the generator and `prisma generate` build step are the contract; do not unit-test generated query builders. Re-evaluate if custom client extensions are added. (Source: Phase 2 interview Q5.)
- **Delight animation (FR-016)** — nice-to-have deferred until core loop is solid; not in MVP rollout scope. (Source: PRD non-goals / roadmap priority.)

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-06-03
- Stack versions last verified: 2026-06-03
- AI-native tool references last verified: 2026-06-03

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive,
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework, new test runner),
- §7 negative-space no longer matches what the team believes.
