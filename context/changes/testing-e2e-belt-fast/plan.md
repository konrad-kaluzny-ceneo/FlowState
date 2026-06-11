# E2E Belt Merge Gate Implementation Plan

## Overview

Replace the full Playwright catalog (~49 tests, ~10+ min CI) with a **12-test belt** in **10 spec files** as the merge gate (`pnpm test:e2e:belt`), targeting **???3???4 min** e2e job time. Enable **4 parallel workers** via a pre-provisioned auth pool, add wind-down **API seed** to eliminate UI cycle setup timeouts, backfill demoted paths at the Vitest/component layer, then delete 10 demoted e2e specs and sync docs. Risk coverage: belt retains browser entry points for test-plan risks #1, #3, #5, #7 and S-01/S-06/S-07/S-15/S-16; #2 moves to hook/component tests; #4/#6 stay integration-only.

## Current State Analysis

On `features/testing-e2e-belt-fast` at `36a152c`, CI runs the **full catalog** via `pnpm test:e2e` with `E2E_WORKERS=1` and per-test API sign-up (`e2e/fixtures.ts:10-31`). No belt infrastructure exists: no `test:e2e:belt`, no `@skip-belt`, no `global-setup.ts`, no worker `storageState` pool, no `seed-scenario.ts`, no CI build cache. The belt table and Phase 7 row live on PR [#90](https://github.com/konrad-kaluzny-ceneo/FlowState/pull/90) (`features/test-plan-refresh-2026-06-10`), not yet on `main`.

### Key Discoveries

- **Auth bottleneck**: Serial workers were a Neon 429 mitigation; worker-scoped `storageState` (4 users / 4 workers) reintroduces shared state safely ??? distinct from the Phase 1 single-user parallel failure.
- **Partial-file belt pattern**: Retain rich spec files; tag non-belt tests `@skip-belt` and grep-invert in CI ??? avoids file splits while preserving full-catalog local runs.
- **Wind-down timeout risk**: `mindful-session-wind-down.spec.ts` fatigue setup runs 3+ UI cycles via `e2e/helpers/wind-down.ts:55+`; API seed is a prerequisite, not an optimization.
- **Vitest gaps block demotion**: Five overlay/component oracles missing; guest hook catchUp parity missing; DnD drag-handle smoke missing; guest merge cycle resume needs one hook test.
- **Already adequate**: `mid-cycle-completion-prompt.test.tsx`, auth `use-pomodoro-cycle.test.tsx` catchUp, `tab-return-catchup.test.tsx`, kickoff/suggestion component tests, #4/#6 isolation matrix.

## Desired End State

1. **CI merge gate** runs `pnpm test:e2e:belt` ??? exactly **12 tests** listed by `pnpm exec playwright test --list` when invoked via belt script.
2. **4-worker auth pool** ??? `e2e/global-setup.ts` provisions 4 users; `fixtures.ts` loads `e2e/.auth/worker-{n}.json`; `E2E_WORKERS=4` in CI.
3. **Build cache** ??? separate `pnpm build` step caches `.next/cache`; Playwright `webServer` runs `next start` only in CI.
4. **Wind-down belt** uses `e2e/helpers/seed-scenario.ts` (tRPC `page.request`) for fatigue/end-session paths only.
5. **Vitest backfill complete** ??? all demoted UI surfaces have component/hook oracles per L-04.
6. **10 demoted e2e files deleted**; `test-plan.md` ?3 Phase 7 ??? `complete`; `AGENTS.md` and `e2e/README.md` document belt command.
7. **Full catalog** (`pnpm test:e2e`) still runnable locally for ad-hoc verification (~27 tests after demotion ??? 49 today minus 22 deleted across 10 files).

### Verification

- Belt: `set CI=true && pnpm test:e2e:belt` green locally and in CI.
- Post-demotion: `set CI=true && pnpm test:e2e` green (remaining non-belt-tagged + belt tests).
- Quality floor: `pnpm check`, `pnpm test` green after each phase.

## What We're NOT Doing

- Running the full 49-test catalog on every PR merge (negative-space rule after Phase 7).
- Splitting partial spec files into separate belt/non-belt files.
- Belt-retaining interruption/negative wind-down paths ??? demoted to Vitest after seed refactor.
- Deleting demoted e2e files before Vitest backfill (Phase 4 must complete first).
- Changing production timer Worker path or branch protection automation.
- Waiting for PR #90 merge ??? Phase 1 rebases onto `features/test-plan-refresh-2026-06-10` instead.

## Implementation Approach

Ordered phases minimize rework: sync test-plan docs first (belt table is the contract), wire belt selection + auth pool (enables parallel local runs), add wind-down seed + swap CI gate (unblocks timeout), backfill Vitest (demotion safety), then delete demoted specs and finalize docs. Decision proxies from planning: minimal guest catchUp test, one guest merge cycle hook test, minimal DnD smoke, keep `wind-down.ts` UI helpers until Phase 5.

## Critical Implementation Details

### Belt inventory (12 tests / 10 files)

| # | Spec | Belt scope | Tests | Risk / role |
|---|------|------------|------:|-------------|
| 1 | `e2e/smoke.spec.ts` | whole file | 1 | Infra: auth + shell |
| 2 | `e2e/seed.spec.ts` | whole file | 2 | #3 mid-cycle + #7 check-in gate |
| 3 | `e2e/guest-trial.spec.ts` | whole file | 1 | #1 guest reload |
| 4 | `e2e/mid-cycle-last-task.spec.ts` | whole file | 1 | #3 end-break-only |
| 5 | `e2e/guest-merge-on-sign-in.spec.ts` | whole file | 1 | #5 merge integrity |
| 6 | `e2e/pomodoro-cycle.spec.ts` | `focus, start, complete via clock, continue later` only | 1 | S-01 core loop |
| 7 | `e2e/task-suggestion.spec.ts` | `shows suggestion with rationale...` only | 1 | S-06 entry |
| 8 | `e2e/session-kickoff.spec.ts` | `shows kickoff card...` only | 1 | S-15 entry |
| 9 | `e2e/mindful-session-wind-down.spec.ts` | fatigue + end-session paths (API seed) | 2 | S-16 gate |
| 10 | `e2e/account-recovery.spec.ts` | `request-password-reset API returns 2xx` only | 1 | S-07 API contract |

### Demotion file list (delete in Phase 5 only)

1. `e2e/mid-cycle-completion.spec.ts`
2. `e2e/merge-success-on-sign-in.spec.ts`
3. `e2e/guest-merge-cycle-on-sign-in.spec.ts`
4. `e2e/task-reorder.spec.ts`
5. `e2e/first-run-onboarding.spec.ts`
6. `e2e/guest-first-run.spec.ts`
7. `e2e/quiet-cycle-audio.spec.ts`
8. `e2e/guest-quiet-cycle-audio.spec.ts`
9. `e2e/background-tab-return.spec.ts`
10. `e2e/guest-background-tab-return.spec.ts`

### `@skip-belt` pattern

- Annotate **non-belt** tests in the five partial spec files by including `@skip-belt` in the test title (Playwright grep matches title + tags).
- Belt script: `"test:e2e:belt": "playwright test --grep-invert @skip-belt"`.
- Full catalog: `"test:e2e": "playwright test"` (unchanged ??? runs all tests including skipped-by-CI ones).
- Partial files requiring tags: `pomodoro-cycle.spec.ts`, `task-suggestion.spec.ts`, `session-kickoff.spec.ts`, `mindful-session-wind-down.spec.ts`, `account-recovery.spec.ts`.
- Wind-down: tag **five** non-belt tests `@skip-belt` (interruption, keep-going, keep-going suppress, steady/focused negative, first-cycle negative); retain only fatigue + end-session as belt tests.

### Auth pool contract

- `e2e/global-setup.ts` creates 4 isolated users via existing `createTestUser` API helper; writes `e2e/.auth/worker-{0..3}.json` (Playwright `storageState` format).
- `e2e/fixtures.ts` replaces per-test sign-up with worker-indexed `storageState` load; retain guest project isolation (no auth file for guest specs).
- Add `e2e/.auth/` to `.gitignore`.
- Reuse `postAuthWithRetry` from `e2e/helpers/user.ts` for Neon 429 backoff during pool provisioning.

### Wind-down seed contract

- `e2e/helpers/seed-scenario.ts` exposes helpers that POST to tRPC via `page.request.post` to seed session fatigue / end-session preconditions without UI cycle loops.
- Belt wind-down tests call seed helpers instead of `completeSteadyWorkCycleAndResumeIdle` UI loops.
- Keep `e2e/helpers/wind-down.ts` UI helpers through Phase 4 for local full-catalog runs; trim UI-only setup in Phase 5 if seed fully covers belt paths.

---

## Phase 1: Test-Plan Doc Sync

### Overview

Rebase `features/testing-e2e-belt-fast` onto `features/test-plan-refresh-2026-06-10` so the belt table and Phase 7 row exist on disk before implementation references them. Resolve any `test-plan.md` conflicts favoring PR #90 belt content.

### Changes Required:

#### 1. Branch rebase

**Intent**: Bring ?6.3 belt table, ?6.6 Phase 7 prerequisites, and ?3 Phase 7 rollout row into the feature branch without waiting for PR #90 merge.

**Contract**: `git fetch origin; git rebase origin/features/test-plan-refresh-2026-06-10` on `features/testing-e2e-belt-fast`. If conflicts in `context/foundation/test-plan.md`, keep refresh-branch belt table and demotion list.

#### 2. Verify test-plan contract on disk

**File**: `context/foundation/test-plan.md`

**Intent**: Confirm implementer can cite on-branch docs ??? no drift from PR #90 strategy.

**Contract**: ?6.3 contains `#### Belt merge gate` table (12 tests / 10 files); ?3 Phase 7 row status is `change opened` or `implementing` (not `complete` until Phase 5).

### Success Criteria:

#### Automated Verification:

- `pnpm check` passes after rebase
- `grep -q "Belt merge gate" context/foundation/test-plan.md` (or equivalent content check)

#### Manual Verification:

- Belt table in ?6.3 matches the Critical Implementation Details table above (12 tests, 10 files)
- No unresolved rebase conflict markers in tracked files

**Implementation Note**: Pause for manual confirmation that test-plan content matches PR #90 intent before Phase 2.

---

## Phase 2: Belt Selection + Auth Pool

### Overview

Wire belt grep selection, pre-provision 4-user auth pool, and migrate fixtures to worker-scoped `storageState`. Tag non-belt tests in partial spec files.

### Changes Required:

#### 1. Global setup ??? auth pool

**File**: `e2e/global-setup.ts` (new)

**Intent**: Provision 4 users once before suite; eliminate per-test sign-up latency.

**Contract**: Export default async function; create users via API; write `e2e/.auth/worker-{index}.json` for indices 0???3; use retry helper for Neon 429.

#### 2. Fixtures migration

**File**: `e2e/fixtures.ts`

**Intent**: Load worker-scoped `storageState` instead of per-test `createTestUser` + cookie injection.

**Contract**: Map **`test.info().workerIndex`** (not `parallelIndex`) to auth files: `e2e/.auth/worker-${workerIndex}.json` for indices 0???3. Guest project specs stay on `@playwright/test` without `storageState`. `e2e/account-recovery.spec.ts` intentionally uses raw `@playwright/test` (API-only belt test, no session fixture).

#### 3. Playwright config

**File**: `playwright.config.ts`

**Intent**: Register global setup; prepare for `E2E_WORKERS=4`.

**Contract**: Add `globalSetup: './e2e/global-setup.ts'`; worker count continues reading `E2E_WORKERS` env (default CI value updated in Phase 3).

#### 4. Belt script + gitignore

**Files**: `package.json`, `.gitignore`

**Intent**: Expose belt command; keep auth artifacts out of git.

**Contract**: `"test:e2e:belt": "playwright test --grep-invert @skip-belt"`; gitignore entry `e2e/.auth/`.

#### 5. `@skip-belt` tags on partial specs

**Files**: `e2e/pomodoro-cycle.spec.ts`, `e2e/task-suggestion.spec.ts`, `e2e/session-kickoff.spec.ts`, `e2e/mindful-session-wind-down.spec.ts`, `e2e/account-recovery.spec.ts`

**Intent**: Exclude non-belt tests from CI grep without deleting them.

**Contract**: Add `@skip-belt` to every test title that is **not** in the belt table row for that file. Wind-down: tag five non-belt tests (interruption, keep-going, keep-going suppress, two negatives); keep fatigue + end-session untagged.

### Success Criteria:

#### Automated Verification:

- `pnpm check` passes
- `pnpm exec playwright test --grep-invert @skip-belt --list` reports **12 tests**
- `set CI=true && pnpm test:e2e:belt` passes locally (wind-down may still be slow until Phase 3 seed ??? if timeout, note and proceed after Phase 3 re-run)

#### Manual Verification:

- Confirm `e2e/.auth/` is gitignored and not staged
- Spot-check one partial spec: belt test lacks `@skip-belt`, demoted sibling has tag

**Implementation Note**: If wind-down belt tests timeout pre-seed, defer belt green re-check to Phase 3; other 10 belt tests must pass.

---

## Phase 3: Wind-Down Seed + CI Gate Swap

### Overview

Add API seed helper for wind-down preconditions, refactor belt wind-down tests to use it, and swap CI to belt command with build cache and 4 workers.

### Changes Required:

#### 1. Seed scenario helper

**File**: `e2e/helpers/seed-scenario.ts` (new)

**Intent**: Replace 3?? UI cycle setup in wind-down belt tests with tRPC seed calls.

**Contract**: Functions accept `Page` + session context; use `page.request.post` against tRPC endpoints to establish fatigue and end-session preconditions; document required session/task state in file header.

#### 2. Refactor wind-down belt tests

**Files**: `e2e/mindful-session-wind-down.spec.ts`, optionally `e2e/helpers/wind-down.ts`

**Intent**: Belt fatigue + end-session tests call `seed-scenario.ts`; remove UI loop dependency for belt paths only.

**Contract**: Two belt tests (fatigue, end-session) use seed helpers; interruption/negative tests remain `@skip-belt` and may still use UI helpers until Phase 5 demotion.

#### 3. CI workflow swap

**File**: `.github/workflows/ci.yml`

**Intent**: Run belt on merge; cache build; enable parallelism.

**Contract**:
- Add separate `pnpm build` step before e2e; cache `.next/cache` via `actions/cache` (job-level `NEXT_PUBLIC_E2E_MAIN_THREAD_TIMER: "1"` already set ??? build step inherits it; do not rely on Playwright `webServer` inline build after this change)
- Change e2e command from `pnpm test:e2e` to `pnpm test:e2e:belt`
- Set `E2E_WORKERS: "4"` on e2e job
- Job name stays `e2e`

#### 4. Playwright webServer ??? CI build separation

**File**: `playwright.config.ts`

**Intent**: Avoid inline rebuild inside Playwright startup timeout.

**Contract**: On CI (`GITHUB_ACTIONS`), `webServer.command` is `next start` only (build happens in CI step); local dev unchanged (`next dev --turbo`).

### Success Criteria:

#### Automated Verification:

- `pnpm check` passes
- `set CI=true && pnpm test:e2e:belt` passes (all 12 belt tests green)
- `pnpm exec playwright test --grep-invert @skip-belt --list` still reports 12 tests

#### Manual Verification:

- Review CI workflow diff: build step + cache key + belt command + workers=4
- Wind-down belt tests no longer call `completeSteadyWorkCycleAndResumeIdle` UI loop

**Implementation Note**: Push branch and confirm CI e2e job completes in ???3???4 min target (informational ??? not a hard gate if slightly over on first run).

---

## Phase 4: Vitest Backfill

### Overview

Close signal gaps for all demoted e2e paths before file deletion. Follow L-04 per-control component smoke for demoted UI surfaces.

### Changes Required:

#### 1. Merge success overlay

**File**: `src/app/_components/merge-success-overlay.test.tsx` (new)

**Intent**: Component smoke for demoted `merge-success-on-sign-in.spec.ts`.

**Contract**: Render overlay with merge payload props; assert visible copy/CTA; co-locate beside `merge-success-overlay.tsx`.

#### 2. First-run overlay (auth + guest)

**File**: `src/app/_components/first-run-overlay.test.tsx` (new)

**Intent**: Cover demoted `first-run-onboarding.spec.ts` and `guest-first-run.spec.ts`.

**Contract**: Auth variant + guest-mode variant (single file with two describe blocks or parameterized cases); assert wedge/coach shell renders.

#### 3. Check-in overlay gate shell

**File**: `src/app/_components/check-in-overlay.test.tsx` (new)

**Intent**: Gate UI oracle for demoted check-in e2e paths and seed risk #7 complement.

**Contract**: Render gate shell; assert blocking overlay visible when check-in required.

#### 4. Wind-down overlay

**File**: `src/app/_components/wind-down-overlay.test.tsx` (new)

**Intent**: Component oracle for S-16 UI demoted from full wind-down e2e catalog.

**Contract**: Render fatigue/end-session nudge states; assert copy and primary action.

#### 5. Task list DnD smoke

**File**: `src/app/_components/task-list.test.tsx` (extend)

**Intent**: Minimal drag-handle smoke for demoted `task-reorder.spec.ts`.

**Contract**: Assert drag handle present and reorder callback fires (mock DnD or `@dnd-kit` test harness per existing patterns in file).

#### 6. Cycle audio preference UI smoke

**File**: `src/app/_components/cycle-audio-preference-control.test.tsx` (new, co-located beside `cycle-audio-preference-control.tsx`)

**Intent**: Cover demoted `quiet-cycle-audio.spec.ts` and `guest-quiet-cycle-audio.spec.ts` UI delta.

**Contract**: Render `CycleAudioPreferenceControl`; assert `aria-pressed` on mode buttons changes on click; hook/lib coverage already exists ??? this is UI-only gap.

#### 7. Guest hook catchUp parity

**File**: `src/hooks/use-pomodoro-cycle-guest.test.tsx` (extend existing recovery file)

**Intent**: Parity with auth hook catchUp tests for demoted `guest-background-tab-return.spec.ts`.

**Contract**: Add `describe("usePomodoroCycle guest catchUp")` with at minimum hidden-tab expiry + visibility recalc tests mirroring `use-pomodoro-cycle.test.tsx:2517-2635`; do not replace existing guest recovery tests.

#### 8. Guest merge cycle resume hook test

**File**: `src/hooks/use-pomodoro-cycle.test.tsx` (extend existing hook suite)

**Intent**: Oracle for demoted `guest-merge-cycle-on-sign-in.spec.ts` ??? post-sign-in active cycle resumes.

**Contract**: One test in auth hook suite: after merge/sign-in, `getActive` returns imported guest RUNNING cycle and hook reports `state === "running"`; complements `guest.test.ts:218-255` integration matrix (server-side closure/remap).

#### 9. Extend partial existing tests where noted

**Files**: `src/server/api/routers/guest.test.ts`, `defer.test.ts`, `task-mutation.test.ts` ??? extend only if Phase 4 tests reveal gaps; research marks these PARTIAL but sufficient with new hook test.

### Success Criteria:

#### Automated Verification:

- `pnpm check` passes
- `pnpm test` passes (full Vitest suite)
- `pnpm exec vitest run src/app/_components/merge-success-overlay.test.tsx` passes
- `pnpm exec vitest run src/app/_components/first-run-overlay.test.tsx` passes
- `pnpm exec vitest run src/app/_components/check-in-overlay.test.tsx` passes
- `pnpm exec vitest run src/app/_components/wind-down-overlay.test.tsx` passes
- `pnpm exec vitest run src/hooks/use-pomodoro-cycle-guest.test.tsx` passes (catchUp describe added)
- Extended `task-list.test.tsx` DnD smoke passes
- `pnpm exec vitest run src/app/_components/cycle-audio-preference-control.test.tsx` passes
- Guest merge cycle resume hook test in `use-pomodoro-cycle.test.tsx` passes

#### Manual Verification:

- Cross-check Vitest backfill matrix in `research.md` ??? every demoted row marked EXISTS or covered
- No demoted e2e file deleted yet

**Implementation Note**: Pause for manual review of new component tests against L-04 before Phase 5 deletion.

---

## Phase 5: Demotion + Docs

### Overview

Delete 10 demoted e2e specs, trim wind-down UI helpers if seed covers belt, update agent/human docs, mark test-plan Phase 7 complete, run full verification.

### Changes Required:

#### 1. Delete demoted e2e files

**Files**: (see Critical Implementation Details demotion list)

**Intent**: Remove redundant browser coverage now carried by belt + Vitest.

**Contract**: Delete all 10 files; remove any imports/references in README or CI; do not delete belt-retained partial spec files.

#### 2. Trim wind-down UI helpers (conditional)

**File**: `e2e/helpers/wind-down.ts`

**Intent**: Remove UI-only setup superseded by `seed-scenario.ts` if no remaining spec references it.

**Contract**: Keep helpers used by any retained `@skip-belt` local tests until those tests are deleted; after demotion, delete unused UI loop functions only.

#### 3. Update AGENTS.md E2E section

**File**: `AGENTS.md`

**Intent**: Document belt as CI merge gate; preserve full-catalog local command.

**Contract**: Add `pnpm test:e2e:belt` as PR/CI command; `pnpm test:e2e` for full local catalog; note `@skip-belt` convention and 4-worker auth pool.

#### 4. Update e2e README

**File**: `e2e/README.md`

**Intent**: Accurate auth pool docs replacing per-test sign-up narrative.

**Contract**: Document `global-setup.ts`, worker `storageState`, belt vs full commands, `E2E_WORKERS=4` in CI.

#### 5. Mark test-plan Phase 7 complete

**File**: `context/foundation/test-plan.md`

**Intent**: Close rollout row per test-plan orchestrator.

**Contract**: ?3 Phase 7 status ??? `complete`; ?6.3 belt table unchanged; ?6 cookbook entry for belt command filled (location, run command, reference test).

#### 6. Update change status

**File**: `context/changes/testing-e2e-belt-fast/change.md`

**Intent**: Reflect shipped state.

**Contract**: `status: implemented` (or `complete` per project convention) after merge-ready verification.

### Success Criteria:

#### Automated Verification:

- `pnpm check` passes
- `pnpm test` passes
- `set CI=true && pnpm test:e2e:belt` passes (12 tests)
- `set CI=true && pnpm test:e2e` passes (post-demotion reduced catalog)
- Demoted files absent: `test ! -f e2e/mid-cycle-completion.spec.ts` (repeat for all 10)

#### Manual Verification:

- AGENTS.md and e2e/README.md describe belt workflow accurately
- test-plan ?3 Phase 7 marked complete
- CI e2e job uses `test:e2e:belt` on pushed branch

**Implementation Note**: Final pause for human sign-off before PR merge.

---

## Testing Strategy

### Unit / Component Tests (Phase 4 deliverables):

- Overlay smokes: merge-success, first-run (auth+guest), check-in gate, wind-down
- Hook: guest catchUp parity, guest merge cycle resume
- Integration: existing `guest.test.ts`, isolation tests ??? no new e2e for #4/#6
- UI: task-list DnD handle, cycle-audio toggle

### E2E Belt (CI merge gate):

- 12 tests via `--grep-invert @skip-belt`
- Auth pool + 4 workers + build cache

### Manual Testing Steps:

1. Run belt locally with `CI=true`; confirm ~12 tests and runtime improvement vs full catalog.
2. After demotion, run full `test:e2e`; confirm no orphaned imports to deleted specs.
3. Open PR; verify CI e2e job name unchanged, command is belt, workers=4.

## Performance Considerations

- Belt target: ???3???4 min CI e2e (down from ~10+ min). Auth pool + build cache + reduced test count are the levers.
- Wind-down seed eliminates the largest per-test setup cost.
- 4 workers require distinct auth files per worker ??? do not share one global storageState.

## Migration Notes

- Phase 1 rebase may touch `test-plan.md` only; no runtime migration.
- Auth pool writes ephemeral `e2e/.auth/` ??? CI regenerates each run.
- Demotion is one-way; restore from git history if a demoted path needs browser proof again.

## References

- Research: `context/changes/testing-e2e-belt-fast/research.md`
- Test-plan belt source: PR #90 / `features/test-plan-refresh-2026-06-10`
- Prior auth reversal: `context/archive/2026-06-04-testing-critical-path-persistence-timer/reviews/scope-addendum.md`
- Phase 4 baseline: `context/archive/2026-06-06-testing-quality-gates-wiring/plan.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append `→ <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Test-Plan Doc Sync

#### Automated

- [x] 1.1 `pnpm check` passes after rebase ? e4488ea
- [x] 1.2 Belt merge gate section present in `context/foundation/test-plan.md` ? e4488ea

#### Manual

- [x] 1.3 Belt table matches 12 tests / 10 files contract ? e4488ea
- [x] 1.4 No unresolved rebase conflict markers ? e4488ea

### Phase 2: Belt Selection + Auth Pool

#### Automated

- [x] 2.1 `pnpm check` passes ? 5f7941b
- [x] 2.2 `pnpm exec playwright test --grep-invert @skip-belt --list` reports 12 tests ? 5f7941b
- [x] 2.3 `set CI=true && pnpm test:e2e:belt` passes (or wind-down belt tests timeout pre-seed ??? defer green re-check to Phase 3.2) ? 5f7941b

#### Manual

- [x] 2.4 `e2e/.auth/` gitignored and not staged ? 5f7941b
- [x] 2.5 Partial spec `@skip-belt` tagging verified ? 5f7941b

### Phase 3: Wind-Down Seed + CI Gate Swap

#### Automated

- [x] 3.1 `pnpm check` passes ? d976c71
- [x] 3.2 `set CI=true && pnpm test:e2e:belt` passes (all 12 belt tests) ? d976c71
- [x] 3.3 Belt list still reports 12 tests ? d976c71

#### Manual

- [x] 3.4 CI workflow has build cache, belt command, E2E_WORKERS=4 ? d976c71
- [x] 3.5 Wind-down belt tests use seed-scenario not UI loops ? d976c71

### Phase 4: Vitest Backfill

#### Automated

- [x] 4.1 `pnpm check` passes — 277cf9d
- [x] 4.2 `pnpm test` passes — 277cf9d
- [x] 4.3 `merge-success-overlay.test.tsx` passes — 277cf9d
- [x] 4.4 `first-run-overlay.test.tsx` passes — 277cf9d
- [x] 4.5 `check-in-overlay.test.tsx` passes — 277cf9d
- [x] 4.6 `wind-down-overlay.test.tsx` passes — 277cf9d
- [x] 4.7 `use-pomodoro-cycle-guest.test.tsx` catchUp parity passes — 277cf9d
- [x] 4.8 Task-list DnD smoke passes — 277cf9d
- [x] 4.9 `cycle-audio-preference-control.test.tsx` UI smoke passes — 277cf9d
- [x] 4.10 Guest merge cycle resume hook test passes — 277cf9d

#### Manual

- [x] 4.11 Vitest backfill matrix complete per research.md — 277cf9d
- [x] 4.12 No demoted e2e files deleted yet — 277cf9d

### Phase 5: Demotion + Docs

#### Automated

- [x] 5.1 `pnpm check` passes — 8e7c547
- [x] 5.2 `pnpm test` passes — 8e7c547
- [x] 5.3 `set CI=true && pnpm test:e2e:belt` passes — 6ed9bda
- [x] 5.4 `set CI=true && pnpm test:e2e` passes post-demotion — 6ed9bda
- [x] 5.5 All 10 demoted e2e files deleted — 6ed9bda

#### Manual

- [x] 5.6 AGENTS.md and e2e/README.md updated — 6ed9bda
- [x] 5.7 test-plan §3 Phase 7 marked complete — 6ed9bda
- [ ] 5.8 CI e2e job confirmed on pushed branch
