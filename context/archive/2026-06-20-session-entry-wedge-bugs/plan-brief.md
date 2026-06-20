# Session Entry Wedge Bugs — Plan Brief

> Full plan: `context/changes/session-entry-wedge-bugs/plan.md`
> Frame brief: `context/changes/session-entry-wedge-bugs/frame.md`

## What & Why

> **The actual problem to plan around is**: session-entry steering (energy + session focus) is split across the wrong beats and surfaces — focus fires too late (on Start, as a blocking popup), does not feed task suggestion, and its chips are dead due to a permission-prompt deferral deadlock; energy and focus should be one inline Card beat **before** kickoff suggestion, with implicit Skip.

Plus: false “0 cycles” closure on timeout return, and Continue context relocated from a blocking banner to the last-focused task row.

## Starting Point

- Kickoff uses `KickoffReadinessOverlay` + `TaskSuggestionCard`; focus uses `CycleIntentionPrompt` on first `start()` only.
- `suggestion.next` kickoff takes `energy` but not session intention.
- `ReturnHandoffBanner` blocks kickoff (pol-10); `pickHandoffTaskContext` picks first active task.
- Timeout sessions omit `closureLine` in DB; client rebuild shows “0 cycles”.

## Desired End State

User lands idle → inline steering Card (energy + focus) → auto-skip or explicit choice → “Suggested next task” without banner dismiss. Last-focused task row shows ring + “Continue here” with icon. No focus popup on Start. Timeout return shows accurate closure.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Continue surface | Row marker, no banner | Scored suggestion is primary; list scan shows last work | Frame |
| Last-active source | `Session.lastFocusedTaskId` | Survives interrupted break; not list order | Plan |
| Continue visibility | Always when last ended session has focus | User rejected 8h-only threshold | Plan |
| Continue row UI | Ring + “Continue here” + icon; no resume note | Short reminder which task was last | Plan |
| Focus → scoring | Chip maps to workType boost | Same pattern as energy TYPE_FIT | Plan |
| Steering Skip | ~1s auto on kickoff eligible | Implicit skip per frame contract | Plan |
| Closure fix | Server persist + client fallback | Both paths cover timeout and hydrate | Plan |
| Delivery | Single refactor | User chose no hotfix-first split | Plan |
| Banner | Removed | Option A+ — suggestion replaces Continue banner | Frame |

## Scope

**In scope:** Prisma `lastFocusedTaskId`; timeout `closureLine`; `SessionSteeringCard`; scoring intention wire; remove entry popups; Continue row; banner/pol-10 removal; e2e belt updates; `user-flow.md`.

**Out of scope:** Guest kickoff suggestion; Linear/roadmap sync; resume note on Continue row; analytics.

## Architecture / Approach

```
idle + kickoffEligible
  → SessionSteeringCard (inline)
  → (auto-skip 1s | user chips) → suggestion.next(energy, sessionIntention?)
  → TaskSuggestionCard
  → TaskList row with continueTaskId ring
```

F-07 conductor drops `kickoff_readiness` / entry `cycle_intention` gates. `returnHandoffGateOpen` removed from kickoff eligibility.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Last focus + closure | DB field, timeout persist, hydrate fix | Timeout stats query completeness |
| 2. Inline steering | Card UI, scoring wire, overlay removal | Hook state machine regression |
| 3. Continue row | List UI, banner removal | Wrong row if focus not snapshotted |
| 4. E2E + docs | Belt green, user-flow updated | Kickoff helper rewrite |

**Prerequisites:** Feature branch `features/session-entry-wedge-bugs`; `pnpm change-impact` before hook/dashboard edits.

**Estimated effort:** ~3–4 implementation sessions across 4 phases.

## Open Risks & Assumptions

- Custom free-text intention may not map to workType (plan: no boost unless chip label matches map).
- Timeout closure server-side needs cycle/check-in aggregation — verify against guest parity.
- Frame confidence MEDIUM on full-scope manual reproduction — belt e2e mitigates.

## Success Criteria (Summary)

- No blocking popups on entry; chips respond; suggestion loads without banner dismiss.
- Continue here on correct last-focused row (not first in list).
- No false “Session complete — 0 cycles” on timeout return.
