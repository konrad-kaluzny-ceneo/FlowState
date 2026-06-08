# Research: suggestion-override-acknowledgement

## Scope

Post-check-in override acknowledgement only. Kickoff surface (S-15) out of scope.

## Current behavior

- `use-pomodoro-cycle.ts` `selectTask` during break with `pendingSuggestion.status === "ready"` and different taskId calls `recordSuggestionDecision(suggested, chosen)` — silent.
- `TaskSuggestionCard` shows accept path; override is via task list Focus buttons.
- E2E `task-suggestion.spec.ts` covers override path (highlight clears) but no acknowledgement UI.

## Integration points

| Layer | Location | Change |
|-------|----------|--------|
| Copy | new `src/lib/suggestion/override-ack-copy.ts` | Single neutral line |
| State | `use-pomodoro-cycle.ts` | `overrideAcknowledgement` + auto-dismiss timer |
| UI | `pomodoro-dashboard.tsx` | Inline ack banner with `data-testid` |
| Tests | hook unit + component + e2e extend | Assert ack visible on override, not on accept |

## Decisions

- **Surface:** Inline calm banner below suggestion card / above task list — not toast (no toast infra).
- **Duration:** 3s auto-dismiss; cleared on `clearSuggestion`.
- **Copy tone:** Neutral validation, no guilt — aligns with FR-022 autonomy.
- **Always show** on override (not gated by work-type divergence).
