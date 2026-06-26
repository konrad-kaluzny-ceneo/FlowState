# Stabilize E2E Belt Timer Flakiness — Plan Brief

> Full plan: `context/changes/e2e-belt-timer-flakiness/plan.md`
> Research: `context/changes/e2e-belt-timer-flakiness/research.md`

## What & Why

Belt E2E fails locally at 4 workers when specs start 1-second work cycles: the client timer counts on real wall clock until Playwright fake timers install, so cycles complete before assertions see `timer-panel-running`. We fix the race at the shared helper choke point so local `next dev --turbo` matches CI determinism without lowering worker count.

## Starting Point

`NEXT_PUBLIC_E2E_MAIN_THREAD_TIMER=1` makes `cycleEndTimeMs` use client `Date.now()`. `clickStartCycle` starts cycles immediately; `ensureFakeClock` runs only later in `advanceClockThroughFastWork`. Under parallel dev-server load, >1s elapses between start and advance. `ensureFakeClock` is idempotent per page; several specs already `resetFakeClock` in `beforeEach` but that does not guarantee clock state immediately before Start Cycle after long setup.

## Desired End State

`set CI=true && pnpm test:e2e:belt` passes 21/21 at 4 workers on local dev without `E2E_WORKERS=1`. All UI cycle starts go through `clickStartCycle` with fake timers active before the Start Cycle click. README documents the contract for API-seed vs UI-start paths.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| -------- | ------ | ---------------- | ------ |
| Fix location | `ensureFakeClock` at start of `clickStartCycle` | Single choke point fixes Pattern A + B belt specs and wind-down helper callers | Research |
| Product code | No changes | Race is test harness ordering, not timer semantics | Research |
| `resetFakeClock` in specs | Helper fix only — no spec edits | Idempotent clock + centralized install makes per-spec reset unnecessary for this bug | Research |
| Verification gate | Belt at 4 workers on dev server | Reproduces reported failure mode; CI already green on `next start` | Research |
| Documentation | `e2e/README.md` Notes bullet only | Narrow contract; test-plan §6.3 already lists helpers | Plan |
| `FAST_WORK_CLOCK_MS` | Unchanged (2500ms) | Adequate once clock is installed before start | Research |

## Scope

**In scope:**
- `await ensureFakeClock(page)` at top of `clickStartCycle`
- JSDoc on `clickStartCycle` + aligned comment on `configureFastPomodoroDurations`
- `e2e/README.md` fake-clock-before-start note
- Belt verification at 4 workers

**Out of scope:**
- `use-pomodoro-cycle.ts` / timer flag changes
- Per-spec `ensureFakeClock` or mandatory `resetFakeClock` in all belt files
- `test-plan.md` cookbook update
- Full e2e catalog as PR gate
- `E2E_WORKERS=1` CI default

## Architecture / Approach

```
setWorkDurationSec(1) ──► clickStartCycle ──► [NEW: ensureFakeClock] ──► Start Cycle click
                                                              │
                                                              ▼
                                                    Date.now() frozen until advanceClockThroughFastWork
```

API-seed flows (wind-down belt) already call `ensureFakeClock` before advance on a pre-RUNNING cycle — unchanged. UI-start flows gain clock install at the only shared entry point.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Helper choke-point fix | `clickStartCycle` installs fake clock before start | None significant — `WeakSet` idempotency handles existing `resetFakeClock` hooks |
| 2. Docs + belt verification | README contract + 21/21 belt at 4 workers | Belt runtime ~minutes; dev server must be free on port 3001 |

**Prerequisites:** Feature branch `features/e2e-belt-timer-flakiness`; Neon `.env` for auth pool (standard E2E setup).

**Estimated effort:** ~1 session, 2 short phases.

## Open Risks & Assumptions

- Assumes no spec clicks Start Cycle without `clickStartCycle` in belt paths — grep shows all belt UI starts use the helper.
- Full-catalog specs (`@skip-belt`, e.g. `break-out-of-tab-alert`) benefit from the fix but are not gated in this PR.
- If a future spec calls `page.clock.install()` manually before `clickStartCycle`, behavior remains correct (no-op via `WeakSet`).

## Success Criteria (Summary)

- Belt green at 4 workers on local `next dev --turbo` (21/21).
- No product or CI workflow changes required.
- Future authors see README + JSDoc contract for fake-clock ordering.
