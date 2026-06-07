---
date: 2026-06-06T16:00:00+02:00
researcher: Cursor Agent
git_commit: 37004e9
branch: main
repository: FlowState
topic: "Audit existing E2E specs against /10x-e2e quality levers and anti-patterns"
tags: [research, e2e, playwright, test-plan, quality-gates]
status: complete
last_updated: 2026-06-06
last_updated_by: Cursor Agent
---

# Research: Existing E2E tests vs `/10x-e2e` standards

**Date**: 2026-06-06  
**Researcher**: Cursor Agent  
**Git Commit**: `37004e9`  
**Branch**: `main`  
**Repository**: konrad-kaluzny-ceneo/FlowState

## Research Question

Czy już dodane testy E2E w `e2e/` są zgodne ze standardami `/10x-e2e` (quality levers, pięć anti-patternów, risk-tied naming, izolacja, auth bez UI)?

## Summary

**Verdict: mostly compliant on test behavior, partially compliant on project levers and hygiene.**

The seven spec files exercise real browser flows with risk-aware assertions, role/test-id locators (no CSS/XPath), API auth (no login UI), unique per-test users, and state waits instead of `waitForTimeout`. They align well with `/10x-e2e` *test discipline*.

Gaps are structural — what `/10x-e2e` expects as one-time project setup:

| Lever / rule | Status |
|---|---|
| `seed.spec.ts` exemplar | **Missing** |
| E2E rules block in AGENTS.md | **Partial** (run commands only, not generation rules) |
| `e2e/README.md` auth docs | **Stale** (documents removed `auth-setup` / shared `storageState`) |
| `e2e/auth.setup.ts` | **Orphaned** (file exists, not wired in `playwright.config.ts`) |
| Provenance headers per spec | **Missing** |
| One test per file | **Not followed** (multi-test files OK for maintenance, diverges from skill default) |
| Deliberate-break verification | **Not documented** (unknown if run during rollout) |
| Deferred Risk #7 dedicated gate | **Gap** (`check-in-gate.spec.ts` still deferred per test-plan §6.6) |

**Recommendation for Phase 4 (`testing-quality-gates-wiring`):** before CI wiring, add the two quality levers (`seed.spec.ts` + E2E rules in AGENTS.md), refresh `e2e/README.md`, remove or re-wire orphaned `auth.setup.ts`, and treat existing specs as the seed source (likely `persistence-reload.spec.ts` or `smoke.spec.ts` pattern). CI gate can then enforce the suite as-is; optional hardening pass can address deferred `check-in-gate.spec.ts` in a follow-up change.

## Detailed Findings

### Quality levers (`/10x-e2e` Setup step 6)

#### 1. Seed test — missing

`/10x-e2e` requires `seed.spec.ts` as the exemplar every generated test models on. **No `seed.spec.ts` exists** in the repo.

Best candidate to adapt: `e2e/persistence-reload.spec.ts` — single test, risk-tied describe block, business-outcome assertions after reload, uses helpers + fixtures. Alternative: extract a minimal “add task → assert visible” flow from `smoke.spec.ts` and add reload step for Risk #1.

#### 2. E2E rules in AGENTS.md — partial

`AGENTS.md` lines 42–54 document **how to run** E2E (`CI=true`, `E2E_REUSE_SERVER`, workers). It does **not** include the generation rules block from `10x-e2e/references/e2e-quality-rules.md`:

- getByRole primary; getByTestId when ambiguous
- no CSS/XPath
- independent tests, no `waitForTimeout`
- assert business outcome
- unique test data + cleanup
- storageState/API auth, not UI login

Adding this block is required for `/10x-e2e` agent-generated tests to stay stable.

### Playwright infrastructure

[`playwright.config.ts`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/37004e9/playwright.config.ts):

- `testDir: ./e2e`, `webServer` with `NEXT_PUBLIC_E2E_MAIN_THREAD_TIMER=1`
- CI workers default **1** (Neon Auth rate-limit mitigation — matches test-plan intent)
- **No `auth-setup` project** — comment at line 44: per-test API auth via fixtures
- `globalSetup: ./e2e/global.setup.ts` still requires `E2E_TEST_EMAIL/PASSWORD/NAME`

[`e2e/fixtures.ts`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/37004e9/e2e/fixtures.ts): extends `page` with `createTestUser` + `signInAsUser` (API), exports `waitForCycleGetActive` using `waitForResponse` — **matches** `/10x-e2e` auth-without-UI rule and exceeds shared-`storageState` pattern.

### Stale / orphaned auth artifacts

| Artifact | Issue |
|---|---|
| [`e2e/auth.setup.ts`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/37004e9/e2e/auth.setup.ts) | Writes `playwright/.auth/user.json` but **no project runs it** |
| [`e2e/README.md`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/37004e9/e2e/README.md) | Documents auth-setup project + shared storageState — **contradicts** current config and test-plan §6.3 |
| [`e2e/global.setup.ts`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/37004e9/e2e/global.setup.ts) | Provisions shared user; fixtures create unique users — **possibly redundant** for current suite but still blocks runs if env vars missing |

