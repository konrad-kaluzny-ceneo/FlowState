# Out-of-tab Break Alerts (narrow MVP) Implementation Plan

## Overview

Ship PRD change thread **break-alerts-out-of-tab**: when a break timer **starts** and the FlowState tab is not focused, reach the user via **one system notification** and **best-effort background audio**. Tests and pure module land **before** editing `use-pomodoro-cycle.ts`. No backend, no Work Mode Guard, no PWA push.

## Current State Analysis

Mom Test + shape locked a narrow MVP. Stack assessment and health-check confirm the T3 stack is sufficient; gaps are missing Notification patterns and break-start hook wiring.

### Key Discoveries

- **Break start entry point:** `startBreakAfterWorkComplete` in `src/hooks/use-pomodoro-cycle.ts:1916-1940` — sets `cycleKind` to `SHORT_BREAK`/`LONG_BREAK`, `state` to `"running"`, calls `startWorker`. This is **after** check-in / `confirmComplete`, not at work-cycle expiry (`handleCycleExpired`).
- **Work-end vs break-start:** `handleCycleExpired` (~479-503) plays `playAlarm` and sets catchUp when hidden — targets **cycle completion**, including work→check-in path. Out-of-tab alert must **not** duplicate here.
- **Visibility tracking:** `tabWasHiddenWhileRunningRef` + `visibilitychange` listener (~907-930); Vitest mocks in `use-pomodoro-cycle.test.tsx` catchUp suite (~2868+).
- **Hook scope gap:** `usePomodoroCycle` exposes `getCycleEndAudioMode` via options but has no `OnboardingScope`/`userId` — authenticated localStorage reads need a dashboard-injected getter (mirror audio pattern).
- **Hook test wrapper:** `createWrapper()` in `use-pomodoro-cycle.test.tsx` is QueryClient-only (no `OnboardingProvider`); prefer injected getters over `useOnboarding()` inside the hook.
- **Auth check-in gate:** Authenticated users complete cycle-complete + check-in on-tab before `startBreakAfterWorkComplete` runs; out-of-tab alert fires only if tab is hidden at break-create time, not at work-cycle expiry.
- **Audio:** `src/lib/audio.ts` — `playAlarm({ mode })`; `muted` skips playback; autoplay errors swallowed.
- **Preference pattern:** `src/lib/cycle-audio-preference/storage.ts` — scoped localStorage keys for guest + user.
- **Settings surface:** `timer-panel.tsx` — `break-settings-panel` for durations; `CycleAudioPreferenceControl` co-located on timer panel.
- **E2E helper unused:** `e2e/helpers/visibility.ts` — `runWhileHidden`; no active spec imports it (background-tab e2e demoted 2026-06-11 per `test-plan.md`).
- **Tests passing today:** `audio.test.ts`, `cycle-end-tab-pulse.test.ts`, catchUp hook tests (68 in full file), `tab-return-catchup.test.tsx`.

## Desired End State

1. User grants notification permission (first session explain or later via settings path).
2. User starts a work session, switches to another tab.
3. After check-in (if shown), break timer starts → **one** notification + optional background `playAlarm` (unless `muted` or out-of-tab toggle off).
4. Clicking notification focuses FlowState tab.
5. One settings control disables all out-of-tab alerts without affecting in-tab timer/catch-up.
6. Vitest covers alert module + hook integration; optional `@skip-belt` e2e documents Playwright pattern.

### Verification

- Automated: `pnpm check`, `pnpm typecheck`, targeted Vitest files, full `use-pomodoro-cycle.test.tsx`, `pnpm test:e2e:belt`
- Manual: 2-tab browser test — break starts while Slack tab focused; toggle off suppresses next break

## What We're NOT Doing

- Work Mode Guard profiles, AUTO detector, meeting buffer (PRD non-goals)
- Service worker, PWA manifest, server push, Prisma fields
- Alerts at work-cycle expiry (only break **start**)
- Multiple notifications per break or punitive metrics
- CI belt requirement for notification e2e in v1
- Auto-suppress during “firefighting” (settings disable only)

## Implementation Approach

Four phases — **test-first, hook last**:

1. Pure `break-out-of-tab-alert` lib + Vitest (zero hook changes)
2. Preference storage, settings toggle, first-session permission UI
3. Single integration call at end of `startBreakAfterWorkComplete`
4. `@skip-belt` e2e + optional `test-plan.md` §6 cookbook line

Follow co-located `*.test.ts` beside source; reuse `OnboardingScope` from `~/lib/onboarding/types` for storage scoping.

