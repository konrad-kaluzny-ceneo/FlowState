<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Fix Cycle End Audio Toggle (B-01)

- **Plan**: `context/changes/fix-cycle-audio-toggle/plan.md`
- **Mode**: Deep
- **Date**: 2026-06-08
- **Verdict**: SOUND (after auto-fixes)
- **Findings**: 1 critical, 4 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

Grounding: 5/5 paths ✓, 4/4 symbols ✓, brief↔plan ✓

Verified paths: `src/hooks/use-cycle-end-audio-preference.ts`, `e2e/quiet-cycle-audio.spec.ts`, `e2e/guest-quiet-cycle-audio.spec.ts`, `src/hooks/use-task-mutations.test.tsx`, `context/foundation/test-plan.md`.

Verified symbols: `beginSuggestionFetch`, `resetSuggestionFetchPriorityForTests`, `cycle-audio-preference-{mode}` test IDs, `api.useUtils()` + `setData` pattern in `use-task-mutations.ts`.

## Findings

### F1 — Hook test file extension mismatch

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — Success Criteria + Progress 1.1
- **Detail**: Phase 1 Changes Required names `use-cycle-end-audio-preference.test.tsx` (matches repo hook-test convention: `use-task-mutations.test.tsx`, `use-pomodoro-cycle.test.tsx`), but Success Criteria and Progress 1.1 referenced `.test.ts` — `/10x-implement` would run a non-existent file.
- **Fix**: Align Success Criteria and Progress 1.1 to `.test.tsx`.
- **Decision**: FIXED — aligned command to `.test.tsx` in Success Criteria and Progress.

### F2 — Guest E2E `beforeEach` seeds muted preference

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 2 — Guest live-toggle spec
- **Detail**: `e2e/guest-quiet-cycle-audio.spec.ts` `beforeEach` always runs `addInitScript` seeding `GUEST_MUTED_KEY` to `"muted"`. Live-toggle test contract said "do not seed" but did not specify how to isolate from parent setup — would assert wrong initial `aria-pressed` state.
- **Fix**: Add nested `test.describe("live toggle (B-01)")` with its own `beforeEach` (no muted seed) and explicit `localStorage.removeItem` before focus.
- **Decision**: FIXED — nested describe + clear-key contract added to Phase 2.

### F3 — `hasInitialSyncRef` not set on guest-merge early return

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: End-State Alignment
- **Location**: Phase 1 — Sync guard refs contract
- **Detail**: Guest-merge branch returns at lines 112-114 without hitting lines 118-119. Plan said "after guest-merge completes" set ref, but contract only detailed the default `setModeState(serverMode)` path — implementer could omit ref on merge exit, allowing re-entry overwrite after merge mutation completes.
- **Fix**: Explicitly require `hasInitialSyncRef.current = true` before guest-merge early `return`.
- **Decision**: FIXED — both reconcile exit paths now specified in Phase 1 contract.

### F4 — Auth reload persistence marked optional in E2E

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: End-State Alignment
- **Location**: Phase 2 — Auth live-toggle spec
- **Detail**: Desired End State #2 and Acceptance Criteria require auth preference to survive reload. Auth live-toggle contract marked reload assertion "Optional" — automated suite could pass while persistence regressed.
- **Fix**: Make Soft-after-reload assertion required in auth live-toggle test (reuse `cycle.getActive` wait from `setAuthMutedPreference`).
- **Decision**: FIXED — persistence step promoted to required contract.

### F5 — `api.useUtils()` ordering not specified for mutation `onSuccess`

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — Mutation onSuccess cache update
- **Detail**: `onSuccess` closure references `utils` from `api.useUtils()`. Repo pattern (`use-task-mutations.ts:98`) declares utils before mutation hook; plan omitted ordering.
- **Fix**: Add explicit `const utils = api.useUtils()` before `useMutation` in contract.
- **Decision**: FIXED — ordering note added with reference pattern.

### F6 — Guest→auth merge lacks automated unit coverage

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1 — Hook unit test contract
- **Detail**: Research flags guest→auth merge as a verify risk; plan covers it via manual step 1.8 only. Acceptable for bug-fix scope given hook unit test already targets the overwrite race; merge path is orthogonal to `hasInitialSyncRef` guard if set on merge exit (F3 fix).
- **Fix**: None required for this change — manual smoke 1.8 is sufficient.
- **Decision**: ACCEPTED — manual coverage adequate for B-01 scope.

## Triage Summary (decision proxy)

| Finding | Decision |
|---------|----------|
| F1 | FIXED |
| F2 | FIXED |
| F3 | FIXED |
| F4 | FIXED |
| F5 | FIXED |
| F6 | ACCEPTED |

**Verdict after fixes:** SOUND — no open CRITICAL findings.
