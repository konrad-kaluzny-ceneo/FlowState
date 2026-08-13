# Cross-day stale session fix Implementation Plan

## Overview

Fix the false-break bug when a user returns on a new local day with a stale prior-day session still marked active. Close the prior session server-side on hydrate (with client-supplied `localDateKey`), interrupt orphan cycles, record `ENDED_BY_CROSS_DAY`, and show the calm closure overlay before idle day-open. Full guest parity.

## Current State Analysis

**Bug sequence:** `recoverActiveCycle` → `cycles.getActive()` → stale `SHORT_BREAK`/`LONG_BREAK` in `RUNNING` → `resumeFromActiveCycle` enters break overtime → home state `"break"`.

**Existing assets:**
- 4h inactivity timeout in `src/server/api/lib/active-session.ts` — closes session + interrupts cycles, but only called from `getOrCreateActive`, not `getActive`.
- B-06 timeout closure on idle hydrate — `maybePresentTimeoutClosure` in `use-pomodoro-cycle.ts` (~928–964, ~1078–1088).
- Lazy date rollover — `use-day-plan.ts:18–39` (`formatLocalDateKey` + `visibilitychange`).
- Local date helpers — `src/lib/time/local-date-key.ts`, `local-day-boundary.ts`.
- S-52 honest totals — elapsed time from interrupted cycles counts via existing aggregation (no schema change to cycles).

**Gap:** No cross-day detection anywhere in session/cycle load path. `cycle.getActive` (`cycle.ts:74–87`) has no input and no close logic.

### Key Discoveries:

- `resumeFromActiveCycle` (`use-pomodoro-cycle.ts:869–877`) intentionally resumes expired breaks in overtime — must not run for prior-day cycles.
- Recovery guard (`activeCycleRecoveredForMode`, ~179) runs once per auth mode — must also key on `localDateKey` for tab-across-midnight.
- Server has no user timezone — cross-day detection requires client-supplied `localDateKey` (same pattern as `cycle.complete`).
- `getLastEnded` (`session.ts:110–120`) filters `ENDED_BY_USER | ENDED_BY_TIMEOUT` only — must include `ENDED_BY_CROSS_DAY`.
- `SessionState` enum (`prisma/schema.prisma:24–28`) needs extension; guest schema (`guest/schema.ts:94`) and domain types (`data-mode/types.ts:74`) must follow.

## Desired End State

- User opens FlowState on a new local day with yesterday's break still `RUNNING` in DB → server closes session → client sees closure overlay → idle timer hub (no break atmosphere, no false break prompt).
- Session row: `state: ENDED_BY_CROSS_DAY`, `closureLine` populated via `computeSessionEndMetadata(..., "cross_day")`, cycles `INTERRUPTED`.
- Tab left open across midnight: on next `visibilitychange`, same recovery runs without requiring reload.
- Guest snapshot behaves identically.

**Verify:** Vitest server + hook tests green; manual auth check with `E2E_TEST_EMAIL`/`E2E_TEST_PASSWORD` from `.env` — simulate prior-day break in DB or via dev seed, open next day.

## What We're NOT Doing

- Day-open steering / habit-return (S-59)
- Midnight background scheduler or service worker
- New Playwright e2e overnight scenario (L-06 — hook/integration layer)
- F-07 conductor changes
- Auto-starting a new session or cycle after close
- Backfill / recompute of historical sessions

## Implementation Approach

Extract a shared `closeActiveSession` helper from the timeout path in `active-session.ts`, parameterized by end reason (`timeout` | `cross_day`). Add `isCrossDayStaleSession(session, localDateKey)` comparing `formatLocalDateKey(session.lastActivityAt)` to the supplied key. Wire into `findOrCreateActiveSession` and `cycle.getActive` (new required `localDateKey` input). Extend client repository interface and timer hub to pass `localDateKey`, broaden recovery guard to `{ mode, localDateKey }`, and extend closure presentation to `ENDED_BY_CROSS_DAY`. Mirror close logic in guest repositories.

## Critical Implementation Details

