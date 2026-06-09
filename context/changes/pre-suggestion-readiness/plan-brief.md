# Pre-suggestion readiness — Plan Brief

> Full plan: `context/changes/pre-suggestion-readiness/plan.md`

## What & Why

FlowState's wedge suggests the next task using declared energy, but kickoff scoring hardcodes `STEADY` and post-check-in reuses end-of-cycle check-in energy — not how ready the user feels before picking the next task. S-25 adds a skippable readiness gate (Focused / Steady / Fading) at kickoff and after break starts, feeding `suggestion.next` so rationale and ranking match the moment before the suggestion card.

## Starting Point

`CheckInOverlay` already captures energy at cycle end; `suggestion.next` accepts `kickoff` and `post_check_in` contexts without an `energy` field. Kickoff auto-fetches on idle; post-check-in fetches immediately after break starts. The scorer (`pickBestTask`) already parameterizes on `energy` — the gap is API input, hook gating, and UI.

## Desired End State

Authenticated users see a readiness overlay before kickoff and post-break suggestion cards. Declared energy (or Steady via skip) drives scoring; check-in rows remain for end-of-cycle audit and wind-down. Guests unchanged. E2e and unit tests cover deferred fetch, energy in API payload, and catch-up during readiness.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| UI component | Reuse `CheckInOverlay` with variant props | One modal pattern; distinct test IDs for readiness | Plan |
| Post-check-in scoring energy | `input.energy` from readiness gate | Check-in ≠ pre-next-task readiness | Plan |
| Skip UX | Explicit "Continue with Steady" button | Clear skippable default per roadmap | Plan |
| Kickoff fetch timing | Readiness before first `suggestion.next` | Avoid STEADY flash / double fetch | Plan |
| Persistence | Ephemeral (API param only) | No migration; kickoff has no cycle row | Plan |
| Guest scope | Authenticated only | Matches existing suggestion gates | Plan |
| Post-check-in timing | Break starts, then readiness, then fetch | Avoid back-to-back modals with check-in | Plan |
| Wind-down path | Readiness after wind-down continue | Consistent wedge path | Plan |

## Scope

**In scope:** `energy` on `suggestion.next`; `awaitingReadiness` hook state; readiness overlay variant; dashboard wiring; router/hook/e2e tests; catch-up `READINESS` gate.

**Out of scope:** DB persistence; guest readiness; removing S-05 check-in; S-23 factor refresh; auto-timeout skip; inline card energy picker.

## Architecture / Approach

Readiness blocks suggestion fetch in `usePomodoroCycle`. On submit/skip, hook calls `suggestion.next` with `energy` (default `STEADY`). Router passes `input.energy` into `buildScoringContextForSession` for both contexts; post-check-in still requires a `CheckIn` row but scores from readiness. Dashboard mounts variant overlay when `awaitingReadiness` is set and suppresses suggestion cards until fetch begins.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. API wiring | `energy` on `suggestion.next` + router tests | Post-check-in must still require check-in row |
| 2. Hook state | Deferred fetch, readiness submit/skip | B-04 flash if `isPostCheckInTransitioning` cleared too early |
| 3. Dashboard UI | Readiness overlay variant + suppression rules | Check-in test ID regression |
| 4. E2E + catch-up | Helpers, specs, tab-return gate | E2e timing with extra modal step |

**Prerequisites:** S-05, S-06, S-15 shipped; change folder `pre-suggestion-readiness` opened.

**Estimated effort:** ~2–3 focused sessions across 4 phases.

## Open Risks & Assumptions

- Two modals in one session (check-in then later readiness after break) is acceptable because they are separated by break start — not the same transition beat.
- FADING readiness after FOCUSED check-in is intentional product behavior.
- Catch-up during readiness is lower priority than kickoff/post-check-in happy paths but included in Phase 4.

## Success Criteria (Summary)

- Kickoff suggestion request includes user readiness `energy`; rationale changes with FADING vs FOCUSED on seeded tasks.
- Post-check-in suggestion uses readiness energy, not check-in row, for scoring.
- Skip ("Continue with Steady") loads suggestion without picking an energy button.
- Existing check-in overlay test IDs and guest flows unchanged.
