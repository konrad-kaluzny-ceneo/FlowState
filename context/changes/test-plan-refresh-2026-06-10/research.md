---
date: 2026-06-10T12:00:00+02:00
researcher: Auto
git_commit: 36a152cc9b8d56a8c8395d62bec96b5eeac3db31
branch: features/test-plan-refresh-2026-06-10
repository: FlowState
topic: "E2E belt merge gate — current state and test-plan refresh inputs"
tags: [research, e2e, belt, ci, test-plan, playwright]
status: complete
last_updated: 2026-06-10
last_updated_by: Auto
---

# Research: E2E belt merge gate — current state and test-plan refresh inputs

**Date**: 2026-06-10T12:00:00+02:00  
**Researcher**: Auto  
**Git Commit**: `36a152cc9b8d56a8c8395d62bec96b5eeac3db31`  
**Branch**: `features/test-plan-refresh-2026-06-10`  
**Repository**: FlowState

## Research Question

Ground `/10x-plan test-plan-refresh-2026-06-10`: what is the current e2e/CI state on disk, what does the agreed E2E belt merge-gate strategy require in `context/foundation/test-plan.md` (Phase 7 row, §4 stack, §5 gate, §6.3 belt cookbook, §7 negative space, §8 ledger), and what must the follow-up implementation change `testing-e2e-belt-fast` deliver?

## Summary

The repo runs **49 Playwright tests across 20 spec files** on every PR and push to `main` via a single CI job (`quality` → `e2e`). There is **no `test:e2e:belt` script**, no `@belt`/`@skip-belt` tags, and no Playwright grep/project for a subset. Each authenticated spec creates a fresh Neon Auth user per test (`e2e/fixtures.ts:10-30`), so CI pins `E2E_WORKERS=1` to avoid 429 rate limits — serializing a suite that takes **~6–15 minutes** including a production `pnpm build` inside Playwright's webServer.

The agreed refresh strategy (from the `/10x-test-plan --refresh` session) replaces the merge gate with a **12-test belt** covering risks #1–#7 entry points, deletes 11 demoted e2e files after Vitest/component coverage lands, introduces **worker-scoped `storageState`** (4 sign-ups per run, 4 workers), and splits build from webServer for cache. This change folder is **documentation only**; code/CI changes belong in `testing-e2e-belt-fast`.

## Detailed Findings

### Current e2e inventory (on disk)

Playwright `--list` reports **49 tests in 20 files** (`pnpm exec playwright test --list`).

| Category | Spec files | Tests | Primary risks / role |
|----------|------------|------:|----------------------|
| Infra smoke | `smoke.spec.ts` | 1 | Auth pipeline + app shell (`smoke.spec.ts:1-4`) |
| Exemplar / critical | `seed.spec.ts` | 2 | #3 mid-cycle, #7 check-in gate (`seed.spec.ts:17-46`) |
| S-01 core loop | `pomodoro-cycle.spec.ts` | 2 | S-01 + #7 via check-in step |
| Risk #3 | `mid-cycle-completion.spec.ts`, `mid-cycle-last-task.spec.ts` | 4 | FR-015 choices |
| Risk #1 guest | `guest-trial.spec.ts` | 1 | Guest reload persistence |
| Risk #2 / S-22 | `background-tab-return.spec.ts`, `guest-background-tab-return.spec.ts` | 2 | Hidden-tab catch-up |
| Risk #5 merge | `guest-merge-on-sign-in.spec.ts`, `guest-merge-cycle-on-sign-in.spec.ts` | 2 | Guest→account merge |
| Feature slices | suggestion, kickoff, wind-down, onboarding, audio, reorder, recovery, merge-success | 32 | S-06, S-15, S-16, S-11, S-20, S-26, S-07, FR-003c |

**Annotation patterns today:** provenance headers (`Risk:` / `Modeled on:` / `Spec role:`) in spec file comments; `test.describe` slice labels. **No** `@tag`, `@slow`, or Playwright `grep` configuration (`playwright.config.ts:46-60`).

### Current CI and Playwright wiring

