# F-05 Eisenhower Task Attributes — Implementation Plan

## Overview

Add importance (1–3), urgency (1–3), optional effort minutes (5–240), and commitment horizon (ASAP / THIS_WEEK / WHEN_POSSIBLE) to Task; migrate existing `weight` values to `urgency` with `importance` default 2; ship deterministic **scorer v2** and refresh S-23 rationale expander factors. Unlocks roadmap slice S-27. Legacy `weight` column stays — write path mirrors `urgency` for rollback safety.

## Current State Analysis

From `context/changes/eisenhower-effort-task-attributes/research.md`:

- **Task schema:** `workType`, `weight`, `sortOrder` only — no Eisenhower axes.
- **Scorer v1:** `scoreTask` base = `task.weight`; session multipliers unchanged since S-06.
- **Tie-break:** score → `sortOrder` → `weight` → `createdAt`.
- **UI:** `task-list.tsx` Details exposes work type + weight (Light/Medium/Heavy).
- **Guest:** `guestTaskSchema` mirrors weight/workType; merge copies three attribute fields.
- **S-23:** Five session-only expander factors; Eisenhower deferred to F-05.

### Key Discoveries:

- `src/lib/scoring/score-task.ts:25-58` — single-attribute base; extension point for v2 base function.
- `src/lib/scoring/dominant-factor.ts:8` — `base = task.weight`; must switch to Eisenhower base for factor magnitudes.
- `src/server/api/routers/suggestion.ts:167-173` — maps `{ workType, weight, sortOrder }` to `ScoringTask`.
- S-26 migration `20260609060315_task_sort_order` — backfill pattern for new NOT NULL columns.

## Desired End State

- Prisma Task + guest blob carry `importance`, `urgency`, `effortMinutes?`, `commitmentHorizon`.
- Migration backfills: `urgency = weight`, `importance = 2`, `commitmentHorizon = WHEN_POSSIBLE`, `effortMinutes = null`.
- Scorer v2 ranks tasks using Eisenhower base + Pareto/Ockham/horizon + existing session multipliers.
- Task create/edit UI: Urgency (relabel), Importance, optional Effort, Horizon in Details.
- Suggestion card shows ASAP horizon badge; expander can surface task-attribute chips.
- `pnpm test`, `pnpm check`, `pnpm typecheck` green.

### Verification

- Unit: `score-task.test.ts` matrices for v2 coefficients; tie-break uses urgency/importance.
- Integration: `suggestion.test.ts` picks higher Eisenhower product when session context equal.
- Guest: `guest.test.ts` + merge import preserve new fields.
- UI smoke: `task-list.test.tsx` renders new pickers.

## What We're NOT Doing

- Dropping `weight` column or removing weight from API responses.
- Eisenhower 2×2 matrix visualization screen.
- S-27 daily standing / focus-hours capacity (blocked on F-05, separate slice).
- Belt e2e for attribute pickers (Vitest/component sufficient).
- Changing risks #1–#7 in test-plan.
- Auto-syncing importance from external calendars.

## Implementation Approach

Bottom-up with test-first on pure logic layers:

1. Schema + domain/guest types (migration gate).
2. Scorer v2 + unit tests (`/10x-tdd` friendly).
3. tRPC task router + suggestion mapping.
4. Guest repositories + merge import.
5. Task list UI + optimistic defaults.
6. Rationale expander + breakdown tests.

## Critical Implementation Details

**Write-path legacy sync:** On `task.create` / `task.update`, when `urgency` is set, also write `weight = urgency` so legacy readers and rollback paths stay consistent. Reads for scoring use `urgency`, not `weight`.

**Scorer v2 base (coefficients locked by unit tests):**

