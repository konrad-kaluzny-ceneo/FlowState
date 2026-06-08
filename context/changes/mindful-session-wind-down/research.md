---
date: 2026-06-08T08:24:52+02:00
researcher: Auto (Cursor Agent)
git_commit: 778a812cc8667e0121f5c5bebaae8a40333e44b6
branch: features/mindful-session-wind-down
repository: FlowState
topic: "Where and how should S-16 mindful session wind-down nudge be implemented?"
tags: [research, codebase, check-in, session, wind-down, suggestion, overlay]
status: complete
last_updated: 2026-06-08
last_updated_by: Auto (Cursor Agent)
confidence: 88
---

# Research: S-16 Mindful Session Wind-Down Nudge

**Date**: 2026-06-08T08:24:52+02:00  
**Researcher**: Auto (Cursor Agent)  
**Git Commit**: `778a812cc8667e0121f5c5bebaae8a40333e44b6`  
**Branch**: `features/mindful-session-wind-down`  
**Repository**: FlowState

## Research Question

Where and how should S-16 "mindful session wind-down nudge" be implemented? User receives optional dismissible prompt to end session when check-in energy is Fading AND session fatigue/interruption signals align; can override to continue.

## Summary

S-16 has **no implementation yet** — only the change stub exists. The natural integration point is the **post-check-in transition gate** in `use-pomodoro-cycle.ts`, mirroring the existing check-in gate pattern. After `checkIn.create` succeeds and before `confirmComplete` + `fetchSuggestion`, evaluate a pure `shouldShowWindDownNudge` function; if true, show a new dismissible overlay (`WindDownOverlay`) and defer break start + suggestion fetch until the user chooses **End session** or **Keep going**.

**MVP trigger defaults (decision proxy):**

| Condition | Rule | Rationale |
|-----------|------|-----------|
| Energy | `energy === "FADING"` | Required by PRD FR-020; user explicitly signals low energy |
| Fatigue A | `completedWorkCycles >= 3` (this cycle will be ≥4th) | Aligns with scoring fatigue threshold at `score-task.ts:29` (`>= 4` completed cycles) |
| Fatigue B | `interruptionCount >= 2` | Matches PRD interruption definition; avoids nudging on a single context switch |
| Logic | `FADING && (fatigueA \|\| fatigueB)` | Fading alone is too aggressive (roadmap risk); requires corroborating session signal |
| Decline | Session-scoped in-memory flag; suppress until next check-in | Resets on `endSession` or new session; no persistence needed for MVP |
| Guest | Skip entirely | Mirrors check-in/suggestion gates — guest has no energy capture |

**Recommended integration point:** `src/hooks/use-pomodoro-cycle.ts` `submitCheckIn` (lines 889–929) + new overlay in `src/app/_components/pomodoro-dashboard.tsx` (after check-in block, ~line 197).

**Confidence: 88/100** — clear patterns exist; minor open item is sourcing `interruptionCount` client-side at evaluation time (available via `sessions.getOrCreateActive()` but not currently cached in hook).

## Detailed Findings

### 1. Check-in flow after cycle end

Authenticated WORK cycles follow a strict gate sequence:

1. Timer expires → `state = "completed"` (`use-pomodoro-cycle.ts:185–194`)
2. `CycleCompleteOverlay` shown (`pomodoro-dashboard.tsx:172–183`)
3. User confirms → `onCycleCompleteConfirm` sets `awaitingCheckIn = true` for WORK + authenticated (`use-pomodoro-cycle.ts:863–884`)
4. `CheckInOverlay` captures energy (`check-in-overlay.tsx:68–80`)
5. `submitCheckIn` persists energy, completes cycle, starts break, fetches suggestion (`use-pomodoro-cycle.ts:889–929`)

**Guest path:** `mode === "guest"` skips check-in entirely (`use-pomodoro-cycle.ts:873–880`). `GuestPomodoroDashboard` does not pass `enableCheckInGate` (`pomodoro-dashboard.tsx:249–252`). S-16 should follow the same authenticated-only rule.

**Mid-cycle path:** `onMidCycleEndCycleAndBreak` also sets `awaitingCheckIn` for authenticated WORK cycles (`use-pomodoro-cycle.ts:932–974`). Wind-down should apply to **both** normal and mid-cycle check-in submissions via the shared `submitCheckIn` handler.

### 2. Session model: cycles, interruptions, end APIs

