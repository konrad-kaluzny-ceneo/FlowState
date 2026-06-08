# Persistent Quiet Cycle Audio (S-20) Implementation Plan

## Overview

Add a persisted tri-state cycle-end audio preference (`normal` | `soft` | `muted`) for authenticated users (Prisma `UserPreference` + tRPC) and guests (`localStorage`). Extend `createAudioManager` to honor the mode at the two existing `playAlarm` call sites in `use-pomodoro-cycle`. When work ends while the tab is hidden and mode is `muted` or `soft`, run a calm title (and optional favicon) pulse until the user returns ? S-22 catch-up remains the primary visual cue; no alarm replay on tab focus.

## Current State Analysis

Cycle-end audio always plays at full volume. `createAudioManager().playAlarm()` has no mode parameter (`src/lib/audio.ts:85-121`). Both alarm invocations live in `use-pomodoro-cycle.ts` ? `handleCycleExpired` (~281) and expired mount recovery in `resumeFromActiveCycle` (~399). No Prisma preference model exists; guest patterns use `flowstate:*` localStorage keys (`duration-storage.ts`, `work-type-duration-storage.ts`, `onboarding/storage.ts`). S-22 catch-up is shipped: hidden expiry sets `catchUp`, `TabReturnCatchUp` renders with `data-testid="tab-return-catchup"`, e2e uses `runWhileHidden` (`e2e/helpers/visibility.ts`).

### Key Discoveries:

- `src/lib/audio.ts:24-131` ? single choke point for alarm playback; Web Audio full gain or HTML `<audio>` fallback
- `src/hooks/use-pomodoro-cycle.ts:271-286` ? `handleCycleExpired` plays alarm then may set catch-up when hidden
- `src/hooks/use-pomodoro-cycle.ts:497-512` ? `visibilitychange` tracks `tabWasHiddenWhileRunningRef`
- `src/app/_components/timer-panel.tsx:54-64` ? duration state; natural home for audio tri-state when idle
- `prisma/schema.prisma` ? no `UserPreference` model; auth `userId` is string on domain rows
- `src/server/api/root.ts:14-21` ? register new `preference` router here
- `e2e/background-tab-return.spec.ts` ? extend for muted + hidden work expiry regression

## Desired End State

1. **Preference persists:** Guest choice survives refresh via `flowstate:cycleEndAudio:guest`; logged-in choice persists server-side and hydrates via tRPC with optimistic `flowstate:cycleEndAudio:{userId}` cache to avoid flash-of-loud-alarm.
2. **Audio respects mode:** `normal` = current behavior; `soft` = ~0.25 gain/volume; `muted` = no-op (skip Web Audio / HTML play).
3. **Visual authority unchanged:** `CycleCompleteOverlay`, check-in, and S-22 catch-up still gate transitions (FR-014). Muted users still see catch-up on tab return.
4. **Title pulse adjunct:** On work-end expiry when tab hidden and mode is `muted` or `soft`, calm `? ` title prefix toggles ~1.5s until `visibilitychange ? visible`, `dismissCatchUp`, or new cycle start. `prefers-reduced-motion: reduce` ? title prefix only, no favicon animation. Break-end pulse deferred.
5. **Verification:** `pnpm check`, `pnpm typecheck`, `pnpm test`, `set CI=true && pnpm test:e2e` including new unit tests and muted-hidden e2e; test-plan ?6 cookbook entry for S-20.

### Acceptance Criteria (PRD / roadmap mapping)

| Criterion | Ref | Verification |
|-----------|-----|--------------|
| Audio signal at work cycle end when preference is normal/soft | FR-013 | Unit mock + manual; e2e does not assert sound |
| UI prompt remains authoritative for transition | FR-014 | Existing overlay/catch-up e2e unchanged |
| Preference toggle acknowledges within 200ms (optimistic UI) | NFR | UI updates before server round-trip |
| Muted + hidden work expiry still surfaces catch-up | S-22 + S-20 | E2e extends `background-tab-return` pattern |
| Preference survives refresh (guest + auth) | S-20 outcome | Unit localStorage + integration `preference.get` |

