<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Phase 1 Test Rollout — Critical-Path Persistence & Timer

- **Plan**: context/changes/testing-critical-path-persistence-timer/plan.md
- **Scope**: All phases (1–3 complete per Progress)
- **Date**: 2026-06-04
- **Verdict**: REJECTED
- **Findings**: 1 critical, 4 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | FAIL |
| Scope Discipline | WARNING |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | FAIL |

## Findings

### F1 — E2E suite failing; Progress marked complete

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: e2e/persistence-reload.spec.ts:31, e2e/pomodoro-cycle.spec.ts:74
- **Detail**: `set CI=true && pnpm test:e2e` failed (2/6 chromium tests): `persistence-reload` and `mark task done from completion overlay` time out clicking disabled **Focus** (likely stale RUNNING cycle / shared auth DB). Progress items 2.1 and 3.1 are `[x]` despite current failure.
- **Fix**: Add `test.describe.configure({ mode: 'serial' })` to `persistence-reload.spec.ts`, set chromium `workers: 1` (or `E2E_WORKERS=1` in CI), harden `ensureIdleCycle` before Focus; re-run full e2e and only then check Progress boxes.
  - Strength: Matches `pomodoro-cycle.spec.ts` serial pattern and config comment about shared storageState.
  - Tradeoff: Slower e2e CI; necessary for one shared user.
  - Confidence: HIGH — failure log shows disabled Focus after incomplete idle reset.
  - Blind spot: None significant.
- **Decision**: FIXED — `e2e/fixtures.ts` per-test sign-up/sign-in; removed shared `storageState` from playwright.config

### F2 — Missing Playwright countdown oracle (plan Phase 1 + 2)

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Plan Adherence
- **Location**: e2e/helpers/countdown.ts (missing); e2e/persistence-reload.spec.ts; e2e/guest-trial.spec.ts
- **Detail**: Plan required `e2e/helpers/countdown.ts` and reload specs asserting `timer-countdown` within ±2s. Implementation has Vitest oracle only; e2e asserts `timer-panel-running` + task row, no countdown text, no `page.clock` advance before reload.
- **Fix A ⭐ Recommended**: Add `e2e/helpers/countdown.ts`, extend both reload specs with countdown tolerance (and short clock advance per plan caveat comment).
  - Strength: Closes Risk #1 at the e2e layer as specified in Desired End State.
  - Tradeoff: More flake surface; must align ceil display rule with `formatRemainingMs`.
  - Confidence: HIGH — hook/unit layers exist; e2e gap is explicit vs plan.
  - Blind spot: Fake clock survival across `reload` needs one validation run.
- **Fix B**: Formal plan addendum + test-plan refresh documenting e2e UI-only scope (Vitest owns ±2s)
  - Strength: Matches current cookbook §6.3 text.
  - Tradeoff: Weaker Risk #1 signal at browser layer; contradicts original plan Desired End State without orchestrator refresh.
  - Confidence: MEDIUM — product owners must accept reduced e2e coverage.
  - Blind spot: Stakeholders who signed Phase 1 scope on full e2e oracle.
- **Decision**: FIXED via Fix B — formal test-plan refresh / addendum (e2e UI-only; Vitest owns ±2s)

### F3 — Cookbook §6.3 documents scope cut not in original plan

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Scope Discipline
- **Location**: context/foundation/test-plan.md:139–141
- **Detail**: §6.3 states "no ±2s countdown oracle" and "Vitest only" — intentional deviation from plan Phase 2 contract and §6.3 template (countdown helper + `page.clock` note). Fills TBD but changes the quality contract without `/10x-test-plan --refresh`.
- **Fix**: Either implement F2 Fix A, or run test-plan refresh change and align §3 Phase 1 acceptance with documented limitation.
- **Decision**: FIXED — `reviews/scope-addendum.md` + test-plan §6.3 link

### F4 — `pnpm check` fails repo-wide

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: N/A (format/CRLF in unrelated files, e.g. `src/app/_actions/import-guest-snapshot.ts`)
- **Detail**: `pnpm check` exits 1 (5 format errors, 39 warnings). Changed test files pass isolated `biome check`. Progress 1.1 / 3.1 claim check passes.
- **Fix**: Run `pnpm check:fix` on failing files or fix CRLF on touched paths; re-verify before closing Progress.
- **Decision**: FIXED — biome --write on 4 CRLF files

### F5 — Swallowed `cycle.getActive` wait in e2e setup

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: e2e/persistence-reload.spec.ts:13–19; e2e/pomodoro-cycle.spec.ts:11–17; e2e/guest-trial.spec.ts:32–38
- **Detail**: `.catch(() => {})` on `waitForResponse` hides hydration failures; tests may proceed with stale RUNNING state (correlates with F1).
- **Fix**: Remove empty catch; fail fast or retry `goto` + wait in `beforeEach`.
- **Decision**: FIXED — `waitForCycleGetActive` helper; removed `.catch(() => {})`

### F6 — Top-level `fullyParallel: true` vs shared auth user

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Pattern Consistency
- **Location**: playwright.config.ts:32, 48–49
- **Detail**: Global `fullyParallel: true` + 4 CI workers runs multiple chromium **files** concurrently on one `storageState` / DB user. Project `fullyParallel: false` only serializes within a file.
- **Fix**: Set `workers: 1` for chromium project in CI (document in AGENTS.md / e2e README).
- **Decision**: FIXED — bundled with F1 (no shared auth user)

### F7 — Guest hook test hardcodes storage key

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/hooks/use-pomodoro-cycle-guest.test.tsx:104
- **Detail**: Uses `"flowstate:guest-v1"` literal; `guest-repositories.test.ts` uses `GUEST_STORAGE_KEY`.
- **Fix**: Import `GUEST_STORAGE_KEY` from `~/lib/guest/schema`.
- **Decision**: FIXED — `GUEST_STORAGE_KEY` import

### F8 — `idle-cycle` overlay branch may click wrong button

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: e2e/helpers/idle-cycle.ts:5–14
- **Detail**: When work overlay visible, code may click `break-continue-btn` before "Continue later" exists; relies on `expect().toPass` retries.
- **Fix**: Prefer role-based "Continue later" click when overlay visible, else break button.
- **Decision**: SKIPPED — already prefers "Continue later" in idle-cycle.ts:6–10
