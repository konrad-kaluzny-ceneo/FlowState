# Refactor opportunities — Rollout Implementation Plan

## Overview

Translate the verified research ranking (K5 → K1 → K2) into a **sequenced rollout** of child changes. This change-id (`refactor-opportunities`) does **not** modify `src/` directly — it owns the rollout contract, decision log, and handoff checkpoints. Each ranked refactor ships in its own change folder aligned with existing roadmap IDs where they exist.

## Current State Analysis

Research (`research.md`, verified V1–V30) identified **5 structural candidates**; top-3 ranked for implementation:

| Rank | Candidate | Roadmap / child change-id | Status on disk |
|------|-----------|---------------------------|----------------|
| 1 | K5 wedge gate orchestration | `fix-closure-kickoff-mutex` (B-05) → `fix-timeout-closure-on-load` (B-06) → `wedge-transition-conductor` (F-07) | Proposed; no change folders yet |
| 2 | K1 monolithic hook | `cycle-hook-pure-extracts` (new) after F-07 | Not started |
| 3 | K2 data-mode ACL | `data-mode-acl-hardening` (new) | Not started |

Deferred: K3 guest merge consolidation, K4 sign-in schema (optional parallel quick win), Path B full React Query unification.

### Key Discoveries:

- T-01 mutex gap confirmed at `pomodoro-dashboard.tsx:371–375` vs `:390–395` (V21–V22) — active product bug; B-05 is P0.
- F-07 conductor does not exist (`0` `*conductor*` files, V20); roadmap Stream N blocks S-21, S-34, S-35 until F-07 merges.
- `data-mode-context` has zero tests (V28) — blocks safe K2/K3 refactors; must land before ACL shape changes.
- Hook monolith (2357 LOC, 63 return fields, 19 fan-out) is load-bearing (S-01); decomposition stays behind stable `usePomodoroCycle` facade.
- Existing pure modules (`derive-gate`, `wind-down-nudge`, `narrative-builder`, `timer-worker-logic`) are the extraction pattern for K1.

## Desired End State

A documented, executed rollout where:

1. **B-05 + B-06** ship calm closure (T-01, T-03) without waiting for full F-07.
2. **F-07** centralizes wedge beat priority in a pure `src/lib/wedge/` module; dashboard scattered `&&` guards consume conductor output.
3. **`data-mode-context.test.tsx`** exists and gates further ACL refactors (K2 Path C).
4. **K1 pure extracts** (`cycleEndTimeMs`, shared `isBreakKind`) land with co-located tests and zero return-API churn.
5. Child change folders each have their own `plan.md` / implementation; this folder's Progress tracks handoffs, not feature code.

### Verification

- `rollout.md` lists every child change-id with status, prerequisite, and handoff command.
- Roadmap Stream N sequence in `roadmap.md` matches rollout order (no contradiction).
- First implementation handoff (`fix-closure-kickoff-mutex`) is ready to `/10x-new`.

## What We're NOT Doing

- Implementing B-05, F-07, or ACL refactors **inside** `refactor-opportunities/` (wrong change-id).
- Path B — full React Query unification of the hook (rejected in research; blast radius too high).
- Splitting `usePomodoroCycle` into multiple public hooks (63-field API change — separate future analysis).
- Guest/auth gate unification (product redesign, not structural refactor).
- B-08 graceful session end while running (Stream N phase 5; after S-24 full variant — separate change).
- K3 guest merge entry-point consolidation in this rollout (deferred; core already shared via `importGuestSnapshot`).
- Changing `refreshGuest` / `refreshKey` behavior without a dedicated design (unknown intent, V10).

## Implementation Approach

**Meta-rollout with roadmap-aligned child changes.** Each phase either publishes rollout artifacts (this folder) or completes a handoff checkpoint (child change opened, researched, planned, implemented, merged). Implementation work always happens in child change folders on `features/<change-id>` branches.

