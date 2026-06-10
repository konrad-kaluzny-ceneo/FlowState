# Test Plan Refresh — E2E Belt Merge Gate Implementation Plan

## Overview

Update `context/foundation/test-plan.md` to document the agreed **12-test E2E belt merge gate** strategy: CI targets ≤3–4 min while risks #1–#7 keep browser entry points; demoted feature-slice specs move to Vitest/component coverage in follow-up change `testing-e2e-belt-fast`. This change is **documentation only** — no code, CI, `package.json`, or `AGENTS.md` edits.

## Current State Analysis

The test plan (last updated 2026-06-10 for S-23 cookbook) reflects Phase 4 wiring: full `set CI=true && pnpm test:e2e` (49 tests, 20 files) as the required merge gate. There is no Phase 7 row, no belt script row in §4, no belt cookbook in §6.3, and §7 does not exclude full-catalog CI runs. Research confirms on-disk reality: no `test:e2e:belt`, `E2E_WORKERS=1`, ~6–15 min CI e2e job.

### Key Discoveries:

- Phase 4 intentionally wired the full suite (`testing-quality-gates-wiring`); belt realigns with §1 cost × signal (`research.md` Architecture Insights)
- Risks #4 and #6 stay integration-only — no belt e2e; unchanged from Phase 3
- Risk #2 drops belt e2e after Vitest hook/component coverage; production Worker path remains untested in browser (existing §6.3 limitation)
- Phase 7 (`testing-e2e-belt-fast`) ships **before** Phase 5 mutation hardening; §3 rows 5–6 stay `not started`
- Vitest gap audit and 11-file deletion belong in `testing-e2e-belt-fast`, not this refresh

## Desired End State

`context/foundation/test-plan.md` documents belt-as-merge-gate across §1–§8: Phase 7 row with `testing-e2e-belt-fast` at `not started`; §4/`§5` name `test:e2e:belt`; §6.3 holds the canonical 12-test belt table and demotion intent; §6.6 holds belt rollout prerequisites; §7 excludes full-catalog merge runs; §8 ledger stamps belt strategy review 2026-06-10. Verify via `pnpm check` and manual diff against `digest.md` acceptance list.

## What We're NOT Doing

- Implementing `test:e2e:belt`, Playwright tags, CI job command changes, or auth pool (`testing-e2e-belt-fast`)
- Editing `AGENTS.md`, `e2e/README.md`, `.github/workflows/ci.yml`, or `package.json`
- Changing risks #1–#7 table rows (Impact, Likelihood, Source)
- Running or adding unit/integration/e2e tests for this change
- Nightly CI full-suite job — post-belt cadence is ad-hoc local + optional pre-release manual only
- Vitest gap audit listing per demoted file (deferred to `testing-e2e-belt-fast` plan)

## Implementation Approach

Four sequential doc-edit phases matching test-plan section boundaries. Each phase edits `context/foundation/test-plan.md` only. Preserve existing prose where not contradicted by belt strategy; add subsections rather than rewriting shipped Phase 1–4 cookbook entries wholesale.

## Critical Implementation Details

**Phase 7 row insertion:** Add as row **7** after existing row 6 in §3; do **not** renumber or alter rows 5–6 (mutation / uncovered UI). **Risk Response Guidance:** Update the "Likely cheapest layer" and "Anti-pattern" columns only — leave "What would prove protection", "Must challenge", and "Context" columns intact unless belt split requires a one-line layer note.

**Canonical 12-test belt table** (embed in §6.3 and reference from plan):

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

Partial-file tests use `@skip-belt` on non-belt cases; belt script uses `--grep-invert @skip-belt` (document intent; script lands in `testing-e2e-belt-fast`).

---

## Phase 1: Strategy, Risk Guidance, and Phase 7 Row

### Overview

Establish belt-as-merge-gate in §1, split belt vs Vitest ownership in §2 Risk Response Guidance (rows unchanged), and add §3 Phase 7 rollout row.

### Changes Required:

#### 1. §1 Strategy — operational merge-gate principle

**File**: `context/foundation/test-plan.md`

**Intent**: Add a fourth operational bullet (or short paragraph after principle list) stating the CI merge gate runs the **12-test belt**, not the full Playwright catalog; new feature slices default to Vitest/component proofs unless `/10x-research` proves browser-only signal.

**Contract**: §1 Strategy section — new bullet after existing three principles; must not contradict cost × signal principle #1.

