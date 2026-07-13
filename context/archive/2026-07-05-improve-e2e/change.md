---
change_id: improve-e2e
title: Restore belt E2E and accessibility after ui-refactor
status: archived
created: 2026-07-05
updated: 2026-07-13
archived_at: 2026-07-13T16:23:00Z
---

## Notes

zapisz plan jako nowe zadanie @c:\Users\konra\.cursor\plans\restore_belt_e2e_tests_c158c2ba.plan.md

Branch: `features/fix-e2e-tests`. Scope: belt + a11y only (no `@skip-belt` catalog rows; non-belt deleted specs stay on Vitest/integration per test-plan §6.10).

Session 2026-07-06: Phase 1 landed (accessibility.spec.ts + a11y component fixes). Belt spec restore (Phase 2) deferred — restored specs removed after failing ui-refactor adaptation; Vitest layer covers wedge per L-06.