- **Recovery guard:** Replace mode-only guard with `{ mode, localDateKey }`. On date-key change via `visibilitychange`, reset cycle UI state (stop worker, clear active cycle) before re-calling `recoverActiveCycle` — otherwise stale break UI persists until reload.
- **Ordering:** Server close must complete before `resumeFromActiveCycle` is invoked. With server-side guard on `getActive`, a stale session returns `null` and the existing idle → `getLastEnded` → closure path applies.
- **Prefetch:** Update `focus/page.tsx` SSR prefetch to pass `localDateKey`; client hydrate remains authoritative.

## Phase 1: Server cross-day close

### Overview

Add `ENDED_BY_CROSS_DAY` session state, shared close helper, and cross-day guard on session load endpoints.

### Changes Required:

#### 1. Prisma schema + migration

**File**: `prisma/schema.prisma`

**Intent**: Add `ENDED_BY_CROSS_DAY` to `SessionState` enum so cross-day closes are distinguishable from inactivity timeout.

**Contract**: `enum SessionState { ACTIVE ENDED_BY_USER ENDED_BY_TIMEOUT ENDED_BY_CROSS_DAY }` — run `pnpm prisma migrate dev`.

#### 2. Narrative builder endedBy

**File**: `src/lib/session/narrative-builder.ts`

**Intent**: Allow `computeSessionEndMetadata` to produce closure lines for cross-day ends.

**Contract**: Extend `ClosureLineInput["endedBy"]` with `"cross_day"`. Reuse default closure copy (no special branch unless product requests distinct copy).

#### 3. Shared session close helper

**File**: `src/server/api/lib/active-session.ts`

**Intent**: Deduplicate timeout and cross-day close into one function; add cross-day staleness check.

**Contract**:
- `isCrossDayStaleSession(session, localDateKey: string): boolean` — true when session is `ACTIVE` and `formatLocalDateKey(session.lastActivityAt) !== localDateKey`.
- `closeActiveSession(database, userId, sessionId, reason: "timeout" | "cross_day")` — interrupt `RUNNING`/`PAUSED` cycles, compute metadata, set session state to `ENDED_BY_TIMEOUT` or `ENDED_BY_CROSS_DAY`.
- Refactor existing timeout block in `findOrCreateActiveSession` to call `closeActiveSession`.
- After cross-day close in `findOrCreateActiveSession`, create fresh session (same as timeout path).

#### 4. cycle.getActive guard

**File**: `src/server/api/routers/cycle.ts`

**Intent**: Close cross-day stale session before returning active cycle — this is the app-open hydrate entry point.

**Contract**: Change `getActive` from parameterless query to input `{ localDateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }`. Before `findFirst`, load active session; if cross-day stale, call `closeActiveSession(..., "cross_day")` and return `null`.

#### 5. session.getLastEnded filter

**File**: `src/server/api/routers/session.ts`

**Intent**: Allow hydrate path to find cross-day-closed sessions for closure overlay.

**Contract**: Extend `state: { in: [...] }` to include `"ENDED_BY_CROSS_DAY"`.

#### 6. Domain type unions

**Files**: `src/lib/data-mode/types.ts`, `src/lib/guest/schema.ts`, test mock type aliases (`suggestion.test.ts`, etc.)

**Intent**: Keep TypeScript aligned with Prisma enum.

**Contract**: Add `ENDED_BY_CROSS_DAY` to all `SessionState` unions and Zod enums.

#### 7. return-handoff eligibility

**File**: `src/lib/session/return-handoff.ts`

**Intent**: Cross-day ended sessions should still qualify for day-memory handoff where appropriate.

**Contract**: Include `ENDED_BY_CROSS_DAY` alongside `ENDED_BY_USER` / `ENDED_BY_TIMEOUT` in ended-session filters.

### Success Criteria:

#### Automated Verification:

- `pnpm prisma migrate dev` applies cleanly
- `pnpm typecheck` passes
- `pnpm check` passes
- `pnpm exec vitest run src/server/api/routers/session.test.ts` — add cross-day close tests for `getOrCreateActive`
- `pnpm exec vitest run src/server/api/routers/cycle.test.ts` — add `getActive` cross-day test (stale break → null, session `ENDED_BY_CROSS_DAY`, cycle `INTERRUPTED`)

#### Manual Verification:

- N/A for Phase 1 (server-only; verified end-to-end in Phase 2)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Timer hub hydrate + closure overlay

### Overview

Pass `localDateKey` through repositories, re-run recovery on date rollover, and present closure overlay for cross-day ends.

### Changes Required:

#### 1. Repository interface + server wrapper