**Schema** (`prisma/schema.prisma:65–80`):

- `Session.interruptionCount` — persisted, incremented on `cycle.rebindTask` (always) and `cycle.complete` with `incrementInterruption: true` (`cycle.ts:172–179`, `252–258`)
- **No `cyclesCompleted` column** — derived by counting `Cycle` rows where `kind = WORK` and `state = COMPLETED`

**Client state:**

- `completedWorkCycles` tracked in hook (`use-pomodoro-cycle.ts:107`, refreshed via `cycle.countCompletedWork` at `330–346`)
- `interruptionCount` **not** cached in hook; available on `DomainSession` from `sessions.getOrCreateActive()` (`types.ts:27–35`, hook usage at `611`)

**Session end:**

- User-initiated: `session.end` tRPC (`session.ts:39–72`) wired through `pomodoro.endSession()` (`use-pomodoro-cycle.ts:984–1017`)
- UI: plain `end-session-btn` button (`pomodoro-dashboard.tsx:199–208`), disabled while running
- Timeout: 4h inactivity via `active-session.ts:7–36`

**Scoring alignment** (`suggestion.ts:65–80`, `score-task.ts:29–44`):

- `completedWorkCycles >= 4` → fatigue penalty (especially DEEP_WORK)
- `interruptionCount > 0` → work-type-specific adjustments (capped at 4)

Wind-down thresholds should reuse these same signals for consistent rationale copy.

### 3. Overlay/modal patterns

| Pattern | Component | Z-index | Dismiss model |
|---------|-----------|---------|---------------|
| Check-in gate | `check-in-overlay.tsx` | `z-[60]` | Must submit energy |
| First-run | `first-run-overlay.tsx` | `z-[55]` | `onDismiss` callback |
| Cycle complete | `cycle-complete-overlay.tsx` | `z-50` | Confirm actions |
| S-19 override ack | inline banner | N/A | Auto 3s (`override-ack-copy.ts`) |
| Suggestion card | `task-suggestion-card.tsx` | inline (not modal) | Accept/override |

**Orchestrator rule** (`roadmap.md:658`): at most **one interstitial + one gate** per transition. Wind-down is a **gate** (blocking); suggestion card is inline during break. Sequence must be:

```
check-in gate → [wind-down gate if triggered] → break starts → suggestion card (inline)
```

Do **not** show wind-down concurrently with `CheckInOverlay`. Hide `CycleCompleteOverlay` while `awaitingCheckIn` (existing pattern at `pomodoro-dashboard.tsx:172`).

**S-19 override ack** is orthogonal — it fires on break override, not on wind-down decline. No conflict if wind-down resolves before `fetchSuggestion`.

**Reference overlay for S-16:** `FirstRunOverlay` (dismissible dialog with primary/secondary actions) + `CheckInOverlay` (gate that blocks transition). Proposed `WindDownOverlay` at `z-[58]` (between first-run and check-in).

### 4. Scoring/session context inputs for rationale

Reuse `ScoringContext` shape (`score-task.ts:3–9`) and `buildRationale` keys (`rationale.ts:12–33`) for the one-line wind-down rationale:

- **Fatigue path:** `fatigue` key — "energy dipping after N cycles"
- **Interruption path:** `interruptions` key — "session had several interruptions"
- **Combined:** prefer the dominant signal (mirror `dominant-factor.ts` magnitude logic)

New pure module recommended: `src/lib/session/wind-down-nudge.ts`

```typescript
// Pseudocode — not implementation
shouldShowWindDownNudge({ energy, completedWorkCycles, interruptionCount, dismissed })
buildWindDownRationale({ completedWorkCycles, interruptionCount })
```

**Cycle-count timing nuance:** At `submitCheckIn` evaluation time, the current work cycle is not yet `COMPLETED`. Use `completedWorkCycles >= 3` to mean "this cycle will be the 4th completed" — matching what `suggestion.next` sees after `confirmComplete`.

### 5. Guest vs authenticated paths

| Concern | Authenticated | Guest |
|---------|---------------|-------|
| Check-in | Yes (`enableCheckInGate`) | Skipped |
| Suggestion | Yes (`enableSuggestionGate`) | Hidden |
| Wind-down (S-16) | **Implement here** | **Skip** |
| Session end | `session.end` tRPC | `guest-repositories.end()` |
| `interruptionCount` | Server session | Guest blob (`guest/schema.ts:27`) but not incremented on guest complete/rebind today |

