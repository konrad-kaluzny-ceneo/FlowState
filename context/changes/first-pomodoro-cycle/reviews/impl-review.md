<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: First Pomodoro Cycle

- **Plan**: context/changes/first-pomodoro-cycle/plan.md
- **Scope**: Phases 1–5 of 5 (all completed)
- **Date**: 2026-05-28
- **Verdict**: APPROVED (post-triage)
- **Findings**: 0 critical, 4 warnings, 2 observations — all triaged FIXED

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS (addendum added) |
| Safety & Quality | PASS (post-triage) |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — No single-active-cycle invariant (server + client)

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Safety & Quality
- **Location**: `src/server/api/routers/cycle.ts:44-86`, `src/hooks/use-pomodoro-cycle.ts:265-312`, `src/app/_components/timer-panel.tsx:56-146`
- **Detail**: `cycle.create` does not reject when the user already has a `RUNNING` cycle. `getActive` uses `findFirst` without `orderBy`. On the client, `start()` only requires a focused task — not `state === "idle"` — and `timer-panel` renders the idle UI when `state === "completed"`, so a second cycle can be created while the completion overlay is open and the prior cycle remains `RUNNING` on the server.
- **Fix A ⭐ Recommended**: Enforce one active cycle end-to-end — server `create` returns `CONFLICT` if a `RUNNING` cycle exists; client blocks `start()` (and idle timer UI) unless `state === "idle"`; add `orderBy: { startedAt: "desc" }` on `getActive`.
  - Strength: Matches PRD “one cycle at a time” and makes recovery deterministic.
  - Tradeoff: Requires coordinated server + client change; E2E may need an assertion.
  - Confidence: HIGH — clear invariant, small surface area.
  - Blind spot: Existing duplicate `RUNNING` rows in prod DB (if any) need a one-off cleanup.
- **Fix B**: Client-only gating (disable Start until overlay dismissed)
  - Strength: Faster; no migration/index.
  - Tradeoff: Parallel tabs or API callers can still create duplicates.
  - Confidence: MEDIUM — fixes common UX path only.
  - Blind spot: Direct tRPC `create` calls bypass UI.
- **Decision**: FIXED via Fix A

### F2 — Task list mutations during active cycle

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: `src/app/_components/task-list.tsx:113-158`
- **Detail**: Only “Focus” is disabled when `cycleState === "running"`. Users can still mark complete, delete, or refocus tasks during a running (or client-`completed`) cycle, which can conflict with in-flight cycle state and overlay actions.
- **Fix**: Gate destructive/status controls when `cycleState` is `"running"` or `"completed"` (disable delete, mark-complete checkbox, and focus switches until cycle is confirmed or interrupted).
- **Decision**: FIXED

### F3 — Focus change during completion overlay

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: `src/hooks/use-pomodoro-cycle.ts:245-263`
- **Detail**: `selectTask` / `clearTask` block only when `state === "running"`, not `"completed"`. User can change focus while overlay is open; overlay copy / `canMarkTaskDone` may disagree with `activeCycle.taskId` used by `complete`.
- **Fix**: Block `selectTask` and `clearTask` when `state === "completed"` (or bind overlay strictly to `activeCycle.task`).
- **Decision**: FIXED

### F4 — Unplanned supporting modules (benign scope creep)

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: `src/server/api/lib/active-session.ts`, `src/workers/timer-worker-logic.ts`, `src/lib/format-remaining.ts` (+ tests)
- **Detail**: Helpful extractions not listed in plan “Changes Required”. No forbidden features added; improves testability and DRY session resolution.
- **Fix**: Add a short addendum to `plan.md` documenting these files, or leave as-is.
- **Decision**: FIXED (plan addendum)

### F5 — `complete` task update omits `userId` in where clause

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `src/server/api/routers/cycle.ts:120-124`
- **Detail**: `markTaskDone` updates task with `where: { id: cycle.taskId }` only. Cycle ownership was validated; task row is not re-scoped to `userId` (defense in depth vs `task` router).
- **Fix**: Use `where: { id: cycle.taskId, userId: ctx.session.user.id }` on the task update.
- **Decision**: FIXED

### F6 — Plan performance note: no `requestAnimationFrame` for visible tab

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: `src/hooks/use-pomodoro-cycle.ts` (display path)
- **Detail**: Plan “Performance Considerations” mentions rAF for smooth display when tab is visible; implementation uses Worker/`setInterval` only. NFR ±2s drift is still met via server-authoritative end time.
- **Fix**: Document as deferred in plan, or add rAF-synchronized display when `document.visibilityState === "visible"`.
- **Decision**: FIXED (deferred in plan addendum)

## Automated verification (2026-05-28)

| Command | Result |
|---------|--------|
| `pnpm test` | PASS — 25 files, 94 tests |
| `pnpm typecheck` | PASS |
| `pnpm check` | PASS (38 pre-existing warnings, exit 0) |
| `pnpm test:e2e` | PASS — 4 tests including `pomodoro-cycle.spec.ts` |

Manual progress items (3.5–5.7, 4.7–4.10) are marked `[x]` in plan; audio-in-browser checks are user-attested (not machine-verifiable in CI).
