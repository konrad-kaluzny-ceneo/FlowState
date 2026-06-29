---
change_id: home-ia-reset
title: Home IA reset
status: impl_reviewed
created: 2026-06-27
updated: 2026-06-27
archived_at: null
---

## Notes

S-40 / Stream R — home answers "Co teraz?" with one dominant next-focus, recap collapsed, inventory secondary.

- Roadmap: S-40 | Change: `home-ia-reset` | Branch: `features/home-ia-reset`
- Linear: [FLO-92](https://linear.app/flowstate-10xdev/issue/FLO-92/flowstate-home-ia-reset-s-40) | GitHub: [#172](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/172)
- PRD refs: Secondary craft; US-03 light recap hierarchy; wedge next-task suggestion
- Prerequisites: S-13, S-15, S-27, S-30, S-31; soft F-14 (shipped)
- Acceptance: session-state module matrix (idle / steering / active_work / break / returning); exactly one primary CTA above fold in idle/returning; recap collapsed on first paint; timer hero during active work; 5-second purpose test → "what to do next / co teraz"
- Item card: `context/foundation/roadmap-references/items/S-40.md`
- Voice contract: cite `context/foundation/product-voice.md` for "Co teraz?" / next-focus copy zones

## Implementation report

**Shipped behavior (S-40 / PRD US-03 / F-14)**

- Pure home IA derivation in `src/lib/home/home-session-state.ts` maps `idle`, `steering`, `active_work`, `break`, and `returning` to module priorities (`primary` / `secondary` / `hidden`).
- `pomodoro-dashboard.tsx` renders through `home-primary-region` / `home-secondary-region` from that derivation; wedge overlays stay outside IA zones.
- `home-shell.tsx` renders F-14 `Home.purposeHeader` for the 5-second purpose test.
- `daily-recap-panel.tsx` defaults collapsed; recap hidden during `active_work` via dashboard host.
- Task inventory, archive entry/back, and continue-here row remain reachable in the secondary zone.

**Conservative decisions (held)**

| Decision | Outcome |
| --- | --- |
| No hook/conductor changes | Confirmed — `use-pomodoro-cycle`, `transition-conductor`, and overlay sequencing untouched |
| No new belt e2e | Confirmed — layout/priority oracles live in Vitest component tests |
| No new copy keys | Confirmed — reused `Home.purposeHeader`; no `messages/*.json` edits |
| Test-plan cookbook | Unchanged — §6.1 (pure module), §6.9 (dashboard hook-mock composite), §6.11 (recap panel) already cover S-40 patterns; `home-primary-region` assertions extend existing `pomodoro-dashboard.test.tsx` reference |

**Test coverage (test-plan cost × signal)**

- Unit: `src/lib/home/home-session-state.test.ts`
- Component: `home-shell`, `pomodoro-dashboard` (state matrix + filled primary CTA oracle), `daily-recap-panel`, `task-list` smoke
- Targeted run: `pnpm exec vitest run src/lib/home/home-session-state.test.ts src/app/_components/home-shell.test.tsx src/app/_components/pomodoro-dashboard.test.tsx src/app/_components/daily-recap-panel.test.tsx src/app/_components/task-list.test.tsx`

**Next stage:** S9 — `/10x-linear-backlog sync` (pre-PR backlog sync)