```
eisenhowerBase = urgency × importance

if energy === FOCUSED && importance >= 3: eisenhowerBase × 1.15   // Pareto
if energy === FADING && effortMinutes != null:
  if effortMinutes <= 30: eisenhowerBase × 1.12                   // Ockham low
  if effortMinutes >= 90: eisenhowerBase × 0.88                   // Ockham high

if commitmentHorizon === ASAP: eisenhowerBase × 1.18
if commitmentHorizon === THIS_WEEK: eisenhowerBase × 1.06

score = eisenhowerBase × TYPE_FIT × fatigue × interruptions × lateDay × overrideBoost
```

**Tie-break chain:** score desc → `sortOrder` asc → `urgency` desc → `importance` desc → `createdAt` asc.

**New `CommitmentHorizon` enum:** `ASAP`, `THIS_WEEK`, `WHEN_POSSIBLE` (Prisma + Zod + guest enum).

---

## Phase 1: Schema, migration, and domain types

### Overview

Add F-05 columns and enum to Prisma; backfill existing rows; extend domain/guest types so downstream compiles.

### Changes Required:

#### 1. Prisma Task model + enum

**File**: `prisma/schema.prisma`

**Intent**: Persist Eisenhower axes and horizon on Task.

**Contract**: Add enum `CommitmentHorizon { ASAP THIS_WEEK WHEN_POSSIBLE }`. On `Task`: `importance Int @default(2)`, `urgency Int @default(2)`, `effortMinutes Int? @map("effort_minutes")`, `commitmentHorizon CommitmentHorizon @default(WHEN_POSSIBLE) @map("commitment_horizon")`. Keep existing `weight` unchanged.

#### 2. Migration with backfill

**File**: `prisma/migrations/<timestamp>_eisenhower_task_attributes/` (via `pnpm prisma migrate dev`)

**Intent**: Safe deploy on existing production rows.

**Contract**: Add columns with defaults. Backfill: `UPDATE urgency = weight`, `importance = 2`, `commitment_horizon = 'WHEN_POSSIBLE'`, `effort_minutes = NULL` for all rows. Run `pnpm db:generate`.

#### 3. Domain and guest types

**File**: `src/lib/data-mode/types.ts`

**Intent**: Thread new fields through dual data-mode.

**Contract**: Extend `DomainTask` with `importance`, `urgency`, `effortMinutes: number | null`, `commitmentHorizon`.

**File**: `src/lib/guest/schema.ts`

**Intent**: Guest snapshot parity.

**Contract**: Extend `guestTaskSchema` with same fields; defaults `importance: 2`, `urgency: 2`, `commitmentHorizon: "WHEN_POSSIBLE"`, `effortMinutes` optional/nullable. Legacy snapshots missing fields get defaults on parse (no version bump).

#### 4. Repository mappers

**File**: `src/lib/repositories/server-repositories.ts`, `src/lib/data-mode/use-domain-tasks.ts`

**Intent**: Map Prisma/tRPC rows ↔ `DomainTask`.

**Contract**: Pass through all four new fields in `toDomainTask` and guest hook mapping.

### Success Criteria:

#### Automated Verification:

- Migration applies: `pnpm prisma migrate dev` (local)
- Types compile: `pnpm typecheck`
- Lint: `pnpm check`
- Guest schema tests pass: `pnpm exec vitest run src/lib/guest/schema.test.ts`

#### Manual Verification:

- `pnpm prisma studio` shows backfilled urgency matching weight on sample rows

---

## Phase 2: Scorer v2 core

### Overview

Replace weight-only base with Eisenhower v2 formula; update tie-break; lock coefficients with unit tests.

**Route:** `/10x-tdd` — red → green on `score-task.test.ts` before touching routers.

### Changes Required:

#### 1. ScoringTask type + base computation

**File**: `src/lib/scoring/score-task.ts`

**Intent**: v2 task-attribute inputs and Eisenhower base.

**Contract**: Extend `ScoringTask` with `importance`, `urgency`, `effortMinutes: number | null`, `commitmentHorizon`. Extract `computeEisenhowerBase(task, context)` per Critical Implementation Details. `scoreTask` uses that base instead of `task.weight`. Update `pickBestTask` tie-break to urgency → importance (drop weight tie-break).

