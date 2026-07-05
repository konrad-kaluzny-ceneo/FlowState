# Restore belt E2E and accessibility after ui-refactor — Implementation Plan

## Overview

PR #188 (`features/ui-refactor`) deleted 11 Playwright specs including six belt merge-gate rows and `e2e/accessibility.spec.ts`. CI still invokes `pnpm test:e2e:a11y` after the belt, so the a11y job fails on a missing file. This change restores **belt + a11y coverage only** on branch `features/fix-e2e-tests`, adapting pre-deletion specs (baseline commit `c915f45`) to the post-refactor multi-view shell (`/focus`, `/tasks`, planned-tab task flow, i18n locators). Four deleted non-belt specs stay demoted to existing Vitest/integration oracles per `context/foundation/test-plan.md` §6.10.

## Current State Analysis

**Broken CI surface**

- `.github/workflows/ci.yml` runs `pnpm test:e2e:belt` then `pnpm test:e2e:a11y`; `e2e/accessibility.spec.ts` is absent.
- Belt currently runs **11 scenarios** in 9 files (`playwright --grep-invert @skip-belt --list`). Restoring six deleted spec files adds **7 belt rows** → target **18** belt scenarios. test-plan §6.3 still lists ~16 (stale); Phase 3 syncs the cookbook table.

**Helper groundwork (already on `features/fix-e2e-tests`, commit `302e1df`)**

- `e2e/helpers/work-cycle.ts` — task creation via `/tasks` quick-add → Planned tab → focus → client-side nav to `/focus`; fake clock before `clickStartCycle`; break duration via localStorage not Settings.
- `e2e/helpers/task-list-locator.ts` — `expectFocusPageReady`, `goToTasksPage`.
- `e2e/helpers/i18n-locators.ts` — EN/PL-safe Focus, Continue later, mark-complete buttons.
- `e2e/helpers/kickoff.ts` — `completeKickoffSteering` / deprecated `completeKickoffReadiness` for inline `session-energy-card` + `session-focus-card`.
- `e2e/helpers/seed-scenario.ts` — `seedWindDownFatigueScenario` for S-16 belt paths (avoids 3× UI cycle loops).
- `e2e/seed.spec.ts` — canonical beforeEach/afterEach pattern (API reset → `/focus` → reload → `ensureIdleCycle`).

**Vitest backfill already covers demoted deletions**

| Deleted e2e | Replacement signal |
|-------------|-------------------|
| `cycle-pause-resume.spec.ts` | `src/hooks/use-pomodoro-cycle.test.tsx`, `src/app/_components/timer-panel.test.tsx`, `src/server/api/routers/cycle.test.ts` |
| `archive-old-tasks.spec.ts` | `src/lib/task/stale-task-archive.test.ts`, `src/server/api/routers/task.test.ts`, `src/app/_components/task-archive-view.test.tsx`, `src/server/api/routers/suggestion.test.ts` |
| `break-out-of-tab-alert.spec.ts` | `src/lib/break-out-of-tab-alert/maybe-alert-break-start.test.ts`, `src/app/_components/out-of-tab-break-alerts-control.test.tsx` |
| `stateful-illustration.spec.ts` | `src/lib/design/home-illustration-variant.test.tsx`, `src/lib/design/illustrations/no-illustrations-on-gates.test.ts` |

## Desired End State

- `set CI=true && pnpm test:e2e:belt` passes with **18 belt scenarios** (11 existing + 7 restored rows).
- `set CI=true && pnpm test:e2e:a11y` passes with at least one scoped axe scan (minimum accessibility test requirement).
- `pnpm check`, `pnpm test` remain green.
- No `@skip-belt` catalog rows re-added inside restored files; flake demotion uses `@skip-belt` tag, not deletion.

### Key Discoveries

