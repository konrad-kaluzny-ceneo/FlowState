# Phase 10 Research Notes — Cycle-State Lift to Layout Provider

> Scratchpad gathered before implementing `### Phase 10: Cycle-State Lift to Layout Provider` in `plan.md`. Pure research — no code changed yet. Use this to resume implementation in a fresh window.

## Where we are in the plan

- Phases 1-9 are complete and committed (Progress rows all `[x]` with SHAs through `cfd6d54`).
- Phase 10 Progress rows (10.1-10.7) are all unchecked — this is the next work.
- Phase 11 (Nav shell + route split) depends on Phase 10 landing first.

## Goal of Phase 10 (from plan.md)

Lift `usePomodoroCycle` + `DataModeProvider` out of the page-scoped `PomodoroDashboardBody`/`HomeShellContent` into a new layout-level `PomodoroCycleProvider`, so:
- The hook's Worker + `visibilitychange` listener mount **exactly once**.
- Cycle state will survive route navigation once Phase 11 adds real routes (still one home screen in Phase 10 itself).
- All cycle consumers switch from calling the hook directly to reading a new `usePomodoroCycleContext()`.

## Current architecture (confirmed by reading the files)

### `usePomodoroCycle` (`src/hooks/use-pomodoro-cycle.ts`)

```ts
// :354-360
export type UsePomodoroCycleOptions = {
	getCycleEndAudioMode?: () => CycleEndAudioMode;
	getOutOfTabBreakAlertsEnabled?: () => boolean;
	activeTaskIds?: ReadonlySet<DomainTaskId>;
	continueTasks?: Array<{ id: DomainTaskId; status: string }>;
};

export function usePomodoroCycle(options?: UsePomodoroCycleOptions) { ... }
```

All four options are optional (safe fallbacks: `() => "normal"`, `() => true`, `undefined`, `undefined`).

Internally (`:387-389`) it calls `useDataMode()` + `useRepositories()` (destructures `cycles, sessions, tasks, refreshGuest`) — **must stay under `DataModeProvider`**.

Return object (`:3653-3754`), ~76 fields, no explicit return type (inferred). Grouped:
- Core cycle state: `state`, `remainingMs`, `focusedTask`, `focusedTaskId`, `activeCycle`, `cycleKind`, `hasActiveSession`, `error`, `completedWorkCycles`
- Wedge/recovery: `pendingWedgeRecovery`, `isWedgeSyncRetrying`, `retryWedgeSync`, `dismissPendingWedgeRecovery`
- Mid-cycle: `midCyclePendingTask`, `isMidCycleSubmitting`, `onMidCycleMarkComplete`, `onMidCycleContinueWithTask`, `onMidCycleEndCycleAndBreak`
- Check-in gate: `awaitingCheckIn`, `isPostCheckInTransitioning`, `submitCheckIn`
- Wind-down gate: `awaitingWindDown`, `windDownRationale`, `onWindDownKeepGoing`, `onWindDownEndSession`
- Confirm/complete: `isConfirming`, `confirmComplete`, `onCycleCompleteConfirm`
- Break-cycle suggestion: `pendingSuggestion`, `suggestionCycleId`, `suggestedTaskId`, `acceptSuggestion`, `clearSuggestion`, `retrySuggestion`
- Kickoff suggestion: `pendingKickoffSuggestion`, `kickoffSuggestedTaskId`, `kickoffEligible`, `hasPreFocusedKickoff`, `isAcceptingKickoffSuggestion`, `acceptKickoffSuggestion`, `clearKickoffSuggestion`, `retryKickoffSuggestion`, `stagedKickoffDurationSec`, `selectKickoffDuration`, `clearStagedKickoffDuration`
- Pre-focus: `preFocusedTask`, `hasPreFocusedSuggestion`, `dismissPreFocus`, `overrideAcknowledgement`
- Narrative/copy: `breakTransitionLine`, `clearBreakTransitionLine`, `narrativeLatestEnergy`, `inFlowSummaryLine`, `pendingClosureLine`, `dismissSessionClosure`
- Continuation: `continueTaskId`
- Session steering: `showSessionEnergy`, `showSessionFocus`, `sessionEnergyPending`, `sessionFocusPending`, `sessionSteeringSubmitting`, `completeSessionEnergy`, `skipSessionEnergy`, `completeSessionFocus`, `skipSessionFocus`
- Catch-up: `catchUp`, `dismissCatchUp`
- Task selection: `selectTask`, `clearTask`
- Cycle control: `start`, `interrupt`, `pause`, `resume`, `endSession`
- Misc: `clearError`

