<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: S-26 Manual Task Priority Order

- **Plan**: context/changes/task-manual-priority-order/plan.md
- **Scope**: Phases 1–5 (all completed)
- **Date**: 2026-06-09
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

## Automated Verification (re-run 2026-06-09)

| Command | Result |
|---------|--------|
| `pnpm test` | PASS — 59 files, 386 tests |
| `pnpm check` | PASS — 224 files, no fixes |
| `pnpm typecheck` | PASS |

Plan-recorded e2e gates (5.2–5.3) were green at commit `59f0488`; not re-run in this review session.

## Findings

### F1 — Manual verification checklist still open

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: context/changes/task-manual-priority-order/plan.md (Progress §1.5, §2.6, §3.6, §4.6, §5.6–5.10)
- **Detail**: All automated Progress items are `[x]` with commit SHAs. Ten manual items remain `[ ]` (Prisma spot-check, tRPC reorder smoke, scorer tie-break UX, DnD latency, cycle-lock disable, reload persistence, guest merge order). None are falsely marked complete — human QA is genuinely pending before ship.
- **Fix**: Run the plan's Manual Testing Steps (§Manual Testing Steps) and tick Progress manual rows before merge to production.
- **Decision**: PENDING

### F2 — Benign supporting changes outside plan file list

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/lib/guest/schema.ts, src/app/_actions/import-guest-snapshot.ts, src/server/api/routers/guest.ts, src/lib/data-mode/data-mode-context.tsx
- **Detail**: Plan listed `import-guest-snapshot.ts` and `merge-copy.ts` but not the `normalizeGuestSnapshot()` helper wired through guest import action/router, nor the test-provider `reorder` mock in `data-mode-context.tsx`. Changes are tightly coupled to legacy guest snapshot `sortOrder` defaults and dual data-mode parity — not scope creep.
- **Fix**: No code change required; optional plan addendum if future reviews need the helper on record.
- **Decision**: PENDING

## Plan Drift Summary

| Area | Verdict | Notes |
|------|---------|-------|
| Prisma `sortOrder` + backfill migration | MATCH | Dense per-user backfill by `createdAt asc`; composite index present |
| `task.list` / `create` / `update` / `reorder` | MATCH | orderBy, tail assignment, revert tail, permutation validation + IDOR |
| `pickBestTask` tie-break chain | MATCH | score → sortOrder → weight → createdAt |
| Suggestion router task loads | MATCH | orderBy + sortOrder mapped into scorer |
| `useTaskMutations` optimistic reorder | MATCH | S-09 lifecycle; guest delegation; `isMutating` includes reorder |
| Guest repository reorder + list sort | MATCH | Dense reindex; active-only validation |
| DnD UI (`task-list.tsx`) | MATCH | Handle-only drag; PointerSensor 8px; disabled when `cycleLocked \|\| isMutating` |
| Guest merge sortOrder offset | MATCH | `baseOffset + relativeIndex`; preview sorts by sortOrder |
| Tests + e2e | MATCH | Unit/integration/e2e coverage per plan; DELIBERATE-BREAK entry present |

## Fixes Applied During Review

None — zero CRITICAL findings.
