# Frame Brief: Persona presets UX v2

> Framing step before /10x-plan. Separates shipped S-29 behavior from the persona
> model the user actually needs for US-02 trust.

## Reported Observation

After S-29 shipped, the user sees:

1. Only **3** persona chips with long names (“Deep planning”, “Mail & admin”, “Hotfix urgent”) — wants **≥8** simple, catchy names that clearly signal task type.
2. Task rows still show **F-05 jargon** (`Ops U:Heavy I:Heavy`) instead of the persona they picked; they do not understand what U:/I: mean.
3. **Effort** is hidden on the row and buried in the Custom panel; changing estimated duration should **not** demote the task to “Custom” when the persona choice is unchanged.

## Initial Framing (preserved)

- **User's stated cause or approach**: “S-29 implementation is wrong — fix personas, badges, and effort behavior.”
- **User's proposed direction**: Expand catalog, show persona on tasks (Custom only when truly custom), make effort visible and independently adjustable on the preset path.
- **Pre-dispatch narrowing**: **All three gaps are required together** in one follow-up slice; effort override keeps **persona label + always-visible time badge**; catalog names should be **proposed by implementer for user approval** (8–10 options).

## Dimension Map

The observation could originate at any of these dimensions:

1. **Product catalog** — too few personas / weak naming (3 locked in S-29 plan vs user need for ≥8).
2. **Display layer** — `TaskBadges` renders F-05 axes (`U:`/`I:`) because no persona identity survives create.
3. **Create-form interaction** — effort lives inside Custom-only panel; any attribute edit calls `markCreateFormCustom()`.
4. **Persistence model** — `Task` stores F-05 fields only; `personaPresetId` was explicitly deferred (S-32 unknown).
5. **Scope contract** — S-29 v1 shipped “create-only F-05 shortcut”; US-02 needs **persona as user-facing identity**, not just pre-fill.

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| Catalog too small by design, not bug | `persona-presets.ts:24-52` — 3 entries; archive plan locked bundles; expand batch P-101 → S-29 with 3 presets | **STRONG** — user request is **scope expansion**, not mis-implementation |
| Badges show jargon because persona not stored | `TaskBadges` `task-list.tsx:64-74`; Prisma `Task` has no `personaPresetId`; create payload F-05 only `802-810` | **STRONG** |
| Effort hidden + custom coupling | Badges omit effort; effort input only in `showCustomPanel` block `845-892`; `onEffortMinutesChange` → `markCreateFormCustom()` `878-880` | **STRONG** |
| Inferring persona from attributes post-hoc is fragile | Multiple presets could map to same F-05 tuple; effort override breaks inference | **STRONG** — persistence needed |
| S-29 “failed” entirely | Create presets work; coach + tests shipped; PRD ≤3 taps met for v1 | **WEAK** — v1 met its plan; missed **identity + literacy** layer |

## Narrowing Signals

- User requires **all three** concerns in one delivery — not a phased pick-one.
- Effort row display: **persona label + time badge always visible** even when duration overridden.
- Catalog: agent proposes 8–10 names; user approves before implementation locks bundles.

## Cross-System Convention

- **F-05** remains scorer substrate (importance, urgency, effort, horizon, workType).
- **Persona** is the human-facing bundle + optional persisted id (S-32 trust bridge expects persona **name** in rationale).
- S-29 archive explicitly deferred `createdViaPreset` / schema column — S-32 unknown “infer vs store” now resolves toward **store**.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: S-29 v1 delivered an engineer-facing F-05 pre-fill shortcut; US-02 requires a **persona identity layer** — persisted preset choice, human-readable task chrome, a broader catalog, and effort as a visible, independently tunable field on the preset path.

S-29 was not “broken”; it shipped the wrong **abstraction level** for the user. Fixing badges alone without `personaPresetId` (or equivalent) cannot show “Mail” after reload or after effort override. Expanding to 8 personas without persistence repeats the same dead-end.

## Confidence

**HIGH** — codebase evidence is conclusive on persistence and badge paths; user narrowed all three requirements and effort display rule.

## What Changes for /10x-plan

Plan **persona-presets-v2** (or rescope S-32 prerequisite): schema + API for `personaPresetId`, expanded preset catalog (8–10, user-approved names), create UX with always-visible effort, row badges showing persona + effort (Custom → show simplified F-05 or “Custom” + details), and decouple effort-only edits from `custom` state. Update S-32 to consume stored id.

## Proposed catalog (pending user approval)

| id | Label | Intent |
| --- | --- | --- |
| focus | Focus | Deep, uninterrupted work |
| inbox | Inbox | Mail & messages |
| firefight | Firefight | Urgent fix |
| prep | Prep | Meeting / presentation prep |
| review | Review | Code or doc review |
| write | Write | Documentation / long-form |
| plan | Plan | Roadmap / planning |
| research | Research | Learning / investigation |
| admin | Admin | Ops / chores |
| quick | Quick | Small task (<15m) |

## References

- `src/lib/task/persona-presets.ts`
- `src/app/_components/task-list.tsx` — `TaskBadges`, create form
- `prisma/schema.prisma` — Task model
- `context/archive/2026-06-13-task-create-persona-presets/plan.md`
- `context/foundation/roadmap-references/items/S-32.md`
- Investigation: parallel explore sub-agent 2026-06-13
