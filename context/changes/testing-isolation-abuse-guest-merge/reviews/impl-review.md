<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Phase 3 Test Rollout — Isolation, Abuse & Guest Merge

- **Plan**: context/changes/testing-isolation-abuse-guest-merge/plan.md
- **Scope**: All 4 phases (Phases 1–4 complete per Progress; manual 4.3 pending)
- **Date**: 2026-06-05
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 4 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | FAIL |

## Findings

### F1 — Progress marks `pnpm check` passed but repo check fails

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: context/changes/testing-isolation-abuse-guest-merge/plan.md:342-367
- **Detail**: All Progress items 1.1, 2.1, 3.1, 4.1 mark `pnpm check` as `[x]`. Running `pnpm check` exits 1 (16 errors repo-wide). Changed files also fail format: `cycle.test.ts`, `session.test.ts`. `pnpm typecheck` and `pnpm test` (198 tests) pass.
- **Fix**: Run `pnpm exec biome check --write` on changed test files (at minimum `cycle.test.ts`, `session.test.ts`); re-run full `pnpm check`. Uncheck or revert Progress checkboxes until check actually passes, or document pre-existing failures separately if team accepts scoped verification only.
  - Strength: Aligns Progress with quality gates in test-plan §5.
  - Tradeoff: Full-repo `pnpm check` may surface unrelated pre-existing errors (e.g. `.cursor/settings.json`, `auth/server.ts`).
  - Confidence: HIGH — verified in this review session.
  - Blind spot: CI may not run `pnpm check` yet (Phase 4 gate not wired).
- **Decision**: FIXED — formatted changed test files; documented full-repo vs scoped check in Progress note

### F2 — Biome format drift in new cycle/session tests

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/server/api/routers/cycle.test.ts:114; src/server/api/routers/session.test.ts:216
- **Detail**: Biome formatter would rewrite conditional wrapping and long `await` line introduced in Phase 2 session/cycle IDOR tests. Contributes to F1 failure on scoped check.
- **Fix**: Run `pnpm exec biome check --write src/server/api/routers/cycle.test.ts src/server/api/routers/session.test.ts`.
- **Decision**: FIXED — resolved with F1 biome --write

### F3 — `change.md` status still `implementing`

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: context/changes/testing-isolation-abuse-guest-merge/change.md:4
- **Detail**: Plan Phase 4 item 5 expects `status: implemented` and `updated` stamp on ship. Progress marks all automated phases complete; test-plan §3 Phase 3 row is `complete`. Identity file still reads `implementing`.
- **Fix**: Set `status: implemented` and refresh `updated: 2026-06-05` in `change.md`.
- **Decision**: FIXED

### F4 — Test implementation uncommitted (docs-only commit on branch)

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: git HEAD (8b6cfa4) vs working tree
- **Detail**: Commit `8b6cfa4` adds plan/research/change docs only. All test file changes (+677/−437 across 7 files) and `test-plan.md` updates are unstaged in working tree. Ship criteria assume landed work.
- **Fix**: Stage and commit test + cookbook changes with message referencing Phase 3 rollout; append commit sha to Progress items per plan convention.
  - Strength: Makes review evidence durable; enables PR/merge.
  - Tradeoff: Should fix F1/F2 before commit to avoid landing failing format.
  - Confidence: HIGH — `git diff --stat HEAD` confirms uncommitted scope.
  - Blind spot: None significant.
- **Decision**: FIXED — tests landed in 8ef7de4; review follow-ups in 0ee5730

### F5 — `change.md` notes still mention post-integration guest e2e

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: context/changes/testing-isolation-abuse-guest-merge/change.md:16
- **Detail**: Notes say "integration (primary) + one targeted e2e for guest merge after integration passes." Plan and shipped §6.5 explicitly defer guest-merge e2e to a follow-up change. Implementation correctly deferred e2e; identity notes are stale.
- **Fix**: Update Notes to match plan: integration-only in this change; guest-merge e2e deferred to follow-up.
- **Decision**: FIXED

### F6 — Manual cookbook spot-read (4.3) still pending

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/testing-isolation-abuse-guest-merge/plan.md:372
- **Detail**: Progress item 4.3 `- [ ] Cookbook spot-read` unchecked. §6.2, §6.5, §6.6 content appears complete and references concrete test names; spot-read not recorded.
- **Fix**: Contributor spot-reads §6.2/§6.5/§6.6 and checks 4.3, or leave pending if review session counts as spot-read.
- **Decision**: FIXED — spot-read in impl-review; 4.3 checked
