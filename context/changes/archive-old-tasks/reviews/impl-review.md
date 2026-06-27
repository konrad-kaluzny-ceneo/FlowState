<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Stale Task Archive

- **Plan**: context/changes/archive-old-tasks/plan.md
- **Scope**: Phases 1–5 of 5 (full plan)
- **Date**: 2026-06-27
- **Verdict**: APPROVED
- **Confidence**: 92/100
- **Findings**: 0 critical, 0 warnings, 1 observation (1 warning fixed during auto-triage)

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Automated Verification

| Command | Result |
|---------|--------|
| `pnpm check` | PASS |
| `pnpm test` | PASS — 1040 tests (135 files) |
| Phase 2 targeted vitest (router/suggestion) | Covered in full suite |
| Phase 3 targeted vitest (guest/hook) | Covered in full suite |
| Phase 4 targeted vitest (component) | Covered in full suite |
| `set CI=true && pnpm test:e2e e2e/archive-old-tasks.spec.ts` | PASS per plan progress (753d42f); tagged `@skip-belt` |

## Plan vs Implementation Summary

All five phases landed as specified:

- **Phase 1**: `archivedAt` migration, domain types, guest schema, import parity — MATCH
- **Phase 2**: Lazy stale sweep in `task.list` / `archiveList`, restore, `deleteArchived`, suggestion + kickoff exclusion — MATCH
- **Phase 3**: Guest repository parity, data-mode wiring, optimistic auth mutations — MATCH
- **Phase 4**: `TaskArchiveView`, inventory entry, dashboard toggle, EN/PL copy — MATCH
- **Phase 5**: E2E scenario + seed helper, quality gates — MATCH (belt promotion intentionally deferred; 5.2 left open)

Benign extras not in plan file list: `src/lib/task/stale-task-archive.ts` (shared predicate extraction), `src/hooks/use-archive-tasks.ts` (archive data hook), PRD/roadmap doc updates for US-05/S-44.

## Findings

### F1 — Guest restore did not refresh touch anchor

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/repositories/guest-repositories.ts:371
- **Detail**: Plan defines restore as a user touch that affects `updatedAt`. Auth path gets this via Prisma `@updatedAt` on `task.update`; guest `restore` cleared `archivedAt` and set `sortOrder` but left the stale `updatedAt ?? createdAt` anchor unchanged. A restored task auto-archived for staleness would disappear from active inventory on the next `list()` sweep.
- **Fix**: Set `updatedAt: new Date()` in guest restore mutation; add regression test `restored stale-archived task stays active after list sweep`.
- **Decision**: FIXED (auto-triage)

### F2 — Manual verification steps still pending

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: plan.md Progress (manual items 1.6–5.9)
- **Detail**: All automated Progress checkboxes are `[x]`; manual items remain `[ ]` as expected for impl-review handoff. No rubber-stamping detected.
- **Decision**: ACKNOWLEDGED — human manual pass still required before archive

## Fixes Applied During Review

| Finding | Action | Commit |
|---------|--------|--------|
| F1 Guest restore `updatedAt` | Code + regression test | `fix(archive-old-tasks): bump guest updatedAt on restore (p5)` |

## Triage Summary

```
Fixed:     F1 (auto-triage)
Skipped:   —
Accepted:  F2 (manual verification deferred to human)
```
