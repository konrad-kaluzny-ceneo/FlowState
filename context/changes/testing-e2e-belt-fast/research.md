---
date: 2026-06-10T12:00:00+02:00
researcher: Auto
git_commit: 36a152cc9b8d56a8c8395d62bec96b5eeac3db31
branch: features/testing-e2e-belt-fast
repository: FlowState
topic: "E2E belt merge gate — current e2e/CI state and implementation prerequisites"
tags: [research, e2e, playwright, ci, vitest, test-plan-phase-7]
status: complete
last_updated: 2026-06-10
last_updated_by: Auto
---

# Research: E2E belt merge gate — current e2e/CI state and implementation prerequisites

**Date**: 2026-06-10T12:00:00+02:00  
**Researcher**: Auto  
**Git Commit**: 36a152cc9b8d56a8c8395d62bec96b5eeac3db31  
**Branch**: features/testing-e2e-belt-fast  
**Repository**: FlowState

## Research Question

What is the current e2e/CI state on disk, what does the agreed belt strategy require, and what must this change deliver?

## Summary

On `features/testing-e2e-belt-fast` at commit `36a152c`, CI still runs the **full Playwright catalog** — 49 tests across 20 spec files — via `pnpm test:e2e` with `E2E_WORKERS=1` serial auth sign-up per test. None of the belt infrastructure exists yet: no `test:e2e:belt` script, no `@skip-belt` tags, no `global-setup.ts`, no worker `storageState` pool, no `seed-scenario.ts`, and no CI build cache.

