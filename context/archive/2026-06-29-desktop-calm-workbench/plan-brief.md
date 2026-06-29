# Desktop Calm Three-Zone Workbench — Plan Brief

> Full plan: `context/changes/desktop-calm-workbench/plan.md`
> Research: `context/changes/desktop-calm-workbench/research.md`

## What & Why

S-41 makes the FlowState home page feel calm and intentional on desktop by adding a `lg >= 1024px` workbench: a dominant decision column, subordinate task inventory, and a context rail capped at three blocks. It keeps the shipped S-40 mobile-first priority order unchanged below `lg`.

## Starting Point

S-40 already shipped the pure home IA helper, `deriveHomeSessionState`, plus two structural dashboard regions. The current app has no responsive breakpoints and is still capped to `max-w-lg` by both `home-shell.tsx` and `pomodoro-dashboard.tsx`, so S-41 is the first additive desktop layout convention.

## Desired End State

At desktop width, users see a centered 1120-1280px workbench where "Co teraz?" and the next decision remain visually primary. Authenticated users get a three-block contextual rail with illustration, collapsed recap, and standing/focus-hours summary; guests get sign-in value, activation/merge guidance, and calm empty-state guidance without empty persisted-data panels.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Breakpoint strategy | Additive `lg:` only | It preserves current mobile behavior and matches S-41's 1024px breakpoint | Research |
| IA ownership | Keep `deriveHomeSessionState` unchanged | The S-40 matrix is intentionally layout-agnostic | Research |
| Desktop split | Prototype around ~62/38 decision-vs-rail | Meets the 60-65% decision-column goal while keeping rail <=40% | Plan |
| Inventory placement | Keep inventory under the decision column | Inventory stays available without becoming co-primary with next focus | Plan |
| Guest banner | Mobile header below `lg`, desktop rail at `lg` | Avoids duplicate guest sign-in messaging on desktop | Plan |
| Recap rail content | Use S-30 `DailyRecapPanel`, not `DayMemory.*` | `DayMemory.*` belongs to S-42 | Research |
| Test layer | RTL component structural tests | Cheapest layer with real signal; jsdom cannot measure pixels | Research |
| Timer-hub procedure | Run `pnpm change-impact` before editing dashboard | Required by `AGENTS.md` for `pomodoro-dashboard.tsx` | AGENTS |

## Scope

**In scope:**

- Widen shell and dashboard caps at `lg`.
- Add desktop structural zones: decision, inventory, context rail.
- Render auth and guest rail variants with <=3 blocks.
- Keep mobile S-40 order as the default path.
- Extend component tests with structural oracles.

**Out of scope:**

- Changes to `deriveHomeSessionState`, cycle hook, wedge library, tRPC, Prisma, or persisted data.
- New Playwright belt coverage.
- S-42 day-memory namespace usage.
- S-43 stateful illustration behavior.

## Architecture / Approach

The plan adds a thin responsive presentation layer over the existing S-40 IA. `PomodoroDashboardBody` remains the composition owner, but its persistent inline modules are distributed into desktop zones at `lg`; overlays stay outside the grid. Mode-specific rail content branches from the existing authenticated/guest dashboard paths and existing data sources.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Desktop Workbench Frame | Width caps, grid wrapper, zone/test-id contract, overlay boundary | First responsive breakpoint accidentally changes mobile order |
| 2. Authenticated And Guest Rail Content | Accepted auth/guest rail blocks capped at three | Rail steals focus or guests see empty auth panels |
| 3. Structural Oracles And Final Verification | RTL oracles plus `pnpm check` / `pnpm test` gates | Tests assert implementation details instead of user-visible structure |

**Prerequisites:** S-40 shipped; run `cd D:\repos\10xdev\FlowState-desktop-calm-workbench; pnpm change-impact` before editing `src/app/_components/pomodoro-dashboard.tsx`.

**Estimated effort:** ~2-3 implementation sessions across 3 phases.

## Open Risks & Assumptions

- Exact Tailwind grid values may need small visual tuning, but tests should assert structural class contracts rather than pixels.
- The standing/focus-hours rail summary should reuse existing data and copy; if the current component is too prompt-shaped, implement the smallest display-only variant inside the dashboard.
- Desktop guest banner suppression must avoid hiding the only sign-in path below `lg`.

## Success Criteria (Summary)

- Desktop users see a centered 1120-1280px calm workbench where the decision column is dominant and the rail is <=3 blocks.
- Guests get sign-in/activation/guidance content, not empty persisted-data panels.
- Below `lg`, the S-40 single-column order and existing CTA dominance remain unchanged.
