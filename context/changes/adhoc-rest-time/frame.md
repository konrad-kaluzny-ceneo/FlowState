# Frame Brief: Ad-hoc break + break-overtime-until-accept

> Framing step before /10x-plan. Captures what is *actually* at issue,
> separated from what was initially assumed.

## Reported Observation

The user sometimes ends up idle with no cycle running ("cykl się przypadkiem
wyłączył"), outside the normal work→break rhythm, and has no way to take a break
from there. More broadly, the user wants a break to be a legitimate, non-punishing
way to step away — a *better alternative to pause* — that they control the length of.

## Initial Framing (preserved)

- **User's stated cause or approach**: Break-start is gated to "just after a work
  cycle." Add an "ad-hoc break" the user can start from idle.
- **User's proposed direction**: Ending the break should "continue the cycle as if a
  break from a proper work cycle had just passed."
- **Pre-dispatch narrowing** (Step 1.5): launch from **any idle state**; "continue" =
  the **normal post-break beat** (kickoff), not resuming a specific work cycle; the
  accidental switch-off itself is **out of scope**.
- **Post-investigation refinement** (this round — expands scope):
  1. **User picks** short vs long break at start (toggle on the trigger).
  2. **NEW / cross-cutting**: break time is **counted (overtime) until the user
     explicitly accepts "end break"** — applies to **all break types**, not just ad-hoc.
  3. Trigger = **persistent quick action available in any idle state**.
  4. Product intent: a break must **not punish** the user (no interruption penalty, no
     cadence corruption); it is a deliberate, better alternative to `pause`.
  5. **Future direction (OUT OF SCOPE)**: eventually two distinct concepts — `pause`
     ("I must stop my cycles for a situation") vs `break` ("I need rest now, even
     mid-cycle or before starting"). Mid-cycle break start is explicitly deferred.

## Two coupled concerns

**Scope decision (user, this round): plan A + B together as one change.** They are
technically separable but express one idea — "what a break is" — so they ship as a single
plan. Suggested internal sequencing: land B's break-end/overtime semantics first, then A rides
on the new semantics. This change now contains **two coupled pieces** that arrived as one:

- **Concern A — Ad-hoc break entry** (additive, low risk): a persistent idle quick
  action that starts a break with a user-chosen kind, reusing existing break machinery;
  its end lands in the existing post-break kickoff beat.
- **Concern B — Break-overtime-until-accept** (global behavior change, higher risk):
  breaks stop auto-expiring silently — the timer counts *past* the configured duration
  and only ends on an explicit user accept. This touches **every break**, not just ad-hoc.

## Dimension Map

1. **Idle-state entry point + UI surface** — no idle break trigger today.  ← concern A / initial framing
2. **Break lifecycle assumptions** — does break-run/complete assume a preceding work cycle?
3. **Cadence counter (`completedWorkCycles`)** — must not be corrupted / must not punish.
4. **Session bootstrap + guest/auth parity** — a break needs a session when idle/ended.
5. **Break-end accept + overtime** — how a break currently ends and whether time is counted.  ← concern B
6. **Non-punishing semantics** — interruption count / stats must not penalize a break.

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| D1: No idle entry point; must add one | Break created only via `startBreakAfterWorkComplete` ([use-pomodoro-cycle.ts:2418](src/hooks/use-pomodoro-cycle.ts:2418)) + check-in `start_break`. Idle surface = `FocusReadyState`/`FocusEmptyState` under `showCalmLanding`; QuickActions rail is the natural persistent mount. No "Start break" control today. | STRONG — real gap, thin fix |
| D2: Break-run/complete assumes preceding work | Break-complete `else` branch is defensive: `preFocusedTask == null → setPostBreakIdleFlag(true)` is the designed path ([:2603-2621](src/hooks/use-pomodoro-cycle.ts:2603)). Atmosphere, transition copy, out-of-tab alert, `handleCycleExpired`, catch-up gate key only on `cycleKind`. | HOLDS — machinery tolerates no prior work |
| D3: Cadence `+1` corrupts state | `startBreakAfterWorkComplete`/`computeBreakAfterWork` unconditionally `+1` ([:250](src/hooks/use-pomodoro-cycle.ts:250), [:2420](src/hooks/use-pomodoro-cycle.ts:2420)); corrupts narrative, wind-down cadence, `sessionEnergyPending` ([:1128](src/hooks/use-pomodoro-cycle.ts:1128)), first-cycle intention ([:1963](src/hooks/use-pomodoro-cycle.ts:1963)). User picks kind → don't reuse these; must not increment. | STRONG (BREAKS) — must decouple |
| D4: No session / guest-auth asymmetry | Both modes create SHORT/LONG_BREAK from idle, no preceding-work guard; session auto-bootstraps (`findOrCreateActiveSession` [active-session.ts:35](src/server/api/lib/active-session.ts:35); guest `getOrCreateActive`). Only guard rejects a RUNNING/PAUSED cycle — irrelevant when idle. | HOLDS — infra supports it |
| D5: Break-end already has an accept step; overtime missing | On expiry, `handleCycleExpired` → `state="completed"`; `CycleCompleteOverlay` renders a "Continue" button and waits for the click ([cycle-complete-overlay.tsx:48-118](src/app/_components/cycle-complete-overlay.tsx:48)). BUT the worker stops at `remaining <= 0`; **no overtime is tracked or shown**. | PARTIAL — accept exists, overtime does NOT |
| D6: Non-punishing | `interrupt`/`rebindTask` increment `interruptionCount` ([cycle.ts:344](src/server/api/routers/cycle.ts:344), [:255](src/server/api/routers/cycle.ts:255)); an ad-hoc break/overtime path must avoid that increment and the phantom work-cycle count from D3. | STRONG — explicit "do not penalize" rule |

Tangential pre-existing gap (from D4): server `cycle.create` validates duration with
`minWorkCycleSec`/max 90min uniformly, not kind-aware ([cycle.ts:85](src/server/api/routers/cycle.ts:85)) — note for /10x-plan.

## Narrowing Signals

- "Continue the cycle" = normal post-break kickoff (D2/D5), so no in-break suggestion-acceptance
  flow is needed — sidesteps the work-cycle-id-keyed suggestion seam.
- User picks kind → the short/long cadence auto-pick is not needed for ad-hoc; the only counter
  constraint is "do not increment / do not punish" (D3/D6).
- "Count until accept, all breaks" (D5) is the one requirement that reaches **outside** the ad-hoc
  affordance into shared break-end behavior — it is the scope-defining decision here.

## Cross-System Convention

Existing `pause`/`resume` ([cycle.ts:401-520](src/server/api/routers/cycle.ts:401)) operate only on a
*running* cycle and increment nothing punitive, but do not cover the idle case and are conceptually
distinct from "break" (the user's future A/B split confirms this). Break lifecycle is uniformly keyed
on `cycleKind`, so an ad-hoc break rides the same rails. The only convention that assumes "break
follows work" is the cadence counter (D3).

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is two things**: (A) FlowState has no idle affordance to
> start a break, though the run/complete/session/kickoff machinery already supports a break with no
> preceding work cycle; and (B) breaks currently end silently at timer expiry with no overtime —
> the user wants **all** breaks to keep counting until an explicit "end break" accept, and a break
> must never punish the user (no interruption penalty, no cadence corruption).

The initial framing held for A — "add an ad-hoc break whose end continues the cycle" is right and
small, because most of the machinery already exists. What genuinely enlarges scope is B: it is a
**global break-end behavior change** (timer/overtime + explicit accept for every break), not part of
the ad-hoc entry point, and it carries the wedge-transition regression risk called out in
`lessons.md` ("Test every wedge transition before shipping transition logic changes").

## Confidence

- **A (ad-hoc entry): HIGH** — three converging investigations with file:line evidence; machinery
  already tolerates a no-prior-work break; the one seam that breaks (cadence counter) is precisely located.
- **B (overtime-until-accept): MEDIUM** — the current accept step and the missing-overtime gap are
  confirmed, but it changes shared break-end/timer logic for all breaks and needs its own
  transition/dismiss oracles per `lessons.md`. **Recommend planning B as its own phase or its own
  change. **User elected to keep A + B in one change** — so plan B first, then A on top, and lean
  hard on per-gate transition/dismiss oracles to contain B's regression risk.

## What Changes for /10x-plan

Plan **A** as a thin idle-state "start break" quick action (user-picked kind, its own break-kind/
duration picker that does **not** touch `completedWorkCycles` or `interruptionCount`), reusing the
existing break run → `CycleCompleteOverlay` → post-break-kickoff path across both data modes.
Plan **B** separately: make break time count into overtime past the configured duration and end only
on explicit accept, for all break types — with per-gate dismiss oracles and reduced-motion/visibility
handling. Flag the kind-aware duration-validation gap. Treat the future pause/break duality and
mid-cycle break start as out of scope.

## References

- Source files: [use-pomodoro-cycle.ts:2418](src/hooks/use-pomodoro-cycle.ts:2418), [:2603](src/hooks/use-pomodoro-cycle.ts:2603), [:688](src/hooks/use-pomodoro-cycle.ts:688), [:250](src/hooks/use-pomodoro-cycle.ts:250); [cycle.ts:80](src/server/api/routers/cycle.ts:80); [cycle-complete-overlay.tsx:48](src/app/_components/cycle-complete-overlay.tsx:48); [active-session.ts](src/server/api/lib/active-session.ts); `pomodoro-dashboard.tsx`, `focus-ready-state.tsx`
- Related research: none (`research.md` not present)
- Investigation tasks: idle-surface map, break-lifecycle seams, session/guest parity (3 parallel sub-agents) + break-end/overtime read
