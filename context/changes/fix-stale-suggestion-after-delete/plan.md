# Fix Stale Suggestion After Task Delete Implementation Plan

## Overview

When the user deletes the task FlowState just suggested (kickoff idle path), the suggestion card must disappear or show a fresh suggestion — not a snapshot of a removed task. Wire live task-list membership into suggestion invalidation inside `usePomodoroCycle`, with Vitest coverage.

## Current State Analysis

**Detached snapshot** — `pendingKickoffSuggestion` / `pendingSuggestion` are populated by `suggestion.next` and cleared only on cycle/session lifecycle events (`use-pomodoro-cycle.ts:896–923`, `1835`, `2201–2202`). Task delete updates `task.list` / guest snapshot only (`use-task-mutations.ts:192–201`).

**Primary repro** — kickoff idle: delete enabled, card stays `ready` (`research.md` reproducibility matrix).

**Post-check-in break** — active-task delete is UI-disabled (`task-list.tsx:702`). Sync still worth adding for list drift (external tab, future changes) but not the reported repro path.

**Auth-only UI** — suggestion cards gated off for guest (`pomodoro-dashboard.tsx:534–539`). Sync runs whenever `activeTaskIds` is passed (auth dashboard always passes it).

## Desired End State

1. Kickoff idle: user deletes suggested task → card leaves `ready` within one render tick (refetch or `empty`).
2. Deleting a **non-suggested** task does not disturb the current suggestion.
3. If user had pre-focused the suggested task then deletes it on idle → staging focus and duration chips clear.
4. Vitest pins invalidation; manual kickoff repro verified.

### Key Discoveries

- `PomodoroDashboardBody` already computes `activeTaskIds` (`pomodoro-dashboard.tsx:66–69`) but uses it only for `canMarkTaskDone`.
- `retryKickoffSuggestion` / `retrySuggestion` already encapsulate refetch with stored energy / cycle id (`use-pomodoro-cycle.ts:2651–2662`).
- Override path clears highlight only, not card — delete fix must invalidate `pending*` status, not just `suggestedTaskId` (`use-pomodoro-cycle.test.tsx:2133–2198`).
- S-09 explicitly left suggestion bridge out of scope (`context/archive/2026-06-07-optimistic-task-mutations/plan.md:225–226`).

## What We're NOT Doing

- Unlocking delete during post-check-in break (S-06 contract)
- `recordDecision` on delete (delete ≠ choosing another task)
- Guest suggestion UI / `enableSuggestionGate` for guest
- New API routes or schema changes
- Belt E2E in this slice (kickoff delete test tagged `@skip-belt`; belt rows unchanged)
- Fixing override-during-break card persistence (separate behaviour, already tested)

## Implementation Approach

Pass `activeTaskIds` from dashboard into `usePomodoroCycle`. Add a `useEffect` that detects when a `ready` suggestion's `taskId` ∉ `activeTaskIds`, then:

1. Clear pre-focus staging when the missing id matches `preFocusedTask` or the suggestion id.
2. If ≥1 active task remains → refetch (`fetchKickoffSuggestion` / `fetchPostCheckInSuggestion` via existing helpers).
3. If zero active tasks → set suggestion to `empty` (matches API null semantics).

Char-before-touch: failing Vitest in Phase 1, enforcement in Phase 2.

## Critical Implementation Details

**Options ref:** Mirror `getCycleEndAudioModeRef` — maintain `activeTaskIdsRef` updated from `options.activeTaskIds` in a `useEffect`; read the ref from the invalidation effect and accept guards (avoid closing over unstable `options` in callbacks).

**Effect ordering:** Run invalidation when membership or ready-state changes. Effect deps: `activeTaskIds` reference (or serialized id string), `pendingKickoffSuggestion.status`, `pendingSuggestion.status`, and each ready suggestion's `taskId`. Inside the effect, no-op when suggested id ∈ set. Increment generation refs before refetch so a slow in-flight `suggestion.next` cannot repopulate a deleted id.

