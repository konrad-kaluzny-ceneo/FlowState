<!-- PLAN-REVIEW-REPORT -->
# Plan Review: E2E Belt Merge Gate (test-plan Phase 7)

- **Plan**: `context/changes/testing-e2e-belt-fast/plan.md`
- **Mode**: Deep (codebase-grounded)
- **Date**: 2026-06-10
- **Verdict**: APPROVED (after fixes)
- **Findings**: 0 critical (open) · 5 warnings (fixed) · 3 observations (accepted)

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING → PASS (after fixes) |
| Plan Completeness | WARNING → PASS (after fixes) |

## Grounding

Grounding: 18/18 paths ✓, 14/14 symbols ✓, brief↔plan ✓ (after fixes)

**Verified paths (exist on `features/testing-e2e-belt-fast` @ `36a152c`):**

| Path | Status |
|------|--------|
| `e2e/fixtures.ts` | ✓ per-test `createTestUser` (lines 10–31) |
| `e2e/helpers/user.ts` | ✓ `postAuthWithRetry`, `createTestUser` |
| `e2e/helpers/wind-down.ts` | ✓ `completeSteadyWorkCycleAndResumeIdle` UI loop |
| `playwright.config.ts` | ✓ no `globalSetup`; CI workers default 1; inline build in webServer |
| `.github/workflows/ci.yml` | ✓ `E2E_WORKERS: "1"`, `pnpm test:e2e`, job env `NEXT_PUBLIC_E2E_MAIN_THREAD_TIMER` |
| `package.json` | ✓ `test:e2e` only; no belt script yet |
| `context/foundation/test-plan.md` | ✓ on branch — **no** §6.3 belt table yet (Phase 1 rebase required) |
| All 10 belt-retained spec files | ✓ present |
| All 10 demotion spec files | ✓ present |
| `e2e/global-setup.ts` | ✗ absent (expected — Phase 2) |
| `e2e/helpers/seed-scenario.ts` | ✗ absent (expected — Phase 3) |
| Overlay components (merge, first-run, check-in, wind-down) | ✓ `.tsx` exist; no co-located `*.test.tsx` |
| `src/hooks/use-pomodoro-cycle-guest.test.tsx` | ✓ exists — recovery only (2 tests); no catchUp yet |
| `src/app/_components/cycle-audio-preference-control.tsx` | ✓ exists; no co-located test |
| `src/app/_components/task-list.test.tsx` | ✓ exists; no DnD smoke yet |
| `features/test-plan-refresh-2026-06-10` | ✓ local + remote branch exists |

**Verified symbols / counts:**

| Check | Result |
|-------|--------|
| Playwright catalog | **49 tests in 20 files** (`pnpm exec playwright test --list`) |
| Belt inventory | **12 tests / 10 files** — titles match on-disk (pomodoro, suggestion, kickoff, wind-down fatigue/end-session, account-recovery API) |
| Demotion delete set | **22 tests** across **10 files** (not 11 — `persistence-reload` already removed) |
| Post-demotion catalog | **27 tests** (49 − 22), not ~22 |
| Partial spec non-belt counts | pomodoro 1, suggestion 3, kickoff 4, wind-down 5, account-recovery 2 → 15 `@skip-belt` + 12 belt = 27 retained |
| `account-recovery.spec.ts` | ✓ raw `@playwright/test` (no fixtures) — matches Phase 2 contract |
| `guest.test.ts:218+` | ✓ RUNNING closure integration for merge demotion backfill |

## Triage Summary

| ID | Severity | Decision |
|----|----------|----------|
| F1 | WARNING | FIXED — post-demotion catalog ~22 → ~27 (49 − 22 deleted) |
| F2 | WARNING | FIXED — Phase 4.7: extend existing `use-pomodoro-cycle-guest.test.tsx`, not create new |
| F3 | WARNING | FIXED — Phase 4.6: name `cycle-audio-preference-control.test.tsx` co-located path |
| F4 | WARNING | FIXED — Phase 4.8: pin guest merge resume test to `use-pomodoro-cycle.test.tsx` |
| F5 | WARNING | FIXED — Progress: add 4.9/4.10 automated gates; align 2.3 with wind-down deferral; wind-down tag count explicit |
| O1 | OBSERVATION | ACCEPTED — `change.md` / `digest.md` still say "11 demoted files"; plan correctly lists 10 |
| O2 | OBSERVATION | ACCEPTED — `research.md` marks guest hook file MISSING; file exists with recovery-only coverage |
| O3 | OBSERVATION | ACCEPTED — Phase 1 rebase soft blocker; plan Phase 1 owns it (test-plan belt table absent on branch today) |

