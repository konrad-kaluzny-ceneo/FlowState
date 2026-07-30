---
change_id: delegation-suggestion-in-plan
reviewed: plan.md
review_date: 2026-07-29
verdict: APPROVED (fixed in place)
---

# Plan Review: delegation-suggestion-in-plan (S-47)

## Method

Read `plan-brief.md`, `planning-notes.md` (12-question round, all decisions locked), `plan.md`, `change.md`, `context/foundation/lessons.md`, `AGENTS.md`, the roadmap entry (S-47, Stream U) and PRD (§Integrations / §Non-Goals MCP amendment) as priors. Then independently verified the plan's factual claims against the actual codebase — every cited `file:line` reference (7-seam status pattern, `TaskDayCompletion` model shape, `rationale.ts`/`dominant-factor.ts` structure, `build-suggestion-pool.ts`, `task-list.tsx` blocked-tab pattern, `task-detail-panel.tsx` status ternary, `use-task-mutations.ts`) was read directly and cross-checked — rather than trusting the plan's self-report. No drift from PRD/roadmap intent was found: S-47 is exactly what the roadmap (Stream U, `S-46 → S-47`) and PRD's MCP-integration amendment describe, and the plan's own scope table matches the 12 locked planning decisions verbatim.

## Findings

### WARNING 1 — Delegation scoring formula let low-priority `DEEP_WORK` tasks win (FIXED)

`scoreDelegationCandidate`'s original composition used a soft `×1.3` multiplier for `workType !== "DEEP_WORK"` combined with `÷ (importance × urgency)`. Because the divisor swings 1×–9× while the combined delegatability bonus (`workType` × `effortMinutes` × `commitmentHorizon`) only swings up to ~1.8×, a low-priority `DEEP_WORK` task (e.g. importance=1, urgency=1, score=1.0) would out-score a genuinely delegatable `OPERATIONAL`/low-effort/`WHEN_POSSIBLE` task with only slightly higher priority (e.g. importance=2, urgency=2, score≈0.45). This contradicts:
- the plan's own Phase 2 manual-verification claim ("confirm the lowest-priority, lowest-effort, **non-DEEP_WORK** task is chosen"),
- the product's core wedge value (protecting deep work) — `TYPE_FIT` in `score-task.ts:26` already treats `DEEP_WORK` as the highest-value work type when `FOCUSED`, so surfacing it as a delegation suggestion undermines the app's differentiator.

**Fix applied**: `pickDelegationCandidate` now hard-filters out any `workType === "DEEP_WORK"` task before scoring/reducing, rather than merely down-weighting it. Added a note to Critical Implementation Details explaining why (so a future editor doesn't revert it to a "simpler" soft multiplier), updated the Phase 2 contract for `delegation-score.ts` and `formatDelegationRationale` (the `"default"` rationale branch is now unreachable since the caller only ever sees non-`DEEP_WORK` tasks), and added an explicit regression-test bullet to the Testing Strategy.

### WARNING 2 — `skipDelegationSuggestion` had no ownership check (FIXED)

The original contract for the new `skipDelegationSuggestion` mutation went straight to `taskDelegationSkip.upsert(...)` using a client-supplied `taskId`, without first verifying the task belongs to the caller. This deviates from the router's own established precedent: `markDoneForToday` (`task.ts:358-364`) does `ctx.db.task.findFirst({where: {id, userId, status: "active"}})` and throws `NOT_FOUND` before mutating. Without the same check, a user could pass an arbitrary `taskId` (including one they don't own) and get a `TaskDelegationSkip` row created — not a data leak (the row is scoped to their own `userId`, and `getDelegationSuggestion` already filters candidates by `userId`), but an inconsistency with the codebase's own pattern for taskId-taking mutations, and needless attack surface.

**Fix applied**: Added the ownership check (`ctx.db.task.findFirst({where: {id: input.taskId, userId}})` → `NOT_FOUND` if absent) to the `skipDelegationSuggestion` contract, mirroring `markDoneForToday` exactly, and added a corresponding integration-test bullet.

### WARNING 3 — Internal inconsistency: `formatDelegationRationale`'s declared signature didn't match its described call (FIXED)

Phase 2's contract declared `formatDelegationRationale(task: DelegationCandidateTask): {...}` (no `locale` parameter) but the same sentence said it "Calls `buildRationale(key, <stub context>, locale)`" — `locale` isn't in scope for a function that only takes `task`. This would have blocked or confused implementation. Investigated further: `formatTaskRationale`/`formatKickoffRationale` (`dominant-factor.ts:137,161`) and their callers in `suggestion.ts:258,359` never thread a `locale` either — server-computed rationale text is always English regardless of user locale, a pre-existing, codebase-wide gap that predates this slice and is out of scope to fix here (fixing it would require touching the unrelated Fokus/kickoff pipeline too).

**Fix applied**: Clarified the contract — `formatDelegationRationale` takes no `locale` param and calls `buildRationale(key, stubContext)` with `locale` defaulted to `"en"`, exactly matching the existing pattern. Documented explicitly in Critical Implementation Details as a known, out-of-scope, pre-existing gap so a future reviewer doesn't try to "fix" it inside this slice (same treatment as the already-documented MCP-exclusion and stub-context notes).

## Not flagged (considered and accepted)

- **Rationale text always renders in English server-side** (see Warning 3) — pre-existing pattern-wide behavior, not introduced by this plan; correctly scoped out.
- **`buildSuggestionPool` includes `"planned"` tasks in the delegation candidate pool**, not just `"active"` — reasonable; a planned (future) task can legitimately be delegatable too, and this reuses an existing, tested function rather than forking a new one.
- **No optimistic-locking / race handling** between `getDelegationSuggestion` and `taskRouter.update({status:"delegated"})` — consistent with how every other status-changing mutation in this codebase already behaves (e.g. blocking); not a new risk introduced by this slice.
- **Delegation-score multiplier tuning** (exact `×1.2`/`×1.15` values) — plan brief already flags this as an accepted first-pass heuristic risk with no tuning UI in v1; reasonable to ship and tune later.
- **Exact mount point of `<DelegationSuggestionCard>` relative to the `dayPlan` ternary in `plan-dnia-view.tsx`** is described at the intent level, not fully pinned to a single line ("after the BudgetPanel branch, guarded by the same guest-empty/loading checks"). This is ordinary implementer discretion consistent with the plan's own "describe intent, not implementation" convention — not a defect.
- Verified no lesson-file conflict: L-07 (next-task suggestion only via `FocusReady` star) is explicitly respected — the plan treats the delegation card as a fully separate sibling surface, never touching `task-suggestion-card.tsx` or the kickoff pipeline. L-06 (e2e scope) is respected — unit/integration only, no new e2e. No wedge/timer-hub files are touched, so `pnpm change-impact` guidance doesn't apply.

## Verdict

**APPROVED** — all findings were WARNING-level (scoring correctness, missing ownership check, an internal signature/prose inconsistency), all three were fixed directly in `plan.md`. No CRITICAL findings. No drift from PRD/roadmap intent. File:line references throughout the plan were independently verified against the current codebase and found accurate. No unresolved items requiring human escalation.

**Confidence in plan quality after fixes: 90/100.** The remaining 10 points reflect inherent first-pass-heuristic risk in the delegation scoring weights (explicitly and appropriately flagged as an open risk by the plan itself, not a defect) and the plan's justified use of implementer discretion for a few UI-mount-point details.