## Critical Implementation Details

**Trigger timing:** Fire only inside `startBreakAfterWorkComplete`, **synchronously immediately after** `startWorker(endTime)` (~1940) and **before** `await Promise.all(invalidate...)` — when `cycleKindRef.current` is `SHORT_BREAK` or `LONG_BREAK` and `stateRef.current === "running"`. Do **not** fire from `handleCycleExpired` (work end / check-in pending). Do **not** defer alert to the end of the async function (user may refocus during network I/O).

**Visibility guard:** Use `document.visibilityState !== "visible"` at fire time. Do not rely solely on `tabWasHiddenWhileRunningRef` (may reset when user briefly focuses tab between work end and break start).

**Preference wiring (F1):** Add `getOutOfTabBreakAlertsEnabled?: () => boolean` to `UsePomodoroCycleOptions`. Wire from `pomodoro-dashboard.tsx` via `use-out-of-tab-break-alerts-preference` (same pattern as `getCycleEndAudioMode`). Do **not** read scoped localStorage inside the hook — it lacks `userId` for authenticated keys.

**Audio vs notification:** Notification when permission `granted` and out-of-tab toggle on. Background `playAlarm` when toggle on and `CycleEndAudioMode !== "muted"`. Both respect master out-of-tab toggle (FR-004). When permission is **denied**, skip notification but still attempt background audio (best-effort; FR-001 / US-01).

**Auth reach window (F5):** Work-end alarm still fires from `handleCycleExpired` while hidden. Break-start notification fires only if tab is hidden during async `cycles.create` + `startWorker` — manual tests must hide tab **after** check-in submit, not only at work expiry.

**Overlay priority (F3):** Permission prompt runs after `shouldDeferFirstRun()` clears (merge-success / guest import), and after first-run / kickoff overlays dismiss — before or alongside cycle-intention on first start (pick: show permission prompt **after** cycle-intention closes, before timer actually starts). Never stack atop merge-success overlay.

**Idempotency:** Module must no-op if called twice for the same break cycle (guard with last-notified cycle id or timestamp) — prevents double fire from React strict mode or retry paths.

---

## Phase 1: Alert core (pure module + unit tests)

### Overview

Implement notification + guard logic in a testable module. No hook or dashboard changes.

### Changes Required

#### 1. Types and constants

**File**: `src/lib/break-out-of-tab-alert/types.ts`

**Intent**: Define break kind input, permission state, and notification payload shape.

**Contract**: Export `BreakOutOfTabAlertInput` (breakKind, isTabHidden, outOfTabEnabled, notificationPermission, cycleEndAudioMode, cycleId for dedupe).

#### 2. Preference storage

**File**: `src/lib/break-out-of-tab-alert/storage.ts`

**Intent**: Read/write out-of-tab alerts enabled flag per guest/user scope (mirror `cycle-audio-preference/storage.ts` key pattern).

**Contract**: Export `readOutOfTabBreakAlertsEnabled(scope) → boolean` (default `true`), `writeOutOfTabBreakAlertsEnabled(scope, enabled)`, `readNotificationPromptDismissed(scope) → boolean`, `writeNotificationPromptDismissed(scope)`.

#### 3. Notification helper

**File**: `src/lib/break-out-of-tab-alert/notify-break-start.ts`

**Intent**: Encapsulate `Notification.requestPermission`, `new Notification(...)`, click handler to `window.focus()`, tag/id for dedupe.

**Contract**: Export `getNotificationPermission() → NotificationPermission`, `requestNotificationPermission() → Promise<NotificationPermission>`, `showBreakStartNotification(options) → void | null` (returns null when skipped). Notification body: calm break-start copy (stand/water); no moralizing.

#### 4. Orchestrator

**File**: `src/lib/break-out-of-tab-alert/maybe-alert-break-start.ts`

**Intent**: Single entry for hook — evaluates guards, shows notification, returns whether background audio should run.

**Contract**: Export `maybeAlertBreakStart(input) → { playedNotification: boolean; shouldPlayBackgroundAudio: boolean }`. Pure except notification side effect (inject `showBreakStartNotification` in tests via parameter or mock `global.Notification`).

#### 5. Unit tests

**File**: `src/lib/break-out-of-tab-alert/maybe-alert-break-start.test.ts` (and storage/notify tests as needed)

**Intent**: Cover FR-002/004 guard matrix before hook exists.

**Contract**: Cases — tab visible → no op; tab hidden + toggle off → no op; hidden + granted → one notification; denied → no throw; muted → no background audio flag; duplicate cycleId → no second notification.

