---
change_id: delegation-suggestion-in-plan
roadmap_id: S-47
status: impl_reviewed
created: 2026-07-28
updated: 2026-07-30
linear: FLO-98
github: 192
---

# Change: delegation-suggestion-in-plan (S-47)

In the Plan dnia view, the scorer proposes tasks suitable for delegation (to an AI agent or human) with a one-line rationale; user accepts or skips.

Prerequisites: S-45 (Plan dnia, shipped), S-46 (MCP server, archived 2026-07-28) — both done.

Plan complete: `context/changes/delegation-suggestion-in-plan/plan.md` (+ `plan-brief.md`). 3 phases: (1) `"delegated"` status seam + `TaskDelegationSkip` migration, (2) delegation scoring/rationale + `dayPlanRouter` procedures, (3) Plan dnia UI + `/tasks` Delegated tab + i18n. All 3 phases implemented — see "Implementation complete" below.

Plan reviewed: `context/changes/delegation-suggestion-in-plan/reviews/plan-review.md`. Verdict APPROVED (fixed in place) — 3 WARNINGs fixed: DEEP_WORK hard-excluded from delegation scoring (was a soft multiplier dominated by the priority divisor), ownership check added to `skipDelegationSuggestion`, `formatDelegationRationale` signature/locale inconsistency clarified. No CRITICAL findings, no PRD/roadmap drift.

Implementation complete: all 3 phases landed (`4de65c5`/`a602fe5`+`5e5bb4e`/`c379f70`+`f84a537`). Full suite 1531 tests passing, typecheck/lint clean.

Impl review: `context/changes/delegation-suggestion-in-plan/reviews/impl-review.md`. Verdict **APPROVED** — 0 CRITICAL, 1 WARNING (fixed), 2 OBSERVATIONs (accepted, out of scope for this slice). WARNING: accepting a delegation suggestion didn't invalidate the `getDelegationSuggestion` query cache (only skip did), so the card could keep showing an already-delegated task as a live "ready" candidate for up to 30s; fixed by invalidating `utils.dayPlan.getDelegationSuggestion` after a successful accept in `plan-dnia-view.tsx`, with a matching test. Independently re-verified the DEEP_WORK hard-exclusion (unconditional, regression-tested), `skipDelegationSuggestion` ownership check (unbypassable, cross-user-isolation tested), guest mode (delegation section never mounts when `dayPlan == null`), and the MCP `taskStatusZod` write-enum exclusion (still `["active","completed","planned","blocked"]`, `"delegated"` readable via `list_tasks` only) — all correct. Full suite (1531 tests), typecheck, and lint green after the fix.
