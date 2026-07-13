# Restore belt E2E and accessibility after ui-refactor — Plan Brief

> Full plan: `context/changes/improve-e2e/plan.md`

## What & Why

PR #188 deleted six belt merge-gate Playwright specs and the axe accessibility spec while CI still runs both `pnpm test:e2e:belt` and `pnpm test:e2e:a11y`. The merge gate lost wedge/S-01 browser proofs and the a11y job fails on a missing file. This change restores belt + a11y coverage only, adapted to the post-refactor shell (`/focus`, `/tasks`, planned-tab tasks).

## Starting Point

Branch `features/fix-e2e-tests` already updated e2e helpers. **11 belt scenarios** still run; restore adds **7 rows** → **18** total. Four deleted non-belt specs are covered by existing Vitest/integration tests.

## Desired End State

CI e2e job passes belt (18 scenarios) and a11y (one scoped axe scan on task list). Developers can run individual restored specs locally with the same helper patterns as `e2e/seed.spec.ts`. No deleted specs — only restored, updated, or demoted with `@skip-belt`.

## Key Decisions Made

| Decision | Choice | Why | Source |
|----------|--------|-----|--------|
| E2E restore scope | Belt + a11y only | Fast stable merge gate; cost×signal per test-plan | Plan |
| Non-belt deletions | Keep on Vitest/integration | Pause, archive, tab-alert, illustration already covered cheaper | Plan / test-plan §6.10 |
| A11y scan scope | Task list at `/tasks` only | Matches pre-deletion spec + test-plan; avoids slow 5-view audit | Plan |
| `@skip-belt` catalog rows | Do not restore | Ad-hoc only; user workflow prioritizes belt stability | Plan |
| Flake policy | Demote with `@skip-belt`, never delete | test-plan Phase 7 precedent | Plan |
| Restore baseline | Git commit `c915f45` | Last good specs before ui-refactor deletion | Plan |
| Restore order | pomodoro → suggestion → kickoff → wind-down → handoff | Simplest flows first; wind-down uses API seed | Plan |

## Scope

**In scope:**

- `e2e/accessibility.spec.ts` (axe on task list)
- Six restored belt spec files (7 test rows)
- Component fixes for genuine axe violations
- Flake demotion with `@skip-belt` if needed
- test-plan §6.3 + `e2e/README.md` belt inventory sync (Phase 3)

**Out of scope:**

- Four non-belt deleted specs and their `@skip-belt` siblings
- App-wide axe sweep of all nav views
- Vitest axe dependency
- `e2e/README.md` / `test-plan.md` doc sync (moved to Phase 3 in-scope)

## Architecture / Approach

Restore specs from `c915f45`, apply systematic deltas (multi-view nav, i18n locators, client-side nav for focus state, fake clock before start). Wind-down belt rows use `seedWindDownFatigueScenario` API seed. A11y runs as separate CI step after belt via `@axe-core/playwright`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|-------|------------------|----------|
| 1. Accessibility E2E | Unblocks `test:e2e:a11y` | New UI axe violations need component fixes |
| 2. Restore belt specs | Six files, seven belt rows | Flaky cross-view nav if hard `goto` used |
| 3. Verification | Full belt + a11y green + cookbook sync | session-return-handoff reload timing |

**Prerequisites:** Work on `features/fix-e2e-tests`; Neon secrets in `.env` for local e2e; Chromium installed.

**Estimated effort:** ~2–3 focused sessions across 3 phases.

## Open Risks & Assumptions

- Inline kickoff steering (`session-energy-card`) may need extra dismiss calls in kickoff/handoff specs — helpers exist but ui-refactor may have changed visibility timing.
- `session-closure` now has two belt tests (not in original six deletions) — belt count ~16, not 12 as README still claims.
- Assumes no new product regressions beyond what axe/belt surface.

## Success Criteria (Summary)

- `pnpm test:e2e:belt` and `pnpm test:e2e:a11y` pass in CI.
- At least one accessibility test exists in the repo (axe e2e).
- Deleted wedge browser proofs are back on the merge gate without re-adding flaky catalog tests.
