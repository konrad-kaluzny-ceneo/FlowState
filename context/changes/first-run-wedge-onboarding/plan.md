# First-Run Wedge Onboarding (S-11) Implementation Plan

## Overview

Ship dismissible first-run guidance for guest and authenticated users, recurring empty-list guidance when active tasks = 0, and two sequential one-line coach tips (check-in then suggestion) as non-blocking subcopy on existing S-06 wedge surfaces. Persistence uses device-local `localStorage` scoped per guest or auth `userId` — no server profile model.

## Current State Analysis

S-11 is **greenfield UI guidance** — no onboarding module, tour, coach copy, or dismissible first-run flow exists. Strong substrate from shipped slices:

- Overlay shell: `CycleCompleteOverlay` (`z-50`), check-in gate (`z-[60]`) — first-run should use `z-[55]` per research
- Wedge surfaces: `CheckInOverlay` (blocking, auth-only), `TaskSuggestionCard` (inline break card, auth-only)
- Guest/auth split: `PomodoroDashboard` gates `enableCheckInGate` / `enableSuggestionGate` for authenticated mode only
- localStorage namespace: `flowstate:` prefix from `duration-storage.ts` and `guest/schema.ts`
- Empty active list: bare `"No active tasks"` at `task-list.tsx:270-271`
- E2E helpers: `ensureIdleCycle`, `completeCheckIn`, `expectSuggestionVisible` — need first-run dismissal

### Key Discoveries:

- First-run mount point: `HomeShell` — sibling to `GuestBanner` / `PomodoroDashboard`; receives `isAuthenticated` today (`home-shell.tsx:12-27`)
- Auth `userId` available server-side in `page.tsx` via `auth.getSession()` — pass to client for storage key scoping (no new auth path)
- Coach must stay subcopy-only — roadmap forbids second blocking modal on check-in
- Empty guide is **state-driven** (`activeTasks.length === 0`), not flag-driven — differs from first-run/coach
- S-14 coordination: merge-success UI should win over first-run when both fire post sign-in; defer first-run until merge modal dismissed (stub hook acceptable until S-14 ships)

## Desired End State

1. **Guest first visit:** dismissible overlay teaches add task → focus → run cycle → sign in to unlock check-in + suggestions; dismiss sets `firstRunDismissed`; revisit hidden.
2. **Auth first visit:** dismissible overlay teaches check-in → suggestion wedge → accept or override; same dismiss semantics on `flowstate:onboarding:{userId}`.
3. **Empty active list:** whenever `activeTasks.length === 0`, calm guidance line + CTA to add a task (guest copy may mention sign-in for wedge unlock); reappears whenever count returns to zero.
4. **Auth wedge coaches:** first check-in shows one-line coach subcopy below existing copy; marks `checkInCoachSeen` on first energy tap. First `ready` suggestion shows second one-liner; marks `suggestionCoachSeen` on first render of ready card. Second cycle: no coach lines.
5. **Guest:** no check-in/suggestion coaches (gates off).
6. **Verification:** `pnpm check`, `pnpm typecheck`, `pnpm test`, `set CI=true && pnpm test:e2e` including new specs and regression on `task-suggestion.spec.ts`.

### Acceptance Criteria (PRD mapping)

| Criterion | PRD ref | Verification |
|-----------|---------|--------------|
| Guest can discover task + cycle trial without account | FR-003b | Guest first-run copy + E2E `guest-first-run.spec.ts` |
| User can add a task (empty-guide CTA) | FR-004 | Empty guide CTA focuses add input; E2E |
| User can view active vs completed lists; empty active is guided | FR-008, proposed-FR-empty-state-guidance | `empty-active-tasks-guide` when count = 0 |
| User can select task to focus before cycle | FR-009 | First-run + empty guide mention focus step |
| Work type / weight exist for scoring context | FR-017, FR-018 | Coach copy references energy + suggestion without re-teaching attributes |
| First check-in teaches energy selection | FR-020 | Check-in coach subcopy on first auth check-in |
| First suggestion teaches accept/override wedge | FR-021, FR-022 | Suggestion coach subcopy; existing accept/override E2E still passes |
| Dismissible first-run teaches wedge path | proposed-FR-first-run-guidance | `first-run-overlay` dismiss + persistence E2E |

## What We're NOT Doing

