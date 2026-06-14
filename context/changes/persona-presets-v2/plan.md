# Persona presets v2 — Implementation Plan

## Overview

Follow-up to shipped S-29 (`task-create-persona-presets`). Elevate personas from a create-only F-05 shortcut to a **persisted user-facing identity**: expand catalog (≥8, draft 10), store `personaPresetId` on tasks, show persona label + effort on rows, expose effort on the preset create path without flipping to Custom, and thread the field through auth + guest data-mode. Unblocks S-32 trust bridge (US-02).

**Frame brief:** `context/changes/persona-presets-v2/frame.md`

## Current State Analysis

From frame investigation and codebase read:

- **Catalog:** `src/lib/task/persona-presets.ts` — 3 presets (`deep-planning`, `mail-admin`, `hotfix-urgent`); `PersonaPresetId` union locked to those ids.
- **Persistence:** Prisma `Task` has F-05 fields only — no `personaPresetId` (`prisma/schema.prisma`).
- **Create UX:** `task-list.tsx` — effort inside `showCustomPanel` only; `onEffortMinutesChange` calls `markCreateFormCustom()` (lines 878–880); `createTask` payload omits persona id (lines 802–810).
- **Row chrome:** `TaskBadges` renders work type + `U:`/`I:` jargon (lines 46–81); no effort badge; used on active and completed rows.
- **Picker:** `persona-preset-picker.tsx` — maps 3 Lucide icons; `flex-wrap` row.
- **API:** `src/server/api/routers/task.ts` — create/update accept Eisenhower fields; no persona field.
- **Guest:** `guestTaskSchema` / `guest-repositories.ts` / `import-guest-snapshot.ts` — no persona field; `use-domain-tasks.ts` map omits it.
- **Tests:** `task-list.test.tsx` — oracles tied to 3 preset ids and Custom panel for effort visibility.
- **e2e:** `e2e/helpers/work-cycle.ts` `addTaskWithAttributes` — opens Custom panel, sets work type + urgency; unaffected by preset row if Custom path remains.

### Key Discoveries

- S-29 archive explicitly deferred DB column — this slice owns it.
- Inferring persona from F-05 post-hoc fails when effort differs or tuples collide — **store id**.
- Inline edit unchanged in S-29 — badge logic must use **stored id + live attribute comparison**, not create-form state.

## Desired End State

- **Catalog:** ≥8 user-approved personas with short labels and distinct F-05 bundles (8 locked — see Critical Implementation Details).
- **Create:** Preset chip → attributes + effort pre-filled; effort editable below chips without Custom; Add sends `personaPresetId` + attributes; Custom path sends `personaPresetId: "custom"`.
- **Rows:** Persona label + effort badge when preset identity still holds; Custom/F-05 detail otherwise; legacy tasks (`null` id) keep today's badges.
- **Parity:** Guest blob, guest repo, guest import, tRPC, `DomainTask`, server/guest repositories all carry optional `personaPresetId`.
- **S-32-ready:** Label lookup by id available for a follow-up rationale clause.

### Verification

- `pnpm check`, `pnpm typecheck`, `pnpm test`
- `pnpm exec vitest run src/app/_components/task-list.test.tsx`
- `pnpm exec vitest run src/lib/task/persona-presets.test.ts` (extend existing)
- Optional: `pnpm exec vitest run src/server/api/lib/import-guest-snapshot.test.ts` if added
- Manual: preset create with effort tweak → reload → persona + effort on row; Custom create → Custom + F-05; legacy task unchanged

## What We're NOT Doing

- S-32 rationale text, suggestion card changes, or scorer updates.
- Inline edit preset picker or clearing `personaPresetId` on attribute edit.
- Belt e2e for persona chips (Vitest sufficient; e2e helper stays on Custom path).
- P-105 Eisenhower literacy coach, Calm Garden preset icons (S-28).
- Backfill migration for existing tasks (null = legacy).
- Prisma enum for preset ids (string column for catalog evolution).

## Implementation Approach

1. Schema + API + data-mode threading first (enables persisted rows).
2. Catalog expansion + pure display/match helpers (testable without UI).
3. Create UX decouple effort from Custom.
4. Row badge component refactor.
5. Tests + optional S-32 export.

Guest + auth parity: every layer that reads/writes `effortMinutes` today also handles `personaPresetId` optionally.

## Critical Implementation Details

**Approved catalog (user sign-off 2026-06-13 — locked for Phase 2):**

