<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Delegation Suggestion in Plan dnia Implementation Plan

- **Plan**: `context/changes/delegation-suggestion-in-plan/plan.md`
- **Scope**: Full plan — Phase 1 of 3, Phase 2 of 3, Phase 3 of 3 (all completed)
- **Date**: 2026-07-30
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning (fixed), 2 observations

## Method

Read `change.md`, `plan.md` (including Key Discoveries / What We're NOT Doing / Critical Implementation Details / Progress), `reviews/plan-review.md`, and `context/foundation/lessons.md` (L-06, L-07) as priors. Diffed `main...features/delegation-suggestion-in-plan` (28 files, ~1850 insertions across 6 commits). Launched two parallel sub-agents — plan-drift detection (verified every file:line contract in Phases 1–3 against actual code) and safety/quality/pattern compliance (security, performance, reliability, data-safety scan plus convention comparison against sibling files) — and independently re-verified the highest-risk contracts myself by reading the actual source: `day-plan.ts`'s `skipDelegationSuggestion` ownership check, `delegation-score.ts`'s DEEP_WORK hard-exclusion, `plan-dnia-view.tsx`'s guest-mode gating, `mcp-tools.ts`'s `taskStatusZod` enum, the full 7-location status seam, the `TaskDelegationSkip` Prisma model/migration, and both locale files' new i18n keys.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS (1 WARNING found and fixed) |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — `getDelegationSuggestion` cache not invalidated after accepting a suggestion (FIXED)

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (Reliability)
- **Location**: `src/app/_components/plan-dnia-view.tsx` (`DelegationSuggestionSection.handleAccept`)
- **Detail**: `skipDelegationSuggestion`'s success path invalidates `utils.dayPlan.getDelegationSuggestion` for the current `localDateKey` (`src/hooks/use-delegation-suggestion.ts:50-54`), but accepting a suggestion (`updateTask({ id, status: "delegated" })`) never did. The query has a 30s `staleTime` (`src/trpc/query-client.ts`) and `refetchOnWindowFocus` isn't disabled, so `DelegationSuggestionCard` kept showing the just-delegated task in a live "ready" state with working Accept/Skip buttons for up to 30s (or until a window-focus refetch) after acceptance. A user could click Skip on an already-delegated task — harmless (just creates a needless `TaskDelegationSkip` row) but confirms the UI was reading stale cache, an asymmetry with the skip path that already gets this right.
- **Fix applied**: `DelegationSuggestionSection` now calls `api.useUtils()` and, after a successful `updateTask` accept, awaits `utils.dayPlan.getDelegationSuggestion.invalidate({ localDateKey: delegation.localDateKey })` — mirroring the skip path exactly. Added a `vi.mock("~/trpc/react", ...)` + assertion to `plan-dnia-view.test.tsx`'s existing accept test confirming the invalidation call fires with the correct `localDateKey`.
- **Verification**: `pnpm exec vitest run src/app/_components/plan-dnia-view.test.tsx` — 9/9 passed. Full suite re-run after the fix: 1531/1531 passed. `pnpm typecheck` and `pnpm check` clean.

### F2 — `DelegationSuggestionCard` has no distinct error state (accepted, not fixed)

- **Severity**: 👁️ OBSERVATION
- **Dimension**: Pattern Consistency
- **Location**: `src/hooks/use-delegation-suggestion.ts:67-72`, `src/app/_components/delegation-suggestion-card.tsx:7-34`
- **Detail**: `useDelegationSuggestion`'s `status` collapses any non-"ok" query result — including a genuine `query.isError` network/server failure — into `"empty"`. The sibling `TaskSuggestionCard` (Fokus kickoff pipeline) has a dedicated error state with a retry affordance; `DelegationSuggestionCard` does not, so a failed fetch looks identical to "nothing to delegate today."
- **Why not fixed**: The plan's Phase 3 contract for `DelegationSuggestionCard` explicitly states "Three states only: loading, ready ..., empty ..." — no error variant is in scope for this slice, and `TaskSuggestionCard`'s richer error/retry UX is a different, unrelated component per lesson L-07 (delegation card is intentionally a separate sibling surface, not an extension). Adding a fourth state here would be scope creep beyond the approved plan contract. Degradation is benign (a calm "nothing to delegate" message, not a crash or stuck state).
- **Decision**: ACCEPTED — flag as a candidate for a future slice if/when delegation-card UX is asked to reach parity with `TaskSuggestionCard`.

### F3 — Silent failure on accept/skip mutation errors (accepted, not fixed)

- **Severity**: 👁️ OBSERVATION
- **Dimension**: Safety & Quality (Reliability)
- **Location**: `src/app/_components/plan-dnia-view.tsx` (`DelegationSuggestionSection`), `src/hooks/use-delegation-suggestion.ts` (`skipMutation`)
- **Detail**: `DelegationSuggestionSection` instantiates its own `useTaskMutations()` and never renders that instance's `error` state; `skipMutation` has no `onError` handler. A failed accept or skip fails silently on Plan dnia — no banner, no retry prompt. Low severity: no data corruption, since nothing is optimistically applied or invalidated on failure, so the UI doesn't lie about state, it just doesn't tell the user something went wrong.
- **Decision**: ACCEPTED — not in the plan's explicit contract; fixing it well requires a UX decision (banner? inline retry? toast?) that should be made deliberately in a follow-up rather than guessed during review triage.

## Verification detail (spot-checks performed directly, not just via sub-agent report)

- **DEEP_WORK hard-exclusion** (`src/lib/scoring/delegation-score.ts:41-51`): `pickDelegationCandidate` filters `tasks.filter((task) => task.workType !== "DEEP_WORK")` *before* any scoring/reduce step, and returns `null` if the filtered pool is empty — there is no path back to a DEEP_WORK task, regardless of score. Confirmed by a dedicated regression test (`delegation-score.test.ts:165-194`, "never returns a DEEP_WORK task even when it has the lowest importance × urgency in the pool") that reproduces exactly the scenario the plan-review WARNING was about (low-priority DEEP_WORK vs. higher-priority delegatable task) and asserts the delegatable task wins.
- **`skipDelegationSuggestion` ownership check** (`src/server/api/routers/day-plan.ts:199-232`): `ctx.db.task.findFirst({ where: { id: input.taskId, userId } })` runs before the upsert and throws `TRPCError({ code: "NOT_FOUND" })` if the task doesn't belong to the caller (or doesn't exist) — same `NOT_FOUND` in both cases, so no existence-of-other-users'-tasks leak. `getDelegationSuggestion` is fully `userId`-scoped via `buildSuggestionPool(ctx.db, userId, ...)` and `taskDelegationSkip.findMany({ where: { userId, localDateKey } })`. `day-plan.test.ts:578-586` has an explicit cross-user isolation test ("throws NOT_FOUND for a taskId the caller doesn't own").
- **Guest mode shows nothing**: `plan-dnia-view.tsx:317` — `{dayPlan != null && !dayPlan.isLoading && <DelegationSuggestionSection />}`. When `dayPlan == null` (guest mode), `DelegationSuggestionSection` — and therefore `useDelegationSuggestion()` and any network call — is never mounted at all, not merely hidden. Also defended in depth: the hook itself gates its query on `enabled = mode === "authenticated"`. Confirmed by `plan-dnia-view.test.tsx` ("shows nothing for guest mode (no day plan)" — asserts both the absent testid and that the hook mock was never called) and, per the plan's own Progress log, a live `pnpm dev` + `curl` check against `/plan` unauthenticated.
- **MCP write-enum exclusion / read-availability**: `src/app/api/mcp/mcp-tools.ts:107` — `taskStatusZod = z.enum(["active", "completed", "planned", "blocked"])`, unchanged, with the intentional-exclusion comment in place; `"delegated"` was never added to the `update_task` write schema. Since `DomainTaskStatus` (read side, `list_tasks`) gained `"delegated"` in Phase 1 with zero MCP code changes required (per the plan's Key Discoveries), a delegated task is readable via `list_tasks` but cannot be set via `update_task` — exactly the intended asymmetry.
- **Status seam (7 locations)**: `src/lib/data-mode/types.ts`, `src/lib/persistence/prisma/task-mapper.ts`, `src/lib/guest/schema.ts`, `src/server/api/routers/task.ts` (status enum + fresh-`sortOrder`-on-reactivation OR-chain), `src/lib/repositories/server-repositories.ts`, `src/lib/repositories/guest-repositories.ts` (`wasCompletedOrPlanned`) — all verified to include `"delegated"` exactly as specified, byte-for-byte matching the plan's contracts.
- **`TaskDelegationSkip` model/migration**: `prisma/schema.prisma:229-241` matches the plan's contract field-for-field (types, `@map` names, unique constraint, index, `onDelete: Cascade`, `@@map`); the generated migration SQL is purely additive (new table + 2 indexes + FK, no ALTER/DROP on existing tables).
- **`/tasks` delegated-tab mirror**: `task-list.tsx`'s delegated tab/row/undelegate-button genuinely mirrors the blocked pattern (own color, own `aria-label`/`testId`, same `onUpdateTask({ status: "active" })` revert action, same `!dimmed && !blocked && !delegated` suppression of active-row actions) — no divergence found.
- **i18n parity**: `messages/en.json` and `messages/pl.json` both carry the new `Delegation` namespace (sibling to `Suggestion`), `Scoring.rationale.delegation_low_effort`/`delegation_operational`, and `Tasks.statusDelegated`/`sectionDelegated`/`delegatedEmpty`/`undelegateAria`, key-for-key, with real Polish translations (not English placeholders). `messages-parity.test.ts` passes.
- **Divide-by-zero**: `scoreDelegationCandidate`'s `÷ (importance × urgency)` cannot divide by zero — `importance`/`urgency` are constrained to `z.number().int().min(1).max(3)` both server-side (`task.ts`) and guest-side (`guest/schema.ts`).

## Automated verification (final run, post-fix)

- `pnpm typecheck` — clean.
- `pnpm check` — clean (6 pre-existing Biome warnings in `src/hooks/use-pomodoro-cycle.test.tsx`, unrelated to this diff, not touched by this slice).
- `pnpm test` — 179 files / 1531 tests passed.

## Manual verification

Reviewed against the plan's Phase 1–3 manual-verification checklist and the Progress section's own notes. All items were either verified via integration/component tests (explicitly and transparently, per the Progress log's own annotations) or a live `pnpm dev` session (guest-mode-shows-nothing check). No rubber-stamped items found — each `[x]` in Progress has either a cited test name/line or an explicit "not verified via live browser session" caveat, which is itself an honest signal rather than a gap to flag.