## Findings

### F1 — Post-demotion catalog count understated

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — Phase 5 gate `5.4` would fail if implementer expects ~22 tests
- **Dimension**: Plan Completeness
- **Location**: Desired End State §7; plan-brief Current vs Target
- **Detail**: Full catalog today is 49 tests. Deleting 10 demoted files removes 22 tests, leaving **27** in 10 retained spec files — not ~22.
- **Fix**: Updated end-state wording and plan-brief table to ~27 with arithmetic note.
- **Decision**: FIXED

### F2 — Guest hook test file already on disk

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — "new file" wording risks duplicate or overwrite
- **Dimension**: Blind Spots
- **Location**: Phase 4 §7; Progress 4.7
- **Detail**: `use-pomodoro-cycle-guest.test.tsx` exists with guest recovery tests only; catchUp parity must **extend** the file.
- **Fix**: Contract now says extend with new `describe("usePomodoroCycle guest catchUp")`; keep existing recovery tests.
- **Decision**: FIXED

### F3 — Cycle audio UI test path unspecified

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — implementer may search wrong file
- **Dimension**: Plan Completeness
- **Location**: Phase 4 §6
- **Detail**: Vague "extend existing preference test file" — no component test exists; target is `cycle-audio-preference-control.tsx`.
- **Fix**: Named co-located `cycle-audio-preference-control.test.tsx` with `aria-pressed` contract.
- **Decision**: FIXED

### F4 — Guest merge resume hook target ambiguous

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — post-sign-in resume is auth hook concern, not guest storage hook
- **Dimension**: Architectural Fitness
- **Location**: Phase 4 §8
- **Detail**: "extend … or guest-specific hook test" could land in wrong module; merge resume follows `getActive` on auth mount.
- **Fix**: Pinned to `use-pomodoro-cycle.test.tsx` with explicit `getActive` + running-state contract.
- **Decision**: FIXED

### F5 — Progress gates incomplete vs Phase 4 deliverables

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — missing automated checkboxes for cycle-audio and guest-merge hook; 2.3 contradicted wind-down defer note
- **Dimension**: Plan Completeness
- **Location**: Progress Phase 2 / Phase 4
- **Detail**: Phase 4 lists 9 deliverables but Progress had 8 automated items; 2.3 required belt green while Implementation Note allowed wind-down timeout deferral.
- **Fix**: Added Progress 4.9–4.10; renumbered manual items; aligned 2.3 with Phase 3 deferral; enumerated five wind-down `@skip-belt` tests.
- **Decision**: FIXED

### O1 — Identity docs say 11 demoted files

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — stakeholder confusion only; plan demotion list is correct (10)
- **Dimension**: End-State Alignment
- **Location**: `change.md`, `digest.md`
- **Detail**: Notes reference 11 demoted e2e files; on-disk demotion set is 10 (persistence-reload already archived).
- **Decision**: ACCEPTED (plan is authoritative; identity docs updated in `change.md` notes)

### O2 — Research stale on guest hook file

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — research matrix says MISSING file; catchUp tests still MISSING
- **Dimension**: Blind Spots
- **Location**: `research.md` Vitest backfill matrix
- **Detail**: File exists with recovery tests; gap is catchUp parity only — plan Phase 4 now reflects this.
- **Decision**: ACCEPTED

### O3 — Belt table not on feature branch yet

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — mitigated by Phase 1 rebase onto `features/test-plan-refresh-2026-06-10`
- **Dimension**: End-State Alignment
- **Location**: `context/foundation/test-plan.md` on current branch
- **Detail**: No "Belt merge gate" or Phase 7 row on disk today; PR #90 branch holds contract.
- **Decision**: ACCEPTED — Phase 1 is first implement step

## Confidence

**92%** — Plan is well-sequenced (doc sync → belt/auth → seed/CI → Vitest → demotion), belt inventory matches 49-test catalog arithmetic, and auth-pool reversal is scoped per-worker with historical rationale documented. Residual risks: wind-down tRPC seed contract (Phase 3) and Neon 429 during 4-user global-setup provisioning. No open CRITICAL findings after auto-triage.
