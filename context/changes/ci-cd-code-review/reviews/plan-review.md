<!-- PLAN-REVIEW-REPORT -->
# Plan Review: CI/CD PR Code Review (ci-cd-code-review)

- **Plan**: `context/changes/ci-cd-code-review/plan.md`
- **Brief**: `context/changes/ci-cd-code-review/plan-brief.md`
- **Mode**: Deep (codebase-grounded)
- **Date**: 2026-06-22
- **Verdict**: NEEDS ATTENTION → **APPROVED (post-triage)**
- **Findings**: 0 critical · 5 warnings (all fixed) · 4 observations (all fixed)

## Triage Summary

| ID | Severity | Decision |
|----|----------|----------|
| F1 | WARNING | **FIXED** — Phase 1 §3b: update `code-reviewer.md` for C1–C6 Scores |
| F2 | WARNING | **FIXED** — `evaluate-pass.ts`: zero parsed scores → fail |
| F3 | WARNING | **FIXED** — `parse-scores.ts`: critical severity heuristic documented |
| F4 | WARNING | **FIXED** — Phase 2 composite explicit output mapping |
| F5 | WARNING | **FIXED** — Phase 3 full job `if` snippet for `labeled` guard |
| F6 | OBSERVATION | **FIXED** — Phase 1 §3: both cloud/local prompt branches |
| F7 | OBSERVATION | **FIXED** — Phase 2 note: requirements output names superseded |
| F8 | OBSERVATION | **FIXED** — Phase 1 §5: `@vitest-environment node` on parser tests |
| F9 | OBSERVATION | **FIXED** — Phase 1 §4: update `review.ts` `--help` |

## Confidence

**94%** (post-triage) — All findings addressed in `plan.md`. Residual risk: LLM score-format drift (mitigated by fail-safe + tolerant parser) and first composite action in repo.

## Decision

**Proceed** to `/10x-implement ci-cd-code-review phase 1`.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | WARNING |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |
| Feasibility | PASS |

## Grounding

Grounding: 8/8 cited paths verified on `main`; marker-bug claim confirmed in live workflow + script.

| Path | Status |
|------|--------|
| `.github/workflows/cursor-review.yml` | ✓ exists; searches `<!-- cursor-review -->` (L94) |
| `scripts/cursor-review/review.ts` | ✓ writes `<!-- cursor-review agent=… -->` (L189); exits 2 on agent error (L184); auth skip exits 0 (L132) |
| `scripts/cursor-review/build-prompt.ts` | ✓ cloud + local deliverables; no Scores section yet |
| `.cursor/agents/code-reviewer.md` | ✓ exists; output format has no C1–C6 Scores |
| `.github/workflows/ci.yml` | ✓ inline checkout/pnpm/node 22 pattern to mirror |
| `.github/actions/` | ✗ absent (expected — Phase 2) |
| `vitest.config.ts` | ✓ default include picks `scripts/**/*.test.ts`; jsdom + `src/test/setup.ts` globally |
| `package.json` | ✓ `review` / `review:cloud` scripts present |

**Marker bug (plan claim confirmed):** workflow `contains("<!-- cursor-review -->")` does not match header `<!-- cursor-review agent=… run=… -->` because ` -->` is not immediately after `cursor-review`.

## Findings

### F1 — `code-reviewer.md` not in plan; subagent output lacks Scores

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architectural Fitness
- **Location**: Phase 1 §3 (`build-prompt.ts`); `.cursor/agents/code-reviewer.md`
- **Detail**: Cloud prompt instructs delegating to the `code-reviewer` subagent, but that agent's **Output** section still requires Summary / Findings / Strengths / Follow-ups only — no C1–C6 Scores. Phase 1 updates `build-prompt.ts` deliverable but does not list `code-reviewer.md`. The main agent may synthesize scores inconsistently or omit them, undermining `parse-scores.ts` and label rules.
- **Fix**: Add Phase 1 item to update `.cursor/agents/code-reviewer.md` Output to require a **Scores** block (`C1: N/10 — rationale`) and `path:line` in findings; or add an explicit instruction in `build-prompt.ts` that the **main** agent must emit Scores even when subagent output lacks them.
  - Strength: Aligns subagent contract with parser and requirements; reduces score-omission rate.
  - Tradeoff: Slightly wider Phase 1 scope (one more file).
  - Confidence: HIGH — cloud prompt already references this subagent by name.
  - Blind spot: None significant.
- **Decision**: FIXED

### F2 — Zero parsed scores → pass/fail rule undefined

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1 §2 (`evaluate-pass.ts`); plan-brief Open Risks
- **Detail**: `plan-brief.md` states fail-safe: `ai-cr:failed` if scores unparseable. `evaluate-pass.ts` contract only fails on present score &lt; 6 or `criticalCount > 0`. If the agent completes but omits the entire Scores section, behavior is ambiguous — could incorrectly pass with empty scores.
- **Fix**: Extend `evaluate-pass.ts` contract: if agent run succeeded context and zero C1–C6 scores parsed → `passed: false`, `failReasons` includes `"missing scores"`. Add test case in `evaluate-pass.test.ts`.
  - Strength: Matches plan-brief fail-safe and requirements agent-complete semantics.
  - Tradeoff: Stricter — any format drift fails the label until parser improves.
  - Confidence: HIGH — explicit in plan-brief, missing in evaluate contract.
  - Blind spot: None significant.
- **Decision**: FIXED

