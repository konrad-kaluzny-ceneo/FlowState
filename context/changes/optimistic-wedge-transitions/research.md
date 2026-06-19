---
date: 2026-06-19T08:00:00+02:00
researcher: Auto
git_commit: 5ff3eecf94fafac9becc78166bb62ca9c80399b4
branch: features/optimistic-wedge-transitions
repository: FlowState
topic: "S-34 optimistic wedge transitions — check-in → break → suggestion accept/override ≤200ms"
tags: [research, wedge, optimistic-ui, use-pomodoro-cycle, B-03, F-07, S-34]
status: complete
last_updated: 2026-06-19
last_updated_by: Auto
---

# Research: S-34 optimistic wedge transitions

**Date**: 2026-06-19  
**Researcher**: Auto  
**Git Commit**: `5ff3eecf94fafac9becc78166bb62ca9c80399b4`  
**Branch**: `features/optimistic-wedge-transitions`  
**Repository**: FlowState

## Research Question

How should S-34 implement optimistic wedge transitions (check-in → suggestion accept/override and break handoff ≤200ms) on the authenticated wedge path, mirroring B-03 patterns, after F-07 conductor is in place?

## Summary

FlowState has two established optimistic patterns: **B-03** (local React state in `use-pomodoro-cycle` for auth start/interrupt) and **S-09** (tRPC `onMutate` + TanStack Query cache for task CRUD). The **wedge path** (check-in submit, break handoff, suggestion accept) remains **sequential and pessimistic** — each step `await`s server mutations before advancing UI.

S-34 should extend the **B-03 hook-local pattern** (not S-09 query-cache) because wedge state lives in `use-pomodoro-cycle`, not in a list cache. Kickoff readiness (S-25) already dismisses its overlay within 200ms before fetch — that is overlay-dismiss optimism only, not full mutation optimism.

**Recommended v1 scope:** post-check-in path only (`submitCheckIn` → break running → suggestion card ready; `acceptSuggestion` non-blocking). Kickoff `suggestion.next` already has L-04 dismiss tests. Guest wedge is auth-only by design — guest break handoff stays local-repo-fast; no check-in/suggestion gates.

**Server ordering constraint:** `suggestion.next` with `post_check_in` requires persisted check-in — optimistic UI can dismiss check-in and start break immediately, but suggestion fetch must wait for check-in persistence (or queue/retry).

## Detailed Findings

### B-03 — Optimistic cycle start/interrupt

**File:** `src/hooks/use-pomodoro-cycle.ts`

- Temp negative cycle IDs via `allocateOptimisticCycleId()` (lines ~163–168)
- Auth-only optimistic start: immediate `setActiveCycle` + `setState("running")` + worker before `cycles.create` resolves (~1460–1496)
- Rollback via `rollbackOptimisticStart()` and interrupt snapshots (~1529–1735)
- `resolveServerCycleId()` awaits `pendingCreateRef` when mutations need real ID (~421–443) — critical for check-in path after optimistic start
- Tests: deferred-mock oracles at ~469, ~564, ~705 in `use-pomodoro-cycle.test.tsx`

### S-09 — Optimistic task mutations (reference only)

**File:** `src/hooks/use-task-mutations.ts`

- Pattern: `cancel` → snapshot `previousTasks` → `setQueryData` → rollback on error → `invalidate` on settle
- Guest bypass: direct `taskRepo.*` without tRPC lifecycle
- S-09 explicitly excluded cycle and wedge mutations — deferred to B-03 and S-34

### F-07 — Wedge transition conductor

**File:** `src/lib/wedge/transition-conductor.ts`

- Single gate per beat via `GATE_PRIORITY`: closure > wind-down > check-in > cycle_intention > kickoff_readiness > cycle_complete
- Pause suppresses all gates (pol-12)
- Return handoff blocks kickoff readiness (pol-10)
- Dashboard renders gates from `resolveWedgeBeat()` in `pomodoro-dashboard.tsx`
- F-07 plan explicitly excluded S-34 optimism — conductor must be stable first (now done)

### Pessimistic wedge surfaces (S-34 targets)

| Surface | Location | Current behavior |
|---------|----------|------------------|
| Check-in submit | `use-pomodoro-cycle.ts` ~2266–2353 | `await createCheckIn.mutateAsync()` before UI advance |
| Break handoff | ~2121–2158, `continueAfterCheckIn` | `await confirmComplete` + `startBreakAfterWorkComplete` before break UI |
| Suggestion fetch | ~1045–1118 | `pendingSuggestion: loading` until `suggestion.next` resolves |
| Suggestion accept | ~1341–1360 | `preFocusTask` sync, but `await recordSuggestionDecision` blocks button |
| Override | ~1281–1315 | Already sync ack + fire-and-forget `recordDecision` |

**Partial optimism today:** `isPostCheckInTransitioning` suppresses cycle-complete flash (B-04); kickoff readiness dismisses within 200ms (S-25/L-04).

### tRPC routers