#### 2. §2 Risk Response Guidance — belt vs Vitest columns

**File**: `context/foundation/test-plan.md`

**Intent**: Update **Likely cheapest layer** and **Anti-pattern to avoid** columns per risk to reflect belt ownership vs Vitest demotion. Risks #1–#7 scenario table above Guidance stays unchanged.

**Contract**: §2 `### Risk Response Guidance` table — column edits only:

| Risk | Likely cheapest layer (add/note) | Anti-pattern (add/note) |
|------|-----------------------------------|-------------------------|
| #1 | Belt: `guest-trial` e2e; auth reload demoted to hook/integration (existing §6.3) | Running full catalog on every merge for auth reload signal |
| #2 | Vitest hook + worker unit only; **no belt e2e** after demotion | Keeping `background-tab-return` e2e on merge gate when Vitest covers throttle path |
| #3 | Belt: `seed`, `mid-cycle-last-task`, partial `pomodoro-cycle`; demote `mid-cycle-completion.spec.ts` to component | Full mid-cycle e2e suite on merge gate |
| #4 | Integration only — **no belt e2e** (unchanged) | (unchanged) |
| #5 | Integration + belt `guest-merge-on-sign-in`; demote merge-success/cycle-merge e2e to Vitest | Browser merge proofs beyond one belt spec |
| #6 | Integration only — **no belt e2e** (unchanged) | (unchanged) |
| #7 | Belt: `seed` + `pomodoro-cycle` check-in step; dedicated gate e2e still deferred | Asserting check-in persistence only in demoted full-catalog specs |

#### 3. §3 Phased Rollout — Phase 7 row

**File**: `context/foundation/test-plan.md`

**Intent**: Insert row 7 after row 6. Phase 7 ships independently before Phase 5; rows 5–6 unchanged.

**Contract**: New §3 table row:

| # | Phase name | Goal | Risks covered | Test types | Status | Change folder |
|---|------------|------|---------------|------------|--------|---------------|
| 7 | E2E belt merge gate | Replace full-catalog CI gate with 12-test belt; Vitest backfill then delete 11 demoted e2e files | #1–#7 (belt entry points + integration-only #4/#6) | Playwright belt + Vitest/component backfill | not started | testing-e2e-belt-fast |

### Success Criteria:

#### Automated Verification:

- Markdown lint passes: `pnpm check`

#### Manual Verification:

