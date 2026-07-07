---
change_id: fix-suggestion-on-break-view
title: Next-task suggestion only as the star in "Gotów skupić się na" — remove the standalone panel
status: implementing
created: 2026-07-06
updated: 2026-07-07
archived_at: null
---

## Notes

'Sugerowane następne zadanie' nie powinno pokazywać się na widoku przerwy, to bug.

## Plan Review (2026-07-07)

Verified plan.md's file:line citations against current `main` via 3 parallel agents
(dashboard/hook, gate modules, tests/docs). ~95% of citations still hold; closed gaps found
in the plan itself:
- Phase 2's `SUGGESTION_ACCEPT` removal was missing `catch-up/types.ts` (union member) and
  `catch-up/copy.ts` (switch case), plus their tests and `tab-return-catchup.test.tsx`.
- `use-pomodoro-cycle.test.tsx` (~29 references to removed state) wasn't assigned to any
  phase despite Phase 2's own success criteria requiring it to pass.
- `context/foundation/test-plan.md` referenced test names Phase 2/4 will delete/rename.
- Flagged (not yet resolved, needs verification during Phase 1): whether removing
  `suggestionPersonaLabel` silently changes the kept star popup's `coachLine` copy.
- Fixed a stale citation (home-session-state.ts:150-166 doesn't contain the pinning logic
  it was cited for).

All fixes applied directly to `plan.md`. No open design questions — plan is ready for
`/10x-implement`.