- Server-side onboarding preferences / Prisma User profile
- Cross-device "seen" sync
- Blocking coach modals or multi-step tours
- "Remind me later" nag loop on first-run
- Guest live check-in/suggestion demo (parity gap per FR-003b)
- Visual polish of overlay surfaces (S-12)
- S-14 merge-success UI implementation (only coordination hook/stub)
- Analytics events for onboarding funnel

## Implementation Approach

Five incremental phases: storage foundation → first-run overlay → empty guide → wedge coach subcopy → E2E proofs. Pure storage in `src/lib/onboarding/`; React hook `useOnboardingState` owns read/write; presentational components receive copy + callbacks. Copy constants centralized in `src/lib/onboarding/copy.ts` for guest/auth variants.

## Critical Implementation Details

**Z-index stack:** First-run overlay `z-[55]` — above cycle-complete (`z-50`), below check-in (`z-[60]`). If cycle-complete and first-run could overlap, first-run should not mount while `pomodoro.state === "completed"` (defer to post-overlay idle).

**Coach seen timing:** Set `checkInCoachSeen` in `submitCheckIn` wrapper on first energy selection (user engaged). Set `suggestionCoachSeen` when `TaskSuggestionCard` first renders with `status === "ready"` and coach flag unset (one render cycle).

**S-14 stub:** Export `shouldDeferFirstRun(): boolean` from `src/lib/onboarding/defer.ts` returning `false` until S-14 wires merge-success visibility. `FirstRunOverlay` checks this before showing.

**Auth userId:** Hoist `user` / `userId` to `Home()` function scope (not only inside `try`) so JSX can pass `userId={user?.id ?? null}` into `HomeShell`. Hook uses `null` userId in authenticated mode as "no storage writes until id known" guard.

**Shared onboarding state:** Single `OnboardingProvider` at `HomeShell` owns hook state; Phase 4 dashboard consumes `useOnboarding()` from context — no second `useOnboardingState` instance.

**Cycle-complete defer:** `FirstRunOverlay` also hides while `[data-testid="cycle-complete-overlay"]` is visible (small `useTestIdVisible` helper) — implements the z-index overlap rule without pomodoro state in `HomeShell`.

---

## Phase 1: Onboarding Storage Module + Types

### Overview

Establish typed localStorage persistence for three flags (`firstRunDismissed`, `checkInCoachSeen`, `suggestionCoachSeen`) with guest and per-user auth keys.

### Changes Required:

#### 1. Onboarding types

**File**: `src/lib/onboarding/types.ts` (new)

**Intent**: Single source of truth for onboarding state shape and defaults.

**Contract**: Export `OnboardingState` interface with booleans `firstRunDismissed`, `checkInCoachSeen`, `suggestionCoachSeen`. Export `DEFAULT_ONBOARDING_STATE` (all `false`). Export `OnboardingScope` type: `{ mode: "guest" } | { mode: "authenticated"; userId: string }`.

#### 2. Storage key helpers

**File**: `src/lib/onboarding/keys.ts` (new)

**Intent**: Centralize `flowstate:onboarding:guest` and `flowstate:onboarding:{userId}` key resolution.

**Contract**: Export `ONBOARDING_KEY_GUEST = "flowstate:onboarding:guest"`. Export `onboardingKeyForScope(scope: OnboardingScope): string | null` — returns `null` when `mode === "authenticated"` but `userId` is missing/empty.

#### 3. Storage read/write

**File**: `src/lib/onboarding/storage.ts` (new)

**Intent**: SSR-safe localStorage accessors mirroring `duration-storage.ts` patterns.

**Contract**: Export `loadOnboardingState(scope): OnboardingState`, `saveOnboardingState(scope, state): void`, `patchOnboardingState(scope, partial): OnboardingState`. JSON parse with try/catch; corrupt/missing → defaults. `typeof window === "undefined"` → defaults on read, no-op on write. Version field optional in JSON (`v: 1`) for future migration — ignore unknown fields on read.

#### 4. React hook + provider

**File**: `src/hooks/use-onboarding-state.ts` (new)

**Intent**: Client hook and provider so `HomeShell` + dashboard share one onboarding state instance.

**Contract**: Export `OnboardingProvider({ scope, children })` holding state. Export `useOnboarding()` (context consumer) returning `{ state, dismissFirstRun, markCheckInCoachSeen, markSuggestionCoachSeen, isFirstRunVisible, shouldShowCheckInCoach, shouldShowSuggestionCoach }`. Internal hook initializes from `loadOnboardingState` in `useState` + sync patches via `saveOnboardingState`. `isFirstRunVisible = !state.firstRunDismissed && !shouldDeferFirstRun()`. Subscribe to nothing cross-tab (out of scope). Throw if `useOnboarding()` used outside provider.

