# Optimistic wedge transitions — Plan Brief

> Full plan: `context/changes/optimistic-wedge-transitions/plan.md`  
> Research: `context/changes/optimistic-wedge-transitions/research.md`

## What & Why

After energy check-in, the authenticated wedge path still awaits server mutations before dismissing overlays and starting break — violating the PRD 200ms NFR (US-01). S-34 mirrors the B-03 hook-local optimistic pattern for post-check-in break handoff and suggestion accept, with rollback on failure.

## Starting Point

B-03 optimizes Start/Interrupt; S-25 optimizes kickoff readiness overlay dismiss only. F-07 conductor enforces ≤1 gate per beat. The post-check-in chain (`submitCheckIn` → `continueAfterCheckIn` → `fetchPostCheckInSuggestion` → `acceptSuggestion`) remains fully sequential with `await mutateAsync`.

## Desired End State

Authenticated users tap energy on check-in and see the check-in gate clear and break timer start within 200ms; suggestion card loads asynchronously; accepting a suggestion pre-focuses immediately without blocking on `recordDecision`. Failed mutations roll back with visible error — no silent state drift.

## Key Decisions Made

| Decision | Choice | Why | Source |
|----------|--------|-----|--------|
| Optimism pattern | B-03 hook-local state + snapshot rollback | Wedge state lives in `use-pomodoro-cycle`, not task query cache | Research |
| v1 scope | Post-check-in path + `acceptSuggestion` only | Kickoff readiness already has L-04 dismiss tests; reduces race surface | Research / Plan |
| Wind-down branch (B-07) | Stay pessimistic when wind-down triggers | Wind-down is a gate beat — optimism would race conductor priority | Plan |
| Guest wedge | Out of scope | Guest has no check-in/suggestion gates by design | Research |
| Network recovery UI | Deferred to S-35 | S-34 ships rollback toasts; S-35 bundles retry/outbox | Roadmap |
| Testing | Deferred-mock unit oracles (§6.8) | Belt e2e not for latency; match B-03 precedent | test-plan |

## Scope

**In scope:** Optimistic `submitCheckIn` dismiss; optimistic break start after check-in; async check-in persistence with ordering for `suggestion.next`; non-blocking `acceptSuggestion`; rollback toasts; unit tests with deferred mocks.

**Out of scope:** Kickoff `suggestion.next` fetch optimism; S-35 reconnect/retry banner; guest wedge gates; mid-cycle rebind optimism; wind-down/end-session optimism; belt e2e latency assertions.

## Architecture / Approach

Extend `use-pomodoro-cycle.ts` with wedge optimistic refs mirroring B-03 (`pendingCheckInRef`, break optimistic cycle id, snapshot rollback). Dismiss check-in gate and transition to break running before `createCheckIn`/`complete`/`createBreak` settle; chain server calls in background preserving `suggestion.next` ordering (check-in must persist first). Conductor flags (`isPostCheckInTransitioning`, gate suppressors) unchanged.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|-------|------------------|----------|
| 1. Optimistic check-in → break | Overlay dismiss + break timer ≤200ms | Race with pending optimistic cycle id (B-03 lesson) |
| 2. Suggestion accept + fetch | Non-blocking accept; async suggestion load | Server requires check-in before `suggestion.next` |
| 3. Tests + prevention | Deferred-mock oracles + rollback tests | Flaky timing without fake timers |

**Prerequisites:** F-07 done, B-03 `resolveServerCycleId`, S-25 kickoff path stable  
**Estimated effort:** ~2 sessions across 3 phases

## Open Risks & Assumptions

- Wind-down branch after check-in stays synchronous — may feel slower on Fading path (acceptable; rare gate).
- Optimistic break + failed `completeCycle` must restore check-in gate or show calm error (rollback design in Phase 1).
- `fix-stale-suggestion-after-delete` is a separate correctness slice — not bundled here.

## Success Criteria (Summary)

- Check-in overlay dismisses and break starts before server mutations resolve (unit oracle).
- Suggestion accept pre-focuses without awaiting `recordDecision`.
- Failed mutations roll back visible state with error toast; existing B-04 flash suppression tests still pass.