| id | label | workType | urgency | importance | effortMinutes | horizon |
| --- | --- | --- | --- | --- | --- | --- |
| focus | Focus | DEEP_WORK | 2 | 3 | 45 | THIS_WEEK |
| synchro | Synchro | OPERATIONAL | 2 | 2 | 15 | WHEN_POSSIBLE |
| firefight | Firefight | REACTIVE | 3 | 2 | 30 | ASAP |
| warm-up | Warm up | DEEP_WORK | 1 | 2 | 15 | THIS_WEEK |
| meeting | Meeting | OPERATIONAL | 2 | 2 | 30 | THIS_WEEK |
| plan | Plan | DEEP_WORK | 2 | 3 | 60 | THIS_WEEK |
| research | Research | DEEP_WORK | 1 | 2 | 45 | WHEN_POSSIBLE |
| quick | Quick | OPERATIONAL | 1 | 1 | 10 | ASAP |

Notes: `workType` is internal scorer input only — **no Ops/Admin labels** in UI. S-29 ids (`deep-planning`, `mail-admin`, `hotfix-urgent`) replaced in catalog module; no DB rows reference them yet.

**Display mode function (single oracle):**

```ts
// persona-presets.ts — conceptual
type TaskBadgeDisplayMode = "legacy" | "persona" | "custom-detail";

function getTaskBadgeDisplayMode(task: {
  personaPresetId: string | null;
  workType; urgency; importance; commitmentHorizon; effortMinutes;
}): TaskBadgeDisplayMode
```

- `legacy` when `personaPresetId == null` (pre-migration / no persona stored)
- `persona` when id resolves to a catalog preset and `attributesMatchPreset(id, task, { ignoreEffort: true })`
- `custom-detail` when `personaPresetId === "custom"` OR id set but non-effort attrs diverge OR unknown id (removed catalog entry — show Custom + F-05, not legacy)

**Effort badge:** `rounded-full bg-surface-panel` chip, text `{effortMinutes}m`; omit when `effortMinutes == null`.

**Create form state:**

- `selectedPresetId`: `PersonaPresetId | "custom" | null` — unchanged semantics.
- Effort input: render when `selectedPresetId` is a `PersonaPresetId` (sibling below `PersonaPresetPicker`, outside `showCustomPanel`).
- Remove `markCreateFormCustom()` from effort handlers on preset path only; keep on work type / urgency / importance / horizon in Custom panel.

**createTask payload:**

```ts
personaPresetId:
  selectedPresetId === "custom"
    ? "custom"
    : selectedPresetId != null
      ? selectedPresetId
      : null,
```

---

## Phase 1: Schema, migration, and API threading

### Overview

Add nullable `personaPresetId` end-to-end for auth + guest before UI depends on it.

### Pre-step

```powershell
cd d:\repos\10xdev\FlowState; git switch main; git pull; git switch -c features/persona-presets-v2
```

(Skip if already on feature branch.)

### Changes Required

#### 1. Prisma schema

**File:** `prisma/schema.prisma`

**Intent:** Add optional column on `Task`:

```prisma
personaPresetId String? @map("persona_preset_id") @db.VarChar(32)
```

**Contract:** Nullable, no default. Run `pnpm prisma migrate dev` (name e.g. `add_task_persona_preset_id`) — no hand-written SQL.

#### 2. tRPC task router

**File:** `src/server/api/routers/task.ts`

**Intent:** Add optional `personaPresetId` to create/update input schemas — `z.string().max(32).nullable().optional()`. Validate on create when non-null: allow `"custom"` or a known catalog id from `persona-presets.ts` (zod enum derived from catalog + `"custom"`). Pass through to Prisma `create`/`update`.

