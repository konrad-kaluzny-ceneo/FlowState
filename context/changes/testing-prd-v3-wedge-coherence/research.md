---
date: 2026-06-26T18:20:00+02:00
researcher: 10x-research (subagent)
git_commit: b1a5ccfa6e283beb1be68a4cbff911725a559050
branch: features/testing-prd-v3-wedge-coherence
repository: FlowState
topic: "PRD v3 wedge coherence — test-plan Phase 8 risks #8–#12 + S-39 operability oracles"
tags: [research, codebase, wedge, transition-conductor, pomodoro-cycle, dashboard, test-plan, phase-8]
status: complete
last_updated: 2026-06-26
last_updated_by: 10x-research (subagent)
---

# Research: PRD v3 Wedge Coherence (Phase 8 — risks #8–#12 + S-39)

**Date**: 2026-06-26T18:20:00+02:00
**Researcher**: 10x-research (subagent)
**Git Commit**: b1a5ccfa6e283beb1be68a4cbff911725a559050
**Branch**: features/testing-prd-v3-wedge-coherence
**Repository**: FlowState

## Research Question

Ground current code/test ownership for test-plan Phase 8 wedge-coherence risks #8–#12
and S-39 operability oracles. For each risk: identify existing coverage, the missing
oracle(s), the cheapest sufficient layer, and the likely test files to touch — without
implementing code, writing tests, or planning. Flag production-code gaps only where a
test cannot be written without a small testability fix.

## Summary

Phase 8 is a **quality companion** for already-shipped behavior (all prerequisites
F-07, S-21, S-24, S-28, S-34, S-35, S-39 are `done`; B-05–B-09 closed — `roadmap.md:67-90`).
The wedge surfaces are **broadly and deeply tested already**: the conductor is a pure
function with a focused unit suite, the cycle hook carries ~90 cases including dedicated
`S-34 optimistic`, `S-35 sync recovery`, pause/resume/cap, and suppression blocks, and the
dashboard has an overlay-visibility matrix plus polite-live-region oracles. The S-39
operability cookbook (§6.10) is largely satisfied across `overlay-shell`, `cycle-complete`,
`check-in`, `wind-down`, `session-closure`, `energy-selector`, `session-steering-card`, and
`task-suggestion-card`.

