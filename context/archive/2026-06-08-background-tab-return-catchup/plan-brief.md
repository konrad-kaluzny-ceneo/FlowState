# Background Tab Return Catch-up (S-22) — Plan Brief

> Full plan: `context/changes/background-tab-return-catchup/plan.md`
> Research: `context/changes/background-tab-return-catchup/research.md`

## What & Why

When a Pomodoro cycle ends while the browser tab is in the background, users often miss the chime and land on a wedge gate (work confirm, check-in, break confirm, or suggestion) without context. S-22 adds a calm catch-up header — what finished, how long ago, and the single next action — wrapped around existing gates, not replacing them.

## Starting Point

Cycle completion is client-authoritative via `handleCycleExpired`; `visibilitychange` recalculates remaining time on tab return but does not frame missed transitions. Post-work gates (`CycleCompleteOverlay`, `CheckInOverlay`, `TaskSuggestionCard`) already render on return; there is no `endedWhileHidden` flag or catch-up UI. Duplicate completion is guarded; the roadmap risk is duplicate *overlays* if catch-up is not one-shot.

## Desired End State

Returning to a backgrounded tab after hidden expiry shows `tab-return-catchup` with task/break context and relative “ended ago” time above the existing gate. First interaction dismisses catch-up permanently for that expiry. Auth users flow through confirm → check-in unchanged; guests see work/break catch-up only. Hook unit tests cover hidden expiry; Playwright proves the auth work-cycle path.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|----------|--------|------------------|--------|
| Audio on return | Visual-only; no alarm replay | Calm UX; pairs with future S-20 mute path | Research |
| Elapsed time | Relative “ended X ago” from `cycleEndedAtMs` | Context without new server fields | Research |
| Gate wrapping | First pending gate only; header shell | Prevents duplicate overlay fatigue | Research |
| Guest scope | Work/break confirm catch-up only | FR-003b excludes check-in and scoring | Research |
| Auth scope | Full wedge through suggestion | S-05/S-06 prerequisites shipped | Research |
| Catch-up persistence | React state only; dismiss on first click | One-shot `endedWhileHidden` per roadmap risk | Research / Plan |
| Relative time impl | `Intl` or manual helper in `src/lib/catch-up/` | No `date-fns` in stack | Plan |
| E2E scope | `page.evaluate` visibility mock + clock | test-plan §6 Worker throttle limitation | Research / Plan |

## Scope

**In scope:** `CatchUpState` in `use-pomodoro-cycle`; `src/lib/catch-up/*` helpers; `TabReturnCatchUp` component; `pomodoro-dashboard` wiring; hook + component unit tests; `e2e/background-tab-return.spec.ts`.

**Out of scope:** Alarm replay; server persistence; S-20 title pulse; `awaitingCheckIn` refresh fix; Worker-path browser proof; localStorage catch-up.

## Architecture / Approach

```
handleCycleExpired (tab hidden) ──► set catchUp { endedWhileHidden, cycleEndedAtMs, gate }
         │
         ▼
pomodoro-dashboard ──► TabReturnCatchUp banner + existing gate (overlay / card)
         │
         ▼
first gate interaction ──► dismissCatchUp() ──► existing handlers unchanged
```

Pure `deriveCatchUpGate` and copy live in `src/lib/catch-up/`. The hook owns set/clear; the dashboard owns placement and dismiss wiring.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|-------|------------------|----------|
| 1. Catch-up lib (TDD) | Types, gate derivation, copy, format-ended-ago | Gate priority edge cases |
| 2. Hook state (TDD) | `catchUp` + `dismissCatchUp` on hidden expiry | Regress visibility recalc test |
| 3. TabReturnCatchUp (TDD) | Presentational banner + component tests | Visual weight vs overlay |
| 4. Dashboard wiring | Gate placement + dismiss on interaction | Duplicate overlay if dismiss missed |
| 5. E2E spec | `background-tab-return.spec.ts` + visibility helper | Playwright hidden simulation fidelity |

**Prerequisites:** S-01, S-05, S-06 shipped; feature branch `features/background-tab-return-catchup`.

**Estimated effort:** ~2 sessions across 5 phases (mostly hook + e2e).

## Open Risks & Assumptions

- Duplicate overlays if `dismissCatchUp` is not wired on every primary gate path — mitigated by dashboard wrappers and tests.
- E2E cannot prove real Worker background throttle; hook unit tests are the authority for hidden expiry logic.
- `awaitingCheckIn` lost on refresh remains a pre-existing regression; out of scope.
- S-20 must coordinate: mute ships only with S-22 catch-up or title-pulse e2e.
- iOS Safari full suspend needs manual QA on wake.

## Success Criteria (Summary)

- Hidden work expiry shows calm catch-up with task title and “ended ago” above cycle-complete overlay.
- First gate interaction clears catch-up; no re-show on later visibility events.
- `pnpm test` and `set CI=true && pnpm test:e2e` pass including new spec.
