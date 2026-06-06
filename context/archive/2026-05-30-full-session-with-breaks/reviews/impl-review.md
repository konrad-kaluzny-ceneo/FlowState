<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Full Session with Breaks

- **Plan**: context/changes/full-session-with-breaks/plan.md
- **Scope**: All Phases (1–4 of 4)
- **Date**: 2026-05-31
- **Verdict**: NEEDS ATTENTION
- **Findings**: 1 critical, 4 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | FAIL |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — TOCTOU race in cycle.create allows duplicate running cycles

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/server/api/routers/cycle.ts:68-90
- **Detail**: The `create` mutation checks for an existing running cycle (`findFirst` where state = RUNNING) then creates a new one. Under concurrent requests, two cycles could pass the check simultaneously and both be created. No unique constraint or transaction prevents this. Duplicate running cycles corrupt timer state.
- **Fix**: Wrap the running-cycle check + create in a serializable transaction, or add a partial unique index on (userId, state) where state = 'RUNNING' at the DB level.
  - Strength: DB-level constraint is the strongest guarantee — no application-level race can bypass it.
  - Tradeoff: Requires a new migration for the partial index. Transaction approach avoids migration but is slightly weaker under high concurrency.
  - Confidence: HIGH — this is a well-known TOCTOU pattern.
  - Blind spot: Need to verify Neon/Postgres supports partial unique indexes (it does).
- **Decision**: FIXED — Wrapped check + create in $transaction

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: src/hooks/use-pomodoro-cycle.ts:72
- **Detail**: Plan §3.2 specified deriving the completed work cycle count from the existing `cycle.list` query filtered by sessionId (client-side filter). Implementation uses a local `useState(0)` counter instead. After a page refresh mid-session, the count resets to 0, potentially giving a short break when a long break was due.
- **Fix A ⭐ Recommended**: Derive count from cycle.list on recovery
  - Strength: Matches plan intent. Survives page reloads. The cycle list for a session is tiny (≤8 entries).
  - Tradeoff: Adds one query on recovery; minor complexity.
  - Confidence: HIGH — cycle.list already accepts sessionId filter.
  - Blind spot: None significant.
- **Fix B**: Accept as intentional simplification and document
  - Strength: No code change. Simpler mental model.
  - Tradeoff: Break cadence can be wrong after refresh. Plan diverges from implementation without record.
  - Confidence: MEDIUM — depends on how often users refresh mid-session.
  - Blind spot: No data on refresh frequency during sessions.
- **Decision**: FIXED (Fix A) — Derived count from cycle.list on recovery

### F3 — Race condition in session.end (find-then-update without guard)

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/server/api/routers/session.ts:44-56
- **Detail**: The `end` mutation uses `findFirst` → `update` without a state guard on the update. Between the find and the update, another request could end the same session. The `cycle.ts` router uses `updateMany` with a state filter + count check for the same pattern.
- **Fix**: Use `updateMany` with `state: "ACTIVE"` filter and check `count === 0` to throw NOT_FOUND, matching the pattern in cycle.ts interrupt/complete.
- **Decision**: FIXED — Applied atomic updateMany pattern

### F4 — Module-level singleton prevents cycle recovery after re-auth

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Pattern Consistency
- **Location**: src/hooks/use-pomodoro-cycle.ts:32
- **Detail**: `activeCycleRecoveryFetched` is a module-level `let` that prevents re-fetching the active cycle on remount. In React Strict Mode (dev double-mount), or if the user logs out and back in without a full page reload, this flag stays `true` and the cycle is never recovered.
- **Fix A ⭐ Recommended**: Tie the guard to the user session ID
  - Strength: A new login resets recovery. Strict Mode safe.
  - Tradeoff: Slightly more complex — needs session ID context.
  - Confidence: MEDIUM — need to verify session ID is available at hook mount time.
  - Blind spot: Exact timing of session ID availability in the auth flow.
- **Fix B**: Move to a React ref (resets on unmount)
  - Strength: Simple change. Fixes Strict Mode double-mount.
  - Tradeoff: Doesn't fix the re-auth scenario (component may not unmount on login switch).
  - Confidence: HIGH — straightforward ref replacement.
  - Blind spot: Whether the component actually unmounts on logout/login.
- **Decision**: FIXED (Fix A) — Tied guard to data mode for session-aware recovery

### F5 — Unsafe Number() casts in server-repositories without validation

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/repositories/server-repositories.ts:65-75
- **Detail**: `Number(input.id)`, `Number(input.cycleId)`, `Number(input.taskId)` will produce `NaN` if a string UUID is accidentally passed. `NaN` passed to Prisma throws a cryptic error.
- **Fix**: Add a guard before each cast: `const id = Number(input.id); if (!Number.isFinite(id)) throw new Error("Invalid numeric ID");`
- **Decision**: FIXED — Added toNumericId() helper with validation

### F6 — completedWorkCycles not reset on server-side timeout

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/hooks/use-pomodoro-cycle.ts:72
- **Detail**: If the user's session times out server-side (4h inactivity) and a new session is auto-created, the client-side `completedWorkCycles` counter persists from the old session. In practice, a 4h-inactive user likely refreshed the page (resetting the counter anyway).
- **Fix**: Reset `completedWorkCycles` to 0 in `recoverActiveCycle` when no active cycle is found.
- **Decision**: FIXED — Added else branch to reset counter on recovery miss
