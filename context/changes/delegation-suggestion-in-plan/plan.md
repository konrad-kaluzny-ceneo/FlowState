# Delegation Suggestion in Plan dnia Implementation Plan

## Overview

Add a delegation-suggestion feature to the Plan dnia view (S-47): the scorer proposes one delegatable task (low-effort, operational/reactive, low-urgency work) with a one-line rationale. The user accepts (task moves to a new `"delegated"` status and leaves the Fokus suggestion pool) or skips (dismissed for today only). Authenticated mode only.

## Current State Analysis

Plan dnia (`src/app/_components/plan-dnia-view.tsx`) has one real section today — `BudgetPanel`, driven by `useDayPlan()` → `dayPlanRouter` (`getOrCreate`/`setBudget`/`setEnergy`). Everything else on the page (`DayCalendarMock`) is a hardcoded placeholder wrapped in `ComingSoonPreview`. There is no task list and no delegation concept anywhere in the codebase yet.

Task status today is `DomainTaskStatus = "active" | "completed" | "archived" | "planned" | "blocked"` (`src/lib/data-mode/types.ts:26-31`), free-form `VARCHAR(20)` in Postgres (`prisma/schema.prisma:75`). The scoring pipeline (`score-task.ts` → `dominant-factor.ts` → `rationale.ts`) drives the Fokus next-task suggestion; it is energy/session-context-aware and produces a `RationaleKey` + i18n'd sentence. `/tasks` (`task-list.tsx`) already has a `"blocked"` tab that is the exact UI shape a `"delegated"` tab should mirror (tab entry, filter, panel, colored-circle revert-to-active row action).

### Key Discoveries:

- `taskRouter.update` (`src/server/api/routers/task.ts:137-222`) already accepts arbitrary status transitions once a new value is in its zod enum — no new mutation needed for "accept"; it becomes `taskRouter.update({id, status: "delegated"})` via the existing `useTaskMutations().updateTask` hook (`src/hooks/use-task-mutations.ts:520-545`), same call shape `/tasks` already uses for blocking (`task-list.tsx:500`).
- `stale-task-archive.ts:25` (`matchesStaleArchivePredicate`) only fires on `status === "active"` — a `"delegated"` task is automatically exempt from stale-archival, same as `planned`/`blocked`/`completed`. No seam needed there.
- `buildSuggestionPool` (`src/lib/suggestion/build-suggestion-pool.ts:39`) filters to `SUGGESTION_POOL_STATUSES = ["active", "planned"]` — a `"delegated"` task is excluded from the Fokus pool automatically once the status exists; no suggestion-pool code change needed.
- `TaskDayCompletion` (`prisma/schema.prisma:214-226`) is the exact shape to mirror for a day-scoped "skip" record: `userId`, `taskId`, `localDateKey` (`VARCHAR(10)`), unique on `(userId, taskId, localDateKey)`.
- `useDayPlan()` (`src/hooks/use-day-plan.ts`) is the hook shape to mirror for a new `useDelegationSuggestion()` hook: `enabled = mode === "authenticated"`, `localDateKey` state synced on `visibilitychange`.
- `TaskSuggestionCard` (`src/app/_components/task-suggestion-card.tsx`) is a sibling pattern, not something to extend — lesson L-07 (`context/foundation/lessons.md:115-126`) requires next-task suggestion UI to surface ONLY via the Fokus `FocusReady` star; the delegation card is a different concept on a different page and must stay a separate component.

## What We're NOT Doing

