# Task Attributes for Scoring — Plan Brief

> Full plan: `context/changes/task-attributes-for-scoring/plan.md`

## What & Why

Users need to tag tasks with a work type (deep work / admin / reactive) and a weight (1–3) so the adaptive scoring engine (S-06) can later suggest the right next task based on energy and session context. Without these attributes on tasks, the scoring formula has no inputs to work with. This slice surfaces the attributes in the UI — creation, display, and editing.

## Starting Point

The Prisma schema already has `workType` (enum) and `weight` (SmallInt) on the Task model, and the tRPC router accepts both on create and update. The `TaskRepository.update` interface and both implementations (server + guest) are missing these fields. The UI has zero surface for setting or viewing them — tasks display only a title.

## Desired End State

Every task in the active list shows compact colored badges indicating its work type and weight. Users can set these at creation (via an expandable details section) and change them during inline editing. Completed tasks show the same badges dimmed. Both authenticated and guest modes support the full flow.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Creation UX | Expandable details below title input | Preserves fast creation for quick-add while making attributes discoverable without a modal. |
| Display format | Compact colored pills inline | Scannable at a glance with color-coded work types; fits the existing row layout. |
| Edit interaction | Inline edit mode expands to show selectors | Consistent with existing "click title = edit" pattern; no new interaction paradigm. |
| Completed task badges | Shown but dimmed | Provides end-of-day context about what type of work was accomplished. |

## Scope

**In scope:**
- Extend `TaskRepository.update` interface + implementations for workType/weight
- Colored badge/pill rendering on active and completed tasks
- Expandable details section on the create form
- Work type + weight selectors in inline edit mode
- Guest mode support for all of the above

**Out of scope:**
- Scoring formula or suggestion logic (S-06)
- Filtering/sorting by work type or weight
- Schema or migration changes (already done in F-01)
- tRPC router changes (already supports these fields)
- Shared component library or cn() utility

## Architecture / Approach

Pure UI + type-plumbing slice. The data layer (Prisma + tRPC) is already complete. Work flows bottom-up: fix the repository interface gap → add badge display → add creation controls → add edit controls. All changes land in 3 files (types, repositories, task-list component) plus the guest repository.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Repository & Type Plumbing | `TaskRepository.update` accepts workType/weight | Minimal — straightforward type extension |
| 2. Task Attribute Display | Colored badges on all task items | Layout overflow on narrow containers |
| 3. Create Form Details | Expandable section with type/weight selectors | Form state complexity in an already-stateful component |
| 4. Inline Attribute Editing | Edit mode includes attribute selectors | State initialization and save logic touching more fields |

**Prerequisites:** F-01 (done), F-02 (done) — schema and e2e infra already in place.
**Estimated effort:** ~1 session across 4 phases. Each phase is small and independently shippable.

## Open Risks & Assumptions

- Assumes the `max-w-lg` container has enough horizontal space for badges + Focus + Delete buttons without wrapping. If not, badges may need to move below the title on narrow viewports.
- Assumes no `cn()`/`clsx` utility is needed — if conditional class logic gets unwieldy, may want to introduce one (but likely fine for this scope).

## Success Criteria (Summary)

- A user can create a task with non-default work type and weight, see the correct badges, edit them, and confirm persistence after refresh — in both authenticated and guest modes.
- All existing tests continue to pass; no regressions in task CRUD or Pomodoro cycle flows.
