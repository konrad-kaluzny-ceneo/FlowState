<!-- PLAN-REVIEW-REPORT -->

# Plan Review: timer-change-impact-digest

**Date:** 2026-06-18  
**Reviewer:** Cursor Agent (`/10x-plan-review`, sub-agent code verification)  
**Plan:** `context/changes/timer-change-impact-digest/plan.md`  
**Brief:** `context/changes/timer-change-impact-digest/plan-brief.md`  
**Verdict:** NEEDS ATTENTION

## Summary

Core MVP (git co-change CLI + test catalog, no `src/` edits) is **feasible and well-phased**. Sub-agent verified agent-hooks ESM patterns, Mom Test counts, repo-map E2E/git split, and existing test file paths. **Blockers before `/10x-implement`:** reconcile PRD FR-004 `--strict`/quiet semantics (plan defers diff threshold but redefines `--strict`), and fix depcruise CLI contract (`--focus` is regex + requires `src` cruise root). Secondary fixes: project-root behavior vs agent-hooks, fan-out metric definition, Vitest-first-outside-`src/` note.

**Confidence:** 86%

## Dimension verdicts

| Dimension | Verdict | Notes |
|-----------|---------|-------|
| Internal consistency | WARNING | FR-004 PRD vs plan `--strict` definition; `--strict` overloads top-N and path filter |
| Feasibility | WARNING | Git co-change + Windows spawn sound; depcruise invocation wrong in plan |
| Scope discipline | PASS | No CI/product creep; phases match MVP |
| Pattern compliance | PASS | `.mjs` under `scripts/`, pnpm-only, Biome via `pnpm check` |
| Success criteria | WARNING | Progress omits `typecheck`; depcruise success path invalid |

## Findings

| ID | Severity | Impact | Finding | Recommended fix |
|----|----------|--------|---------|-----------------|
| F1 | CRITICAL | HIGH | **FR-004 mismatch** — PRD requires `--strict` for diff-size warnings + default quiet mode; plan defers staged-diff quiet mode and redefines `--strict` as top-15 + `context/` rows (`plan.md` What We're NOT Doing vs Phase 2). | Add explicit PRD deviation in plan + brief: “v1 `--strict` = expanded co-change table only; quiet/diff threshold → v2.” Or implement minimal quiet stub. |
| F2 | WARNING | MEDIUM | **Depcruise CLI wrong** — plan says `depcruise --focus <path>`; CLI expects `depcruise src --focus <regex>` (`dependency-cruise.mjs -F`). | Update Phase 3 contract: `pnpm exec depcruise src --focus <escaped-regex> --output-type json --output-to -` |
| F3 | WARNING | MEDIUM | **Fan-out metric undefined** — `--focus` returns neighborhood at depth 1, not architect “19 fan-out” total. | Define metric (direct dependents from full JSON) or label output “approx neighbors — see repo-map §4”. |
| F4 | WARNING | MEDIUM | **Vitest in `scripts/`** — first tests outside `src/`; global jsdom + `setupFiles` in `vitest.config.ts`. | Keep `@vitest-environment node`; test pure parsers only; note vitest `projects` split if ESM import friction. |
| F5 | WARNING | MEDIUM | **Project root** — plan claims agent-hooks parity + `.git` walk-up; `input.mjs` uses env/cwd only. | Implement walk-up for `.git` + env fallback; update intent text. |
| F6 | WARNING | MEDIUM | **40-line NFR vs `--strict`** — top 15 + context rows + E2E labels may exceed one screen. | Document NFR exception for `--strict`, or cap strict output lines. |
| F7 | OBSERVATION | LOW | Progress omits `pnpm typecheck` listed in Desired End State. | Add to Phase 3 automated Progress. |
| F8 | OBSERVATION | LOW | Test run command: glob vs explicit paths — minor inconsistency. | Standardize on explicit paths in Success Criteria. |
| F9 | OBSERVATION | LOW | Git edge cases (merges, renames) undocumented. | Document `--no-merges` and path normalization in Critical Details. |
| F10 | OBSERVATION | LOW | Test catalog paths verified — hook/dashboard tests exist; belt command matches AGENTS.md. | No change. |

## Strengths

- Three phases with manual gate after Phase 1 (Mom Test replay) limits wasted work.
- Pure-function tests with mocked git — appropriate for v1.
- Scope bounded: advisory CLI, no CI, no product runtime impact.
- Grounded in verified stack-assessment + repo-map E2E/git split.

## Checklist

- [x] Desired end state matches PRD thread US-01 / FR-001–006
- [x] Scope boundaries clear (no CI, no `src/` product edits)
- [x] Phase ordering prevents half-built CLI
- [x] Progress section mirrors phase Success Criteria (1.1–3.4)
- [ ] FR-004 explicitly reconciled with PRD (F1 open)
- [ ] Depcruise contract corrected (F2 open)

## Triage (recommended before implement)

| ID | Suggested action |
|----|------------------|
| F1 | **Edit plan** — add “PRD FR-004 v1 deviation” bullet under Critical Details; optional one-line PRD thread note |
| F2, F3 | **Edit plan Phase 3** — fix depcruise spawn + fan-out metric |
| F4, F5, F6 | **Edit plan** — clarify in Critical Details / Phase 3 (can implement as written with notes) |
| F7–F9 | Optional plan polish |

## Decision

**Proceed to `/10x-implement timer-change-impact-digest phase 1`** after applying F1 + F2 plan edits (≈10 min), or proceed with F1/F2 acknowledged as implement-time contract fixes.

**Next:** Triage F1–F6 in chat, or run `/10x-plan-review timer-change-impact-digest` resume on this file after edits.