The agreed strategy (documented on PR [#90](https://github.com/konrad-kaluzny-ceneo/FlowState/pull/90), not yet on `main` `test-plan.md`) replaces the merge gate with **12 tests in 10 files**, enables **4 parallel workers** via a pre-provisioned auth pool, targets **≤3–4 min** CI e2e job time, and **deletes 10 demoted spec files** (plus wind-down helper UI-setup refactor) only after Vitest/component backfill closes the signal gaps. Risks #4 and #6 stay integration-only; #2 moves entirely to Vitest after demotion.

This change must deliver: belt script + tagging, auth pool migration, wind-down API seed helper, CI command/cache/worker swap, Vitest backfill matrix, demoted file deletion, and docs sync once PR #90 merges.

## Detailed Findings

### Current CI/e2e state

- **CI job**: `.github/workflows/ci.yml` runs `pnpm test:e2e` after migrate + Playwright install; `E2E_WORKERS: "1"` forces serial workers; no separate `pnpm build` step or `.next/cache` — production server build happens inside Playwright `webServer` on every run.
- **Playwright config**: `playwright.config.ts:29-40` — worker count from `E2E_WORKERS` or CI default `1`; `fullyParallel: true`; no `globalSetup`; no belt grep/project filter.
- **Auth pattern**: `e2e/fixtures.ts:10-31` — every authenticated test calls `createTestUser` + `signInAsUser` via API; `postAuthWithRetry` in `e2e/helpers/user.ts:12-37` exists for Neon 429 backoff but serial CI still pays per-test sign-up latency.
- **Package scripts**: `package.json:21` — only `"test:e2e": "playwright test"`; no `test:e2e:belt`.
- **Catalog size**: `pnpm exec playwright test --list` reports **49 tests in 20 files** (includes duplicate path entries from Windows casing on some specs).
- **Production parity path**: `playwright.config.ts:16-27` builds on CI via `E2E_PRODUCTION_SERVER` / `GITHUB_ACTIONS`; local default is `next dev --turbo`.

### Belt inventory vs on-disk

Agreed belt table (PR #90 `test-plan.md` §6.3 `#### Belt merge gate` — **not on main yet**):

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
| 9 | `e2e/mindful-session-wind-down.spec.ts` | fatigue + end-session paths (after API seed) | 2 | S-16 gate |
| 10 | `e2e/account-recovery.spec.ts` | `request-password-reset API returns 2xx` only | 1 | S-07 API contract |

**On-disk gaps for belt selection:**

- All 10 belt-retained spec files exist with full test counts (no `@skip-belt` tags yet).
- Partial files currently run **all** tests when invoked — e.g. `pomodoro-cycle.spec.ts` has 2 tests, `task-suggestion.spec.ts` has 4, `session-kickoff.spec.ts` has 5, `mindful-session-wind-down.spec.ts` has 7, `account-recovery.spec.ts` has 3.
- **Demoted specs still on disk** (10 files, all present): `mid-cycle-completion`, `merge-success-on-sign-in`, `guest-merge-cycle-on-sign-in`, `task-reorder`, `first-run-onboarding`, `guest-first-run`, `quiet-cycle-audio`, `guest-quiet-cycle-audio`, `background-tab-return`, `guest-background-tab-return`. `persistence-reload` is already absent (removed in Phase 1).
- **Missing infra**: `e2e/global-setup.ts`, `e2e/.auth/worker-{n}.json` pool, `e2e/helpers/seed-scenario.ts`, `@skip-belt` annotations, `pnpm test:e2e:belt` with `--grep-invert @skip-belt`.

### Auth pool migration

**Current**: Per-test isolated users — correct for parallel safety but expensive at scale; Phase 4 intentionally set `E2E_WORKERS=1` in CI to avoid Neon 429 (`ci.yml:61`).

**Target** (PR #90 §6.6 Phase 7):

- `e2e/global-setup.ts` provisions **4 users** once before the suite.
- `fixtures.ts` loads worker-scoped `storageState` from `e2e/.auth/worker-{workerIndex}.json` instead of per-test sign-up.
- CI sets `E2E_WORKERS=4` once pool lands.

**Reversal of Phase 1 decision**: Shared `storageState` was removed after parallel conflicts (`testing-critical-path-persistence-timer` scope addendum). The belt plan reintroduces shared state **scoped per worker** (4 users / 4 workers), not one global user — addressing the original race while enabling parallelism.

**Implementation touchpoints**: new `global-setup.ts`; rewrite `fixtures.ts:26-31`; add `globalSetup` to `playwright.config.ts`; gitignore `e2e/.auth/`; update `e2e/README.md:52` (currently documents per-test auth, which is accurate today).

### Vitest backfill matrix

Demoted e2e paths must have cheaper-layer oracles **before** file deletion (L-04: per-control component smoke for demoted UI surfaces).

| Demoted e2e file | Risk | Belt / replacement signal | Vitest status on disk |
|------------------|------|---------------------------|------------------------|
| `mid-cycle-completion.spec.ts` | #3 | Belt: `seed` + `mid-cycle-last-task` | **EXISTS** — `mid-cycle-completion-prompt.test.tsx` (both-choice + continue/end paths); hook coverage in `use-pomodoro-cycle.test.tsx` |
| `merge-success-on-sign-in.spec.ts` | #5 | Belt: `guest-merge-on-sign-in` | **PARTIAL** — `defer.test.ts` + `merge-copy.test.ts` cover defer/copy logic; **MISSING** `merge-success-overlay.test.tsx` component smoke |
| `guest-merge-cycle-on-sign-in.spec.ts` | #5 | Belt: `guest-merge-on-sign-in` | **PARTIAL** — `guest.test.ts` covers RUNNING closure + FK remap; **MISSING** hook/browser oracle for "guest active cycle resumes after sign-in" |
| `task-reorder.spec.ts` | #1/#5 | Integration | **PARTIAL** — `task-mutation.test.ts:313+`, `use-task-mutations.test.tsx:438+`, `task-list.test.tsx`; **MISSING** DnD drag-handle UI smoke |
| `first-run-onboarding.spec.ts` | onboarding | None (Vitest only) | **PARTIAL** — `defer.test.ts`, onboarding lib tests; **MISSING** `first-run-overlay.test.tsx`, check-in/suggestion coach wedge tests |
| `guest-first-run.spec.ts` | onboarding | None | **MISSING** guest-mode `first-run-overlay` component tests |
| `quiet-cycle-audio.spec.ts` | #2/S-20 | Vitest hook/lib | **PARTIAL** — `use-cycle-end-audio-preference.test.tsx`, `preference.test.ts`, `audio.test.ts`; **MISSING** preference toggle UI component test (`aria-pressed` controls) |
| `guest-quiet-cycle-audio.spec.ts` | #2/S-20 | Same | Same gap as auth path |
| `background-tab-return.spec.ts` | #2 | Vitest hook | **EXISTS** — `use-pomodoro-cycle.test.tsx:2472-2710` (hidden expiry, catchUp, visibility recalc); **EXISTS** — `tab-return-catchup.test.tsx` component |
| `guest-background-tab-return.spec.ts` | #2 | Vitest guest hook | **MISSING** — no `use-pomodoro-cycle-guest.test.tsx` visibility/catchUp tests found |
| Wind-down UI setup in `wind-down.ts` | S-16 | Belt partial + `seed-scenario.ts` | **PARTIAL** — `wind-down-nudge.test.ts`, lib copy tests; **MISSING** `wind-down-overlay.test.tsx`; **MISSING** `check-in-overlay.test.tsx` gate shell; **MISSING** `seed-scenario.ts` |

**Already adequate (no demotion blocker):**

- `kickoff-readiness-overlay.test.tsx` — kickoff overlay covered at component layer.
- `task-suggestion-card.test.tsx` — S-06/S-23 component oracles exist.
- Risk #4/#6 — integration matrix in `*-isolation.test.ts` files; no belt e2e required.

### CI/build changes

Required deliverables for Phase 7 (from PR #90 §6.6 Phase 7 + digest):

1. **`pnpm test:e2e:belt`** — `playwright test --grep-invert @skip-belt` (exact flags TBD in plan); keep `test:e2e` for full catalog locally.
2. **CI command swap** — `.github/workflows/ci.yml:92-93` changes from `pnpm test:e2e` to `pnpm test:e2e:belt`; job name stays `e2e`.
3. **`E2E_WORKERS=4`** — after auth pool; remove serial-only workaround from Phase 4.
4. **Build cache** — separate `pnpm build` step + cache `.next/cache`; `webServer` becomes `next start` only in CI (no rebuild inside Playwright timeout).
5. **Tag partial specs** — `@skip-belt` on non-belt tests in 5 partial files (6 belt rows that share files with demoted tests).
6. **`seed-scenario.ts`** — tRPC `page.request.post` helper to seed fatigue/interruption state for wind-down belt tests (replaces 3× UI cycle setup in `wind-down.ts:55+`).
7. **Delete demoted files** — only after Vitest matrix rows marked complete.
8. **Docs** — merge PR #90 so §6.3 belt table and §3 Phase 7 row land on `main`; update `AGENTS.md` E2E section for belt command.

**Time target**: ≤3–4 min e2e job (down from ~10+ min full catalog at `E2E_WORKERS=1` with per-test auth + inline build).

## Code References

- `.github/workflows/ci.yml:52-93` — `e2e` job: `E2E_WORKERS=1`, runs full `pnpm test:e2e`, no build cache step
- `playwright.config.ts:29-40` — CI worker default `1`, `fullyParallel: true`, no `globalSetup`
- `playwright.config.ts:62-73` — CI webServer runs inline `pnpm build && next start`
- `package.json:21` — only `test:e2e` script; no belt variant
- `e2e/fixtures.ts:10-31` — per-test `createTestUser` + cookie/localStorage injection
- `e2e/helpers/user.ts:12-37` — auth retry for 429/503 (Neon rate limits)
- `e2e/smoke.spec.ts:12` — single infra smoke test (belt #1)
- `e2e/seed.spec.ts:17-47` — two exemplar tests for risks #3 and #7 (belt #2)
- `e2e/guest-trial.spec.ts:12` — guest reload persistence (belt #3, risk #1)
- `e2e/mid-cycle-last-task.spec.ts:22` — end-break-only path (belt #4, risk #3)
- `e2e/guest-merge-on-sign-in.spec.ts:17` — guest task import (belt #5, risk #5)
- `e2e/pomodoro-cycle.spec.ts:22-50` — two S-01 tests; only first is belt-retained
- `e2e/mid-cycle-completion.spec.ts:23-69` — three tests demoted after component backfill
- `e2e/mindful-session-wind-down.spec.ts:49-134` — seven tests; belt keeps fatigue + end-session only
- `e2e/helpers/wind-down.ts:55-59` — `completeSteadyWorkCycleAndResumeIdle` UI loop targeted for API seed replacement
- `src/app/_components/mid-cycle-completion-prompt.test.tsx:21-29` — existing #3 component oracle
- `src/hooks/use-pomodoro-cycle.test.tsx:619` — `resumes running state from getActive on mount` (risk #1)
- `src/hooks/use-pomodoro-cycle.test.tsx:2517-2635` — hidden-tab catchUp tests (risk #2, replaces demoted background-tab e2e)
- `src/app/_components/tab-return-catchup.test.tsx:21-29` — catch-up UI component oracle
- `src/app/_components/merge-success-overlay.tsx:11-18` — component exists; no co-located `*.test.tsx`
- `src/app/_components/first-run-overlay.tsx:11-20` — component exists; no co-located `*.test.tsx`
- `src/app/_components/check-in-overlay.tsx:18-20` — check-in gate UI; no component test
- `src/app/_components/wind-down-overlay.tsx:17-20` — wind-down gate UI; no component test
- `src/server/api/routers/guest.test.ts:218-255` — RUNNING closure integration (partial #5 backfill)

## Architecture Insights

- **Cost × signal hierarchy holds**: Phase 4 wired the full catalog as an intentional merge gate; Phase 7 is the corrective shrink to 12 browser entry points while integration/Vitest carry #2, #4, #6 and demoted UI paths.
- **Auth is the CI bottleneck**: Serial workers were a mitigation, not the desired end state. Worker-scoped `storageState` pools are the planned fix — distinct from the Phase 1 failure mode (one shared user across parallel files).
- **Partial-file belt pattern**: Retain spec files with rich local coverage but tag + grep-invert to keep CI fast; avoids splitting files while preserving ad-hoc full-file runs locally.
- **Wind-down is the belt timeout risk**: `mindful-session-wind-down.spec.ts` fatigue setup runs 3+ full UI cycles via helpers; API seed (`seed-scenario.ts`) is a prerequisite, not an optimization.
- **Guest vs auth project split**: `playwright.config.ts:46-60` — `guest-chromium` project for `guest-*.spec.ts`; belt includes both guest and auth entry points; demotion removes redundant guest/auth duplicate pairs where Vitest covers the delta.

## Historical Context (from prior changes)

- **Phase 4 quality gates** (`testing-quality-gates-wiring`, archived 2026-06-06): wired full `pnpm test:e2e` on every PR; documented stale `global.setup.ts` / README storageState flow; per-test fixtures became canonical.
- **Phase 1 persistence fix** (`testing-critical-path-persistence-timer`, archived 2026-06-04): removed shared `storageState` after impl-review found parallel-run conflicts; auth reload e2e demoted to hook/integration — `guest-trial` remains the belt entry for #1.
- **Test-plan refresh** (PR #90, `features/test-plan-refresh-2026-06-10`): documents belt table, Phase 7 row, demotion list, auth pool, build cache, and negative-space rule ("no full catalog on merge after Phase 7"). **Soft blocker**: not merged to `main` — current `test-plan.md` on branch lacks §3 Phase 7 and §6.3 belt table.
- **E2E infra origin** (`e2e-test-infra`, archived 2026-05-28): original setup-project + globalSetup pattern; superseded for browser tests by per-test API auth, now partially reversed for worker pools.

## Related Research

- PR #90 branch: `context/changes/test-plan-refresh-2026-06-10/research.md` (belt strategy source; not on current branch)
- `context/archive/2026-06-06-testing-quality-gates-wiring/research.md` — CI wiring baseline and stale auth doc findings
- `context/archive/2026-06-04-testing-critical-path-persistence-timer/reviews/scope-addendum.md` — shared storageState removal rationale

## Open Questions

1. **PR #90 merge timing**: Plan references §6.3 belt table on `main` — merge or rebase before `/10x-plan` to avoid plan/doc drift?
2. **Guest background-tab Vitest gap**: Should `use-pomodoro-cycle-guest.test.tsx` gain parity with auth hook catchUp tests, or is auth hook coverage sufficient given shared `TabReturnCatchUp` component tests?
3. **Guest merge cycle demotion**: Is `guest.test.ts` RUNNING-closure matrix enough to delete `guest-merge-cycle-on-sign-in.spec.ts`, or does plan require a dedicated hook test for post-sign-in cycle resume?
4. **DnD reorder UI test scope**: Minimal smoke on `task-list.test.tsx` drag-handle vs defer until Phase 6 uncovered-UI slice?
5. **Belt wind-down selection**: Confirm exact two belt tests after seed refactor — PR #90 cites "fatigue + end-session"; verify "interruption path" and negative cases are demoted, not belt-retained.
6. **`e2e/helpers/wind-down.ts` demotion scope**: Delete UI-setup helpers entirely or keep for local full-catalog runs until files are removed?
