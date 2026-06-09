# Plan — fix-e2e-suggestion-ci

## Overview

Fix deterministic post-check-in suggestion e2e failures on CI by aligning break timer expiry with Playwright fake clocks, and harden e2e clock helpers.

## Progress

- [x] 1.1 Add `cycleEndTimeMs` for E2E main-thread timer mode in `use-pomodoro-cycle.ts`
- [x] 1.2 `ensureFakeClock` — single `clock.install()` per page in `e2e/helpers/work-cycle.ts`
- [x] 1.3 Fix `first-run-onboarding.spec.ts` second-cycle work duration + `ensureFakeClock` before 31s break advance
- [x] 2.1 Verify `pnpm test` + full `CI=true E2E_WORKERS=1 pnpm test:e2e` (48/48)

## Verification

```powershell
cd d:\repos\10xdev\FlowState; pnpm check; pnpm test
$env:CI='true'; $env:E2E_WORKERS='1'; pnpm test:e2e
```

## Notes on 3-minute target

Production-server e2e with 48 serial tests and cold build is ~6–7 min when green. The prior ~9 min was inflated by 30s timeouts on 6 failing tests. Parallel workers reduce wall time but triggered Neon Auth 429 locally; keep `E2E_WORKERS=1` in CI until auth throttling is addressed.