#### 4b. Overlay visibility helper

**File**: `src/hooks/use-test-id-visible.ts` (new)

**Intent**: Defer first-run while cycle-complete overlay is on screen.

**Contract**: Export `useTestIdVisible(testId: string): boolean` — client-only; returns whether an element with `data-testid` is in the document and visible (MutationObserver or `requestAnimationFrame` poll). Used by `FirstRunOverlay` with `"cycle-complete-overlay"`.

#### 5. Defer stub for S-14

**File**: `src/lib/onboarding/defer.ts` (new)

**Intent**: Coordination point for merge-success UI priority.

**Contract**: Export `shouldDeferFirstRun(): boolean` — returns `false` in S-11. Comment documents S-14 will return `true` while merge-success modal visible.

#### 6. Unit tests

**File**: `src/lib/onboarding/storage.test.ts` (new)

**Intent**: Prove parse defaults, round-trip, corrupt JSON, SSR guard, key isolation guest vs auth userId.

**Contract**: Mirror `duration-storage.test.ts` structure — `beforeEach(() => localStorage.clear())`. Cases: empty → defaults; round-trip all flags; corrupt JSON → defaults; guest key ≠ auth key for different userIds.

### Success Criteria:

#### Automated Verification:

- `pnpm check` passes
- `pnpm typecheck` passes
- `pnpm exec vitest run src/lib/onboarding/storage.test.ts` passes

#### Manual Verification:

- DevTools: set `flowstate:onboarding:guest` JSON manually → hook reflects on reload

**Implementation Note**: Pause for manual confirmation before Phase 2.

---

## Phase 2: First-Run Dismissible Overlay (Home Shell)

### Overview

Add `FirstRunOverlay` component and mount from `HomeShell` when `isFirstRunVisible` for the current mode.

### Changes Required:

#### 1. Copy constants

**File**: `src/lib/onboarding/copy.ts` (new)

**Intent**: Tailored guest vs auth first-run strings in one place.

**Contract**: Export `getFirstRunCopy(mode: "guest" | "authenticated")` returning `{ title, body, dismissLabel }`. Guest body covers: add tasks, focus, run a cycle, sign in to unlock energy check-ins and smart suggestions. Auth body covers: after cycle ends → energy check-in → suggestion with rationale → accept or pick any task. Keep copy calm, ≤3 short paragraphs total.

#### 2. First-run overlay component

**File**: `src/app/_components/first-run-overlay.tsx` (new)

**Intent**: Dismissible modal following existing overlay card pattern.

**Contract**: Props: `{ mode, onDismiss, visible: boolean }`. Render `fixed inset-0 z-[55]` backdrop when `visible`, `data-testid="first-run-overlay"`, `role="dialog"`. Card with title, body, primary button `data-testid="first-run-dismiss-btn"` labeled from copy. No backdrop click dismiss, no escape dismiss — explicit CTA only. `onDismiss` called on button click.

#### 3. Home shell integration

**File**: `src/app/_components/home-shell.tsx` (extend)

**Intent**: Mount overlay at app shell level for both modes.

**Contract**: Accept new prop `userId: string | null`. Build `OnboardingScope` from `isAuthenticated` + `userId`. Wrap tree in `<OnboardingProvider scope={scope}>`. Inner shell component calls `useOnboarding()` and `useTestIdVisible("cycle-complete-overlay")`; render `<FirstRunOverlay visible={isFirstRunVisible && !cycleCompleteVisible}>` with `dismissFirstRun` as `onDismiss`. Do not show when `shouldDeferFirstRun()` true.

#### 4. Server userId pass-through

**File**: `src/app/page.tsx` (extend)

**Intent**: Provide auth userId to client without new client auth fetch.

**Contract**: Declare `let user: SessionUser | undefined` (or equivalent) before `try`; assign from `auth.getSession()` inside `try`. Pass `userId={user?.id ?? null}` to `HomeShell` alongside `isAuthenticated`.

### Success Criteria:

#### Automated Verification:

- `pnpm check` passes
- `pnpm typecheck` passes
- `pnpm test` passes

#### Manual Verification:

- Fresh guest: first-run shows, dismiss hides on reload
- Fresh auth: different copy, dismiss persists per userId key
- Check-in overlay (z-60) still appears above first-run if somehow concurrent