### F3 — `parse-scores` critical-finding heuristic unspecified

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 §2 (`parse-scores.ts`)
- **Detail**: Contract says parser detects `critical` findings in the **Findings** section but gives no pattern. Implementer may choose incompatible heuristics (e.g. matching the word "critical" in prose vs severity prefix).
- **Fix**: Document in `parse-scores.ts` contract: count bullets/lines where severity is `critical` — e.g. case-insensitive match on `(critical)` or `**critical**` at start of finding line. Lock with fixture strings in `parse-scores.test.ts`.
  - Strength: Deterministic, testable, matches requirements severity tiers.
  - Tradeoff: May miss non-standard agent phrasing — acceptable given tolerant parser goal.
  - Confidence: HIGH.
  - Blind spot: Agent may use non-English severity labels on Polish reviews.
- **Decision**: FIXED

### F4 — Composite `skipped` / auth-soft-fail detection underspecified

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 2 §1 (composite action outputs)
- **Detail**: Plan says propagate `skipped` via "exit 0 + empty files check." `review.ts` auth failure exits 0 with `::notice` and no output files — composite step succeeds. Phase 3 guards label apply with `review.json` presence, but composite `review-outcome` / `skipped` outputs lack explicit step logic (e.g. set `skipped=true` when `review.md` absent after exit 0, distinguish from agent error exit 2).
- **Fix**: In Phase 2 composite contract, add explicit output mapping: after `pnpm review:cloud`, if exit 0 and no `reports/review.md` → `skipped=true`, `review-outcome=success`; if exit 2 → `review-outcome=failure`; if exit 0 with files → `review-outcome=success`, `skipped=false`.
  - Strength: Prevents workflow steps from mis-reading a soft auth skip as a successful review.
  - Tradeoff: Composite YAML grows slightly; still no shell regex on LLM body.
  - Confidence: MED — pattern is standard GHA; exact exit codes need verification during implement.
  - Blind spot: Other exit-0 paths without files not yet enumerated.
- **Decision**: FIXED

### F5 — Job `if` for `labeled` trigger not fully specified

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3 §2 (`cursor-review.yml`)
- **Detail**: Plan adds `labeled` to trigger types and says extend job `if` for `ai-cr:review` only, but does not show the combined expression with the existing fork guard (`workflow_dispatch` OR same-repo head). Implementer may OR/AND incorrectly and either skip valid retries or run on unrelated labels (wasted Actions minutes).
- **Fix**: Add explicit job `if` snippet combining: `(workflow_dispatch || same-repo PR) && (event != 'labeled' || label.name == 'ai-cr:review')`.
  - Strength: Copy-pasteable; removes ambiguity.
  - Tradeoff: None meaningful.
  - Confidence: HIGH.
  - Blind spot: None significant.
- **Decision**: FIXED

### F6 — Local `build-prompt` branch not called out

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 §3 (`build-prompt.ts`)
- **Detail**: `build-prompt.ts` has separate cloud (L42–70) and local (L82–114) deliverable blocks. Phase 1 says "add Scores section" generically; only cloud path is CI-critical, but local `pnpm review` would stay on old format without both branches updated.
- **Fix**: One line in Phase 1 contract: update **both** cloud and local deliverable templates.
- **Decision**: FIXED

### F7 — Requirements vs plan composite output names drift

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: End-State Alignment
- **Location**: `requirements.md` §1 vs Phase 2 composite outputs
- **Detail**: Requirements list outputs `review-path`, `agent-id`, `run-id`; plan uses `review-md`, `review-json`, `review-outcome`. Functionally fine; `review.json` sidecar is plan-only improvement.
- **Fix**: Optional addendum to `requirements.md` after implement, or note in plan that requirements output names are superseded by sidecar design.
- **Decision**: FIXED

### F8 — Parser tests inherit jsdom environment

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Lean Execution
- **Location**: Phase 1 §5; `vitest.config.ts`
- **Detail**: `scripts/cursor-review/*.test.ts` will run under global jsdom + `src/test/setup.ts`. Works, but node-only tests pay unnecessary setup cost.
- **Fix**: Add `// @vitest-environment node` atop parser test files (one line each).
- **Decision**: FIXED

### F9 — `review.ts` `--help` not listed in Phase 1

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 §4 (`review.ts`)
- **Detail**: New `--pr-title` / `--pr-description` flags need help text update (L27–45). Minor omission; discoverability only.
- **Fix**: Add bullet under Phase 1 §4: update `--help` output for new flags.
- **Decision**: FIXED

## Strengths (no findings)

- Correctly frames work as **gap completion** on shipped SDK stack — matches research and live code.
- Marker bug diagnosis and `cursor-review-v1` fix are accurate and well-scoped.
- Phased ordering (parser/sidecar → composite → labels) prevents half-wired label logic.
- TypeScript parser + JSON sidecar avoids shell regex on LLM markdown — sound architecture.
- Advisory failure path (job green + `ai-cr:failed`) consistent with requirements and `review.ts` exit codes.
- Progress section mirrors phase Success Criteria with proper checkbox convention.
- Scope boundaries align with reconciled `requirements.md` (no merge gate, no `AGENTS.md` secret).

## Confidence

**88%** — Plan is implementable as written; warnings are contract tightenings, not architectural blockers. Highest residual risk is LLM score-format drift (acknowledged) and first composite action in repo (mitigated by mirroring `ci.yml` toolchain). No contradictions between Current State Analysis and proposed phases.
