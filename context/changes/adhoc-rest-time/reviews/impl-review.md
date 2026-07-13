<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Ad-hoc break + break-overtime-until-accept

- **Plan**: context/changes/adhoc-rest-time/plan.md
- **Scope**: Phases 1–4 of 4
- **Date**: 2026-07-13
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 2 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — TOCTOU on concurrent cycle creation (no row-level lock)

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/server/api/routers/cycle.ts:~143
- **Detail**: The `create` mutation checks for existing active cycles inside a Prisma $transaction, but uses a simple `findFirst` without FOR UPDATE. Under READ COMMITTED isolation (Neon default), two concurrent requests could both pass the `existingActive` check and create duplicate running cycles.
- **Fix A ⭐ Recommended**: Add a unique partial index on (userId, state) filtered to state IN ('RUNNING', 'PAUSED')
  - Strength: DB-level enforcement; zero code change to mutation logic; Prisma catches the unique violation.
  - Tradeoff: Requires a migration; partial indexes are Postgres-specific (fine for Neon).
  - Confidence: HIGH — partial unique indexes are idiomatic Postgres for "at most one active" constraints.
  - Blind spot: Need to verify no edge case where a user legitimately has two active cycles (none found).
- **Fix B**: Pass `isolationLevel: 'Serializable'` to the transaction
  - Strength: No migration; purely code-level.
  - Tradeoff: Serializable transactions have higher abort rate under contention; retry logic needed.
  - Confidence: MEDIUM — heavier than needed for this constraint.
  - Blind spot: Neon serverless may have latency on serializable.
- **Decision**: FIXED via Fix A — migration `20260713120000_cycle_one_active_per_user` + P2002 catch in cycle router

### F2 — No upper bound on overtime worker interval lifetime

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/workers/timer-worker.ts:~38
- **Detail**: When a break enters overtime, the worker interval runs indefinitely until an explicit "stop" message. If the user abandons the tab without cleanup firing, the worker ticks forever.
- **Fix**: Add a safety ceiling (MAX_OVERTIME_MS = 2h) inside the worker; self-post "complete" when exceeded.
- **Decision**: FIXED — 2h ceiling added in timer-worker.ts tick()

### F3 — Double stopWorker in endBreakFromOvertime is intentional but undocumented

- **Severity**: 📝 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/hooks/use-pomodoro-cycle.ts:~2564
- **Detail**: `endBreakFromOvertime` calls `stopWorker()` then delegates to `confirmComplete(false)` which also calls `stopWorker()`. Defensive but could look accidental.
- **Fix**: Add a one-line comment clarifying intent.
- **Decision**: FIXED — comment added