| Concern | Current state | Reference |
|---------|---------------|-----------|
| CI jobs | `quality` then `e2e` | [`.github/workflows/ci.yml:18-93`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/36a152cc9b8d56a8c8395d62bec96b5eeac3db31/.github/workflows/ci.yml#L18-L93) |
| E2E command | `pnpm test:e2e` → full suite | [`package.json:21`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/36a152cc9b8d56a8c8395d62bec96b5eeac3db31/package.json#L21) |
| Workers | `E2E_WORKERS=1` in CI | [`.github/workflows/ci.yml:61`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/36a152cc9b8d56a8c8395d62bec96b5eeac3db31/.github/workflows/ci.yml#L61), [`playwright.config.ts:29-33`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/36a152cc9b8d56a8c8395d62bec96b5eeac3db31/playwright.config.ts#L29-L33) |
| Production build | `GITHUB_ACTIONS` triggers `pnpm build && next start` in webServer | [`playwright.config.ts:16-27`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/36a152cc9b8d56a8c8395d62bec96b5eeac3db31/playwright.config.ts#L16-L27) |
| Auth per test | `createTestUser` + `signInAsUser` in fixture | [`e2e/fixtures.ts:10-30`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/36a152cc9b8d56a8c8395d62bec96b5eeac3db31/e2e/fixtures.ts#L10-L30) |
| 429 retry | Up to 10 attempts in CI on sign-up/sign-in | [`e2e/helpers/user.ts:10-29`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/36a152cc9b8d56a8c8395d62bec96b5eeac3db31/e2e/helpers/user.ts#L10-L29) |
| Guest project | `guest-*.spec.ts` → `guest-chromium` | [`playwright.config.ts:52-59`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/36a152cc9b8d56a8c8395d62bec96b5eeac3db31/playwright.config.ts#L52-L59) |
| Test-plan gate text | "e2e critical flows (`set CI=true && pnpm test:e2e`)" required | [`context/foundation/test-plan.md:125`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/36a152cc9b8d56a8c8395d62bec96b5eeac3db31/context/foundation/test-plan.md#L125) |

### Agreed belt merge gate (12 tests — not yet implemented)

User decisions from the refresh session: branch protection requires **`quality` + `e2e`** (job name unchanged); demoted specs are **deleted** (not archived); target CI e2e job time **≤ 3–4 min**.

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
| 9 | `e2e/mindful-session-wind-down.spec.ts` | fatigue + end-session paths (after API seed refactor) | 2 | S-16 gate |
| 10 | `e2e/account-recovery.spec.ts` | `request-password-reset API returns 2xx` only | 1 | S-07 API contract |

**Partial-file exclusion mechanism (planned):** tag non-belt tests `@skip-belt`; belt script uses `--grep-invert @skip-belt`. Proposed script:

```json
"test:e2e:belt": "playwright test e2e/smoke.spec.ts e2e/seed.spec.ts e2e/guest-trial.spec.ts e2e/mid-cycle-last-task.spec.ts e2e/guest-merge-on-sign-in.spec.ts e2e/pomodoro-cycle.spec.ts e2e/task-suggestion.spec.ts e2e/session-kickoff.spec.ts e2e/mindful-session-wind-down.spec.ts e2e/account-recovery.spec.ts --grep-invert @skip-belt"
```

CI job `e2e` would call `pnpm test:e2e:belt`; full `pnpm test:e2e` remains for ad-hoc local runs only.

### Eleven e2e files slated for deletion (after Vitest migration)

| File to delete | Reason | Vitest / component replacement status on disk |
|----------------|--------|-----------------------------------------------|
| `e2e/mid-cycle-completion.spec.ts` | Duplicates seed + component | `src/app/_components/mid-cycle-completion-prompt.test.tsx` exists |
| `e2e/merge-success-on-sign-in.spec.ts` | Modal ordering | `src/lib/onboarding/defer.test.ts` covers merge-success defer (partial) |
| `e2e/guest-merge-cycle-on-sign-in.spec.ts` | RUNNING cycle merge | Extend `src/server/api/routers/guest.test.ts` (planned) |
| `e2e/task-reorder.spec.ts` | DnD + persist | `src/hooks/use-task-mutations.test.tsx` exists — needs reorder cases |
| `e2e/first-run-onboarding.spec.ts` | Onboarding flow | `src/lib/onboarding/defer.test.ts` exists; `first-run-overlay.test.tsx` **missing** |
| `e2e/guest-first-run.spec.ts` | Guest onboarding | `guest-first-run-overlay.test.tsx` **missing** |
| `e2e/quiet-cycle-audio.spec.ts` | Audio + tab pulse | `src/lib/audio.test.ts`, `use-cycle-end-audio-preference.test.tsx` exist; `tab-return-catchup.test.tsx` exists |
| `e2e/guest-quiet-cycle-audio.spec.ts` | Guest audio | Extend guest hook tests (planned) |
| `e2e/background-tab-return.spec.ts` | S-22 auth catch-up | `src/app/_components/tab-return-catchup.test.tsx` exists |
| `e2e/guest-background-tab-return.spec.ts` | S-22 guest | Extend `use-pomodoro-cycle-guest.test.tsx` (planned) |
| `e2e/helpers/wind-down.ts` UI-setup portions | 4-cycle UI fatigue setup | Replace with `e2e/helpers/seed-scenario.ts` (planned) |

**Not deleted:** belt-retained files above; `e2e/seed.spec.ts` stays as generation exemplar.

### Implementation prerequisites (`testing-e2e-belt-fast`)

These are **out of scope** for this refresh change but must be documented in test-plan §6.3/§6.6 and sequenced in the implementation plan:

1. **Worker-scoped auth pool** — `e2e/global-setup.ts` creates 4 users; `fixtures.ts` uses `storageState` from `e2e/.auth/worker-{n}.json`; CI `E2E_WORKERS=4`.
2. **Vitest backfill (D.1/D.2)** — new component tests for overlays not yet covered (`merge-success-overlay`, `first-run-overlay`, `guest-first-run-overlay`, `wind-down-overlay`, `check-in-overlay` gate UI); extend existing hook/component tests before deleting e2e files.
3. **Wind-down API seed** — `e2e/helpers/seed-scenario.ts` via tRPC `page.request.post` to avoid 3× UI cycle setup; reduces belt wind-down timeouts from ~180s to ~60s.
4. **CI build cache** — separate `pnpm build` step + `.next/cache` cache; webServer becomes `next start` only in CI.
5. **Docs sync** — `AGENTS.md`, `e2e/README.md`, test-plan §6.3 belt table, §7 negative space (full-suite-not-merge-gate), §8 ledger.

### test-plan.md sections to update (this change)

| Section | Planned change |
|---------|----------------|
| §1 Strategy | Add operational point: merge gate = belt, not full catalog; new slices default to Vitest/component |
| §2 Risk Map | Risks #1–#7 unchanged; update Risk Response Guidance to note belt vs Vitest ownership per risk |
| §3 Phase 7 row | `testing-e2e-belt-fast` — E2E belt merge gate; risks #1–#7 belt entry points; Playwright belt + Vitest backfill; status `not started` |
| §4 Stack | Add `test:e2e:belt` script row; note worker-scoped auth + 4 workers |
| §5 Quality Gates | Replace full `test:e2e` required gate with `test:e2e:belt` (12 scenarios); full suite → ad-hoc / negative space |
| §6.3 | New "Belt specs" subsection with 12-test table; demoted specs → Vitest pointers |
| §6.6 | Belt rollout notes: auth pool, build cache, wind-down seed |
| §7 Negative space | Full Playwright catalog not run on every merge; feature-slice browser proofs demoted when Vitest covers signal |
| §8 Ledger | Belt strategy reviewed 2026-06-10; next session Phase 7 implementation |

## Code References

- [`playwright.config.ts:16-33`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/36a152cc9b8d56a8c8395d62bec96b5eeac3db31/playwright.config.ts#L16-L33) — production server path, worker count
- [`playwright.config.ts:46-60`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/36a152cc9b8d56a8c8395d62bec96b5eeac3db31/playwright.config.ts#L46-L60) — chromium / guest-chromium projects
- [`.github/workflows/ci.yml:52-93`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/36a152cc9b8d56a8c8395d62bec96b5eeac3db31/.github/workflows/ci.yml#L52-L93) — e2e job (full suite today)
- [`e2e/fixtures.ts:10-30`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/36a152cc9b8d56a8c8395d62bec96b5eeac3db31/e2e/fixtures.ts#L10-L30) — per-test auth (belt migration target)
- [`e2e/helpers/user.ts:10-29`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/36a152cc9b8d56a8c8395d62bec96b5eeac3db31/e2e/helpers/user.ts#L10-L29) — Neon Auth 429 retry
- [`context/foundation/test-plan.md:73-75`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/36a152cc9b8d56a8c8395d62bec96b5eeac3db31/context/foundation/test-plan.md#L73-L75) — Phase 5–6 rows (Phase 7 slot available)
- [`context/foundation/test-plan.md:125-126`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/36a152cc9b8d56a8c8395d62bec96b5eeac3db31/context/foundation/test-plan.md#L125-L126) — current e2e gate wording
- [`context/changes/test-plan-refresh-2026-06-10/change.md:12-16`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/36a152cc9b8d56a8c8395d62bec96b5eeac3db31/context/changes/test-plan-refresh-2026-06-10/change.md#L12-L16) — refresh scope boundary

## Architecture Insights

- **Cost × signal tension:** Phase 4 wired the full 49-test suite as the merge gate to maximize regression signal after Phases 1–3 shipped (`testing-quality-gates-wiring`). Suite growth (S-06 through S-26) and serial auth now violate §1 — belt realigns gate with cheapest high-signal scenarios.
- **Risks #4 and #6 stay integration-only** — no belt e2e; unchanged from test-plan §6.5/Phase 3.
- **Risk #2 stays Vitest-only** — belt drops `background-tab-return` e2e after `tab-return-catchup.test.tsx` + hook tests; production Worker path still not browser-tested (existing §6.3 limitation).
- **Risk #7 partial belt coverage** — seed + pomodoro-cycle cover gate; dedicated `check-in-gate.spec.ts` remains deferred (batched tRPC oracle blocker, `test-plan.md:225`).
- **Branch protection constraint** — CI job stays named `e2e`; only the command changes to `test:e2e:belt`.

## Historical Context (from prior changes)

- [`context/archive/2026-06-06-testing-quality-gates-wiring/plan.md`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/36a152cc9b8d56a8c8395d62bec96b5eeac3db31/context/archive/2026-06-06-testing-quality-gates-wiring/plan.md) — Phase 4 intentionally runs full `CI=true pnpm test:e2e` on every PR; explicitly out of scope: file splits, subset gates, guest merge browser e2e.
- [`context/archive/2026-06-09-fix-e2e-suggestion-ci/reviews/impl-review.md`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/36a152cc9b8d56a8c8395d62bec96b5eeac3db31/context/archive/2026-06-09-fix-e2e-suggestion-ci/reviews/impl-review.md) — 48/48 in ~5m51s at `E2E_WORKERS=1`; sub-3 min needs parallel workers or fewer tests.
- [`context/archive/2026-06-07-account-recovery-flow/reviews/impl-review.md`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/36a152cc9b8d56a8c8395d62bec96b5eeac3db31/context/archive/2026-06-07-account-recovery-flow/reviews/impl-review.md) — 10 workers → Neon Auth 429; documents why per-test sign-up forced serial CI.
- [`context/archive/2026-06-06-testing-active-slice-browser-proofs/research.md`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/36a152cc9b8d56a8c8395d62bec96b5eeac3db31/context/archive/2026-06-06-testing-active-slice-browser-proofs/research.md) — Phase 2 e2e patterns; `check-in-gate.spec.ts` deferred.

## Related Research

- [`context/archive/2026-06-06-testing-quality-gates-wiring/research.md`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/36a152cc9b8d56a8c8395d62bec96b5eeac3db31/context/archive/2026-06-06-testing-quality-gates-wiring/research.md) — CI wiring baseline
- [`context/archive/2026-06-09-fix-e2e-suggestion-ci/research.md`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/36a152cc9b8d56a8c8395d62bec96b5eeac3db31/context/archive/2026-06-09-fix-e2e-suggestion-ci/research.md) — suite runtime analysis

## Open Questions

1. **Phase ordering vs §3 rows 5–6:** Should Phase 7 (belt) ship before Phase 5 (mutation hardening), or can they run in parallel? Belt unblocks merge velocity; mutation is separate ROI.
2. **Vitest gap audit:** Before plan commits to deleting 11 e2e files, `/10x-plan` should list exact missing test cases per file (several component tests are still absent on disk).
3. **`mid-cycle-completion.spec.ts` vs seed:** Three tests in mid-cycle-completion overlap seed — confirm seed + `mid-cycle-last-task` fully cover #3 before deletion.
4. **Guest belt coverage:** Belt keeps one guest spec (`guest-trial`) and one merge spec; drops guest audio/background-tab e2e — confirm Vitest guest hook coverage is sufficient for #1/#2 guest paths.
5. **Full-suite cadence:** Refresh docs should state whether full `pnpm test:e2e` runs anywhere post-belt (nightly, pre-release manual, or never in CI).