## What We're NOT Doing

- Continuous volume slider (tri-state only per roadmap)
- Break-end title/favicon pulse (work-end minimum per scope decision)
- Alarm replay on tab return (S-22 policy unchanged)
- Guest preference migration inside `guest.import` (optional: copy guest localStorage to server on first `preference.set` only)
- Native push notifications
- Server persistence for guest mode
- Favicon animation when `prefers-reduced-motion: reduce`
- New Prisma `User` model ? `userId` string PK on `UserPreference` only

## Implementation Approach

Eight incremental phases: schema ? API ? client preference layer ? audio manager ? hook wiring ? UI ? title pulse ? e2e + cookbook. Preference loads synchronously from localStorage on mount (guest or auth cache) before first cycle; auth server value reconciles on `preference.get` success. Both `playAlarm` sites read mode via `getCycleEndAudioMode` callback from `useCycleEndAudioPreference`. Title pulse is a small pure module + effect hooks in `use-pomodoro-cycle`, coordinated with existing catch-up dismiss paths.

## Critical Implementation Details

**Hydration race:** Dashboard must mount preference hook before user can start a cycle. Read localStorage synchronously in hook initializer; default `normal` only when no stored value. Auth: on `preference.get` success, overwrite ref + localStorage cache if server differs.

**Pulse trigger:** Call `startTabPulse()` from `handleCycleExpired` (and expired recovery path) when `cycleKind === "WORK"` && mode !== `normal` && (`document.visibilityState !== "visible"` || `tabWasHiddenWhileRunningRef`). Do not pulse on break-end. Stop on visibility visible, `dismissCatchUp`, `start()` new cycle, or hook unmount.

**S-22 coordination:** Catch-up still sets when hidden regardless of mute. `playAlarm` when `muted` is no-op ? catch-up + overlay carry FR-013 for silent users.

**Soft constant:** `CYCLE_END_AUDIO_SOFT_GAIN = 0.25` in `src/lib/audio.ts` (or shared constants module); tunable without schema change.

**Guest ? auth continuity:** Client-side only ? `useCycleEndAudioPreference` on first authenticated mount reads `readGuestModeForMerge()`; if guest key is non-`normal` and server row is missing or still default `NORMAL`, call `preference.set` once with the guest value. Do not extend `guest.import` or add server-side merge in the mutation handler.

---

## Phase 1: Schema and Migration

### Overview

Introduce `CycleEndAudioMode` enum and `UserPreference` model; generate migration via Prisma CLI only.

### Changes Required:

#### 1. Prisma enum and model

**File**: `prisma/schema.prisma`

**Intent**: Persist per-user cycle-end audio mode with `NORMAL` default preserving current behavior for existing users.

**Contract**: Add enum `CycleEndAudioMode { NORMAL SOFT MUTED }`. Add model `UserPreference` with `userId String @id @map("user_id") @db.VarChar(255)`, `cycleEndAudioMode CycleEndAudioMode @default(NORMAL) @map("cycle_end_audio_mode")`, `updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz`, `@@map("flow_state_user_preference")`.

#### 2. Migration

**File**: `prisma/migrations/<timestamp>_add_user_preference/` (generated)

**Intent**: Apply DDL to Neon via standard migrate workflow.

**Contract**: Run `pnpm prisma migrate dev --name add_user_preference` on feature branch; never hand-write SQL.

#### 3. Client regeneration

**File**: `generated/prisma` (generated output)

**Intent**: Ensure `@prisma/generated` exports new enum for routers and Zod mappers.

**Contract**: `pnpm db:generate` succeeds after migration.

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly: `pnpm prisma migrate dev`
- Prisma validates: `pnpm exec prisma validate`
- Typecheck passes: `pnpm typecheck`
- Lint passes: `pnpm check`

#### Manual Verification:

- Inspect migration SQL shows `flow_state_user_preference` table with enum column default `NORMAL`
- No existing tables altered destructively

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: tRPC Preference Router