**F-07 conductor placement (decided):** Pure module at `src/lib/wedge/transition-conductor.ts` (and co-located tests), following `src/lib/catch-up/derive-gate.ts`. Hook keeps gate **state** and transitions; conductor owns **priority matrix** (`isGateActive`, interstitial suppression). Dashboard reads conductor output instead of ad-hoc `show*` combinatorics.

**B-05 kickoff abort (decided):** `kickoffFetchGenRef` increment at effect start; async `getOrCreateActive` callback checks generation before `setAwaitingKickoffReadiness(true)` — mirrors in-flight guard patterns in `suggestion-priority.ts`.

**K2 path (decided):** Path C first — unify auth/guest task reads via extended `useDomainTasks(mode)`; Path A (extend repos for `checkIn`/`suggestion`) only after F-07 stabilizes hook mutations.

**OQ2 beat priority (decided for F-07 plan):** closure > wind-down > check-in > suggestion accept > kickoff readiness > in-flow narrative line > catch-up overlay (catch-up remains header shell per S-22; conductor coordinates with `deriveCatchUpGate` inputs).

## Critical Implementation Details

**Handoff mutex:** Do not open `wedge-transition-conductor` until `fix-timeout-closure-on-load` (B-06) merges to main. Do not start S-34 optimistic wedge before F-07 (flow-coherence explicit).

**B-05 e2e gap:** Belt `session-closure.spec.ts` calls `dismissKickoffReadinessIfVisible` before end session — B-05 child plan must add belt assertion: end session → closure visible → dismiss → **no** `kickoff-readiness-overlay` on same visit.

## Phase 1: Rollout manifest & decision log

### Overview

Publish the child-change registry and freeze rollout decisions so downstream `/10x-new` handoffs use consistent change-ids.

### Changes Required:

#### 1. Rollout registry

**File**: `context/changes/refactor-opportunities/rollout.md`

**Intent**: Single table tracking each child change-id, rank, prerequisite, roadmap ID, handoff command, and status (`not started` | `opened` | `merged`).

**Contract**: Rows for at minimum: `fix-closure-kickoff-mutex`, `fix-timeout-closure-on-load`, `wedge-transition-conductor`, `data-mode-acl-hardening`, `cycle-hook-pure-extracts`; optional row `sign-in-schema-extract` (K4 parallel); deferred row `guest-merge-consolidation` (K3). Include decided F-07 module path and OQ2 priority order from this plan.

#### 2. Change status

**File**: `context/changes/refactor-opportunities/change.md`

**Intent**: Advance meta-change to `planned` after plan review.

**Contract**: `status: planned`, `updated: 2026-06-17`.

### Success Criteria:

#### Automated Verification:

- `context/changes/refactor-opportunities/rollout.md` exists and lists ≥5 child change-ids
- `context/changes/refactor-opportunities/plan.md` and `plan-brief.md` exist

#### Manual Verification:

- Rollout order matches research ranking #1–#3 and roadmap Stream N (B-05 → B-06 → F-07)
- Deferred items (K3, Path B) explicitly marked out of scope

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the rollout manifest is accurate before proceeding to the next phase.

---

## Phase 2: Handoff — B-05 calm closure hotfix

### Overview

Open and drive `fix-closure-kickoff-mutex` as the first code-changing slice (P0, T-01).

### Changes Required:

#### 1. Child change bootstrap

**File**: `context/changes/fix-closure-kickoff-mutex/` (new)

**Intent**: Create child change via `/10x-new fix-closure-kickoff-mutex` with intent from B-05 roadmap item and research V21–V22.

**Contract**: Child folder contains `change.md`, `research.md`, `plan.md` before implementation. Branch `features/fix-closure-kickoff-mutex`.

#### 2. B-05 implementation scope (owned by child plan)

**Files**: `src/app/_components/pomodoro-dashboard.tsx`, `src/hooks/use-pomodoro-cycle.ts`, tests, `e2e/session-closure.spec.ts`

