# Home IA Reset — Plan Brief

> Full plan: `context/changes/home-ia-reset/plan.md`  
> Research: `context/changes/home-ia-reset/research.md`

## What & Why

S-40 makes the home screen answer "Co teraz?" instead of presenting timer, recap, and task inventory as equal peers. The slice creates one dominant next-focus area, keeps recap collapsed as context, and demotes the task list to inventory while preserving all existing session, task, recap, and wedge behavior.

## Starting Point

Today the home IA is a fixed JSX stack inside `pomodoro-dashboard.tsx` with scattered visibility booleans. F-14 already shipped the required `Home.purposeHeader` copy, but it is not rendered; daily recap is expanded by default and inventory sits as a co-primary block.

## Desired End State

Home has a pure session-state derivation for `idle`, `steering`, `active_work`, `break`, and `returning`, plus a typed module-priority matrix (`primary`, `secondary`, `hidden`). The dashboard consumes that matrix through thin presentation zones: idle/returning lead with one next-focus CTA, active work leads with the timer, recap starts collapsed and hides during work, and inventory stays reachable but secondary.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Architecture boundary | Pure `src/lib/home/home-session-state.ts` derivation | Keeps IA decisions out of the cycle hook and avoids another inline matrix in the dashboard | Research / Plan |
| Hook/conductor scope | Do not change `usePomodoroCycle` or `resolveWedgeBeat` | S-40 is layout/priority over existing behavior; wedge transition risk is regression-heavy | Research / AGENTS.md |
| Copy | Reuse `Home.purposeHeader` | F-14 already shipped EN/PL copy for the 5-second purpose test | Research / Product voice |
| Recap | Collapse by default; hide during active work | S-40 needs recap as context, not a competing dashboard | Roadmap / Research |
| Test layer | Unit + component tests by default; no new belt e2e | Test-plan cost x signal says layout/copy/priority belongs below e2e unless browser-only | Test plan |
| Pause edge | Paused WORK remains `active_work` | Pause is orthogonal to IA state; timer remains the user's primary focus | Research / Plan |

## Scope

**In scope:**

- Pure home session-state and module-priority derivation.
- Dashboard/home-shell layout consumption.
- `Home.purposeHeader` rendering.
- Recap collapsed first paint and active-work hiding.
- Unit/component tests for IA, header, dashboard matrix, recap, and inventory smoke.
- Cookbook/test-plan update only if implementation creates a reusable new pattern.

**Out of scope:**

- Cycle hook, timer worker, conductor, or overlay behavior changes.
- New wedge gates or transition copy.
- S-42 day-memory narrative.
- S-41 desktop three-zone workbench.
- Stale-task archive behavior changes.
- New Playwright belt row unless a browser-only oracle appears.

## Architecture / Approach

The plan separates domain-like IA derivation from rendering. Dashboard code gathers already-known session facts, passes them into a pure home IA module, then renders existing components into primary/secondary/hidden zones. This preserves current data-mode, timer, suggestion, recap, and archive ownership while making S-41/S-42 reuse possible.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Pure Home IA Model | Typed state/priority derivation plus exhaustive unit tests | Matrix misses pause, guest, or returning edge case |
| 2. Home Layout Consumption | Dashboard/header/recap consume the IA contract | Existing task/wedge/recap behavior regresses during reorder |
| 3. Component and Unit Verification | Focused Vitest/RTL coverage for S-40 acceptance | Tests assert structure without user-visible priority signal |
| 4. Documentation and Handoff | Cookbook decision and implementation reporting guardrails | Foundation docs get unnecessary churn or miss a reusable pattern |

**Prerequisites:** Branch `features/home-ia-reset`; S4 research accepted; F-14 shipped; run `pnpm change-impact` before dashboard edits.  
**Estimated effort:** 3-4 implementation phases, likely 1-2 focused sessions.

## Open Risks & Assumptions

- The dashboard can provide all required facts as plain inputs; if not, adapt inputs rather than importing hooks into the pure module.
- Component tests can observe "one dominant CTA" through concrete filled-action test ids (`suggestion-accept-btn`, `timer-start-cycle`, `timer-pause`, `timer-resume`, kickoff duration/start path) inside `home-primary-region`; if not, implementation must document the browser-only oracle before adding e2e.
- The existing task inventory can be visually demoted without changing `TaskList` internals.

## Success Criteria (Summary)

- Within 5 seconds, idle home communicates "what to do next / co teraz" with one primary next-focus action.
- Active work makes the timer the hero, hides recap, and keeps task inventory secondary but usable.
- S-40 ships with pure unit and component tests, no hook/conductor behavior changes, and no new belt e2e unless explicitly justified.