- §1 contains merge-gate = belt + new-slice default Vitest wording
- §2 risk scenario table (#1–#7) byte-identical in Impact/Likelihood/Source columns
- §2 Guidance columns updated per belt/Vitest split above
- §3 row 7 present; rows 5–6 still `not started` with unchanged goals
- Diff review against `digest.md` § Acceptance (doc sections) items for §1–§3

**Implementation Note**: After automated verification passes, confirm manual items before Phase 2.

---

## Phase 2: Stack and Quality Gates

### Overview

Document planned `test:e2e:belt` script and worker-scoped auth in §4; add belt gate row as `planned` in §5 and keep full-catalog row `required` until Phase 7 lands.

### Changes Required:

#### 1. §4 Stack — e2e row and auth note

**File**: `context/foundation/test-plan.md`

**Intent**: Update Playwright e2e row to distinguish merge-gate belt vs full catalog; add `test:e2e:belt` script row (planned — not on disk yet); note worker-scoped `storageState` pool and target `E2E_WORKERS=4` for belt CI.

**Contract**: §4 Stack table — modify e2e Notes cell; add row:

| Layer | Tool | Version | Notes |
|-------|------|---------|-------|
| e2e merge gate (belt) | Playwright | 1.60.0 | `pnpm test:e2e:belt` — **planned** (not on disk); 12 scenarios (§6.3 `#### Belt merge gate` table); CI job `e2e` calls belt when Phase 7 lands; worker-scoped auth (`e2e/.auth/worker-{n}.json`), 4 workers |
| e2e full catalog | Playwright | 1.60.0 | `set CI=true && pnpm test:e2e` — ad-hoc local + optional pre-release manual; **not** required on every merge |

Remove or soften "always `set CI=true && pnpm test:e2e` per AGENTS.md" as the merge-gate default (AGENTS.md sync deferred).

#### 2. §5 Quality Gates — belt planned, full suite transitional

**File**: `context/foundation/test-plan.md`

**Intent**: Add belt gate row as **planned** (per §5 intro: gates before a rollout phase lands read `planned`); keep full-catalog row **required** until Phase 7 lands, then demote to ad-hoc; note branch protection stays `quality` + `e2e` job names unchanged.

**Contract**: §5 table — replace single e2e row with two rows (do not imply belt is live before Phase 7):

| Gate | Where | Required? | Catches |
|------|-------|-----------|---------|
| e2e belt (`set CI=true && pnpm test:e2e:belt`) | local + CI (after Phase 7) | **planned until §3 Phase 7 lands**; required after Phase 7 | auth shell, risks #1/#3/#5/#7 belt entry points, S-01/S-06/S-15/S-16/S-07 API smoke |
| e2e full catalog (`set CI=true && pnpm test:e2e`) | local + CI (until Phase 7); ad-hoc + optional pre-release manual after | **required until §3 Phase 7 lands**; not required on merge after Phase 7 | exhaustive feature-slice regressions; current merge gate (~49 tests) until belt ships |

Add footnote or Notes line: no nightly full-suite CI in this strategy; CI `e2e` job command swaps to belt in `testing-e2e-belt-fast`.

### Success Criteria:

#### Automated Verification:

- Markdown lint passes: `pnpm check`

#### Manual Verification:

- §4 distinguishes belt vs full catalog; mentions 4 workers + storageState intent
- §5 belt gate row reads `planned until §3 Phase 7 lands`; full catalog row still `required` until Phase 7 (not ad-hoc yet)
- PR CI row still references GitHub Actions; no wording implies belt runs in CI today
- Diff review against `digest.md` §4–§5 acceptance items

**Implementation Note**: Pause for manual confirmation before Phase 3.

---

## Phase 3: Belt Cookbook and Rollout Notes

### Overview

Add `#### Belt merge gate (Phase 7)` under existing `### 6.3 Adding an e2e test` with canonical 12-test table and demotion pointers; add §6.6 Phase 7 belt rollout notes.

### Changes Required:

#### 1. §6.3 — Belt merge gate subsection (`####` under Adding an e2e test)

**File**: `context/foundation/test-plan.md`

**Intent**: Insert **`#### Belt merge gate (Phase 7)`** under existing **`### 6.3 Adding an e2e test`** (after the generation exemplar bullet or before feature-slice bullets — do **not** create a new `### 6.3.x` heading) containing the 12-test table from Critical Implementation Details, proposed `test:e2e:belt` script intent (`--grep-invert @skip-belt`), and demotion intent: 11 e2e files deleted after Vitest backfill in `testing-e2e-belt-fast` (list file names from research — no per-file gap audit in this change).

**Contract**: §6.3 — new `####` subsection with:

- Full 12-test belt table (10 spec files, 12 tests)
- Run command (planned): `set CI=true && pnpm test:e2e:belt`
- Demoted files (delete after Vitest): `mid-cycle-completion.spec.ts`, `merge-success-on-sign-in.spec.ts`, `guest-merge-cycle-on-sign-in.spec.ts`, `task-reorder.spec.ts`, `first-run-onboarding.spec.ts`, `guest-first-run.spec.ts`, `quiet-cycle-audio.spec.ts`, `guest-quiet-cycle-audio.spec.ts`, `background-tab-return.spec.ts`, `guest-background-tab-return.spec.ts`, plus wind-down UI-setup portions of `e2e/helpers/wind-down.ts`
- Pointer: Vitest gap audit lives in `testing-e2e-belt-fast` plan, not here

Preserve existing §6.3 feature-slice bullets; add cross-links where belt retains a spec (e.g. task-suggestion, session-kickoff).

#### 2. §6.6 — Phase 7 belt rollout notes

**File**: `context/foundation/test-plan.md`

**Intent**: Add **Phase 7 — E2E belt merge gate** block documenting implementation prerequisites for `testing-e2e-belt-fast`.

**Contract**: §6.6 new subsection covering:

1. **Worker-scoped auth pool** — `global-setup.ts`, 4 users, `storageState` per worker; CI `E2E_WORKERS=4`
2. **Vitest backfill (D.1/D.2)** — component tests for overlays before e2e deletion; audit in follow-up change
3. **Wind-down API seed** — `e2e/helpers/seed-scenario.ts` via tRPC to replace 3× UI cycle setup
4. **CI build cache** — separate `pnpm build` step + `.next/cache`; webServer `next start` only in CI
5. **Target CI time** — ≤3–4 min for `e2e` job after belt lands

### Success Criteria:

#### Automated Verification:

- Markdown lint passes: `pnpm check`

#### Manual Verification:

- §6.3 belt table under `#### Belt merge gate (Phase 7)` matches 12-test canonical table exactly
- §6.3 belt content is `####` under `### 6.3 Adding an e2e test` (no new `### 6.3.x` heading)
- §6.3 lists demotion intent without Vitest gap audit detail
- §6.6 Phase 7 block covers all five rollout prerequisites
- Existing §6.3/§6.6 Phase 1–3 shipped notes unchanged
- Diff review against `digest.md` §6.3–§6.6 acceptance items

**Implementation Note**: Pause for manual confirmation before Phase 4.

---

## Phase 4: Negative Space, Ledger, and Header

### Overview

Update §7 exclusions for full-catalog merge runs; refresh §8 ledger and document header `Last updated`.

### Changes Required:

#### 1. §7 What We Deliberately Don't Test

**File**: `context/foundation/test-plan.md`

**Intent**: Add bullets: full Playwright catalog (49 tests) not run on every merge; feature-slice browser proofs demoted to Vitest when cheaper layer covers signal; nightly full-suite CI explicitly out of scope.

**Contract**: §7 — append new exclusion bullets with Source: test-plan refresh 2026-06-10 / cost × signal.

#### 2. §8 Freshness Ledger

**File**: `context/foundation/test-plan.md`

**Intent**: Stamp belt strategy review; update next-session pointer to Phase 7 implementation.

**Contract**: §8 — add/update lines:

- Belt merge-gate strategy documented: 2026-06-10 (`test-plan-refresh-2026-06-10`)
- **Next session:** §3 Phase 7 (`testing-e2e-belt-fast`) — belt script, auth pool, CI command swap
- Retain existing ledger entries; do not remove Phase 5 proposal line (Phase 7 precedes Phase 5 in execution order but both remain valid)

#### 3. Document header

**File**: `context/foundation/test-plan.md`

**Intent**: Update top `Last updated` line to reflect belt refresh.

**Contract**: Header comment block — `Last updated: 2026-06-10 (E2E belt merge-gate strategy — Phase 7 documented)`

### Success Criteria:

#### Automated Verification:

- Markdown lint passes: `pnpm check`

#### Manual Verification:

- §7 excludes full-catalog merge gate and nightly full suite
- §8 ledger includes belt strategy reviewed 2026-06-10 and Phase 7 next session
- Header Last updated reflects belt refresh
- Full-file diff review: all eight `digest.md` acceptance sections satisfied; no edits outside `test-plan.md`
- No code/CI/package.json/AGENTS.md changes in working tree for this change

**Implementation Note**: Final phase — mark change ready for archive after all Progress items complete.

---

## Testing Strategy

Documentation-only change. No unit, integration, or e2e tests added or run as part of verification.

### Manual Testing Steps:

1. Run `pnpm check` after each phase
2. Side-by-side review of edited sections against `digest.md` acceptance checklist
3. Confirm §2 risk table rows #1–#7 unchanged except Guidance columns
4. Confirm §3 rows 5–6 untouched; row 7 added

## References

- Research: `context/changes/test-plan-refresh-2026-06-10/research.md`
- Digest: `context/changes/test-plan-refresh-2026-06-10/digest.md`
- Follow-up implementation: `testing-e2e-belt-fast`
- Current test plan: `context/foundation/test-plan.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Strategy, Risk Guidance, and Phase 7 Row

#### Automated

- [x] 1.1 Markdown lint passes: `pnpm check`

#### Manual

- [x] 1.2 §1–§3 belt strategy, Guidance columns, and Phase 7 row verified against digest

### Phase 2: Stack and Quality Gates

#### Automated

- [x] 2.1 Markdown lint passes: `pnpm check`

#### Manual

- [x] 2.2 §4–§5 belt vs full catalog and gate wording verified against digest

### Phase 3: Belt Cookbook and Rollout Notes

#### Automated

- [x] 3.1 Markdown lint passes: `pnpm check`

#### Manual

- [x] 3.2 §6.3 belt table and §6.6 Phase 7 rollout notes verified against digest

### Phase 4: Negative Space, Ledger, and Header

#### Automated

- [x] 4.1 Markdown lint passes: `pnpm check`

#### Manual

- [x] 4.2 §7–§8, header, and full acceptance checklist verified; no out-of-scope file edits
