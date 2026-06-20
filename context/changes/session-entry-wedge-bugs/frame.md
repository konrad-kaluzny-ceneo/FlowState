# Frame Brief: Session entry wedge bugs

> Framing step before /10x-plan. This document captures what is *actually*
> at issue, separated from what was initially assumed.

## Reported Observation

On session entry (first visit or return after a break), the user sees wedge UI that blocks normal use: a full-screen popup with “What's your focus this session?” that cannot be dismissed; alongside this, false “Session complete — 0 cycles” closure text and a “Continue: …” handoff line instead of the “Suggested next task” card.

**Pre-dispatch narrowing (leading concern):** the blocking “What's your focus this session?” popup is the primary symptom.

## Initial Framing (preserved)

- **User's stated cause or approach**: duplicate responsibilities between suggestion surfaces; focus prompt should be an inline Card on entry (not popup) with implicit Skip; return handoff and closure beats are wrong on entry.
- **User's proposed direction**: use “Suggested next task” for next-task proposal; show session focus as inline Card on entry; fix the unclickable popup.
- **Pre-dispatch narrowing**: blocking focus popup (`cycle-intention-prompt`) is the leading concern.

## Dimension Map

The observation could originate at any of these dimensions:

1. **Overlay z-index / pointer-events collision** — multiple full-screen scrims stack and intercept clicks on the focus prompt.
2. **Permission-prompt deferral deadlock** — Skip/Submit on cycle intention defers to break-alerts permission, but permission UI is suppressed while intention overlay is active, leaving `awaitingCycleIntention` stuck. ← initial framing (popup + “can't click”)
3. **Stale closure on hydrate** — timeout-ended session reloads with null `closureLine`; client rebuilds from counters already zeroed → “Session complete — 0 cycles”.
4. **Return handoff vs kickoff suggestion overlap (pol-10)** — `returnHandoffGateOpen` blocks kickoff pipeline; user sees “Continue: {task}” banner instead of `TaskSuggestionCard`.
5. **Surface / beat mismatch** — cycle intention is designed as pre-start overlay (on first Start click), not inline entry Card; user expectation differs from shipped product flow.

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| Z-index / pointer-events collision | F-07 conductor allows one wedge gate at a time (`transition-conductor.ts:61-162`); cycle intention z=60 is top wedge layer (`cycle-intention-prompt.tsx:26`); only z=65 is check-in catch-up, mutually exclusive with intention (`pomodoro-dashboard.tsx:572`); no pointer-events overrides on overlays | **NONE** |
| Permission deferral deadlock | `handleSubmitCycleIntention` returns early when `needsPermissionPrompt()`, never calling `submitCycleIntention` → `awaitingCycleIntention` stays true (`pomodoro-dashboard.tsx:159-166`); `BreakAlertsPermissionPrompt` gated by `!wedgeBeat.showCycleIntention` (`pomodoro-dashboard.tsx:559`); archived plan contract says permission runs **after** intention closes (`context/archive/2026-06-18-break-alerts-out-of-tab/plan.md:187`) — implementation violates that | **STRONG** |
| Stale closure on hydrate | `recoverActiveCycle` sets `completedWorkCycles(0)` then calls `maybePresentTimeoutClosure` when `getLastEnded.state === ENDED_BY_TIMEOUT` (`use-pomodoro-cycle.ts:914-922`); server timeout omits `closureLine` (`active-session.ts:26-31`); rebuild uses zeroed counters (`narrative-builder.ts:92-109`); test proves exact “0 cycles” string on `endSession` (`use-pomodoro-cycle.test.tsx:1443-1447`) | **STRONG** (secondary symptom) |
| Handoff blocks suggestion card | `returnHandoffGateOpen` → `computeKickoffEligible` false (`transition-conductor.ts:172-174`); E2E asserts handoff visible + `task-suggestion-card` hidden (`e2e/session-return-handoff.spec.ts:66-73`); `buildReturnHandoff` emits `Continue: {taskTitle}` (`narrative-builder.ts:112-134`) | **STRONG** (secondary symptom) |
| Surface / beat mismatch | Cycle intention only set inside `start()` when `completedWorkCycles === 0` (`use-pomodoro-cycle.ts:1677-1680`); product doc: “Przed startem” overlay (`user-flow.md:119-124`); no inline Card variant exists; user wants entry Card with implicit Skip | **STRONG** (design gap, not click bug) |

## Narrowing Signals

- User picked **blocking focus popup** as leading concern — aligns with permission deadlock (Skip appears to do nothing) rather than z-index collision.
- “What's your focus this session?” maps uniquely to `CycleIntentionPrompt` (`cycle-intention-prompt.tsx:29`) — user must have reached first Start click, not pure idle entry.
- Step 3 found **no** evidence for overlay stacking; **strong** evidence for deferral deadlock matching “cannot click through.”
- Secondary symptoms (0-cycle closure, Continue banner) trace to **separate, verified code paths** — same entry visit cluster but not the same root cause as the deadlock.

### Discussion refinement (user, 2026-06-20)

**Focus popup timing & purpose**

- Confirmed: focus popup appears **after** user starts a task (clicks Start), not on idle entry.
- Expected: focus question **before** any task/cycle starts — session-wide anchor that should **inform kickoff task suggestion** (today `sessionIntention` only feeds in-flow summary, not `suggestion.next`; energy via `submitKickoffReadiness` does feed kickoff).
- UX target: merge session-focus with energy/readiness (“How's your energy?”) as **similar steering questions** — same **inline Card** placement in the dashboard, **not** full-screen popup.
- Interaction contract: chips/Skip must work (**CRITICAL**); no explicit choice = Skip.

**Reproduction of blocking symptom**

- User confirms: chips in `cycle-intention-prompt` do not respond; no other overlay visible — consistent with permission deferral deadlock (not a second overlay on top).

**Separate scenarios**

- “Continue: …” banner and “Session complete — 0 cycles” are **independent bugs**, not one combined entry failure.

**Return-handoff decision (plain language)**

- See “Open product decision” below — user asked for clearer framing of the old “pol-10” question.

## Cross-System Convention

- **F-07 conductor** enforces one blocking wedge overlay per beat (`transition-conductor.ts:1-6`).
- **pol-10 / T-06** (`user-flow.md:201,293-297`): return handoff → dismiss → kickoff; handoff intentionally suppresses kickoff readiness and suggestion card on ≥8h return.
- **Break-alerts slice** (`2026-06-18-break-alerts-out-of-tab`): intended sequence is cycle-intention → permission prompt → start; current dashboard defers permission without closing intention — **contradicts shipped convention**.

Independent read (without naming deadlock hypothesis): entry wedge failures cluster around **state-machine ordering** (hydrate counters, handoff gate, intention→permission chain), not CSS layering.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: session-entry steering (energy + session focus) is split across the wrong beats and surfaces — focus fires too late (on Start, as a blocking popup), does not feed task suggestion, and its chips are dead due to a permission-prompt deferral deadlock; energy and focus should be one inline Card beat **before** kickoff suggestion, with implicit Skip.

Confirmed technical root for dead chips: `handleSubmitCycleIntention` defers to break-alerts permission without closing the intention overlay, while permission UI is hidden behind `!showCycleIntention` (`pomodoro-dashboard.tsx:159-166,559`).

Product gap (user-confirmed): kickoff energy already precedes suggestion (`KickoffReadinessOverlay` → `TaskSuggestionCard`); session focus should join that beat **inline** and pass context into `suggestion.next` — not run as a separate pre-start popup after the user already committed to Start.

**Separate fixes** (same change folder, different root causes):

- **0 cycles closure** — stale rebuild on timeout hydrate (`use-pomodoro-cycle.ts:914-922`).
- **Continue banner** — return-handoff banner uses first active task title; blocks suggestion card until dismissed (`narrative-builder.ts:112-134`, `transition-conductor.ts:172-174`). User treats this as its own scenario.

## Open product decision — “Continue:” banner (no jargon)

When you return after **8+ hours**, FlowState shows a **thin banner at the top** of the screen (not a popup), for example:

`Continue: Cały proces tworzenia workflow…` · `Dismiss`

That banner is a **different feature** from the **“Suggested next task”** card in the middle of the dashboard. Today the app is built so:

1. If the banner is visible → the suggestion card **does not appear** until you click Dismiss.
2. The banner picks the **first active task from your list** (“Continue: …”), not the scored suggestion engine.
3. Your original report wanted the **suggestion card** to propose the next task instead.

**Decision needed before /10x-plan scopes the Continue fix:**

| Option | What changes for the user |
| --- | --- |
| **A — Suggestion replaces Continue** | After long absence, skip the banner’s task proposal; go straight to inline energy/focus → “Suggested next task”. Banner dropped or recap-only (closure line, no task name). |

**Decision (user, 2026-06-20): Option A** — kickoff suggestion card replaces the banner’s task proposal; do not show `Continue: {task title}` on return.

**Refinement (user, 2026-06-20): Option A+ — Continue on task row, last-active semantics**

Do not delete Continue logic entirely — **relocate** it to better UX:

1. **No top banner** — suggestion card + inline steering remain the entry beat (Option A stands).
2. **Continue on the task row** — show a Continue affordance **on the row** of the handoff task in `TaskList` (and align with `suggested-task-row` / `highlightedTaskId` when that task is also the kickoff pick), so browsing the list reveals “what I was doing last” without a separate banner.
3. **Last recently active, not first-in-list** — replace `pickHandoffTaskContext`’s “first active task in list order” fallback (`return-handoff.ts:84-87`) with **last task worked in the ended session** (e.g. last completed/running WORK cycle’s `taskId` on `getLastEnded` session). Resume-note priority from S-18 stays when note exists on that task.
4. **Kickoff suggestion vs Continue** — scored `TaskSuggestionCard` remains primary proposal; Continue row marker is **context recovery** on the last-active task (may coincide with suggestion when scorer agrees — not required).

**Implementation note for /10x-plan:** `Session` today has no `lastFocusedTaskId`; `getLastEnded` returns session row only (`session.ts:84-94`). Deriving last-active task requires extending API or client query (last WORK cycle by `endedAt` on ended `sessionId`) — guest parity from guest session cycles blob.

### Why return handoff existed (product archaeology)

**Source:** roadmap slice **S-17** (`session-narrative-summary`), PRD **FR-040** (shipped 2026-06-13, [PR #108](https://github.com/konrad-kaluzny-ceneo/FlowState/pull/108)).

**Stated problem (S-17 frame):** users lacked *narrative continuity* after Pomodoro sessions — no in-session progress line, no calm closure on end, no contextual bridge when returning after a long absence — even though resume notes (S-18) already existed.

**Intended purpose of the 8h handoff banner** (not task scoring):

1. **Emotional continuity** — secondary success criterion: “calm end-of-day feeling” without analytics dashboards (`prd-v2` FR-040).
2. **Context recovery** — one dismissible line composing at most **two clauses** from data already in the app:
   - **Primary:** `Left off: {resumeNote}` when user captured a resume note at mid-cycle interrupt (S-18) — *their words*, not the scorer.
   - **Secondary:** closure recap from last session (`Session complete — N cycles…`) if a clause slot remains.
3. **Fallback only:** `Continue: {first active task title}` when **no** resume note exists (`pickHandoffTaskContext` → `return-handoff.ts:66-88`) — a naive list pick, **not** a product decision to compete with FR-026 kickoff suggestion.

**Explicit guardrail when designed:** in-flow / handoff narrative “must not compete with suggestion card on the same transition beat” (`S-17` frame, `S-17` risk note). Handoff was context recap; kickoff suggestion (S-15/S-25, FR-026/FR-033) was the task-proposal surface.

**Does `Continue:` still add value after Option A?**

| Clause | Value today | After Option A |
| --- | --- | --- |
| `Left off: {resumeNote}` | High — user-authored interrupt context | **Likely redundant** — `TaskSuggestionCard` already surfaces `resumeNote` on the suggested task (`FR-028`); prefer showing it there |
| Closure recap in banner | Medium — reminds how last session ended | **Low on return** — user already saw `SessionClosureOverlay` at session end; replay on return was convenience for 8h+ gap, not essential |
| `Continue: {task title}` | **Low** — first active task ≠ scored suggestion; duplicates FR-026 poorly | **Relocate** — row-level Continue on **last recently active** task; remove banner clause |

**Conclusion for /10x-plan:** deprecate `ReturnHandoffBanner` and kickoff-blocking gate. **Preserve** handoff *semantics* as a **task-row Continue marker** (last-active task + optional resume note on row), not a top-of-screen task pick. Scored kickoff suggestion remains the proposal surface.

## Confidence

- **HIGH** — for the leading symptom (non-dismissible focus popup): permission deferral deadlock has direct file:line evidence and contradicts the archived overlay-sequence contract.
- **MEDIUM** — for the full change scope: secondary symptoms are strongly evidenced but may need manual reproduction to confirm they occur in the same user session as the deadlock.

If planning starts without reproduction: add one manual check — first authenticated Start with notification permission `default` → click Skip on cycle intention → confirm overlay persists and permission prompt never appears.

## What Changes for /10x-plan

**Stream 1 — Inline session steering (P0, user-confirmed scope)**

1. **CRITICAL — Unblock chips/Skip**: fix intention→permission ordering (immediate unblock even if UI refactor follows).
2. **Move beat earlier**: collect session focus **before** Start / before kickoff suggestion fetch — alongside energy readiness, not after Start click.
3. **Inline Card, not popup**: retire `CycleIntentionPrompt` + `KickoffReadinessOverlay` scrims for this beat; one dashboard Card hosting energy + session-focus chips; no choice = Skip.
4. **Wire to suggestion**: pass session focus (and energy) into kickoff `suggestion.next` — today only energy is forwarded (`submitKickoffReadiness` → `fetchKickoffSuggestion`); `sessionIntention` is summary-only (`use-pomodoro-cycle.ts:3090`).

**Stream 2 — False “0 cycles” closure (P1, separate scenario)**

- Fix timeout hydrate / persist closure line so return does not show empty-session closure.

**Stream 3 — Continue semantics on task row (P1, Option A+ locked)**

- Remove `ReturnHandoffBanner` and `returnHandoffGateOpen` kickoff suppression.
- Replace `pickHandoffTaskContext` first-in-list fallback with **last recently active task** from ended session (last WORK cycle `taskId`).
- Show Continue affordance on that task’s **list row** (visible when scanning tasks); resume note stays on row / suggestion card per FR-028.
- Kickoff `TaskSuggestionCard` stays scored proposal — Continue row is context, not a second task picker.
- Extend `getLastEnded` (or companion query) for last-cycle task id; guest parity; update `return-handoff.test.ts` + e2e handoff spec.

## References

- Source files: `src/app/_components/pomodoro-dashboard.tsx:159-166,559`; `src/app/_components/cycle-intention-prompt.tsx:26-74`; `src/hooks/use-pomodoro-cycle.ts:914-922,1677-1680`; `src/lib/wedge/transition-conductor.ts:105-113,172-174`; `src/lib/session/narrative-builder.ts:92-134`; `context/foundation/user-flow.md:119-124,201,293-297`
- Related research: none yet
- Investigation tasks: overlay stacking (922a7b51), stale closure (0f4412eb), duplicate surfaces (06edd1af)
