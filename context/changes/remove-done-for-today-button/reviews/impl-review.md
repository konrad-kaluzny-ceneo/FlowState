<!-- IMPL-REVIEW-REPORT -->

═══════════════════════════════════════════════════════════
  IMPLEMENTATION REVIEW: Unify task completion affordance
  Scope: Full plan (Phases 1–3)  |  Date: 2026-06-24
  Findings: 0 critical  2 warnings  2 observations
═══════════════════════════════════════════════════════════

  Plan Adherence        PASS    ✅
  Scope Discipline      PASS    ✅
  Safety & Quality      PASS    ✅
  Architecture          PASS    ✅
  Pattern Consistency   PASS    ✅
  Success Criteria      PASS    ✅

  ► Overall: APPROVED

═══════════════════════════════════════════════════════════
  WARNING FINDINGS ⚠️
═══════════════════════════════════════════════════════════

  F1 — Overlay standing confirm lacks visible error surfacing
  ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
    Severity:  ⚠️ WARNING
    Impact:    🏃 LOW
    Dimension: Pattern Consistency
    Location:  pomodoro-dashboard.tsx:708-722

    Detail:
    `markDoneForToday` errors set state on dashboard's `useTaskMutations`
    instance; TaskList shows errors on its own hook instance. Rare path.

    Fix: Defer — acceptable for slice; follow-up if user reports overlay
         failures without feedback.

  F2 — Same-day re-cycle on standing task already done-for-today
  ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
    Severity:  ⚠️ WARNING
    Impact:    🔎 MEDIUM
    Dimension: Plan Adherence
    Location:  pomodoro-dashboard.tsx:288-290

    Detail:
    When `doneForToday` is already true, overlay primary reverts to global
    complete. Plan scoped primary to standing + active. Edge case: mark from
    list, run another cycle same day.

    Fix: Defer — out of plan happy path; user can use Continue later.

═══════════════════════════════════════════════════════════
  OBSERVATIONS
═══════════════════════════════════════════════════════════

  O1 — Optional dashboard `markDoneForToday` unit test not added (plan
       allowed manual-only for overlay branch). Overlay label test exists.

  O2 — Duplicate `useTaskMutations()` in dashboard vs TaskList is pre-existing
       pattern; overlay path inherits isolation.

═══════════════════════════════════════════════════════════
  SUCCESS CRITERIA
═══════════════════════════════════════════════════════════

  Automated: `pnpm test` 872/872 PASS; `pnpm check` PASS; `pnpm typecheck` PASS
  Manual: Progress 1.4–1.6, 2.3–2.4, 3.4–3.6 marked complete with SHAs

═══════════════════════════════════════════════════════════
  TRIAGE
═══════════════════════════════════════════════════════════

  Decision proxy: no auto-fixes required; warnings documented for follow-up.
  Verdict: APPROVED — ship.
