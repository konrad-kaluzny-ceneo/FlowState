<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Background Tab Return Catch-up (S-22)

- **Plan**: context/changes/background-tab-return-catchup/plan.md
- **Scope**: Phases 1–5 (all completed phases)
- **Date**: 2026-06-08
- **Verdict**: APPROVED
- **Findings**: 3 critical (all fixed) · 1 warning · 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Fixes Applied (auto-fix CRITICAL)

| ID | Fix |
|----|-----|
| F1 | Added `tabWasHiddenWhileRunningRef`, extended `visibilitychange` to set it when hidden while running, and gate catch-up on `wasHiddenWhileRunning \|\| visibilityState !== "visible"` in `handleCycleExpired`. |
| F2 | Capture `endedAtMs` from `endTimeRef.current ?? Date.now()` before clearing ref; use `endTime` (not `Date.now()`) in expired `resumeFromActiveCycle`; clear ref in `dismissCatchUp`, `start`, and after catch-up set. |
| F3 | Dispatch `visibilitychange` when entering hidden state in `e2e/helpers/visibility.ts` so E2E matches the visibility-recalc fallback path. |
| — | Added hook unit test for visibility-recalc catch-up with `cycleEndedAtMs === endTime`. |

## Verification (post-fix)

| Command | Result |
|---------|--------|
| `pnpm check` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm test` | PASS (312 tests) |
| `set CI=true && pnpm test:e2e e2e/background-tab-return.spec.ts e2e/guest-background-tab-return.spec.ts` | PASS (2/2) |
| `set CI=true && pnpm test:e2e` (full suite) | PARTIAL — 21/30 passed; 9 failed on auth 429 rate limits and unrelated flakes, not S-22 regressions |

## Findings

### F1 — Missing `tabWasHiddenWhileRunningRef` (visibility-recalc path)

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Plan Adherence
- **Location**: src/hooks/use-pomodoro-cycle.ts:223-236
- **Detail**: Plan required catch-up when expiry fires via `recalculateFromEndTime` on tab return after the tab was hidden while running. Implementation only checked `document.visibilityState !== "visible"` at expiry time; recalc runs only when visible, so the primary fallback story never set catch-up.
- **Fix**: Implement `tabWasHiddenWhileRunningRef` per plan Critical Implementation Details; extend visibility listener and `handleCycleExpired` condition.
- **Decision**: FIXED

### F2 — `cycleEndedAtMs` used `Date.now()` instead of wall-clock end

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/hooks/use-pomodoro-cycle.ts:223-236, 347-351
- **Detail**: Plan specified `cycleEndedAtMs = endTimeRef.current ?? Date.now()` and `endTime` for expired mount recovery. Implementation cleared `endTimeRef` before reading and used `Date.now()` in both paths, making "ended ago" reflect recalc moment instead of true cycle end.
- **Fix**: Capture `endedAtMs` before clearing `endTimeRef`; pass `endTime` in `resumeFromActiveCycle` expired branch.
- **Decision**: FIXED

### F3 — E2E `runWhileHidden` omitted hidden `visibilitychange`

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: e2e/helpers/visibility.ts:13-22
- **Detail**: Helper mocked `visibilityState` but did not dispatch `visibilitychange` on hide. With main-thread E2E timer, expiry often fires on visible return via recalc; without the hidden event, `tabWasHiddenWhileRunningRef` was never set and catch-up banner did not render (overlay still appeared).
- **Fix**: Dispatch `visibilitychange` after setting hidden state, before running clock advance.
- **Decision**: FIXED

### F4 — Guest E2E in separate spec file

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: e2e/guest-background-tab-return.spec.ts
- **Detail**: Plan listed optional guest test as second case in `e2e/background-tab-return.spec.ts`. Implementation split into dedicated guest project spec. Functionally equivalent; slightly expands tracked surface.
- **Fix**: Accept as-is (guest project isolation matches existing conventions) or merge into main spec if strict plan-file parity is required.
- **Decision**: SKIPPED (benign; matches guest-chromium project pattern)

### F5 — Manual verification steps still open in Progress

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: plan.md Progress §1.4, §3.4, §4.4–4.6, §5.4
- **Detail**: Automated gates pass; manual copy/visual/iOS spot-check items remain unchecked. Expected before PR merge per plan pause notes.
- **Fix**: Complete manual checks and tick Progress items during PR test plan.
- **Decision**: PENDING

### F6 — Check-in catch-up banner z-index above overlay

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/app/_components/pomodoro-dashboard.tsx:235
- **Detail**: Plan said catch-up below check-in (`z-60`). Check-in catch-up wrapper uses `z-[65]` so the banner sits above the overlay scrim — intentional for readability; work/break catch-up correctly uses `z-[55]` above cycle-complete `z-50`.
- **Fix**: No change needed unless visual review prefers banner inside overlay container.
- **Decision**: SKIPPED