**Implementation Note**: Pause for manual confirmation before Phase 3.

---

## Phase 3: Empty-List Guidance in Task List

### Overview

Replace bare empty placeholder with contextual guidance whenever active task count is zero.

### Changes Required:

#### 1. Empty guide component

**File**: `src/app/_components/empty-active-tasks-guide.tsx` (new)

**Intent**: Testable empty-state with calm copy + CTA.

**Contract**: Props: `{ mode: "guest" | "authenticated"; onAddTaskClick?: () => void }`. Render container `data-testid="empty-active-tasks-guide"`. One calm line (e.g. "No active tasks yet — add one to start a focus cycle.") + link-style button "Add a task" calling `onAddTaskClick`. Guest variant adds brief sign-in mention for wedge unlock (one clause, not a banner). Styling: `text-sm text-white/50` line + underline button matching existing dismiss/link patterns.

#### 2. Task list wiring

**File**: `src/app/_components/task-list.tsx` (extend)

**Intent**: Swap empty placeholder for guide component.

**Contract**: Import `useDataMode` for mode. Replace `activeTasks.length === 0` `<p>No active tasks</p>` block with `<EmptyActiveTasksGuide>`. `onAddTaskClick` focuses add-task input via `ref` on existing input (`placeholder="Add a new task..."`) — add `inputRef` if not present. Guide shows regardless of cycle lock state.

### Success Criteria:

#### Automated Verification:

- `pnpm check` passes
- `pnpm typecheck` passes
- `pnpm test` passes

#### Manual Verification:

- Zero active tasks → guide visible for guest and auth
- Add task → guide hidden; mark done on last task → guide returns
- CTA focuses add input

**Implementation Note**: Pause for manual confirmation before Phase 4.

---

## Phase 4: Coach Subcopy in Check-In + Suggestion (Auth Path)

### Overview

Inject optional one-line coach subcopy on first auth check-in and first ready suggestion; wire flag mutations.

### Changes Required:

#### 1. Coach copy constants

**File**: `src/lib/onboarding/copy.ts` (extend)

**Intent**: Sequential one-liners for wedge moments.

**Contract**: Export `CHECK_IN_COACH_LINE` (e.g. "This quick check-in helps FlowState suggest what fits your energy.") and `SUGGESTION_COACH_LINE` (e.g. "Accept the suggestion or tap Focus on any other task — you're always in control."). Single line each, ≤120 chars.

#### 2. Check-in overlay subcopy

**File**: `src/app/_components/check-in-overlay.tsx` (extend)

**Intent**: Optional coach line below existing subcopy.

**Contract**: Add optional prop `coachLine?: string`. When set, render `<p data-testid="check-in-coach-line" className="mt-1 text-purple-200/70 text-xs">` between heading block and energy buttons. No layout shift beyond one line.

#### 3. Suggestion card subcopy

**File**: `src/app/_components/task-suggestion-card.tsx` (extend)

**Intent**: Optional coach line below heading on ready state.

**Contract**: Add optional `coachLine?: string` to `ready` variant props. Render `<p data-testid="suggestion-coach-line" className="mt-1 text-purple-200/70 text-xs">` below `<h2>Suggested next task</h2>` when `status === "ready"`. Omit on loading/error/empty.

#### 4. Dashboard coach wiring

**File**: `src/app/_components/pomodoro-dashboard.tsx` (extend)

**Intent**: Connect onboarding hook to overlay components on auth path only.

**Contract**: In `AuthenticatedPomodoroDashboard` (must render under `OnboardingProvider` from Phase 2): call `useOnboarding()` — do **not** instantiate a second provider or hook with a new scope. Pass `coachLine={shouldShowCheckInCoach ? CHECK_IN_COACH_LINE : undefined}` to `CheckInOverlay`. Wrap `onSubmit` to call `markCheckInCoachSeen()` before delegating to `pomodoro.submitCheckIn`. Pass `coachLine={shouldShowSuggestionCoach ? SUGGESTION_COACH_LINE : undefined}` to ready `TaskSuggestionCard`. On first ready suggestion render, call `markSuggestionCoachSeen()` via `useEffect` in dashboard when coach visible.

#### 5. Guest path guard

**Contract**: Guest `PomodoroDashboardBody` does not pass coach props; `enableCheckInGate`/`enableSuggestionGate` remain false — no coach UI.

