# Planning notes — delegation-suggestion-in-plan (S-47)

Resumption aid for `/10x-plan`. All 12 complexity-scaled questions have been asked and answered (all recommended options chosen). Do NOT re-ask them. Research (Step 2) is essentially complete — go straight to Step 3 (propose phase breakdown) then Step 4 (write plan.md + plan-brief.md).

## Complexity: HIGH (12 questions), all answered with the ⭐ recommended option

## Decisions locked in (from AskUserQuestion rounds)

1. **Delegatability heuristic**: reuse existing task attributes — workType (OPERATIONAL/REACTIVE), low `effortMinutes`, `commitmentHorizon === "WHEN_POSSIBLE"`. No new task attribute/field for "delegatable-ness" itself. Plug into the existing score-task.ts-style pipeline as a new scoring function.
2. **Accept persistence**: new task status `"delegated"` (free-form VARCHAR column, no DB migration for the column itself — mirrors how S-51 added `"blocked"`). This gets it excluded from the Fokus suggestion pool for free (`SUGGESTION_POOL_STATUSES = ["active","planned"]` already excludes anything else).
3. **MCP (S-46) scope**: NO changes to the MCP server this slice. `listTasks` MCP tool (`src/app/api/mcp/mcp-tools.ts:170-176`) just forwards `caller.task.list(input)` with no separate output-schema validation, so a `"delegated"` status value flows through to MCP reads automatically once added to `DomainTaskStatus`, with zero code change needed. Deliberately do NOT add `"delegated"` to `taskStatusZod` in `mcp-tools.ts:104` (the MCP `update_task` write-tool enum) — agents must not be able to set this status themselves; only the app's accept flow can. This is an intentional non-goal, not an oversight — note it explicitly in the plan so a future reviewer doesn't "fix" it.
4. **UI placement**: new real section in `plan-dnia-view.tsx` beside `BudgetPanel`, independent of the `DayCalendarMock`/`ComingSoonPreview` placeholder. Do not touch the calendar mock.
5. **Guest mode**: authenticated only, matching `useDayPlan`'s existing `enabled = mode === "authenticated"` gating. No guest-mode delegation code path.
6. **Revert/un-delegate**: reuse the existing task-edit status-change affordance (S-51 precedent) — NOT a dedicated new button beyond what's needed to reach parity with the blocked-task UX. Concretely: add a `"delegated"` tab to `/tasks` (`task-list.tsx`), mirroring the existing `"blocked"` tab exactly (filter, tab entry, tab panel, count), with the same colored circle "revert to active" row button pattern used for blocked rows (`task-list.tsx:430-440`, `unblockAria`-style label). No new "delegate" button in task-list.tsx — delegating only happens via accepting the Plan dnia card.
7. **Skip semantics**: dismiss for today only (local-day scoped), matching the existing daily-standing "done for today" pattern (`TaskDayCompletion` model + `markDoneForToday`). Needs a new day-scoped join table (e.g. `TaskDelegationSkip`: userId, taskId, localDateKey) mirroring `TaskDayCompletion`'s shape — this DOES need a Prisma migration (new table), unlike the status column reuse in #2.
8. **Candidate count**: single top candidate only (one card, like Fokus's next-task suggestion), not a list.
9. **AI vs human target**: one generic "delegatable" signal; rationale explains why (e.g. low-effort operational task) without forcing an AI/human classification the scorer can't reliably make.
10. **Rationale content**: extend the existing `RationaleKey` union + `buildRationale` switch in `src/lib/scoring/rationale.ts` with new delegation-specific keys (e.g. `delegation_low_effort`, `delegation_operational` — exact naming TBD in plan), reusing the `Scoring.rationale` i18n namespace and the `score → dominant-factor → rationale` pipeline shape from `dominant-factor.ts`. Do not build a separate copy module.
11. **Testing depth**: unit + integration only (Vitest), no new e2e/belt spec — per lessons L-06, this is pure scoring + a status mutation, no wedge/timer/fake-clock involvement.
12. **Priority/MVP scope**: everything above ships as one cohesive slice — nothing deferred to a fast-follow.

## Key research findings (file:line references — already verified, don't re-derive)

**Plan dnia (`src/app/_components/plan-dnia-view.tsx`, 276 lines)**: still mostly a placeholder. `DayCalendarMock` (`:58-91`) is hardcoded, wrapped in `ComingSoonPreview` (`:244-249`). Real content today is only `BudgetPanel` (`:93-230`), driven by `useDayPlan()` (`src/hooks/use-day-plan.ts`, 97 lines) → `dayPlanRouter` (`src/server/api/routers/day-plan.ts`, 139 lines: `getOrCreate`, `setBudget`, `setEnergy`, all `protectedProcedure`). No task list lives on this page today.

**Scoring pipeline** (extend, don't replace):
- `src/lib/scoring/score-task.ts` (151 lines) — `ScoringTask`/`ScoringContext` types (`:3-23`), `TYPE_FIT` table (`:25-29`), `computeEisenhowerBase` (`:31-58`), `scoreTask` (`:60-110`), `pickBestTask` (`:112-150`).
- `src/lib/scoring/dominant-factor.ts` (164 lines) — `getFactorContributions` (`:9-116`) recomputes each multiplicative bonus as an additive "contribution" magnitude tagged with a `RationaleKey`; `getDominantRationaleKey` (`:118-128`); `formatTaskRationale` (`:130-139`); `formatKickoffRationale` (`:149-163`) is the kickoff-specific wrapper pattern — a `formatDelegationRationale` would follow the same wrapper shape.
- `src/lib/scoring/rationale.ts` (69 lines) — `RationaleKey` union (`:5-19`), `buildRationale(key, context, locale)` switch (`:28-69`), i18n via `createNamespaceTranslator("Scoring.rationale", locale)`.
- `src/lib/scoring/rationale-breakdown.ts` (98 lines) — `buildRationaleBreakdown` for the expandable "why" detail; optional to extend for delegation (not decided — default to NOT building a breakdown for v1 unless plan phase decides otherwise, since Linear scope only asks for a one-line rationale).
- `src/lib/scoring/persona-trust-clause.ts` (67 lines) — shows the pattern for composing rationale fragments (`composeSuggestionRationale`), not directly needed but useful precedent if persona context should color the delegation rationale (not required by scope).

**Nearest UI analog**: `src/app/_components/task-suggestion-card.tsx` (358 lines) — `TaskSuggestionCard` with `status: loading|ready|empty|error`, `TaskSuggestionData` type (`:38-49`), `onAccept` (`:216-224`). Has NO skip action today — a delegation card needs skip added, so this is a sibling component (e.g. `delegation-suggestion-card.tsx`), not a prop extension of the existing one (existing one is wired into the Fokus/kickoff flow per lesson L-07, which must not be touched — see below).

**Decision-persistence analog**: `SuggestionDecision` Prisma model (`prisma/schema.prisma:169-188`) + `suggestion.recordDecision` mutation (`src/server/api/routers/suggestion.ts:390-417+`) — accept records `suggestedTaskId === chosenTaskId`. NOT directly reused since decision #2 above uses a plain status change instead (`task.update({status: "delegated"})`), which needs no new mutation at all — the existing `taskRouter.update` already accepts arbitrary status transitions once `"delegated"` is added to its zod enum.

**The "three/six-seam" pattern for adding a new task status value** (verified from S-51 precedent + direct reads — every location that must move together):
1. `src/lib/data-mode/types.ts:26-31` — `DomainTaskStatus` union → add `"delegated"`.
2. `src/lib/data-mode/types.ts:110` — `TaskRepository.update` input status union → add `"delegated"`.
3. `src/lib/persistence/prisma/task-mapper.ts:9-15` — `DOMAIN_TASK_STATUSES` allow-list (mapper throws in non-prod on unknown DB values) → add `"delegated"`.
4. `src/lib/guest/schema.ts:16` — `guestTaskSchema.status` Zod enum → add `"delegated"`.
5. `src/server/api/routers/task.ts:142-144` — `update` mutation's `status` Zod enum → add `"delegated"`. Also check the `becomingActive`/`wasCompletedOrPlanned`-style transition logic here (guest mirror is `guest-repositories.ts:242-253`, see below) for whether re-activating a delegated task needs the same "assign new sortOrder" treatment as blocked/completed/planned → yes, mirror it.
6. `src/lib/repositories/server-repositories.ts:38` — `UpdateTaskInput.status` union type → add `"delegated"`.
7. `src/lib/repositories/guest-repositories.ts:242-253` — `wasCompletedOrPlanned` boolean (currently checks `completed|planned|blocked`) → add `|| task.status === "delegated"` so reactivating a delegated task gets a fresh `sortOrder` like unblocking does.
8. **Deliberately EXCLUDED**: `src/app/api/mcp/mcp-tools.ts:104` `taskStatusZod` (MCP write-tool enum) — do NOT add `"delegated"` here (see decision #3 above).

**`/tasks` UI mirror of the blocked-tab pattern** (`src/app/_components/task-list.tsx`):
- `TabValue` type (`:40`) — currently `"active" | "planned" | "completed" | "blocked"` → add `"delegated"`.
- Filter arrays: `blockedTasksAll` (`:636`) pattern → add `delegatedTasksAll`.
- Tab list entry (`:738-739`, `sectionBlocked`/count) → mirror for `sectionDelegated`.
- Tab panel (`:956-967`, `blocked-task-row` testid, `blockedEmpty` copy) → mirror for delegated.
- Row revert button (`:430-440`, amber circle, `unblockAria` label, sets `status: "active"`) → mirror with its own color/label (e.g. `undelegateAria`) for delegated rows.
- **No new "delegate" action button** in the normal active-task row actions (`:493-506` is the existing block button) — delegating only happens by accepting the Plan dnia card, per decision #6.
- `src/app/_components/task-detail-panel.tsx:130-139` — `statusLabel` ternary chain → add a `"delegated"` branch (`t("statusDelegated")`).

**i18n**: flat `messages/en.json` + `messages/pl.json` (not per-route folders), checked via `messages-parity.test.ts` which presumably enforces key parity between locales — any new key added to one must be added to the other. Existing relevant namespaces: `Scoring.rationale` (14 keys, e.g. `energy_deep`, `fatigue`, `default`), `PlanDnia` (18 keys, e.g. `budgetHeading`, `calendarComingSoon`), `Suggestion` (18 keys, used by `task-suggestion-card.tsx` — a new sibling namespace, e.g. `Delegation`, is likely cleaner than overloading `Suggestion`), `TaskList`-equivalent namespace backing `task-list.tsx` (`sectionBlocked`, `blockedEmpty`, `unblockAria`, `blockAria`, `deleteAria` etc. — exact namespace name not yet confirmed, check when writing the plan).

**Skip-for-today persistence**: needs a new Prisma model mirroring `TaskDayCompletion` (`prisma/schema.prisma` — search `model TaskDayCompletion` for exact shape: `userId`, `taskId`, `localDateKey`, `completedAt`) — e.g. `TaskDelegationSkip { userId, taskId, localDateKey, skippedAt }` with a unique constraint on `(userId, taskId, localDateKey)`. This is the one genuine schema migration needed (`pnpm db:migrate`, never hand-write SQL) — the status column itself needs no migration since `Task.status` is already a free-form `String @db.VarChar(20)`.

**Candidate pool source**: should reuse the same active/planned + not-done-today filter as `src/lib/suggestion/build-suggestion-pool.ts` (`SUGGESTION_POOL_STATUSES = ["active","planned"]`, `:39`), additionally excluding tasks with a `TaskDelegationSkip` row for today (mirrors `getDoneTodayTaskIds` pattern, `:27-37`).

**New tRPC surface needed**: likely one new query on `dayPlanRouter` (e.g. `dayPlan.getDelegationSuggestion`, parallel to `getOrCreate`) returning the single top-scoring delegation candidate + rationale for a `localDateKey`, plus a mutation for skip (writes `TaskDelegationSkip`). Accept does NOT need a new mutation — it's `taskRouter.update({id, status: "delegated"})` via the existing `useTaskMutations`-style hook (verify exact hook name used by `/tasks` and reuse it, or call `api.task.update` directly from the new Plan dnia section).

**Lesson L-07 guardrail** (`context/foundation/lessons.md:115-126`): next-task suggestion UI must ONLY surface via the `FocusReady` star on Fokus — this delegation card is a *different* suggestion concept on a *different* page (Plan dnia) and must not be confused with or piggyback on that star/popup. Keep it a fully separate component/surface; do not extend `task-suggestion-card.tsx` or the kickoff pipeline for this.

## Not yet done when this was paused

- Was reading `task-detail-panel.tsx` status pill (confirmed the ternary at `:130-139` needing a `"delegated"` branch) — research is essentially complete at this point.
- **Next step on resume**: Step 3 — present the proposed phase breakdown to the user (e.g. Phase 1: data model + status seam + skip-table migration; Phase 2: scoring/rationale extension + new dayPlan query/mutation; Phase 3: Plan dnia UI card + task-list.tsx delegated tab/revert + i18n) and get phase-breakdown approval, then write `plan.md` + `plan-brief.md` per the template (Step 4/4.5), update `change.md` status to `planned`.
