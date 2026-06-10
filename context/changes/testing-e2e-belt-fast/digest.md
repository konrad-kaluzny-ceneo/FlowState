---
roadmap_id: test-plan-phase-7
change_id: testing-e2e-belt-fast
prd_refs: test-plan §2 #1–#7
updated: 2026-06-10
---

## Outcome
Ship the 12-test Playwright belt as the CI merge gate (`pnpm test:e2e:belt`), replacing ~49 full-catalog e2e tests and targeting ≤3–4 min e2e job time while keeping browser entry points for test-plan risks #1–#7.

## PRD acceptance (cited FRs only)
- test-plan §3 Phase 7: belt + Vitest backfill; swap CI `e2e` job command; job name unchanged
- Risk coverage: #1 guest-trial belt; #2 hook/Vitest after demotion; #3 seed + last-task; #4/#6 integration-only; #5 guest-merge belt; #7 seed + pomodoro partial

## Risks and unknowns
- Belt table lives on PR #90 branch, not `main` — soft blocker for plan references
- Missing Vitest/component tests for several demoted paths (overlays, guest hooks) before file deletion
- 4-worker auth pool and wind-down API seed are prerequisites, not optional optimizations

## Lessons (applicable)
- Cost × signal: Phase 4 full-suite gate was intentional; belt is the corrective (test-plan §1)
- Neon 429 at parallel per-test sign-up → worker-scoped `storageState` pool
- L-04: demoted UI surfaces need per-control component oracles

## E2E risks (if browser slice)
- Belt inventory: 12 tests / 10 files; partial specs use `@skip-belt` + `--grep-invert`
- Demotion intent: delete 11 e2e files (completion, merge-success, cycle-merge, reorder, onboarding×2, audio×2, background-tab×2) after backfill
- Prerequisites: `global-setup` 4-user pool, CI build cache, `seed-scenario.ts` for wind-down fatigue
