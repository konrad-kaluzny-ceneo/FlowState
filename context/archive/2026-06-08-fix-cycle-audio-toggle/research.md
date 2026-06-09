---
date: 2026-06-08T12:00:00+02:00
researcher: Cursor Agent
git_commit: 93c3518b9283fc1d191125e1ff397c7cda3d332c
branch: features/fix-cycle-audio-toggle
repository: FlowState
topic: "Why do Cycle end audio toggle buttons not respond on click?"
tags: [research, codebase, useCycleEndAudioPreference, CycleAudioPreferenceControl, preference-sync, B-01, S-20]
status: complete
last_updated: 2026-06-08
last_updated_by: Cursor Agent
---

# Research: Why do Cycle end audio toggle buttons not respond on click?

**Date**: 2026-06-08T12:00:00+02:00  
**Researcher**: Cursor Agent  
**Git Commit**: `93c3518b9283fc1d191125e1ff397c7cda3d332c`  
**Branch**: `features/fix-cycle-audio-toggle`  
**Repository**: [konrad-kaluzny-ceneo/FlowState](https://github.com/konrad-kaluzny-ceneo/FlowState)

## Research Question

Production regression (B-01 / [#72](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/72)): Cycle end audio **Normal** / **Soft** / **Muted** buttons on the timer panel do not update on click. Investigate `useCycleEndAudioPreference`, `CycleAudioPreferenceControl`, server profile sync, hydration gates, and mutation flow. Find root cause with file:line evidence.

## Summary

**Root cause (authenticated users, high confidence):** The server-reconciliation `useEffect` in `useCycleEndAudioPreference` re-runs whenever `suggestionFetchInFlight`, `preferenceQuery.data`, or `setMutation` changes, and **unconditionally** calls `setModeState(serverMode)` with the **stale** React Query cache value ([`use-cycle-end-audio-preference.ts:118-119`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/93c3518b9283fc1d191125e1ff397c7cda3d332c/src/hooks/use-cycle-end-audio-preference.ts#L118-L119)). This overwrites the optimistic UI update from `setMode` ([`use-cycle-end-audio-preference.ts:131-133`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/93c3518b9283fc1d191125e1ff397c7cda3d332c/src/hooks/use-cycle-end-audio-preference.ts#L131-L133)) before `preference.set` completes and before the query cache is updated — making clicks appear to do nothing.

**Regression window:** Introduced on 2026-06-08 in commit `b493dee` (*serialize preference load from suggestion fetch*), shipped via PR #71 (S-20). Prior hook (`91d203f`) had the same unconditional server overwrite pattern but fewer re-trigger sources; `b493dee` added `suggestionFetchInFlight` to effect deps, increasing overwrite frequency on dashboards with kickoff/post-check-in suggestion fetches.

**UI layer is not the blocker:** `CycleAudioPreferenceControl` wires `onClick` correctly ([`cycle-audio-preference-control.tsx:73`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/93c3518b9283fc1d191125e1ff397c7cda3d332c/src/app/_components/cycle-audio-preference-control.tsx#L73)); no `disabled` prop is passed from `TimerPanel` ([`timer-panel.tsx:172-176`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/93c3518b9283fc1d191125e1ff397c7cda3d332c/src/app/_components/timer-panel.tsx#L172-L176)). `isHydrated` is exported but unused ([`pomodoro-dashboard.tsx:400-401`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/93c3518b9283fc1d191125e1ff397c7cda3d332c/src/app/_components/pomodoro-dashboard.tsx#L400-L401)) — buttons are never hydration-gated.

**Guest path:** Server-sync effect returns early for guests ([`use-cycle-end-audio-preference.ts:83-84`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/93c3518b9283fc1d191125e1ff397c7cda3d332c/src/hooks/use-cycle-end-audio-preference.ts#L83-L84)); `setMode` is synchronous localStorage + state ([`use-cycle-end-audio-preference.ts:131-134`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/93c3518b9283fc1d191125e1ff397c7cda3d332c/src/hooks/use-cycle-end-audio-preference.ts#L131-L134)). Guest toggles should work in current code; issue template lists guest but primary failure mode is auth server-sync. Verify guest independently during implement.

**Test gap:** E2E specs seed preference via API/localStorage and assert `aria-pressed` on load — they never click toggle buttons ([`e2e/quiet-cycle-audio.spec.ts:22-35`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/93c3518b9283fc1d191125e1ff397c7cda3d332c/e2e/quiet-cycle-audio.spec.ts#L22-L35), [`e2e/guest-quiet-cycle-audio.spec.ts:23-25`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/93c3518b9283fc1d191125e1ff397c7cda3d332c/e2e/guest-quiet-cycle-audio.spec.ts#L23-L25)).

## Detailed Findings

### Click → state flow (happy path vs actual)

| Step | Component | Expected | Actual (auth) |
|------|-----------|----------|---------------|
| 1 | `CycleAudioPreferenceControl` | `onClick` → `onChange(value)` | Works — handler fires |
| 2 | `setMode` in hook | `setModeState(next)` + `writeCycleEndAudioMode` | Runs — brief optimistic update |
| 3 | `setMode` mutation | `preference.set` after `waitUntilSuggestionIdle` | Queued correctly |
| 4 | Server-sync effect | Should not run after user edit | **Re-runs** → `setModeState(serverMode)` with stale cache |
| 5 | UI | Active button reflects click | Reverts to previous selection |

### `useCycleEndAudioPreference` — server-sync overwrite

The hook maintains three interacting concerns:

1. **Local-first state** — `useState` initializer reads localStorage synchronously ([`use-cycle-end-audio-preference.ts:34-36`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/93c3518b9283fc1d191125e1ff397c7cda3d332c/src/hooks/use-cycle-end-audio-preference.ts#L34-L36)).
2. **Query gating** — `preference.get` only runs when `mountSettled && !suggestionFetchInFlight` ([`use-cycle-end-audio-preference.ts:75-80`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/93c3518b9283fc1d191125e1ff397c7cda3d332c/src/hooks/use-cycle-end-audio-preference.ts#L75-L80)).
3. **Server reconciliation** — async effect after fetch settles ([`use-cycle-end-audio-preference.ts:82-129`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/93c3518b9283fc1d191125e1ff397c7cda3d332c/src/hooks/use-cycle-end-audio-preference.ts#L82-L129)).

**Problem:** The reconciliation effect has no `hasSynced` / `userDirty` guard. After `guestMergeAttemptedRef` is true (first run), every re-trigger executes:

```typescript
setModeState(serverMode);
writeCycleEndAudioMode(scopeRef.current, serverMode);
```

where `serverMode` comes from `preferenceQuery.data` ([`use-cycle-end-audio-preference.ts:99-100`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/93c3518b9283fc1d191125e1ff397c7cda3d332c/src/hooks/use-cycle-end-audio-preference.ts#L99-L100)) — which is **not** updated by `setMutation.mutate()` (no `onSuccess` cache write, no `invalidate`).

**Re-trigger sources** (effect dependency array [`use-cycle-end-audio-preference.ts:122-129`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/93c3518b9283fc1d191125e1ff397c7cda3d332c/src/hooks/use-cycle-end-audio-preference.ts#L122-L129)):

| Dependency | Why it re-fires during normal dashboard use |
|------------|---------------------------------------------|
| `suggestionFetchInFlight` | `beginSuggestionFetch()` wraps kickoff and post-check-in `suggestion.next` calls ([`use-pomodoro-cycle.ts:744`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/93c3518b9283fc1d191125e1ff397c7cda3d332c/src/hooks/use-pomodoro-cycle.ts#L744), [`use-pomodoro-cycle.ts:771`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/93c3518b9283fc1d191125e1ff397c7cda3d332c/src/hooks/use-pomodoro-cycle.ts#L771), [`use-pomodoro-cycle.ts:1286`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/93c3518b9283fc1d191125e1ff397c7cda3d332c/src/hooks/use-pomodoro-cycle.ts#L1286)) |
| `setMutation` | tRPC/React Query mutation object identity can change across pending/success transitions |
| `preferenceQuery.data` | Reference changes on refetch (rare) but stale data persists without invalidation |

**Timing race on click:**

1. User clicks **Soft** → `setModeState("soft")` ([`use-cycle-end-audio-preference.ts:133`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/93c3518b9283fc1d191125e1ff397c7cda3d332c/src/hooks/use-cycle-end-audio-preference.ts#L133)).
2. `suggestionFetchInFlight` flips (common on auth dashboard with suggestion gates) → effect schedules.
3. `await waitUntilSuggestionIdle()` ([`use-cycle-end-audio-preference.ts:94`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/93c3518b9283fc1d191125e1ff397c7cda3d332c/src/hooks/use-cycle-end-audio-preference.ts#L94)).
4. `setModeState(serverMode)` with cached `"normal"` ([`use-cycle-end-audio-preference.ts:118`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/93c3518b9283fc1d191125e1ff397c7cda3d332c/src/hooks/use-cycle-end-audio-preference.ts#L118)) — UI snaps back.
5. `setMutation.mutate({ cycleEndAudioMode: "soft" })` eventually completes server-side, but UI already reverted and query cache still stale.

### `setMode` mutation path

Authenticated `setMode` ([`use-cycle-end-audio-preference.ts:131-143`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/93c3518b9283fc1d191125e1ff397c7cda3d332c/src/hooks/use-cycle-end-audio-preference.ts#L131-L143)):

- Updates state and localStorage immediately (correct optimistic pattern).
- Defers mutation behind `waitUntilSuggestionIdle()` (coordinates with [`suggestion-priority-link.ts:12-28`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/93c3518b9283fc1d191125e1ff397c7cda3d332c/src/lib/trpc/suggestion-priority-link.ts#L12-L28)).
- Uses fire-and-forget `mutate()` — no `onSuccess` to update `preferenceQuery` cache.

Server router is correct ([`preference.ts:24-47`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/93c3518b9283fc1d191125e1ff397c7cda3d332c/src/server/api/routers/preference.ts#L24-L47)); unit tests pass ([`preference.test.ts:93-99`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/93c3518b9283fc1d191125e1ff397c7cda3d332c/src/server/api/routers/preference.test.ts#L93-L99)). Backend is not the failure point.

### Hydration gates

| Gate | Purpose | Impact on toggle |
|------|---------|------------------|
| `mountSettled` | rAF delay before auth query ([`use-cycle-end-audio-preference.ts:50-62`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/93c3518b9283fc1d191125e1ff397c7cda3d332c/src/hooks/use-cycle-end-audio-preference.ts#L50-L62)) | Delays initial fetch only |
| `suggestionFetchInFlight` | Blocks query + re-triggers sync effect | **Aggravates overwrite** |
| `isHydrated` | Set true after server reconcile ([`use-cycle-end-audio-preference.ts:113-120`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/93c3518b9283fc1d191125e1ff397c7cda3d332c/src/hooks/use-cycle-end-audio-preference.ts#L113-L120)) | **Not consumed** by dashboard — does not disable buttons |

### `CycleAudioPreferenceControl` and wiring

- Control renders three `type="button"` elements with `onClick={() => onChange(opt.value)}` ([`cycle-audio-preference-control.tsx:63-73`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/93c3518b9283fc1d191125e1ff397c7cda3d332c/src/app/_components/cycle-audio-preference-control.tsx#L63-L73)).
- Active state driven by `opt.value === mode` ([`cycle-audio-preference-control.tsx:61`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/93c3518b9283fc1d191125e1ff397c7cda3d332c/src/app/_components/cycle-audio-preference-control.tsx#L61)).
- `TimerPanel` shows control when `onCycleEndAudioModeChange != null` ([`timer-panel.tsx:172-176`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/93c3518b9283fc1d191125e1ff397c7cda3d332c/src/app/_components/timer-panel.tsx#L172-L176)); dashboard always passes `setCycleEndAudioMode` ([`pomodoro-dashboard.tsx:180`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/93c3518b9283fc1d191125e1ff397c7cda3d332c/src/app/_components/pomodoro-dashboard.tsx#L180)).
- Panel visibility requires focused task or running/completed state ([`timer-panel.tsx:83-85`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/93c3518b9283fc1d191125e1ff397c7cda3d332c/src/app/_components/timer-panel.tsx#L83-L85)) — matches repro steps.

### Scope-reset effect (secondary)

Scope change effect resets mode from localStorage ([`use-cycle-end-audio-preference.ts:64-73`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/93c3518b9283fc1d191125e1ff397c7cda3d332c/src/hooks/use-cycle-end-audio-preference.ts#L64-L73)). `onboardingScope` is memoized by `userId` ([`use-onboarding-state.ts:47-53`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/93c3518b9283fc1d191125e1ff397c7cda3d332c/src/hooks/use-onboarding-state.ts#L47-L53)); guest scope is stable `useMemo` ([`pomodoro-dashboard.tsx:429`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/93c3518b9283fc1d191125e1ff397c7cda3d332c/src/app/_components/pomodoro-dashboard.tsx#L429)). Not a click-time reset under normal use.

## Code References

- `src/hooks/use-cycle-end-audio-preference.ts:82-129` — server-sync effect; unconditional overwrite at 118-119
- `src/hooks/use-cycle-end-audio-preference.ts:131-143` — optimistic `setMode`; deferred `preference.set`
- `src/hooks/use-cycle-end-audio-preference.ts:75-80` — query gating on `suggestionFetchInFlight`
- `src/app/_components/cycle-audio-preference-control.tsx:63-73` — button click handlers (not broken)
- `src/app/_components/timer-panel.tsx:172-176` — control wiring (no disabled gate)
- `src/app/_components/pomodoro-dashboard.tsx:400-417` — auth hook plumbing; `isHydrated` ignored
- `src/lib/trpc/suggestion-priority.ts:27-40` — `beginSuggestionFetch` counter
- `src/lib/trpc/suggestion-priority-link.ts:12-28` — preference.* delayed until suggestion idle
- `src/server/api/routers/preference.ts:11-47` — get/set API (working)
- `src/hooks/use-pomodoro-cycle.ts:744,771,1286` — suggestion fetch sites that toggle `suggestionFetchInFlight`

## Architecture Insights

1. **Local-first + server-reconcile** is the intended S-20 pattern: sync localStorage read on mount, then reconcile auth users from `preference.get` ([`context/archive/2026-06-08-persistent-quiet-cycle-audio/plan.md`](context/archive/2026-06-08-persistent-quiet-cycle-audio/plan.md)).
2. **Suggestion-priority coordination** (`b493dee`, `5c32f9f`) solved CI tRPC batch deadlocks but coupled preference sync lifecycle to suggestion fetch state — creating a recurring overwrite trigger.
3. **Missing optimistic cache update** — `setMutation` does not update React Query cache; server-sync trusts only `preferenceQuery.data`, creating a permanent stale-read loop after any user edit until a full refetch.
4. **No hook-level unit tests** — only `storage.test.ts` and `preference.test.ts` exist; the race is untested at hook layer.

## Historical Context (from prior changes)

- [`context/archive/2026-06-08-persistent-quiet-cycle-audio/research.md`](context/archive/2026-06-08-persistent-quiet-cycle-audio/research.md) — original S-20 design: `useCycleEndAudioPreference` with localStorage + tRPC; hydration race called out as risk.
- [`context/archive/2026-06-08-persistent-quiet-cycle-audio/plan.md`](context/archive/2026-06-08-persistent-quiet-cycle-audio/plan.md) — contract: return `{ mode, setMode, isHydrated }`; auth reconciles on `preference.get` success.
- [`context/archive/2026-06-08-persistent-quiet-cycle-audio/reviews/impl-review.md`](context/archive/2026-06-08-persistent-quiet-cycle-audio/reviews/impl-review.md) — O1: `isHydrated` unused by dashboard (accepted).
- Git history on hook:
  - `91d203f` — initial client preference storage
  - `b493dee` — **added `suggestionFetchInFlight` to sync effect deps** (regression trigger)
  - `5c32f9f` — simplified idle wait; kept overwrite pattern
- [`context/foundation/roadmap.md` B-01](context/foundation/roadmap.md) — pre-identified risk: "Server-sync effect may overwrite optimistic UI before mutation completes."
- [GitHub #72](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/72) — production report 2026-06-08, regression of S-20 PR #71.

## Root Cause Hypothesis

**Primary (auth, confidence 88%):** Re-entrant server-sync `useEffect` in `useCycleEndAudioPreference` overwrites optimistic `setMode` state with stale `preferenceQuery.data` whenever `suggestionFetchInFlight` or mutation lifecycle re-triggers the effect. User sees no visual change because the overwrite happens within the same interaction window as the click.

**Secondary (guest, confidence 40%):** Guest code path lacks server-sync; toggles should work. If guest reproduces in production, investigate overlay pointer capture or component remount — not supported by static analysis of current guest path.

## Risks to Verify (for `/10x-plan`)

| Risk | Verify |
|------|--------|
| Fix must preserve suggestion-priority serialization (no tRPC deadlock regression from `b493dee`/`5c32f9f`) | Run full `pnpm test` + auth e2e suite after hook fix |
| Guest→auth merge on first sign-in still works | Manual + unit test: guest localStorage non-default merges once when server row is default |
| Optimistic UI must meet NFR 200ms acknowledgement (FR-013/FR-014) | Click toggle → `aria-pressed` changes within 200ms without API pre-seed |
| Persistence across refresh | Auth: click Soft → reload → still Soft; Guest: same via localStorage |
| Mutation failure rollback | Simulate `preference.set` error → UI reverts or shows error (define in plan) |
| Suggestion in-flight during click | Focus task with kickoff suggestion loading → toggle still responds |
| E2E coverage gap | Add spec: click Normal→Soft→Muted, assert `aria-pressed` each step (auth + guest) |
| Guest repro | Manually confirm guest toggle on production-like build; narrow scope if auth-only |

## Recommended Fix Direction (for `/10x-plan`)

1. **One-time initial sync:** `hasInitialSyncRef` — run server reconcile only on first successful `preference.get`, not on every `suggestionFetchInFlight` transition.
2. **User-edit guard:** `userOverrideRef` or compare `mode` vs `serverMode` — skip `setModeState(serverMode)` when user has set mode since last sync.
3. **Cache coherence:** `setMutation` `onSuccess` → `utils.preference.get.setData(...)` or optimistic update so stale reads cannot revert UI.
4. **Stable effect deps:** Remove `setMutation` from dependency array; use `setMutation.mutate` via ref if needed.
5. **Hook unit test:** Simulate click + `suggestionFetchInFlight` flip → assert mode stays at user selection.
6. **E2E:** Live toggle interaction test (no API seed) for auth and guest.

## Related Research

- [`context/archive/2026-06-08-persistent-quiet-cycle-audio/research.md`](context/archive/2026-06-08-persistent-quiet-cycle-audio/research.md) — S-20 original architecture
- [`context/foundation/test-plan.md` §6](context/foundation/test-plan.md) — quiet cycle audio e2e cookbook (seed-only pattern)

## Open Questions

1. **Guest repro confirmation** — static analysis says guest should work; manual verify before closing guest scope.
2. **Whether production users always have suggestion gates enabled** — auth dashboard enables `enableSuggestionGate` ([`pomodoro-dashboard.tsx:410`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/93c3518b9283fc1d191125e1ff397c7cda3d332c/src/app/_components/pomodoro-dashboard.tsx#L410)), increasing `suggestionFetchInFlight` churn.

## Decision Proxy Resolutions

| Decision | Resolution |
|----------|------------|
| Root cause | Server-sync effect overwrite of optimistic state (auth-primary) |
| Fix location | `use-cycle-end-audio-preference.ts` — not UI components |
| Preserve CI serialization | Yes — keep `waitUntilSuggestionIdle` / link gating; change sync semantics only |
| Guest in scope | Include in tests; fix is hook-level so guest benefits from any effect dep cleanup |
| E2E strategy | Add live-click toggle spec; keep existing seeded muted specs as regression |
