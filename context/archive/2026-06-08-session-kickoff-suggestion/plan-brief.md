# Session Kickoff Suggestion (S-15) — Plan Brief

> Full plan: `context/changes/session-kickoff-suggestion/plan.md`
> Research: `context/changes/session-kickoff-suggestion/research.md`

## What & Why

Authenticated users idle at session start or after a break (no task pre-selected) should see the same adaptive task suggestion wedge as post-check-in — with optional work-type duration presets they explicitly tap to apply. This extends FR-021/FR-022 to the "what should I work on next?" moment before the first cycle starts, completing the kickoff override acknowledgement deferred from S-19.

## Starting Point

S-06 ships break-time post-check-in suggestions via `suggestion.next` (check-in gated), `TaskSuggestionCard`, and `SuggestionDecision` keyed on `cycleId`. S-19 override ack works on break-running overrides only. Duration memory is global (`lastDurationSec`), not per work type. Kickoff is greenfield in `src/`.

## Desired End State

Idle authenticated users with active tasks see a kickoff suggestion card at session cold start or post-break idle. Accept pre-focuses the task and reveals duration chips (45/25/15 min by work type, or "your usual" if remembered). Override shows the S-19 validating ack and records the decision. Guest mode unchanged. Mid-session focus clear never triggers kickoff.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| API shape | Extend `suggestion.next` with `context: 'kickoff' \| 'post_check_in'` | Reuses `pickBestTask` pipeline and override queries without router duplication | Research |
| Kickoff triggers | Session cold start + post-break idle only | Prevents duplicate wedge with S-06 and nag on intentional focus clear | Research |
| Scoring without check-in | Synthetic `energy: STEADY` | Neutral TYPE_FIT; avoids dual energy paths in MVP | Research |
| Duration presets | deep=45, admin=25, reactive=15 min; tap-to-apply | Matches PRD work-type cycle lengths; never auto-applied on accept | Research |
| Per-type memory | Scoped localStorage (guest + auth userId keys) | Mirrors onboarding pattern; defer server `UserPreference` | Research |
| Preset chip timing | Show after kickoff accept when work type known | User sees duration choice only after choosing task; not on every focus change | Plan |
| Override ack | Wire S-19 `showOverrideAck()` on kickoff idle override | Completes FR-022 kickoff surface deferred from S-19 PR #67 | Plan |
| Schema | Nullable `cycleId` + `sessionId` + `context` on `SuggestionDecision` | Kickoff decisions exist before WORK cycle; override signal feeds scoring | Research |
| Mid-session kickoff | Excluded | Roadmap risk: duplicate post-check-in picks | Research |
| Reset-to-PRD-defaults UI | Deferred | Low MVP signal; chips remain tap suggestions | Plan |
| Server per-type sync | Deferred (Phase 2) | localStorage sufficient for MVP; aligns with future S-20 preference work | Research |

## Scope

**In scope:**

- `suggestion.next` / `recordDecision` kickoff branches + Prisma migration
- Client eligibility gates, `pendingKickoffSuggestion` state machine
- Idle-gated `TaskSuggestionCard` + kickoff override ack
- Work-type duration chips + `workTypeDurationSec` localStorage module
- `e2e/session-kickoff.spec.ts` + test-plan §6 cookbook entry

**Out of scope:**

- Guest kickoff, dedicated kickoff router, AI scoring
- Server `UserPreference` table, cross-device sync
- Mid-session focus-clear kickoff, reset-to-defaults UI
- Kickoff energy from last check-in, PRD `proposed-FR-session-start-guidance` edit

## Architecture / Approach

```
idle transition (session-start | post-break)
  → kickoffEligible gate (auth, no focus, no cycle, flags)
  → suggestion.next { context: 'kickoff', sessionId, localHour }
  → pickBestTask(ScoringContext { energy: STEADY, ... })
  → TaskSuggestionCard (idle slot)
  → accept → preFocus + recordDecision(kickoff) + duration chips
  → override → recordDecision(kickoff) + showOverrideAck()
  → chip tap → workTypeDurationSec localStorage + staged duration for start()
```

Mutual exclusion: break-running S-06 card and idle kickoff card never render together.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. API + Schema | Kickoff `next`/`recordDecision`, migration, router tests | `SuggestionDecision` nullable `cycleId` migration + upsert compatibility |
| 2. Hook + Eligibility | `pendingKickoffSuggestion`, trigger flags, auth guard | False-positive fetch on wrong idle transitions |
| 3. Kickoff UI + Override Ack | Idle card, accept, S-19 ack on kickoff override | Double-card with S-06 if gates wrong |
| 4. Duration Presets + Memory | Chips, per-type localStorage, staged start duration | Chips read as enforced settings vs suggestions |
| 5. E2E + Cookbook | `session-kickoff.spec.ts`, test-plan entry | E2E flake on idle timing |

**Prerequisites:** S-06 shipped (`suggestion.next`, `TaskSuggestionCard`, scoring lib); S-19 ack hook (`showOverrideAck`) shipped.

**Estimated effort:** ~3–4 implementation sessions across 5 phases.

## Open Risks & Assumptions

- **CRITICAL:** `SuggestionDecision` schema extension (nullable `cycleId`, session relation) — migration must preserve post-check-in upsert; lowest-confidence area (78%).
- **CRITICAL:** Kickoff/post-check-in mutual exclusion — wrong state gates cause duplicate suggestion cards (roadmap risk).
- **CRITICAL:** IDOR on kickoff `sessionId` — must mirror `suggestion-isolation.test.ts` patterns (test-plan Risk #6).
- Assumes `sessions.getOrCreateActive` (or equivalent) yields `sessionId` before first WORK cycle at cold-start idle.
- Per-type chips are labeled suggestions; "your usual" is tap-to-apply only to avoid fighting one-off sprint lengths.

## Success Criteria (Summary)

- Authenticated user sees kickoff suggestion at session start and post-break idle with rationale
- Accept + duration chip tap stages length for next cycle without auto-apply on accept alone
- Kickoff override shows S-19 ack and records decision feeding subsequent scoring
- Mid-session focus clear and guest mode show no kickoff
- `pnpm test` + `session-kickoff.spec.ts` green; S-06 e2e regression green
