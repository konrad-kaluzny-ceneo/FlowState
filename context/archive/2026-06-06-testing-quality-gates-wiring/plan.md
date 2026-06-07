# Quality-Gates Wiring Implementation Plan

## Overview

Test-plan Phase 4 locks the merge floor: every PR must pass lint, typecheck, Vitest, and the existing Playwright suite. Before CI enforces the suite, align the project with **`/10x-e2e` as the source of truth** (quality levers + anti-patterns), then Playwright CI best practices, then repo conventions already in `AGENTS.md` and `context/foundation/test-plan.md`.

**Existing E2E specs are retained** — research shows they already pass `/10x-e2e` anti-pattern review on behavior (API auth, no `waitForTimeout`, risk-tied assertions). This plan adds missing **levers** (seed + rules), **hygiene** (stale auth artifacts), a **one-time VERIFY matrix**, and **GitHub Actions** — not a rewrite of working tests.

## Current State Analysis

- **10 specs / 6 spec files** in `e2e/` covering Risks #1, #3, and partial #7 (see `research.md`).
- **Playwright** configured in `playwright.config.ts`: `webServer`, `E2E_WORKERS=1` in CI, per-test API auth via `e2e/fixtures.ts`.
- **Missing `/10x-e2e` levers:** no `seed.spec.ts`; no generation rules block in `AGENTS.md`.
- **Stale infra:** `e2e/auth.setup.ts` orphaned; `e2e/README.md` documents removed shared-`storageState` flow; `global.setup.ts` provisions a shared user fixtures no longer use.
- **No CI:** `.github/workflows/` absent; `lefthook` covers local pre-commit/pre-push only.
- **Deferred (out of scope):** `check-in-gate.spec.ts` (test-plan §6.6), guest→auth merge browser e2e, splitting multi-test files to one-test-per-file.

### Key Discoveries