### Current call site (`pomodoro-dashboard.tsx`, inside `PomodoroDashboardBody`, ~:161-190)

```ts
const {
	enabled: outOfTabBreakAlertsEnabled,
	setEnabled: setOutOfTabBreakAlertsEnabled,
} = useOutOfTabBreakAlertsPreference(onboardingScope);

const getCycleEndAudioMode = useCallback(
	() => cycleEndAudioMode,
	[cycleEndAudioMode],
);
const getOutOfTabBreakAlertsEnabled = useCallback(
	() => outOfTabBreakAlertsEnabled,
	[outOfTabBreakAlertsEnabled],
);
const activeTaskIds = useMemo(
	() => new Set(tasks.filter((t) => t.status === "active").map((t) => t.id)),
	[tasks],
);
const pomodoro = usePomodoroCycle({
	getCycleEndAudioMode,
	getOutOfTabBreakAlertsEnabled,
	activeTaskIds,
	continueTasks: tasks.map((task) => ({ id: task.id, status: task.status })),
});
useE2eExposeCycleRecovery();
```

Dependencies:
- `cycleEndAudioMode` — a `PomodoroDashboardBody` **prop**, fed from `useCycleEndAudioPreference(scope)` called one level up in `AuthenticatedPomodoroDashboard` / `GuestPomodoroDashboard`.
- `outOfTabBreakAlertsEnabled` / `setOutOfTabBreakAlertsEnabled` — from `useOutOfTabBreakAlertsPreference(onboardingScope)` called **directly inside** `PomodoroDashboardBody`. Note: `setOutOfTabBreakAlertsEnabled` is used later (passed to `TimerPanel` as `onOutOfTabBreakAlertsChange`) but is **not** consumed by the cycle hook itself — only the getter is. If both the hook call and this preference hook move to the provider, the provider must still expose `setOutOfTabBreakAlertsEnabled`/`outOfTabBreakAlertsEnabled` back out (via the context value) so `TimerPanel`'s toggle keeps working.
- `activeTaskIds` / `continueTasks` — derived from the `tasks` prop.
- `onboardingScope` — also a `PomodoroDashboardBody` prop (default `{ mode: "guest" }`).

**`pomodoro.*` usage scope**: confirmed via grep — used **only** inside `PomodoroDashboardBody`'s own function body (lines ~178-1290+). No sibling/child component in the file receives the whole `pomodoro` object as a prop; everything downstream (`TimerPanel`, `TaskList`, `TaskSuggestionCard`, overlays, etc.) gets individually destructured fields/callbacks. This confirms a context is a clean fit — `PomodoroDashboardBody` becomes the sole context consumer.

### `DataModeProvider` (`src/lib/data-mode/data-mode-context.tsx`)

```ts
type DataModeContextValue = Repositories & { refreshKey: number; refreshGuest: () => void };
export function DataModeProvider({ mode, children }: { mode: DataMode; children: ReactNode }) { ... }
export function useRepositories(): DataModeContextValue { ... } // throws if used outside provider
export function useDataMode(): DataMode { return useRepositories().mode; }
```

Mounted today at `home-shell.tsx:79` inside `HomeShellContent`, wraps `GuestImportOnMount` / `MergeSuccessOverlayMount` / `FirstRunOverlay` / `<main>...<PomodoroDashboard/>`.

