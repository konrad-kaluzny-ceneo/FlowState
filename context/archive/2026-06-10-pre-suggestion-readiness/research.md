---
date: 2026-06-10T12:00:00+02:00
researcher: Cursor Agent
git_commit: c2933ee
branch: features/pre-suggestion-readiness
repository: FlowState
topic: "S-25 pre-suggestion readiness — STEADY hardcoding, check-in reuse, suggestion.next energy input"
tags: [research, codebase, suggestion, check-in, kickoff, S-25]
status: complete
last_updated: 2026-06-10
last_updated_by: Cursor Agent
---

# Research: S-25 Pre-suggestion readiness gate

**Date**: 2026-06-10  
**Branch**: features/pre-suggestion-readiness  
**Change**: pre-suggestion-readiness (FLO-58 / #79)

## Research Question

Where is STEADY hardcoded for kickoff and post-check-in suggestion paths? Can S-05 check-in UI be reused? How does `suggestion.next` accept energy today? How to coordinate with the check-in gate? Guest vs auth persistence? Which tests to extend?

## Summary

**Kickoff** is the real gap: `suggestion.next` kickoff branch hardcodes `energy: "STEADY"`, and the client auto-fetches kickoff suggestions with no readiness UI. **Post-check-in** already feeds declared energy from the mandatory `CheckIn` row — the S-05 overlay *is* the pre-suggestion readiness for that path; adding a second gate would violate roadmap risk Q2.

**Recommended approach:** Extract shared energy button group from `CheckInOverlay`; add `awaitingKickoffReadiness` state in `use-pomodoro-cycle`; show readiness overlay (copy tuned for kickoff) with **Skip (Steady)** before `fetchKickoffSuggestion`; extend kickoff input schema with required `energy`; do **not** write a `CheckIn` row on skip. Authenticated-only; no guest changes.

## Detailed Findings

### 1. STEADY hardcoding locations

| Path | Energy source | Hardcoded STEADY? |
|------|---------------|-------------------|
| Kickoff `suggestion.next` | `buildScoringContextForSession(..., "STEADY")` at `suggestion.ts:224-229` | **Yes** |
| Post-check-in `suggestion.next` | `cycle.checkIn.energy` at `suggestion.ts:156-161` | **No** |
| Client kickoff fetch | `mutateAsync({ context: "kickoff", sessionId, localHour })` — no energy | **Implicit STEADY via server** |
| Client post-check-in fetch | After `checkIn.create(energy)` in `submitCheckIn` | **No** |

Only production STEADY literal: `suggestion.ts:229`.

### 2. S-05 check-in gate / reusable UI

- **Component:** `src/app/_components/check-in-overlay.tsx` — modal with three energy buttons, `CheckInEnergy` type, test IDs reused by `e2e/helpers/check-in.ts`.
- **Wiring:** `pomodoro-dashboard.tsx:331-357` renders overlay when `enableCheckInGate && awaitingCheckIn && activeCycle`.
- **Hook:** `submitCheckIn` (`use-pomodoro-cycle.ts:1653-1733`) persists via `checkIn.create`, then wind-down or `continueAfterCheckIn`.
- **Guest:** `GuestPomodoroDashboard` omits `enableCheckInGate` — guests skip check-in entirely (`onCycleCompleteConfirm` bypasses at line 1637).

**Reuse recommendation (88% confidence):** Extract `EnergySelector` (buttons + types + test IDs) from `CheckInOverlay`. Add `ReadinessOverlay` wrapper with kickoff-specific headline/subcopy + optional **Skip — use Steady** button. Keep post-cycle check-in overlay unchanged to avoid regressing B-04 transition semantics.

### 3. `suggestion.next` energy contract today

```typescript
// suggestion.ts — input union (lines 15-26)
post_check_in: { context, cycleId, localHour }  // energy from DB check-in
kickoff:         { context, sessionId, localHour } // energy hardcoded STEADY
```

**Proposed kickoff extension:**
```typescript
kickoff: { context, sessionId, localHour, energy: z.enum(["FOCUSED","STEADY","FADING"]) }
```

Post-check-in: **no schema change** — energy remains authoritative from `CheckIn` (FR-020). Optional future: pass `energy` override — rejected for S-25 (duplicates check-in).

### 4. Coordination rule (check-in vs readiness)

Roadmap risk: *"show pre-suggestion readiness only when no check-in gate is active."*

| Gate state | Show readiness? |
|------------|-----------------|
| `awaitingCheckIn` | **No** — check-in captures energy |
| `awaitingWindDown` | **No** |
| `isPostCheckInTransitioning` | **No** |
| Kickoff eligible (`idle`, no focus, `sessionStartIdleFlag` \| `postBreakIdleFlag`) | **Yes** — before first kickoff fetch |

`kickoffEligible` already includes `!awaitingCheckIn` (line 870). Implementation: replace eager `fetchKickoffSuggestion` in the eligibility `useEffect` with `setAwaitingKickoffReadiness(true)`; fetch only after energy selected or skip.

Post-check-in: **no new gate** — check-in overlay already declares energy before suggestion card loads during break.

### 5. Guest vs logged-in persistence

| Mode | Readiness | Persistence |
|------|-----------|-------------|
| Authenticated kickoff | New gate | In-memory session only; skip → STEADY for API call; **no CheckIn row** (85% confidence) |
| Authenticated post-check-in | Existing check-in | `CheckIn` row per cycle (Prisma `flow_state_check_in`) |
| Guest | N/A | No kickoff, no check-in, no suggestion |

Decision: skipped kickoff readiness does **not** write `CheckIn` — CheckIn is cycle-bound (`cycleId` unique). Session-level energy persistence deferred (not required for S-25 outcome).

### 6. Test touchpoints

| File | Extension |
|------|-----------|
| `src/server/api/routers/suggestion.test.ts` | Kickoff with `energy: "FOCUSED"` vs `"FADING"` changes `pickBestTask` winner; update line-570 test |
| `src/hooks/use-pomodoro-cycle.test.tsx` | Kickoff eligibility: no `suggestion.next` until readiness; skip → STEADY; energy forwarded in mutate payload |
| `src/app/_components/check-in-overlay.tsx` | Co-located smoke if extracting `EnergySelector` |
| `e2e/session-kickoff.spec.ts` | Intercept readiness overlay before card; update `waitForKickoffSuggestion` helper |
| `e2e/helpers/kickoff.ts` | Add `completeKickoffReadiness(page, energy \| 'skip')` |
| `e2e/task-suggestion.spec.ts` | Likely unchanged — post-check-in path unchanged |
| `e2e/helpers/suggestion.ts` | Unchanged unless post-check-in gate added (not recommended) |

**L-04 reminder:** Skip/energy tap must acknowledge within 200ms before awaiting network (disable buttons + optimistic overlay dismiss).

## Gaps vs S-25 outcome

| Outcome requirement | Current state | Gap |
|---------------------|---------------|-----|
| Declare energy at session kickoff | Auto-fetch with STEADY | **New readiness gate + API `energy`** |
| Declare before post-check-in suggestion | Check-in at cycle end | **Met** — verify only, no new UI |
| Skippable Steady default | N/A kickoff | **Skip button → STEADY** |
| Feeds scorer not hardcoded STEADY | Kickoff hardcoded | **Server + client pass-through** |
| Same control as S-05 | CheckInOverlay exists | **Extract + reuse** |

## Recommended approach

1. **API:** Add required `energy` to kickoff branch of `nextInputSchema`; replace `"STEADY"` literal with `input.energy`.
2. **Hook:** `awaitingKickoffReadiness` + `submitKickoffReadiness(energy)` + `skipKickoffReadiness()`; defer `fetchKickoffSuggestion(sessionId, energy)`.
3. **UI:** Parameterized readiness overlay (reuse energy buttons); mount in `pomodoro-dashboard.tsx` when `awaitingKickoffReadiness && !awaitingCheckIn`.
4. **Post-check-in:** Document as satisfied by S-05; no duplicate gate.
5. **Copy:** Kickoff headline e.g. "How's your energy to start?" + Skip (Steady).

**Inline chips on TaskSuggestionCard:** Rejected (82%) — breaks loading-state UX (card shows skeleton while fetching); full-screen gate matches check-in pattern and roadmap "same control as S-05."

## Open questions (with decisions)

| Question | Decision | Confidence |
|----------|----------|------------|
| Reuse overlay vs inline chips? | **Extract energy selector; overlay for kickoff** | 88% |
| Skip writes CheckIn row? | **No — pass STEADY to API only** | 85% |
| Post-check-in second gate? | **No — check-in is the gate** | 92% |
| Guest readiness? | **Out of scope** | 92% |
| Post-break kickoff uses last check-in energy? | **No — user re-declares at kickoff idle** | 80% |
| Kickoff rationale reflects energy? | **Task selection changes; rationale keys stay kickoff_fresh/resume** | 78% |

## Risks

1. **Double energy prompt** — Mitigated by gating readiness only when `!awaitingCheckIn`.
2. **Eager fetch regression** — Kickoff e2e assumes immediate `suggestion.next`; helpers must wait for readiness first.
3. **CI suggestion-priority** — Keep separate `suggestionNextKickoff` mutation hook (S-15 lesson).
4. **NFR 200ms** — Readiness dismiss must be instant; fetch runs after (L-04).
5. **Post-break idle timing** — `postBreakIdleFlag` set in break confirm path; readiness must not flash during break-running state.

## Code References

- `src/server/api/routers/suggestion.ts:15-26` — input schema
- `src/server/api/routers/suggestion.ts:224-229` — STEADY hardcode
- `src/server/api/routers/suggestion.ts:127-161` — post-check-in energy from CheckIn
- `src/hooks/use-pomodoro-cycle.ts:757-793` — post-check-in fetch
- `src/hooks/use-pomodoro-cycle.ts:827-893` — kickoff eager fetch
- `src/hooks/use-pomodoro-cycle.ts:1653-1717` — submitCheckIn → continueAfterCheckIn
- `src/app/_components/check-in-overlay.tsx` — S-05 energy UI
- `src/app/_components/pomodoro-dashboard.tsx:87-98,331-357` — suggestion + check-in gates
- `src/server/api/routers/check-in.ts:16-40` — CheckIn persistence
- `prisma/schema.prisma:119-129` — CheckIn model (cycle-bound)
- `e2e/session-kickoff.spec.ts` — kickoff e2e
- `e2e/helpers/kickoff.ts` — kickoff wait helpers

## Historical Context

- `context/archive/2026-06-08-session-kickoff-suggestion/research.md` — S-15 chose synthetic STEADY for kickoff MVP; explicitly deferred user energy to later slice (now S-25).
- `context/foundation/roadmap.md` S-25 section — coordination rule, skip semantics unknowns.
- `context/foundation/lessons.md` L-04 — per-surface 200ms oracles.

## Related Research

- `context/archive/2026-06-08-session-kickoff-suggestion/research.md`
- `context/archive/2026-06-07-adaptive-task-suggestion/` (post-check-in suggestion shipped)
