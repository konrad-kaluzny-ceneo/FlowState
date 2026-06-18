# Wedge Transition Conductor (F-07) Implementation Plan

## Overview

Foundation refactor: pure `transition-conductor` module enforces at most one blocking gate per wedge beat; integrates pol-10 (return handoff defers kickoff); includes B-07 wind-down threshold fix in same branch.

## Current State Analysis

Scattered `show*` guards in `pomodoro-dashboard.tsx` and partial mutex in `use-pomodoro-cycle.ts`. B-05/B-06 fixed closure stacking and timeout-on-load; T-06 (handoff vs kickoff) and full OQ2 matrix remain.

## Desired End State

1. Single priority oracle in `src/lib/wedge/transition-conductor.ts`
2. Dashboard renders overlays from conductor output only
3. `kickoffEligible` uses `computeKickoffEligible` including `returnHandoffGateOpen`
4. Wind-down triggers after 3rd completed work cycle at check-in (B-07)
5. Belt green; pol-10 e2e assertion

## What We're NOT Doing

- Optimistic wedge (S-34), mindful copy (S-21), pause (S-24)
- Hook decomposition (K1) — separate change
- Replacing DOM suppression in `return-handoff-banner-mount` (belt-stable)

## Phase 1: Conductor mechanism (pure module)

### Overview

Add pure priority matrix with no React imports.

### Changes Required

#### 1. Transition conductor module

**File**: `src/lib/wedge/transition-conductor.ts` (new)

**Intent**: `resolveWedgeBeat(input)` returns which gate overlays may render; `computeKickoffEligible(input)` centralizes kickoff preconditions including pol-10.

**Contract**: No React imports. Priority: handoff block > closure > wind-down > check-in > cycle intention > kickoff > cycle complete.

#### 2. Unit tests

**File**: `src/lib/wedge/transition-conductor.test.ts` (new)

**Intent**: Oracle for closure vs kickoff, handoff blocks kickoff, wind-down vs check-in.

### Success Criteria

#### Automated Verification

- [ ] `pnpm exec vitest run src/lib/wedge/transition-conductor.test.ts` passes
- [ ] `pnpm check` passes

---

## Phase 2: Dashboard enforcement

### Overview

Replace scattered overlay guards with conductor output.

### Changes Required

#### 1. Dashboard integration

**File**: `src/app/_components/pomodoro-dashboard.tsx`

**Intent**: Call `resolveWedgeBeat` once; gate overlay JSX from result. Preserve all `data-testid` contracts.

#### 2. Component tests

**File**: `src/app/_components/pomodoro-dashboard.test.tsx`

**Intent**: Update/add parity cases for conductor-driven guards.

### Success Criteria

#### Automated Verification

- [ ] `pnpm exec vitest run src/app/_components/pomodoro-dashboard.test.tsx` passes
- [ ] `pnpm test` passes

---

## Phase 3: Hook integration (pol-10 + B-07)

### Overview

Wire conductor kickoff eligibility and fix wind-down cycle threshold.

### Changes Required

#### 1. Return handoff gate in hook

**File**: `src/hooks/use-pomodoro-cycle.ts`

**Intent**: Query `session.getLastEnded`; compute `returnHandoffGateOpen`; use `computeKickoffEligible`.

#### 2. B-07 wind-down threshold

**File**: `src/hooks/use-pomodoro-cycle.ts`

**Intent**: At check-in submit, evaluate wind-down with `completedWorkCycles + 1` (work cycle completing).

#### 3. Hook tests

**File**: `src/hooks/use-pomodoro-cycle.test.tsx`

**Intent**: pol-10 — handoff gate open → no `awaitingKickoffReadiness`.

#### 4. E2E pol-10

**File**: `e2e/session-return-handoff.spec.ts`

**Intent**: Assert no kickoff overlay while handoff visible; optional after dismiss.

### Success Criteria

#### Automated Verification

- [ ] `pnpm test` passes
- [ ] `set CI=true && pnpm test:e2e:belt` passes

#### Manual Verification

- [ ] No overlay stacking on closure / handoff / kickoff paths

---

## References

- `context/changes/wedge-transition-conductor/research.md`
- `context/foundation/roadmap-references/flow-coherence-recommendations.md`
- `context/foundation/user-flow.md` T-06

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Conductor mechanism (pure module)

#### Automated

- [x] 1.1 Add `transition-conductor.ts` with priority matrix
- [x] 1.2 Add `transition-conductor.test.ts` oracle

### Phase 2: Dashboard enforcement

#### Automated

- [x] 2.1 Integrate conductor in `pomodoro-dashboard.tsx`
- [x] 2.2 Update dashboard component tests

### Phase 3: Hook integration (pol-10 + B-07)

#### Automated

- [x] 3.1 Wire `computeKickoffEligible` + return handoff gate in hook
- [x] 3.2 B-07 wind-down threshold at check-in
- [x] 3.3 Hook pol-10 test + e2e handoff/kickoff sequence

#### Manual

- [ ] 3.4 Smoke: handoff → dismiss → kickoff on local dev
