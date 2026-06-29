<!-- PLAN-REVIEW-REPORT -->

# Plan Review: desktop-calm-workbench

Date: 2026-06-29
Reviewer: Cursor
Change: `desktop-calm-workbench` / S-41
Plan: `context/changes/desktop-calm-workbench/plan.md`
Verdict: PASS_WITH_WARNINGS_FIXED

## Scope Reviewed

- `context/changes/desktop-calm-workbench/plan.md`
- `context/changes/desktop-calm-workbench/research.md`
- `context/changes/desktop-calm-workbench/change.md`
- `context/changes/desktop-calm-workbench/plan-brief.md`
- `context/foundation/roadmap-references/items/S-41.md`
- `context/foundation/lessons.md`
- `AGENTS.md`
- Current code anchors in:
  - `src/app/_components/home-shell.tsx`
  - `src/app/_components/pomodoro-dashboard.tsx`
  - `src/lib/home/home-session-state.ts`
  - `src/app/_components/pomodoro-dashboard.test.tsx`
  - `src/app/_components/home-shell.test.tsx`
  - `src/app/_components/daily-recap-panel.tsx`
  - `src/app/_components/focus-budget-prompt.tsx`
  - `src/app/_components/guest-banner.tsx`

## Verdict

The plan is feasible and aligned with S-41 after the fixes below. The major seams still hold: S-40's pure `deriveHomeSessionState` can remain unchanged, `PomodoroDashboardBody` owns the persistent module composition, the current width blockers are the shell `container` and dashboard `max-w-lg`, and wedge overlays/end-session controls are still outside the region block.

No open critical findings remain.

## Findings

### WARNING 1: Authenticated rail summary could silently disappear

The S-41 acceptance card requires the authenticated rail to include a standing/focus-hours text summary from S-27. The plan referenced existing focus-hours UI but did not explicitly guard against using `FocusBudgetPrompt` as that accepted rail block. In current code, `FocusBudgetPrompt` returns `null` when `hasBudget` is true and is a setup prompt with controls, not a stable contextual summary. An implementer could satisfy tests in a no-budget fixture while failing the accepted desktop rail for configured users.

Severity: WARNING

Fix applied to `plan.md`:
- Added an `Auth focus summary` decision requiring a display-only rail summary.
- Tightened the authenticated rail contract to forbid `FocusBudgetPrompt` as the accepted summary block.
- Added a Phase 2 `Auth Focus Summary Copy And Oracle` step covering `pomodoro-dashboard.tsx` and `messages/en.json`.
- Added an automated criterion for the `dayPlan.hasBudget === true` case.
- Clarified that the desktop rail cap remains three direct blocks and the prompt must not become a fourth rail block.

### WARNING 2: Targeted test command omitted a touched component's existing test

Phase 2 plans to change `src/app/_components/guest-banner.tsx`, but the targeted Vitest command omitted the existing `src/app/_components/guest-banner.test.tsx`. That would leave the direct component contract out of the slice's cheapest blast-radius run.

Severity: WARNING

Fix applied to `plan.md`:
- Added `src/app/_components/guest-banner.test.tsx` to the targeted Vitest command.

## Nits Deferred

- The exact Tailwind grid template remains an implementation choice within the accepted 1120-1280px / rail <=40% bounds. The plan already asks for structural class oracles instead of pixel assertions, which is appropriate for jsdom.
- The plan-review skill file available in this environment appears truncated after its internal consistency scan section; this review followed the readable skill instructions plus the explicit auto-triage instructions from the stage request.

## Checks

- Internal consistency: PASS after fixes.
- Acceptance coverage: PASS after fixes.
- Code anchor freshness: PASS.
- Timer-hub procedure coverage: PASS (`pnpm change-impact` required before `pomodoro-dashboard.tsx` edits).
- Wedge domain rule coverage: PASS (overlays stay outside grid; no conductor/cycle changes planned).
- Test/oracle coverage: PASS after adding `guest-banner.test.tsx` and the focus-summary configured-budget oracle.