#### 2. Unit tests

**File**: `src/lib/scoring/score-task.test.ts`

**Intent**: Oracle for v2 coefficients and tie-break.

**Contract**: Cases: equal session context → higher `urgency×importance` wins; FOCUSED + importance 3 gets Pareto boost; FADING + effort 20 vs 120; ASAP vs WHEN_POSSIBLE; null effort neutral; tie-break prefers lower sortOrder then higher urgency.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/lib/scoring/score-task.test.ts`
- `pnpm typecheck`
- `pnpm check`

#### Manual Verification:

- — (none)

---

## Phase 3: Task API and suggestion mapping

### Overview

Expose new fields on task CRUD; map DB rows to extended `ScoringTask`; legacy weight sync on write.

### Changes Required:

#### 1. Task router

**File**: `src/server/api/routers/task.ts`

**Intent**: Create/update accept new attributes with validation.

**Contract**: Zod: `importance`/`urgency` int 1–3 optional with defaults; `effortMinutes` int 5–240 optional nullable; `commitmentHorizon` enum optional default `WHEN_POSSIBLE`. On create/update when urgency provided, set `weight = urgency`. `list` returns new fields.

#### 2. Suggestion router mapping

**File**: `src/server/api/routers/suggestion.ts`

**Intent**: Feed v2 scorer from DB tasks.

**Contract**: Map `{ importance, urgency, effortMinutes, commitmentHorizon, workType, sortOrder, createdAt }` into `ScoringTask`. Response payload includes new fields on suggested task for UI badges.

#### 3. Integration tests

**File**: `src/server/api/routers/task-mutation.test.ts`, `src/server/api/routers/suggestion.test.ts`

**Intent**: API-level regression guard.

**Contract**: Create task with all attributes persisted; suggestion picks higher Eisenhower product when scores differ; weight column mirrors urgency after update.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/server/api/routers/task-mutation.test.ts src/server/api/routers/suggestion.test.ts`
- `pnpm test`
- `pnpm check`

#### Manual Verification:

- — (none)

---

## Phase 4: Guest parity and merge import

### Overview

Guest CRUD + account merge preserve Eisenhower fields end-to-end.

### Changes Required:

#### 1. Guest repositories

**File**: `src/lib/repositories/guest-repositories.ts`

**Intent**: Defaults and CRUD for new fields.

**Contract**: Create defaults: importance 2, urgency 2, horizon WHEN_POSSIBLE, effort null. Update accepts new fields.

#### 2. Merge import

**File**: `src/server/api/lib/import-guest-snapshot.ts`

**Intent**: Risk #5 — no silent attribute loss on sign-in.

**Contract**: Copy `importance`, `urgency`, `effortMinutes`, `commitmentHorizon` alongside existing fields.

#### 3. Optimistic mutations

**File**: `src/hooks/use-task-mutations.ts`

**Intent**: Optimistic create row includes new defaults.

**Contract**: `buildOptimisticCreateRow` spreads importance/urgency/horizon/effort defaults matching server.

#### 4. Tests

**File**: `src/lib/guest/merge-copy.test.ts`, `src/server/api/routers/guest.test.ts`, `src/hooks/use-task-mutations.test.tsx`

