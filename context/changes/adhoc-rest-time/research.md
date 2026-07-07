---
date: 2026-07-06T13:29:24+0200
researcher: Konrad Zieliński
git_commit: 47cd97e38d8c6b75583bdc1883f372b5fc56b517
branch: main
repository: FlowState
topic: "Ad-hoc break from idle + break-overtime-until-accept (all breaks)"
tags: [research, codebase, pomodoro-cycle, timer-worker, breaks, wedge, data-mode, i18n]
status: complete
last_updated: 2026-07-06
last_updated_by: Konrad Zieliński
---

# Research: Ad-hoc break from idle + break-overtime-until-accept

**Date**: 2026-07-06T13:29:24+0200
**Researcher**: Konrad Zieliński
**Git Commit**: 47cd97e38d8c6b75583bdc1883f372b5fc56b517
**Branch**: main
**Repository**: FlowState

## Research Question

Ground the implementation of the `adhoc-rest-time` change (see [frame.md](context/changes/adhoc-rest-time/frame.md)), which bundles two coupled concerns into one change:

- **Concern A** — a *persistent idle "Start break" quick action* (user picks short/long) whose end lands in the normal post-break kickoff beat, without punishing the user.
- **Concern B** — *all* breaks keep counting into **overtime** past their configured duration and only end on an explicit user accept.

This doc goes deeper than the frame on: the timer/overtime seams (B), the exact UI mount + break picker, the two-data-mode wiring for a new `startAdHocBreak` action, and the test/i18n surface.

## Summary

- **Concern A is a thin, additive change.** `startBreakAfterWorkComplete` ([use-pomodoro-cycle.ts:2418](src/hooks/use-pomodoro-cycle.ts:2418)) is a near-perfect template for a new `startAdHocBreak(kind)` action — the *only* step to drop is the cadence increment `setCompletedWorkCycles(newCount)`. A break creates cleanly from idle in **both** data modes (session auto-bootstraps), and `cycles.create` never touches any penalty counter. No optimistic/wedge machinery is needed — the plain-await path is correct.
- **Concern B is a localized-but-load-bearing state-machine change.** Overtime requires editing **three parallel `remaining <= 0` expiry sites** in lockstep, introducing a new "break running past end / awaiting accept" state that today collapses into `state === "completed"`, a sign-aware timer formatter, and — the sharpest semantic collision — **retiring or re-messaging the `BREAK_CONFIRM` catch-up gate**, which currently assumes a break *ended* at its configured time.
- **Recap/stats are overtime-safe.** Everything downstream of break duration (focused-minutes, day-plan budget, recap) filters by `kind === "WORK"`; breaks contribute nothing. The server already stamps `endedAt = new Date()` at accept time.
- **Test + i18n surface is well-bounded.** Two locales (`en`/`pl`); the `CycleComplete`/`CatchUp` namespaces already hold the break copy to extend. A cluster of ~20 break tests in `use-pomodoro-cycle.test.tsx` plus `format-remaining`, `derive-gate`, `cycle-complete-overlay`, and `quick-actions` tests are the oracles to update.

---

## Detailed Findings

### A. New `startAdHocBreak(kind)` action — wiring

**Template**: `startBreakAfterWorkComplete` ([use-pomodoro-cycle.ts:2418-2470](src/hooks/use-pomodoro-cycle.ts:2418)). Step-by-step keep/skip:

| Step (line) | Ad-hoc action |
| --- | --- |
| `setCompletedWorkCycles(newCount)` (2420-2421) | **SKIP** — the punishing step; must never run. |
| `breakKind` from `newCount % 4` (2423-2424) | **REPLACE** — kind comes from the `kind` argument. |
| duration via `getShort/getLongBreakDuration()` (2425-2428) | **KEEP** — select by passed `kind`. |
| `await cycles.create({ kind, configuredDurationSec })` (2430-2433) | **KEEP** — identical, no `taskId`/`intention`. |
| `cycleEndTimeMs` → `setActiveCycle({...,task:null})` / `setCycleKind` / `cycleKindRef` / `setState("running")` / `stateRef` / `startWorker` (2435-2442) | **KEEP** — verbatim state reconcile. |
| `fireBreakOutOfTabAlert(kind, id)` (2443, body [714-744](src/hooks/use-pomodoro-cycle.ts:714)) | **KEEP** — pure audio/notification, no counters. |
| `showBreakTransitionLine(kind)` (2444, body [1207](src/hooks/use-pomodoro-cycle.ts:1207)) | **KEEP** — pure UI line. |
| `invalidateServerCycle()` (2447) | **KEEP — mandatory** so `getActive`/guest store re-reads the break. |
| `invalidateDayPlan`/`invalidateDailyRecap` (2448-2449) | Harmless no-ops for breaks — keep or drop. |
| `markTaskDone` → `task.list.invalidate` (2450) | **DROP** — ad-hoc break completes no task. |
| `refreshNarrativeStats` (2453-2455) | **OPTIONAL** — read-only; not required. |

