# Wedge transition sync recovery — Plan Brief

> Full plan: `context/changes/wedge-transition-sync-recovery/plan.md`  
> Research: `context/changes/wedge-transition-sync-recovery/research.md`

## What & Why

S-34 made check-in → break optimistic, but network failures still force users to re-pick energy or only offer suggestion **fetch** retry. S-35 bundles P-GAP-107 (offline/reconnect banner) + P-GAP-108 (wedge one-tap retry with preserved intent) so US-01 trust holds when connectivity drops on wedge gates.

## Starting Point

Hook uses `retryOnce`, full rollback on `continueAfterCheckIn` failure, generic `pomodoro-error` strip, and suggestion card error+Retry (fetch only). No `navigator.onLine` listener. Kickoff accept still blocking unlike post-check-in accept.

## Desired End State

On wedge gate network failure: calm handoff explains what is saved locally; one-tap **Retry** replays pending intent without re-entering energy. Optional global offline banner when browser reports offline. Partial failures (check-in saved, suggestion fetch failed) do not roll back break timer unnecessarily.

## Key Decisions Made

| Decision | Choice | Why | Source |
|----------|--------|-----|--------|
| Persistence model | In-memory `pendingWedgeIntentRef` | Matches S-34 ephemeral refs; no refresh survival for MVP | Research |
| Outbox | Out of scope | Roadmap open question; retry-only sufficient for belt | Research |
| Conductor | No new gate | Recovery is interstitial like S-22 catch-up | F-07 archive |
| Banner scope | `home-shell` offline listener | P-GAP-107; complements gate-level retry | Research |
| Kickoff accept | Align with S-34 non-blocking | Consistency + readiness path recovery | Research |
| Testing | Hook unit + dashboard smoke | test-plan risk #11; defer belt offline e2e | test-plan |

## Phases at a Glance

| Phase | Delivers | Risk |
|-------|----------|------|
| 1. Pending intent + retry API | `retryWedgeSync`, partial failure branches | Over-rollback vs under-recovery |
| 2. Recovery UI | `WedgeSyncRecovery` handoff component | Conductor/catch-up stacking |
| 3. Offline banner | `useOnlineStatus` + calm banner | False positive online flaps |
| 4. Readiness + kickoff accept | Steering error/retry; non-blocking kickoff accept | Steering dismiss before error |
| 5. Tests | Deferred-mock + dashboard smoke | Mock complexity |

**Prerequisites:** F-07, S-34, S-22 done  
**Estimated effort:** ~2–3 sessions, 5 phases