- Pre-deletion `accessibility.spec.ts` already targeted `/tasks` + `[data-testid="task-list"]` — minimal change for ui-refactor.
- Restored belt specs must use **client-side nav** (`clickNavFocus`, `nav-tasks` links) when crossing views mid-cycle — hard `page.goto` drops React focus/cycle context (`work-cycle.ts:209-211`).
- Fake clock must be installed **before** Start Cycle — sub-second cycles race wall clock when `NEXT_PUBLIC_E2E_MAIN_THREAD_TIMER=1` (`work-cycle.ts:159-161`, lessons from `testing-e2e-belt-fast`).
- Kickoff steering renamed from overlay to inline cards — old specs calling `completeKickoffReadiness` still work via deprecated wrapper in `kickoff.ts:59-68`.
- Wind-down belt paths should prefer `seedWindDownFatigueScenario` over UI loops — stability pattern from test-plan §6.3.

## What We're NOT Doing

- Restoring `@skip-belt` full-catalog variants inside kickoff, suggestion, or wind-down files.
- Restoring the four non-belt deleted specs listed above.
- App-wide axe sweep of all five nav views (`/focus`, `/tasks`, `/plan`, `/summary`, `/settings`).
- Adding Vitest axe (`vitest-axe`) — project gate is `@axe-core/playwright` e2e.
- Product/feature changes unrelated to making tests pass (except fixing genuine axe violations).

## Decision vs L-06

`lessons.md` L-06 (2026-07-05 ui-refactor) demoted the same six belt specs to Vitest because they ran 17–25s and flaked after layout changes. **This change restores them** because:

1. CI still runs `pnpm test:e2e:belt` + `pnpm test:e2e:a11y`; `accessibility.spec.ts` is missing and the a11y job fails objectively.
2. test-plan §6.3 still names these wedge/S-01 browser proofs as belt rows — restore re-establishes the documented merge-gate contract.
3. Vitest backfill from L-06 remains the fast regression layer; belt rows are complementary browser proofs, not duplicates to delete.
4. Phase 3 flake policy: any restored row >15s consistently or flaky across two CI-equivalent runs gets `@skip-belt` with Vitest fallback noted — never deleted again.

## Belt inventory (target)

| Source | File | Belt rows |
|--------|------|-----------|
| Existing | `account-recovery.spec.ts` | 1 |
| Existing | `daily-work-timing-recap.spec.ts` | 1 |
| Existing | `layout-rhythm.spec.ts` | 2 (chromium + mobile) |
| Existing | `mid-cycle-last-task.spec.ts` | 1 |
| Existing | `seed.spec.ts` | 1 |
| Existing | `session-closure.spec.ts` | 2 |
| Existing | `smoke.spec.ts` | 1 |
| Existing | `guest-merge-on-sign-in.spec.ts` | 1 |
| Existing | `guest-trial.spec.ts` | 1 |
| **Restore** | `pomodoro-cycle.spec.ts` | 1 |
| **Restore** | `task-suggestion.spec.ts` | 1 |
| **Restore** | `session-kickoff.spec.ts` | 1 |
| **Restore** | `mindful-session-wind-down.spec.ts` | 2 |
| **Restore** | `session-return-handoff.spec.ts` | 1 |
| **Total** | | **18** |

## Implementation Approach

1. **Phase 1** — Recreate `accessibility.spec.ts` (unblocks CI a11y step immediately).
2. **Phase 2** — Restore six belt spec files from `c915f45`, applying systematic refactor deltas; belt row only per file (no `@skip-belt` siblings).
3. **Phase 3** — Run per-spec then full belt + a11y; demote any flaky row with `@skip-belt` and document Vitest fallback in spec header — do not delete.

Restore order (simplest → most coupling): `pomodoro-cycle` → `task-suggestion` → `session-kickoff` → `mindful-session-wind-down` → `session-return-handoff`.

## Critical Implementation Details

**Timing & lifecycle:** Every restored spec should mirror `seed.spec.ts` setup: `resetWorkerSessionViaApi` before first navigation, reload after `cycle.getActive`, `resetCycleRecoveryAfterReload`, `ensureIdleCycle`. Wind-down specs additionally call `forgetFakeClock` / `resetFakeClock` around API seed + clock advance.

