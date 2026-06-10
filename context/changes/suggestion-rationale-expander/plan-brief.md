# Suggestion Rationale Expander (S-23) — Plan Brief

> Full plan: `context/changes/suggestion-rationale-expander/plan.md`
> Research: `context/changes/suggestion-rationale-expander/research.md`

## What & Why

Users see a one-line suggestion rationale today but cannot inspect *why* the scorer picked this task. S-23 adds an opt-in **"Why this?"** expander on the suggestion card — top 2–3 dominant factors as calm sentences plus muted "also considered" chips — so FR-021 trust deepens without a scoring-debugger or analytics screen.

## Starting Point

S-06 and S-15 ship `TaskSuggestionCard` with a formatted `rationale` string. `getDominantRationaleKey` already ranks five session factors internally but only returns the winner. `suggestion.next` has no breakdown field; `dominant-factor.ts` has zero tests.

## Desired End State

Authenticated users on post-check-in break and kickoff/post-break idle tap **"Why this?"** and see an inline factor breakdown within 200ms. The one-liner stays the default view. Accept/override unchanged. Breakdown matches server scorer via bundled `suggestion.next` payload.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Breakdown shape | Top 2–3 dominant sentences + "also considered" chips | Avoids copy overload and scoring-debugger creep | Research / User |
| Data flow | `breakdown` on `suggestion.next` | Instant expand; no second fetch; server is source of truth | Research / User |
| Surfaces | Post-check-in break + kickoff idle (`TaskSuggestionCard`) | Same component, both auth gates already exist | Research / User |
| Guest | Pure functions guest-ready; UI auth-only MVP | No guest suggestion card today | Research / User |
| Default state | Collapsed | FR-021 one-liner remains primary | Research |
| Empty factors | Hide "Why this?" when no contributing factors | Avoid empty expander | Plan |
| S-17 / coachLine | Expander below rationale; coachLine slot untouched | Prevents narrative collision | Research |
| F-05 / Eisenhower | v1 five current factors; refresh deferred | Roadmap: factor update after F-05 | Research |

## Scope

**In scope:**

- `getFactorContributions` + `buildRationaleBreakdown` + chip label map
- `dominant-factor.test.ts` unit coverage
- `breakdown` field on both `suggestion.next` branches + router tests
- Hook types + fetch mapping
- `TaskSuggestionCard` expander UI + dashboard wiring (both surfaces)
- Component tests (L-04 toggle oracle)
- E2E expand smoke on post-check-in path
- Test-plan §6 cookbook note

**Out of scope:**

- Guest suggestion card / guest expander UI
- Full ranked list, numeric scores, modal/overlay
- S-17 narrative line
- F-05 factor set refresh
- New tRPC procedure
- Auto-expanded breakdown

## Architecture / Approach

Refactor contribution math once in `dominant-factor.ts`. After `pickBestTask` + rationale formatting in `suggestion.next`, call `buildRationaleBreakdown` with the same `ScoringContext` and attach to response. Client passes `breakdown` through hook state into `TaskSuggestionCard`, which toggles a local-state inline panel. Dominant section uses full `buildRationale` templates; chips use short noun labels.

```
suggestion.next → { rationale, breakdown } → use-pomodoro-cycle → TaskSuggestionCard
                                                      ↓
                                            "Why this?" (local toggle)
```

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Scoring breakdown export | `buildRationaleBreakdown` + unit tests | Chip dedupe / kickoff headline duality |
| 2. API + hook wire-up | `breakdown` on API + client types | S-25 rebase changes kickoff energy source |
| 3. Expander UI + component tests | Card expander both surfaces | Copy overload if layout not muted enough |
| 4. E2E smoke + cookbook | Browser expand proof + §6 note | E2E flake on suggestion timing |

**Prerequisites:** S-06, S-15 shipped (done). Branch `features/suggestion-rationale-expander`.

**Estimated effort:** ~2 sessions across 4 phases.

## Open Risks & Assumptions

- **S-25 parallel slice:** If pre-suggestion-readiness merges first, rebase and verify kickoff breakdown uses readiness energy — plan assumes API-provided context, not UI hardcoding.
- **F-05 later:** Eisenhower/importance factors require a follow-up refresh slice; v1 ships five session factors only.
- **S-12 visual polish:** Expander uses existing card tokens; S-12 may restyle later without contract change.

## Success Criteria (Summary)

- User taps "Why this?" on auth suggestion card and sees dominant factors + chips inline, collapsed by default
- Breakdown matches server scorer (bundled in `suggestion.next`)
- Accept/override flows and existing rationale one-liner unchanged
- `pnpm check`, `pnpm test`, and post-check-in e2e pass
