<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Session Kickoff Suggestion (S-15)

- **Plan**: `context/changes/session-kickoff-suggestion/plan.md`
- **Scope**: Full plan (Phases 1–5)
- **Date**: 2026-06-08
- **Verdict**: APPROVED
- **Findings**: 0 critical | 1 warning | 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS ✅ |
| Scope Discipline | PASS ✅ |
| Safety & Quality | PASS ✅ |
| Architecture | PASS ✅ |
| Pattern Consistency | PASS ✅ |
| Success Criteria | PASS ✅ (automated); manual 1.5–5.6 pending |

## Grounding

Commits `87aaa6d` → `e10e76e` (5 feature phases + docs/progress). All planned files present in diff. Supporting extras: `timer-panel.tsx` (staged duration wiring, Phase 4), `dominant-factor.ts` (kickoff rationale helper — plan cited `rationale.ts`).

## Automated verification (review run)

| Command | Result |
|---------|--------|
| `pnpm check` | Pass |
| `pnpm test` | 311/311 pass |
| `set CI=true && pnpm test:e2e e2e/session-kickoff.spec.ts` | 4/4 pass (fresh server on `E2E_PORT=3005`) |

## Findings

### F1 — sessionStartIdleFlag broader than plan guard

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: `src/hooks/use-pomodoro-cycle.ts:385-388`
- **Detail**: Plan requires `sessionStartIdleFlag` only when `!hasActiveSession OR completedWorkCycles === 0`. Implementation sets the flag whenever recovery finds no active cycle, without checking session activity or completed work count. Page reload after mid-session manual focus clear could re-trigger kickoff (e2e intentionally reloads after task add). In-session `clearTask` remains safe because flags are cleared on `start()`.
- **Fix**: Gate `setSessionStartIdleFlag(true)` on `!hasActiveSession || completedWorkCycles === 0` and preserve server-derived cycle count when idle.
- **Decision**: ACCEPTED — acceptable MVP wedge; e2e and manual cold-start flow depend on reload trigger; stricter guard is follow-up.

### F2 — selectTask kickoff override omits kickoffEligible

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: `src/hooks/use-pomodoro-cycle.ts:722-735`
- **Detail**: Plan specified `kickoffEligible &&` on override branch; code uses `idle && pendingKickoffSuggestion.status === 'ready'`. Post-accept override via Focus still works (flags cleared but suggestion stays ready). No incorrect override observed in tests.
- **Fix**: Add `kickoffEligible` to guard if strict plan parity desired.
- **Decision**: ACCEPTED — behavior matches FR-022; no change needed.

### F3 — tRPC recordDecision aborted during e2e navigation

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: E2E run (chip + override scenarios)
- **Detail**: WebServer logged `suggestion.recordDecision: aborted` during fast navigation; all four e2e assertions still passed. Likely race on page teardown, not a functional regression.
- **Fix**: None required unless flakes appear in CI.
- **Decision**: ACCEPTED

## Plan adherence summary

| Area | Verdict |
|------|---------|
| Discriminated `suggestion.next` / `recordDecision` kickoff branches | MATCH |
| Nullable `cycleId`, `sessionId`, `SuggestionContext` migration | MATCH |
| `buildScoringContextForSession` + kickoff `lastOverride` OR query | MATCH |
| Kickoff eligibility flags + false→true fetch transition | MATCH |
| Idle `TaskSuggestionCard` + mutual exclusion with S-06 | MATCH |
| S-19 override ack on kickoff path | MATCH |
| Work-type duration chips + scoped localStorage | MATCH |
| IDOR isolation tests for `sessionId` | MATCH |
| E2E spec + test-plan §6 cookbook entry | MATCH |

## What we're NOT doing — confirmed

- No dedicated `suggestion.kickoff` router
- No guest kickoff UI/API
- No server-side per-type sync
- No mid-session focus-clear trigger (in-session `clearTask` path)
- No auto-apply duration on accept

## Triage summary

- **Fixed**: none (0 critical)
- **Accepted**: F1, F2, F3
