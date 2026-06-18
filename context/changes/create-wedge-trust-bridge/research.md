---
date: 2026-06-18T16:45:00+00:00
researcher: Auto (ship-slice orchestrator)
git_commit: 0247ce1aaeafebcfd769211ace8fbd8ed86e856f
branch: main
repository: FlowState
topic: "S-32 create-wedge-trust-bridge — persona clause in first suggestion rationale"
tags: [research, scoring, suggestion, persona-presets, US-02]
status: complete
last_updated: 2026-06-18
last_updated_by: Auto
---

# Research: S-32 Create→wedge trust bridge

**Date**: 2026-06-18  
**Researcher**: Auto (ship-slice orchestrator)  
**Git Commit**: `0247ce1aaeafebcfd769211ace8fbd8ed86e856f`  
**Branch**: main  
**Repository**: FlowState

## Research Question

How should S-32 add a persona-preset trust clause to the **first** task suggestion (kickoff or post-check-in) without changing scorer ranking or the S-23 rationale expander?

## Summary

- **Rationale today** is built server-side in `src/lib/scoring/` (`formatTaskRationale` / `formatKickoffRationale` → `buildRationale`) and returned by `suggestion.next` with an S-23 `breakdown` payload. The UI renders one headline line in `TaskSuggestionCard`; expander shows secondary factors only.
- **Persona is persisted** on `Task.personaPresetId` (S-36 shipped). Scorer and suggestion router **do not** read it today — only F-05 attributes feed `pickBestTask`.
- **Recommended S-32 locus:** extend the suggestion **read model** in `suggestion.ts` after winner selection — prepend one persona clause when the winning task has a catalog `personaPresetId` and this is the task's **first time** as `suggestedTaskId` in `SuggestionDecision` history (or no prior decision row for that task as suggested).
- **Skip persona clause** when `personaPresetId` is `null`, `"custom"`, or unknown catalog id.
- **Both contexts** (kickoff + post-check-in) per PRD US-02 and slice outcome.
- **Do not change** `scoreTask`, `pickBestTask`, or S-23 breakdown structure.

## Detailed Findings

### Rationale pipeline (scoring → API → UI)

```
pickBestTask (score-task.ts)
  → formatTaskRationale / formatKickoffRationale (dominant-factor.ts)
  → buildRationale (rationale.ts)
  → buildRationaleBreakdown (rationale-breakdown.ts)
  → suggestion.next (suggestion.ts)
  → use-pomodoro-cycle.ts → TaskSuggestionCard
```

| Component | Path | Role |
|-----------|------|------|
| Winner selection | `src/lib/scoring/score-task.ts:33-96` | F-05 only; no persona field on `ScoringTask` |
| Post-check-in headline | `src/lib/scoring/dominant-factor.ts:118-127` | Dominant factor → template |
| Kickoff headline | `src/lib/scoring/dominant-factor.ts:129-150` | `kickoff_fresh` / `kickoff_resume` or fallback |
| Copy templates | `src/lib/scoring/rationale.ts:18-51` | All `RationaleKey` strings |
| S-23 breakdown | `src/lib/scoring/rationale-breakdown.ts:32-72` | Excludes headline key from chips |
| Post-check-in API | `src/server/api/routers/suggestion.ts:129-214` | Energy from cycle check-in |
| Kickoff API | `src/server/api/routers/suggestion.ts:217-297` | Energy from client input |
| Card UI | `src/app/_components/task-suggestion-card.tsx:124-163` | One-liner + optional "Why this?" |

Kickoff and post-check-in share `TaskSuggestionCard` but differ in eligibility (`transition-conductor.ts:152-172`), energy source, and headline formatter. Cards are mutually exclusive in dashboard (`pomodoro-dashboard.tsx:93-104`).

### Persona preset data model (S-36 prerequisite — shipped)

| Item | Location |
|------|----------|
| DB column | `prisma/schema.prisma:75` — `personaPresetId String?` |
| Domain type | `src/lib/data-mode/types.ts:36` |
| 8-preset catalog | `src/lib/task/persona-presets.ts:44-117` |
| Label helper | `getPersonaPresetLabel()` — `persona-presets.ts:143-145` |
| Validation | `isStoredPersonaPresetId()` — `persona-presets.ts:130-135` |
| Create payload (auth) | `task-list.tsx:882-896` → `task.ts:66-83` |
| Inline edit | Does **not** clear `personaPresetId` — intentional per S-36 |

