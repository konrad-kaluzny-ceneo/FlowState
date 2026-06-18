# Plan brief: create-wedge-trust-bridge

## Executive summary

S-36 persisted `personaPresetId` on tasks; US-02 requires the **first** kickoff or post-check-in suggestion to cite that persona in the rationale one-liner. This slice adds a pure read-model layer in the suggestion router — one persona clause prepended to the existing scoring rationale when the winning task has a catalog preset id and has never been the `suggestedTaskId` before. Scorer ranking and S-23 expander unchanged.

## Phases outline

1. **Persona trust clause helper** — `buildPersonaTrustClause`, `composeSuggestionRationale`, first-suggestion oracle; Vitest unit tests.
2. **Suggestion router wiring** — both `post_check_in` and `kickoff` branches; breakdown headline uses composed rationale; router integration tests.
3. **Ship prep** — update S-32 roadmap unknowns; `pnpm check` + full test suite.

## Key decisions (locked)

| Topic | Decision |
| --- | --- |
| Contexts | Kickoff **and** post-check-in |
| First suggestion | No prior `SuggestionDecision` with `suggestedTaskId = winner.id` for user |
| Skip clause | `null`, `"custom"`, unknown catalog id |
| Composition | Prepend: `"{Label} — {hint}."` + space + scoring rationale |
| Scorer | No changes to `pickBestTask` / factor weights |
| UI | No `TaskSuggestionCard` changes — server sends composed `rationale` |
| Breakdown | `breakdown.headline` = final composed rationale (existing contract) |

## Risks

| Risk | Mitigation |
| --- | --- |
| Double persona on repeat suggestions | First-suggestion oracle via `SuggestionDecision` query |
| Artificial copy | One clause max; workType-derived hint map per preset |
| Breakdown duplicates headline | Keep `headlineKey` as scoring key; expander excludes scoring headline only |

## Out of scope

- Guest create `personaPresetId` gap fix
- Scorer / ranking changes
- S-23 expander UI changes
- Belt e2e (Vitest + existing suggestion router tests sufficient)
- Inline edit preset re-pick

## Next handoff

`/10x-plan-review create-wedge-trust-bridge` → `/10x-implement create-wedge-trust-bridge phase 1`
