# E2E Belt Merge Gate — Plan Brief

> Full plan: `context/changes/testing-e2e-belt-fast/plan.md`  
> Research: `context/changes/testing-e2e-belt-fast/research.md`

## Outcome

Ship a **12-test Playwright belt** as the CI merge gate (`pnpm test:e2e:belt`), cutting e2e job time from ~10+ minutes to **≤3–4 minutes** while preserving browser entry points for test-plan risks #1, #3, #5, #7 and critical session flows (S-01, S-06, S-07, S-15, S-16). Demoted UI paths move to Vitest/component tests; 10 redundant e2e files are deleted only after backfill. Four parallel workers use a pre-provisioned auth pool; wind-down belt tests seed state via tRPC instead of UI cycle loops.

## Current vs Target

| Area | Current (`36a152c`) | Target (Phase 7 complete) |
|------|---------------------|---------------------------|
| CI e2e command | `pnpm test:e2e` (49 tests) | `pnpm test:e2e:belt` (12 tests) |
| CI workers | `E2E_WORKERS=1` (Neon 429 workaround) | `E2E_WORKERS=4` + auth pool |
| Auth pattern | Per-test `createTestUser` in fixtures | `global-setup.ts` → `e2e/.auth/worker-{n}.json` |
| CI build | Inline `pnpm build` in Playwright webServer | Separate build step + `.next/cache` cache |
| Wind-down setup | 3× UI cycles via `wind-down.ts` helpers | `seed-scenario.ts` tRPC seed |
| Demoted paths | 10 e2e files still on disk | Deleted; Vitest/component oracles |
| test-plan §3 Phase 7 | Not on `main`; on PR #90 branch | Rebased + marked `complete` |
| Local full catalog | Same as CI | `pnpm test:e2e` (~27 tests post-demotion: 49 − 22 deleted) |

## Phase Summary

| Phase | Deliverable | Key risk |
|-------|-------------|----------|
| 1. Test-plan doc sync | Rebase onto `test-plan-refresh-2026-06-10`; §6.3 belt table on disk | Rebase conflicts in test-plan.md |
| 2. Belt selection + auth pool | `@skip-belt`, `test:e2e:belt`, global-setup, fixtures storageState | Wind-down still slow until Phase 3 seed |
| 3. Wind-down seed + CI swap | `seed-scenario.ts`, CI build cache, belt command, 4 workers | tRPC seed contract wrong → belt red |
| 4. Vitest backfill | 7 new/extended component + hook tests | Demoting before backfill loses signal |
| 5. Demotion + docs | Delete 10 specs, update AGENTS/README, Phase 7 complete | Orphan imports after file deletion |

## Key Risks / Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| PR #90 timing | Rebase onto refresh branch (don't wait for merge) | Belt table is implementation contract |
| Guest background-tab | Add minimal `use-pomodoro-cycle-guest.test.tsx` catchUp | Auth hook + component tests don't cover guest hook path |
| Guest merge cycle demotion | `guest.test.ts` + one new hook test for post-sign-in resume | Integration matrix + hook oracle sufficient |
| Task reorder demotion | Minimal drag-handle smoke in `task-list.test.tsx` | L-04 per-control smoke; mutation tests don't cover handle UI |
| Wind-down belt scope | Fatigue + end-session only | Interruption/negative cases demoted to Vitest |
| `wind-down.ts` helpers | Keep until Phase 5 | Local full-catalog runs until demotion |
| Partial spec strategy | `@skip-belt` + grep-invert | Avoid file splits; preserve local full-file runs |

## Pointer

Detailed phase steps, file contracts, belt table, demotion list, and Progress checkboxes: **`context/changes/testing-e2e-belt-fast/plan.md`**

Next command: `/10x-implement testing-e2e-belt-fast phase 1`