**Intent**: Closure mutex + kickoff async abort per B-05.md; not duplicated here — child `plan.md` owns contracts.

**Contract**: Dashboard: kickoff/check-in guards include `!pomodoro.pendingClosureLine`. Hook: extend existing `kickoffFetchGenRef` (already guards `fetchKickoffSuggestion`) — increment at kickoff eligibility effect start (L1082–1114) and check generation before `setAwaitingKickoffReadiness(true)` after `getOrCreateActive()`. Vitest: mutex invariant + async abort after `endSession()`. E2E belt: end session path without pre-dismiss kickoff helper masking T-01.

### Success Criteria:

#### Automated Verification:

- Child change `fix-closure-kickoff-mutex` merged to `main` with CI green (`pnpm check`, `pnpm test`, `pnpm test:e2e:belt`)

#### Manual Verification:

- Manual: end session → closure overlay → dismiss → no kickoff readiness on same visit
- `rollout.md` row `fix-closure-kickoff-mutex` status → `merged`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Handoff — B-06 timeout closure on load

### Overview

Ship T-03 fix after B-05 merges.

### Changes Required:

#### 1. Child change bootstrap

**File**: `context/changes/fix-timeout-closure-on-load/` (new)

**Intent**: `/10x-new fix-timeout-closure-on-load`; research focuses on `maybePresentTimeoutClosure` timing vs kickoff effect.

**Contract**: Prerequisite: B-05 merged. Branch `features/fix-timeout-closure-on-load`.

### Success Criteria:

#### Automated Verification:

- Child change merged to `main`; CI green

#### Manual Verification:

- Return after session timeout → closure beat on load before kickoff/task selection
- `rollout.md` row → `merged`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Handoff — F-07 wedge transition conductor

### Overview

Foundation refactor: pure conductor module + dashboard integration; includes B-07 wind-down threshold in same branch per Stream N phase 2.

### Changes Required:

#### 1. Child change bootstrap

**File**: `context/changes/wedge-transition-conductor/` (new)

**Intent**: `/10x-new wedge-transition-conductor`; research reuses K5 findings; plan resolves conductor API surface.

**Contract**: Prerequisite: B-06 merged to `main`. Branch `features/wedge-transition-conductor`.

#### 2. Conductor module (owned by child plan)

**File**: `src/lib/wedge/transition-conductor.ts` (new)

**Intent**: Pure `resolveWedgeBeat(snapshot) → { activeGate, showInterstitial, suppressedGates }` using OQ2 priority from this plan.

**Contract**: Co-located `transition-conductor.test.ts`. No React imports. Inputs: hook gate flags + catch-up snapshot fields; outputs consumed by dashboard render layer.

#### 3. B-07 wind-down threshold (owned by child plan)

**File**: `src/hooks/use-pomodoro-cycle.ts` (and related wind-down specs)

**Intent**: Ship B-07 wind-down cycle threshold in the same branch as F-07 per Stream N phase 2.

**Contract**: Wind-down gate respects conductor priority (OQ2); belt `wind-down` specs stay green; no separate B-07 change folder.

#### 4. Dashboard integration (owned by child plan)

**File**: `src/app/_components/pomodoro-dashboard.tsx`

**Intent**: Replace scattered `show*` / overlay `&&` stacks with conductor-driven visibility; preserve `data-testid` contracts (F-07 risk note).

**Contract**: `usePomodoroCycle` return API unchanged in F-07 (facade stable). Behavior parity tests + belt updates for closure, kickoff, wind-down specs.

### Success Criteria:

#### Automated Verification:

- Child change merged; `pnpm test` + `pnpm test:e2e:belt` green
- `src/lib/wedge/transition-conductor.test.ts` covers priority matrix (including closure vs kickoff)
- B-07 wind-down threshold behavior covered (unit or belt `wind-down` specs)

#### Manual Verification:

- No overlay stacking on canonical wedge paths (T-01 regression suite)
- `rollout.md` row `wedge-transition-conductor` → `merged`
- Roadmap items S-21, S-34, S-35 unblocked

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 5: Handoff — K2 data-mode ACL hardening