**Files**: `src/lib/data-mode/types.ts`, `src/lib/repositories/server-repositories.ts`

**Intent**: Thread `localDateKey` to `getActive`.

**Contract**: `CycleRepository.getActive(input: { localDateKey: string })`. Server wrapper calls `client.cycle.getActive.fetch({ localDateKey })`.

#### 2. recoverActiveCycle + date rollover

**File**: `src/hooks/use-pomodoro-cycle.ts`

**Intent**: Pass today's key on hydrate; re-recover when local date rolls while tab is open.

**Contract**:
- Track `hydrateLocalDateKey` ref/state initialized with `formatLocalDateKey()`.
- Replace mode-only recovery guard with `{ mode, localDateKey }` tuple.
- `cycles.getActive({ localDateKey: hydrateLocalDateKey })` in `recoverActiveCycle`.
- Extend existing `visibilitychange` effect (~1196–1219): when `formatLocalDateKey()` differs from tracked key, update key, stop worker, reset active cycle state, reset recovery guard, call `recoverActiveCycle()`.
- Run `pnpm change-impact` before editing this file.

#### 3. Closure overlay for cross-day

**File**: `src/hooks/use-pomodoro-cycle.ts`

**Intent**: Show B-06-style closure when prior session ended by cross-day.

**Contract**:
- Generalize `maybePresentTimeoutClosure` → `maybePresentEndedSessionClosure` (or extend existing) to accept `ENDED_BY_CROSS_DAY` in addition to `ENDED_BY_TIMEOUT`.
- In idle hydrate branch (~1078–1088), trigger closure for `ENDED_BY_CROSS_DAY` same as timeout.
- Guest branch: find `ENDED_BY_CROSS_DAY` in snapshot sessions.

#### 4. SSR prefetch

**File**: `src/app/focus/page.tsx`

**Intent**: Keep prefetch aligned with new `getActive` input shape.

**Contract**: `api.cycle.getActive.prefetch({ localDateKey: formatLocalDateKey() })`.

#### 5. i18n (if needed)

**Files**: `src/i18n/messages/*.json` (only if distinct cross-day closure copy is added)

**Intent**: Default: reuse existing closure strings. Add keys only if copy review distinguishes cross-day from timeout.

**Contract**: Optional — skip unless implementing distinct copy.

### Success Criteria:

#### Automated Verification:

- `pnpm typecheck` passes
- `pnpm check` passes
- `pnpm exec vitest run src/hooks/use-pomodoro-cycle.test.tsx` — add tests:
  - Prior-day break active → hydrate returns null → closure overlay shown, state idle (not break)
  - `ENDED_BY_CROSS_DAY` triggers closure same as timeout
  - Date-key change on visibilitychange re-runs recovery (mock `document.visibilityState`)

#### Manual Verification:

- Auth: seed or manually create prior-day active break session; open app next day → closure overlay, idle hub, no break timer
- Tab open across midnight (or fake date-key change in devtools): recovery closes stale session without reload
- No flash of break UI before closure (target ≤1s per FR-014 SLA)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Guest parity + verification

### Overview

Mirror server cross-day close semantics in guest repositories and finalize regression coverage.

### Changes Required:

#### 1. Guest cross-day close

**Files**: `src/lib/repositories/guest-repositories.ts`, `src/lib/guest/schema.ts`

**Intent**: Guest mode must close stale sessions on `getActive({ localDateKey })` and `getOrCreateActive()` — guest currently has no inactivity timeout.

**Contract**:
- Extract shared pure helper `closeGuestCrossDaySession(snapshot, localDateKey)` (or inline mirror of server logic) using guest session `lastActivityAt`.
- `getOrCreateActive`: if active session cross-day stale, close + create new session.
- `getActive`: if cross-day stale, close and return `null`.
- Populate `closureLine` using guest-equivalent of `computeSessionEndMetadata` / `buildClosureLine` with `endedBy: "cross_day"`.

#### 2. Guest hydrate tests

**File**: `src/hooks/use-pomodoro-cycle-guest.test.tsx` (or extend main hook test with guest mode)

**Intent**: Prove guest false-break regression is fixed.

**Contract**: Prior-day guest break → hydrate → idle + closure, not break running state.

#### 3. Full test suite gate

**Intent**: Confirm no regressions in related routers.