### Success Criteria

#### Automated Verification

- `pnpm check` passes
- `pnpm typecheck` passes
- `pnpm exec vitest run src/lib/break-out-of-tab-alert/**/*.test.ts` passes

#### Manual Verification

- None required (pure module)

**Implementation Note**: Phase 1 must be fully green before Phase 2 UI or Phase 3 hook.

---

## Phase 2: Preferences UI + first-session permission

### Overview

Expose master toggle and one-time permission explain without touching timer state machine.

### Changes Required

#### 1. Hook for preferences

**File**: `src/hooks/use-out-of-tab-break-alerts-preference.ts`

**Intent**: React hook mirroring `use-cycle-end-audio-preference.ts` — read/write scoped storage, expose `enabled` + `setEnabled`.

**Contract**: Accept `OnboardingScope`; sync on scope change; co-located `use-out-of-tab-break-alerts-preference.test.tsx`.

#### 2. Settings toggle component

**File**: `src/app/_components/out-of-tab-break-alerts-control.tsx`

**Intent**: Single control in break settings — “Alert me when break starts (other tab)” with `data-testid="out-of-tab-break-alerts-toggle"`.

**Contract**: Co-located smoke test (`out-of-tab-break-alerts-control.test.tsx`) — toggle calls `onChange`; link/helper text mentions easy disable. When `Notification.permission === "denied"`, show non-blocking helper explaining browser settings + “Try again” button calling `requestNotificationPermission()` (FR-001 / PRD OQ2). When `permission === "default"`, helper may link to first-session explain path.

#### 3. Wire into timer panel

**File**: `src/app/_components/timer-panel.tsx`, `src/app/_components/pomodoro-dashboard.tsx`

**Intent**: Render toggle inside `break-settings-panel` (or directly below `CycleAudioPreferenceControl`); pass scope from dashboard onboarding scope.

**Contract**: Toggle visible when break settings expanded; does not block Start Cycle.

#### 4. First-session permission overlay

**File**: `src/app/_components/break-alerts-permission-prompt.tsx` (+ test)

**Intent**: Shown once before/at first timed session start — short explain + “Enable notifications” / “Not now”; sets `notificationPromptDismissed` on either path.

**Contract**: `data-testid="break-alerts-permission-prompt"`; defer if `shouldDeferFirstRun()` true (`~/lib/onboarding/defer.ts`); do not stack atop merge-success overlay. Overlay z-index follows existing wedge/onboarding patterns (`home-shell.tsx` gates).

#### 5. Prompt trigger

**File**: `src/app/_components/pomodoro-dashboard.tsx` or `timer-panel.tsx`

**Intent**: On first `Start Cycle` when prompt not dismissed and `Notification.permission === "default"`, show prompt then proceed with start on dismiss.

**Contract**: Prompt at most once per browser profile (storage flag); “Not now” leaves settings path documented in UI copy. **Overlay sequence:** first-run / kickoff dismiss → cycle-intention (if shown) → permission prompt → start cycle. Manual verify on first authenticated start with check-in gate enabled.

#### 6. Dashboard → hook preference bridge

**File**: `src/app/_components/pomodoro-dashboard.tsx`

**Intent**: Pass `getOutOfTabBreakAlertsEnabled: () => enabled` into `usePomodoroCycle` options alongside `getCycleEndAudioMode` (Phase 3 depends on this wiring; stub getter returning `true` until Phase 3 is acceptable during Phase 2 only if hook not yet called).

**Contract**: Authenticated and guest scopes both resolve correctly via `use-out-of-tab-break-alerts-preference(scope)`.

### Success Criteria

#### Automated Verification

- `pnpm check` passes
- `pnpm exec vitest run src/hooks/use-out-of-tab-break-alerts-preference.test.tsx src/app/_components/out-of-tab-break-alerts-control.test.tsx src/app/_components/break-alerts-permission-prompt.test.tsx` passes

#### Manual Verification

- First session → prompt appears once; “Not now” does not re-show on refresh
- Toggle off → stored in localStorage (guest and auth scopes isolated)
- Denied permission → settings shows helper + “Try again”; toggle still controls out-of-tab audio path
- First authenticated start → permission prompt does not stack with first-run / cycle-intention

**Implementation Note**: Confirm overlay sequence before Phase 3 hook wiring.

---

## Phase 3: Hook integration (break start)

### Overview

Minimal timer-hub change — call orchestrator at break start when tab hidden.

