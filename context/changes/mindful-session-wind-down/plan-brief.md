# Mindful Session Wind-Down Nudge — Plan Brief

> Full plan: `context/changes/mindful-session-wind-down/plan.md`
> Research: `context/changes/mindful-session-wind-down/research.md`

## What & Why

After a Fading energy check-in, authenticated users should see an optional, dismissible prompt to end the session when fatigue or interruption signals corroborate low energy — with a one-line rationale and full override to keep working. This implements S-16 as a mindfulness guardrail (FR-019–FR-021) without enforcing session end.

## Starting Point

Check-in gate (S-05) and adaptive suggestion (S-06) already run back-to-back in `submitCheckIn`: energy is saved, then break starts and suggestion fetches immediately. Session context (`completedWorkCycles`, `interruptionCount`) exists but wind-down evaluation is not wired. Overlay and scoring-rationale patterns are established; no wind-down files exist yet.

## Desired End State

Authenticated user with Fading + fatigue/interruption signals sees `WindDownOverlay` after check-in, before break and suggestion. **Keep going** dismisses until the next check-in and continues the normal break → suggestion flow. **End session** completes the cycle and calls existing `endSession()`. Guest users are unaffected. E2E spec and test-plan cookbook document the pattern.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Trigger combo | `FADING && (completedWorkCycles >= 3 \|\| interruptionCount >= 2)` | Fading alone is too aggressive; aligns with scoring fatigue threshold | Research |
| Dismiss scope | Session-scoped in-memory flag; suppress until next check-in | Lightweight MVP; resets on session end | Research / Proxy |
| Gate position | After check-in persist, before `confirmComplete` + `fetchSuggestion` | One gate at a time; blocks suggestion naturally | Research / Proxy |
| Guest handling | Skip entirely | No Fading signal without check-in gate | Research / Proxy |
| End session action | `confirmComplete` then `endSession()`; no break/suggestion | Cycle in flight must save; reuse existing end flow | Research / Proxy |
| Mid-cycle check-in | Same `submitCheckIn` path triggers wind-down | Single code path; mid-cycle sets `awaitingCheckIn` identically | Plan |
| File isolation | `wind-down-nudge.ts` + `wind-down-overlay.tsx`; minimal hook/dashboard edits | Reduces S-15 parallel merge conflict | Constraint |
| Dismiss persistence | In-memory only for MVP | Refresh may re-show — acceptable deferral | Research |
| Copy tone | Invitational; no preachy stop language | FR-022 override culture; distinct from S-19 ack | Plan |

## Scope

**In scope:**

- Pure evaluation module with unit tests (TDD)
- `WindDownOverlay` component
- Hook gate in `submitCheckIn` + dashboard wiring
- E2E: trigger, keep-going, end-session, dismiss suppression, negatives
- `test-plan.md` §6.3 cookbook entry

**Out of scope:**

- Guest wind-down, server dismiss flag, new tRPC procedure
- S-12 visual polish, S-15 kickoff suggestion work
- S-21 Fading re-entry copy coordination (tone constraint only)

## Architecture / Approach

```
Cycle complete → CheckInOverlay → submitCheckIn
  → createCheckIn (persist FADING)
  → shouldShowWindDownNudge? (pure fn in wind-down-nudge.ts)
      yes → WindDownOverlay (awaitingWindDown)
        Keep going → windDownDismissed=true → confirmComplete → fetchSuggestion
        End session → confirmComplete → endSession()
      no → confirmComplete → fetchSuggestion
```

Evaluation uses hook-cached `completedWorkCycles` plus fresh `interruptionCount` from `sessions.getOrCreateActive()`. Rationale reuses `buildRationale` fatigue/interruptions keys. Dashboard adds `enableWindDownGate` (authenticated only) and blocks `showSuggestionCard` while `awaitingWindDown`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Evaluation module (TDD) | Trigger + rationale pure functions with full unit matrix | Off-by-one on cycle count at pre-complete evaluation time |
| 2. WindDownOverlay | Dismissible gate UI with test IDs | Z-index clash with check-in/first-run overlays |
| 3. Hook + dashboard | Gate in `submitCheckIn`, authenticated mount | S-15 merge conflict on shared hook/dashboard files |
| 4. E2E + cookbook | Browser proofs + test-plan §6 entry | Multi-cycle e2e flakiness / timing |

**Prerequisites:** S-05 check-in gate and S-06 suggestion shipped (met). Authenticated e2e fixtures from F-02.

**Estimated effort:** ~2–3 implementation sessions across 4 phases.

## Open Risks & Assumptions

- **S-15 parallel slice** may land overlapping edits in `use-pomodoro-cycle.ts` / `pomodoro-dashboard.tsx` — rebase and keep wind-down in dedicated files.
- Page refresh mid-break may re-show nudge (no server dismiss) — accepted MVP limitation.
- Over-eager thresholds would feel preachy — mitigated by combo rule requiring fatigue OR interruptions.
- `interruptionCount` fetch adds one tRPC call per check-in — negligible latency.

## Success Criteria (Summary)

- Fading + fatigue/interruption shows wind-down with rationale; Steady/Focused do not.
- Keep going dismisses until next check-in then continues to suggestion; End session uses existing flow.
- Guest never sees overlay; e2e spec passes in CI.
