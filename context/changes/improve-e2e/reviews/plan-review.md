<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Restore belt E2E and accessibility after ui-refactor

- **Plan**: `context/changes/improve-e2e/plan.md`
- **Mode**: Deep
- **Date**: 2026-07-05
- **Verdict**: REVISE
- **Findings**: 0 critical · 4 warnings · 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | FAIL |
| Lean Execution | WARNING |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Grounding: 12/12 paths checked (6 missing specs expected; 6 helper modules exist), 8/8 symbols verified, brief↔plan mostly aligned

**Verified paths:**

| Path | Status |
|------|--------|
| `e2e/accessibility.spec.ts` | MISSING (expected — Phase 1) |
| `e2e/pomodoro-cycle.spec.ts` | MISSING (expected — Phase 2) |
| `e2e/task-suggestion.spec.ts` | MISSING (expected — Phase 2) |
| `e2e/session-kickoff.spec.ts` | MISSING (expected — Phase 2) |
| `e2e/mindful-session-wind-down.spec.ts` | MISSING (expected — Phase 2) |
| `e2e/session-return-handoff.spec.ts` | MISSING (expected — Phase 2) |
| `e2e/helpers/seed-scenario.ts` | EXISTS |
| `e2e/helpers/i18n-locators.ts` | EXISTS |
| `e2e/helpers/task-list-locator.ts` | EXISTS |
| `e2e/helpers/kickoff.ts` | EXISTS |
| `e2e/helpers/suggestion.ts` | EXISTS |
| `e2e/helpers/wind-down.ts` | EXISTS |

**Current belt inventory** (`pnpm exec playwright test --grep-invert @skip-belt --list`): **11 tests in 9 files**

## Findings

### F1 — Belt count math does not reach ~16

- **Severity**: ❌ CRITICAL (End-State Alignment — treated as FAIL dimension)
- **Impact**: 🔬 HIGH — architectural stakes; success criteria reference wrong target
- **Dimension**: End-State Alignment
- **Location**: Overview, Desired End State, Phase 3; plan-brief "8 test rows"
- **Detail**: Plan claims ~16 belt scenarios (10 existing + 6 restored). Current belt = **11** tests. Restore adds **7** rows (pomodoro + suggestion + kickoff + wind-down×2 + return-handoff). After restore = **18**, not ~16. Plan-brief says "8 test rows" but Phase 2 lists 6 (1+1+1+2+1). test-plan §6.3 canonical table (16) is stale vs disk (seed 2→1, session-closure 1→2, layout-rhythm not listed).
- **Fix A ⭐ Recommended**: Replace ~16/six-rows wording with explicit inventory table. Accept **18** as target; add Phase 3 step to update test-plan §6.3 + e2e/README.md belt count.
  - Strength: Matches actual restore scope; no silent demotions.
  - Tradeoff: CI e2e job grows ~6–8 min; may exceed original Phase 7 belt budget.
  - Confidence: HIGH — verified via `playwright --list`.
  - Blind spot: Flake demotion may reduce count below 18.
- **Fix B**: Hold 16 by tagging `layout-rhythm` and session-closure pause test `@skip-belt` in Phase 3.
  - Strength: Preserves original merge-gate size.
  - Tradeoff: Demotes layout/session tests without Vitest gap analysis in plan.
  - Confidence: MEDIUM — demotion targets not pre-validated.
  - Blind spot: Whether layout-rhythm has Vitest fallback.
- **Decision**: PENDING

### F2 — Unreconciled conflict with L-06

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — team lesson documents opposite approach
- **Dimension**: Lean Execution
- **Location**: Whole plan vs `context/foundation/lessons.md` L-06 (lines 94–111)
- **Detail**: L-06 (2026-07-05 ui-refactor) says the same six belt specs were correctly demoted to Vitest because they ran 17–25s and flaked. Plan restores them without documenting why browser proofs beat updating CI expectations.
- **Fix A ⭐ Recommended**: Add "Decision vs L-06" subsection — CI + test-plan §6.3 still require these files; restore re-establishes contract; Vitest stays fast layer; rows >15s or flaky twice get `@skip-belt` per Phase 3.
  - Strength: Explicit strategic rationale for future readers.
  - Tradeoff: Does not resolve whether L-06 should be amended.
  - Confidence: HIGH — CI failure is objective (missing accessibility.spec.ts).
  - Blind spot: Product owner preference between restore vs CI-only fix.