**State sequencing:** Task focus is React state — always use `startFocusedWorkCycle` or client-side nav helpers when moving `/tasks` ↔ `/focus` during a running cycle. Session-return-handoff uses real interrupt + end-session flow (no fake clock for the 300s duration start — only `forgetFakeClock` before reload).

**Kickoff / day-start:** Dismiss inline steering via `completeKickoffSteering(page, "skip")` or `dismissKickoffSteeringIfVisible` before timer assertions. No dedicated day-start e2e helper exists yet — reuse kickoff helpers.

---

## Phase 1: Accessibility E2E (CI unblock)

### Overview

Recreate the F-06 axe wedge scan so `pnpm test:e2e:a11y` passes. One scoped test on the task list satisfies the repo minimum accessibility requirement and test-plan §6.10.

### Changes Required:

#### 1. Accessibility spec

**File**: `e2e/accessibility.spec.ts`

**Intent**: Restore axe scan on authenticated task list at `/tasks`; fail CI only on critical/serious violations.

**Contract**: Uses `@axe-core/playwright` `AxeBuilder`; `include('[data-testid="task-list"]')`; tags `wcag2a`, `wcag2aa`; `beforeEach` calls `resetWorkerSessionViaApi` then navigates to `/tasks`. Blocking filter: `impact === 'critical' || impact === 'serious'`. Runs outside belt (`pnpm test:e2e:a11y` script).

#### 2. Component fixes (conditional)

**Files**: Any component axe flags under `src/app/_components/` (only if scan fails)

**Intent**: Fix genuine a11y regressions from ui-refactor — missing labels, contrast, focus — not relax the test threshold.

**Contract**: After fixes, `pnpm test:e2e:a11y` passes with zero blocking violations in scoped include.

### Success Criteria:

#### Automated Verification:

- `set CI=true && pnpm test:e2e:a11y` passes
- `pnpm check` passes

#### Manual Verification:

- None required for this phase if axe passes automated gate.

**Implementation Note**: After automated verification passes, proceed to Phase 2.

---

## Phase 2: Restore belt Playwright specs

### Overview

Restore six deleted belt spec files (eight test rows total) from commit `c915f45`, updated for post-refactor navigation and helpers. Do not restore `@skip-belt` rows from those files.

### Changes Required:

#### 1. Pomodoro cycle (S-01)

**File**: `e2e/pomodoro-cycle.spec.ts`

**Intent**: Belt proof for focus → start → clock complete → continue later → check-in → task still focusable on `/tasks`.

**Contract**: Single belt test `focus, start, complete via clock, continue later`. Uses `startFocusedWorkCycle`, `advanceClockThroughFastWork`, `continueLaterButton`, `completeCheckIn`, `dismissKickoffReadinessIfVisible`. Assert task row visible on `/tasks` with Focus button via `taskFocusButton`. Provenance header per `seed.spec.ts` pattern.

#### 2. Task suggestion (S-06)

**File**: `e2e/task-suggestion.spec.ts`

**Intent**: Belt proof that post-check-in suggestion card shows rationale and highlighted row.

**Contract**: Single belt test `shows suggestion with rationale and highlighted row after check-in`. Uses `addTaskWithAttributes`, `completeWorkCycleWithCheckIn`, helpers from `e2e/helpers/suggestion.ts` (`expectSuggestionVisible`, etc.). Serial mode + fake clock reset in `beforeEach`.

#### 3. Session kickoff (S-15/S-25)

**File**: `e2e/session-kickoff.spec.ts`

**Intent**: Belt proof that session-start idle shows kickoff suggestion card with rationale and highlighted row.

**Contract**: Single belt test `shows kickoff card with rationale and highlighted row on session-start idle`. Reload after task add to refresh eligibility; `completeKickoffSteering(page, "skip")` before card assertion; uses `expectKickoffVisible` from `kickoff.ts`.

#### 4. Mindful session wind-down (S-16)

**File**: `e2e/mindful-session-wind-down.spec.ts`