**Intent**: Merge + optimistic paths covered.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/lib/guest/merge-copy.test.ts src/server/api/routers/guest.test.ts src/hooks/use-task-mutations.test.tsx`
- `pnpm test`

#### Manual Verification:

- — (none)

---

## Phase 5: Task list UI and suggestion card badges

### Overview

Expose pickers in Details panel; relabel weight → Urgency; show ASAP badge on suggestion card.

### Changes Required:

#### 1. Task list controls

**File**: `src/app/_components/task-list.tsx`

**Intent**: User-facing attribute editing.

**Contract**: Rename weight label to **Urgency** (keep Light/Medium/Heavy sublabels). Add Importance segmented control (same 1–3 pattern). Add optional Effort number input or compact select (5–240, clearable). Add Horizon segmented control (ASAP / This week / When possible). Wire create/edit mutations with new fields. Update `TaskBadges` to show urgency + importance (horizon badge when ASAP).

#### 2. Suggestion card

**File**: `src/app/_components/task-suggestion-card.tsx`

**Intent**: Surface horizon at a glance.

**Contract**: Show small ASAP pill when `commitmentHorizon === "ASAP"`. Keep work type badge; show urgency/importance or retain weight badge mapped from urgency for compat.

#### 3. Pomodoro hook types

**File**: `src/hooks/use-pomodoro-cycle.ts`

**Intent**: TypeScript alignment for suggestion payloads.

**Contract**: Extend `SuggestionResult` / related types with new task fields.

#### 4. Component smoke tests

**File**: `src/app/_components/task-list.test.tsx`, `src/app/_components/task-suggestion-card.test.tsx`

**Intent**: Guard unbounded form controls (L-04 pattern).

**Contract**: Smoke render with new pickers present; ASAP badge visible when horizon ASAP.

#### 5. E2E helper (ad-hoc specs)

**File**: `e2e/helpers/work-cycle.ts`

**Intent**: Keep ad-hoc e2e attribute seeding working after Urgency relabel.

**Contract**: Extend `addTaskWithAttributes` (or add sibling) to set importance/horizon when tests need them; default path sets urgency via renamed control.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/app/_components/task-list.test.tsx src/app/_components/task-suggestion-card.test.tsx`
- `pnpm test`
- `pnpm check`

#### Manual Verification:

- Create task with Details expanded: all four attributes save and reload correctly (logged-in)
- Guest trial: same fields persist across refresh before sign-in

---

## Phase 6: Rationale expander refresh (S-23)

### Overview

Add task-attribute factors to dominant-factor math, rationale templates, and expander chips.

**Route:** `/10x-tdd` on `dominant-factor.test.ts` + `rationale-breakdown.test.ts`.

### Changes Required:

#### 1. Rationale keys and copy

**File**: `src/lib/scoring/rationale.ts`

**Intent**: Headline templates for new dominant factors.

**Contract**: Add keys: `eisenhower_priority`, `importance_focus`, `low_effort_fit`, `horizon_asap`. One-line calm copy each (no analytics tone).

#### 2. Factor contributions

**File**: `src/lib/scoring/dominant-factor.ts`

**Intent**: Expander chips for task attributes.

**Contract**: Replace `base = task.weight` with Eisenhower base. Add contributions for: high Eisenhower product (urgency×importance ≥ 6), Pareto boost when active, Ockham low-effort when active, ASAP horizon boost. Sort by magnitude; existing session factors retained.

#### 3. Breakdown chip labels

**File**: `src/lib/scoring/rationale-breakdown.ts`

**Intent**: S-23 chip labels for new keys.

**Contract**: Extend `FACTOR_CHIP_LABELS` (e.g. "High priority", "Important now", "Quick win", "Due ASAP").

#### 4. Tests

**File**: `src/lib/scoring/dominant-factor.test.ts`, `src/lib/scoring/rationale-breakdown.test.ts`, extend `src/server/api/routers/suggestion.test.ts`