Guest wind-down is out of scope for MVP — no Fading energy signal exists without check-in.

### 6. E2E test patterns

**Existing coverage:**

| Flow | Spec | Helpers |
|------|------|---------|
| Check-in gate | `e2e/seed.spec.ts`, `e2e/pomodoro-cycle.spec.ts` | `completeCheckIn`, `completeWorkCycleWithCheckIn` |
| Suggestion | `e2e/task-suggestion.spec.ts` | `waitForSuggestionNext`, `expectSuggestionVisible` |
| S-19 override | `e2e/task-suggestion.spec.ts` (override test) | inline `suggestion-override-ack` assertions |
| Session end | **None** | `idle-cycle.ts` clicks `end-session-btn` for cleanup only |

**S-16 E2E plan (for `/10x-plan`):**

- New spec modeled on `seed.spec.ts` + `task-suggestion.spec.ts`
- Use `completeCheckIn(page, "fading")` after fast-clock cycles
- New test IDs: `wind-down-overlay`, `wind-down-keep-going-btn`, `wind-down-end-session-btn`
- Prove: nudge appears when Fading + ≥4 cycles; suppressed after Keep going until next check-in; suggestion card appears only after gate resolves
- Prove negative: Steady/Focused check-in → no nudge

## Code References

- `src/hooks/use-pomodoro-cycle.ts:889-929` — `submitCheckIn`: primary insertion point
- `src/hooks/use-pomodoro-cycle.ts:115-118` — `awaitingCheckIn` / `pendingMarkTaskDone` gate state pattern to mirror
- `src/hooks/use-pomodoro-cycle.ts:984-1017` — `endSession` for "End session" action
- `src/app/_components/pomodoro-dashboard.tsx:69-72` — `showSuggestionCard` visibility (defer until wind-down resolves)
- `src/app/_components/pomodoro-dashboard.tsx:185-197` — check-in overlay mount point; wind-down mounts adjacent
- `src/app/_components/check-in-overlay.tsx:40-84` — gate overlay pattern
- `src/app/_components/first-run-overlay.tsx:11-41` — dismissible dialog pattern
- `src/server/api/routers/check-in.ts:16-40` — energy persistence
- `src/server/api/routers/suggestion.ts:65-80` — scoring context assembly
- `src/lib/scoring/score-task.ts:29-44` — fatigue/interruption thresholds
- `src/lib/scoring/rationale.ts:21-28` — rationale copy for wind-down line
- `src/server/api/routers/session.ts:39-72` — session end API
- `e2e/helpers/check-in.ts` — `completeCheckIn` helper to extend
- `e2e/helpers/work-cycle.ts:122-132` — integrated cycle + check-in flow

## Architecture Insights

### Proposed state machine extension

Add to `use-pomodoro-cycle`:

| State | Type | Reset |
|-------|------|-------|
| `awaitingWindDown` | `boolean` | On resolve or session end |
| `windDownDismissed` | `boolean` | On `endSession`, new session, or explicit Keep going |
| `windDownRationale` | `string \| null` | Set when gate opens |

**Modified `submitCheckIn` flow:**

1. `createCheckIn.mutateAsync({ cycleId, energy })`
2. `setAwaitingCheckIn(false)`
3. Fetch session for `interruptionCount` (or cache from last `getOrCreateActive`)
4. If `shouldShowWindDownNudge(...)` → `setAwaitingWindDown(true)`; **return** (defer steps 5–6)
5. `confirmComplete(markTaskDone)` — cycle complete + break start
6. `fetchSuggestion(workCycleId)`

**Wind-down actions:**

- **Keep going:** `setWindDownDismissed(true)`, `setAwaitingWindDown(false)`, then run steps 5–6
- **End session:** `setAwaitingWindDown(false)`, run `confirmComplete` if needed, then `endSession()` (reuses existing interrupt + `sessions.end()`)

No new tRPC procedure required for MVP — evaluation is client-side pure function using existing session/cycle data. Optional future: server-side `windDown.evaluate` if tamper-proofing needed.

### UI placement

`pomodoro-dashboard.tsx` — after `CheckInOverlay` block (~197), before `end-session-btn`:

```tsx
{enableWindDownGate && pomodoro.awaitingWindDown && (
  <WindDownOverlay
    rationale={pomodoro.windDownRationale}
    onKeepGoing={...}
    onEndSession={...}
  />
)}
```