### Overview

Expose `preference.get` and `preference.set` for authenticated users with strict `userId` isolation.

### Changes Required:

#### 1. Zod schema and mappers

**File**: `src/lib/cycle-audio-preference/types.ts` (new, shared client/server)

**Intent**: Single canonical tri-state type and Prisma ? client mapping.

**Contract**: Export `CycleEndAudioMode` client union `"normal" | "soft" | "muted"` and `toPrismaMode` / `fromPrismaMode` helpers. Default `"normal"`.

#### 2. Preference router

**File**: `src/server/api/routers/preference.ts` (new)

**Intent**: CRUD for the one preference field scoped to session user.

**Contract**:
- `get`: `protectedProcedure` ? `findUnique` by `ctx.session.userId`; return `{ cycleEndAudioMode }` with default `NORMAL` when row missing (do not auto-insert on get).
- `set`: `protectedProcedure` + input `z.object({ cycleEndAudioMode: z.enum(["normal","soft","muted"]) })` ? `upsert` by `userId`. No server-side guest-merge ? client hook calls `set` with migrated guest value on first auth load (see Critical Implementation Details).

#### 3. Router registration

**File**: `src/server/api/root.ts`

**Intent**: Wire router into app router.

**Contract**: Add `preference: preferenceRouter` to `createTRPCRouter` export.

#### 4. Integration tests

**File**: `src/server/api/routers/preference.test.ts` (new)

**Intent**: Prove isolation and upsert behavior.

**Contract**: `createCaller` tests: get returns default when missing; set persists; cross-user get returns own row only; invalid enum rejected.

### Success Criteria:

#### Automated Verification:

- Unit/integration tests pass: `pnpm exec vitest run src/server/api/routers/preference.test.ts`
- Full test suite passes: `pnpm test`
- Typecheck passes: `pnpm typecheck`
- Lint passes: `pnpm check`

#### Manual Verification:

- `preference.get` returns `normal` for new test user without DB row
- `preference.set` to `muted` survives page reload for authenticated session

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Client Preference Storage Module

### Overview

Guest localStorage helpers, auth cache keys, and `useCycleEndAudioPreference` hook wrapping tRPC for logged-in users.

### Changes Required:

#### 1. Storage helpers

**File**: `src/lib/cycle-audio-preference/storage.ts` (new)

**Intent**: SSR-safe read/write mirroring `work-type-duration-storage.ts` patterns.

**Contract**:
- Guest key: `flowstate:cycleEndAudio:guest`
- Auth cache key: `flowstate:cycleEndAudio:{userId}`
- `readCycleEndAudioMode(scope): CycleEndAudioMode` ? parse/validate, default `normal`
- `writeCycleEndAudioMode(scope, mode)` ? try/catch quota errors
- `readGuestModeForMerge(): CycleEndAudioMode | null` ? read guest key without scope for auth handoff

#### 2. Storage unit tests

**File**: `src/lib/cycle-audio-preference/storage.test.ts` (new)

**Intent**: Lock key names, corrupt JSON fallback, guest vs userId scoping.

**Contract**: Cover missing key, invalid JSON, round-trip write/read, separate guest vs user keys.

#### 3. Preference hook

**File**: `src/hooks/use-cycle-end-audio-preference.ts` (new)

**Intent**: Single React hook consumed by `TimerPanel` and `use-pomodoro-cycle`.

**Contract**:
- Accept `scope: OnboardingScope` (reuse existing guest/auth scope type)
- Initialize from `readCycleEndAudioMode(scope)` synchronously
- Guest: `setMode` writes localStorage immediately
- Auth: `setMode` optimistic local + cache write; `api.preference.set.useMutation`; on mount `api.preference.get.useQuery` reconciles server ? ref + cache; on first successful auth load with guest value pending, call set once to migrate
- Return `{ mode, setMode, isHydrated }` where `isHydrated` is true after initial local read (and query settled for auth)

#### 4. Wire scope into dashboard

**File**: `src/app/_components/pomodoro-dashboard.tsx`

