# Fix Timeout Closure On Load (B-06 / T-03) Implementation Plan

## Overview

Move timeout session closure from cycle-start timing to initial page-load hydrate so returning users see why the prior session ended before kickoff readiness or task selection. Narrow B-06 hotfix after B-05 mutex; ahead of F-07 conductor.

## Current State Analysis

**Deferred closure** — `maybePresentTimeoutClosure` (`use-pomodoro-cycle.ts:691–735`) is only invoked inside `start()` when `session.id !== _activeSessionId` (`:1396–1398`). On first load after server timeout, `_activeSessionId` is null, so closure never runs.

**Hydrate gap** — `recoverActiveCycle()` (`:589–627`) sets `sessionStartIdleFlag(true)` when no active cycle exists, immediately enabling kickoff eligibility, without presenting closure.

**Mutex baseline (B-05)** — `kickoffEligible` requires `pendingClosureLine == null` (`:1079`); dashboard blocks kickoff/check-in overlays during closure. Presenting closure before `sessionStartIdleFlag` naturally blocks kickoff.

## Desired End State

1. User returns after session timeout (no active cycle) → closure overlay shows on load.
2. Kickoff readiness does not appear until user dismisses closure.
3. Existing `start()` closure path preserved for mid-session session id transitions without full reload.
4. Vitest char test pins hydrate timing; passes after enforcement.

### Key Discoveries

- `getLastEnded` + `maybePresentTimeoutClosure` already implement auth/guest lookup and `sessionStorage` dedupe.
- Server marks inactive sessions `ENDED_BY_TIMEOUT` in `findOrCreateActiveSession` (`active-session.ts:25–36`).
- `recoverActiveCycle` must be defined after `maybePresentTimeoutClosure` to call it in the else branch.

## What We're NOT Doing

- F-07 wedge-transition-conductor
- New overlay component or copy changes (S-17 unknown)
- E2E with real 4h timeout (impractical in CI)
- Guest kickoff (authenticated-only)

## Implementation Approach

Two commits: characterization (failing Vitest) → enforcement (reorder + hydrate closure before `sessionStartIdleFlag`). Char-before-touch per parent plan.

## Phase 1: Characterization (T-03 oracle)

### Overview

Vitest test documents timeout-on-load behavior: after hydrate with no active cycle and last ended session timed out, `pendingClosureLine` is set and `awaitingKickoffReadiness` remains false.

### Changes Required

#### 1. Hook hydrate characterization

**File**: `src/hooks/use-pomodoro-cycle.test.tsx`

**Intent**: Pin T-03 — closure on load, not deferred to `start()`.

**Contract**: New describe `"timeout closure on load (B-06)"`. Mock `getActive` → null, `getLastEnded` → `{ id: 42, state: "ENDED_BY_TIMEOUT", closureLine: "Session timed out — 2 cycles. Take a breath." }`. Render hook, `waitFor` `pendingClosureLine` set. Assert `awaitingKickoffReadiness` false. Assert `getOrCreateActive` not called for kickoff before closure dismiss. Test **fails** on current code (no closure on hydrate).

### Success Criteria

#### Automated Verification

- `pnpm exec vitest run src/hooks/use-pomodoro-cycle.test.tsx` — new test exists and **fails** (expected red)
- `pnpm check` passes

---

## Phase 2: Enforcement (hydrate closure)

### Overview

Present timeout closure during idle hydrate before enabling kickoff eligibility.

### Changes Required

#### 1. Reorder closure helpers before recovery

**File**: `src/hooks/use-pomodoro-cycle.ts`

**Intent**: Allow `recoverActiveCycle` to call `maybePresentTimeoutClosure`.

**Contract**: Move `buildSessionClosureLine`, `presentClosureOverlay`, and `maybePresentTimeoutClosure` to immediately before `recoverActiveCycle` (currently at `:669–735`, recovery at `:589–642`). Keep mount `useEffect` with `recoverActiveCycle` adjacent to its definition.

#### 2. Hydrate closure before kickoff flag

**File**: `src/hooks/use-pomodoro-cycle.ts`

**Intent**: T-03 fix — closure as first beat after return.

**Contract**: In `recoverActiveCycle` else branch (`no active cycle`):

1. `setCompletedWorkCycles(0)`
2. Auth: query `getLastEnded`; if non-null, `await maybePresentTimeoutClosure(lastEnded.id)`
3. Guest: find last ended session in snapshot; if found, `await maybePresentTimeoutClosure(prior.id)`
4. **Then** `setSessionStartIdleFlag(true)` (never before step 2–3 complete)

Add `maybePresentTimeoutClosure` and `utils.client.session.getLastEnded` to `recoverActiveCycle` dependency array.

### Success Criteria

#### Automated Verification

- `pnpm exec vitest run src/hooks/use-pomodoro-cycle.test.tsx` — B-06 char test **passes**
- `pnpm check` && `pnpm test` pass

#### Manual Verification

- Reload after timed-out session → closure before kickoff overlay

---

## References

- `context/changes/fix-timeout-closure-on-load/research.md`
- `context/foundation/user-flow.md` T-03
- `context/foundation/roadmap-references/items/B-06.md`
- `context/archive/2026-06-17-fix-closure-kickoff-mutex/` — B-05 mutex baseline

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Characterization (T-03 oracle)

#### Automated

- [x] 1.1 Hook hydrate characterization test (expected red)

### Phase 2: Enforcement (hydrate closure)

#### Automated

- [x] 2.1 Reorder closure helpers before recovery
- [x] 2.2 Hydrate closure before sessionStartIdleFlag
- [x] 2.3 Full test suite green

#### Manual

- [ ] 2.4 Manual T-03 path verified
