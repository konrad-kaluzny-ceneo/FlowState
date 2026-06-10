---
roadmap_id: test-plan-phase-7
change_id: test-plan-refresh-2026-06-10
follow_up_change: testing-e2e-belt-fast
prd_refs: test-plan §2 risks #1–#7
updated: 2026-06-10
---

## Outcome

Document the agreed 12-test E2E belt merge gate in `context/foundation/test-plan.md` so CI targets ≤3–4 min while risks #1–#7 keep browser entry points; code ships in `testing-e2e-belt-fast`.

## Acceptance (doc sections)

- §1 Strategy: merge gate = belt, not full catalog; new slices default Vitest/component
- §2 Risk Response Guidance: belt vs Vitest ownership per risk (#4/#6 integration-only unchanged)
- §3 Phase 7 row: `testing-e2e-belt-fast`, belt + Vitest backfill, status `not started`
- §4 Stack: `test:e2e:belt` script, worker-scoped auth, 4 workers
- §5 Quality Gates: required gate → `test:e2e:belt`; full suite ad-hoc only
- §6.3 Belt specs table (12 tests); §6.6 rollout notes (auth pool, build cache, wind-down seed)
- §7 Negative space: full Playwright catalog not on every merge
- §8 Ledger: belt strategy reviewed 2026-06-10

## Risks covered (unchanged #1–#7)

- #1 Refresh/crash loses task list or cycle state
- #2 Background tab timer drift beyond ±2s
- #3 Mid-cycle completion offers wrong choices
- #4 Cross-user data leakage via tRPC
- #5 Guest trial lost on sign-in merge
- #6 IDOR on resource IDs
- #7 Check-in skipped or energy not persisted

## Constraints

- Documentation only — no code, CI, or Playwright changes in this change
- Belt = 12 scenarios; CI job name stays `e2e`; demoted specs deleted after Vitest backfill
- Branch protection requires `quality` + `e2e` jobs

## Lessons (applicable)

- Phase 4 intentionally wired full suite as gate; belt realigns with cost × signal (§1)
- Neon Auth 429 forced `E2E_WORKERS=1`; belt needs worker-scoped `storageState` pool

## Unknowns / open questions

- Phase 7 vs Phase 5 ordering (belt unblocks velocity; mutation is separate ROI)
- Vitest gap audit before committing to delete 11 e2e files
- Full-suite cadence post-belt (nightly vs manual only)