### Success Criteria:

#### Automated Verification:

- `pnpm check` passes
- `pnpm typecheck` passes
- `pnpm test` passes

#### Manual Verification:

- Auth: first work cycle → check-in shows coach line → second cycle does not
- Auth: first suggestion ready shows coach → second cycle does not
- Guest: no coach lines at any point
- Check-in remains blocking; coach does not add steps

**Implementation Note**: Pause for manual confirmation before Phase 5.

---

## Phase 5: E2E Tests (First-Run, Empty Guide, Coach Subcopy)

### Overview

Browser proofs for onboarding surfaces; extend helpers so existing wedge specs stay green.

### Changes Required:

#### 1. Onboarding E2E helpers

**File**: `e2e/helpers/onboarding.ts` (new)

**Intent**: Reusable localStorage seeding and dismissal.

**Contract**: Export `clearOnboardingKeys(page)`, `seedOnboardingDismissed(page, userId?: string)`, `dismissFirstRunIfVisible(page)`. Keys: `flowstate:onboarding:guest` and `flowstate:onboarding:{userId}`.

#### 2. Idle cycle helper extension

**File**: `e2e/helpers/idle-cycle.ts` (extend)

**Intent**: Prevent first-run overlay from blocking existing specs.

**Contract**: At start of retry loop, if `first-run-overlay` visible → click `first-run-dismiss-btn`. Re-check idle after dismiss.

#### 2b. Guest / smoke spec hardening

**Files**: `e2e/smoke.spec.ts`, `e2e/guest-trial.spec.ts`, `e2e/guest-merge-on-sign-in.spec.ts`, `e2e/guest-merge-cycle-on-sign-in.spec.ts` (extend as needed)

**Intent**: Specs that `goto("/")` without `ensureIdleCycle` still pass after first-run ships.

**Contract**: In each spec's setup (or shared guest `beforeEach`), call `clearOnboardingKeys(page)` and `dismissFirstRunIfVisible(page)` from `e2e/helpers/onboarding.ts` before assertions. `mid-cycle-last-task.spec.ts` inherits fix via `ensureIdleCycle` only — no separate edit unless CI fails.

#### 3. Check-in helper extension

**File**: `e2e/helpers/check-in.ts` (extend)

**Intent**: Optional coach assertion.

**Contract**: Add `expectCoach?: boolean` to `completeCheckIn` options — when true, assert `check-in-coach-line` visible before tap; when false, assert hidden.

#### 4. Suggestion helper extension

**File**: `e2e/helpers/suggestion.ts` (extend)

**Intent**: Optional coach assertion on suggestion card.

**Contract**: `expectSuggestionVisible` accepts `expectCoach?: boolean` — assert `suggestion-coach-line` visible/hidden accordingly.

#### 5. Auth onboarding spec

**File**: `e2e/first-run-onboarding.spec.ts` (new)

**Intent**: Auth-path proofs for first-run, empty guide, coach sequence.

**Contract**: Use `fixtures.ts` auth test. `beforeEach`: goto `/`, clear onboarding keys, `ensureIdleCycle`. Tests:
1. First visit shows `first-run-overlay` → dismiss → reload → hidden; localStorage flag set
2. Empty active list shows `empty-active-tasks-guide` + CTA
3. First check-in: coach visible; complete second cycle: coach hidden
4. First suggestion: coach visible; second cycle: coach hidden
5. Regression snippet: `task-suggestion.spec.ts` accept path still works (or run full file in CI phase)

#### 6. Guest first-run spec

**File**: `e2e/guest-first-run.spec.ts` (new)

**Intent**: Guest copy + no wedge coaches.

**Contract**: `guest-chromium` project (`testMatch` pattern). Clear localStorage, goto `/`. Tests:
1. First-run shows with guest-specific copy (assert key phrase difference from auth)
2. Dismiss persists on reload
3. No `check-in-coach-line` / `suggestion-coach-line` in guest work cycle flow (guest has no check-in overlay)

### Success Criteria:

#### Automated Verification:

- `pnpm check` passes
- `pnpm typecheck` passes
- `pnpm test` passes
- `set CI=true && pnpm test:e2e e2e/first-run-onboarding.spec.ts` passes
- `set CI=true && pnpm test:e2e e2e/guest-first-run.spec.ts` passes
- `set CI=true && pnpm test:e2e e2e/task-suggestion.spec.ts` passes (regression)

#### Manual Verification:

