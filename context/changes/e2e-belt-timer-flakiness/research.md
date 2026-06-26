---
date: 2026-06-24T12:00:00+02:00
researcher: Auto
git_commit: dff65549ffca0a40573b4a7330a1f51e5ba1b5c2
branch: main
repository: FlowState
topic: "Stabilize E2E belt when fast work cycles race real wall clock"
tags: [research, e2e, belt, fake-clock, work-cycle, playwright]
status: complete
last_updated: 2026-06-24
last_updated_by: Auto
---

# Research: Stabilize E2E belt when fast work cycles race real wall clock

**Date**: 2026-06-24T12:00:00+02:00  
**Researcher**: Auto  
**Git Commit**: `dff65549ffca0a40573b4a7330a1f51e5ba1b5c2`  
**Branch**: `main`  
**Repository**: [konrad-kaluzny-ceneo/FlowState](https://github.com/konrad-kaluzny-ceneo/FlowState)

## Research Question

Why does the E2E belt fail locally with 4 workers (`pnpm test:e2e:belt`) when specs use `setWorkDurationSec(1)` + `clickStartCycle`, expecting `timer-panel-running`, but snapshots show `cycle-complete-overlay` instead? How should we fix it without blocking other slices?

## Summary

Belt specs that start a **1-second work cycle** install Playwright fake timers only in `advanceClockThroughFastWork`, which calls `ensureFakeClock` **after** `clickStartCycle`. Under E2E mode (`NEXT_PUBLIC_E2E_MAIN_THREAD_TIMER=1`), cycle expiry is computed as `Date.now() + configuredDurationSec * 1000` on the client. Until `page.clock.install()` runs, `Date.now()` advances on **real wall clock**, so a 1s cycle can complete before the spec asserts `timer-panel-running` or calls `advanceClockThroughFastWork`.

The failure is **environment-sensitive**: local `next dev --turbo` under **4 parallel workers** adds enough latency between start and fake-clock advance; `E2E_WORKERS=1` passes (21/21); CI on GHA uses **`next start`** (production build) and stays green on `main`.

**Recommended fix**: call `ensureFakeClock(page)` **before** starting any fast cycle — ideally inside `clickStartCycle` (covers all direct callers and `startFocusedWorkCycle`). This is a one-line helper change plus belt verification; no product code changes required.

## Detailed Findings

### Root cause — fake clock installed too late

**E2E timer semantics** ([`use-pomodoro-cycle.ts:136-151`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/dff65549ffca0a40573b4a7330a1f51e5ba1b5c2/src/hooks/use-pomodoro-cycle.ts#L136-L151)):

```typescript
const useE2eClientTimer = process.env.NEXT_PUBLIC_E2E_MAIN_THREAD_TIMER === "1";

function cycleEndTimeMs(cycle: { ... }): number {
  if (useE2eClientTimer) {
    return Date.now() + cycle.configuredDurationSec * 1000;
  }
  return cycle.startedAt.getTime() + cycle.configuredDurationSec * 1000;
}
```

With the flag set (dev `webServer.env` and CI build — [`playwright.config.ts:80-88`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/dff65549ffca0a40573b4a7330a1f51e5ba1b5c2/playwright.config.ts#L80-L88)), work expiry tracks **client `Date.now()`**, which Playwright only controls after `page.clock.install()`.

**Helper order today** ([`e2e/helpers/work-cycle.ts`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/dff65549ffca0a40573b4a7330a1f51e5ba1b5c2/e2e/helpers/work-cycle.ts)):

| Step | Function | Fake clock? |
|------|----------|-------------|
| 1 | `setWorkDurationSec(page, 1)` | No |
| 2 | `clickStartCycle(page)` | No |
| 3 | `expect(timer-panel-running)` | **Race window** — real 1s can elapse |
| 4 | `advanceClockThroughFastWork(page)` | `ensureFakeClock` here (line 191) |

`ensureFakeClock` is idempotent per page (`WeakSet` guard, lines 22-36). `configureFastPomodoroDurations` documents the intended pairing (“pair with ensureFakeClock + advanceClockThroughFast*”, line 45) but **does not enforce it** and is unused in specs.

### Failure signature

- **Expected**: `timer-panel-running` visible after start.
- **Actual**: `cycle-complete-overlay` (work cycle already completed on wall clock).
- **Repro**: `set CI=true && pnpm test:e2e:belt` locally, default 4 workers, Playwright-managed `next dev --turbo`.
- **Mitigation**: `set E2E_WORKERS=1` → 21/21 pass (per `change.md`).

### Why CI stays green while local dev flakes

| Factor | Local default | CI (GHA) |
|--------|---------------|----------|
| Server | `next dev --turbo` ([`playwright.config.ts:37`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/dff65549ffca0a40573b4a7330a1f51e5ba1b5c2/playwright.config.ts#L37)) | `next start` after `pnpm build` |
| Load | 4 workers hammer one dev server | Pre-built prod server, same 4 workers |
| Timer flag | Injected via `webServer.env` | Baked at build time (`ci.yml` / `e2eBuildEnv`) |

Dev turbo mode under parallel load increases the gap between `clickStartCycle` and `advanceClockThroughFastWork` beyond 1s. Production `next start` is faster and more deterministic, masking the race.

### Affected belt specs (fast 1s work)

Two patterns share the same race:

**Pattern A — inline start** (`setWorkDurationSec(1)` → `clickStartCycle` → assert running → advance):

| Spec | Belt test | `resetFakeClock` in `beforeEach` |
|------|-----------|----------------------------------|
| [`e2e/task-suggestion.spec.ts`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/dff65549ffca0a40573b4a7330a1f51e5ba1b5c2/e2e/task-suggestion.spec.ts) | shows suggestion… (lines 63-68) | Yes (line 45) |
| [`e2e/daily-work-timing-recap.spec.ts`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/dff65549ffca0a40573b4a7330a1f51e5ba1b5c2/e2e/daily-work-timing-recap.spec.ts) | recap row… (lines 54-59) | Yes |
| [`e2e/daily-standing-capacity.spec.ts`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/dff65549ffca0a40573b4a7330a1f51e5ba1b5c2/e2e/daily-standing-capacity.spec.ts) | capacity-fit standing… (lines 84-89) | Yes |

**Pattern B — `startFocusedWorkCycle(page, title, 1)`** (sets 1s work+break, `clickStartCycle`, asserts running inside helper at lines 155-158):

| Spec | Belt test | `resetFakeClock` in `beforeEach` |
|------|-----------|----------------------------------|
| [`e2e/pomodoro-cycle.spec.ts`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/dff65549ffca0a40573b4a7330a1f51e5ba1b5c2/e2e/pomodoro-cycle.spec.ts) | focus/start/complete; break re-entry (lines 43-44, 74-75) | **No** |
| [`e2e/seed.spec.ts`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/dff65549ffca0a40573b4a7330a1f51e5ba1b5c2/e2e/seed.spec.ts) | R7 check-in gate (lines 79-80) | **No** (`forgetFakeClock` only) |
| [`e2e/session-return-handoff.spec.ts`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/dff65549ffca0a40573b4a7330a1f51e5ba1b5c2/e2e/session-return-handoff.spec.ts) | continue row… (lines 39-42) | **No** |

**Pattern C — API seed (no UI start race)** — belt wind-down tests seed a RUNNING cycle via tRPC, reload, `resetFakeClock`, then `ensureFakeClock` before advance ([`mindful-session-wind-down.spec.ts:58-66`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/dff65549ffca0a40573b4a7330a1f51e5ba1b5c2/e2e/mindful-session-wind-down.spec.ts#L58-L66), [`seed-scenario.ts:250-263`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/dff65549ffca0a40573b4a7330a1f51e5ba1b5c2/e2e/helpers/seed-scenario.ts#L250-L263)). These avoid the `clickStartCycle` race.

**Highest-risk specs**: Pattern B files without `resetFakeClock` in `beforeEach` (`pomodoro-cycle`, `seed` R7, `session-return-handoff`). Pattern A specs pre-install fake clock in `beforeEach` but still call `clickStartCycle` without guaranteeing clock state immediately before start — fixing the helper centralizes the contract.

### `mindful-session-wind-down` — correction to proposed pattern

`change.md` cites `mindful-session-wind-down.spec.ts` as the pattern source. In code:

- `startFastWorkCycle` (lines 45-56) does **not** call `ensureFakeClock` before `clickStartCycle` — same race as other specs (`@skip-belt` only).
- `seedFatigueAndAdvanceToWindDownGate` calls `ensureFakeClock` **before `advanceClockThroughFastWork`**, not before UI start, because the cycle is already RUNNING from API seed.

The durable pattern to copy is: **fake clock must be active before the cycle timer starts counting**, either via API seed + early install, or (for UI starts) `ensureFakeClock` before `clickStartCycle`.

### Recommended fix options (ranked)

1. **Add `await ensureFakeClock(page)` at the start of `clickStartCycle`** ([`work-cycle.ts:110`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/dff65549ffca0a40573b4a7330a1f51e5ba1b5c2/e2e/helpers/work-cycle.ts#L110)) — single choke point; fixes Pattern A and B; idempotent with existing `beforeEach` `resetFakeClock` calls.
2. **Also add to `startFocusedWorkCycle` before `clickStartCycle`** — redundant if (1) is done, since helper calls `clickStartCycle`.
3. **Per-spec `ensureFakeClock` before start** — scattered, easy to miss on new specs; not recommended.
4. **Require `resetFakeClock` in every belt `beforeEach`** — partial mitigation only; does not guarantee clock immediately before start after long setup phases.

**Non-goals**: Changing `FAST_WORK_CLOCK_MS` (2500ms buffer is adequate once clock is installed); changing product `cycleEndTimeMs` (correct for E2E determinism per `fix-e2e-suggestion-ci`).

### Verification plan

```powershell
set CI=true && pnpm test:e2e:belt
set E2E_WORKERS=4 && set CI=true && pnpm test:e2e:belt
set E2E_PRODUCTION_SERVER=1 && set CI=true && pnpm test:e2e:belt
```

Success criteria: 21/21 belt tests green at 4 workers on local dev server after helper change.

## Code References

- [`e2e/helpers/work-cycle.ts:29-36`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/dff65549ffca0a40573b4a7330a1f51e5ba1b5c2/e2e/helpers/work-cycle.ts#L29-L36) — `ensureFakeClock` (single install per page)
- [`e2e/helpers/work-cycle.ts:110-117`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/dff65549ffca0a40573b4a7330a1f51e5ba1b5c2/e2e/helpers/work-cycle.ts#L110-L117) — `clickStartCycle` (no clock today)
- [`e2e/helpers/work-cycle.ts:125-158`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/dff65549ffca0a40573b4a7330a1f51e5ba1b5c2/e2e/helpers/work-cycle.ts#L125-L158) — `startFocusedWorkCycle` with 1s duration
- [`e2e/helpers/work-cycle.ts:190-193`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/dff65549ffca0a40573b4a7330a1f51e5ba1b5c2/e2e/helpers/work-cycle.ts#L190-L193) — `advanceClockThroughFastWork` (clock install today)
- [`src/hooks/use-pomodoro-cycle.ts:136-151`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/dff65549ffca0a40573b4a7330a1f51e5ba1b5c2/src/hooks/use-pomodoro-cycle.ts#L136-L151) — E2E client-relative `cycleEndTimeMs`
- [`playwright.config.ts:33-37`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/dff65549ffca0a40573b4a7330a1f51e5ba1b5c2/playwright.config.ts#L33-L37) — dev vs prod webServer command
- [`e2e/README.md`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/dff65549ffca0a40573b4a7330a1f51e5ba1b5c2/e2e/README.md) — env vars, workers, server modes

## Architecture Insights

- E2E **trades production fidelity for determinism**: main-thread timer + Playwright `page.clock` (documented in `test-plan.md` §6.3, `testing-critical-path-persistence-timer` research).
- Fake clock helpers follow a **install-once** contract (`ensureFakeClock` + `forgetFakeClock` on reload) established in `fix-e2e-suggestion-ci` after repeated `clock.install()` broke multi-cycle specs.
- Belt specs use **1s work** for speed; the 2500ms `runFor` buffer covers completion ticks once fake time advances.
- **API seeding** (`seedWindDownFatigueScenario`) is the alternative pattern for scenarios that need a RUNNING cycle without UI-start latency.

## Historical Context (from prior changes)

- [`context/archive/2026-06-09-fix-e2e-suggestion-ci/research.md`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/dff65549ffca0a40573b4a7330a1f51e5ba1b5c2/context/archive/2026-06-09-fix-e2e-suggestion-ci/research.md) — introduced `ensureFakeClock`, client-relative `cycleEndTimeMs`, and fixed repeated `clock.install()` resets.
- [`context/archive/2026-06-09-fix-e2e-suggestion-ci/plan.md`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/dff65549ffca0a40573b4a7330a1f51e5ba1b5c2/context/archive/2026-06-09-fix-e2e-suggestion-ci/plan.md) — shipped helper hardening + CI build-time timer flag.
- [`context/archive/2026-06-10-testing-e2e-belt-fast/`](https://github.com/konrad-kaluzny-ceneo/FlowState/tree/dff65549ffca0a40573b4a7330a1f51e5ba1b5c2/context/archive/2026-06-10-testing-e2e-belt-fast) — 4-worker auth pool, belt script, CI `next start`; reversed earlier `E2E_WORKERS=1` CI default.
- [`context/archive/2026-06-04-testing-critical-path-persistence-timer/research.md`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/dff65549ffca0a40573b4a7330a1f51e5ba1b5c2/context/archive/2026-06-04-testing-critical-path-persistence-timer/research.md) — rationale for `NEXT_PUBLIC_E2E_MAIN_THREAD_TIMER` and fake-clock-based E2E.

## Related Research

- `context/archive/2026-06-09-fix-e2e-suggestion-ci/research.md` — prior fake-clock + break-expiry fix (adjacent, shipped)
- `context/foundation/repo-map-analysis/research.md` — timer hub E2E harness overview
- `context/foundation/test-plan.md` §6.3 — belt cookbook and helper inventory

## Open Questions

1. Should `e2e/README.md` §helpers explicitly state “call `ensureFakeClock` before any cycle start with duration ≤ few seconds” after the fix lands?
2. Does `startFastWorkCycle` in `mindful-session-wind-down.spec.ts` (`@skip-belt`) deserve the same fix for full-catalog stability, or is helper-level `clickStartCycle` enough?
3. Worth adding a belt regression comment on `clickStartCycle` pointing to this change-id to prevent future specs from bypassing the helper?
