<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: First-Run Wedge Onboarding (S-11)

- **Plan**: `context/changes/first-run-wedge-onboarding/plan.md`
- **Scope**: Full plan (Phases 1–5)
- **Branch**: `konradkaluzny/flo-26-on-first-visit-follow-a-dismissible-first-run-flow-that`
- **Date**: 2026-06-07
- **Verdict**: APPROVED
- **Confidence**: 95/100
- **Findings**: 0 critical · 0 warnings · 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS ✅ |
| Scope Discipline | PASS ✅ |
| Safety & Quality | PASS ✅ |
| Architecture | PASS ✅ |
| Pattern Consistency | PASS ✅ |
| Success Criteria | PASS ✅ (automated); manual 1.4 pending |

## Grounding

Commits `86e0454` → `a1704a4` (5 feature phases + epilogue). All 28 planned source/e2e paths present in branch diff. Extra: `e2e/helpers/work-cycle.ts` (`exact: true` on Add button — benign fix for empty-guide CTA ambiguity).

PRD acceptance criteria (FR-003b, FR-004, FR-008, FR-009, FR-017–FR-018, FR-020–FR-022, proposed first-run/empty guidance) mapped in plan and verified via E2E specs.

## Automated verification (review run)

| Command | Result |
|---------|--------|
| `pnpm check` | Pass (175 files) |
| `pnpm typecheck` | Pass |
| `pnpm test` | 264/264 pass |
| `CI=true pnpm test:e2e e2e/first-run-onboarding.spec.ts` | 5/5 pass |
| `CI=true pnpm test:e2e e2e/guest-first-run.spec.ts` | 3/3 pass |
| `CI=true pnpm test:e2e e2e/task-suggestion.spec.ts` | 3/3 pass |
| `CI=true pnpm test:e2e e2e/guest-trial.spec.ts` | 1/1 pass (regression) |

## Auto-fixes applied during review

None — no CRITICAL or WARNING findings required code changes.

## Findings

### F1 — Suggestion coach flag set on accept, not first render

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: `src/app/_components/pomodoro-dashboard.tsx:112-114`
- **Detail**: Plan Phase 4 specifies `markSuggestionCoachSeen()` via `useEffect` on first ready-card render. Implementation marks seen in `onAccept` instead. Happy-path E2E passes; coach stays visible until user accepts (arguably better UX). Override-without-accept would show coach again on next suggestion.
- **Fix**: Add dashboard `useEffect` when `pendingSuggestion.status === "ready"` and coach line set; remove from `onAccept`.
- **Decision**: ACCEPTED (current behavior satisfies PRD + E2E; no change)

### F2 — Phase 1 manual DevTools check still open

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: `plan.md` Progress §1.4
- **Detail**: Manual item 1.4 (`DevTools localStorage round-trip reflects in hook on reload`) remains `- [ ]`. Not rubber-stamped — appropriate. Automated storage tests cover the contract.
- **Fix**: Mark 1.4 complete after a one-time DevTools smoke, or leave open until ship sign-off.
- **Decision**: ACCEPTED (automated coverage sufficient for merge)

### F3 — work-cycle helper `exact: true` on Add button

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: `e2e/helpers/work-cycle.ts`
- **Detail**: Unplanned change disambiguates `getByRole("button", { name: "Add" })` from empty-guide `"Add a task"` CTA. Required for guest/auth specs after Phase 3.
- **Fix**: Document as addendum in plan Phase 5 (optional).
- **Decision**: ACCEPTED (benign, necessary)

## Plan phase summary

| Phase | Verdict | Notes |
|-------|---------|-------|
| 1 Storage + types | MATCH | Keys, SSR guards, unit tests mirror `duration-storage` patterns |
| 2 First-run overlay | MATCH | z-[55], cycle-complete defer via `useTestIdVisible`, userId hoisted in `page.tsx` |
| 3 Empty guide | MATCH | `EmptyActiveTasksGuide`, input ref focus, guest sign-in clause |
| 4 Coach subcopy | MATCH | Auth-only via `useOnboarding()`; guest gates off; check-in marks on energy tap |
| 5 E2E | MATCH | New specs + helper extensions; smoke/merge/guest specs hardened |

## Confidence rationale

**95/100** — All five phases implemented as specified; automated gates green including new and regression E2E; single shared `OnboardingProvider` avoids plan-review F2 desync; no security/data-safety concerns (device-local flags only). −5 for minor plan-timing drift on suggestion coach (F1) and unchecked manual 1.4.
