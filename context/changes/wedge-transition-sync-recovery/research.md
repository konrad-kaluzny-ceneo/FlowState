---
date: 2026-06-23T12:00:00+02:00
researcher: Auto
git_commit: 5af007e
branch: features/wedge-transition-sync-recovery
repository: FlowState
topic: "S-35 wedge transition sync recovery — network loss on wedge gates"
tags: [research, wedge, sync-recovery, US-01, S-34]
status: complete
last_updated: 2026-06-23
last_updated_by: Auto
---

# Research: Wedge transition sync recovery (S-35)

## Question

How should calm network-loss recovery work on wedge gates (check-in, suggestion, readiness) without forcing re-entry of energy, bundled with optional offline/reconnect banner (P-GAP-107 + P-GAP-108)?

## Outcome (from roadmap)

When network is lost on a wedge gate, user sees calm recovery — what is saved locally, one-tap retry, no forced re-entry of energy; optional reconnect banner for broader offline state.

## Current state

### Wedge tRPC surface (auth only)

All wedge mutations live in `use-pomodoro-cycle.ts`: `checkIn.create`, `suggestion.next` (post_check_in + kickoff), `suggestion.recordDecision`. Guest dashboard disables check-in/suggestion gates entirely.

### Error handling today

| Gate | On failure | Gap vs S-35 |
|------|------------|-------------|
| Check-in | `setError("Could not save check-in…")`; optimistic path rolls back via `rollbackOptimisticCheckInTransition` | User must re-pick energy; no one-tap retry |
| Post-check-in suggestion | `pendingSuggestion.status = "error"` + card Retry (fetch only) | Retry does not replay accept; partial chain failures roll back entire optimism |
| Kickoff readiness | Steering dismisses before fetch; failure → suggestion error card | No error/retry on steering cards; energy choice not preserved |
| `recordDecision` | Non-blocking error: choice kept locally | Acceptable; analytics row may be missing |

`retryOnce` (single immediate retry, no persistence) is the only shared primitive. No `navigator.onLine` / offline banner. No outbox.

### S-34 optimistic path (shipped)

`continueAfterCheckIn` dismisses check-in and starts break optimistically before server chain (`createCheckIn` → `complete` → `cycles.create` → `fetchPostCheckInSuggestion`). Failure triggers full rollback — even when only suggestion fetch fails after work cycle + check-in saved.

Archive: `context/archive/2026-06-19-optimistic-wedge-transitions/` — plan explicitly deferred wedge retry UI to S-35.

### F-07 conductor boundaries

`transition-conductor.ts` mutexes overlay gates (closure, wind-down, check-in, cycle-complete). Session steering (energy/focus) and suggestion cards are **outside** conductor. Recovery should be an interstitial (like S-22 `TabReturnCatchUp`), not a new conductor gate.

### S-22 (related, not duplicate)

`TabReturnCatchUp` handles missed transitions when tab was backgrounded — visibility/throttle, not network. Coordinate dismiss/retry when both catch-up and sync failure active.

## Gaps to close (S-35 scope)

1. **Pending wedge intent** — preserve energy, `pendingMarkTaskDone`, phase (`check_in | break | suggestion`) across failure.
2. **One-tap `retryWedgeSync`** — replay pending intent without re-showing energy selector.
3. **Partial failure handling** — distinguish check-in vs complete vs break-create vs suggestion failures; avoid full rollback when work + check-in already saved.
4. **Offline/reconnect banner (P-GAP-107)** — mount in `home-shell.tsx`; does not replace gate-level retry.
5. **Readiness path** — steering card error/retry when kickoff fetch fails after energy/focus selection.
6. **Align kickoff accept with S-34** — non-blocking `acceptKickoffSuggestion` + deferred `recordKickoffDecision`.

## Recommended touch points

| Layer | Files |
|-------|-------|
| Hook (primary) | `src/hooks/use-pomodoro-cycle.ts` — `pendingWedgeIntentRef`, `retryWedgeSync`, refined `continueAfterCheckIn` failure branches |
| Dashboard | `pomodoro-dashboard.tsx` — calm recovery handoff (extend or replace generic `pomodoro-error` for wedge failures) |
| Components | `check-in-overlay.tsx`, `task-suggestion-card.tsx` (pattern), `session-steering-card.tsx` |
| Shell | `home-shell.tsx` — global offline banner |
| Tests | `use-pomodoro-cycle.test.tsx`, `pomodoro-dashboard.test.tsx`; belt e2e deferred per test-plan risk #11 |

## Open decisions (implementer)

| Question | Recommendation |
|----------|----------------|
| Outbox vs retry-only? | **Retry-only with in-memory `pendingWedgeIntentRef`** for MVP — matches S-34 ephemeral refs; no refresh survival (document in plan negative space). |
| Multi-tab desync | Defer — single-tab retry sufficient for MVP; note in plan. |
| Conductor changes | None — recovery interstitial only |

## Test-plan alignment

`context/foundation/test-plan.md` risk #11: offline banner alone insufficient; retry must re-use pending check-in/suggestion intent; no forced re-entry of energy.

## Confidence

**88%** — clear gaps, prior art in S-34 archive, bounded touch points. Planning can proceed.

## References

- `context/foundation/roadmap-references/items/S-35.md`
- `context/archive/2026-06-19-optimistic-wedge-transitions/research.md`, `plan.md`
- `context/archive/2026-06-18-wedge-transition-conductor/research.md`
- `context/foundation/test-plan.md` § risk #11