**Intent**: Instantiate hook at dashboard wrapper level with explicit scope; pass `mode` / `setMode` to children.

**Contract**:
- `GuestPomodoroDashboard`: `useCycleEndAudioPreference({ mode: "guest" })`
- `AuthenticatedPomodoroDashboard`: reuse existing `workTypeDurationScope` memo (`tasks[0]?.userId` ? `{ mode: "authenticated", userId }`, else guest fallback) ? same pattern as kickoff duration chips; pass `mode` / `setMode` into `PomodoroDashboardBody`
- Plumb props to `TimerPanel`; defer `usePomodoroCycle` wiring to Phase 5

### Success Criteria:

#### Automated Verification:

- Storage tests pass: `pnpm exec vitest run src/lib/cycle-audio-preference/storage.test.ts`
- Full test suite passes: `pnpm test`
- Typecheck passes: `pnpm typecheck`
- Lint passes: `pnpm check`

#### Manual Verification:

- Guest: toggle mode, refresh, value persists
- Auth: toggle mode, refresh, value persists from server; no audible flash before hydration when previously muted

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Audio Manager Extension

### Overview

Extend `playAlarm` to accept optional mode; add Vitest coverage for muted no-op and soft gain.

### Changes Required:

#### 1. Audio manager contract

**File**: `src/lib/audio.ts`

**Intent**: Honor user preference at playback without changing unlock/preload behavior.

**Contract**:
- Change signature to `playAlarm(options?: { mode?: CycleEndAudioMode }): Promise<void>`; default `mode: "normal"`.
- `muted`: early return before Web Audio / HTML play.
- `soft`: Web Audio path inserts `GainNode` at `CYCLE_END_AUDIO_SOFT_GAIN` (0.25) between source and destination; HTML path sets `audio.volume = 0.25` before `play()`.
- `normal`: unchanged full-volume behavior.

#### 2. Audio unit tests

**File**: `src/lib/audio.test.ts`

**Intent**: Regression-proof mode branches without asserting audible output.

**Contract**: Mock Web Audio / HTML audio; assert `muted` does not call `start`/`play`; `soft` connects gain node or sets volume 0.25; `normal` unchanged from existing tests.

#### 3. Hook test mock update

**File**: `src/hooks/use-pomodoro-cycle.test.tsx`, `src/hooks/use-pomodoro-cycle-guest.test.tsx`

**Intent**: Keep mocks compatible with new `playAlarm` signature.

**Contract**: Mock accepts optional `{ mode }` argument; existing expiry tests still expect `playAlarm` called (mode passed in later phase).

### Success Criteria:

#### Automated Verification:

- Audio tests pass: `pnpm exec vitest run src/lib/audio.test.ts`
- Hook tests pass: `pnpm exec vitest run src/hooks/use-pomodoro-cycle.test.tsx`
- Full test suite passes: `pnpm test`
- Typecheck passes: `pnpm typecheck`
- Lint passes: `pnpm check`

#### Manual Verification:

- Dev server: set mode soft/muted via localStorage hack; complete 1s work cycle; observe reduced/silent playback when tab visible

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 5: Hook Integration

### Overview

Pass `cycleEndAudioMode` from preference into both `playAlarm` call sites; extend hook tests for muted path.

### Changes Required:

#### 1. Hook accepts mode ref

**File**: `src/hooks/use-pomodoro-cycle.ts`

**Intent**: Gate alarm at the two existing choke points without duplicating preference logic inside the hook.

**Contract**:
- Change signature to `usePomodoroCycle(options?: { getCycleEndAudioMode: () => CycleEndAudioMode })`; default `getCycleEndAudioMode` returns `"normal"`
- `handleCycleExpired`: `void audioRef.current.playAlarm({ mode: getCycleEndAudioMode() }).catch(() => {})`
- `resumeFromActiveCycle` expired path: same `playAlarm({ mode })` call
- Catch-up logic unchanged ? still runs when hidden regardless of mode

#### 2. Dashboard wiring

