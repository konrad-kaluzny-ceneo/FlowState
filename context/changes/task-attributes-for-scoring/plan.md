# Task Attributes for Scoring — Implementation Plan

## Overview

Add work type (deep work / admin / reactive) and weight (1–3) UI to the task list. Users can set these attributes at creation via an expandable details section, edit them inline alongside the title, and see them as compact colored badges on every task item (active and completed).

## Current State Analysis

- **Schema**: `workType` (enum DEEP_WORK | ADMIN | REACTIVE, default ADMIN) and `weight` (SmallInt 1–3, default 2) already exist on the `Task` model in `prisma/schema.prisma`.
- **tRPC router** (`src/server/api/routers/task.ts`): `task.create` and `task.update` already accept `workType` and `weight` as optional Zod-validated inputs.
- **Domain types** (`src/lib/data-mode/types.ts`): `DomainTask` has `workType?` and `weight?` fields.
- **Repository gap**: `TaskRepository.update` interface only accepts `{ id, title?, status? }` — missing `workType`/`weight`. The `UpdateTaskInput` type in `server-repositories.ts` mirrors this gap. The guest repository's `update` also only spreads `title` and `status`.
- **UI**: Zero surface for these attributes — no selectors on create, no display in list items, no edit controls.
- **Styling patterns**: Glass-morphism (`bg-white/10`, `rounded-lg`), purple accent, no shared component library, no `cn()`/`clsx` — conditional classes via template literal ternaries.

### Key Discoveries:

- `src/server/api/routers/task.ts:25-27` — tRPC create already accepts workType/weight
- `src/server/api/routers/task.ts:35-37` — tRPC update already accepts workType/weight
- `src/lib/data-mode/types.ts:50-53` — TaskRepository.update interface is the gap
- `src/lib/repositories/server-repositories.ts:17-21` — UpdateTaskInput type lacks workType/weight
- `src/lib/repositories/guest-repositories.ts:80-93` — guest update only spreads title/status
- `src/app/_components/task-list.tsx` — all UI changes land here

## Desired End State

A user can:
1. Create a task and optionally expand a "Details" section to set work type and weight before adding
2. See compact colored pills on every task showing its work type label and weight indicator
3. Click a task title to enter edit mode, which now also shows work type and weight selectors
4. See the same badges (dimmed) on completed tasks

Verification: create a task with non-default attributes, confirm pills render correctly, edit the attributes, confirm the change persists after refresh, confirm completed tasks show dimmed badges.

## What We're NOT Doing