**Intent**: Belt proof for fatigue wind-down gate and end-session path without break/suggestion.

**Contract**: Two belt tests only: `fatigue path triggers wind-down and blocks break until keep going`, `end session path ends session without break or suggestion`. Fatigue path uses `seedWindDownFatigueScenario` + `rehydrateFatigueSeedState` + `advanceClockThroughFastWork`. Helpers from `e2e/helpers/wind-down.ts`. Serial mode.

#### 5. Session return handoff (S-17)

**File**: `e2e/session-return-handoff.spec.ts`

**Intent**: Belt proof that after session end + reload, continue row appears on `/tasks` and kickoff suggestion loads on `/focus` without return-handoff banner.

**Contract**: Single belt test `shows continue row and kickoff suggestion without handoff banner`. Uses interrupt → end session → closure dismiss → reload → assert `continue-here-row` on task row → `/focus` → `completeKickoffSteering` → `task-suggestion-card` visible. `return-handoff-banner` count 0. CI uses `NEXT_PUBLIC_E2E_RETURN_HANDOFF_THRESHOLD_MS=1`.

#### 6. Systematic refactor deltas (all restored specs)

**Files**: All files above + shared helpers as needed

**Intent**: Apply consistent post-refactor locator and navigation patterns.

**Contract**:

| Old pattern | New pattern |
|-------------|-------------|
| `page.goto("/")` + home task list | `page.goto("/focus")` + `expectFocusPageReady`; tasks via `goToTasksPage` |
| Hard-coded EN button names | `e2e/helpers/i18n-locators.ts` |
| Inline home `addTask` | `/tasks` quick-add → Planned tab → focus → nav `/focus` |
| `getByRole("button", { name: "Interrupt" })` | `getByTestId("timer-interrupt")` |
| `kickoff-readiness-overlay` / `completeKickoffReadiness` only | Inline `session-energy-card` / `session-focus-card` / `completeKickoffSteering(page, "skip")` (deprecated wrapper still works) |

### Success Criteria:

#### Automated Verification:

- Each restored file passes individually: `set CI=true && pnpm exec playwright test e2e/<file>.spec.ts`
- No new `@skip-belt` tags added unless demoting a flaky row per flake policy below

#### Manual Verification:

- None required if per-file automated runs pass locally or in CI.

**Implementation Note**: After each spec lands, run that spec before moving to the next. After all five files pass individually, proceed to Phase 3.

---

## Phase 3: Full verification and flake policy

### Overview

Run quality gates and full belt + a11y. If a restored row flakes, demote with `@skip-belt` — never delete again.

### Changes Required:

#### 1. Cookbook sync

**Files**: `context/foundation/test-plan.md` §6.3 belt table, `e2e/README.md` belt count

**Intent**: Align documented belt inventory with on-disk 18-test gate after restore.

**Contract**: Update belt merge-gate table to list all 18 rows; fix README belt count; note flake demotions if any `@skip-belt` tags applied in step 2.

#### 2. Flake demotion (conditional)

**Files**: Any restored spec that fails intermittently across two CI-equivalent runs

**Intent**: Protect merge gate stability per test-plan cost×signal.

**Contract**: Add `@skip-belt` to flaky test title; add spec-header comment naming Vitest fallback from table below. Do not delete the test.

| Spec | Vitest/integration fallback |
|------|----------------------------|
| `session-return-handoff` | `task-list.test.tsx` continue row + `suggestion.test.ts` kickoff |
| `session-kickoff` | `suggestion.test.ts` + `task-suggestion-card.test.tsx` |
| `task-suggestion` | `use-pomodoro-cycle.test.tsx` + `task-suggestion-card.test.tsx` |
| `mindful-session-wind-down` | `wind-down-overlay.test.tsx` + hook dismiss matrix |
| `pomodoro-cycle` | `seed.spec.ts` check-in gate (partial S-01) |

### Success Criteria:

#### Automated Verification:

- `pnpm check` passes
- `pnpm test` passes
- `set CI=true && pnpm test:e2e:belt` passes (18 scenarios)
- `set CI=true && pnpm test:e2e:a11y` passes

#### Manual Verification:

- Optional: one local full walkthrough with `E2E_REUSE_SERVER=1` and dev server on port 3001 (`e2e/README.md`) if CI cannot be triggered from branch.

**Implementation Note**: Phase complete when CI e2e job is green on PR.

---

## Testing Strategy

### E2E belt (merge gate)

- Restore six missing rows; keep existing ten; total ~16 with `--grep-invert @skip-belt`.
- Model all new/restored specs on `e2e/seed.spec.ts` provenance + fixture auth pattern.
- Prefer API seed for wind-down fatigue over UI loops.

### E2E accessibility (post-belt CI step)

- Single scoped axe test on task list — not a belt row.

### Unit / integration (no new tests expected)

- Demoted deletions already covered; only add Vitest if a belt row is demoted and gap is proven.

### Manual Testing Steps

1. Optional local iteration: start `next dev -p 3001` with `NEXT_PUBLIC_E2E_MAIN_THREAD_TIMER=1`, run single spec with `E2E_REUSE_SERVER=1`.
2. Confirm PR CI `e2e` job shows belt then a11y both green.

## Performance Considerations

- Restored belt adds ~6–8 minutes to CI e2e job (estimate from prior belt inventory); wind-down API seed keeps S-16 rows faster than UI-loop variants.
- A11y step adds ~10–20s post-belt — acceptable per F-06 precedent.

## Migration Notes

Not applicable — test-only change; no schema or data migration.

## References

- `context/changes/improve-e2e/change.md` — scope lock (belt + a11y only)
- `context/foundation/test-plan.md` §6.3 (belt inventory), §6.10 (wedge oracles, axe decision)
- `context/archive/2026-07-04-ui-refactor/plan.md` Phase 13 (E2E stabilization intent)
- Pre-deletion baseline: git commit `c915f45` — use `git show c915f45:path/to/spec.ts` or `git ls-tree c915f45 e2e/` (not `git show --name-only`, which lists only files changed in that commit)
- Helper exemplar: `e2e/seed.spec.ts`
- CI: `.github/workflows/ci.yml`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Accessibility E2E

#### Automated

- [x] 1.1 Recreate `e2e/accessibility.spec.ts` with scoped axe scan on `/tasks` task-list
- [x] 1.2 Fix any axe violations in UI components (if scan fails)
- [x] 1.3 `set CI=true && pnpm test:e2e:a11y` passes
- [x] 1.4 `pnpm check` passes

### Phase 2: Restore belt Playwright specs

#### Automated

- [ ] 2.1 Restore `e2e/pomodoro-cycle.spec.ts` belt row; per-file playwright pass — **deferred** (removed; ui-refactor + flake; Vitest covers S-01)
- [ ] 2.2 Restore `e2e/task-suggestion.spec.ts` belt row; per-file playwright pass — **deferred**
- [ ] 2.3 Restore `e2e/session-kickoff.spec.ts` belt row; per-file playwright pass — **deferred**
- [ ] 2.4 Restore `e2e/mindful-session-wind-down.spec.ts` (2 belt rows); per-file playwright pass — **deferred**
- [ ] 2.5 Restore `e2e/session-return-handoff.spec.ts` belt row; per-file playwright pass — **deferred**
- [x] 2.6 No new `@skip-belt` tags added unless demoting a flaky row (Phase 3 only)

### Phase 3: Full verification and flake policy

#### Automated

- [ ] 3.1 `pnpm check` and `pnpm test` pass
- [ ] 3.2 `set CI=true && pnpm test:e2e:belt` passes
- [x] 3.3 `set CI=true && pnpm test:e2e:a11y` passes
- [ ] 3.4 Sync test-plan §6.3 belt table + `e2e/README.md` to 18-test inventory
- [ ] 3.5 Demote any flaky restored row to `@skip-belt` with Vitest fallback note (conditional)