- Full two-cycle manual smoke: coaches appear once, empty guide recurs on zero tasks

**Implementation Note**: Final phase — ship when all automated checks green.

---

## Testing Strategy

### Unit Tests:

- `storage.test.ts`: key isolation, corrupt JSON, SSR guards, patch merges
- No component unit tests required unless implementer finds regressions in overlay render

### Integration Tests:

- None — no server API changes

### E2E Tests:

- Auth: first-run dismiss persistence, empty guide, sequential coaches, wedge regression
- Guest: first-run copy, no coaches
- Helper: `ensureIdleCycle` dismisses first-run for downstream specs
- Guest/smoke/merge specs dismiss or clear onboarding keys before assertions

### Manual Testing Steps:

1. Incognito guest → first-run → dismiss → add task → empty guide gone → delete last task → guide returns
2. Auth fresh user → dismiss first-run → complete cycle → coach on check-in only once
3. Same user second cycle → suggestion coach only on first ready card
4. Shared device: two auth users get independent onboarding keys

## Performance Considerations

- localStorage reads once per hook mount; patches are O(1) writes — negligible
- No additional network calls
- First-run overlay is one-time DOM; empty guide is lightweight conditional render

## Migration Notes

- No DB migration
- Existing users on first deploy see first-run once (no `firstRunDismissed` key) — intended
- Guest keys remain on `:guest` after auth sign-in; auth user gets fresh `:userId` key — intentional per research

## References

- Research: `context/changes/first-run-wedge-onboarding/research.md`
- Roadmap S-11: `context/foundation/roadmap.md`
- PRD: `context/foundation/prd.md` (FR-003b, FR-004, FR-008, FR-009, FR-017, FR-018, FR-020, FR-021, FR-022)
- S-06 wedge plan: `context/archive/2026-06-07-adaptive-task-suggestion/plan.md`
- S-08 guest storage: `context/archive/2026-05-29-guest-local-storage-merge/plan.md`
- Overlay pattern: `src/app/_components/cycle-complete-overlay.tsx:40-43`
- Check-in gate: `src/app/_components/pomodoro-dashboard.tsx:159-167`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Onboarding Storage Module + Types

#### Automated

- [x] 1.1 `pnpm check` passes — 86e0454
- [x] 1.2 `pnpm typecheck` passes — 86e0454
- [x] 1.3 `pnpm exec vitest run src/lib/onboarding/storage.test.ts` passes — 86e0454

#### Manual

- [ ] 1.4 DevTools localStorage round-trip reflects in hook on reload

### Phase 2: First-Run Dismissible Overlay (Home Shell)

#### Automated

- [x] 2.1 `pnpm check` passes — 940d328
- [x] 2.2 `pnpm typecheck` passes — 940d328
- [x] 2.3 `pnpm test` passes — 940d328

#### Manual

- [x] 2.4 Guest and auth first-run dismiss persists; z-index does not block check-in — 940d328

### Phase 3: Empty-List Guidance in Task List

#### Automated

- [x] 3.1 `pnpm check` passes — 017859c
- [x] 3.2 `pnpm typecheck` passes — 017859c
- [x] 3.3 `pnpm test` passes — 017859c

#### Manual

- [x] 3.4 Empty guide shows/hides with active count; CTA focuses add input — 017859c

### Phase 4: Coach Subcopy in Check-In + Suggestion (Auth Path)

#### Automated

- [x] 4.1 `pnpm check` passes — 88b6d72
- [x] 4.2 `pnpm typecheck` passes — 88b6d72
- [x] 4.3 `pnpm test` passes — 88b6d72

#### Manual

- [x] 4.4 Coaches show once on auth wedge; guest has no coaches — 88b6d72

### Phase 5: E2E Tests (First-Run, Empty Guide, Coach Subcopy)

#### Automated

- [x] 5.1 `pnpm check` passes
- [x] 5.2 `pnpm typecheck` passes
- [x] 5.3 `pnpm test` passes
- [x] 5.4 `set CI=true && pnpm test:e2e e2e/first-run-onboarding.spec.ts` passes
- [x] 5.5 `set CI=true && pnpm test:e2e e2e/guest-first-run.spec.ts` passes
- [x] 5.6 `set CI=true && pnpm test:e2e e2e/task-suggestion.spec.ts` passes

#### Manual

- [x] 5.7 Two-cycle manual smoke: coaches once each; empty guide recurs at zero tasks