**File**: `src/app/_components/pomodoro-dashboard.tsx`

**Intent**: Connect preference hook ref to pomodoro hook.

**Contract**: Pass `getCycleEndAudioMode: () => mode` (stable via `useCallback` keyed on `mode`) from Phase 3 hook into `usePomodoroCycle`.

#### 3. Hook unit tests

**File**: `src/hooks/use-pomodoro-cycle.test.tsx`

**Intent**: Prove muted skips meaningful playback invocation with mode arg.

**Contract**: Test: when `getCycleEndAudioMode` returns `muted`, expiry still calls `playAlarm({ mode: "muted" })` (manager no-ops internally); catch-up/overlay state unchanged.

### Success Criteria:

#### Automated Verification:

- Hook tests pass: `pnpm exec vitest run src/hooks/use-pomodoro-cycle.test.tsx`
- Full test suite passes: `pnpm test`
- Typecheck passes: `pnpm typecheck`
- Lint passes: `pnpm check`

#### Manual Verification:

- Muted preference: work cycle end while tab visible ? no audible chime; overlay still appears
- Normal preference: chime still plays on visible tab expiry

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 6: UI Control

### Overview

Tri-state segmented control in `TimerPanel` when idle; immediate persist via preference hook.

### Changes Required:

#### 1. Audio preference control component

**File**: `src/app/_components/cycle-audio-preference-control.tsx` (new)

**Intent**: Accessible tri-state selector with calm copy.

**Contract**:
- Props: `{ mode, onChange, disabled?: boolean }`
- Three options: labels **Normal** / **Soft** / **Muted** (exact copy tunable; use `aria-pressed` segmented button pattern matching duration picker tone)
- Root `data-testid="cycle-audio-preference"`
- Each option `data-testid` suffix e.g. `cycle-audio-preference-muted`

#### 2. Timer panel integration

**File**: `src/app/_components/timer-panel.tsx`

**Intent**: Expose control before cycle start when idle (alongside break settings toggle).

**Contract**: Render `CycleAudioPreferenceControl` when `state !== "running" && state !== "completed"` and task focused or idle picker visible; wire `mode` / `setMode` from props added to `TimerPanelProps`.

#### 3. Dashboard props

**File**: `src/app/_components/pomodoro-dashboard.tsx`

**Intent**: Pass preference state into `TimerPanel`.

**Contract**: Plumb `mode`, `setMode` from `useCycleEndAudioPreference`.

### Success Criteria:

#### Automated Verification:

- Full test suite passes: `pnpm test`
- Typecheck passes: `pnpm typecheck`
- Lint passes: `pnpm check`

#### Manual Verification:

- Control visible when idle; hidden during running/completed states
- Toggle updates UI within 200ms; persists after refresh (guest + auth)
- Keyboard accessible: arrow keys or tab between segments

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 7: Title Pulse

### Overview

Calm document title pulse when work ends hidden and audio is muted or soft; respect reduced motion.

### Changes Required:

#### 1. Tab pulse module

**File**: `src/lib/cycle-end-tab-pulse.ts` (new)

**Intent**: Encapsulate title/favicon animation lifecycle outside React.

**Contract**:
- Export `startCycleEndTabPulse(options?: { reducedMotion?: boolean })` and `stopCycleEndTabPulse()`
- Store original `document.title`; toggle calm prefix `? ` on ~1500ms interval
- When `reducedMotion` false and favicon `<link rel="icon">` exists, optional subtle favicon swap (same icon with dot badge or alternate static asset under `public/`) ? skip favicon path entirely when `reducedMotion` true
- Idempotent start (no duplicate intervals); stop restores title and favicon

#### 2. Unit tests

**File**: `src/lib/cycle-end-tab-pulse.test.ts` (new)

**Intent**: Lock start/stop/restore behavior with jsdom.

**Contract**: Mock `document.title`, `matchMedia`; assert prefix toggles, restore on stop, no favicon mutation when `reducedMotion: true`.

#### 3. Hook lifecycle integration

**File**: `src/hooks/use-pomodoro-cycle.ts`