**All consumers of `useDataMode`/`useRepositories`** (grep, repo-wide):
- `src/hooks/use-task-mutations.ts` — both
- `src/hooks/use-pomodoro-cycle.ts:388-389` — both (the hook being lifted)
- `src/hooks/use-day-stats.ts`
- `src/hooks/use-day-plan.ts:10` (`useDataMode` — gates `dayPlan.getOrCreate` query `enabled: mode === "authenticated"`)
- `src/hooks/use-daily-recap.ts:64`
- `src/hooks/use-archive-tasks.ts:14` — `useRepositories()` only
- `src/app/_components/guest-import-on-mount.tsx:29` — `useRepositories()` only
- `src/app/_components/task-list.tsx:535` — `useDataMode()`
- `src/app/_components/pomodoro-dashboard.tsx:1358` — `useDataMode()` in `PomodoroDashboard` (branches guest/authenticated)

### Provider nesting today (`home-shell.tsx`), confirmed exact:

```
HomeShell
  OnboardingProvider (scope)
    GuestMergeUiProvider
      HomeIllustrationVariantProvider
        HomeShellContent (isAuthenticated, userId)
          DataModeProvider (mode)             ← :79, closes :102
            GuestImportOnMount (if authed)
            MergeSuccessOverlayMount
            FirstRunOverlay
            <main>
              OfflineBanner
              GuestBanner (if !authed)
              PomodoroDashboard
```
`mode` is computed in `HomeShellContent` from the `isAuthenticated` prop (not from `OnboardingScope`).

### `pomodoro-dashboard.tsx` top-level structure

```
PomodoroDashboardBody({ tasks, refreshTasks, dayPlan?, enableCheckInGate?, enableWindDownGate?,
  enableSuggestionGate?, checkInCoachLine?, suggestionCoachLine?, onboardingState?,
  shouldShowCheckInCoach?, shouldShowSuggestionCoach?, workTypeDurationScope?,
  cycleEndAudioMode, setCycleEndAudioMode (unused, prefixed _), onboardingScope = {mode:"guest"},
  onCheckInCoachSeen?, onSuggestionCoachSeen? })
  → calls usePomodoroCycle(...) + useOutOfTabBreakAlertsPreference + useDailyRecap + useDayStats
    + useOnboarding-derived locale/dataMode + renders the whole Fokus/Zadania/Plan/Podsumowanie/
    Ustawienia view-switcher (homeView state) + all overlays/gates.

AuthenticatedPomodoroDashboard()
  → useDayPlan() [needs DataModeProvider via useDataMode inside]
  → useDomainTasks("authenticated", { localDateKey: dayPlan.localDateKey, hasMounted })
  → useOnboarding() → { scope, state, shouldShowCheckInCoach, shouldShowSuggestionCoach, markCheckInCoachSeen, markSuggestionCoachSeen }
  → useCycleEndAudioPreference(onboardingScope)
  → renders <PomodoroDashboardBody dayPlan tasks=domainTasks refreshTasks ... enableCheckInGate enableSuggestionGate enableWindDownGate .../>

GuestPomodoroDashboard()
  → useGuestDomainTasks() → { tasks, refresh }
  → guestScope = { mode: "guest" }
  → useCycleEndAudioPreference(guestScope)
  → renders <PomodoroDashboardBody tasks refreshTasks=refresh onboardingScope=guestScope cycleEndAudioMode setCycleEndAudioMode /> (NO dayPlan, NO gates enabled)

PomodoroDashboard()
  → mode = useDataMode()
  → guest → <GuestPomodoroDashboard/>
  → authenticated → <Suspense fallback={"Loading tasks…" testid="dashboard-loading"}><AuthenticatedPomodoroDashboard/></Suspense>
```