Sentinel values: `null` (legacy), `"custom"` (Custom panel), catalog ids (`focus`, `synchro`, …).

**Guest create gap:** `use-task-mutations.ts:225-234` drops `personaPresetId` on guest create. Low impact — guest wedge stack is limited (G11 in domain distillation).

### SuggestionDecision — "first suggestion" oracle

`SuggestionDecision` records suggested vs chosen task per kickoff (`sessionId`) or post-check-in (`cycleId`). Schema: `prisma/schema.prisma:146-165`.

**Proposed first-suggestion rule:** For winning task `T`, persona clause applies when **no existing row** has `suggestedTaskId = T.id` for this user. That matches "first time the wedge surfaces this task as the pick" across both contexts.

Alternative (narrower): only when `T.createdAt` is within the current session — rejected; user could create task early and get suggested later.

### Persona trust clause — recommended composition

New pure helper (e.g. `src/lib/scoring/persona-trust-clause.ts`):

- Input: `personaPresetId`, optional preset metadata
- Output: clause string or `null` when skip
- Template pattern (from S-36 plan): `"{Label} — {workType hint} fits your current energy."` — **one clause max**, prepended or appended to scoring rationale with em dash separator
- Use `getPersonaPresetLabel(id)` + preset `workType` for natural copy (e.g. Firefight → reactive framing)

**Server change in `suggestion.ts`:** After loading winner task row, include `personaPresetId`; if first-suggestion oracle passes, compose final `rationale = personaClause + " " + scoringRationale` (or em-dash join). Keep `rationaleKey` as scoring key; optionally add `personaClauseApplied: boolean` for tests only (avoid client contract churn unless needed).

Domain guidance G12: extend read model, not scorer — `context/domain/01-domain-distillation.md:226`.

## Code References

- `src/server/api/routers/suggestion.ts:166-177,249-260` — task map omits `personaPresetId`
- `src/lib/scoring/score-task.ts:15-25` — `ScoringTask` type
- `src/app/_components/task-suggestion-card.tsx:124` — rationale render site
- `src/lib/task/persona-presets.ts:143-145` — label export for S-32
- `context/foundation/roadmap-references/items/S-32.md:5-19` — slice outcome + unknowns
- `context/foundation/prd.md:76-81` — US-02 acceptance

## Architecture Insights

- **Separation of concerns:** Persona affects *trust/explanation*, not *ranking* — keeps deterministic scorer unchanged.
- **Headline vs expander:** S-23 expander must not duplicate the one-liner; persona clause is part of the one-liner, not a breakdown factor (`rationale-breakdown.ts:41-43` exclusion pattern stays).
- **Conductor mutex:** Post-check-in and kickoff paths already exclude each other; S-32 applies independently in both API branches with same helper.

## Historical Context

- `context/archive/2026-06-14-persona-presets-v2/plan-brief.md:9-18` — store beats infer; S-32 reads `personaPresetId`
- `context/archive/2026-06-14-persona-presets-v2/plan.md:408` — template example; skip `"custom"`
- `context/archive/2026-06-14-persona-presets-v2/reviews/plan-review.md:61` — `"custom"` is non-rationale
- `context/archive/2026-06-08-session-kickoff-suggestion/` — kickoff `SuggestionDecision` with nullable `cycleId` + `sessionId`

## Related Research

- `context/changes/refactor-opportunities/research.md` — structural debt (orthogonal to S-32)
- `context/archive/2026-06-07-adaptive-task-suggestion/research.md` — original wedge + `SuggestionDecision`

## Resolved Unknowns (orchestrator decisions for planning)

| Unknown (S-32.md) | Decision | Confidence |
|-------------------|----------|------------|
| Kickoff vs post-check-in | **Both** — PRD US-02 names both beats | 92% |
| `createdViaPreset` vs infer | **Use stored `personaPresetId`** — S-36 shipped | 98% |
| First suggestion semantics | **First time task is `suggestedTaskId` in user's decision history** | 85% |
| Scorer changes | **Out of scope** — read model only | 95% |

## Open Questions

- Exact copy template per preset (static map vs workType-derived) — plan phase with UX review against DESIGN.md voice.
- Whether to append vs prepend persona clause relative to scoring line — recommend **prepend** (`"Synchro — … — Steady energy favors operational work."`) for persona-first trust (US-02).
- Guest create gap — fix in S-32 or defer? **Defer** unless belt e2e needs it.