**Contract**: Run targeted then full unit suite.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/lib/repositories/guest-repositories.test.ts` — cross-day close cases
- `pnpm exec vitest run src/hooks/use-pomodoro-cycle-guest.test.tsx` (or guest cases in main hook test)
- `pnpm test` passes
- `pnpm check` passes

#### Manual Verification:

- Guest mode: create break cycle, advance local date (devtools or system date), reopen → closure + idle
- Confirm S-52 totals on prior day still reflect interrupted cycle elapsed time in Podsumowanie / Twój dzień

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- Server: `getActive` with prior-day session + active break → null return, session `ENDED_BY_CROSS_DAY`, cycle `INTERRUPTED`, `closureLine` set
- Server: same-day active break → returned unchanged
- Server: `getOrCreateActive` cross-day stale → new session created
- Hook: hydrate with stale break mock → no `cycleKind` break, closure overlay set
- Hook: visibilitychange date rollover triggers re-recovery
- Guest: equivalent cross-day close on `getActive`

### Integration Tests:

- `session.getLastEnded` returns cross-day closed session for overlay fetch
- `return-handoff` includes cross-day ended sessions in handoff eligibility

### Manual Testing Steps:

1. Auth: complete a work cycle, start break, leave app overnight (or backdate `lastActivityAt` in DB)
2. Open FlowState next day — expect closure overlay, then idle kickoff-ready state
3. Repeat with tab left open across midnight — visibility return triggers same behavior
4. Guest: same flow in localStorage mode
5. Verify prior-day totals in recap unchanged / honest per S-52

## Performance Considerations

- One extra session lookup on `getActive` — negligible vs existing query.
- Cross-day close is a single transaction (cycles interrupt + session update) — same cost as timeout path.
- No additional polling; lazy close on hydrate/visibility only.

## Migration Notes

- Prisma enum addition is additive — existing rows unaffected.
- No backfill of historical sessions.
- Forward-only: only sessions active at time of ship get cross-day close behavior.

## References

- Roadmap: `context/foundation/roadmap-references/items/S-53.md`
- PRD: `context/foundation/prd-v4.md` (US-18, FR-014)
- Prior art: `context/archive/2026-06-18-fix-timeout-closure-on-load/` (B-06 closure on hydrate)
- Timeout path: `src/server/api/lib/active-session.ts:26-57`
- Break overtime resume: `src/hooks/use-pomodoro-cycle.ts:869-877`
- Date rollover pattern: `src/hooks/use-day-plan.ts:18-39`
- Lessons: test wedge dismiss oracles; no e2e for state-machine logic (L-06)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Server cross-day close

#### Automated

- [x] 1.1 `pnpm prisma migrate dev` applies cleanly
- [x] 1.2 `pnpm typecheck` passes
- [x] 1.3 `pnpm check` passes
- [x] 1.4 `pnpm exec vitest run src/server/api/routers/session.test.ts` — cross-day close tests pass
- [x] 1.5 `pnpm exec vitest run src/server/api/routers/cycle.test.ts` — getActive cross-day tests pass

#### Manual

- [x] 1.6 N/A — server-only phase; defer manual to Phase 2

### Phase 2: Timer hub hydrate + closure overlay

#### Automated

- [ ] 2.1 `pnpm typecheck` passes
- [ ] 2.2 `pnpm check` passes
- [ ] 2.3 `pnpm exec vitest run src/hooks/use-pomodoro-cycle.test.tsx` — cross-day hydrate + closure tests pass

#### Manual

- [ ] 2.4 Auth manual: prior-day stale break → closure overlay + idle hub, no false break
- [ ] 2.5 Tab-across-midnight: visibilitychange triggers recovery without reload
- [ ] 2.6 No false-break flash before closure (≤1s)

### Phase 3: Guest parity + verification

#### Automated

- [ ] 3.1 `pnpm exec vitest run src/lib/repositories/guest-repositories.test.ts` — guest cross-day tests pass
- [ ] 3.2 Guest hook test — prior-day break hydrate → idle + closure
- [ ] 3.3 `pnpm test` passes
- [ ] 3.4 `pnpm check` passes

#### Manual

- [ ] 3.5 Guest manual: cross-day stale session → closure + idle
- [ ] 3.6 Prior-day S-52 totals still honest after cross-day interrupt