Note: `useDayPlan()` itself calls `useDataMode()` (`:10` in `use-day-plan.ts`) and is `enabled: mode === "authenticated"` for its query — but it's currently called unconditionally in `AuthenticatedPomodoroDashboard` only (never in the guest path), so no branching issue there today.

`useAuthenticatedDomainTasks` uses `api.task.list.useSuspenseQuery()` — this is why `AuthenticatedPomodoroDashboard` needs the `<Suspense>` boundary that currently lives in `PomodoroDashboard()`.

### Preference hook signatures (self-contained, safe to call from a provider)

- `useCycleEndAudioPreference(scope: OnboardingScope)` → `{ mode: CycleEndAudioMode, setMode, isHydrated }`
- `useOutOfTabBreakAlertsPreference(scope: OnboardingScope)` → `{ enabled: boolean, setEnabled }`

Both are `"use client"` hooks with no other repo-hook dependencies inside.

### `useOnboarding()` / `OnboardingProvider`

Throws if used outside `OnboardingProvider` (same guard pattern as `useRepositories`). Scope-derived (`guest` vs `authenticated`+`userId`). Already wraps everything in `home-shell.tsx` **above** `DataModeProvider` today — order must be preserved (`OnboardingProvider` outside/above `DataModeProvider`/new cycle provider) since `AuthenticatedPomodoroDashboard` calls `useOnboarding()` for `onboardingScope`, and that scope is what feeds `useCycleEndAudioPreference`/`useOutOfTabBreakAlertsPreference`/the cycle hook.

### `useE2eExposeCycleRecovery()`

`src/hooks/use-e2e-expose-cycle-recovery.ts` — no params, just exposes `window.__flowstateResetCycleRecovery` behind an E2E env flag. Independent of the cycle hook's return value (imports `resetActiveCycleRecoveryGuard` directly from the hook module). Can move to the provider or stay — doesn't matter functionally, but logically belongs beside the single-mount guarantee, so co-locate in the provider.

### `useDayPlan()` return shape (`DayPlanView` type alias = `ReturnType<typeof useDayPlan>`)

`{ localDateKey, budgetMinutes, remainingMinutes, usedMinutes, hasBudget, isLoading, isSettingBudget, setBudget }`. Only called in `AuthenticatedPomodoroDashboard` — **not** part of the cycle hook's own inputs, but its `localDateKey` feeds `useDomainTasks`'s day-status query and is passed through as the `dayPlan` prop to `PomodoroDashboardBody` (optional, `undefined` for guest). Plan's contract for Phase 10 only requires lifting what the cycle hook itself depends on (task source + the two preference resolvers) — `dayPlan` is a separate, page-level concern and does **not** need to move to the provider.

## Test surface impact

### `pomodoro-dashboard.test.tsx`

```ts
const usePomodoroCycleMock = vi.fn();
vi.mock("~/hooks/use-pomodoro-cycle", () => ({
	usePomodoroCycle: (...args: unknown[]) => usePomodoroCycleMock(...args),
}));
...
function makePomodoroMock(overrides = {}) { /* full default pomodoro shape + overrides */ }
```
~40 call sites render `<PomodoroDashboardBody .../>` directly with `usePomodoroCycleMock.mockReturnValue(makePomodoroMock(...))` set beforehand. Every one passes `cycleEndAudioMode`, `refreshTasks`, `setCycleEndAudioMode`, `tasks` (some also `onboardingScope`, `dayPlan`, gate flags). **This file mocks the hook module directly — it does not go through `DataModeProvider` at all today** (no wrapper found in the read excerpts). If `PomodoroDashboardBody` switches to reading a new `usePomodoroCycleContext()` instead of calling `usePomodoroCycle()` itself, this file's mock target must move to whatever module exports that context hook (e.g. mock `~/app/_components/pomodoro-cycle-provider` exporting `usePomodoroCycleContext`). Same shape (`usePomodoroCycleMock`), different import path — mechanical rename, not a rewrite.