Historical context: Phase 1 change `testing-critical-path-persistence-timer` **removed** shared `storageState` after impl-review found parallel-run conflicts ([`scope-addendum.md`](context/archive/2026-06-04-testing-critical-path-persistence-timer/reviews/scope-addendum.md)).

### Anti-pattern audit (all 7 spec files + helpers)

#### Anti-pattern 1 — Hallucinated assertion

| Spec | Risk tie | Verdict |
|---|---|---|
| `smoke.spec.ts` | Weak — proves shell loads, not a test-plan risk row | Acceptable smoke; rename/document as infra smoke, not risk proof |
| `persistence-reload.spec.ts` | Risk #1 | **Pass** — task row + `timer-panel-running` after reload |
| `guest-trial.spec.ts` | Risk #1 guest path | **Pass** — guest banner + task + running panel after reload |
| `pomodoro-cycle.spec.ts` | S-01 / cycle end | **Pass** — overlay, check-in gate, task state |
| `mid-cycle-completion.spec.ts` | Risk #3 | **Pass** — FR-015 choices, continue/end-break outcomes |
| `mid-cycle-last-task.spec.ts` | Risk #3 edge | **Pass** — continue hidden, end-break only |

No spec asserts page title or unrelated DOM while ignoring the risk outcome.

#### Anti-pattern 2 — Brittle selector

- **No** `page.locator('.class')`, XPath, or `nth-child` chains found in `e2e/`.
- Primary mix: `getByRole`, `getByPlaceholder`, `getByText`, `getByTestId`.
- `/10x-e2e` rules prefer `getByRole` first; this project uses **`data-testid` heavily** on overlays/panels (`timer-panel-running`, `mid-cycle-prompt-overlay`, etc.). Acceptable per rules (“fall back to getByTestId when ambiguous”) but generated tests will inherit test-id bias unless seed emphasizes roles.

#### Anti-pattern 3 — Shared state

- **Pass:** `fixtures.ts` creates fresh API user per test (UUID email).
- **Pass:** task titles use `Date.now()` / timestamp suffixes.
- **Pass:** no `test.describe.serial`, no cross-test data dependencies.
- **Caveat:** `beforeEach` + `ensureIdleCycle` in multi-test files resets UI state within the same user — fine because each test gets its own user from fixture.
- **No `afterEach` cleanup** — acceptable because users are isolated; DB rows accumulate per ephemeral user.

#### Anti-pattern 4 — `waitForTimeout`

- **Pass:** zero occurrences in `e2e/`.
- Waits use `expect().toBeVisible()`, `waitForResponse`, `page.clock.runFor` (deterministic fake timer), `expect().toPass()` in `idle-cycle.ts`.

#### Anti-pattern 5 — No cleanup

- **Pass (isolation model):** per-test user via API sign-up avoids unique-constraint collisions on shared account.
- No explicit task/cycle teardown — low risk with isolated users.

### Risk map coverage (test-plan §2)

| Risk | E2E coverage | `/10x-e2e` fit |
|---|---|---|
| #1 Refresh/crash | `persistence-reload.spec.ts`, `guest-trial.spec.ts` | Browser-level — correct layer |
| #2 Timer drift | Not in E2E (by design — hook/worker unit) | Correct redirect per eligibility gate |
| #3 Mid-cycle prompt | `mid-cycle-*.spec.ts` | Browser-level — correct |
| #4/#6 Isolation | Vitest integration only | Correct redirect |
| #5 Guest merge | Integration only; browser merge deferred | Gap documented in test-plan |
| #7 Check-in gate | Partial via `completeCheckIn` in S-01/mid-cycle flows | **Gap:** dedicated `check-in-gate.spec.ts` deferred §6.6 |

### Other `/10x-e2e` conventions

| Convention | Status |
|---|---|
| Test named after risk | Mostly yes (`describe("Persistence reload (Risk #1)")`, etc.) |
| One test per file | **No** — `mid-cycle-completion.spec.ts` has 4 tests; skill default is 1/risk/file |
| Provenance header (risk + seed link) | **Missing** on all specs |
| Real internal boundaries | **Yes** — real Neon Auth API, tRPC, DB |
| Deliberate-break check documented | **Not found** in archive or spec comments |

### Spec inventory

| File | Tests | Auth | Helpers |
|---|---:|---|---|
| `smoke.spec.ts` | 1 | fixtures | — |
| `pomodoro-cycle.spec.ts` | 2 | fixtures + beforeEach | work-cycle, check-in, idle-cycle |
| `persistence-reload.spec.ts` | 1 | fixtures | work-cycle, idle-cycle |
| `guest-trial.spec.ts` | 1 | none (guest project) | work-cycle |
| `mid-cycle-completion.spec.ts` | 4 | fixtures + beforeEach | work-cycle, check-in, idle-cycle |
| `mid-cycle-last-task.spec.ts` | 1 | fixtures + beforeEach | work-cycle, check-in, idle-cycle |

**Total: 10 browser tests across 6 spec files** (+ orphaned `auth.setup.ts` not executed).

## Code References

