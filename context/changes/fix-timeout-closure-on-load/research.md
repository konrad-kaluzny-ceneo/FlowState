---
date: 2026-06-18T12:00:00+02:00
researcher: Cursor Agent
git_commit: c142e25262a1991df567b458f4b86ce84dbc6f49
branch: features/fix-timeout-closure-on-load
repository: FlowState
topic: "B-06 fix-timeout-closure-on-load — timeout closure on page load (T-03)"
tags: [research, codebase, closure, timeout, hydrate, B-06, T-03]
status: complete
last_updated: 2026-06-18
last_updated_by: Cursor Agent
---

# Research: B-06 fix-timeout-closure-on-load (T-03)

**Date**: 2026-06-18T12:00:00+02:00  
**Researcher**: Cursor Agent  
**Git Commit**: [`c142e25`](https://github.com/konrad-kaluzny-ceneo/FlowState/commit/c142e25262a1991df567b458f4b86ce84dbc6f49)  
**Branch**: `features/fix-timeout-closure-on-load`  
**Repository**: [konrad-kaluzny-ceneo/FlowState](https://github.com/konrad-kaluzny-ceneo/FlowState)

## Research Question

How should B-06 move timeout session closure from cycle-start timing to initial page-load hydrate so the user sees why the prior session ended before kickoff readiness or task selection (T-03)?

## Summary

**T-03 is confirmed in code.** `maybePresentTimeoutClosure` exists and works, but is invoked only when `start()` detects a **new** session id after `getOrCreateActive()` — not during the initial `recoverActiveCycle()` hydrate on home load.

When the server ends a session for inactivity (`ENDED_BY_TIMEOUT` in `findOrCreateActiveSession`), a returning user lands idle with `sessionStartIdleFlag = true` and kickoff eligibility fires immediately — without ever seeing the timeout closure line.

**Recommended fix:** extend the no-active-cycle branch of `recoverActiveCycle()` (or a dedicated post-recovery hydrate effect) to call `maybePresentTimeoutClosure` for the last ended session **before** setting `sessionStartIdleFlag`. Because `kickoffEligible` already requires `pendingClosureLine == null`, presenting closure first naturally blocks kickoff until dismiss.

**Scope:** hook + Vitest characterization/enforcement; optional belt E2E (inactivity → reload → closure before kickoff). Guest path supported by existing `maybePresentTimeoutClosure` guest branch but kickoff is authenticated-only.

## Detailed Findings

### Product intent (T-03)

From [`user-flow.md` T-03](context/foundation/user-flow.md):

- **Symptom:** Closure after session timeout appears only when starting the next cycle, not on page entry.
- **Outcome:** User sees timeout closure as the **first beat** after return — before kickoff readiness or manual task selection.
- **US-01:** Orchestrated transitions; closure is a calm interstitial, not deferred context.

### Current closure presentation path

File: `src/hooks/use-pomodoro-cycle.ts`

| Function | Lines | Role |
|----------|-------|------|
| `wasClosureShown` / `markClosureShown` | 62–77 | `sessionStorage` dedupe per session id |
| `maybePresentTimeoutClosure` | 691–735 | Fetches last ended session (auth: `getLastEnded`; guest: snapshot), builds line, calls `presentClosureOverlay` |
| `presentClosureOverlay` | 680–689 | Sets `pendingClosureLine` if not already shown |
| **Only call site** | 1396–1398 | Inside `start()`, when `session.id !== _activeSessionId` |

```1395:1399:src/hooks/use-pomodoro-cycle.ts
				// Reset completed count when server assigns a different session
				if (session.id !== _activeSessionId) {
					if (_activeSessionId != null) {
						await maybePresentTimeoutClosure(_activeSessionId);
					}
```

On first visit after timeout, `_activeSessionId` is `null`, so even when `start()` eventually runs, the prior session id is unknown unless hydrated elsewhere.

### Initial hydrate path (the gap)

File: `src/hooks/use-pomodoro-cycle.ts`

```589:627:src/hooks/use-pomodoro-cycle.ts
	const recoverActiveCycle = useCallback(async () => {
		// ...
		const active = await cycles.getActive();

		if (active != null) {
			resumeFromActiveCycle(active);
			// ... count completed work cycles
		} else {
			// No active cycle — session may have timed out server-side; reset counter
			setCompletedWorkCycles(0);
			setSessionStartIdleFlag(true);
		}
	}, [/* ... */]);

	useEffect(() => {
		void recoverActiveCycle();
	}, [recoverActiveCycle]);
```

**Gap:** the `else` branch sets `sessionStartIdleFlag(true)` immediately, triggering kickoff eligibility, but never calls `maybePresentTimeoutClosure`.

`home-shell.tsx` does not participate in closure logic — it only mounts `PomodoroDashboard` inside `DataModeProvider`. All timing lives in the hook.

### Server-side timeout mechanics

File: `src/server/api/lib/active-session.ts`

When `getOrCreateActive` runs, inactive sessions (>4h since `lastActivityAt`) are marked `ENDED_BY_TIMEOUT` and a new `ACTIVE` session is created. The ended session retains its id and narrative stats for closure line building.

`getLastEnded` (`session.ts:84–94`) returns the most recent `ENDED_BY_USER` or `ENDED_BY_TIMEOUT` session — exactly what `maybePresentTimeoutClosure` already queries.

### Kickoff mutex (B-05 baseline)

After B-05 merge:

- `kickoffEligible` excludes `pendingClosureLine != null` (line 1079).
- Dashboard blocks kickoff/check-in overlays while closure pending (`pomodoro-dashboard.tsx`).
- Kickoff eligibility effect uses `kickoffFetchGenRef` stale-abort pattern.

**Implication for B-06:** if closure is presented during hydrate **before** `sessionStartIdleFlag` is set (or while `pendingClosureLine` is set), kickoff cannot open until user dismisses closure. No new dashboard mutex required.

### Ordering constraint

```
Desired:  recoverActiveCycle → maybePresentTimeoutClosure → (pendingClosureLine set) → sessionStartIdleFlag → kickoff blocked until dismiss
Current:  recoverActiveCycle → sessionStartIdleFlag → kickoff opens → (closure only on start())
```

### Test coverage gaps

| Layer | File | Exists | B-06 gap |
|-------|------|--------|----------|
| Hook | `use-pomodoro-cycle.test.tsx` | `endSession` + closure; kickoff suite | No hydrate-after-timeout char test |
| Dashboard | `pomodoro-dashboard.test.tsx` | Closure mutex with kickoff (B-05) | Covered for simultaneous render; not load timing |
| E2E | `session-closure.spec.ts` | Explicit end-session closure | No timeout → reload → closure-on-load path |

Parent plan (`refactor-opportunities/plan.md` Phase 3) mandates: char test (fail first) → enforcement → green.

### Blast radius

| File | Change |
|------|--------|
| `src/hooks/use-pomodoro-cycle.ts` | Call `maybePresentTimeoutClosure` on hydrate; defer `sessionStartIdleFlag` until after closure attempt |
| `src/hooks/use-pomodoro-cycle.test.tsx` | Characterization + enforcement for timeout-on-load |
| `e2e/` (optional belt) | Inactivity timeout → reload → closure visible before kickoff |

**Out of scope:** F-07 conductor; copy distinction explicit-end vs timeout (S-17 unknown — use existing `buildSessionClosureLine` / stored `closureLine`); guest kickoff (N/A).

## Code References

- `src/hooks/use-pomodoro-cycle.ts:589-642` — `recoverActiveCycle` + mount effect
- `src/hooks/use-pomodoro-cycle.ts:691-735` — `maybePresentTimeoutClosure`
- `src/hooks/use-pomodoro-cycle.ts:1070-1117` — `kickoffEligible` + eligibility effect
- `src/hooks/use-pomodoro-cycle.ts:1395-1399` — closure only on session id change in `start()`
- `src/server/api/lib/active-session.ts:25-36` — server timeout → `ENDED_BY_TIMEOUT`
- `src/server/api/routers/session.ts:84-94` — `getLastEnded`
- `src/app/_components/pomodoro-dashboard.tsx:373-395` — closure vs kickoff render guards (B-05)

## Architecture Insights

1. **Reuse `maybePresentTimeoutClosure`** — no new API or overlay component; move the call site earlier in the lifecycle.

2. **Session id for hydrate:** On auth hydrate with no active cycle, query `getLastEnded` first; if `ENDED_BY_TIMEOUT` (or `ENDED_BY_USER` for consistency with existing start-path behavior), present closure for that id. Guest: scan snapshot sessions (existing logic in `maybePresentTimeoutClosure`).

3. **`sessionStartIdleFlag` deferral** is the critical ordering lever — set it only after closure attempt completes (including async `getLastEnded`), so kickoff effect never races ahead.

4. **Dedupe safety:** `wasClosureShown` prevents double presentation if user also triggers `start()` with a new session id later on the same visit.

5. **Keep `start()` call site** — still needed when session transitions mid-flow without full page reload.

## Historical Context

- `context/archive/2026-06-17-fix-closure-kickoff-mutex/` — B-05 mutex + async abort; explicitly out-of-scoped B-06 (T-03)
- `context/changes/refactor-opportunities/plan.md` Phase 3 — char-before-touch commit order for B-06
- `context/domain/01-domain-distillation.md` G10 — documents T-03 gap at `use-pomodoro-cycle.ts:1388-1390`

## Related Research

- `context/archive/2026-06-17-fix-closure-kickoff-mutex/research.md` — closure/kickoff mutex (B-05)
- `context/changes/refactor-opportunities/research.md` — K5 wedge orchestration parent

## Open Questions

| # | Question | Recommendation for plan |
|---|----------|-------------------------|
| OQ1 | Present closure for `ENDED_BY_USER` on load too, or timeout only? | **Both** — `maybePresentTimeoutClosure` already handles both states; product outcome says "timeout closure" but same beat applies to any ended prior session on return without active cycle |
| OQ2 | E2E belt case for T-03? | **Optional** — 4h timeout impractical in CI; prefer hook char test; belt can use seeded `ENDED_BY_TIMEOUT` + reload if added |
| OQ3 | Separate hydrate effect vs inline in `recoverActiveCycle`? | **Inline in `recoverActiveCycle` else branch** — single async path, avoids duplicate mount effects |

## Implementation Handoff

1. **Char test:** Mock `getActive` → null, `getLastEnded` → `{ id, state: ENDED_BY_TIMEOUT, closureLine }`; assert `pendingClosureLine` set and `awaitingKickoffReadiness` false before dismiss.
2. **Enforcement:** In `recoverActiveCycle` else branch, await `maybePresentTimeoutClosure(priorSessionId)` then set `sessionStartIdleFlag`.
3. **Verify:** `pnpm test` on hook file; manual: idle past timeout → reload → closure before kickoff.