- **Fix B**: Pivot scope to CI/test-plan alignment only — do not restore specs; update ci.yml + §6.3 to match 11-test belt + Vitest oracles.
  - Strength: Aligns with L-06 cost×signal.
  - Tradeoff: Loses browser proofs for S-01/S-06/S-15/S-16/S-17 on merge gate.
  - Confidence: MEDIUM — requires test-plan Phase 7 intent renegotiation.
  - Blind spot: Stakeholder acceptance of demoted belt rows.
- **Decision**: PENDING

### F3 — test-plan §6.3 update deferred but cited as oracle

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — cookbook drift after implementation
- **Dimension**: Plan Completeness
- **Location**: What We're NOT Doing vs Phase 3 / References
- **Detail**: Plan excludes test-plan.md sync but success criteria cite §6.3 ~16 scenarios. Post-implement drift persists.
- **Fix**: Promote §6.3 belt-table sync into Phase 3 after belt green; remove from out-of-scope or mark "required follow-up in Phase 3".
- **Decision**: PENDING

### F4 — Restored kickoff specs may target pre-refactor overlay IDs

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — restore-from-baseline locator mismatch
- **Dimension**: Blind Spots
- **Location**: Phase 2 §3 Session kickoff; systematic deltas table
- **Detail**: ui-refactor replaced kickoff overlay with inline `session-energy-card` / `session-focus-card`. Helpers expose `completeKickoffSteering`; baseline `c915f45` specs may use `kickoff-readiness-overlay`. Systematic deltas table omits this migration.
- **Fix**: Add delta row: `kickoff-readiness-overlay` / `completeKickoffReadiness` → inline cards / `completeKickoffSteering(page, "skip")`.
- **Decision**: PENDING

### F5 — Phase 2 "no @skip-belt" gate missing from Progress

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — optional Progress item
- **Dimension**: Plan Completeness
- **Location**: Phase 2 Success Criteria vs Progress
- **Detail**: "No new @skip-belt tags unless demoting" not mirrored in Progress section.
- **Fix**: Add Progress item 2.6 if desired.
- **Decision**: PENDING

### F6 — Baseline commit verification method

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — implementer tip
- **Dimension**: Plan Completeness
- **Location**: References — commit `c915f45`
- **Detail**: `git show c915f45 --name-only` lists only files changed in that commit (4/6 specs). Full tree at `c915f45` has all 6 restore targets. Use `git show c915f45:path` or `git ls-tree`.
- **Fix**: Add one-line note to References.
- **Decision**: PENDING

## Triage Summary

| ID | Severity | Decision |
|----|----------|----------|
| F1 | FAIL | APPLIED — Fix A: target 18 + inventory table |
| F2 | WARNING | APPLIED — Fix A: Decision vs L-06 subsection |
| F3 | WARNING | APPLIED — §6.3 sync promoted to Phase 3 |
| F4 | WARNING | APPLIED — kickoff delta row added |
| F5 | OBSERVATION | APPLIED — Progress 2.6 added |
| F6 | OBSERVATION | APPLIED — git ls-tree note in References |

## What the plan gets right

- CI diagnosis accurate: ci.yml runs belt + a11y; accessibility.spec.ts missing.
- Helper groundwork exists on branch (work-cycle, seed-scenario, i18n-locators, kickoff).
- A11y restore low-risk: pre-deletion spec already used `/tasks` + task-list testid.
- Phase sequencing sound: a11y unblock → per-spec restore → full gate.
- Progress section mechanically valid.

## Recommended next step

Resume triage: `/10x-plan-review @context/changes/improve-e2e/reviews/plan-review.md`

After fixes applied and CRITICAL/WARNING decisions made → `/10x-implement improve-e2e phase 1`
