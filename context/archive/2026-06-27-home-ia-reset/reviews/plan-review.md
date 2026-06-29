<!-- PLAN-REVIEW-REPORT -->

# Plan Review: home-ia-reset

Date: 2026-06-27
Reviewer: Cursor
Roadmap: S-40
Plan: `context/changes/home-ia-reset/plan.md`
Brief: `context/changes/home-ia-reset/plan-brief.md`

## Verdict

PASS - ready for `/10x-implement home-ia-reset phase 1`.

The plan is substantive, feasible, and aligned with S-40 acceptance, PRD v3 Secondary/US-03, F-14 product voice, `AGENTS.md` wedge rules, and the test-plan cost x signal strategy. It keeps the slice scoped to home IA/presentation, avoids hook/conductor drift, and gives S7 an executable phase order with a canonical `## Progress` block.

Confidence: 88%.

## Findings

### Fixed During Review

#### WARNING PR-001 - Primary CTA oracle was under-specified

The plan required "one filled primary CTA" in idle/returning states but did not define how the component test should distinguish a real next-step action from a wrapper or nearby inventory control. That could let S7 pass structure-only tests while the task inventory or archive entry remained visually co-primary, which is the central S-40 risk.

Fix applied:

- `plan.md` now defines the oracle through existing user-action test ids: `suggestion-accept-btn`, `timer-start-cycle`, `timer-pause`, `timer-resume`, and the kickoff duration/start path.
- `plan.md` now requires inventory controls such as `task-archive-entry` and edit/create affordances to remain outside `home-primary-region`.
- `plan-brief.md` now carries the same shorthand so implementers see the constraint during handoff.

Status: fixed.

### Open Findings

None.

### Critical Findings

None open. No CRITICAL findings were found.

## Review Coverage

- Substance: strong. Desired end state, decisions, scope exclusions, phases, success criteria, and progress checklist are concrete enough for implementation.
- Feasibility: strong. The plan matches the current dashboard/test shape: hook boundary mocking already exists, recap tests exist, home shell tests exist, and stable affordance test ids exist for suggestion, timer, recap, task list, archive, and returning rows.
- PRD/roadmap alignment: strong. The plan maps S-40 acceptance to a pure session-state derivation, module priority matrix, collapsed recap, active-work timer hero, and 5-second "what to do next / co teraz" purpose test.
- Module boundaries: strong. `usePomodoroCycle`, `resolveWedgeBeat`, conductor-owned overlays, data-mode, tRPC, Prisma, and auth remain out of scope.
- Test adequacy: strong after PR-001 fix. Unit tests cover the pure matrix; component tests cover layout/copy/priority; no new belt e2e is planned unless a browser-only oracle appears.
- Risk drift: low. The plan avoids S-41 desktop workbench, S-42 day memory, S-44 archive behavior, and wedge transition sequencing.

## Notes For S7

- Run `pnpm change-impact` before editing `src/app/_components/pomodoro-dashboard.tsx`, as required by `AGENTS.md` and the plan.
- Keep wedge overlays outside the new home IA regions.
- Treat paused WORK as `active_work`.
- Do not add Playwright coverage unless component tests cannot observe the acceptance point and the implementation report documents why.

## Files Changed By Review

- `context/changes/home-ia-reset/plan.md`
- `context/changes/home-ia-reset/plan-brief.md`
- `context/changes/home-ia-reset/reviews/plan-review.md`