**Intent**: Breakdown includes new chip when factor wins; headline exclusion still works.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/lib/scoring/dominant-factor.test.ts src/lib/scoring/rationale-breakdown.test.ts`
- `pnpm test`
- `pnpm check`

#### Manual Verification:

- Post-check-in suggestion with ASAP high-importance task: expander shows horizon or Eisenhower chip among factors

---

## Testing Strategy

### Unit Tests

- Scorer v2 coefficient matrix (`score-task.test.ts`)
- Dominant factor magnitudes (`dominant-factor.test.ts`)
- Rationale breakdown chip dedup (`rationale-breakdown.test.ts`)

### Integration Tests

- Task CRUD + weight mirror (`task-mutation.test.ts`)
- Suggestion ranking + breakdown shape (`suggestion.test.ts`)
- Guest merge field copy (`guest.test.ts`)

### Manual Testing Steps

1. Log in → create task with Importance 3, Urgency 1, ASAP → verify badges and suggestion rationale.
2. Set Fading energy context (via check-in flow) → low-effort task ranks above high-effort peer with equal Eisenhower product.
3. Guest mode → set attributes → sign in → merged task retains values.

## Performance Considerations

Scorer adds constant-time arithmetic per candidate task — negligible vs existing O(n) pick. No new DB indexes required beyond defaults.

## Migration Notes

- Backfill runs in migration SQL; no runtime migration job.
- Rollback: revert deploy + migration down; `weight` column untouched if down fails mid-flight — treat as forward-only in production.

## References

- Research: `context/changes/eisenhower-effort-task-attributes/research.md`
- Roadmap F-05: `context/foundation/roadmap.md`
- S-04 pattern: `context/archive/2026-05-30-task-attributes-for-scoring/`
- S-26 migration: `context/archive/2026-06-09-task-manual-priority-order/`
- S-23 deferral: `context/archive/2026-06-10-suggestion-rationale-expander/`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Schema, migration, and domain types

#### Automated

- [x] 1.1 Migration applies and client generates: `pnpm prisma migrate dev` + `pnpm db:generate`
- [x] 1.2 Types compile: `pnpm typecheck`
- [x] 1.3 Lint passes: `pnpm check`
- [x] 1.4 Guest schema tests pass: `pnpm exec vitest run src/lib/guest/schema.test.ts`

#### Manual

- [x] 1.5 Backfill verified: sample rows show urgency = former weight in Prisma Studio

### Phase 2: Scorer v2 core

#### Automated

- [ ] 2.1 Scorer unit tests pass: `pnpm exec vitest run src/lib/scoring/score-task.test.ts`
- [ ] 2.2 Types compile: `pnpm typecheck`
- [ ] 2.3 Lint passes: `pnpm check`

### Phase 3: Task API and suggestion mapping

#### Automated

- [ ] 3.1 Task + suggestion router tests pass: `pnpm exec vitest run src/server/api/routers/task-mutation.test.ts src/server/api/routers/suggestion.test.ts`
- [ ] 3.2 Full unit suite: `pnpm test`
- [ ] 3.3 Lint passes: `pnpm check`

### Phase 4: Guest parity and merge import

#### Automated

- [ ] 4.1 Guest + merge + mutation tests pass: `pnpm exec vitest run src/lib/guest/merge-copy.test.ts src/server/api/routers/guest.test.ts src/hooks/use-task-mutations.test.tsx`
- [ ] 4.2 Full unit suite: `pnpm test`

### Phase 5: Task list UI and suggestion card badges

#### Automated

- [ ] 5.1 Component smoke tests pass: `pnpm exec vitest run src/app/_components/task-list.test.tsx src/app/_components/task-suggestion-card.test.tsx`
- [ ] 5.2 Full unit suite: `pnpm test`
- [ ] 5.3 Lint passes: `pnpm check`

#### Manual

- [ ] 5.4 Logged-in create/edit saves all four attributes across refresh
- [ ] 5.5 Guest attributes survive refresh and merge after sign-in

### Phase 6: Rationale expander refresh (S-23)

#### Automated

- [ ] 6.1 Factor + breakdown tests pass: `pnpm exec vitest run src/lib/scoring/dominant-factor.test.ts src/lib/scoring/rationale-breakdown.test.ts`
- [ ] 6.2 Full unit suite: `pnpm test`
- [ ] 6.3 Lint passes: `pnpm check`

#### Manual

- [ ] 6.4 Expander shows task-attribute chip when ASAP + high-importance task suggested
