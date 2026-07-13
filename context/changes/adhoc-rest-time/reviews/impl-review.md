<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Ad-hoc break + break-overtime-until-accept

- **Plan**: context/changes/adhoc-rest-time/plan.md
- **Scope**: Phases 1–4 of 4 (re-review, supersedes the 2026-07-13 first pass)
- **Date**: 2026-07-13
- **Verdict**: NEEDS ATTENTION → all findings fixed
- **Findings**: 0 critical, 2 warnings, 2 observations (all FIXED)

> Note: the first-pass review's 3 findings (TOCTOU index, overtime ceiling,
> double-stopWorker comment) were fixed in 5f0bb4d. This re-review found that
> two of those fixes were incomplete (F1, F2 below) plus two hygiene items the
> plan asked for (F3, F4). All four are now fixed.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING (fixed) |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Overtime 2h ceiling is a no-op for breaks; fallback path is unbounded

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/workers/timer-worker.ts:42-46, src/hooks/use-pomodoro-cycle.ts:759-782 (fallback) + :640-658 (break complete handler)
- **Detail**: The first-pass 2h MAX_OVERTIME ceiling did neither thing it claimed. The worker posted `{type:"complete"}` at 2h, but `handleCycleExpired` re-enters the break overtime branch and returns — the break never completed, just stopped ticking. The fallback timer had no ceiling at all, keeping a 1s interval alive indefinitely for an abandoned overtime break (incl. E2E main-thread mode). The 4h session-inactivity timeout remained the real backstop, so no corruption.
- **Fix A ⭐ (applied)**: Hoisted `MAX_OVERTIME_MS` into `timer-worker-logic.ts` as a shared const; mirrored the guard in the fallback tick (stop interval, freeze); corrected the worker to stop-and-freeze (post final `overtime`, not misleading `complete`). Leans on the session-inactivity timeout as the true backstop, matching the plan's "no new cap timer" design.
- **Decision**: FIXED via Fix A

### F2 — One-active-cycle migration has no dedup backfill; can abort deploy

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality (data safety)
- **Location**: prisma/migrations/20260713120000_cycle_one_active_per_user/migration.sql
- **Detail**: The partial unique index (WHERE state IN RUNNING/PAUSED) is correct and non-destructive, but it exists because the old app-level check could let duplicate active cycles through — so prod may already hold users with 2+ active cycles. A non-CONCURRENT `CREATE UNIQUE INDEX` on such data errors and aborts the migration, blocking the deploy. No preceding dedup step.
- **Fix A ⭐ (applied)**: Prepended a backfill `UPDATE` that demotes all-but-newest active cycle per user (max `started_at`, tie-break `id`) to INTERRUPTED and stamps `ended_at`, before the index creation. Migration now applies cleanly regardless of pre-existing data.
- **Decision**: FIXED via Fix A
- **Caveat**: Editing an already-applied migration changes its checksum; a local dev DB that applied the original will report drift on the next `prisma migrate dev` (resolve with a local reset). Prod/CI apply the edited version fresh — no impact.

### F3 — Dead code not retired per plan §2.3 / §2.4

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence / Pattern Consistency
- **Location**: src/app/_components/cycle-complete-overlay.tsx:48-121, src/lib/catch-up/copy.ts:50-56
- **Detail**: Plan §2.3 said "remove/guard" the CycleCompleteOverlay break branch and §2.4 said "retire/mark" the BREAK_CONFIRM copy. Both were left in place. Verified unreachable at runtime (no path drives a break to `completed`; deriveCatchUpGate never returns BREAK_CONFIRM). The overlay branch is still directly prop-tested; BREAK_CONFIRM stays in the CatchUpGate union for exhaustiveness.
- **Fix (applied)**: Guarded both with explanatory "unreachable via runtime — retained for X" comments (deletion avoided to preserve the exhaustive switch and the prop-level test coverage).
- **Decision**: FIXED (guarded)

### F4 — Paused-overtime "End break" would fail server-side (latent)

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/hooks/use-pomodoro-cycle.ts:2564-2580 (endBreakFromOvertime), src/app/_components/timer-panel.tsx:192-203 (paused-overtime UI)
- **Detail**: timer-panel renders an End-break + Resume pair for `isPaused && isOvertime`, and `resume()` has a dedicated `isOvertimePause` branch — multiple paths anticipate paused-overtime. But `endBreakFromOvertime → confirmComplete → cycles.complete` requires state RUNNING, so End break in that state would silently error. Not reachable today (no pause affordance during overtime), so latent.
- **Fix (applied)**: `endBreakFromOvertime` now resumes a paused break (`await resume()`) before completing, so the accept always targets a RUNNING cycle. Keeps the anticipatory UI consistent instead of deleting it.
- **Decision**: FIXED

## Verification

- `pnpm typecheck` — clean
- `pnpm check` — pass (6 pre-existing warnings)
- `pnpm test` — 1289 passed (162 files)
- E2E belt — relied on CI (green at 90ce25f; no browser-observable behavior changed by these fixes)