**Idle prologue (from idle, unlike the mid-session template)**: mirror the WORK-start idle prologue ([use-pomodoro-cycle.ts:2029-2056](src/hooks/use-pomodoro-cycle.ts:2029)) minus the penalty: `const session = await sessions.getOrCreateActive(); setActiveSessionId(session.id); setHasActiveSession(true);` **before** create. Wrap in try/catch with rollback to idle (pattern at [1968-1979](src/hooks/use-pomodoro-cycle.ts:1968)) since this is a non-optimistic await path.

**Optimistic/wedge machinery is NOT needed.** `allocateOptimisticCycleId` ([240](src/hooks/use-pomodoro-cycle.ts:240)), `pendingBreakCreateRef`, `computeBreakAfterWork` ([245](src/hooks/use-pomodoro-cycle.ts:245)), and the `retryBreakCreateAfterCheckIn`/wedge-intent recovery exist only because `continueAfterCheckIn` (~[2739-2914](src/hooks/use-pomodoro-cycle.ts:2739)) chains three fallible calls (`createCheckIn` → `complete(WORK)` → `create(break)`). An idle break is a single `cycles.create` — use the plain path.

### A2. "Do NOT touch" counters (non-punishing rule, D6)

1. **`completedWorkCycles` / `computeBreakAfterWork`** — cadence counter (incremented at 2420, 2513, 2761; reset at 2040). Never call `setCompletedWorkCycles`; never use `computeBreakAfterWork` (does `+1`).
2. **`interruptionCount`** (session) — only bumped server-side by `cycles.complete({incrementInterruption})` ([cycle.ts:255](src/server/api/routers/cycle.ts:255)) and `cycles.rebindTask` ([cycle.ts:341-347](src/server/api/routers/cycle.ts:341)). `cycles.create` never touches it → safe as long as the action calls only `create`. Do not set `pendingIncrementInterruptionRef`.
3. **Day-plan focus minutes** — `incrementUsedFocusMinutes` fires only for `kind === "WORK"` ([cycle.ts:230-249](src/server/api/routers/cycle.ts:230)).
4. **Recap focused-minutes** — `computeCycleFocusedMinutes` returns 0 for non-WORK ([compute-cycle-focused-minutes.ts:11-13](src/lib/recap/compute-cycle-focused-minutes.ts:11)).
5. **Wind-down** — `shouldShowWindDownNudge`/`effectiveWorkCyclesAtCheckIn` read the two counters above; untouched → cadence stays correct.

### A3. Two-mode create + session bootstrap

- **Interface**: `CycleRepository.create` ([data-mode/types.ts:127-134](src/lib/data-mode/types.ts:127)); `SessionRepository.getOrCreateActive` ([types.ts:154](src/lib/data-mode/types.ts:154)).
- **Auth**: `server-repositories.ts:177-183` → `client.cycle.create.mutate` → router `create` ([cycle.ts:80-181](src/server/api/routers/cycle.ts:80)). `sessionId` optional; omitted → `findOrCreateActiveSession` ([cycle.ts:95-97](src/server/api/routers/cycle.ts:95)). Only guard: rejects if a RUNNING/PAUSED cycle exists ([cycle.ts:124-136](src/server/api/routers/cycle.ts:124)) — fine from idle. **No preceding-work guard.**
- **Guest**: `guest-repositories.ts:601-658` self-bootstraps — calls `getOrCreateActive()` ([:602](src/lib/repositories/guest-repositories.ts:602)) then creates; same "already running" guard ([:610-615](src/lib/repositories/guest-repositories.ts:610)).
- **Asymmetry**: guest `create` self-creates the session; auth `create` self-creates server-side but the hook's `_activeSessionId` is **not** set as a side effect — so the hook must call `sessions.getOrCreateActive()` + `setActiveSessionId` itself (as WORK-start does) for both modes. `invalidateServerCycle` ([587-593](src/hooks/use-pomodoro-cycle.ts:587)) = authed `cycle.getActive.invalidate()` / guest `refreshGuest()`.

### A4. UI mount + break picker