| Router | Procedures | Wedge role |
|--------|------------|------------|
| `check-in.ts` | `create` | Persist energy per cycle; P2002 → CONFLICT |
| `suggestion.ts` | `next`, `recordDecision` | Post-check-in suggestion + decision audit |
| `cycle.ts` | `create`, `complete`, `interrupt`, `pause`, `resume` | Break handoff after WORK complete |

`suggestion.next` post_check_in validates check-in exists server-side before scoring.

### Guest vs authenticated

| Capability | Guest | Auth |
|------------|-------|------|
| Wedge gates | Off (`GuestPomodoroDashboard`) | On |
| Cycle start | Pessimistic local repo | B-03 optimistic |
| WORK cycle end | Skips check-in → direct `confirmComplete` | Full wedge |
| Suggestion UI | None | Kickoff + post-check-in |

S-34 "guest parity where applicable" means local-repo break handoff stays fast — not adding wedge gates to guest.

### 200ms NFR coverage

**Tested:** optimistic start/interrupt (B-03); kickoff readiness dismiss (L-04, tests ~2674–2762).

**Not tested:** `submitCheckIn` dismiss, break start before `completeCycle`/`createBreak`, `acceptSuggestion` before `recordDecision`.

**Test pattern (test-plan §6.8):** deferred-mock oracle — assert state transition before mutation promise resolves; rollback on rejection.

## Code References

- `src/hooks/use-pomodoro-cycle.ts:1411-1584` — B-03 optimistic start
- `src/hooks/use-pomodoro-cycle.ts:2121-2353` — post-check-in chain (S-34 primary)
- `src/hooks/use-pomodoro-cycle.ts:1341-1387` — suggestion accept/kickoff accept
- `src/lib/wedge/transition-conductor.ts:61-113` — gate priority matrix
- `src/app/_components/check-in-overlay.tsx:41` — submit blocking (`disabled={isSubmitting}`)
- `src/app/_components/task-suggestion-card.tsx:167-199` — loading/accept UX
- `src/server/api/routers/suggestion.ts:148-445` — next + recordDecision
- `src/hooks/use-pomodoro-cycle.test.tsx:1550-1601` — post-check-in ordering tests
- `src/hooks/use-pomodoro-cycle.test.tsx:2674-2762` — L-04 200ms readiness oracles

## Architecture Insights

1. **Use B-03 pattern for S-34**, not S-09 — wedge state is hook-local with snapshot rollback refs, same as cycles.
2. **Preserve server ordering** — optimistic UI can advance gates, but `suggestion.next` must await check-in persistence; implement retry/queue on failure (S-35 bundle).
3. **Conductor invariants** — optimistic transitions must not violate ≤1 gate + ≤1 interstitial; `isPostCheckInTransitioning` already handles B-04 flash suppression.
4. **`resolveServerCycleId`** must remain in check-in path when optimistic start still pending.
5. **Wind-down branch (S-16/B-07)** interleaves in `submitCheckIn` — design optimistic path to not race with wind-down gate opening.

## Historical Context (from prior changes)

- `context/archive/2026-06-07-optimistic-task-mutations/` — S-09 scoped task CRUD only; deferred all cycle/wedge optimism
- `context/archive/2026-06-09-fix-title-multiline-and-cycle-optimistic/` — B-03 shipped start/interrupt; deferred check-in/suggestion accept
- `context/archive/2026-06-10-pre-suggestion-readiness/` — S-25 overlay dismiss ≤200ms; not full wedge mutation optimism
- `context/archive/2026-06-18-wedge-transition-conductor/` — F-07 conductor; explicitly excluded S-34 from same PR
- `context/changes/fix-stale-suggestion-after-delete/` — separate correctness fix for suggestion snapshot vs task list (not S-34 latency)

**Lineage:** S-09 → B-03 → S-25 (dismiss only) → F-07 → **S-34 (+ S-35 recovery bundle)**

## Related Research

- `context/foundation/roadmap-references/items/S-34.md` — slice outcome + open scope questions
- `context/foundation/roadmap-references/items/S-35.md` — network recovery bundle under optimistic path
- `context/foundation/test-plan.md` — risk #9 optimistic wedge; §6.8 deferred-mock cookbook
- `context/foundation/user-flow.md` — authenticated vs guest wedge paths

## Open Questions (for `/10x-plan`)

1. **Scope v1:** post-check-in only vs also kickoff `suggestion.next` accept? (Kickoff readiness already has 200ms dismiss — recommend post-check-in + acceptSuggestion only for v1.)
2. **Wind-down race:** when check-in triggers B-07 wind-down, should optimism be suppressed until user picks keep going/end session?
3. **Rollback UX:** reuse `pomodoro-error` toast pattern from B-03 or dedicated wedge recovery surface (defer full recovery UI to S-35)?
4. **E2E:** unit deferred-mock sufficient per test-plan §6.8; belt e2e only if hook cannot observe perceived latency.

**Planning confidence:** 85% — sufficient to proceed to `/10x-plan`.