**Post-check-in refetch:** Call `fetchPostCheckInSuggestion` directly with `suggestionCycleIdRef` — do **not** use `retrySuggestion` / `fetchSuggestion` (those call `clearKickoffSuggestion()` and would wipe kickoff idle flags).

**Kickoff refetch guard:** If refetch is needed but `_activeSessionId == null`, set `pendingKickoffSuggestion` to `empty` instead of calling `fetchKickoffSuggestion`.

**Accept guard:** In `acceptSuggestion` / `acceptKickoffSuggestion`, no-op when `activeTaskIdsRef.current` is set and suggested id ∉ set — prevents race if user clicks Accept in the same frame as delete.

## Phase 1: Characterization (stale suggestion oracle)

### Overview

Vitest documents kickoff-idle invalidation when the suggested task disappears from `activeTaskIds`.

### Changes Required:

#### 1. Hook options contract (types only)

**File**: `src/hooks/use-pomodoro-cycle.ts`

**Intent**: Allow dashboard to supply live task membership for sync.

**Contract**: Extend `UsePomodoroCycleOptions` with optional `activeTaskIds?: ReadonlySet<DomainTaskId>`. Add `activeTaskIdsRef` + sync `useEffect` (mirror `getCycleEndAudioModeRef`). No invalidation behaviour yet — types + ref wiring only if needed for test wrapper.

#### 2. Characterization tests

**File**: `src/hooks/use-pomodoro-cycle.test.tsx`

**Intent**: Pin expected behaviour before enforcement.

**Contract**: New describe `"stale suggestion invalidation"`. Use dynamic props:

```tsx
const { result, rerender } = renderHook(
  (props) => usePomodoroCycle(props),
  { wrapper: createWrapper(), initialProps: { activeTaskIds: new Set([7, 9]) } },
);
// … reach kickoff ready via completeKickoffReadinessGate …
rerender({ activeTaskIds: new Set([7]) });
```

Cases:

- **Kickoff ready + suggested id removed from `activeTaskIds`:** after `waitFor`, `pendingKickoffSuggestion.status` is not `ready` (refetch → loading/ready, or `empty` when no tasks left).
- **Kickoff ready + last task removed (`activeTaskIds.size === 0`):** status is `empty` (shows “No active tasks”), not `idle` (which hides the card).
- **Kickoff ready + unrelated task removed:** `pendingKickoffSuggestion.status` stays `ready`.
- **Pre-focus cleanup:** accept kickoff suggestion, remove suggested id from `activeTaskIds` → `preFocusedTask` null, `hasPreFocusedKickoff` false, `focusedTaskId` null, `stagedKickoffDurationSec` null.
- **Accept guard:** with kickoff `ready` and suggested id ∉ `activeTaskIds`, `acceptKickoffSuggestion()` → `preFocusedTask` null, `recordDecisionMutation` not called.