- **Primary mount** — `QuickActions` ([quick-actions.tsx:14-114](src/app/_components/quick-actions.tsx:14)), rendered in the calm rail at [pomodoro-dashboard.tsx:999-1005](src/app/_components/pomodoro-dashboard.tsx:999) (`calmWidgetsRail`, gated by `showCalmLanding`). Today it holds two items (`addTask` button, `planDay` link); a third "Start break" item fits the existing `icon + label + chevron` pattern. This is the natural **persistent, any-idle-state** home (matches the user's "any idle state" answer).
- **Secondary mount** — inside `FocusReadyState` ([pomodoro-dashboard.tsx:1046-1085](src/app/_components/pomodoro-dashboard.tsx:1046)) / `FocusEmptyState` ([:1042](src/app/_components/pomodoro-dashboard.tsx:1042)), parallel to the work kickoff duration picker.
- **Break kind/duration picker** — reuse `DurationPicker` ([duration-picker.tsx:53-168](src/app/_components/duration-picker.tsx:53)); presets from `getShortBreakPresets`/`getLongBreakPresets` ([duration-bounds.ts:43-62](src/lib/duration-bounds.ts:43)); durations from `getShort/getLongBreakDuration` ([duration-storage.ts:58-140](src/lib/duration-storage.ts:58)). Settings already pairs short/long pickers ([ustawienia-view.tsx:324-354](src/app/_components/ustawienia-view.tsx:324)) — mirror for a short/long toggle.
- **Dashboard→hook wiring convention** — dashboard calls `pomodoro.start(durationSec)` via `handleStartWithPermission` ([pomodoro-dashboard.tsx:274-285](src/app/_components/pomodoro-dashboard.tsx:274)); a new `startAdHocBreak(kind)` should be exported alongside `start`/`interrupt`/`pause` in the hook's return (~[3650-3747](src/hooks/use-pomodoro-cycle.ts:3650)) and wired the same way. Note: the break bypasses the focus-permission prompt (that gate is for WORK start).

### B. Overtime-until-accept (all breaks)

**Current hard stop**: `getTimerTickResult` returns `{type:"complete"}` when `remaining <= 0` ([timer-worker-logic.ts:14](src/workers/timer-worker-logic.ts:14)); outbound type is only `tick|complete` ([:5-7](src/workers/timer-worker-logic.ts:5)). The worker clears its interval on complete ([timer-worker.ts:28-32](src/workers/timer-worker.ts:28)).

**Three parallel `remaining <= 0` expiry sites that must change in lockstep:**
1. Worker: `getTimerTickResult` ([timer-worker-logic.ts:14](src/workers/timer-worker-logic.ts:14)) + worker stop-on-complete ([timer-worker.ts:28-32](src/workers/timer-worker.ts:28)).
2. Main-thread fallback: `startFallbackTimer` tick ([use-pomodoro-cycle.ts:772-775](src/hooks/use-pomodoro-cycle.ts:772)).
3. Tab-return recompute: `recalculateFromEndTime` ([use-pomodoro-cycle.ts:830-831](src/hooks/use-pomodoro-cycle.ts:830)).

**State-machine pivot**: `handleCycleExpired` ([:688-712](src/hooks/use-pomodoro-cycle.ts:688)) does `setState("completed")` (697), `endTimeRef=null` (695), `endedAtMs = endTimeRef` = *configured* end (692). For breaks under overtime this must **not** auto-complete — keep `endTimeRef`, keep a timer alive, count up. `state === "completed"` is the pivot every consumer keys on (overlay [cycle-complete-overlay.tsx:44](src/app/_components/cycle-complete-overlay.tsx:44), catch-up gate, kickoff eligibility), so overtime introduces a genuinely new state that today collapses into `completed`.

**Accept path**: overlay "Continue" → `onConfirm(false)` ([cycle-complete-overlay.tsx:98](src/app/_components/cycle-complete-overlay.tsx:98)) → `confirmComplete` ([:2548-2645](src/hooks/use-pomodoro-cycle.ts:2548)), break `else` branch ([:2603-2629](src/hooks/use-pomodoro-cycle.ts:2603)) → `postBreakIdleFlag`/kickoff. The accept remains the true end; a new "End break" affordance shown *during* overtime wires to the same `confirmComplete`.

**Display**: `formatRemainingMs` clamps with `Math.max(0, …)` ([format-remaining.ts:2](src/lib/format-remaining.ts:2)) — structurally cannot show overtime; needs a sign-aware / `+MM:SS` variant. `timer-panel.tsx` computes progress ([:105](src/app/_components/timer-panel.tsx:105)) and renders `formatRemainingMs(remainingMs)` ([:148](src/app/_components/timer-panel.tsx:148)) — both need overtime handling.

**Recovery**: `resumeFromActiveCycle` forces `completed` + `setCatchUpFromExpiry` when `endTime <= Date.now()` ([:863-878](src/hooks/use-pomodoro-cycle.ts:863)) — for a break this must become "resume in overtime."

### B2. Catch-up gate — the semantic collision (highest B risk)

`setCatchUpFromExpiry` hard-codes `state:"completed"` ([:669](src/hooks/use-pomodoro-cycle.ts:669)) and passes the *configured*-end `endedAtMs`; `deriveCatchUpGate` returns **`BREAK_CONFIRM`** for a completed break ([derive-gate.ts:32-34](src/lib/catch-up/derive-gate.ts:32)); `formatEndedAgo` renders "X ago" ([format-ended-ago.ts:10-25](src/lib/catch-up/format-ended-ago.ts:10)); consumed at [pomodoro-dashboard.tsx:485-490](src/app/_components/pomodoro-dashboard.tsx:485). Under overtime a break **never auto-ends**, so `BREAK_CONFIRM` ("ended N ago while you were away") is semantically wrong — it must be retired for breaks or re-messaged as "still on break (overtime N) — end it?", with a `formatEndedAgo` overtime counterpart.

### B3. Stats/recap — overtime-safe (LOW risk)

- `cycles.complete` stamps `endedAt = new Date()` at mutation/accept time ([cycle.ts:204,213](src/server/api/routers/cycle.ts:204)) — already the accept instant, no DB change needed.
- `computeCycleFocusedMinutes` excludes non-WORK and clamps WORK to `configuredDurationSec` ([:11-24](src/lib/recap/compute-cycle-focused-minutes.ts:11)).
- Guest recap filters `kind !== "WORK"` ([guest/recap.ts:164-172](src/lib/guest/recap.ts:164)). **Nothing downstream cares about break duration.** Caveat: the new flow must still call `cycles.complete` at accept so `endedAt` lands correctly.

### C. Test + i18n surface

**i18n** — two locales: [messages/en.json](messages/en.json), [messages/pl.json](messages/pl.json). Existing break copy to extend:
- `CycleComplete`: `breakHeading`, `breakReentryFallback`, `breakContinueWithTask`, `breakContinue` ([en.json:491-495](messages/en.json:491)).
- Break re-entry lines `breakReentryFocused/Steady/Fading/Neutral` ([en.json:65-68](messages/en.json:65)).
- `CatchUp.shortBreak`/`longBreak` ([en.json:121-122](messages/en.json:121)); Settings `shortBreakLabel`/`longBreakLabel` ([en.json:732-733](messages/en.json:732)).
- **New keys needed** (× both locales): a QuickActions "Start break" label + short/long pick labels (can reuse `CatchUp`/Settings break labels), an overtime display string (e.g. "On break · +{minutes} over") and an "End break" accept label distinct from the current `breakContinue`.

**Tests that lock current behavior (oracles to update / extend):**
- `use-pomodoro-cycle.test.tsx` — break cluster incl. `"break complete returns to idle"` ([:1203](src/hooks/use-pomodoro-cycle.test.tsx:1203)), `"after 4th work cycle, long break triggers"` ([:1137](src/hooks/use-pomodoro-cycle.test.tsx:1137)), `"WORK cycle-end requires check-in before break starts"` ([:1623](src/hooks/use-pomodoro-cycle.test.tsx:1623)), `"break cycle-end skips check-in gate"` ([:2026](src/hooks/use-pomodoro-cycle.test.tsx:2026)), break-transition-line describe ([:1686](src/hooks/use-pomodoro-cycle.test.tsx:1686)), out-of-tab alerts ([:4377](src/hooks/use-pomodoro-cycle.test.tsx:4377)), optimistic break start/drift ([:3278](src/hooks/use-pomodoro-cycle.test.tsx:3278), [:4850](src/hooks/use-pomodoro-cycle.test.tsx:4850)). The `completed→idle` transition tests are the ones B changes most.
- `format-remaining.test.ts` — extend for sign-aware overtime.
- `catch-up/derive-gate.test.ts` — `BREAK_CONFIRM` cases ([:28-47](src/lib/catch-up/derive-gate.test.ts:28)) change under overtime.
- `cycle-complete-overlay.test.tsx` — break-overlay/accept assertions.
- `quick-actions.test.tsx` — extend for the new "Start break" action.
- `transition-copy.test.ts`, `break-atmosphere.test.ts` — verify no regression (both key on `cycleKind` only).

**Test layer guidance (lessons L-06 / "Test every wedge transition")**: drive B's state-machine + overtime logic at the **hook/component layer** (`renderHook`, mocked-hook overlay renders), not multi-cycle e2e. Every new gate/overlay beat needs a dismiss oracle. `NEXT_PUBLIC_E2E_MAIN_THREAD_TIMER` ([use-pomodoro-cycle.ts:164](src/hooks/use-pomodoro-cycle.ts:164)) forces the main-thread fallback timer in E2E — the overtime change must keep this path working.

## Code References

- `src/hooks/use-pomodoro-cycle.ts:2418` — `startBreakAfterWorkComplete` (template for `startAdHocBreak`)
- `src/hooks/use-pomodoro-cycle.ts:688` — `handleCycleExpired` (the `completed` pivot to change for overtime)
- `src/hooks/use-pomodoro-cycle.ts:666` — `setCatchUpFromExpiry` (hard-coded `state:"completed"`)
- `src/hooks/use-pomodoro-cycle.ts:772` / `:830` — fallback + recalculate expiry twins
- `src/workers/timer-worker-logic.ts:14` — the `remaining <= 0 → complete` guard
- `src/workers/timer-worker.ts:28` — worker stop-on-complete
- `src/lib/format-remaining.ts:2` — `Math.max(0,…)` clamp (blocks overtime display)
- `src/lib/catch-up/derive-gate.ts:32` — `BREAK_CONFIRM` gate
- `src/server/api/routers/cycle.ts:80` — `cycle.create` (no preceding-work guard); `:204` `endedAt=new Date()`
- `src/lib/repositories/guest-repositories.ts:601` / `server-repositories.ts:177` — two-mode create
- `src/app/_components/quick-actions.tsx:14` — primary mount for "Start break"
- `src/app/_components/duration-picker.tsx:53` — kind/duration picker to reuse
- `src/app/_components/cycle-complete-overlay.tsx:44` — break accept overlay
- `messages/en.json:491` / `pl.json:491` — `CycleComplete` break copy to extend

## Architecture Insights

- **The break lifecycle is uniformly keyed on `cycleKind`**, which is why an ad-hoc break rides existing rails with almost no new plumbing — the *only* place that assumes "break follows work" is the cadence counter.
- **`state === "completed"` is overloaded**: it currently means both "work done, awaiting check-in" and "break done, awaiting continue." Overtime forces a conceptual split — a break past its configured end is *still running*, not completed. This is the core design tension of Concern B.
- **Optimism is scoped to fallible multi-step transitions**, not to every start. A single-mutation idle break correctly uses the plain-await path; adding optimism would be cargo-culting.
- **Breaks are deliberately excluded from all productivity accounting** (`kind === "WORK"` filters everywhere) — consistent with PRODUCT.md's "calm, not throughput" stance and the user's "don't punish" requirement.

## Historical Context (from prior changes)

- [context/changes/adhoc-rest-time/frame.md](context/changes/adhoc-rest-time/frame.md) — the framing that scoped A+B into one change; this research confirms and extends its dimension map (esp. D5 overtime and D6 non-punishing).
- `context/foundation/lessons.md` — "Test every wedge transition before shipping transition logic changes" and **L-06** (demote >15s multi-cycle e2e to hook/integration tests) directly govern how B must be tested.

## Related Research

- None prior for this change beyond `frame.md`. No existing `research.md` under `context/changes/**` or `context/archive/**` covers the timer/overtime path.

## Open Questions

1. **`BREAK_CONFIRM` under overtime** — retire it for breaks, or re-message as "still on break (overtime) — end it?" Needs a product-copy decision (affects `derive-gate`, `format-ended-ago`, catch-up copy).
2. **Overtime cap** — should overtime count unbounded, or cap (mirroring `PAUSE_CAP_MS`)? Unbounded overtime + a hidden tab could count for hours; the frame/answers imply "count until accept" but a sane cap may be warranted.
3. **Does overtime apply while paused?** Breaks can be paused ([cycle.ts:401](src/server/api/routers/cycle.ts:401)); interaction of pause with overtime is unspecified.
4. **Ad-hoc break kind default** — the user chose "user picks," but the QuickActions single-tap affordance may still want a default (short) vs always opening the picker.
5. **Server duration validation** is not kind-aware ([cycle.ts:85](src/server/api/routers/cycle.ts:85)) — pre-existing; fold a kind-aware bound into this change or leave as-is?
