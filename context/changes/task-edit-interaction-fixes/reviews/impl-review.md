<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Task Edit Interaction Fixes

- **Plan**: context/changes/task-edit-interaction-fixes/plan.md
- **Scope**: Full plan (Phases 1–4)
- **Date**: 2026-07-04
- **Verdict**: APPROVED (post-triage)
- **Findings**: 0 critical, 4 warnings, 3 observations — 5 fixed, 2 skipped

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS ✅ |
| Scope Discipline | PASS ✅ |
| Safety & Quality | PASS ✅ |
| Architecture | PASS ✅ |
| Pattern Consistency | PASS ✅ |
| Success Criteria | PASS ✅ |

## Findings

### F1 — Phase 1 oracle differs from plan text (intentional product correction)

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Plan Adherence
- **Location**: src/lib/task/persona-presets.ts:176-229
- **Detail**: Plan specifies `getTaskBadgeDisplayMode` returns `"persona"` for any valid catalog `personaPresetId` regardless of attribute divergence. Implementation uses `findMatchingPersonaPresetId` / `resolveTaskPersonaBadge` — tag appears only when live settings match a preset bundle; diverged stored id → `"custom-detail"`. User confirmed this behavior during implementation (“tag assigned to specific settings”). Code and tests match the corrected product rule; plan text, Critical Implementation Details, Desired End State, and manual step 1.4 still describe the superseded contract.
- **Fix A ⭐ Recommended**: Add a plan addendum (or update Phase 1 contract) documenting attribute-match oracle as the binding D-09 rule; note 2026-07-04 product correction superseding the 2026-07-03 “always show stored id” draft.
  - Strength: Preserves shipped behavior user approved; aligns plan with code for archive/review.
  - Tradeoff: Plan becomes a moving target for stakeholders who read the original draft.
  - Confidence: HIGH — user explicitly validated the attribute-match UX.
  - Blind spot: Stakeholders who only read the original plan text.
- **Fix B**: Revert to plan’s id-only oracle (always show stored preset label).
  - Strength: Matches written plan and D-09 register wording (“Gaszenie after edit”).
  - Tradeoff: Contradicts user-confirmed product rule from implementation session.
  - Confidence: LOW — user rejected this behavior.
  - Blind spot: None significant.
- **Decision**: FIXED via Fix A — plan addendum + Phase 1 contract updated

### F2 — Manual step 1.4 marked done with outdated expectation

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/task-edit-interaction-fixes/plan.md:311
- **Detail**: Progress row 1.4 reads “edit urgency → badge still Gaszenie” and is marked `[x]` with SHA `0b068a8`. Verified behavior (user OK): changing urgency away from Gaszenie settings removes/changes the tag. Checkbox evidence does not match the step title — possible rubber-stamp against original plan wording rather than corrected UX.
- **Decision**: FIXED — Progress 1.4 reworded; note in change.md — Suggestion trust clause still uses stored `personaPresetId`

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architecture
- **Location**: src/lib/scoring/persona-trust-clause.ts:20-42; src/server/api/routers/suggestion.ts (caller)
- **Detail**: `TaskBadges` and `pomodoro-dashboard` suggestion label use `resolveTaskPersonaBadge` (attribute-match). `buildPersonaTrustClause` still labels from raw stored `personaPresetId` without checking live attributes. A task with diverged attrs can show “Custom” in the list but “Gaszenie — …” in suggestion rationale.
- **Fix A ⭐ Recommended**: Pass resolved preset id from `resolveTaskPersonaBadge` into suggestion scoring (or extend `buildPersonaTrustClause` to accept task attrs).
  - Strength: Single display oracle across list, dashboard coach, and suggestions.
  - Tradeoff: Touches suggestion router — small blast radius, needs a unit test.
  - Confidence: MED — caller shape needs a quick read in `suggestion.ts`.
  - Blind spot: Haven’t verified all suggestion code paths.
- **Fix B**: Document as intentional — trust copy follows persisted identity, badge follows live settings.
  - Strength: No code change.
  - Tradeoff: User-visible inconsistency between surfaces.
  - Confidence: LOW — likely confusing in practice.
  - Blind spot: Product may want trust tied to stored intent.
- **Decision**: FIXED via Fix A — `buildPersonaTrustClauseForTask` + suggestion router — Blur deferral cancel limited to SegmentedControl buttons

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/app/_components/task-list.tsx:801-809
- **Detail**: `handleEditPanelPointerDownCapture` cancels pending blur timer only when target is `HTMLButtonElement` with `aria-pressed`. Effort input, daily-standing checkbox, and clear-effort button do not cancel. On Safari/touch (`relatedTarget: null`), blur-from-title → scheduled commit may fire before focus moves to effort field. Phase 3 test covers horizon chips only.
- **Fix**: Cancel pending blur on any `pointerdown` inside the edit panel (or add `mousedown preventDefault` on effort input per archived blur-save pattern).
- **Decision**: FIXED — cancel blur timer on any in-panel pointerdown + unmount cleanup — Phase 4 belt gate lacks commit SHA

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/task-edit-interaction-fixes/plan.md:343-345
- **Detail**: Progress rows 4.1–4.3 marked complete; 4.3 has no ` — <sha>` suffix. E2E belt passed in implementation session but is not re-attested in review run (only `pnpm check` + `pnpm test` re-run here).
- **Fix**: Re-run `set CI=true && pnpm test:e2e:belt` before merge if belt is a hard gate; optional SHA on 4.3 if a verification-only commit is authored.
- **Decision**: SKIPPED — belt passed in impl session; re-run optional before merge — focus/plan preset collision with `ignoreEffort`

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: src/lib/task/persona-presets.ts:190-194
- **Detail**: `focus` and `plan` share identical non-effort attributes; `findMatchingPersonaPresetId` returns first catalog match (`focus`) when attrs align. Edge case only; unlikely in normal create flows.
- **Fix**: No action unless product reports wrong label for plan-shaped tasks; could prefer stored id when multiple presets match.
- **Decision**: SKIPPED — edge case; no product report — Blur timer cleanup on TaskList unmount

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/app/_components/task-list.tsx:814-818
- **Detail**: Timer cleared when `editingId` becomes null; no effect cleanup on component unmount. Rare navigation-during-edit could schedule a stray commit.
- **Fix**: `useEffect(() => () => cancelPendingBlurCommit(), [cancelPendingBlurCommit])`.
- **Decision**: FIXED — unmount cleanup effect added (review run)

| Command | Result |
|---------|--------|
| `pnpm check` | PASS |
| `pnpm test` | PASS (1175 tests post-triage) |
| `set CI=true && pnpm test:e2e:belt` | Not re-run in this review (passed in impl session) |

## Plan drift summary

| Phase | Match | Drift | Missing |
|-------|-------|-------|---------|
| 1 (D-09) | guest hook, tests structure | attribute-match oracle (intentional) | — |
| 2 (D-08) | all items | — | — |
| 3 (D-08) | all items | — | — |
| 4 | gates | — | belt SHA |