- Per-test API auth (`e2e/fixtures.ts:10-31`) is **stronger** than generic `/10x-e2e` `storageState` guidance — rules block must document FlowState's pattern, not contradict it.
- `persistence-reload.spec.ts` is the best seed exemplar (Risk #1, helpers, business-outcome assertions).
- `playwright.config.ts:16-17` already maps `GITHUB_ACTIONS` → production build for e2e parity.
- Roadmap previously parked CI under `main_goal: speed`; test-plan Phase 4 explicitly reverses that for quality gates.

## Desired End State

1. **`e2e/seed.spec.ts`** exists and passes — every new E2E spec models this file.
2. **`AGENTS.md`** contains an E2E Testing Rules block aligned with `/10x-e2e` + FlowState API-auth fixture pattern.
3. **Dead auth path removed** — no orphaned `auth.setup.ts`; `global.setup.ts` dropped or reduced to env-only validation; `.env.example` and `e2e/README.md` match reality.
4. **Existing specs** carry provenance headers (risk id + seed reference); **`e2e/DELIBERATE-BREAK.md`** records one-time VERIFY results per critical spec.
5. **`.github/workflows/ci.yml`** runs on PR + push to `main`: `pnpm check`, `pnpm typecheck`, `pnpm test`, `CI=true pnpm test:e2e` with GitHub secrets for Neon/Auth.
6. **`context/foundation/test-plan.md` §5** PR CI row moves from `planned` to `required`; Phase 4 status → `complete` after merge.

### Verification

- Local: `set CI=true && pnpm test:e2e` green after Phase 1–2.
- CI: open a PR; all workflow jobs green.
- Agent smoke: new session reads `AGENTS.md` + `e2e/seed.spec.ts` and can describe how to add a Risk #1 reload test.

## What We're NOT Doing

- Rewriting or splitting existing multi-test spec files (repo convention + cost × signal).
- Adding `check-in-gate.spec.ts` or guest→auth merge browser e2e (deferred per test-plan).
- Mutation testing in CI (Phase 5).
- Changing production timer Worker path for e2e.
- Branch protection rules in GitHub UI (documented as manual follow-up).

## Implementation Approach

Priority order for every decision:

1. **`/10x-e2e` skill** — seed, rules, anti-patterns, VERIFY deliberate-break, eligibility gate (don't e2e what integration covers).
2. **Playwright official guidance** — locators, isolation, web-first assertions, CI browser install, no `waitForTimeout`.
3. **Repo knowledge** — `fixtures.ts` API auth, helpers, test-plan §6.3 cookbook, `E2E_WORKERS=1`, production server in GITHUB_ACTIONS.

Phases: levers → retrofit/verify → CI → test-plan doc sync.

## Critical Implementation Details

**Auth rule wording:** `/10x-e2e` references `storageState`; FlowState uses API sign-up per test. The AGENTS.md rules must say *authenticate via API (`e2e/fixtures.ts` / `createTestUser`) — never through the sign-in UI* — this satisfies the skill intent (no UI login in tests) and Playwright's isolation guidance.

**Removing `global.setup.ts`:** Safe because every authenticated spec uses `fixtures.ts` → `createTestUser`. Guest spec uses no auth. Drop `globalSetup` from `playwright.config.ts` and delete `e2e/global.setup.ts`. Remove `E2E_TEST_*` from `.env.example` (or mark optional/legacy if kept for manual debugging only).

**CI secrets:** E2e needs real Neon + Auth — same vars as local `.env`: `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`. Store as GitHub repository secrets; workflow injects via `env:` block. Do not commit values.

**Seed vs smoke:** Keep `smoke.spec.ts` as pipeline sanity check; `seed.spec.ts` is the **generation exemplar** (may overlap partially — seed should be the canonical template, smoke stays minimal infra proof).

---

## Phase 1: `/10x-e2e` Quality Levers & Infra Hygiene

### Overview

Install the two quality levers `/10x-e2e` Setup step 6 requires, and remove auth artifacts that contradict the current fixture model.

### Changes Required:

#### 1. Seed exemplar

**File**: `e2e/seed.spec.ts`

**Intent**: Create the canonical exemplar every generated E2E test models on. Compose existing helpers — do not invent new patterns.

**Contract**: Single test, provenance header comment block (`Risk`, `Seed for`, `Anti-patterns avoided`). Flow: fixture auth → add task with `Date.now()` suffix → start short work cycle via `startFocusedWorkCycle` → reload → assert task row + `timer-panel-running` (Risk #1 business outcome). Import from `./fixtures` and `./helpers/work-cycle`, `./helpers/idle-cycle`. Test name binds to risk per `/10x-e2e`.

#### 2. E2E rules in AGENTS.md

**File**: `AGENTS.md`

**Intent**: Add `# E2E Testing Rules` subsection under `## Testing`, after run-command docs.

**Contract**: Rules block adapted from `10x-e2e/references/e2e-quality-rules.md` with FlowState overrides:
- Reference `e2e/seed.spec.ts` and `context/foundation/test-plan.md`
- API auth via fixtures (not UI login; not shared storageState)
- getByRole primary; getByTestId allowed for overlays/panels (matches existing specs)
- No CSS/XPath, no `waitForTimeout`, unique data, business-outcome assertions
- Deliberate-break VERIFY before merging new e2e (`e2e/DELIBERATE-BREAK.md`)
- Link to `/10x-e2e` workflow for agents adding browser tests

#### 3. Remove orphaned auth setup

**Files**: delete `e2e/auth.setup.ts`; update `playwright.config.ts`, `e2e/README.md`, `.env.example`

**Intent**: Eliminate dead code and docs that teach the wrong auth pattern.

**Contract**: No references to `auth-setup` project, `playwright/.auth/user.json` as required path, or `--project=auth-setup` in README.

#### 4. Simplify Playwright global setup

**Files**: delete `e2e/global.setup.ts`; remove `globalSetup` key from `playwright.config.ts`

**Intent**: Per-test `createTestUser` makes shared provisioning redundant; dropping it simplifies CI secret surface.

**Contract**: `pnpm test:e2e` runs without `E2E_TEST_EMAIL/PASSWORD/NAME`. If env validation fails at webServer start, CI still needs the four Neon/Auth server vars.

#### 5. Refresh e2e README

**File**: `e2e/README.md`

**Intent**: Single accurate doc for humans — fixture auth, seed.spec.ts, helpers, run commands, CI notes.

**Contract**: Match `AGENTS.md` and test-plan §6.3; list all current spec files; document `E2E_WORKERS=1` for Neon rate limits.

### Success Criteria:

#### Automated Verification:

- `pnpm check` passes
- `pnpm typecheck` passes
- `set CI=true && pnpm exec playwright test e2e/seed.spec.ts` passes
- `set CI=true && pnpm test:e2e` full suite passes

#### Manual Verification:

- Read `AGENTS.md` E2E rules — confirm API-auth wording matches `fixtures.ts`
- Confirm deleted files are not imported anywhere

**Implementation Note**: Pause for manual confirmation after automated checks before Phase 2.

---

## Phase 2: Existing Suite Alignment & VERIFY Matrix

### Overview

Retrofit metadata and run `/10x-e2e` VERIFY (deliberate-break) once per critical spec. **No assertion rewrites** unless a deliberate-break check proves a test stays green when the risk materializes.

### Changes Required:

#### 1. Provenance headers on existing specs

**Files**: `e2e/smoke.spec.ts`, `e2e/pomodoro-cycle.spec.ts`, `e2e/persistence-reload.spec.ts`, `e2e/guest-trial.spec.ts`, `e2e/mid-cycle-completion.spec.ts`, `e2e/mid-cycle-last-task.spec.ts`

**Intent**: Link each file to test-plan risk(s) and `seed.spec.ts` without changing test logic.

**Contract**: Top-of-file comment block: `// Risk: #N — <one line>`; `// Modeled on: e2e/seed.spec.ts`; optional `// Spec role: infra smoke | risk proof`. For `smoke.spec.ts`, label as infra smoke (not a test-plan risk row).

#### 2. Deliberate-break verification matrix

**File**: `e2e/DELIBERATE-BREAK.md`

**Intent**: Document `/10x-e2e` VERIFY results — one row per spec file with break technique and pass/fail of red check.

**Contract**: Table columns: Spec | Risk | Break applied (what was weakened) | Test went red? | Date | Notes. Implementer runs breaks locally, reverts immediately, records outcome. Minimum rows for: `persistence-reload`, `guest-trial`, `mid-cycle-last-task`, `pomodoro-cycle` (one representative test). If a test stays green after break, fix assertion in that spec only (narrow scope).

#### 3. Playwright config — exclude seed duplication (optional)

**File**: `playwright.config.ts`

**Intent**: Only if `seed.spec.ts` duplicates `persistence-reload.spec.ts` flow exactly — consider `testMatch` exclusion. **Default: keep both** (seed is short exemplar; persistence-reload remains named risk proof). Skip this change unless duplication causes maintenance burden.

### Success Criteria:

#### Automated Verification:

- `set CI=true && pnpm test:e2e` passes after any assertion fixes from VERIFY
- `pnpm test` passes (no regressions)

#### Manual Verification:

- Review `e2e/DELIBERATE-BREAK.md` — every critical spec has a recorded red check
- Spot-check one spec header matches test-plan risk wording

**Implementation Note**: Pause for manual confirmation before Phase 3.

---

## Phase 3: GitHub Actions CI Gate

### Overview

Add PR/push CI matching test-plan §5: lint, typecheck, unit/integration, full e2e with production build parity.

### Changes Required:

#### 1. CI workflow

**File**: `.github/workflows/ci.yml`

**Intent**: Block merges that skip the test floor.

**Contract**:
- Triggers: `pull_request`, `push` to `main`
- Runner: `ubuntu-latest`
- Node via `actions/setup-node` + `pnpm/action-setup` with `packageManager` from `package.json` (pnpm 11)
- Job `quality`: checkout → `pnpm install --frozen-lockfile` → `pnpm exec prisma generate` → `pnpm check` → `pnpm typecheck` → `pnpm test`
- Job `e2e`: `needs: quality` → install Chromium (`pnpm exec playwright install chromium --with-deps`) → same install/generate → env from secrets → `pnpm test:e2e` with `CI: true` (relies on `GITHUB_ACTIONS` in config for prod build)
- Explicit env: `E2E_WORKERS: "1"`
- Secrets (document in workflow comment): `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`
- Cache: pnpm store via `actions/cache` on `pnpm-lock.yaml` hash
- Timeout: e2e job ≥ 15 minutes (production build + 10 tests)

#### 2. CI documentation

**Files**: `e2e/README.md` (CI section), optional one-line in root `README.md` if present

**Intent**: Operator knows which GitHub secrets to configure.

**Contract**: List secret names; note first PR may fail until secrets are set; link to Neon dev branch recommendation (never prod credentials in public forks).

#### 3. Branch protection note (manual)

**Intent**: Document recommended GitHub settings — not automated in repo.

**Contract**: Add to Phase 3 manual verification: enable required status check `e2e` (or workflow name) on `main`.

### Success Criteria:

#### Automated Verification:

- Workflow file valid YAML (local lint or push to branch)
- After secrets configured: CI green on PR

#### Manual Verification:

- GitHub repo secrets configured for all four vars
- Optional: branch protection requires CI check before merge
- Failed e2e on intentional break (e.g. break timer assertion) blocks merge

**Implementation Note**: Pause for manual confirmation (secrets + first green CI run) before Phase 4.

---

## Phase 4: Test-Plan & Cookbook Sync

### Overview

Close test-plan Phase 4 rollout row and document new levers in §6.

### Changes Required:

#### 1. Update test-plan.md

**File**: `context/foundation/test-plan.md`

**Intent**: Reflect shipped CI gate and `/10x-e2e` levers.

**Contract**:
- §3 Phase 4 Status → `complete`, Change folder → `testing-quality-gates-wiring`
- §5 PR CI workflow → `required`
- §6.3 add bullet: `e2e/seed.spec.ts` is generation exemplar; link `e2e/DELIBERATE-BREAK.md`
- §8 freshness ledger: CI wired date; note `/10x-e2e` levers added

#### 2. Change status

**File**: `context/changes/testing-quality-gates-wiring/change.md`

**Intent**: Mark change implemented after all phases land.

**Contract**: `status: implemented`, `updated: <ship date>`.

### Success Criteria:

#### Automated Verification:

- `pnpm check` passes on edited markdown (if biome covers it) or no lint errors

#### Manual Verification:

- `/10x-test-plan --status` shows Phase 4 complete
- Agent prompt "how do I add an e2e test?" cites seed + AGENTS.md rules

---

## Testing Strategy

### Unit / Integration

No new Vitest tests — this change is infra/docs/CI. Existing `pnpm test` must stay green.

### E2E

- Phase 1: seed spec + full suite
- Phase 2: targeted re-run after any VERIFY-driven assertion fix
- Phase 3: CI e2e job is the authoritative gate

### Manual Testing Steps

1. Run full local e2e with `CI=true` after Phase 1
2. Complete deliberate-break matrix in Phase 2
3. Configure GitHub secrets; open PR; confirm both CI jobs green
4. Optionally break one assertion on a branch; confirm CI fails

## Performance Considerations

- CI e2e uses production build (`next build && next start`) — slower but matches Vercel; acceptable for PR gate.
- `E2E_WORKERS=1` limits parallelism — intentional for Neon Auth; full suite ~few minutes.

## Migration Notes

- Developers who relied on `E2E_TEST_*` for global setup: remove from local `.env` if unused; auth is per-test via API.
- First CI run requires one-time GitHub secrets setup.

## References

- Research: `context/changes/testing-quality-gates-wiring/research.md`
- Test-plan Phase 4: `context/foundation/test-plan.md` §3 row 4, §5
- `/10x-e2e` references: seed pattern, anti-patterns, quality rules
- Archive: `context/archive/2026-06-04-testing-critical-path-persistence-timer/reviews/scope-addendum.md` (per-test auth decision)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: `/10x-e2e` Quality Levers & Infra Hygiene

#### Automated

- [x] 1.1 `pnpm check` passes after lever/hygiene changes
- [x] 1.2 `pnpm typecheck` passes
- [x] 1.3 `set CI=true && pnpm exec playwright test e2e/seed.spec.ts` passes
- [x] 1.4 `set CI=true && pnpm test:e2e` full suite passes

#### Manual

- [x] 1.5 AGENTS.md E2E rules match fixtures API-auth pattern

### Phase 2: Existing Suite Alignment & VERIFY Matrix

#### Automated

- [x] 2.1 `set CI=true && pnpm test:e2e` passes after header/VERIFY fixes
- [x] 2.2 `pnpm test` passes

#### Manual

- [x] 2.3 `e2e/DELIBERATE-BREAK.md` complete for critical specs
- [x] 2.4 Provenance headers spot-checked against test-plan risks

### Phase 3: GitHub Actions CI Gate

#### Automated

- [x] 3.1 `.github/workflows/ci.yml` present and valid
- [x] 3.2 CI green on PR (after secrets configured)

#### Manual

- [x] 3.3 GitHub secrets configured (4 Neon/Auth vars)
- [x] 3.4 Branch protection requires CI (optional recommended) — verified not enabled; optional follow-up after first green CI

### Phase 4: Test-Plan & Cookbook Sync

#### Automated

- [x] 4.1 Docs edits lint-clean

#### Manual

- [x] 4.2 test-plan §3 Phase 4 marked complete; §5 CI required
- [x] 4.3 `/10x-test-plan --status` shows Phase 4 complete