**Contract:** Invalid id → `BAD_REQUEST`. Omit on update = no change; explicit `null` clears (future-safe; inline edit won't use in this slice).

#### 3. Domain types + repositories

**Files:**

- `src/lib/data-mode/types.ts` — `personaPresetId: string | null` on `DomainTask`; extend `TaskRepository` create/update input.
- `src/lib/repositories/server-repositories.ts` — `TrpcTaskRow`, `toDomainTask`, pass field through (fix `CreateTaskInput`/`UpdateTaskInput` types currently incomplete vs Eisenhower — extend minimally for persona field).
- `src/lib/repositories/guest-repositories.ts` — guest task object + `create`/`update`.
- `src/lib/data-mode/use-domain-tasks.ts` — map `personaPresetId` from guest snapshot.

#### 4. Guest schema + import

**Files:**

- `src/lib/guest/schema.ts` — `personaPresetId: z.string().max(32).nullable().optional()` on `guestTaskSchema`; `GuestTask` type.
- `src/server/api/lib/import-guest-snapshot.ts` — `personaPresetId: guestTask.personaPresetId ?? null` on `task.create`.

#### 5. Hooks

**File:** `src/hooks/use-task-mutations.ts` — ensure create args type accepts `personaPresetId`; extend `buildOptimisticCreateRow` so auth-mode optimistic rows include `personaPresetId: input.personaPresetId ?? null` (avoids legacy F-05 flash before refetch — L-04).

### Success Criteria

#### Automated Verification

- [ ] `pnpm prisma migrate dev` succeeds locally
- [ ] `pnpm check` passes
- [ ] `pnpm typecheck` passes
- [ ] `pnpm exec vitest run src/server/api/routers/task-mutation.test.ts` passes (extend if needed)

#### Manual Verification

- [ ] Prisma client regenerates; new column visible on `Task`

---

## Phase 2: Expanded catalog and pure helpers

### Overview

Replace 3-preset catalog with approved ≥8 (draft 10), new ids, and pure functions for apply/match/label.

### Pre-step (catalog gate — satisfied)

Catalog approved **2026-06-13** (8 personas locked in Critical Implementation Details and `change.md`). Proceed without re-approval; mark Progress **2.4** at Phase 2 start.

### Changes Required

#### 1. Persona presets module

**File:** `src/lib/task/persona-presets.ts`

**Intent:**

- Expand `PersonaPresetId` union to new ids (`focus`, `synchro`, …).
- Replace `TASK_PERSONA_PRESETS` array (≥8 entries).
- Keep `applyPersonaPresetToCreateState`, `DEFAULT_CREATE_FORM_ATTRIBUTES`.
- Add:
  - `getPersonaPresetById(id: string): TaskPersonaPreset | undefined`
  - `getPersonaPresetLabel(id: string): string | undefined`
  - `taskAttributesMatchPreset(task, presetId, { ignoreEffort?: boolean }): boolean` — compares workType, urgency, importance, commitmentHorizon; optionally skip effort.
  - `getTaskBadgeDisplayMode(task): "legacy" | "persona" | "custom-detail"` — uses rules in plan brief.

**Contract:** `PersonaPresetCreateState` unchanged shape. Export preset id list for zod validation in task router.

#### 2. Persona preset picker icons

**File:** `src/app/_components/persona-preset-picker.tsx`

**Intent:** Extend `PRESET_ICONS` for all catalog ids (Lucide). Layout: keep `flex-wrap` or `overflow-x-auto` for 10+ Custom chip — prefer wrap with short labels.

**Contract:** `data-testid={`persona-preset-${preset.id}`}` unchanged pattern.

#### 3. Unit tests

**File:** `src/lib/task/persona-presets.test.ts` (extend existing)

**Intent:** Match/mismatch oracles — effort-only difference → match with `ignoreEffort: true`; urgency change → no match; `getTaskBadgeDisplayMode` cases for legacy/persona/custom-detail.

### Success Criteria

#### Automated Verification

- [ ] `pnpm exec vitest run src/lib/task/persona-presets.test.ts` passes
- [ ] `pnpm check` passes
- [ ] `pnpm typecheck` passes

#### Manual Verification

- [ ] User approved final catalog names/bundles (record in commit message or plan Progress note)

---

## Phase 3: Create UX — effort on preset path

### Overview

Effort visible when preset selected; effort-only edits preserve preset selection; create sends `personaPresetId`.

### Changes Required

#### 1. Task list create form

**File:** `src/app/_components/task-list.tsx`

**Intent:**

- After `PersonaPresetPicker`, when `selectedPresetId` is a preset id, render compact effort row (reuse effort input styling from `EisenhowerAttributeFields` — label "Effort", numeric input, optional Clear).
- `onEffortMinutesChange` on preset path: `setNewEffortMinutes(value)` only — **do not** call `markCreateFormCustom()`.
- Custom panel effort handler: keep `markCreateFormCustom()` on non-effort fields only.
- `createTask` call: add `personaPresetId` per payload rules above.
- `applyPresetToCreateForm`: unchanged — still sets effort from bundle.

**Contract:** `data-testid="create-preset-effort"` on preset-path effort input for tests.

#### 2. Task list tests (partial)

**File:** `src/app/_components/task-list.test.tsx`

**Intent:**

- **Refactor** `"Add sends %s preset attributes via createTask"` — expect `personaPresetId: presetId` alongside F-05 fields in `createTask` call.
- **Refactor** `"preset %s applies create form attributes visible in Custom panel"` — verify bundle via preset-path effort (`data-testid="create-preset-effort"`) and preset chip `aria-pressed`; do **not** require `openCreateCustomPanel()` for effort oracle.
- **Add:** select preset → effort visible without opening Custom; change effort → preset chip still `aria-pressed=true`.
- Update any remaining preset id references (`focus` vs `deep-planning`).

### Success Criteria

#### Automated Verification

- [ ] `pnpm exec vitest run src/app/_components/task-list.test.tsx` passes (preset id updates may fail until this phase — complete together)

#### Manual Verification

- [ ] Select Synchro → effort 15 visible → change to 20 → still Synchro pressed → Add → row shows Synchro (after Phase 4)

---

## Phase 4: Row badges — persona + effort

### Overview

Replace default row chrome with persona-first display; legacy fallback for `null` personaPresetId.

### Changes Required

#### 1. Task badge component

**File:** `src/app/_components/task-list.tsx` (or extract `task-row-badges.tsx` co-located if `TaskBadges` grows — prefer extract only if >40 lines added)

**Intent:** Refactor `TaskBadges` → accept full task slice:

```ts
{ personaPresetId, workType, urgency, importance, commitmentHorizon, effortMinutes }
```

Render by `getTaskBadgeDisplayMode`:

| Mode | Render |
| --- | --- |
| `legacy` | Current `TaskBadges` (work type + U/I + ASAP) |
| `persona` | Persona label chip (preset label, work-type colors) + effort badge |
| `custom-detail` | "Custom" neutral chip + work type + U/I (+ ASAP) — **no** persona label |

**Contract:** `data-testid="task-persona-badge"` / `task-effort-badge` / `task-custom-badge` for tests. Completed rows use same component with `dimmed`.

#### 2. Wire row usage

**File:** `src/app/_components/task-list.tsx`

**Intent:** `SortableActiveTaskRow` and completed list pass `task.personaPresetId` + effort into badge component.

### Success Criteria

#### Automated Verification

- [ ] `pnpm exec vitest run src/app/_components/task-list.test.tsx` passes — row badge tests for persona+effort, custom-detail, legacy null id

#### Manual Verification

- [ ] Preset task with effort override shows persona + custom effort on row
- [ ] Pre-migration / legacy task still shows Ops + U:/I:
- [ ] Custom-created task shows Custom + F-05 detail

---

## Phase 5: Tests and e2e helper note

### Overview

Complete test coverage, guest tests, document e2e impact.

### Changes Required

#### 1. Guest schema tests

**File:** `src/lib/guest/schema.test.ts`

**Intent:** Parse snapshot with `personaPresetId`; backward compat without field.

#### 2. Guest import tests

**File:** `src/server/api/routers/guest.test.ts` or dedicated import test

**Intent:** Import guest task with `personaPresetId: "synchro"` → DB row has column set.

#### 3. Guest repository tests

**File:** `src/lib/repositories/guest-repositories.test.ts`

**Intent:** create/list round-trip `personaPresetId`.

#### 4. e2e helper documentation

**File:** `e2e/helpers/work-cycle.ts`

**Intent:** Add comment at `addTaskWithAttributes` — still uses **Custom panel** by design; belt specs (`task-suggestion.spec.ts`, `session-kickoff.spec.ts`) unchanged. Optional sibling:

```ts
export async function addTaskViaPreset(page, title, presetTestId: string)
```

— clicks `persona-preset-${presetTestId}`, fills title, Add — for future S-32 e2e; **not required for belt** in this slice.

#### 5. Full suite

Run `pnpm test`, `pnpm check`, `pnpm typecheck`.

### Success Criteria

#### Automated Verification

- [ ] `pnpm test` passes
- [ ] `pnpm check` passes
- [ ] `pnpm typecheck` passes

#### Manual Verification

- [ ] Guest mode: preset create → reload → persona on row
- [ ] Guest merge imports `personaPresetId`

---

## Phase 6: Optional S-32 prep

### Overview

Thin exports + roadmap note so S-32 plan does not re-research persistence.

### Changes Required

#### 1. Export for rationale

**File:** `src/lib/task/persona-presets.ts`

**Intent:** Ensure `getPersonaPresetLabel` is the canonical label for S-32 clause (e.g. `"Synchro — operational work fits your current energy."` template in S-32). Skip rationale when `personaPresetId === "custom"`.

#### 2. S-32 roadmap note

**File:** `context/foundation/roadmap-references/items/S-32.md`

**Intent:** Resolve unknown: use stored `personaPresetId` + `getPersonaPresetLabel`; prerequisite persona-presets-v2 shipped. One-line edit under Unknowns — **only if user wants doc sync in same PR** (otherwise leave for S-32 change).

### Success Criteria

#### Automated Verification

- [ ] `pnpm test` passes

#### Manual Verification

- [ ] S-32 implementer can read `persona-presets.ts` exports without code search

---

## Testing Strategy

### Unit

- `src/lib/task/persona-presets.test.ts` — match/display oracles (primary).
- `src/lib/guest/schema.test.ts`, `guest-repositories.test.ts`, guest import — parity.

### Component

- `src/app/_components/task-list.test.tsx` — create path, effort override, row badges, post-create reset with new ids.

### e2e

- **No belt changes required** — `addTaskWithAttributes` uses Custom panel; persona row expansion does not break that path.
- Future S-32 may add `addTaskViaPreset` for rationale specs.

### Manual

- Auth + guest preset create, effort tweak, reload persistence.
- Legacy task row unchanged.

## Performance Considerations

Negligible — one nullable varchar per task; badge logic is O(1) preset lookup.

## Migration Notes

- **Additive migration** — existing tasks `personaPresetId = null` → legacy badge path.
- No guest blob version bump required — optional field ignored by old parsers via zod optional.
- Deploy order: migration before app deploy (standard).

## References

- Frame: `context/changes/persona-presets-v2/frame.md`
- S-29 archive plan: `context/archive/2026-06-13-task-create-persona-presets/plan.md`
- S-32: `context/foundation/roadmap-references/items/S-32.md`
- PRD US-02: `context/foundation/prd.md`
- Lessons L-04: co-located component tests for unbounded UI (`task-list.test.tsx` canonical)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Schema, migration, and API threading

#### Automated

- [x] 1.1 `pnpm prisma migrate dev` succeeds — cc50fa3
- [x] 1.2 `pnpm check` passes — cc50fa3
- [x] 1.3 `pnpm typecheck` passes — cc50fa3
- [x] 1.4 Task mutation tests pass — cc50fa3

#### Manual

- [x] 1.5 Prisma column verified on `Task` — cc50fa3

### Phase 2: Expanded catalog and pure helpers

#### Automated

- [x] 2.1 `pnpm exec vitest run src/lib/task/persona-presets.test.ts` passes — f29d997
- [x] 2.2 `pnpm check` passes — f29d997
- [x] 2.3 `pnpm typecheck` passes — f29d997

#### Manual

- [x] 2.4 User approved catalog labels and bundles — f29d997

### Phase 3: Create UX — effort on preset path

#### Automated

- [x] 3.1 `pnpm exec vitest run src/app/_components/task-list.test.tsx` passes — bcc617d

#### Manual

- [x] 3.2 Effort visible on preset path without Custom panel — bcc617d
- [x] 3.3 Effort-only change does not demote preset selection — bcc617d

### Phase 4: Row badges — persona + effort

#### Automated

- [x] 4.1 Row badge tests in `task-list.test.tsx` pass — bcc617d

#### Manual

- [x] 4.2 Preset + effort override row chrome verified in browser — bcc617d
- [x] 4.3 Legacy null-id task shows F-05 badges — bcc617d

### Phase 5: Tests and e2e helper note

#### Automated

- [x] 5.1 `pnpm test` passes — bcc617d
- [x] 5.2 `pnpm check` passes — bcc617d
- [x] 5.3 `pnpm typecheck` passes — bcc617d
- [x] 5.4 Guest schema/import/repository tests pass — bcc617d

#### Manual

- [x] 5.5 Guest create + merge parity verified — bcc617d

### Phase 6: Optional S-32 prep

#### Automated

- [x] 6.1 `pnpm test` passes — bcc617d

#### Manual

- [x] 6.2 S-32 label export documented for follow-up — bcc617d