No test file renders `PomodoroDashboard`, `AuthenticatedPomodoroDashboard`, or `GuestPomodoroDashboard` directly (confirmed via grep, zero matches outside `pomodoro-dashboard.tsx` itself).

### `home-shell.test.tsx`

Already fully mocks collaborators:
```ts
vi.mock("~/app/_components/pomodoro-dashboard", () => ({ PomodoroDashboard: () => <div data-testid="pomodoro-dashboard" /> }));
vi.mock("~/lib/data-mode/data-mode-context", () => ({ DataModeProvider: ({ children }) => children }));
vi.mock("~/hooks/use-onboarding-state", () => ({ OnboardingProvider: ({ children }) => children, useOnboarding: () => ({...}) }));
```
Since `PomodoroDashboard` itself is fully stubbed, `usePomodoroCycle`/any new provider is never reached today. **If** `PomodoroCycleProvider` gets mounted inside/around `HomeShellContent` (rather than purely in `layout.tsx` above `home-shell`), this test will likely need a matching pass-through mock added, same pattern as the `DataModeProvider` mock. If the provider instead moves all the way up into `layout.tsx` (outside anything `home-shell.test.tsx` renders), this file needs **no changes** — cleaner outcome, prefer this placement if feasible.

### Hook's own tests — unaffected

`use-pomodoro-cycle.test.tsx` / `use-pomodoro-cycle-guest.test.tsx` use `renderHook` + mock `~/lib/data-mode/data-mode-context` directly (hardcode `useDataMode`/`useRepositories`), bypassing any provider entirely. Lifting the hook's call site requires **no changes** to these two files.

## Root layout / page (server-side) — current shape

`src/app/layout.tsx` (async server component):
```
<html><body>
  <NextIntlClientProvider>
    <TRPCReactProvider>
      <ThemeProvider>
        <OAuthSessionVerifier/>
        <AppNavbar scope userName/>
        {children}
      </ThemeProvider>
    </TRPCReactProvider>
  </NextIntlClientProvider>
</body></html>
```
Resolves `auth.getSession()` itself (try/catch) to get `userId`/`userName` for `AppNavbar`.

