# Research — fix-e2e-suggestion-ci

## Question

Why do post-check-in suggestion e2e tests fail on CI (and locally in `CI=true` production-server mode) with `suggestion-accept-btn` timeout, and why does the full suite take ~9+ minutes?

## Root cause (confirmed)

### 1. Break timer oracle mismatch (product bug in E2E mode)

Playwright installs fake timers (`page.clock`) for fast cycles. Break `endTime` was computed from **server** `startedAt`:

```typescript
breakCycle.startedAt.getTime() + breakCycle.configuredDurationSec * 1000
```

Fake `Date.now()` stays at the work-expiry instant while check-in + `suggestion.next` run on real wall time. Server `startedAt` is wall-clock. On the first `startFallbackTimer` tick, `endTime - Date.now()` is often **≤ 0** → break expires immediately → UI shows **"Break's over!"** instead of the suggestion card.

Playwright error context at failure showed `cycle-complete-overlay` with "Break's over!" and no `suggestion-accept-btn`.

### 2. `clock.install()` reset (test infra)

`advanceClockThroughFastWork` called `page.clock.install()` on every invocation, resetting fake time and invalidating active cycle timers. Second work cycle in `first-run-onboarding.spec.ts` never reached work-complete overlay.

### 3. Missing work duration on second cycle (test bug)

`first-run-onboarding.spec.ts` second cycle omitted `setWorkDurationSec(page, 1)` — work ran at default duration while clock only advanced 2.5s.

### 4. Suite duration

- CI uses `E2E_WORKERS: 1` and production `next build` (correct for stability).
- Previous ~9.3 min included **6 × ~45s** failure timeouts on suggestion tests.
- Fixed suite: **48 passed in ~6.5 min** locally (build + 1 worker). Sub-3 min needs faster server mode or parallel workers (risks Neon Auth 429 when >1 worker without throttling).

## Anchors

- `src/hooks/use-pomodoro-cycle.ts` — `startBreakAfterWorkComplete`, `cycleEndTimeMs`, `useE2eClientTimer`
- `e2e/helpers/work-cycle.ts` — `ensureFakeClock`, `advanceClockThroughFastWork`
- `e2e/helpers/suggestion.ts` — `waitForSuggestionNext`
- `src/app/_components/pomodoro-dashboard.tsx` — `showSuggestionCard` requires `isBreakRunning`
- `playwright.config.ts` — `E2E_WORKERS`, `NEXT_PUBLIC_E2E_MAIN_THREAD_TIMER`

## Fix direction

1. E2E: derive cycle `endTime` from `Date.now() + duration` when `NEXT_PUBLIC_E2E_MAIN_THREAD_TIMER=1`.
2. E2E helpers: install fake clock once per page.
3. Test: set 1s work duration on all fast cycles in first-run onboarding.