### Overview

Test safety net + Path C task-read unification before extending repositories.

### Changes Required:

#### 1. Child change bootstrap

**File**: `context/changes/data-mode-acl-hardening/` (new)

**Intent**: `/10x-new data-mode-acl-hardening`; implement research K2 first steps.

**Contract**: Prerequisite: F-07 merged to `main` (reduces concurrent hook/dashboard churn). Do not start K2 until F-07 merge lands.

#### 2. ACL characterization tests

**File**: `src/lib/data-mode/data-mode-context.test.tsx` (new)

**Intent**: Document guest vs auth repo wiring; `refreshGuest` no-op behavior (V10).

**Contract**: Mock `api.useUtils`; assert `createGuestRepositories` vs server repo shapes. No production behavior change in this sub-phase.

#### 3. Unified task read (Path C)

**Files**: `src/lib/data-mode/use-domain-tasks.ts`, `src/app/_components/pomodoro-dashboard.tsx`, `src/hooks/use-pomodoro-cycle.ts`

**Intent**: Single `useDomainTasks(mode)` for auth suspense path and hook `hasActiveTasks`; remove duplicate imperative `utils.client.task?.list?.query` (V9).

**Contract**: Auth dashboard and hook share subscription; guest path unchanged. `use-task-mutations` optimistic invalidation preserved.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/lib/data-mode/data-mode-context.test.tsx` passes
- Full `pnpm test` green after Path C

#### Manual Verification:

- Auth task list consistent after mid-cycle `tasks.update` + TaskList CRUD
- `rollout.md` row → `merged`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 6: Handoff — K1 cycle hook pure extracts

### Overview

Revertible extractions from monolithic hook with zero return-API change.

### Changes Required:

#### 1. Child change bootstrap

**File**: `context/changes/cycle-hook-pure-extracts/` (new)

**Intent**: `/10x-new cycle-hook-pure-extracts`; first K1 increment per research.

**Contract**: Prerequisite: F-07 merged. Branch `features/cycle-hook-pure-extracts`.

#### 2. Pure module extracts

**Files**: `src/lib/cycle/cycle-end-time.ts` (new), `src/lib/cycle/cycle-kind.ts` (new, optional dedupe with `derive-gate`)

**Intent**: Move `cycleEndTimeMs` and `isBreakKind` from hook; preserve E2E main-thread branch in `cycle-end-time.ts`.

**Contract**: Co-located tests beside each module. Hook imports replace inline definitions; **63-field return object unchanged**.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/lib/cycle/` passes
- `pnpm exec vitest run src/hooks/use-pomodoro-cycle.test.tsx` passes (no API drift)

#### Manual Verification:

- E2E belt `pomodoro-cycle.spec.ts` green (`pnpm test:e2e:belt`)
- `rollout.md` row → `merged`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 7: Rollout closure & optional parallel wins

### Overview

Mark meta-rollout complete; optionally track K4 quick win without blocking Stream N.

### Changes Required:

#### 1. Rollout completion

**File**: `context/changes/refactor-opportunities/rollout.md`

**Intent**: Set all required rows to `merged`; document deferred K3 and optional K4 status.

**Contract**: Meta-change `change.md` → `implemented` when phases 2–6 child merges land (or explicitly deferred with rationale).

#### 2. Optional K4 parallel (non-blocking)

**File**: `context/changes/sign-in-schema-extract/` (optional)

**Intent**: `/10x-new sign-in-schema-extract` — mirror sign-up `schema.ts` pattern (V17–V19); can run parallel to any phase after Phase 1.

**Contract**: 2-file import cycle break; `pnpm depcruise` shows 0 cycles in auth sign-in folder.

### Success Criteria:

#### Automated Verification:

- All required `rollout.md` rows show `merged`
- Optional: `sign-in-schema-extract` merged if pursued

#### Manual Verification:

- Research ranking #1–#3 delivered or explicitly deferred with written rationale in `rollout.md`
- No in-flight child changes left untracked

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- Owned by each child change (B-05 mutex, F-07 conductor matrix, data-mode ACL, pure extracts)
- Meta-change: no `src/` tests; verify child test files exist before marking handoff complete

### Integration Tests:

- Belt E2E updates in B-05 and F-07 child changes
- `guest-merge-on-sign-in.spec.ts` untouched in this rollout (K3 deferred)

### Manual Testing Steps:

1. After B-05: end session → closure calm path (T-01)
2. After B-06: timeout return → closure on load (T-03)
3. After F-07: full wedge path without overlay stacking
4. After K2: task list coherence across hook + TaskList
5. After K1: timer start/recovery unchanged in dev + belt

## Performance Considerations

- F-07 conductor must be pure and cheap (called on render path) — no async in `transition-conductor.ts`
- Path C task unification should not add duplicate `task.list` fetches (single subscription per mode)
- S-34 optimistic wedge deferred until after F-07 per flow-coherence (NFR 200ms / L-04)

## Migration Notes

- No Prisma migrations in this rollout
- No guest snapshot schema changes (K3 deferred)
- F-07 preserves hook return API — consumers (dashboard, timer-panel, overlays) need not change prop drilling in K1 pure-extract phase

## References

- Research: `context/changes/refactor-opportunities/research.md`
- Source analysis: `context/changes/repo-map-analysis/research.md`
- Roadmap Stream N: `context/foundation/roadmap-references/flow-coherence-recommendations.md`
- B-05: `context/foundation/roadmap-references/items/B-05.md`
- F-07: `context/foundation/roadmap-references/items/F-07.md`
- AGENTS.md wedge rules (F-07 conductor mandate)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Rollout manifest & decision log

#### Automated

- [ ] 1.1 `rollout.md` exists with ≥5 child change-ids
- [ ] 1.2 `plan.md` and `plan-brief.md` exist in `refactor-opportunities/`

#### Manual

- [ ] 1.3 Rollout order reviewed against research ranking and roadmap Stream N

### Phase 2: Handoff — B-05 calm closure hotfix

#### Automated

- [ ] 2.1 `fix-closure-kickoff-mutex` merged to `main` with CI green

#### Manual

- [ ] 2.2 Manual T-01 path verified; `rollout.md` row updated to `merged`

### Phase 3: Handoff — B-06 timeout closure on load

#### Automated

- [ ] 3.1 `fix-timeout-closure-on-load` merged to `main` with CI green

#### Manual

- [ ] 3.2 Manual T-03 path verified; `rollout.md` row updated to `merged`

### Phase 4: Handoff — F-07 wedge transition conductor

#### Automated

- [ ] 4.1 `wedge-transition-conductor` merged; `transition-conductor.test.ts` passes
- [ ] 4.2 `pnpm test:e2e:belt` green after F-07 merge

#### Manual

- [ ] 4.3 Overlay stacking manual regression pass; `rollout.md` row → `merged`

### Phase 5: Handoff — K2 data-mode ACL hardening

#### Automated

- [ ] 5.1 `data-mode-context.test.tsx` passes in CI
- [ ] 5.2 `data-mode-acl-hardening` merged to `main`

#### Manual

- [ ] 5.3 Task read coherence verified; `rollout.md` row → `merged`

### Phase 6: Handoff — K1 cycle hook pure extracts

#### Automated

- [ ] 6.1 `src/lib/cycle/*.test.ts` passes; hook tests pass without API change
- [ ] 6.2 `cycle-hook-pure-extracts` merged to `main`

#### Manual

- [ ] 6.3 Belt pomodoro path verified; `rollout.md` row → `merged`

### Phase 7: Rollout closure & optional parallel wins

#### Automated

- [ ] 7.1 All required `rollout.md` rows show `merged`

#### Manual

- [ ] 7.2 Meta-rollout signed off; deferred items documented