Gate `enableWindDownGate` alongside `enableCheckInGate` in `AuthenticatedPomodoroDashboard` only.

### Transition timing rule

Per user decision proxy and roadmap orchestrator rule:

- Show nudge **after check-in completes** (energy saved, check-in overlay closes)
- Show nudge **before suggestion card** (defer `fetchSuggestion` until gate resolves)
- Break may start after gate resolves (not before) — keeps "one gate at a time"

Alternative (break starts, nudge overlays break timer) is viable but violates strict "before suggestion" ordering and risks stacking with suggestion loading state.

## Historical Context (from prior changes)

- `context/archive/2026-06-08-suggestion-override-acknowledgement/plan.md` — S-19 shipped post-check-in override ack as inline banner; kickoff ack deferred to S-15. Wind-down decline is **not** an override ack — use invitational copy, not S-19 `OVERRIDE_ACK_LINE`.
- `context/foundation/roadmap.md:414-427` — S-16 unknowns resolved by this research (trigger combo, session-scoped dismiss).
- `context/foundation/roadmap.md:526-527` — S-21 mindful transition copy must not duplicate S-16 preachiness; coordinate copy tone in `/10x-plan`.
- `context/foundation/prd.md:124-125` — PRD explicitly notes check-in fatigue as session-end signal.

## Related Research

- No prior `research.md` for wind-down (first research for this change).
- S-15 (`session-kickoff-suggestion`) — parallel slice, no research artifact in this worktree yet.

## S-15 Parallel Slice Conflict Risk

S-15 and S-16 are explicitly parallel (`roadmap.md:401`, stream G). S-15 is **ready** but no sibling worktree was found in `d:\repos\10xdev` at research time.

| Surface | S-15 (kickoff) | S-16 (wind-down) | Conflict |
|---------|----------------|------------------|----------|
| Transition beat | Idle / break-end without pre-focus | Post-check-in Fading gate | **Low** — different triggers |
| `use-pomodoro-cycle.ts` | May add kickoff suggestion fetch on idle | Adds wind-down gate in `submitCheckIn` | **Medium** — same file, different functions |
| `pomodoro-dashboard.tsx` | Kickoff suggestion card on idle | `WindDownOverlay` after check-in | **Medium** — same file, different render blocks |
| `suggestion.ts` / scoring | Possible `suggestion.next` fork for kickoff | Reuses existing rationale helpers | **Low–Medium** — only if S-15 modifies scoring router |
| E2E | New kickoff spec | New wind-down spec | **Low** — separate spec files |

**Mitigation:** Implement S-16 in isolated functions (`wind-down-nudge.ts`, `WindDownOverlay.tsx`); touch `submitCheckIn` with minimal diff; coordinate merge order if S-15 lands first (rebase on `pomodoro-dashboard.tsx`).

Functional overlap risk is **low** — kickoff fires on idle cold-start, wind-down fires only on Fading post-check-in. UX rule conflict only if both try to show suggestion surfaces on the same beat (they should not).

## Open Questions

1. **Mid-cycle check-in wind-down:** Should mid-cycle "end cycle and break" → Fading check-in also trigger wind-down? Research assumes **yes** (same `submitCheckIn` path) — confirm in `/10x-plan`.
2. **End session during wind-down:** Should cycle completion + break start happen before `endSession`, or end immediately without break? MVP default: complete current cycle (already in flight), skip break/suggestion, call `endSession`.
3. **Server persistence of dismiss:** MVP uses in-memory session flag. If user refreshes mid-break, nudge could reappear — acceptable for MVP or add session-scoped server flag later?
4. **S-12 visual polish:** Wind-down overlay styling may need S-12 design tokens — ship functional overlay first, polish in S-12 if active.

## Recommended File Touch List (for `/10x-plan`)

| Action | Path |
|--------|------|
| **Create** | `src/lib/session/wind-down-nudge.ts` + `*.test.ts` |
| **Create** | `src/app/_components/wind-down-overlay.tsx` |
| **Modify** | `src/hooks/use-pomodoro-cycle.ts` — gate state + `submitCheckIn` branch |
| **Modify** | `src/app/_components/pomodoro-dashboard.tsx` — mount overlay, gate suggestion |
| **Create** | `e2e/mindful-session-wind-down.spec.ts` (or similar) |
| **Extend** | `e2e/helpers/check-in.ts` — optional wind-down helper |
| **No change** | `prisma/schema.prisma`, `session.ts` router (MVP) |
