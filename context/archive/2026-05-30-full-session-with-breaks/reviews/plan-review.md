<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Full Session with Breaks

- **Plan**: context/changes/full-session-with-breaks/plan.md
- **Mode**: Deep
- **Date**: 2026-05-30
- **Verdict**: REVISE → SOUND (after fixes)
- **Findings**: 1 critical, 3 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | WARNING |
| Blind Spots | FAIL |
| Plan Completeness | WARNING |

## Grounding
Grounding: 12/12 paths ✓, 3/3 symbols ✓, brief↔plan ✓

## Findings

### F1 — Break auto-start races with state reset in confirmComplete

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Blind Spots
- **Location**: Phase 3 §1 — Extend hook state to track session flow
- **Detail**: The plan says "after confirmComplete on a WORK cycle, auto-create a break cycle." But the current confirmComplete resets ALL state after cycles.complete() succeeds. If break creation happens after this reset, the hook is in idle state with no activeCycle. Additionally, the plan's own "Open Risks" says break creation must pass sessionId explicitly, but Phase 3 §1 never specified that.
- **Fix A ⭐ Recommended**: Restructure confirmComplete into a two-path flow — WORK completion auto-starts break BEFORE state reset; BREAK completion resets to idle.
  - Strength: Explicitly defines the state machine transition; avoids the race.
  - Tradeoff: confirmComplete becomes more complex (two code paths).
  - Confidence: HIGH — only ordering that avoids the race.
  - Blind spot: Error handling if break creation fails after work cycle is already marked complete.
- **Fix B**: Split into confirmWorkComplete and confirmBreakComplete
  - Strength: Cleaner separation; easier to test independently.
  - Tradeoff: More API surface from the hook.
  - Confidence: MEDIUM — adds complexity to the hook's public API.
  - Blind spot: Whether the overlay can be made kind-aware without a larger refactor.
- **Decision**: FIXED via Fix A — restructured confirmComplete contract in Phase 3 §1 to specify two-path flow with explicit sessionId passing and error handling for break creation failure.

### F2 — cycle.countCompleted introduces a new query pattern

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architectural Fitness
- **Location**: Phase 3 §2 — Add cycle.countCompleted query
- **Detail**: No count-style tRPC query exists anywhere in the codebase. Adding a dedicated count endpoint is a new pattern. The cycle list for a session is tiny (≤8 entries) — client-side filtering is sufficient.
- **Fix A ⭐ Recommended**: Count client-side from existing cycle.list filtered by sessionId
  - Strength: No new server endpoint; uses existing pattern; dataset is tiny.
  - Tradeoff: Requires fetching the cycle list (already cached by tRPC).
  - Confidence: HIGH — list is already fetched for recovery logic.
  - Blind spot: None significant.
- **Fix B**: Keep cycle.countCompleted but document it as a new pattern
  - Strength: Server-authoritative; minimal data transfer.
  - Tradeoff: New pattern; requires sessionId plumbing.
  - Confidence: MEDIUM — works but adds complexity for single-digit counts.
  - Blind spot: None significant.
- **Decision**: FIXED via Fix A — replaced cycle.countCompleted with client-side count derivation from existing cycle.list query.

### F3 — Phase 3 doesn't specify sessionId plumbing for break creation

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3 §1 — Extend hook state
- **Detail**: The "Open Risks" section correctly identifies that break creation must pass sessionId explicitly, but Phase 3 §1's contract never mentioned storing or passing it.
- **Fix**: Add to Phase 3 §1 contract that the hook must store sessionId and pass it explicitly to cycles.create() for break cycles.
- **Decision**: FIXED — added explicit sessionId storage and passing requirement to Phase 3 §1 contract.

### F4 — Break duration range mismatch with server validation

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 §1 — Extend duration-storage
- **Detail**: Client range (1–30 min) is stricter than server's (1–90 min). This is fine but the asymmetry should be documented.
- **Fix**: Document in Phase 2 that the client range is intentionally stricter and the server validation is the safety net.
- **Decision**: FIXED — added note to Phase 2 §1 contract documenting the intentional asymmetry.

### F5 — No error UI for failed break auto-start

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 3 §1
- **Detail**: The plan's "Open Risks" says if break creation fails the user sees idle state with an error message, but no phase specified what message to show.
- **Fix**: Add error message spec to Phase 3 §1: setError("Break could not start. Your work cycle was saved.") and reset to idle.
- **Decision**: FIXED — added explicit error message and idle reset to Phase 3 §1 contract.