### Changes Required

#### 1. Extend hook options

**File**: `src/hooks/use-pomodoro-cycle.ts`

**Intent**: Add `getOutOfTabBreakAlertsEnabled?: () => boolean` to `UsePomodoroCycleOptions`; store in ref like `getCycleEndAudioModeRef`. Default `() => true` when omitted (tests / backward compat).

**Contract**: No `useOnboarding()` inside hook — getter only.

#### 2. Hook integration

**File**: `src/hooks/use-pomodoro-cycle.ts`

**Intent**: Inside `startBreakAfterWorkComplete`, **immediately after** `startWorker(endTime)` and **before** `await Promise.all(invalidate...)`, invoke `maybeAlertBreakStart` with `document.visibilityState !== "visible"`, `getOutOfTabBreakAlertsEnabledRef.current()`, `Notification.permission`, `getCycleEndAudioModeRef.current()`, and `breakCycle.id`.

**Contract**: If `shouldPlayBackgroundAudio`, call `audioRef.current.playAlarm({ mode })` (same ref as existing alarm). Do not modify `handleCycleExpired` catchUp or tab-pulse logic. Do not await anything between `startWorker` and alert call.

#### 3. Dashboard wiring

**File**: `src/app/_components/pomodoro-dashboard.tsx`

**Intent**: Pass `getOutOfTabBreakAlertsEnabled: () => outOfTabEnabled` from `use-out-of-tab-break-alerts-preference` into `usePomodoroCycle`.

**Contract**: Toggle changes in settings reflected on next break start without page reload.

#### 4. Hook tests (extend before or with integration)

**File**: `src/hooks/use-pomodoro-cycle.test.tsx`

**Intent**: Add cases in new `describe("usePomodoroCycle break out-of-tab alerts")` — pass `getOutOfTabBreakAlertsEnabled: () => true/false`; mock `maybeAlertBreakStart` or `Notification`; hidden tab at break start → orchestrator called once; visible → not called; check-in pending path → not called until break starts; toggle false → not called.

**Contract**: Duplicate `queryTasks` mock in describe `beforeEach` if needed so `-t` filter runs isolated (health-check note). Use injected getter — no `OnboardingProvider` in `createWrapper()`.

#### 5. Regression suite

**File**: (no new files)

**Intent**: Prove FR-005/006 preservation.

**Contract**: Full `use-pomodoro-cycle.test.tsx` (68 tests), guest catchUp tests, `audio.test.ts`, `tab-return-catchup.test.tsx` remain green.

### Success Criteria

#### Automated Verification

- `pnpm check` passes
- `pnpm typecheck` passes
- `pnpm exec vitest run src/hooks/use-pomodoro-cycle.test.tsx src/hooks/use-pomodoro-cycle-guest.test.tsx src/lib/audio.test.ts src/app/_components/tab-return-catchup.test.tsx` passes
- `pnpm test` passes (full unit suite)

#### Manual Verification

- Two-tab manual test: start cycle, hide tab, complete work + check-in, break starts → notification + sound
- Auth path: hide tab **after** check-in submit, before break timer visible → notification when break starts
- Toggle off → no notification on next break
- Denied notification permission, toggle on → no notification, best-effort background audio, timer state intact
- In-tab break start (tab focused) → no system notification; existing in-tab behavior unchanged

**Implementation Note**: Pause for manual two-tab verification before Phase 4.

---

## Phase 4: E2E spec + test-plan cookbook

### Overview

Document Playwright pattern; keep belt focused on in-tab regression.

### Changes Required

#### 1. E2E spec

**File**: `e2e/break-out-of-tab-alert.spec.ts`

**Intent**: `@skip-belt` spec — `context.grantPermissions(['notifications'])` where supported, `runWhileHidden` from `e2e/helpers/visibility.ts`, fast timer helpers from `e2e/helpers/work-cycle.ts`, assert notification event, `page.evaluate` Notification mock, or DOM side effect; assert toggle suppresses.

**Contract**: Tag `@skip-belt` on file; use existing auth fixture pattern; do not fail belt on notification API absence in CI. If native grant is flaky in headless, fall back to in-page Notification stub for assert-only path.

#### 2. Test plan cookbook (optional one line)

**File**: `context/foundation/test-plan.md` §6

**Intent**: Add entry for break-out-of-tab pattern — reference test file and run command.

**Contract**: Single cookbook subsection; no change to belt list.

#### 3. AGENTS.md (optional)

**File**: `AGENTS.md`