- `playwright.config.ts:29-69` — webServer, CI workers=1, fixture-based auth comment
- `e2e/fixtures.ts:10-31` — API authenticate per test
- `e2e/helpers/user.ts:14-40` — UUID-isolated sign-up
- `e2e/helpers/work-cycle.ts:56-58` — `page.clock.runFor` instead of wall-clock wait
- `e2e/persistence-reload.spec.ts:20-30` — reload + business outcome assertions (Risk #1 exemplar)
- `e2e/smoke.spec.ts:3-10` — minimal smoke (weak risk tie)
- `e2e/README.md:50-54` — **stale** storageState documentation
- `AGENTS.md:42-54` — run instructions without generation rules
- `context/foundation/test-plan.md:155-165` — cookbook §6.3 (canonical patterns)
- `context/foundation/test-plan.md:218-219` — deferred `check-in-gate.spec.ts`

## Architecture Insights

1. **Auth evolution:** Project moved from shared `storageState` (F-02 original) to **per-test API users** (Phase 1 fix). Tests are more `/10x-e2e`-compatible for parallel CI; docs and `auth.setup.ts` were not fully cleaned up.

2. **Helper layer as de-facto seed:** `e2e/helpers/work-cycle.ts` + `fixtures.ts` encode the project's real conventions (test-id panels, clock mocking, API auth). A formal `seed.spec.ts` should compose these helpers, not duplicate logic.

3. **Test-id strategy:** Overlays/modals use stable `data-testid` because role/name alone may be ambiguous — consistent with AGENTS.md pyramid + test-plan §6.3. Seed should show **role-first where possible**, test-id where the app already exposes ids.

4. **CI readiness gap:** No `.github/workflows/` yet (Phase 4 goal). Suite is runnable locally with `set CI=true && pnpm test:e2e`; global setup env vars must be documented for CI secrets.

## Historical Context (from prior changes)

- `context/archive/2026-05-28-e2e-test-infra/` — original Playwright + storageState setup
- `context/archive/2026-06-04-testing-critical-path-persistence-timer/reviews/scope-addendum.md` — per-test auth decision
- `context/archive/2026-06-06-testing-active-slice-browser-proofs/` — mid-cycle + check-in e2e shipped; deferred gate spec noted
- `context/foundation/test-plan.md` §6.6 — explicit deferred items and run commands

## Related Research

- `context/archive/2026-05-28-e2e-test-infra/research.md` — Neon Auth + storageState (superseded for browser tests)
- `context/archive/2026-06-06-testing-active-slice-browser-proofs/research.md` — Phase 2 browser proof anchors

## Open Questions

1. **Can `global.setup.ts` be dropped** now that every test uses `createTestUser`? If yes, CI setup simplifies (no shared E2E_TEST_* provisioning). If kept, document why (Neon Auth warm-up? shared env validation?).

2. **Deliberate-break matrix:** Were break-verify runs recorded for each spec during rollout? If not, `/10x-e2e` VERIFY step should be run once before CI gate locks the suite.

3. **`check-in-gate.spec.ts`:** Implement in this change or defer to post-CI follow-up? test-plan marks it deferred due to batched tRPC oracle difficulty — not a compliance blocker for wiring gates.

4. **README vs test-plan:** Single source of truth should be test-plan §6.3 + updated `e2e/README.md`; remove auth-setup references.

## Compliance Scorecard (`/10x-e2e`)

| Criterion | Score | Notes |
|---|---|---|
| Quality levers (seed + rules) | **2/5** | Both missing or incomplete |
| Anti-pattern 1 (assertions) | **5/5** | Smoke weak but not hallucinated |
| Anti-pattern 2 (selectors) | **4/5** | No CSS; heavy test-id vs role-first |
| Anti-pattern 3 (isolation) | **5/5** | Per-test API users |
| Anti-pattern 4 (waits) | **5/5** | No hardcoded timeouts |
| Anti-pattern 5 (cleanup) | **4/5** | Isolation model OK; no explicit teardown |
| Risk-tied naming | **4/5** | Good describes; smoke/generic names |
| Auth without UI | **5/5** | fixtures + user helpers |
| Real boundaries | **5/5** | Full stack |
| Docs/config hygiene | **2/5** | Stale README, orphaned auth.setup |

**Overall: tests are production-grade; project levers need one setup pass before `/10x-e2e` generation or CI lock-in.**

## Recommended next steps (for `/10x-plan`)

1. Add `e2e/seed.spec.ts` from `persistence-reload.spec.ts` pattern (Risk #1 one-liner flow).
2. Append E2E Testing Rules block to `AGENTS.md` (from `10x-e2e/references/e2e-quality-rules.md`).
3. Update `e2e/README.md` to match fixture auth; delete or archive `auth.setup.ts`; evaluate removing `global.setup.ts` dependency.
4. Phase 4 plan: GitHub Actions workflow running `pnpm check`, `pnpm typecheck`, `pnpm test`, `CI=true pnpm test:e2e` with secrets for Neon/Auth.
5. Optional hardening: `check-in-gate.spec.ts` (Risk #7) in separate sub-phase or follow-up change.
