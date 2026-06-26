---
change_id: testing-mutation-oracle-hardening
title: Mutation oracle hardening — kill survived mutants in hooks and server routers
status: implemented
created: 2026-06-26
updated: 2026-06-26
archived_at: null
---

## Notes

Test-plan §3 Phase 5 (roadmap Q-09). Raise covered-code mutation score from ~58%
by killing survived mutants in `src/hooks/` and `src/server/api/routers/` — tests
already exist but assertions are too weak. Risks #1–#6 (refresh/crash recovery,
timer drift, mid-cycle prompt, per-user isolation, guest merge, IDOR).

Scope: unit + integration test hardening only (targeted Stryker runs). No
production code changes unless a survived mutant reveals a genuine user-visible
bug. No UI, no migration. No Linear/GitHub issue pair by design (mirrors Q-08).

Priority order (test-plan §6.7): 1) `src/hooks/` cycle state machine, recovery,
visibility recalc; 2) `src/server/api/routers/` ownership branches; 3)
`src/server/api/lib/` guest import edge cases. Do not chase 100% — add an
assertion only when breaking the mutant catches a user-visible regression.