`src/app/page.tsx` (async server component):
```
Home() → auth.getSession() again (separate call) → isAuthenticated
  if authenticated: Promise.all([api.task.list.prefetch(), api.cycle.getActive.prefetch(), api.recap.getDaily.prefetch(...)])
  → <HydrateClient><HomeShell isAuthenticated userId /></HydrateClient>
```
`auth.getSession()` is called independently in both `layout.tsx` and `page.tsx` today (not deduped via `cache()` at the auth-client level, only tRPC's server caller context is `cache()`-wrapped per `src/trpc/server.ts`). Not a Phase-10 concern, just noted — no existing dedup pattern to break.

`AppNavbar` (`app-navbar.tsx`) has **no** dependency on `DataMode`/cycle state — just `scope` + `userName` props from the layout's own auth resolution. Its own test (`app-navbar.test.tsx`) wraps only `NextIntlClientProvider > ThemeProvider`, no `DataModeProvider` — confirms the navbar is safely outside any Phase-10 provider concerns and Phase 11's nav shell replacement won't be blocked by provider placement choices made here.

## Design decision to make before writing code

**Where exactly does `PomodoroCycleProvider` (+ lifted `DataModeProvider`) mount?**

Two candidate placements, both technically satisfy "below `TRPCReactProvider`/`ThemeProvider`, above every route that renders the timer":

1. **In `layout.tsx` directly**, wrapping `{children}` (alongside or replacing where `AppNavbar` sits). Cleanest for Phase 11 (routes under `children` all get it for free), and `home-shell.test.tsx` needs zero changes since it never touches `layout.tsx`. Downside: `layout.tsx` is an async **server** component — the provider must be a `"use client"` wrapper component inserted as a child, which is fine (already how `ThemeProvider`/`TRPCReactProvider` work), but the auth-derived `userId`/`isAuthenticated` needed to pick `mode: DataMode` must be threaded down from the layout's own session resolution (or the provider/its children re-derive it client-side, as `HomeShell` does today via its own `isAuthenticated` prop from `page.tsx`).

2. **Inside `home-shell.tsx`**, replacing the current `DataModeProvider` mount point but still wrapping `PomodoroDashboard` — i.e. lift the *hook call*, keep the *mount location* page-scoped for now, defer the true layout-level mount to Phase 11 when routes actually exist. This is **weaker** — doesn't achieve "survives navigation" since there's no navigation yet in Phase 10, but the plan explicitly says Phase 10 is "still a single home screen at this phase — routes come in Phase 11." Rereading the plan text: *"Place `PomodoroCycleProvider` (+ `DataModeProvider`) below `NextIntlClientProvider`/`TRPCReactProvider`/`ThemeProvider` and around `{children}` (`layout.tsx:72-77`)"* — the plan is explicit: **option 1, mount in `layout.tsx` around `{children}`**. This is confirmed by the plan text itself, not just inferred.

So: **use option 1.** `layout.tsx` needs `userId`/`isAuthenticated` at the point it renders `{children}` — it already resolves `auth.getSession()` for the navbar, so reuse that result rather than calling it a third time.

**Second decision: does `home-shell.tsx` still need its own `mode`/`DataModeProvider` reference at all after the lift?**

No — once `DataModeProvider` moves to `layout.tsx`, `home-shell.tsx`'s `HomeShellContent` should stop rendering `<DataModeProvider>` itself and just consume `useDataMode()` (already used elsewhere, e.g. `PomodoroDashboard`) if it needs `mode` for its own branching (it currently derives `mode` from the `isAuthenticated` prop it already receives — check whether it can keep doing that locally without the provider, since `isAuthenticated` is already a prop passed from `page.tsx`; only downstream consumers strictly need the *context* version). Since `HomeShellContent` computes `mode` itself already (`isAuthenticated ? "authenticated" : "guest"`) and doesn't call `useDataMode()`, it may not need any change here beyond removing the `<DataModeProvider>` JSX wrapper — but `page.tsx`/`layout.tsx` must agree on the same `mode` value the provider is initialized with. Need to make sure `layout.tsx`'s auth resolution and `page.tsx`'s auth resolution produce the same `isAuthenticated` (they use slightly different checks today — `page.tsx` requires `user?.id && user.email`, `layout.tsx` only checks `user?.id` for `userId`). **Flag this discrepancy before implementing** — worth resolving to a single source of truth (or explicitly confirming the difference is intentional) rather than silently duplicating slightly different auth-check logic in three places (`layout.tsx`, `page.tsx`, and now potentially the new provider's mount point).

## Files that will need touching (per plan.md Phase 10 contract + this research)

1. **New**: `src/app/_components/pomodoro-cycle-provider.tsx` — `PomodoroCycleProvider` (`"use client"`), wraps `usePomodoroCycle` + the task source + the two preference hooks (`useCycleEndAudioPreference`, `useOutOfTabBreakAlertsPreference`) + `useE2eExposeCycleRecovery`, exposes everything via `usePomodoroCycleContext()`. Must resolve task source for **both** auth and guest modes above the branch (`useDomainTasks`/`useGuestDomainTasks` equivalent) since the hook now lives above `AuthenticatedPomodoroDashboard`/`GuestPomodoroDashboard`'s split.
2. **`src/app/layout.tsx`** — mount `DataModeProvider` + `PomodoroCycleProvider` around `{children}`, reusing the existing auth-session resolution instead of a third `auth.getSession()` call.
3. **`src/app/_components/home-shell.tsx`** — remove the local `<DataModeProvider>` wrapper (now redundant/moved up); confirm `HomeShellContent`'s `mode` derivation still lines up.
4. **`src/app/_components/pomodoro-dashboard.tsx`** — `PomodoroDashboardBody` stops calling `usePomodoroCycle`/`useOutOfTabBreakAlertsPreference` itself; reads `usePomodoroCycleContext()` instead (which must also expose `outOfTabBreakAlertsEnabled`/`setOutOfTabBreakAlertsEnabled` since `TimerPanel` needs the setter). `AuthenticatedPomodoroDashboard`/`GuestPomodoroDashboard` stop building `tasks`/`cycleEndAudioMode` for the hook's sake (still need `tasks` for their own props like `TaskList`/`dayPlan`-adjacent UI — re-check exactly what `PomodoroDashboardBody` still needs `tasks` for beyond the hook: yes, `tasks` is used extensively for `TaskList`, `standingTaskFacts`, `dayMemoryHasContent`, `focusedActiveTask`, `midCycleOtherActiveTasks`, `activeTaskIds` (still computed locally for the `canMarkTaskDone` check) — so `tasks` stays a required prop, only the *hook call* moves, not all task-derived logic).
5. **`pomodoro-dashboard.test.tsx`** — retarget the `vi.mock` from `~/hooks/use-pomodoro-cycle` to the new provider module's exported context hook; `makePomodoroMock` shape stays the same.
6. **`home-shell.test.tsx`** — only if `DataModeProvider`/`PomodoroCycleProvider` end up still reachable from what this test renders; likely no change needed if provider truly lives in `layout.tsx` only (this test never renders `layout.tsx`).
7. **Possibly `use-day-plan.ts`, `use-daily-recap.ts`, `use-day-stats.ts`, `use-task-mutations.ts`, `use-archive-tasks.ts`, `task-list.tsx`, `guest-import-on-mount.tsx`** — all call `useDataMode()`/`useRepositories()` and live under components that are still rendered inside `{children}`, so as long as `DataModeProvider` wraps `{children}` in `layout.tsx`, **none of these need code changes** — they just now resolve against the higher provider transparently. Only listed here to confirm no breakage, not because edits are expected.

## Open question to raise with the user before coding

`layout.tsx` (`auth.getSession()` → checks `user?.id`) and `page.tsx` (`auth.getSession()` → checks `user?.id && user.email`) use **different** truthiness checks for "is this user authenticated," and each calls `auth.getSession()` independently (not deduped). Lifting the provider to `layout.tsx` means picking one of these checks as the canonical `mode` input, or explicitly keeping two independent resolutions if there's a real reason for the discrepancy (e.g. `userName` fallback logic in `layout.tsx` tolerates a missing email, but `page.tsx`'s prefetch gate does not). Worth a quick confirmation rather than silently picking one.

## Lessons.md items relevant to this phase

- **L-04** (NFR 200ms per action surface): any new interactive surface touched while wiring the provider (e.g. if `TimerPanel`'s start/pause path changes shape) needs its own latency oracle — shouldn't apply here since Phase 10 is a pure plumbing change with no new UI, but keep in mind if `PomodoroDashboardBody` needs restructuring beyond the mechanical hook-call swap.
- **Wedge dismiss-oracle rule**: Phase 10's plan text explicitly calls for care around the check-in/wind-down/steering gates not regressing (Progress items 10.6-10.7) — since this phase doesn't touch transition *logic*, only *where the hook is called from*, the existing wedge tests in `pomodoro-dashboard.test.tsx` (retargeted to the new mock path) should already cover this; no new dismiss-oracle tests are required unless the retarget reveals a gap.

## Next step (not yet done)

Implement per the file list above, starting with `pomodoro-cycle-provider.tsx`, then `layout.tsx`, then `home-shell.tsx`, then `pomodoro-dashboard.tsx`, then update `pomodoro-dashboard.test.tsx`'s mock target. Run `pnpm typecheck && pnpm check && pnpm test` after. No code has been written yet as of this note.
