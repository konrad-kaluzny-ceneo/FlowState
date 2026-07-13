# Single-Surface Next-Task Suggestion (Star Only) — Plan Brief

> Full plan: `context/changes/fix-suggestion-on-break-view/plan.md`
> Frame brief: `context/changes/fix-suggestion-on-break-view/frame.md`

## What & Why

The next-task suggestion should surface **only** as the star (gwiazdka) in the
"Gotów skupić się na" view, and never as a standalone inline panel — on the break
or anywhere else. This is a deliberate product decision (not a bug): showing the
suggestion as a panel during the break was intentional, long-standing design, and
the user has decided to collapse the feature to a single surface.

## Starting Point

Today the suggestion renders as two standalone `TaskSuggestionCard` panels — one
during the running break (fed by the `post_check_in` `pendingSuggestion`) and one
at idle kickoff — plus the star in `FocusReadyState` (fed by the separate
`pendingKickoffSuggestion`). The break panel is the sole surface for the
`post_check_in` accept/override scoring writes and the `SUGGESTION_ACCEPT` catch-up
gate.

## Desired End State

A running break shows only the calm S-33 atmosphere; the idle kickoff shows the
`FocusReadyState` star. The star (and its popup) is the single suggestion surface.
No dead break-suggestion code, no wasted `post_check_in` fetch, and the scorer keeps
learning because accept + override at the star both write a `KICKOFF`
`SuggestionDecision` (which the scorer already consumes).

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Is this a bug? | No — design change | Suggestion-on-break was intentional, long-standing design (S-06) | Frame |
| Single surface | Star in "Gotów skupić się na" only | User product decision; no standalone panel anywhere | Frame |
| Which panels to remove | Both (break + kickoff) | No coverage gap — the star always covers idle | Frame / Plan |
| Break fetch + telemetry | Stop fetching `post_check_in` entirely | True single source of truth; kickoff-beat still records decisions | Plan |
| Learning signal | Record KICKOFF accept at the star | Preserve accept+override telemetry without the break beat | Plan |
| Cleanup depth | Full prune of dead machinery | No dead code / half-wired gates | Plan |
| Tests | Remove panel tests + add regression guard | Star tests already cover the kept surface | Plan |
| Docs | Update user-flow.md + add a lessons entry | Purge contradicting docs; prevent re-introduction | Plan |

## Scope

**In scope:** Remove both suggestion panels + gating; stop the `post_check_in` fetch;
full-prune the dead break-suggestion machinery and gates; record a KICKOFF accept at
the star; align tests; update `user-flow.md` + add a lesson.

**Out of scope:** The star surface itself, the kickoff pipeline, the scorer /
`SuggestionDecision` schema / server procedures, archived docs, PRD.

## Architecture / Approach

Top-down removal: strip the UI panels in `pomodoro-dashboard.tsx` and make break
atmosphere unconditional (Phase 1); stop the fetch and delete the now-dead
`pendingSuggestion` state, actions, and gates across `use-pomodoro-cycle.ts`,
`derive-gate.ts`, `transition-conductor.ts`, `home-session-state.ts` (Phase 2); close
the star accept-telemetry gap (Phase 3); align tests (Phase 4); fix docs (Phase 5).
Phases 1–2 land together to typecheck.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. UI removal | Both panels gone; break = atmosphere | Missing a gate/derived reference → typecheck break |
| 2. Hook/gate prune | Fetch stopped; dead code + gates removed | Leaving a gate half-wired on permanently-idle state |
| 3. Learning signal | Star accept records KICKOFF decision | Changing star focus behavior while adding the write |
| 4. Tests | Panel tests removed; regression guard added | E2E helper churn / flaky belt |
| 5. Docs | user-flow.md aligned; lesson added | Missing a contradicting line |

**Prerequisites:** None beyond the frame brief (HIGH confidence, scope confirmed).
**Estimated effort:** ~2–3 implement sessions across 5 phases; Phase 2 is the largest (hook prune).

## Open Risks & Assumptions

- Assumes the scorer's reliance on `lastOverrideWorkType` (overrides only, already
  recorded at the star) is the meaningful learning signal; accept telemetry is minor
  (persona-clause gate) but is captured in Phase 3 for completeness.
- Full-pruning the large `use-pomodoro-cycle.ts` hook risks touching subtle shared
  state — mitigated by keeping `overrideAcknowledgement` (shared with kickoff) and by
  the `rg` no-stale-reference gate.

## Success Criteria (Summary)

- Running break shows the calm atmosphere and never a suggestion card; the star is the
  only suggestion surface.
- Accepting or overriding at the star writes a `KICKOFF` `SuggestionDecision`; the next
  suggestion reflects overrides.
- No dead break-suggestion code or `post_check_in` fetch; tests and docs describe only
  the star surface.
