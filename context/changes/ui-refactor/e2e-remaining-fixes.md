# E2E Remaining Fixes — Context for Next Session

## Status

9 belt tests pass. ~8 still fail. All unit tests (1202) pass. Lint/typecheck clean.

### Passing specs:
- smoke.spec.ts (1)
- seed.spec.ts (2)
- session-closure.spec.ts (2)
- cycle-pause-resume.spec.ts (1)
- mid-cycle-last-task.spec.ts (1)
- pomodoro-cycle.spec.ts (2 belt tests)

### Failing specs with root causes:

---

## 1. Guest Nav Issue (guest-trial.spec.ts, guest-merge-on-sign-in.spec.ts)

**Symptom:** `clickNavFocus` times out waiting for `app-bottom-nav` or `app-sidebar` to be visible.

**Root cause:** `startFocusedWorkCycle` calls `ensureOnTasksPage` which does `page.goto("/tasks")` — a full hard navigation. After the hard nav at 390px mobile width, the bottom nav (`app-bottom-nav`, class `lg:hidden`) should be visible but either hasn't hydrated yet within the 10s timeout, or there's a rendering issue specific to the guest context after full page load.

**Fix approach:** The bottom nav IS in the DOM unconditionally (AppShell wraps all non-`/auth` routes). The issue is likely hydration timing. Options:
1. Increase timeout for the nav visibility check
2. Use `page.waitForSelector('[data-testid="app-bottom-nav"]', { state: 'visible' })` with longer timeout
3. Skip client-side nav for guest specs — use `page.goto("/focus")` directly since guest state is in localStorage (survives full page loads)

Option 3 is cleanest: guest cycle state is localStorage-based, not React context. Full page navigation won't lose it.

---

## 2. Suggestion/Kickoff Timing (session-kickoff.spec.ts, task-suggestion.spec.ts, daily-standing-capacity.spec.ts, daily-work-timing-recap.spec.ts, mindful-session-wind-down.spec.ts)

**Symptom:** `completeKickoffSteering` times out waiting for `session-energy-card`.

**Root cause:** After `page.goto("/focus")` + `page.reload()`, the steering cards require:
- `sessionStartIdleFlag` to be `true` (set by `recoverActiveCycle` after async session check)
- `kickoffEligible` → `sessionEnergyPending` → `showSessionEnergy`

The `sessionStartIdleFlag` starts as `false` and only flips after `recoverActiveCycle` completes (which calls `session.getLastEnded` — an async tRPC query). The test's `waitForResponse("cycle.getActive")` only proves ONE query resolved, not that the full recovery effect has run.

**Fix approach:**
1. Wait for `sessionStartIdleFlag` to be true before expecting steering cards. Since we can't observe React state directly, wait for a tRPC response that signals recovery is complete: `session.getLastEnded` 
2. Or add a stable "ready" signal testid to the focus page that appears only after `recoverActiveCycle` completes
3. Or use `expect.poll()` pattern: poll for `session-energy-card` with longer timeout and retries

---

## 3. Layout-Rhythm Mobile (layout-rhythm.spec.ts mobile-chromium project)

**Symptom:** `expectFocusPageReady` times out — `home-workbench-grid` not found at 375×812.

**Root cause:** Same as #2 — the focus page may render steering cards as the primary surface instead of the workbench grid. Or hydration hasn't completed within 15s at mobile viewport.

**Fix approach:** 
1. Accept `session-energy-card` as another valid "ready" signal in `expectFocusPageReady`
2. Or dismiss the steering cards before checking layout geometry

---

## 4. Fake Clock + Navigation Pattern

**Key insight:** Playwright's fake clock survives `page.goto()` (browser-level), but React's useEffect timers that fire during hydration after hard nav will be frozen. If `recoverActiveCycle` does `setTimeout(() => ..., 0)` or any delayed work, it won't fire until the clock is advanced.

**Pattern for tests:**
- **Authenticated tests:** Use client-side nav (`clickNavFocus`) after focusing a task to preserve React context state. Only use `page.goto()` before fake clock is installed.
- **Guest tests:** Can use `page.goto()` freely since guest state is in localStorage (not React context). But must ensure clock isn't installed before navigation.
- **Setup phase:** Do all `page.goto()` navigations BEFORE installing fake clock. Install fake clock only right before `clickStartCycle`.

---

## Key Files Modified This Session

### App code:
- `src/app/page.tsx` — preserves OAuth verifier param in redirect
- `src/app/_components/app-shell.tsx` — hides nav shell on /auth routes

### E2E helpers:
- `e2e/helpers/task-list-locator.ts` — new `expectFocusPageReady`, `goToTasksPage`
- `e2e/helpers/work-cycle.ts` — all task/timer helpers updated for route split
- `e2e/helpers/idle-cycle.ts` — accepts workbench-grid as idle state
- `e2e/helpers/cycle-recovery.ts` — uses expectFocusPageReady

### E2E specs (all 19 updated):
- All specs: goto "/" → "/focus", removed waitForCycleGetActive after SSR pages
- seed.spec.ts: uses createTaskViaApi for active task2
- session-kickoff.spec.ts: updated prepareSessionStartKickoff flow
- guest-trial.spec.ts, guest-merge-on-sign-in.spec.ts: navigate to /focus for banner, /tasks for list
- layout-rhythm.spec.ts: tests focus page geometry instead of task-list alignment