**Intent**: Start/stop pulse in coordination with catch-up and visibility.

**Contract**:
- After catch-up set in `handleCycleExpired` / expired recovery: if `cycleKind === "WORK"` && mode !== `normal` && hidden condition ? `startCycleEndTabPulse({ reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches })`
- Stop on `visibilitychange` visible, `dismissCatchUp`, new `start()`, hook cleanup `useEffect` return

#### 4. Dashboard dismiss wiring

**File**: `src/app/_components/pomodoro-dashboard.tsx`

**Intent**: Ensure gate actions stop pulse (may already happen via hook visibility/dismiss paths).

**Contract**: Verify `dismissCatchUp` and overlay confirm handlers trigger stop via hook ? add explicit `stopCycleEndTabPulse()` in `dismissCatchUp` export if visibility path insufficient.

### Success Criteria:

#### Automated Verification:

- Tab pulse tests pass: `pnpm exec vitest run src/lib/cycle-end-tab-pulse.test.ts`
- Full test suite passes: `pnpm test`
- Typecheck passes: `pnpm typecheck`
- Lint passes: `pnpm check`

#### Manual Verification:

- Muted + hidden work expiry: title shows pulse prefix while tab mock-hidden; restores on return
- Reduced motion OS setting: title prefix only, no favicon flicker
- Break-end hidden expiry: no title pulse

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 8: E2E Tests and Test-Plan Cookbook Update

### Overview

Browser proofs for muted hidden work expiry (catch-up regression + title pulse); document pattern in test-plan ?6.

### Changes Required:

#### 1. Auth e2e spec

**File**: `e2e/quiet-cycle-audio.spec.ts` (new)

**Intent**: Risk proof for S-20 + S-22 coordination on authenticated path.

**Contract**:
- `beforeEach`: idle cycle via `ensureIdleCycle`
- Set muted via UI `cycle-audio-preference-muted` or `page.evaluate` localStorage seed
- `startFocusedWorkCycle` + `page.clock.install` + `runWhileHidden` + `FAST_WORK_CLOCK_MS`
- Assert `tab-return-catchup` visible (S-22 regression)
- While still hidden: `page.evaluate(() => document.title)` matches `/?/` or pulse prefix pattern
- Restore visible: title restored; confirm overlay ? check-in wedge unchanged

#### 2. Guest e2e spec

**File**: `e2e/guest-quiet-cycle-audio.spec.ts` (new)

**Intent**: Guest localStorage preference + hidden expiry catch-up.

**Contract**: Mirror auth spec on guest path; seed `flowstate:cycleEndAudio:guest` = `"muted"`; call `dismissFirstRunIfVisible(page)` from `e2e/helpers/onboarding.ts` in `beforeEach` (same pattern as `guest-trial.spec.ts`).

#### 3. Test-plan cookbook entry

**File**: `context/foundation/test-plan.md` ?6.3

**Intent**: Fulfill test-plan Phase 6 cookbook growth obligation for S-20.

**Contract**: Add subsection **Quiet cycle audio (S-20, FR-013)** with location, helpers, testids (`cycle-audio-preference`, `tab-return-catchup`), reference tests, run command `set CI=true && pnpm test:e2e e2e/quiet-cycle-audio.spec.ts`, limitation note (no audible assertion ? visual/tab signals only).

#### 4. S-22 regression guard

**File**: `e2e/background-tab-return.spec.ts`, `e2e/guest-background-tab-return.spec.ts`

**Intent**: Prove S-20 changes do not break shipped S-22 catch-up for normal-audio users.

**Contract**: Re-run both specs unchanged; must remain green after hook/audio wiring.

#### 5. Optional hook test addendum

**File**: `src/hooks/use-pomodoro-cycle.test.tsx`

**Intent**: Unit-level proof that muted hidden expiry still sets catch-up.

**Contract**: Extend existing visibility/catch-up test with `getCycleEndAudioMode: () => "muted"` ? catch-up state set, `playAlarm` called with muted.

### Success Criteria:

#### Automated Verification:

- E2E passes: `set CI=true && pnpm test:e2e e2e/quiet-cycle-audio.spec.ts`
- Guest e2e passes: `set CI=true && pnpm test:e2e e2e/guest-quiet-cycle-audio.spec.ts`
- S-22 regression: `set CI=true && pnpm test:e2e e2e/background-tab-return.spec.ts e2e/guest-background-tab-return.spec.ts`
- Full unit suite passes: `pnpm test`
- Lint and typecheck pass: `pnpm check` and `pnpm typecheck`

#### Manual Verification:

- Full e2e suite green: `set CI=true && pnpm test:e2e`
- test-plan ?6.3 entry readable and matches shipped spec paths

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- `preference.test.ts` ? router default, upsert, isolation
- `storage.test.ts` ? localStorage keys and validation
- `audio.test.ts` ? muted/soft/normal branches
- `cycle-end-tab-pulse.test.ts` ? start/stop/restore/reduced motion
- `use-pomodoro-cycle.test.tsx` ? mode passed to playAlarm; catch-up with muted

### Integration Tests:

- Preference router with in-memory Prisma mock (same pattern as `check-in.test.ts`)

### E2E:

- Auth and guest muted + hidden work expiry ? catch-up + title pulse
- Existing `background-tab-return.spec.ts` must remain green (no regression)

### Manual Testing Steps:

1. Auth user: set Muted, background tab, wait for cycle end ? catch-up on return, no chime
2. Auth user: set Soft, visible tab ? quieter chime
3. Guest: set Muted via UI, refresh ? still muted
4. Sign in after guest muted ? preference migrates to account (if guest key was set)
5. `prefers-reduced-motion: reduce` ? title pulse only

## Performance Considerations

Preference read is synchronous localStorage ? negligible. tRPC get runs once on dashboard mount. Title pulse uses single `setInterval` ? clear on stop. No additional server calls per cycle.

## Migration Notes

New table only; no backfill required. Existing users implicitly `NORMAL` until first `preference.set`. Rollback: drop table via down migration if needed before production deploy.

## References