**Intent**: Paste compensation block from `stack-assessment.md` Gap T1 when slice merges.

**Contract**: Short section “Break out-of-tab alerts” — Notification API only, break-start trigger, no service worker.

### Success Criteria

#### Automated Verification

- `pnpm exec vitest run src/lib/break-out-of-tab-alert/**/*.test.ts` passes
- `set CI=true; pnpm exec playwright test e2e/break-out-of-tab-alert.spec.ts` passes locally (explicit file — **do not** use `--grep-invert @skip-belt` on a fully tagged spec)
- `set CI=true; pnpm test:e2e:belt` passes (no belt regression)

#### Manual Verification

- Review e2e spec stability across two local runs

---

## Testing Strategy

### Unit Tests

- Guard matrix for `maybeAlertBreakStart` (visible/hidden, permission, toggle, muted, dedupe)
- Storage scoping guest vs user
- Permission prompt component smoke

### Integration Tests

- Hook describe: break start + hidden → alert path invoked
- Full hook file regression (68 tests)

### Manual Testing Steps

1. Enable notifications; start Pomodoro; switch tab; complete work cycle through check-in; confirm break notification.
2. Auth + check-in: stay on-tab for check-in, then switch tab before break timer appears; confirm break-start notification.
3. Disable toggle; repeat — no notification.
4. Set cycle audio to muted; confirm no background audio but notification still fires (if permission granted).
5. Deny notification permission (browser settings); toggle on; break start hidden → no throw, best-effort audio only.
6. Guest mode — same flows with guest storage keys.

## Performance Considerations

Negligible — one notification per break start; no polling. `Notification` API synchronous guard checks only.

## Migration Notes

No schema migration. localStorage keys additive; default enabled preserves current behavior for existing users.

## References

- PRD thread: `context/foundation/prd.md` — Change thread PRD: Break alerts outside active tab
- Shape: `context/foundation/shape-notes.md` — Change thread: Break alerts outside active tab
- Stack assessment: `context/foundation/stack-assessment.md` — Change thread assessment (gaps T1–T4)
- Health-check: `context/foundation/health-check.md` — Change thread health check
- Hook break start: `src/hooks/use-pomodoro-cycle.ts:1916-1940`
- Visibility helper: `e2e/helpers/visibility.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Alert core (pure module + unit tests)

#### Automated

- [x] 1.1 `pnpm check` passes
- [x] 1.2 `pnpm typecheck` passes
- [x] 1.3 `pnpm exec vitest run src/lib/break-out-of-tab-alert/**/*.test.ts` passes

#### Manual

- [x] 1.4 None required (pure module)

### Phase 2: Preferences UI + first-session permission

#### Automated

- [ ] 2.1 `pnpm check` passes
- [ ] 2.2 `pnpm exec vitest run src/hooks/use-out-of-tab-break-alerts-preference.test.tsx src/app/_components/out-of-tab-break-alerts-control.test.tsx src/app/_components/break-alerts-permission-prompt.test.tsx` passes

#### Manual

- [ ] 2.3 First-session prompt appears once; “Not now” does not re-show on refresh
- [ ] 2.4 Toggle off persists in localStorage (guest and auth scopes isolated)
- [ ] 2.5 Denied permission → settings helper + “Try again” visible
- [ ] 2.6 First auth start → no overlay stack with first-run / cycle-intention

### Phase 3: Hook integration (break start)

#### Automated

- [ ] 3.1 `pnpm check` passes
- [ ] 3.2 `pnpm typecheck` passes
- [ ] 3.3 `pnpm exec vitest run src/hooks/use-pomodoro-cycle.test.tsx src/hooks/use-pomodoro-cycle-guest.test.tsx src/lib/audio.test.ts src/app/_components/tab-return-catchup.test.tsx` passes
- [ ] 3.4 `pnpm test` passes

#### Manual

- [ ] 3.5 Two-tab test: break start while other tab focused → notification + sound
- [ ] 3.6 Toggle off → no notification on next break
- [ ] 3.7 In-tab break start → no system notification; in-tab behavior unchanged

### Phase 4: E2E spec + test-plan cookbook

#### Automated

- [ ] 4.1 `pnpm exec vitest run src/lib/break-out-of-tab-alert/**/*.test.ts` passes
- [ ] 4.2 Local Playwright run of `e2e/break-out-of-tab-alert.spec.ts` passes
- [ ] 4.3 `set CI=true; pnpm test:e2e:belt` passes

#### Manual

- [ ] 4.4 E2e spec stable across two local runs