**The work is gap-closing, not greenfield.** The highest-value gap is Risk #12's exact
reference incident — the **break-alerts permission deferral deadlock**: the dashboard defers
`pomodoro.start` behind the permission prompt, but there is **no test** proving the deferred
start actually fires after dismiss/enable, and `break-alerts-permission-prompt.test.tsx` has
only one assertion. Secondary gaps: `wedge-sync-recovery.tsx` has **no co-located test**
(Risk #11 operability), no oracle asserts **pause does not increment interruption count**
(Risk #10, PRD US-04), and the conductor's "exactly one gate" invariant is implied by
construction but never asserted as a mutual-exclusion property (Risk #8).

**No production code changes are required** — every gap is reachable at the hook/component
layer with existing seams (module mocks via `vi.mock`, `renderHook`, deferred-mock oracle).
No belt e2e additions are justified: cheaper layers observe every contract.

## Detailed Findings

### Wedge architecture (ownership map)

- **Conductor (pure, F-07)** — `src/lib/wedge/transition-conductor.ts`. Exports
  `resolveWedgeBeat` (priority matrix: `session_closure → wind_down → check_in → cycle_complete`,
  `transition-conductor.ts:53-130`), `computeKickoffEligible` (`:132-152`),
  `effectiveWorkCyclesAtCheckIn` (`:155-159`). Session steering (energy/focus) and suggestion
  cards are **inline, not conductor gates** (`:4-6`). `cyclePaused` short-circuits all gates to
  `false` (`:63-70`).
- **Cycle hook** — `src/hooks/use-pomodoro-cycle.ts` owns all gate booleans, pause/resume/cap
  state machine, optimistic transitions, and `retryWedgeSync`. Tests in
  `use-pomodoro-cycle.test.tsx` (~90 cases) and `use-pomodoro-cycle-guest.test.tsx`.
- **Dashboard orchestration** — `src/app/_components/pomodoro-dashboard.tsx` wires gates into
  DOM and owns the **permission-deferral chain** (`pomodoro-dashboard.tsx:162-241`): a pending
  `start` is parked behind `BreakAlertsPermissionPrompt` and replayed by `completePendingStart`
  (`:186-196`) from both `dismissPermissionPrompt` (`:237-241`) and `onEnable` (wired to the same
  handler, `:738-741`).
- **Gate/overlay components** — modal primitives in `overlay-shell.tsx`; gates:
  `cycle-complete-overlay`, `check-in-overlay`, `wind-down-overlay`, `session-closure-overlay`,
  `break-alerts-permission-prompt`; inline: `session-steering-card`, `energy-selector`,
  `task-suggestion-card`, `kickoff-duration-chips`, `wedge-sync-recovery`.

### Risk #8 — Overlay stacking / transition mutex (impact High, likelihood High)

- **Existing coverage (strong).** Conductor unit suite asserts priority and pair-exclusion:
  closure-on-idle (`transition-conductor.test.ts:25-33`), wind-down ≻ check-in (`:35-47`),
  check-in (`:49-57`), cycle-complete (`:59-67`), cycle-complete ≻ stale closure (`:69-80`),
  check-in ≻ stale closure (`:82-94`), all-gates-off when paused (`:96-113`). Dashboard matrix:
  check-in vs closure (`pomodoro-dashboard.test.tsx:592`), steering vs kickoff (`:522`, `:557`),
  in-flow summary suppression while check-in/suggestion visible (`:339`, `:364`), break-transition
  line suppression (`:629`, `:664`). Hook suppression: `submitCheckIn keeps cycle-complete
  suppressed until break running` (`:1778`), `wind-down after check-in suppresses cycle-complete`
  (`:1891`).
- **Missing oracle.** `resolveWedgeBeat` guarantees **exactly one** of the four `show*` booleans
  by construction (the `activeGate` switch, `transition-conductor.ts:118-121`), but **no test
  asserts that mutual-exclusion invariant directly** — i.e. that across the candidate input space
  at most one `show*` is ever `true`. The "one interstitial line + one gate" count (PRD guardrail,
  `prd.md:92`) is proven only pairwise, never as a single beat-level count assertion. The unused
  `enableSuggestionGate` input (`:13`, `:17`) is never asserted to coexist-safely with a gate.
- **Cheapest sufficient layer.** Conductor **unit** (add a mutual-exclusion / property test over
  sampled inputs) + the existing dashboard matrix. No belt e2e (per §6.10 belt-extension rule and
  §1 #5 — hook/component observe the contract).
- **Likely files to touch.** `src/lib/wedge/transition-conductor.test.ts`; optionally one
  dashboard matrix case in `pomodoro-dashboard.test.tsx` for a full closure+kickoff+check-in beat.

### Risk #9 — Optimistic check-in → suggestion ≤200ms / no stale UI (Medium / Medium)

- **Existing coverage (strong).** `describe("S-34 optimistic wedge transitions")`
  (`use-pomodoro-cycle.test.tsx:3200`): `dismisses check-in and starts break before createCheckIn
  resolves` (`:3201`), `rolls back to check-in gate when createCheckIn fails` (`:3248`), `rolls
  back when completeCycle fails after optimistic break start` (`:3274`), `acceptSuggestion
  pre-focuses before recordDecision resolves` (`:3313`). Also generic optimism: `transitions to
  running before createCycle resolves` (`:497`), `clears sessionEnergyPending within 200ms`
  (`:2957`, `:3005`, L-04). Suggestion-card timing: loading/skeleton/slow (`task-suggestion-card.test.tsx:34-62`).
  Stale-id invalidation: `describe("stale suggestion invalidation")` (`use-pomodoro-cycle.test.tsx:3761`).
- **Missing oracle.** No explicit assertion that the suggestion card **does not display a stale /
  previous suggestion** during the optimistic window (the "no stale suggestion card" half of Risk
  #9 — `test-plan.md:82`). Current tests prove the *transition speed* and *id invalidation* but not
  "old card hidden until fresh card ready" on the post-check-in path specifically.
- **Cheapest sufficient layer.** Hook **deferred-mock** oracle (§6.8 pattern) + `task-suggestion-card`
  component smoke for the loading→ready handoff. No belt row (hook observes perceived latency).
- **Likely files to touch.** `src/hooks/use-pomodoro-cycle.test.tsx` (extend S-34 block),
  `src/app/_components/task-suggestion-card.test.tsx`.

### Risk #10 — Pause/resume preserves time; cap ends calmly; pause ≠ interruption (High / Medium)

- **Existing coverage (good).** Hook: `pause freezes remaining and enters paused state` (`:866`),
  `resume restores running countdown from paused remaining` (`:905`), `hydrates PAUSED cycle from
  getActive without starting countdown` (`:938`), `ends session with pause_cap closure when paused
  past cap` (`:957`), `restores running state when pauseCycle fails after optimistic pause` (`:1000`),
  `awaits create before pause persists to server during optimistic start` (`:535`). Conductor:
  paused suppresses all gates (`transition-conductor.test.ts:96`) and kickoff (`:146`). Dashboard:
  `hides check-in overlay when cycle is paused` (`:189`), `hides break suggestion card when paused`
  (`:211`), `pauses then opens after-pause confirm` (`:804`).
- **Missing oracle.** PRD US-04 explicitly requires **"pause does not increment interruption
  count"** (`prd.md:124`, `:181`); **no test asserts this** — there is no oracle that the interrupt
  mutation / `interruptionCount` is left untouched across pause→resume and pause→cap. Also
  test-plan calls for **integration for persisted pause state** (`test-plan.md:83`) — no router
  integration test exercises the PAUSED persistence round-trip (cycle router tests cover RUNNING/
  COMPLETED, not pause).
- **Cheapest sufficient layer.** Hook **unit** for the no-interruption-increment invariant; tRPC
  **integration** for persisted pause state (cycle router, `createCaller` pattern §6.2). Belt only
  if a hook gap on cap→closure remains (it does not).
- **Likely files to touch.** `src/hooks/use-pomodoro-cycle.test.tsx`,
  `src/server/api/routers/cycle.test.ts` (or a `cycle-pause` integration sibling).

### Risk #11 — Network loss during wedge gate → calm recovery, preserved intent, one-tap retry (High / Medium)

- **Existing coverage (good at hook layer).** `describe("S-35 wedge sync recovery")`
  (`use-pomodoro-cycle.test.tsx:3386`): `keeps break running when suggestion fetch fails` (`:3387`),
  `retryWedgeSync replays suggestion fetch without rolling back break` (`:3430`), `retryWedgeSync
  replays check-in with preserved energy` (`:3491`), `sets kickoff_suggestion/_session recovery`
  (`:3569`, `:3693`), `restores wedge recovery when suggestion_fetch retry fails again` (`:3642`).
  Dashboard: `shows wedge-sync-recovery with retry instead of generic pomodoro-error` (`:847`).
- **Missing oracle.** `src/app/_components/wedge-sync-recovery.tsx` has **no co-located test file**
  (confirmed: only `wedge-sync-recovery.tsx` exists, no `.test.tsx`). The recovery UI's S-39
  operability is unproven at component level: role/name (it is the user-facing recovery surface),
  **single polite live status** for the error/retry state, and **keyboard-first retry** (native
  `button` + Enter/Space). The hook proves intent-preservation; the component does not prove
  operable presentation.
- **Cheapest sufficient layer.** **Component** smoke on `wedge-sync-recovery.tsx` (role/name,
  one polite status, keyboard retry) + the existing hook S-35 suite. No belt row.
- **Likely files to touch.** New `src/app/_components/wedge-sync-recovery.test.tsx`; possibly one
  dashboard assertion extension at `pomodoro-dashboard.test.tsx:847`.

### Risk #12 — Every gate primary action dismisses overlay and unblocks next beat (High / High)

- **Existing coverage (partial).** Dashboard: `dismisses cycle complete overlay after Continue
  later confirm` (`pomodoro-dashboard.test.tsx:480`, asserts `onCycleCompleteConfirm(false)`).
  Overlay components: `cycle-complete-overlay` Escape/Continue-later + focus trap
  (`cycle-complete-overlay.test.tsx:82,97`), `check-in-overlay` submit + focus trap
  (`check-in-overlay.test.tsx:32,67`), `session-closure-overlay` dismiss + Escape + focus restore
  (`:12,41,54`), `wind-down-overlay` keep-going/end + focus trap (`:43,97`). Hook: `confirmComplete
  failure keeps check-in retryable` (`use-pomodoro-cycle.test.tsx:1916`), `dismissSessionClosure
  clears pending closure overlay` (`:1401`), suppression chains (`:1778`, `:1831`, `:1891`).
- **MAJOR GAP — break-alerts permission deferral deadlock (the §6.10 reference incident).**
  - `break-alerts-permission-prompt.test.tsx` has **one** test only (`calls onDismiss when Not now
    is clicked`, `:11`). It does **not** cover the **Enable** path
    (`break-alerts-permission-prompt.tsx:44-53`: `requestNotificationPermission()` then `onEnable()`),
    nor role/name/focus operability.
  - **No dashboard test** exercises `handleStartWithPermission` → prompt visible → dismiss/enable →
    **deferred `pomodoro.start` fires** (`pomodoro-dashboard.tsx:186-241`). This is the exact
    "handler A returns early waiting for gate B; prove B becomes visible or A closes — never both
    hidden with A's stuck boolean true" deferral rule (`test-plan.md §6.10:377`) and the precise
    `session-entry-wedge-bugs` permission deadlock that motivated Risk #12 (`test-plan.md:68`).
    grep of `pomodoro-dashboard.test.tsx` shows **zero** permission/deferral cases.
- **Per-gate dismiss matrix status (§6.10:365-374).** Cycle complete ✓; check-in ✓; session
  closure ✓; wind-down ✓; kickoff readiness — hook-level (`computeSessionEnergy`/`skip`,
  `:2832`,`:2919`) ✓; cycle intention / session steering — component fires callbacks
  (`session-steering-card.test.tsx:25,63`) but **no dashboard test proves steering clears and the
  permission/kickoff beat proceeds**; **break-alerts permission — ✗ (the gap above)**.
- **Cheapest sufficient layer.** **Component** (`break-alerts-permission-prompt` enable +
  operability) + **dashboard** deferral-chain test (mock `needsPermissionPrompt` deps via
  `vi.mock`, assert `pomodoro.start` called after dismiss and after enable). No belt row — the
  deadlock is fully observable at the dashboard component layer with mocked hook.
- **Likely files to touch.** `src/app/_components/break-alerts-permission-prompt.test.tsx`,
  `src/app/_components/pomodoro-dashboard.test.tsx`.

### S-39 operability oracles (cross-cutting, §6.10:355-363)

- **Already satisfied.** Role/name + focus + keyboard across `overlay-shell.test.tsx` (modal
  semantics, initial focus, trap, escape, focus restore, `:20-124`), `cycle-complete-overlay`,
  `check-in-overlay`, `wind-down-overlay`, `session-closure-overlay`; inline region labelling +
  single polite status in `task-suggestion-card.test.tsx` (`:257,271,286,298`),
  `session-steering-card.test.tsx` (`:35,73,84`), `energy-selector.test.tsx` (`:58`); dashboard
  polite live regions (`:691,703,715`).
- **Remaining S-39 gaps.** `break-alerts-permission-prompt` (role/name, focus, keyboard — uses
  `role="dialog"` via `OverlayScrim` at `break-alerts-permission-prompt.tsx:26-29` but unasserted)
  and `wedge-sync-recovery` (no test). Both fold into Risk #12 and Risk #11 work above.

### Production-code / testability gaps

- **None blocking.** Every gap is reachable with existing seams:
  - Permission chain: `pomodoro-dashboard.tsx` exposes `onStart={handleStartWithPermission}`
    (`:541`); deps `getNotificationPermission`, `shouldDeferFirstRun`, `readNotificationPromptDismissed`
    are module imports mockable with `vi.mock`. No product change needed.
  - Pause no-interruption invariant: assertable as "interrupt mutation not called" against the
    existing hook mock surface; no new instrumentation required.
  - `wedge-sync-recovery.tsx` is a presentational component (props in / retry callback out) —
    directly renderable. No change needed.
- **Watch-out (not a fix request).** `pomodoro-dashboard.test.tsx` mocks `~/hooks/use-pomodoro-cycle`
  (composite-with-hook pattern, §6.9 case 2); the permission deferral test must mock the **module
  functions** (`notify-break-start`, `onboarding/defer`, dismissed-storage), not the hook, to drive
  `needsPermissionPrompt` true.

## Code References

- `src/lib/wedge/transition-conductor.ts:53-130` — gate priority matrix; one-gate-by-construction.
- `src/lib/wedge/transition-conductor.ts:63-70` — `cyclePaused` suppresses all gates.
- `src/lib/wedge/transition-conductor.test.ts:24-166` — conductor unit suite (priority, paused, kickoff).
- `src/hooks/use-pomodoro-cycle.test.tsx:866-1031` — pause/resume/cap suite.
- `src/hooks/use-pomodoro-cycle.test.tsx:3200-3386` — S-34 optimistic suite.
- `src/hooks/use-pomodoro-cycle.test.tsx:3386-3760` — S-35 sync-recovery suite.
- `src/app/_components/pomodoro-dashboard.tsx:162-241` — permission deferral chain (`completePendingStart`).
- `src/app/_components/pomodoro-dashboard.tsx:738-741` — `onEnable`/`onDismiss` both → start replay.
- `src/app/_components/break-alerts-permission-prompt.tsx:44-61` — enable/dismiss buttons.
- `src/app/_components/break-alerts-permission-prompt.test.tsx:10-12` — single (dismiss-only) test.
- `src/app/_components/wedge-sync-recovery.tsx` — recovery UI, **no co-located test**.
- `src/app/_components/pomodoro-dashboard.test.tsx:480-509,842-847` — cycle-complete dismiss + sync-recovery render.

## Architecture Insights

- The conductor is intentionally **pure and small**; mutex correctness lives there, while
  *deferral* correctness (one handler parking another) lives in the **dashboard**, and *flag
  lifecycle* lives in the **hook**. Risk #12 therefore splits across all three layers — the §6.10
  location guidance (`transition-conductor.test.ts` + hook + dashboard) matches the real ownership.
- Steering/suggestion are **inline gates** the conductor does not arbitrate; their "one
  interstitial line" guarantee is enforced in the dashboard render path, not the conductor — so
  Risk #8's count invariant is genuinely a dashboard-matrix concern plus a conductor exclusivity
  property, not a single conductor assertion.
- Optimistic + recovery follow the **same deferred-mock oracle** pattern as optimistic task CRUD
  (§6.8 / L-04), so Risk #9/#11 hook additions reuse an established harness.

## Historical Context (from prior changes)

- `session-entry-wedge-bugs` (2026-06-20) — origin of Risk #12 and §6.10; the **permission deferral
  deadlock** is the named reference incident. Directly motivates the dashboard permission test gap.
- `accessible-wedge-gates` / S-39 (2026-06-26) — added §6.10 operability oracle table; satisfied for
  most gates, leaving `break-alerts-permission-prompt` and `wedge-sync-recovery` as the residue.
- `optimistic-wedge-transitions` (S-34) and `wedge-transition-sync-recovery` (S-35) shipped the hook
  suites this phase extends rather than rewrites.
- `cycle-pause-resume` (S-24) + B-08/B-09 shipped pause + calm end; the "pause ≠ interruption"
  assertion is the untested corner of that contract.

## Related Research

- None prior under `context/changes/**/research.md` for this change (first research artifact).
- Frame: `context/changes/testing-prd-v3-wedge-coherence/frame.md` (scope guard — this research
  confirms the frame's "gap-closing, not product reopen" stance).

## Open Questions

- Risk #8: is a sampled mutual-exclusion **property** test (fast-check) warranted, or is an
  enumerated matrix case sufficient? (Cost × signal — likely enumerated; defer fast-check.)
- Risk #10: should persisted-pause integration land in `cycle.test.ts` or a new `cycle-pause`
  sibling? (Naming/placement — planning decision, not a blocker.)
- §6.10 cookbook update: confirm the permission-deferral row and the `wedge-sync-recovery`/
  `break-alerts-permission-prompt` reference tests are added once they land (frame medium-confidence item).

## Recommended Planning Focus (for /10x-plan)

Order by signal-per-cost; all hook/component layer, **no belt additions**:

1. **Risk #12 — permission deferral deadlock (highest value).** Dashboard deferral-chain test
   (start parked → dismiss → start fires; start parked → enable → start fires) + enable-path &
   operability for `break-alerts-permission-prompt`. Directly closes the named reference incident.
2. **Risk #11 — `wedge-sync-recovery` component test.** Role/name, single polite status,
   keyboard-first retry (the only wedge surface with no co-located test).
3. **Risk #10 — pause ≠ interruption + persisted pause integration.** Hook invariant + cycle
   router integration round-trip.
4. **Risk #8 — conductor one-gate mutual-exclusion oracle.** Cheap unit hardening of an
   invariant currently only true by construction.
5. **Risk #9 — no-stale-suggestion oracle.** Extend the S-34 deferred-mock block + suggestion-card
   loading→ready handoff.
6. **§6.10 cookbook update.** Add the permission-deferral row and new reference tests after they land.

Scope guard (from frame): do **not** reopen product rows or add belt e2e; if any proof exposes a
shipped behavior bug (e.g. interruption increments on pause), record it as a blocker / separate
follow-up unless a minimal fix is required to make the proof truthful.
