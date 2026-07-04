<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Status Vocabulary Unification

- **Plan**: context/changes/status-vocabulary-unification/plan.md
- **Scope**: Full plan (Phases 1–4)
- **Date**: 2026-07-04
- **Verdict**: APPROVED (post-triage)
- **Findings**: 0 critical, 4 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | WARNING |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | WARNING |

## Automated verification (re-run 2026-07-04)

| Command | Result |
|---------|--------|
| `pnpm check` | PASS |
| `pnpm test` | PASS (1175 tests) |
| Grep `messages/pl.json` banned status roots | PASS (zero matches) |
| Grep `product-voice.md` status labels | PASS (only historical footnote cites Domknięte/Zostaje/Zrobione) |

## Findings

### F1 — Manual verification not completed

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: context/changes/status-vocabulary-unification/plan.md:318–352
- **Detail**: All six Manual Progress rows (1.3, 2.3, 4.4–4.7) remain `- [ ]`. Automated rows are `[x]` but no SHA suffixes — phase-end commit ritual was not completed. Core D-10 copy is implemented and tests green, but PL locale manual pass is unverified.
- **Fix**: Complete manual checklist (home day-memory, recap, task list regression, focus summary), then flip Manual rows and run epilogue commit per `/10x-implement`.
- **Decision**: FIXED — user confirmed manual PL pass complete; Progress manual rows flipped

### F2 — `remainingCount` drifts from plan contract (intentional improvement)

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: messages/pl.json:337
- **Detail**: Plan specified `aktywne`/`aktywnych` for `DayMemory.remainingCount`. Implementation uses `zadanie`/`zadania`/`zadań` (mirrors `doneCount` and EN `{n} open`), avoiding redundant "Aktywne: 2 aktywne." User feedback drove this during implementation. `format-day-memory.test.ts` and `product-voice.md` example align with zadanie forms.
- **Fix A ⭐ Recommended**: Keep zadanie-based `remainingCount`; add a one-line plan addendum under Phase 2 noting the D-10 grammar fix.
  - Strength: Better Polish; runtime, contract example, and integration tests already agree.
  - Tradeoff: Plan text becomes slightly stale until addendum lands.
  - Confidence: HIGH — user explicitly requested the grammar fix.
  - Blind spot: None significant.
- **Fix B**: Revert to `aktywne`/`aktywnych` per original plan.
  - Strength: Strict plan adherence.
  - Tradeoff: Reintroduces awkward "Aktywne: N aktywne" phrasing.
  - Confidence: HIGH.
  - Blind spot: None.
- **Decision**: FIXED via Fix A — zadanie forms kept; plan addendum added

### F3 — Tasks axis/workType labels out of D-10 scope

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Scope Discipline
- **Location**: messages/pl.json:222–224, 249–252
- **Detail**: `Tasks.axisLight/Medium/Heavy` changed Lekkie/Ciężkie → Niska/Średnia/Wysoka and `workType` Głęboka → Głębokie etc. Not in plan ("What We're NOT Doing" implied PL status surfaces only). User-requested during same session. Semantically correct for urgency/importance axes.
- **Fix A ⭐ Recommended**: Document in change notes / plan addendum as D-10-adjacent copy fix on same branch; keep in PR.
  - Strength: Preserves user-approved labels; same `messages/pl.json` touch surface.
  - Tradeoff: Expands slice scope beyond defect register D-10.
  - Confidence: HIGH.
  - Blind spot: No PL smoke test asserts axis labels in task form.
- **Fix B**: Revert Tasks.* keys; ship only DayMemory/HomeFocusSummary/Recap/Session changes.
  - Strength: Strict D-10 boundary.
  - Tradeoff: User-reported label issue remains unfixed.
  - Confidence: HIGH.
  - Blind spot: None.
- **Decision**: FIXED via Fix A — documented in change.md addendum; labels kept

### F4 — F-14 acceptance oracle uses bare count

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/voice/acceptance-copy.test.ts:74–84
- **Detail**: `buildDayMemoryCollapsedLine` PL test expects `Aktywne: 3.` with bare `remaining: "3"`. EN test uses `remaining: "3 open"`. Contract (`product-voice.md:164`) and runtime (`formatDayMemory`) use `3 zadania`. Test passes but documents a weaker oracle than integration tests.
- **Fix**: Update fixture to `remaining: "3 zadania"` and expectation to `Ukończone: 2 zadania. Aktywne: 3 zadania. Wróć spokojnie do: API review.`
- **Decision**: FIXED — acceptance-copy.test.ts oracle updated

### F5 — Implementation partially uncommitted

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: N/A (git state)
- **Detail**: Commit `88934d8` message references status-vocabulary-unification but primarily added plan artifacts and unrelated `task-list` edits. `product-voice.md`, `messages/pl.json` D-10 strings, and test oracles exist in working tree vs HEAD — not yet committed as a cohesive D-10 diff.
- **Fix**: Stage and commit D-10 files explicitly before merge; avoid mixing with `persona-trust-clause` / `suggestion.ts` edits on same commit unless intentional.
- **Decision**: FIXED — committed as `92a47ea` (D-10 files only)

### F6 — `product-voice.md` footnote retains banned terms

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: context/foundation/product-voice.md:132
- **Detail**: D-10 footnote cites Domknięte/Zostaje/Zrobione as unieważnione — intentional historical context. Automated grep criterion allows this; not a runtime risk.
- **Fix**: No action required.
- **Decision**: ACCEPTED — intentional historical footnote

### F7 — Branch carries unrelated dirty files

- **Severity**: OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Scope Discipline
- **Location**: src/lib/scoring/persona-trust-clause.ts, src/server/api/routers/suggestion.ts, task-edit-interaction-fixes context
- **Detail**: `features/mvp-defect-intake` working tree includes changes outside D-10 scope (persona trust clause, task-edit review artifacts). Not introduced by D-10 implementation but affects PR clarity.
- **Fix**: Ensure PR description segments D-10 vs other fixes; separate commits per change-id where possible.
- **Decision**: SKIPPED — user owns PR segmentation on mvp-defect-intake branch