Tests **fail** on current code.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/hooks/use-pomodoro-cycle.test.tsx` — new tests exist and **fail** (expected red)
- `pnpm check` passes

---

## Phase 2: Enforcement (task-list sync)

### Overview

Implement invalidation effect, wire dashboard, add accept guards; green tests.

### Changes Required:

#### 1. Invalidation helper + effect

**File**: `src/hooks/use-pomodoro-cycle.ts`

**Intent**: Single sync point when live tasks no longer contain the suggested id.

**Contract**: Add internal `invalidateStaleSuggestion()` (name flexible) called from `useEffect` when `activeTaskIdsRef.current` is defined. Effect deps per Critical Implementation Details. For each context (`pendingKickoffSuggestion`, `pendingSuggestion`) with `status === "ready"`:

- If `data.taskId ∈ activeTaskIds` → no-op.
- Else clear pre-focus when `preFocusedTask?.id === data.taskId` (also reset `hasPreFocused*`, `focusedTaskId`, `focusedTask`, `stagedKickoffDurationSec`).
- If `activeTaskIds.size === 0` → `setPending*({ status: "empty" })` and clear highlight ids.
- Else → bump appropriate fetch gen ref, set `loading`, call `fetchKickoffSuggestion` with `_activeSessionId` + `lastKickoffEnergyRef` (if `_activeSessionId == null`, set `empty` instead), or `fetchPostCheckInSuggestion` with `suggestionCycleIdRef` for post-check-in. Do **not** use `retrySuggestion` / `fetchSuggestion`.

Do **not** call `recordSuggestionDecision`.

#### 2. Accept guards

**File**: `src/hooks/use-pomodoro-cycle.ts`

**Intent**: Block accept of a task that no longer exists on the list.

**Contract**: At top of `acceptSuggestion` / `acceptKickoffSuggestion`, return early when `activeTaskIdsRef.current` is set and suggested `data.taskId` ∉ set.

#### 3. Dashboard wiring

**File**: `src/app/_components/pomodoro-dashboard.tsx`

**Intent**: Feed live task membership into the hook.

**Contract**: Pass `activeTaskIds` into `usePomodoroCycle({ getCycleEndAudioMode, activeTaskIds })` inside `PomodoroDashboardBody`.

#### 4. Optional E2E (non-belt)

**File**: `e2e/session-kickoff.spec.ts`

**Intent**: Browser-level regression for kickoff delete path.

**Contract**: New test tagged `@skip-belt`: kickoff suggestion visible → delete highlighted row → assert suggestion card not showing deleted title (empty copy or new suggestion). Follow existing kickoff spec helpers.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/hooks/use-pomodoro-cycle.test.tsx` — stale invalidation tests **pass**
- `pnpm check` passes
- `pnpm test` passes

#### Manual Verification:

- Auth session → kickoff readiness → suggestion card → delete suggested task → card refetches or shows “No active tasks” when list empty
- Delete a different active task while suggestion showing → card unchanged

**Implementation Note**: After Phase 2 automated verification passes, pause for manual confirmation before archive/PR.

---

## Testing Strategy

### Unit Tests:

- Kickoff invalidation when suggested id leaves `activeTaskIds`
- Zero tasks remaining → `empty` (not `idle`)
- No invalidation when unrelated task deleted
- Pre-focus + focus + chips cleared on stale id
- Accept no-op when id missing from set

### Integration Tests:

- None required (hook + dashboard wiring covered by Vitest)

### Manual Testing Steps:

1. Two active tasks → start session → kickoff suggestion → delete suggested task → card updates.
2. One active task → same flow → empty state on card.
3. Accept suggestion → delete task on idle → focus/chips cleared.

## Performance Considerations

Effect runs on `activeTaskIds` reference change (memoized Set in dashboard). Refetch only when suggested id actually missing — no extra API calls on unrelated deletes.

## Migration Notes

None. Client-only behaviour change.

## References

- `context/changes/fix-stale-suggestion-after-delete/research.md`
- `context/changes/fix-stale-suggestion-after-delete/change.md`
- `context/archive/2026-06-07-adaptive-task-suggestion/plan.md` — S-06 lifecycle contract
- `context/archive/2026-06-08-session-kickoff-suggestion/plan.md` — S-15 kickoff suggestion
- `src/hooks/use-pomodoro-cycle.ts:896–923` — clear helpers
- `src/app/_components/pomodoro-dashboard.tsx:66–72` — `activeTaskIds`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Characterization (stale suggestion oracle)

#### Automated

- [ ] 1.1 `pnpm exec vitest run src/hooks/use-pomodoro-cycle.test.tsx` — stale invalidation tests exist and fail (red)
- [ ] 1.2 `pnpm check` passes

### Phase 2: Enforcement (task-list sync)

#### Automated

- [ ] 2.1 `pnpm exec vitest run src/hooks/use-pomodoro-cycle.test.tsx` — stale invalidation tests pass
- [ ] 2.2 `pnpm check` passes
- [ ] 2.3 `pnpm test` passes

#### Manual

- [ ] 2.4 Kickoff idle delete repro verified in browser