- Research: `context/changes/persistent-quiet-cycle-audio/research.md`
- S-22 plan: `context/archive/2026-06-08-background-tab-return-catchup/plan.md`
- PRD FR-013/FR-014: `context/foundation/prd.md`
- Test-plan: `context/foundation/test-plan.md` ?6.3 (updated Phase 8)
- Audio manager: `src/lib/audio.ts:24-131`
- Hook alarm sites: `src/hooks/use-pomodoro-cycle.ts:281`, `:399`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` ? <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Schema and Migration

#### Automated

- [x] 1.1 Migration applies cleanly: `pnpm prisma migrate dev` ? 7818efb
- [x] 1.2 Prisma validates: `pnpm exec prisma validate` ? 7818efb
- [x] 1.3 Typecheck passes: `pnpm typecheck` ? 7818efb
- [x] 1.4 Lint passes: `pnpm check` ? 7818efb

#### Manual

- [x] 1.5 Inspect migration SQL shows `flow_state_user_preference` table with enum column default `NORMAL` ? 7818efb
- [x] 1.6 No existing tables altered destructively ? 7818efb

### Phase 2: tRPC Preference Router

#### Automated

- [x] 2.1 Unit/integration tests pass: `pnpm exec vitest run src/server/api/routers/preference.test.ts` ? 16cb3bf
- [x] 2.2 Full test suite passes: `pnpm test` ? 16cb3bf
- [x] 2.3 Typecheck passes: `pnpm typecheck` ? 16cb3bf
- [x] 2.4 Lint passes: `pnpm check` ? 16cb3bf

#### Manual

- [x] 2.5 `preference.get` returns `normal` for new test user without DB row
- [x] 2.6 `preference.set` to `muted` survives page reload for authenticated session

### Phase 3: Client Preference Storage Module

#### Automated

- [x] 3.1 Storage tests pass: `pnpm exec vitest run src/lib/cycle-audio-preference/storage.test.ts` ? 91d203f
- [x] 3.2 Full test suite passes: `pnpm test` ? 91d203f
- [x] 3.3 Typecheck passes: `pnpm typecheck` ? 91d203f
- [x] 3.4 Lint passes: `pnpm check` ? 91d203f

#### Manual

- [x] 3.5 Guest: toggle mode, refresh, value persists
- [x] 3.6 Auth: toggle mode, refresh, value persists from server; no audible flash before hydration when previously muted

### Phase 4: Audio Manager Extension

#### Automated

- [x] 4.1 Audio tests pass: `pnpm exec vitest run src/lib/audio.test.ts` ? 682efc6
- [x] 4.2 Hook tests pass: `pnpm exec vitest run src/hooks/use-pomodoro-cycle.test.tsx` ? 682efc6
- [x] 4.3 Full test suite passes: `pnpm test` ? 682efc6
- [x] 4.4 Typecheck passes: `pnpm typecheck` ? 682efc6
- [x] 4.5 Lint passes: `pnpm check` ? 682efc6

#### Manual

- [x] 4.6 Dev server: soft/muted via localStorage; 1s work cycle; reduced/silent playback when tab visible

### Phase 5: Hook Integration

#### Automated

- [x] 5.1 Hook tests pass: `pnpm exec vitest run src/hooks/use-pomodoro-cycle.test.tsx` ? f857cd7
- [x] 5.2 Full test suite passes: `pnpm test` ? f857cd7
- [x] 5.3 Typecheck passes: `pnpm typecheck` ? f857cd7
- [x] 5.4 Lint passes: `pnpm check` ? f857cd7

#### Manual

- [x] 5.5 Muted preference: visible tab expiry ? no chime; overlay still appears
- [x] 5.6 Normal preference: chime still plays on visible tab expiry

### Phase 6: UI Control

#### Automated

- [x] 6.1 Full test suite passes: `pnpm test` ? b7796d2
- [x] 6.2 Typecheck passes: `pnpm typecheck` ? b7796d2
- [x] 6.3 Lint passes: `pnpm check` ? b7796d2

#### Manual

- [x] 6.4 Control visible when idle; hidden during running/completed
- [x] 6.5 Toggle updates UI within 200ms; persists after refresh (guest + auth)
- [x] 6.6 Keyboard accessible between segments

### Phase 7: Title Pulse

#### Automated

- [x] 7.1 Tab pulse tests pass: `pnpm exec vitest run src/lib/cycle-end-tab-pulse.test.ts` ? 51e4ecf
- [x] 7.2 Full test suite passes: `pnpm test` ? 51e4ecf
- [x] 7.3 Typecheck passes: `pnpm typecheck` ? 51e4ecf
- [x] 7.4 Lint passes: `pnpm check` ? 51e4ecf

#### Manual

- [x] 7.5 Muted + hidden work expiry: title pulse while hidden; restores on return
- [x] 7.6 Reduced motion: title prefix only, no favicon flicker
- [x] 7.7 Break-end hidden expiry: no title pulse

### Phase 8: E2E Tests and Test-Plan Cookbook Update

#### Automated

- [x] 8.1 E2E passes: `set CI=true && pnpm test:e2e e2e/quiet-cycle-audio.spec.ts` ? 576c1ef
- [x] 8.2 Guest e2e passes: `set CI=true && pnpm test:e2e e2e/guest-quiet-cycle-audio.spec.ts` ? 576c1ef
- [x] 8.3 S-22 regression: `set CI=true && pnpm test:e2e e2e/background-tab-return.spec.ts e2e/guest-background-tab-return.spec.ts` ? 576c1ef
- [x] 8.4 Full unit suite passes: `pnpm test` ? 576c1ef
- [x] 8.5 Lint and typecheck pass: `pnpm check` and `pnpm typecheck` ? 576c1ef

#### Manual

- [x] 8.6 Full e2e suite green: `set CI=true && pnpm test:e2e`
- [x] 8.7 test-plan ?6.3 entry readable and matches shipped spec paths
