<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Suggestion Rationale Expander (S-23)

- **Plan**: `context/changes/suggestion-rationale-expander/plan.md`
- **Mode**: Deep
- **Date**: 2026-06-10
- **Verdict**: SOUND (after fixes)
- **Findings**: 2 critical (fixed) · 4 warnings (fixed) · 1 observation (accepted)

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS (after F1) |
| Lean Execution | PASS |
| Architectural Fitness | PASS (after F3) |
| Blind Spots | PASS (after F1, F4) |
| Plan Completeness | PASS (after F4, F5) |

## Grounding

Grounding: 8/8 paths ✓, 6/6 symbols ✓, research↔plan ✓ (after guest scope alignment)

Verified paths: `dominant-factor.ts`, `suggestion.ts`, `use-pomodoro-cycle.ts`, `pomodoro-dashboard.tsx`, `task-suggestion-card.tsx`, `task-suggestion-card.test.tsx`, `e2e/task-suggestion.spec.ts`, `context/foundation/test-plan.md`.

Verified symbols: `getDominantRationaleKey` (dominant-factor.ts:4), `formatKickoffRationale` (dominant-factor.ts:85), `fetchPostCheckInSuggestion` field mapping (use-pomodoro-cycle.ts:774-787), kickoff `data: result` spread (use-pomodoro-cycle.ts:847-848), `TaskSuggestionData` (task-suggestion-card.tsx:13-19), `showSuggestionCard` / `showKickoffCard` (pomodoro-dashboard.tsx:87-98).

## Triage Summary

| ID | Severity | Decision |
|----|----------|----------|
| F1 | CRITICAL | FIXED — headlineKey exclusion in breakdown builder |
| F2 | CRITICAL | FIXED — change.md guest scope aligned with plan |
| F3 | WARNING | FIXED — resolved file split (rationale-breakdown.ts + tests) |
| F4 | WARNING | FIXED — toggle testid moved to Phase 3 |
| F5 | WARNING | FIXED — Progress 4.4 typecheck + renumber manual step |
| F6 | WARNING | FIXED — explicit hook import path + kickoff mapping note |
| O1 | OBSERVATION | ACCEPTED — S-25 parallel rebase note sufficient |

## Findings

### F1 — Expander would duplicate the one-line rationale

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — violates roadmap orchestrator doubt ("not duplicate it")
- **Dimension**: End-State Alignment
- **Location**: Phase 1 `buildRationaleBreakdown`; Desired End State #2; Critical Implementation Details
- **Detail**: Plan took top 2–3 contribution keys for `dominant` without excluding `rationaleKey`. On post-check-in, `breakdown.dominant[0].copy` would repeat the visible one-liner — contradicting S-23 roadmap risk guidance and FR-021 "trust beyond" intent.
- **Fix**: Require `opts.headlineKey`; exclude from dominant/chips before ranking; update tests and router contracts; hide expander when no secondary factors remain.
- **Decision**: FIXED

### F2 — change.md guest scope contradicts plan

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — identity drift before implement
- **Dimension**: Plan Completeness
- **Location**: `change.md` Notes vs plan "What We're NOT Doing"
- **Detail**: Notes claimed "guest mode uses local session blob" while plan and research defer guest card UI to a future slice (auth-only MVP).
- **Fix**: Align Notes with auth-only expander + pure-fn guest prep.
- **Decision**: FIXED

### F3 — Breakdown module location ambiguous

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — implementer could split tests incorrectly
- **Dimension**: Architectural Fitness
- **Location**: Phase 1 — breakdown types and builder
- **Detail**: Plan offered "new file or co-locate" without picking one; all tests listed under `dominant-factor.test.ts`.
- **Fix**: Lock `rationale-breakdown.ts` + `rationale-breakdown.test.ts`; keep `dominant-factor.test.ts` for key-selection regression only.
- **Decision**: FIXED

### F4 — E2E toggle testid deferred to Phase 4

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — Phase 4 e2e depends on Phase 3 shipping the selector
- **Dimension**: Plan Completeness
- **Location**: Phase 3 Expander UI vs Phase 4 E2E contract
- **Detail**: `data-testid="suggestion-rationale-toggle"` was only specified in Phase 4 e2e step, not Phase 3 component contract.
- **Fix**: Add testid to Phase 3 toggle contract; Phase 4 references existing testid.
- **Decision**: FIXED

### F5 — Phase 4 Progress missing typecheck

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — gate inconsistency vs Phases 1–3
- **Dimension**: Plan Completeness
- **Location**: Progress Phase 4 Automated
- **Detail**: Phases 1–3 include `pnpm typecheck`; Phase 4 omitted it.
- **Fix**: Add Progress 4.4 typecheck; renumber manual step to 4.5.
- **Decision**: FIXED

### F6 — Hook type import path unspecified

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — avoids server-only import mistake
- **Dimension**: Architectural Fitness
- **Location**: Phase 2 — hook result types
- **Detail**: Plan said "Import `RationaleBreakdown`" without path; kickoff spread behavior was vague.
- **Fix**: Import from `~/lib/scoring/rationale-breakdown`; document kickoff auto-propagates via `data: result`.
- **Decision**: FIXED

### O1 — S-25 parallel energy input

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — rebase coordination, not a plan blocker
- **Dimension**: Blind Spots
- **Location**: Critical Implementation Details — S-25 coordination
- **Detail**: Kickoff still hardcodes STEADY today; S-25 may land on main first. Plan already documents rebase + verify — no additional phase needed.
- **Decision**: ACCEPTED

## Confidence

**91%** — Plan is well grounded in shipped S-06/S-15 stack; headline-exclusion contract was the highest substance gap (roadmap-aligned). No open CRITICAL findings after auto-triage.
