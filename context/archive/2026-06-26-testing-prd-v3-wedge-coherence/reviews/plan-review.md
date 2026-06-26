<!-- PLAN-REVIEW-REPORT -->

# Plan Review: PRD v3 Wedge Coherence

**Review date:** 2026-06-26  
**Roadmap ID:** Q-08  
**Change ID:** testing-prd-v3-wedge-coherence  
**Plan reviewed:** `context/changes/testing-prd-v3-wedge-coherence/plan.md`  
**Verdict:** APPROVED  
**S6 exit:** satisfied after automatic plan-artifact fixes  
**Approval confidence:** 94/100

## Scope Reviewed

Read and cross-checked:

- `context/changes/testing-prd-v3-wedge-coherence/change.md`
- `context/changes/testing-prd-v3-wedge-coherence/frame.md`
- `context/changes/testing-prd-v3-wedge-coherence/research.md`
- `context/changes/testing-prd-v3-wedge-coherence/plan.md`
- `context/changes/testing-prd-v3-wedge-coherence/plan-brief.md`
- `context/foundation/test-plan.md` §6.10
- `context/foundation/lessons.md`

Spot-checked feasibility anchors used by the plan:

- `src/app/_components/break-alerts-permission-prompt.tsx`
- `src/app/_components/wedge-sync-recovery.tsx`
- `src/app/_components/overlay-shell.tsx`
- `src/app/_components/task-suggestion-card.tsx`
- `src/app/_components/pomodoro-dashboard.tsx`
- `src/lib/wedge/transition-conductor.ts`
- `src/server/api/routers/cycle.test.ts`

## Findings

### F1 — WARNING — Change brief still implied belt extensions were part of the expected deliverable

`change.md` said to deliver "unit + hook + belt extensions" even though the frame, research, plan, and test-plan §6.10 all converge on hook/component/integration-first coverage with no Playwright belt work unless cheaper layers cannot observe the contract. Leaving that wording in the change brief could push S7 into unnecessary e2e scope.

**Fix applied:** Updated `change.md` to name unit, hook, component, and integration oracles as the expected deliverables, with belt coverage only if implementation proves a contract cannot be observed below browser level.

**Status:** closed.

### F2 — WARNING — Operability oracles needed an explicit minimal-fix rule

The plan correctly requires role/name, focus, keyboard, and polite-status assertions for `break-alerts-permission-prompt` and `wedge-sync-recovery`. Spot checks show those assertions may expose tiny component semantic gaps, such as missing modal labelling or polite live status. The plan already allowed minimal production fixes when tests expose shipped contract drift, but the phase contracts did not make that rule local and concrete.

**Fix applied:** Updated `plan.md` and `plan-brief.md` to say implementation should make the smallest component-level semantic fix needed for the shipped S-39 contract instead of weakening the oracle.

**Status:** closed.

## Review Results

No open CRITICAL findings.

The plan is substance-ready after fixes:

- It maps directly to Q-08 / test-plan Phase 8 risks #8-#12 and S-39 without reopening shipped product rows.
- Layer selection is justified and conservative: conductor unit, hook, component, and one router integration path; no belt by default.
- Phase sequencing is feasible: start with the named permission-deferral deadlock, then recovery, pause persistence, mutex/stale suggestion, and cookbook verification.
- Testing commands are targeted per phase, with final `pnpm check` and `pnpm test` as repository gates.
- The `## Progress` ledger is implementation-ready and has no optional blocker ambiguity.
- The cookbook update is scoped to `context/foundation/test-plan.md` §6.10, matching the frame.

Residual risk is implementation-level only: if the new oracles reveal actual shipped behavior drift, S7 must keep fixes minimal and local or split follow-up work if the fix is larger than the proof requires.

## S6 Exit Checklist

- [x] Review saved under `context/changes/testing-prd-v3-wedge-coherence/reviews/plan-review.md`
- [x] CRITICAL/WARNING findings triaged automatically
- [x] No open CRITICAL findings remain
- [x] Plan artifacts updated only; no production code or tests implemented
- [x] `change.md` status updated to `plan_reviewed`