- No new shared component library or `cn()` utility — follow existing inline Tailwind patterns
- No drag-and-drop reordering by weight
- No filtering or sorting by work type/weight
- No scoring formula or suggestion logic (that's S-06)
- No changes to the Prisma schema or migrations (columns already exist)
- No changes to the tRPC router (already accepts these fields)

## Implementation Approach

Bottom-up: fix the repository interface gap first (Phase 1), then build display (Phase 2), then creation UI (Phase 3), then editing UI (Phase 4). Each phase is independently testable and leaves the app in a working state.

### Display Defaults

Tasks created before this feature (or without expanding the details section) may have `workType` and `weight` as `undefined` on the `DomainTask` object. All rendering and edit initialization must fall back to schema defaults:

```ts
const TASK_DEFAULTS = { workType: "ADMIN" as const, weight: 2 } as const;
```

Use `task.workType ?? TASK_DEFAULTS.workType` everywhere badges render or edit state initializes.

## Phase 1: Repository & Type Plumbing

### Overview

Extend the `TaskRepository.update` interface and both implementations (server + guest) to accept `workType` and `weight`, closing the gap between the tRPC layer and the repository abstraction.

### Changes Required:

#### 1. Domain types — update interface

**File**: `src/lib/data-mode/types.ts`

**Intent**: Add `workType?` and `weight?` to the `TaskRepository.update` input type so callers can pass these fields through.

**Contract**: The `update` method input gains two optional fields: `workType?: "DEEP_WORK" | "ADMIN" | "REACTIVE"` and `weight?: number`.

#### 2. Server repository — update type

**File**: `src/lib/repositories/server-repositories.ts`

**Intent**: Add `workType` and `weight` to `UpdateTaskInput` so the server repository passes them to the tRPC client.

**Contract**: `UpdateTaskInput` gains `workType?: "DEEP_WORK" | "ADMIN" | "REACTIVE"` and `weight?: number`.

#### 3. Guest repository — update handler

**File**: `src/lib/repositories/guest-repositories.ts`

**Intent**: Spread `workType` and `weight` into the updated task object when present, so guest-mode attribute editing works.

**Contract**: The `update` method's `mutateSnapshot` callback conditionally merges `workType` and `weight` alongside the existing `title`/`status` spread.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm check`
- Existing tests pass: `pnpm test`

#### Manual Verification:

- N/A (no user-visible change yet)

---

## Phase 2: Task Attribute Display (Badges)

### Overview

Add compact colored badge/pill rendering for work type and weight on active and completed task items. Active tasks show full-opacity badges; completed tasks show dimmed badges matching the existing `text-white/50` pattern.

### Changes Required:

#### 1. Badge rendering helpers

**File**: `src/app/_components/task-list.tsx`

**Intent**: Extract a `TaskBadges` render helper (inline function or small component) that takes `workType` and `weight` and returns the badge group JSX. Also extract a `SegmentedControl` helper for the 3-button selector pattern reused in Phases 3 and 4. This keeps the main component readable as state grows.

#### 2. Badge rendering in task list items

**File**: `src/app/_components/task-list.tsx`

**Intent**: Render work type as a small colored pill (e.g., "Deep", "Admin", "Reactive") and weight as a numeric indicator (e.g., "W3") between the task title and the Focus button on active tasks. Use distinct background colors per work type for scannability.

**Contract**: Each `<li>` in the active tasks list gains a badge group element after the title/edit area. Use `task.workType ?? TASK_DEFAULTS.workType` and `task.weight ?? TASK_DEFAULTS.weight` for rendering — never show "unknown" or empty badges. Color mapping: DEEP_WORK → blue-ish (`bg-blue-500/20 text-blue-300`), ADMIN → amber-ish (`bg-amber-500/20 text-amber-300`), REACTIVE → rose-ish (`bg-rose-500/20 text-rose-300`). Weight badge uses neutral styling (`bg-white/10 text-white/70`). Badges are `text-xs rounded-full px-2 py-0.5 font-medium`.

#### 2. Dimmed badges on completed tasks

**File**: `src/app/_components/task-list.tsx`

**Intent**: Show the same badge structure on completed task items but with reduced opacity to match the existing muted styling.

**Contract**: Completed task `<li>` elements gain the same badge group with an additional `opacity-50` wrapper, consistent with the existing `text-white/50 line-through` pattern.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm check`
- Existing tests pass: `pnpm test`

#### Manual Verification:

- Active tasks display colored work type pill and weight badge
- Completed tasks display the same badges but visually dimmed
- Badges don't overflow or push buttons off-screen on the `max-w-lg` container

---

## Phase 3: Create Form with Expandable Details

### Overview

Add a collapsible "Details" section below the title input in the task creation form. When expanded, it shows work type and weight selectors. When collapsed (default), tasks are created with schema defaults (ADMIN, weight 2).

### Changes Required:

#### 1. Expandable details section in create form

**File**: `src/app/_components/task-list.tsx`

**Intent**: Add a toggle button/link below the title input row that reveals work type and weight selectors. The form state tracks `newWorkType` and `newWeight` alongside `newTitle`. On submit, pass all three to `taskRepo.create()`. Reset all fields after successful creation.

**Contract**: New state: `showDetails: boolean`, `newWorkType: "DEEP_WORK" | "ADMIN" | "REACTIVE"`, `newWeight: 1 | 2 | 3`. The details section contains: a 3-button segmented control for work type (matching badge colors), and a 3-button segmented control for weight (1/2/3). The toggle is a small text button ("+ Details" / "− Details") below the input row.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm check`
- Existing tests pass: `pnpm test`

#### Manual Verification:

- Details section is collapsed by default — creating a task without expanding uses defaults
- Expanding shows work type and weight selectors
- Creating a task with non-default attributes shows correct badges immediately after refresh
- Details section resets (collapses, defaults restored) after successful task creation

---

## Phase 4: Inline Attribute Editing

### Overview

Expand the existing edit mode (triggered by clicking the task title) to include work type and weight selectors below the title input. Saving the edit persists all changed fields.

### Changes Required:

#### 1. Edit mode expansion with attribute selectors

**File**: `src/app/_components/task-list.tsx`

**Intent**: When `editingId === task.id`, render work type and weight selectors below the title input (same segmented controls as the create form). Track `editWorkType` and `editWeight` in state, initialized from the task's current values when entering edit mode. On save, pass all changed fields to `taskRepo.update()`.

**Contract**: New state: `editWorkType: "DEEP_WORK" | "ADMIN" | "REACTIVE"`, `editWeight: 1 | 2 | 3`. The `startEditing` function initializes these from the task using `task.workType ?? TASK_DEFAULTS.workType` and `task.weight ?? TASK_DEFAULTS.weight` (handles pre-existing tasks with undefined attributes). The `saveEdit` function passes `workType` and `weight` to `taskRepo.update()` alongside `title`. The edit area becomes a vertical stack: title input on top, attribute selectors below, matching the create form's details layout.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm check`
- Existing tests pass: `pnpm test`

#### Manual Verification:

- Clicking a task title enters edit mode showing current work type and weight pre-selected
- Changing attributes and saving (Enter or blur) persists the new values
- Badges update immediately after save
- Pressing Escape cancels without saving attribute changes
- Edit mode works correctly for both authenticated and guest modes

---

## Testing Strategy

### Unit Tests:

- `TaskRepository.update` with `workType`/`weight` fields (server + guest implementations)
- Badge color mapping logic (if extracted to a helper)

### Integration Tests:

- tRPC `task.update` mutation with workType/weight (already supported by router — verify round-trip)
- Guest localStorage persistence of workType/weight on update

### Manual Testing Steps:

1. Create a task without expanding details — verify default badges (Admin, W2)
2. Create a task with "Deep work" and weight 3 — verify blue "Deep" pill and "W3" badge
3. Edit a task's work type from Admin to Reactive — verify badge changes to rose "Reactive"
4. Complete a task — verify dimmed badges appear on the completed item
5. Revert a completed task — verify full-opacity badges return
6. Refresh the page — verify all attributes persist
7. Repeat steps 1-3 in guest mode (logged out)

## Performance Considerations

None significant. The badges are pure render logic on data already fetched. No additional API calls, no new queries, no re-renders beyond what already happens on task list changes.

## References

- Roadmap: `context/foundation/roadmap.md` § S-04
- PRD: FR-005 (edit), FR-017 (work type), FR-018 (weight)
- Task router: `src/server/api/routers/task.ts`
- Domain types: `src/lib/data-mode/types.ts`
- Task list UI: `src/app/_components/task-list.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Repository & Type Plumbing

#### Automated

- [x] 1.1 Type checking passes: `pnpm typecheck` — 82aec77
- [x] 1.2 Linting passes: `pnpm check` — 82aec77
- [x] 1.3 Existing tests pass: `pnpm test` — 82aec77

### Phase 2: Task Attribute Display (Badges)

#### Automated

- [x] 2.1 Type checking passes: `pnpm typecheck` — a071a79
- [x] 2.2 Linting passes: `pnpm check` — a071a79
- [x] 2.3 Existing tests pass: `pnpm test` — a071a79

#### Manual

- [x] 2.4 Active tasks display colored work type pill and weight badge — a071a79
- [x] 2.5 Completed tasks display dimmed badges — a071a79
- [x] 2.6 Badges don't overflow on max-w-lg container — a071a79

### Phase 3: Create Form with Expandable Details

#### Automated

- [x] 3.1 Type checking passes: `pnpm typecheck` — b60197c
- [x] 3.2 Linting passes: `pnpm check` — b60197c
- [x] 3.3 Existing tests pass: `pnpm test` — b60197c

#### Manual

- [x] 3.4 Details section collapsed by default, defaults applied on create — b60197c
- [x] 3.5 Expanding shows work type and weight selectors — b60197c
- [x] 3.6 Non-default attributes show correct badges after creation — b60197c
- [x] 3.7 Details section resets after successful creation — b60197c

### Phase 4: Inline Attribute Editing

#### Automated

- [x] 4.1 Type checking passes: `pnpm typecheck`
- [x] 4.2 Linting passes: `pnpm check`
- [x] 4.3 Existing tests pass: `pnpm test`

#### Manual

- [x] 4.4 Edit mode shows current work type and weight pre-selected
- [x] 4.5 Changing attributes and saving persists new values
- [x] 4.6 Badges update immediately after save
- [x] 4.7 Escape cancels without saving attribute changes
- [x] 4.8 Edit mode works in both authenticated and guest modes