- No new task attribute/field for "delegatable-ness" — reuse existing `workType`, `effortMinutes`, `commitmentHorizon`.
- No guest-mode delegation code path (matches `useDayPlan`'s authenticated-only gating).
- No changes to the MCP server (S-46): `"delegated"` is deliberately excluded from `taskStatusZod` in `mcp-tools.ts` (the `update_task` write-tool enum) so agents cannot set it themselves; it flows through `list_tasks` reads automatically once added to `DomainTaskStatus`, with zero MCP code change.
- No candidate list — single top candidate only, one card.
- No AI-vs-human delegation-target classification — one generic "delegatable" signal.
- No rationale breakdown/expander for delegation v1 (Linear scope only asks for a one-line rationale).
- No e2e/Playwright coverage — unit + integration (Vitest) only, per lesson L-06 (pure scoring + a status mutation, no wedge/timer/fake-clock involvement).
- No new "delegate" button on active task rows in `/tasks` — delegating only happens by accepting the Plan dnia card.
- No changes to `DayCalendarMock`/`ComingSoonPreview`.
- Nothing deferred to a fast-follow — this ships as one cohesive slice.

## Implementation Approach

Follow the standard data model → business logic → API → UI ordering used elsewhere in the codebase (e.g. S-51 blocked-task-status):

1. Add `"delegated"` as a task status across every seam that already enumerates status values, plus a new `TaskDelegationSkip` table (the one real migration) for day-scoped skip persistence.
2. Add a delegation-scoring module (new file, not a modification of `score-task.ts`'s energy-aware pipeline — delegation scoring has no session-context dependency) and extend the rationale system with delegation-specific keys, then expose both through a new `dayPlanRouter.getDelegationSuggestion` query and `dayPlanRouter.skipDelegationSuggestion` mutation.
3. Build the Plan dnia UI card and the `/tasks` mirror of the blocked-tab pattern, wired through a new `useDelegationSuggestion` hook and the existing `useTaskMutations` hook for accept.

## Critical Implementation Details

**Rationale stub context**: `buildRationale(key, context, locale)` in `rationale.ts` takes a `ScoringContext` (energy, completedWorkCycles, interruptionCount, localHour) because most existing keys read those fields. The two new delegation keys don't need any of them — they're picked from task attributes alone — but the function signature still requires *a* `ScoringContext` value to typecheck. `formatDelegationRationale` should construct a trivial fixed context inline (e.g. `{ energy: "STEADY", completedWorkCycles: 0, interruptionCount: 0, localHour: 12 }`) purely to satisfy the type; the two delegation switch branches must not read any of its fields. Don't be tempted to make `context` optional on `buildRationale` — that would weaken the type for every other caller. `formatDelegationRationale` takes no `locale` parameter and calls `buildRationale` with only `(key, stubContext)`, letting it default to `"en"` — this exactly matches the existing `formatTaskRationale`/`formatKickoffRationale` calls in `dominant-factor.ts:137,161` (both also omit `locale`) and `suggestion.ts:258,359` (neither threads a locale into them either). This is a pre-existing, codebase-wide gap — server-computed rationale text is always English regardless of user locale — not something introduced by or in scope for this slice. Do not add locale-threading here; it would make delegation the only rationale-producing path with different behavior from every existing one, which is a bigger, separate change.

**Delegation scoring: `workType === "DEEP_WORK"` is a hard exclusion, not a soft multiplier**: a naive `×1.3` bonus for non-`DEEP_WORK` types is dominated by the `÷ (importance × urgency)` term — the divisor swings 1×–9×, while the combined delegatability bonus (`workType` × `effortMinutes` × `commitmentHorizon`) only swings up to ~1.8×. That means a low-priority `DEEP_WORK` task (e.g. importance=1, urgency=1) would out-score a genuinely delegatable `OPERATIONAL`, low-effort, `WHEN_POSSIBLE` task with only slightly higher priority — surfacing exactly the kind of task the product exists to protect (`TYPE_FIT` in `score-task.ts:26` already treats `DEEP_WORK` as the highest-value work type when `FOCUSED`) as a delegation suggestion. `DEEP_WORK` tasks must never enter the delegation candidate pool at all — see the corrected Phase 2 contract below.

## Phase 1: Data model + status seam + skip-table migration

### Overview

Add `"delegated"` as a valid `DomainTaskStatus` across every location that enumerates task-status values, and add the `TaskDelegationSkip` table for day-scoped skip persistence.

### Changes Required:

#### 1. Domain status seam (7 locations, mirrors the S-51 `"blocked"` precedent exactly)

**File**: `src/lib/data-mode/types.ts`

**Intent**: Add `"delegated"` to the domain vocabulary so repositories and UI can express it.

**Contract**: `DomainTaskStatus` union (`:26-31`) gains `"delegated"`. `TaskRepository.update`'s inline `status` union (`:110`) gains `"delegated"`.

**File**: `src/lib/persistence/prisma/task-mapper.ts`

**Intent**: Let the Prisma-boundary validator accept `"delegated"` as a known DB value instead of throwing in non-prod / silently downgrading to `"active"` in prod.

**Contract**: Add `"delegated"` to the `DOMAIN_TASK_STATUSES` allow-list (`:9-15`).

**File**: `src/lib/guest/schema.ts`

**Intent**: Let guest-mode snapshots store and validate the new status (even though guest mode has no delegation UI, the domain type is shared — a value must at least round-trip if e.g. a future guest→auth import carries no delegated tasks today, but the type must stay consistent with `DomainTaskStatus`).

**Contract**: `guestTaskSchema.status` zod enum (`:16`) and the `GuestTask.status` type field (`:38`) both gain `"delegated"`.

**File**: `src/server/api/routers/task.ts`

**Intent**: Allow the `update` mutation to actually persist the new status, and give a delegated task a fresh `sortOrder` if it's later reactivated (matching how completed/planned/blocked tasks get a fresh slot when returning to active).

**Contract**: `update`'s input `status` zod enum (`:142-144`) gains `"delegated"`. The `data.status === "active" && (existing.status === "completed" || "planned" || "blocked")` branch (`:191-201`) that assigns a fresh `sortOrder` gains `existing.status === "delegated"` to the OR-chain.

**File**: `src/lib/repositories/server-repositories.ts`

**Intent**: Keep the client-side `UpdateTaskInput` status union in sync with the server contract.

**Contract**: `UpdateTaskInput.status` union (`:38`) gains `"delegated"`.

**File**: `src/lib/repositories/guest-repositories.ts`

**Intent**: Mirror the server's "fresh sortOrder on reactivation" rule for guest mode's own `update` implementation.

**Contract**: `wasCompletedOrPlanned` (`:242-245`, currently `status === "completed" || "planned" || "blocked"`) gains `|| task.status === "delegated"`.

**File**: `src/app/api/mcp/mcp-tools.ts`

**Intent**: Deliberately do NOT add `"delegated"` here — document the omission so a future reviewer doesn't "fix" it.

**Contract**: `taskStatusZod` (`:104`, the `update_task` MCP write-tool enum) stays `z.enum(["active", "completed", "planned", "blocked"])` unchanged. Add a one-line comment at the enum noting the exclusion is intentional (agents must not be able to set/unset delegation themselves).

#### 2. `TaskDelegationSkip` model + migration

**File**: `prisma/schema.prisma`

**Intent**: Persist "user skipped the delegation suggestion for this task today" so the same candidate doesn't reappear until tomorrow.

**Contract**: New model directly below `TaskDayCompletion` (`:214-226`), same shape: `id` (autoincrement PK), `userId` (`user_id`, `VARCHAR(255)`), `taskId` (`task_id`), `localDateKey` (`local_date_key`, `VARCHAR(10)`), `skippedAt` (`skipped_at`, default `now()`, `Timestamptz`), a `task Task @relation(fields: [taskId], references: [id], onDelete: Cascade)` back-relation (add the reverse `delegationSkips TaskDelegationSkip[]` to `model Task` alongside its existing `dayCompletions TaskDayCompletion[]`, `:93`), unique constraint on `(userId, taskId, localDateKey)`, index on `(userId, localDateKey)`, `@@map("flow_state_task_delegation_skip")`.

Generate the migration with `pnpm db:migrate` (never hand-write the SQL).

### Success Criteria:

#### Automated Verification:

- Typecheck passes: `pnpm typecheck`
- Lint/format passes: `pnpm check`
- Migration applies cleanly: `pnpm db:migrate`
- Existing task-router and repository unit/integration tests still pass: `pnpm exec vitest run src/server/api/routers/task.test.ts src/lib/repositories`

#### Manual Verification:

- In Prisma Studio (`pnpm db:studio`), confirm the new `flow_state_task_delegation_skip` table exists with the expected columns and unique constraint.
- Manually `PATCH` a task to `status: "delegated"` via the existing task-update path (e.g. temporarily through `/tasks` dev tools or a quick script) and confirm it no longer appears in `/tasks`'s "Active" tab and is excluded from the Fokus suggestion pool.

---

## Phase 2: Scoring + rationale + dayPlan API

### Overview

Add the delegation-scoring heuristic, extend the rationale system with delegation-specific copy, and expose both through two new `dayPlanRouter` procedures.

### Changes Required:

#### 1. Delegation scoring module

**File**: `src/lib/scoring/delegation-score.ts` (new)

**Intent**: Score how "delegatable" a task is — hard-exclude `DEEP_WORK` (never delegatable), then favor low `effortMinutes`, `OPERATIONAL`/`REACTIVE` work type, and `commitmentHorizon === "WHEN_POSSIBLE"` — independent of session context (no energy/fatigue/time-of-day factors, since this isn't the Fokus suggestion pipeline).

**Contract**: Export `type DelegationCandidateTask = Pick<ScoringTask, "id" | "workType" | "effortMinutes" | "commitmentHorizon" | "importance" | "urgency" | "sortOrder" | "createdAt">`, `scoreDelegationCandidate(task: DelegationCandidateTask): number`, and `pickDelegationCandidate(tasks: DelegationCandidateTask[]): DelegationCandidateTask | null`. `pickDelegationCandidate` first filters out any task with `workType === "DEEP_WORK"` (a `DEEP_WORK` task must never win, regardless of how low its priority is — see Critical Implementation Details), then reduces the remainder with the same tie-break shape as `pickBestTask` (`score-task.ts:112-150`): higher score wins; ties broken by lower `sortOrder`, then earlier `createdAt`. `scoreDelegationCandidate` (called only on non-`DEEP_WORK` tasks) composition: base 1.0; `×1.2` if `effortMinutes != null && effortMinutes <= 30`; `×1.15` if `commitmentHorizon === "WHEN_POSSIBLE"`; `÷ (importance × urgency)` so low-priority tasks score higher (never divide by zero — importance/urgency are always 1-3 per the domain type).

#### 2. Rationale extension

**File**: `src/lib/scoring/rationale.ts`

**Intent**: Add delegation-flavored one-line rationale copy to the existing rationale vocabulary.

**Contract**: `RationaleKey` union (`:5-19`) gains `"delegation_low_effort"` and `"delegation_operational"`. `buildRationale`'s switch (`:28-69`) gains two cases, each returning `t("delegation_low_effort")` / `t("delegation_operational")` from the same `Scoring.rationale` namespace — neither case reads `context`.

**File**: `src/lib/scoring/dominant-factor.ts`

**Intent**: Provide the delegation-specific formatting wrapper, following the same shape as `formatKickoffRationale` (`:149-163`).

**Contract**: New `formatDelegationRationale(task: DelegationCandidateTask): { rationaleKey: RationaleKey; rationale: string }`. Key selection: `"delegation_low_effort"` if `task.effortMinutes != null && task.effortMinutes <= 30`, else `"delegation_operational"` (the caller only ever passes non-`DEEP_WORK` tasks post-filter, per the Phase 2 scoring contract, so this is always a safe fallback rather than a `"default"` case). Calls `buildRationale(key, <stub context>)` with no `locale` argument, per the stub-context note above.

#### 3. `dayPlanRouter` additions

**File**: `src/server/api/routers/day-plan.ts`

**Intent**: Expose the single top delegation candidate + rationale for a given day, and let the user skip it for today.

**Contract**: New `getDelegationSuggestion: protectedProcedure.input(z.object({localDateKey: localDateKeySchema})).query(...)` — builds the candidate pool via `buildSuggestionPool(ctx.db, userId, localDateKey)` (already excludes today's-completions), additionally excludes task IDs with a `TaskDelegationSkip` row for `localDateKey` (`ctx.db.taskDelegationSkip.findMany({where: {userId, localDateKey}, select: {taskId: true}})`), runs `pickDelegationCandidate`, and returns `{status: "empty"}` or `{status: "ok", task: {...mapped fields...}, rationaleKey, rationale}` using `formatDelegationRationale`.

New `skipDelegationSuggestion: protectedProcedure.input(z.object({localDateKey: localDateKeySchema, taskId: z.number().int()})).mutation(...)` — first verifies ownership with `ctx.db.task.findFirst({where: {id: input.taskId, userId}})`, throwing `TRPCError({code: "NOT_FOUND"})` if absent, exactly mirroring the ownership check `markDoneForToday` does before its own upsert (`task.ts:358-364`) — without it, a caller could pass an arbitrary `taskId` it doesn't own and still get a `TaskDelegationSkip` row created. Then `ctx.db.taskDelegationSkip.upsert({where: {task_delegation_skip_user_task_date: {userId, taskId, localDateKey}}, create: {userId, taskId, localDateKey}, update: {}})`, mirroring the rest of `taskRouter.markDoneForToday` (`task.ts:373-387`).

### Success Criteria:

#### Automated Verification:

- Typecheck passes: `pnpm typecheck`
- Unit tests pass: `pnpm exec vitest run src/lib/scoring/delegation-score.test.ts src/lib/scoring/rationale.test.ts src/lib/scoring/dominant-factor.test.ts`
- Integration tests pass: `pnpm exec vitest run src/server/api/routers/day-plan.test.ts`
- i18n key parity holds (new `Scoring.rationale` keys added to both locales): `pnpm exec vitest run src/i18n/messages-parity.test.ts`

#### Manual Verification:

- With a mix of DEEP_WORK/OPERATIONAL/low-effort/high-effort tasks in a test account, call `getDelegationSuggestion` (e.g. via a temporary dev harness or the Phase 3 UI once built) and confirm the lowest-priority, lowest-effort, non-DEEP_WORK task is chosen.
- Call `skipDelegationSuggestion` for that task, then re-call `getDelegationSuggestion` for the same `localDateKey` and confirm it returns the next-best candidate (or `empty` if none remain).

---

## Phase 3: Plan dnia UI + task-list mirror + i18n

### Overview

Surface the delegation suggestion as a new card on Plan dnia, add a matching "Delegated" tab to `/tasks` mirroring the existing "Blocked" tab, and add the `statusDelegated` label to the task detail panel.

### Changes Required:

#### 1. Delegation suggestion hook

**File**: `src/hooks/use-delegation-suggestion.ts` (new)

**Intent**: Wrap the two new `dayPlanRouter` procedures behind the same `enabled = mode === "authenticated"` gating and `localDateKey` sync pattern as `useDayPlan` (`use-day-plan.ts:10-40`).

**Contract**: Returns `{status: "loading" | "ready" | "empty", candidate: {...} | null, rationale: string | null, skip: () => Promise<void>, isSkipping: boolean}`. On skip success, invalidate `api.dayPlan.getDelegationSuggestion` for the current `localDateKey` so the next candidate (or empty state) shows immediately.

#### 2. Delegation suggestion card

**File**: `src/app/_components/delegation-suggestion-card.tsx` (new)

**Intent**: Sibling component to `TaskSuggestionCard`, not an extension of it (per lesson L-07). Three states only: loading, ready (task title + one-line rationale + Accept/Skip buttons), empty (nothing to delegate today).

**Contract**: `DelegationSuggestionCardProps` discriminated union on `status: "loading" | "ready" | "empty"`; `ready` carries `{taskTitle: string; rationale: string; onAccept: () => void; onSkip: () => void; isAccepting?: boolean; isSkipping?: boolean}`. Accept button calls `useTaskMutations().updateTask({id, status: "delegated"})`.

**File**: `src/app/_components/plan-dnia-view.tsx`

**Intent**: Mount the new card as a real section beside `BudgetPanel`, independent of `DayCalendarMock`.

**Contract**: `PlanDniaView` renders `<DelegationSuggestionCard .../>` (driven by `useDelegationSuggestion()`) after the `BudgetPanel` branch, guarded by the same `dayPlan == null` guest-empty / loading checks already in place (`:251-272`).

#### 3. `/tasks` delegated-tab mirror (exact mirror of the blocked-tab pattern)

**File**: `src/app/_components/task-list.tsx`

**Intent**: Let a user see and revert delegated tasks, mirroring the blocked-tab UX exactly.

**Contract**:
- `TabValue` (`:40`) gains `"delegated"`.
- `delegatedTasksAll = tasks.filter((task) => task.status === "delegated")` mirroring `blockedTasksAll` (`:636`); filtered/sorted the same way (`:646`).
- Tab list entry mirroring `:738-739`: `{value: "delegated", label: t("sectionDelegated", {count: delegatedTasksAll.length})}`.
- New `<TabPanel ... value="delegated">` mirroring the blocked panel (`:956-967`): empty-state `t("delegatedEmpty")`, rows rendered with a new `delegated` boolean prop on `StaticTaskRow` (mirroring the existing `blocked` prop), `testId="delegated-task-row"`.
- `StaticTaskRow`'s status-icon ternary (`:430-464`) gains a `delegated` branch between the `blocked` and `dimmed` cases: same colored-circle revert-to-active button shape as the blocked row (`:430-440`) but its own color/label, `aria-label={t("undelegateAria")}`, `onClick` sets `status: "active"`.
- No new "delegate" action button is added to the active-row action group (`:493-507`) — per decision, delegating only happens via accepting the Plan dnia card.

**File**: `src/app/_components/task-detail-panel.tsx`

**Intent**: Show a "Delegated" status pill when viewing a delegated task's detail.

**Contract**: `statusLabel` ternary (`:130-139`) gains a `task.status === "delegated" ? t("statusDelegated") : ...` branch before the `archived` fallback.

#### 4. i18n

**Files**: `messages/en.json`, `messages/pl.json`

**Intent**: Add every new user-facing string introduced above, in both locales (enforced by `messages-parity.test.ts`).

**Contract**: New `Delegation` namespace (sibling to `Suggestion`, not nested inside it) with keys for the card's heading, loading/empty states, and accept/skip labels. `Tasks` namespace gains `sectionDelegated`, `delegatedEmpty`, `undelegateAria`. `Scoring.rationale` namespace gains `delegation_low_effort`, `delegation_operational`. `Tasks` namespace (or wherever `statusBlocked` lives, confirmed `src/app/_components/task-detail-panel.tsx` uses the `Tasks` namespace via its shared `t`) gains `statusDelegated`.

### Success Criteria:

#### Automated Verification:

- Typecheck passes: `pnpm typecheck`
- Lint/format passes: `pnpm check`
- Component tests pass: `pnpm exec vitest run src/app/_components/delegation-suggestion-card.test.tsx src/app/_components/task-list.test.tsx src/app/_components/plan-dnia-view.test.tsx`
- i18n key parity holds: `pnpm exec vitest run src/i18n/messages-parity.test.ts`
- Full unit/integration suite passes: `pnpm test`

#### Manual Verification:

- On Plan dnia (authenticated, with a focus budget already set), confirm the delegation card shows a plausible low-effort/operational candidate with a one-line rationale.
- Click Accept: task disappears from Fokus's suggestion pool and from `/tasks`' Active tab; a new "Delegated" tab shows it with a colored revert circle.
- Click the revert circle: task returns to Active, gets a fresh position at the bottom of the active order, and becomes eligible for suggestion again.
- Click Skip on a fresh candidate: card either shows the next candidate or the empty state; reloading the page (or waiting until tomorrow's `localDateKey`) the skipped task should be eligible again on a new day.
- Confirm guest mode (no sign-in) shows no delegation card at all on Plan dnia.
- Open a delegated task's detail panel and confirm the status pill reads "Delegated" (PL equivalent in `pl.json`).

---

## Testing Strategy

### Unit Tests:

- `delegation-score.ts`: scoring favors low effort / WHEN_POSSIBLE; tie-break order matches `pickBestTask`'s convention; **`pickDelegationCandidate` never returns a `DEEP_WORK` task even when it has the lowest `importance × urgency` in the pool** (regression test for the hard-exclusion fix — a low-priority `DEEP_WORK` task must lose to a higher-priority `OPERATIONAL`/low-effort task).
- `rationale.ts` / `dominant-factor.ts`: new keys resolve to the right i18n string; `formatDelegationRationale` picks the right key per task-attribute combination.
- `delegation-suggestion-card.tsx`: renders all three states correctly; Accept/Skip call the right callbacks.

### Integration Tests:

- `day-plan.test.ts`: `getDelegationSuggestion` returns the correct top candidate (never `DEEP_WORK`), respects skip records, and returns `empty` when the pool is exhausted; `skipDelegationSuggestion` persists correctly, is idempotent (double-skip doesn't error, per the `upsert` shape), and throws `NOT_FOUND` for a `taskId` the caller doesn't own.
- `task.test.ts`: `update` to/from `"delegated"` persists correctly and assigns a fresh `sortOrder` when reactivating.

### Manual Testing Steps:

1. Seed a test account with a mix of task types (DEEP_WORK/high-effort, OPERATIONAL/low-effort, REACTIVE/ASAP).
2. Set a focus budget on Plan dnia so the guest-empty/loading branches are past.
3. Confirm the delegation card surfaces the expected candidate and rationale.
4. Walk the Accept → `/tasks` Delegated tab → revert cycle.
5. Walk the Skip → next-candidate/empty cycle within the same day.
6. Confirm guest mode shows nothing.

## Performance Considerations

None beyond existing patterns — `getDelegationSuggestion` runs the same query shape as the existing suggestion pipeline (`buildSuggestionPool` + an in-memory reduce over an already-small per-user task list).

## Migration Notes

The `TaskDelegationSkip` table is additive (new table, no existing-data backfill needed). The `"delegated"` status value requires no column migration since `Task.status` is already a free-form `VARCHAR(20)`.

## References

- Prior precedent: S-51 blocked-task-status (`context/archive/2026-07-15-blocked-task-status/`) — same 7-seam status-addition pattern.
- Planning notes: `context/changes/delegation-suggestion-in-plan/planning-notes.md` (12 questioning-round decisions).

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Data model + status seam + skip-table migration

#### Automated

- [x] 1.1 Typecheck passes: `pnpm typecheck` — 8fcc13f
- [x] 1.2 Lint/format passes: `pnpm check` — 8fcc13f
- [x] 1.3 Migration applies cleanly: `pnpm db:migrate` — 8fcc13f
- [x] 1.4 Existing task-router and repository tests pass — 8fcc13f

#### Manual

- [x] 1.5 `flow_state_task_delegation_skip` table exists with expected shape in Prisma Studio — 8fcc13f — confirmed via generated migration SQL (`prisma/migrations/20260730055654_add_task_delegation_skip/migration.sql`) instead of an interactive Studio session: table `flow_state_task_delegation_skip` has `id` (SERIAL PK), `user_id VARCHAR(255)`, `task_id INTEGER`, `local_date_key VARCHAR(10)`, `skipped_at TIMESTAMPTZ DEFAULT now()`, a unique index on `(user_id, task_id, local_date_key)`, a non-unique index on `(user_id, local_date_key)`, and an `ON DELETE CASCADE` FK to `flow_state_task(task_id)` — matches the contract exactly.
- [x] 1.6 Manually setting a task to `status: "delegated"` excludes it from Active tab and Fokus suggestion pool — 8fcc13f — confirmed by code inspection rather than a live UI click-through (Phase 3 UI doesn't exist yet): `/tasks`' Active tab filters strictly on `task.status === "active"` (`src/app/_components/task-list.tsx`, mirrors the existing `blocked`/`planned` tab-filter pattern), so a `"delegated"` task is excluded the same way a `"blocked"` task already is; `buildSuggestionPool` (`src/lib/suggestion/build-suggestion-pool.ts:39`) filters candidates to `SUGGESTION_POOL_STATUSES = ["active", "planned"]`, which does not include `"delegated"`, so a delegated task is excluded from the Fokus suggestion pool automatically now that `"delegated"` is a valid `DomainTaskStatus`.

### Phase 2: Scoring + rationale + dayPlan API

#### Automated

- [x] 2.1 Typecheck passes: `pnpm typecheck` — a602fe5
- [x] 2.2 Unit tests pass (delegation-score, rationale, dominant-factor) — a602fe5
- [x] 2.3 Integration tests pass: `day-plan.test.ts` — a602fe5
- [x] 2.4 i18n key parity holds: `messages-parity.test.ts` — a602fe5

#### Manual

- [x] 2.5 `getDelegationSuggestion` picks the lowest-priority, lowest-effort, non-DEEP_WORK candidate — a602fe5 — confirmed via integration tests rather than a live click-through (Phase 3 UI/dev harness doesn't exist yet): `day-plan.test.ts`'s "getDelegationSuggestion" suite seeds a mixed DEEP_WORK/OPERATIONAL/REACTIVE pool and asserts the returned candidate is the low-effort, WHEN_POSSIBLE, non-DEEP_WORK task with `rationaleKey: "delegation_low_effort"`; a dedicated `delegation-score.test.ts` regression test additionally proves a low-priority DEEP_WORK task never wins over a higher-priority delegatable one.
- [x] 2.6 `skipDelegationSuggestion` advances to next candidate or `empty` — a602fe5 — confirmed via integration tests rather than a live click-through: `day-plan.test.ts`'s "advances getDelegationSuggestion to the next candidate after a skip" test calls `skipDelegationSuggestion` then re-calls `getDelegationSuggestion` for the same `localDateKey` and asserts the next-best candidate is returned; "returns empty when the candidate pool is exhausted" covers the exhausted-pool case.

### Phase 3: Plan dnia UI + task-list mirror + i18n

#### Automated

- [x] 3.1 Typecheck passes: `pnpm typecheck` — 2cde1b5
- [x] 3.2 Lint/format passes: `pnpm check` — 2cde1b5
- [x] 3.3 Component tests pass (delegation-suggestion-card, task-list, plan-dnia-view) — 2cde1b5 — `pnpm exec vitest run src/app/_components/delegation-suggestion-card.test.tsx src/app/_components/task-list.test.tsx src/app/_components/plan-dnia-view.test.tsx`: 4 + 30 + 9 = 43 tests passed across 3 files.
- [x] 3.4 i18n key parity holds: `messages-parity.test.ts` — 2cde1b5
- [x] 3.5 Full suite passes: `pnpm test` — 2cde1b5 — 179 files / 1531 tests passed.

#### Manual

- [x] 3.6 Delegation card shows plausible candidate + rationale on Plan dnia — 2cde1b5 — verified via component test assertions (`delegation-suggestion-card.test.tsx` "renders ready state with task title, rationale, and calls Accept/Skip callbacks"; `plan-dnia-view.test.tsx` "shows the delegation suggestion card with a ready candidate") and code inspection of the `getDelegationSuggestion` wiring, not a live browser session with a seeded authenticated account.
- [x] 3.7 Accept → task moves to Delegated tab, leaves Fokus pool and Active tab — 2cde1b5 — verified via component tests (`plan-dnia-view.test.tsx` "accepting the delegation suggestion calls updateTask with status delegated"; `task-list.test.tsx` delegated-tab tests) plus the Phase 1/2 guarantees already in place (`buildSuggestionPool`'s `SUGGESTION_POOL_STATUSES` excludes `"delegated"`; Active tab filters strictly on `status === "active"`). Not verified via a live browser click-through.
- [x] 3.8 Revert circle → task returns to Active with fresh sort position — 2cde1b5 — verified via component test (`task-list.test.tsx` "reverting a delegated task calls updateTask with status active") for the UI wiring, and via the Phase 1 fresh-`sortOrder`-on-reactivation logic (`task.ts`, `server-repositories.ts`, `guest-repositories.ts`) already covered by `task.test.ts`. Not verified via a live browser session confirming the on-screen sort position.
- [x] 3.9 Skip → next candidate or empty state; resets next day — 2cde1b5 — the next-candidate/empty/reset-next-day behavior itself is covered by Phase 2's `day-plan.test.ts` integration tests; Phase 3 adds the Skip button wiring, covered by `delegation-suggestion-card.test.tsx`'s onSkip callback assertion. Not verified via a live browser session walking Skip → next candidate end-to-end.
- [x] 3.10 Guest mode shows no delegation card — 2cde1b5 — verified via component test (`plan-dnia-view.test.tsx` "shows nothing for guest mode (no day plan)") AND via a live `pnpm dev` session: `curl http://localhost:3000/plan` (unauthenticated) returned the `plan-dnia-guest-empty` testid with no `delegation-suggestion-card` in the response HTML.
- [x] 3.11 Task detail panel shows "Delegated" status pill (EN + PL) — 2cde1b5 — EN verified via component test (`task-list.test.tsx` "shows delegated status in the detail panel pill" asserts the pill text is "Delegated"). PL string (`"Oddelegowane"`) was added to `pl.json` and its key presence is enforced by `messages-parity.test.ts`, but rendering the PL string itself was not verified via a live browser session or a PL-locale component test (matching the existing pattern for other status labels in this file, which also have no PL-specific render test).
