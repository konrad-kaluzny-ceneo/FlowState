---
date: 2026-06-26T22:42:37.1901032+02:00
researcher: GPT-5.5
git_commit: 8ca325ea8352b9404f30bd6c93900c7e290d532b
branch: main
repository: FlowState
topic: "Implementation feasibility for roadmap-ux-ui-story-expand UX/UI story proposals"
tags: [research, codebase, roadmap, ux-ui, home-ia, daily-recap, calm-garden]
status: complete
last_updated: 2026-06-26
last_updated_by: GPT-5.5
---

# Research: Implementation feasibility for roadmap-ux-ui-story-expand UX/UI story proposals

**Date**: 2026-06-26T22:42:37.1901032+02:00  
**Researcher**: GPT-5.5  
**Git Commit**: 8ca325ea8352b9404f30bd6c93900c7e290d532b  
**Branch**: main  
**Repository**: FlowState

## Research Question

`/10x-research roadmap-ux-ui-story-expand` - wykonaj analize mozliwosci implementacji pomyslow zaproponowanych w folderze `roadmap-ux-ui-story-expand`.

## Summary

The UX/UI story chapter is implementable as a coherent roadmap expansion after PRD v3 and the quality hardening rows. The proposed ID allocation is available: the current roadmap ends product slices at `S-39` and quality at `Q-09`, so `F-14` and `S-40` through `S-43` can be used without collision ([roadmap.md:89-91](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/8ca325ea8352b9404f30bd6c93900c7e290d532b/context/foundation/roadmap.md#L89-L91)).

The safest roadmap stance is:

- `F-14 product-voice-contract` - new foundation row, first in sequence.
- `S-40 home-ia-reset` - new UX slice, hard prerequisite for desktop layout.
- `S-41 desktop-calm-workbench` - new UX slice, only after S-40.
- `S-42 mindful-day-memory` - new slice row, but explicitly marked as S-30 phase 2 / formatter-only.
- `S-43 stateful-illustration-system` - new slice row, explicitly absorbing S-28 phase 2.

The implementation risk is not technical feasibility; it is scope discipline. `S-41` context rail can steal focus from the decision column; `S-42` can duplicate S-30 substrate. `S-43` can violate the S-39 gate/accessibility contract if illustrations appear on accept/override/start controls.

Recommended sequence: `F-14 -> S-40 -> S-41`, with `S-43` able to run in parallel with `S-41` once the rail/hero slot is defined, and `S-42` best placed after the home hierarchy exists so recap remains context rather than a primary surface.

## Detailed Findings

### Roadmap Patch Strategy

The roadmap has no active slices and the new rows have not yet been written. The current state still treats this expand batch as pending user acceptance (`context/changes/roadmap-ux-ui-story-expand/batch-7-ux-ui-story-chapter.md:4-14`).

Patch locations:

- Add rows after `Q-09` in the `At a glance` table ([roadmap.md:89-91](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/8ca325ea8352b9404f30bd6c93900c7e290d532b/context/foundation/roadmap.md#L89-L91)).
- Add a new UX/UI story stream after the quality stream section ([roadmap.md:109-115](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/8ca325ea8352b9404f30bd6c93900c7e290d532b/context/foundation/roadmap.md#L109-L115)).
- Update backlog handoff after `Q-09`, replacing the current recommended next step ([roadmap.md:143-147](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/8ca325ea8352b9404f30bd6c93900c7e290d532b/context/foundation/roadmap.md#L143-L147)).
- Add merge notes for the UX/UI proposals near the existing scope-merge section ([roadmap.md:168-184](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/8ca325ea8352b9404f30bd6c93900c7e290d532b/context/foundation/roadmap.md#L168-L184)).
- Add item cards under `context/foundation/roadmap-references/items/` and update the item index ([README.md:25-35](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/8ca325ea8352b9404f30bd6c93900c7e290d532b/context/foundation/roadmap-references/README.md#L25-L35)).

Issue creation should happen only after the roadmap patch is accepted. Lessons warn against duplicate Linear/GitHub issue pairs and sync side effects (`context/foundation/lessons.md:16-50`). Create one pair per accepted new row and verify existing IDs first.

### Product Voice Contract (`product-voice-contract`)

Feasibility is high. This should be a foundation artifact first, not a code migration. The proposed deliverable is `context/foundation/product-voice.md`, with the promise, tone, forbidden vocabulary, copy zones, examples, and an acceptance checklist (`context/changes/roadmap-ux-ui-story-expand/expand-refinement-summary.md:44-72`).

Likely later adoption points:

- Home shell headline currently uses generic product copy ([home-shell.tsx:93](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/8ca325ea8352b9404f30bd6c93900c7e290d532b/src/app/_components/home-shell.tsx#L93)).
- Suggestion card heading currently says `Suggested next task` ([task-suggestion-card.tsx:249](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/8ca325ea8352b9404f30bd6c93900c7e290d532b/src/app/_components/task-suggestion-card.tsx#L249)).
- Recap heading currently says `Daily recap` ([daily-recap-panel.tsx:120](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/8ca325ea8352b9404f30bd6c93900c7e290d532b/src/app/_components/daily-recap-panel.tsx#L120)).
- Onboarding copy already has a centralized surface in `src/lib/onboarding/copy.ts` ([copy.ts:9](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/8ca325ea8352b9404f30bd6c93900c7e290d532b/src/lib/onboarding/copy.ts#L9)).

Implementation stance: start doc-only, then require future slices to cite the contract. Avoid partial copy migration before the contract is accepted, because it would mix Polish-first UX copy with existing English labels.

### Home IA Reset (`home-ia-reset`)

Feasibility is medium-high. It is a composition and hierarchy refactor over existing surfaces, not a new wedge mechanic. The proposal is strongest when implemented as a pure session-state/module-priority layer driving visibility and order.

Likely touch points:

- `home-shell.tsx` owns the main shell and hero ([home-shell.tsx:87](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/8ca325ea8352b9404f30bd6c93900c7e290d532b/src/app/_components/home-shell.tsx#L87)).
- `pomodoro-dashboard.tsx` currently renders a single narrow vertical stack ([pomodoro-dashboard.tsx:443](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/8ca325ea8352b9404f30bd6c93900c7e290d532b/src/app/_components/pomodoro-dashboard.tsx#L443)).
- The dashboard already derives show/hide state for timer, suggestions, recap, wedge gates, and transition lines ([pomodoro-dashboard.tsx:303-430](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/8ca325ea8352b9404f30bd6c93900c7e290d532b/src/app/_components/pomodoro-dashboard.tsx#L303-L430)).
- `use-pomodoro-cycle.ts` exposes the state needed by a pure session-state derivation ([use-pomodoro-cycle.ts:3633](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/8ca325ea8352b9404f30bd6c93900c7e290d532b/src/hooks/use-pomodoro-cycle.ts#L3633)).
- `daily-recap-panel.tsx` currently expands both sections by default ([daily-recap-panel.tsx:95](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/8ca325ea8352b9404f30bd6c93900c7e290d532b/src/app/_components/daily-recap-panel.tsx#L95)).
- `task-list.tsx` already supports inventory-like active/completed sections ([task-list.tsx:938](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/8ca325ea8352b9404f30bd6c93900c7e290d532b/src/app/_components/task-list.tsx#L938)).

Implementation approach:

- Add a pure helper such as `home-session-state.ts` to map existing pomodoro/session facts into `idle`, `steering`, `active_work`, `break`, and `returning`.
- Add `home-module-priority.ts` to decide `primary`, `secondary`, and `hidden` modules.
- Keep F-07 conductor/gate priority unchanged. Use the matrix only for composition.
- Enforce one filled primary CTA above the fold in idle/returning states.
- Hide recap during active work and collapse it on first paint elsewhere.

Because this touches `src/app/_components/pomodoro-dashboard.tsx`, run `pnpm change-impact` before editing timer-hub composition files.

### Desktop Calm Workbench (`desktop-calm-workbench`)

Feasibility is medium and depends on `home-ia-reset`. The current app has multiple narrow `max-w-lg` surfaces, so the refactor is technically straightforward but product-sensitive.

Likely touch points:

- The home shell is centered around a narrow column ([home-shell.tsx:91](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/8ca325ea8352b9404f30bd6c93900c7e290d532b/src/app/_components/home-shell.tsx#L91)).
- Dashboard is hard-capped in a single vertical column ([pomodoro-dashboard.tsx:443](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/8ca325ea8352b9404f30bd6c93900c7e290d532b/src/app/_components/pomodoro-dashboard.tsx#L443)).
- Task list and timer cards also carry narrow max-width assumptions ([task-list.tsx:790](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/8ca325ea8352b9404f30bd6c93900c7e290d532b/src/app/_components/task-list.tsx#L790), [timer-panel.tsx:123](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/8ca325ea8352b9404f30bd6c93900c7e290d532b/src/app/_components/timer-panel.tsx#L123), [timer-panel.tsx:210](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/8ca325ea8352b9404f30bd6c93900c7e290d532b/src/app/_components/timer-panel.tsx#L210)).
- The recap card can become rail content if kept secondary ([daily-recap-panel.tsx:115](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/8ca325ea8352b9404f30bd6c93900c7e290d532b/src/app/_components/daily-recap-panel.tsx#L115)).

Implementation approach:

- After S-40, split the dashboard into decision column, task inventory, and context rail.
- At `lg >= 1024px`, use a centered `1120-1280px` grid.
- Keep decision at roughly 60-65% and the rail below roughly 40%.
- Below `lg`, preserve the S-40 priority order.
- Rail content must be enumerated and capped at three blocks; guest rail should show sign-in/activation content rather than empty persisted-data panels.

Main risk: context rail steals focus from decision column. Rail capped at 3 blocks; decision column remains primary.

### Mindful Day Memory (`mindful-day-memory`)

Feasibility is high if scoped as S-30 phase 2 and formatter-only. Existing data already supports a narrative representation without new tRPC or Prisma queries.

Relevant data and UI:

- `DailyRecap` already has `last24Hours`, `todayPlan`, and `footprints` ([types.ts:25](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/8ca325ea8352b9404f30bd6c93900c7e290d532b/src/lib/recap/types.ts#L25)).
- `build-daily-recap.ts` builds completed/focused rows and the remaining plan ([build-daily-recap.ts:27-100](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/8ca325ea8352b9404f30bd6c93900c7e290d532b/src/lib/recap/build-daily-recap.ts#L27-L100)).
- Guest parity exists in the guest recap builder ([recap.ts:16](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/8ca325ea8352b9404f30bd6c93900c7e290d532b/src/lib/guest/recap.ts#L16)).
- The UI refactor lands in `daily-recap-panel.tsx` ([daily-recap-panel.tsx:89](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/8ca325ea8352b9404f30bd6c93900c7e290d532b/src/app/_components/daily-recap-panel.tsx#L89)).
- Current tests assert the old `Last 24 hours` / `Today` behavior and must be intentionally rewritten ([daily-recap-panel.test.tsx:37](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/8ca325ea8352b9404f30bd6c93900c7e290d532b/src/app/_components/daily-recap-panel.test.tsx#L37)).

Implementation approach:

- Add `format-day-memory.ts` as a pure formatter over `DailyRecap`.
- Output exactly three sections: `Domkniete`, `Zostaje`, `Wroc tutaj`.
- Use the latest footprint or last focused row for `Wroc tutaj` when available.
- Replace default timestamp-log presentation with one collapsed line and a three-section expanded narrative.
- Keep data shapes intact and avoid new server queries.

This should be a new roadmap row only if it carries explicit `merge_with S-30` / `S-30 phase 2` language. Otherwise it risks looking like a duplicate of shipped recap work.

### Stateful Illustration System (`stateful-illustration-system`)

Feasibility is medium-high if restricted to home hero and desktop rail. Existing Calm Garden assets are already present:

- [home-hero-sprig.tsx:5](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/8ca325ea8352b9404f30bd6c93900c7e290d532b/src/lib/design/illustrations/home-hero-sprig.tsx#L5)
- [empty-garden-bed.tsx:5](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/8ca325ea8352b9404f30bd6c93900c7e290d532b/src/lib/design/illustrations/empty-garden-bed.tsx#L5)
- [calm-garden-blob.tsx:12](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/8ca325ea8352b9404f30bd6c93900c7e290d532b/src/lib/design/illustrations/calm-garden-blob.tsx#L12)
- [calm-garden-sprig.tsx:12](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/8ca325ea8352b9404f30bd6c93900c7e290d532b/src/lib/design/illustrations/calm-garden-sprig.tsx#L12)
- [index.ts:1](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/8ca325ea8352b9404f30bd6c93900c7e290d532b/src/lib/design/illustrations/index.ts#L1)

Gate surfaces to avoid:

- [check-in-overlay.tsx:25](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/8ca325ea8352b9404f30bd6c93900c7e290d532b/src/app/_components/check-in-overlay.tsx#L25)
- [cycle-complete-overlay.tsx:117](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/8ca325ea8352b9404f30bd6c93900c7e290d532b/src/app/_components/cycle-complete-overlay.tsx#L117)
- [wind-down-overlay.tsx:28](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/8ca325ea8352b9404f30bd6c93900c7e290d532b/src/app/_components/wind-down-overlay.tsx#L28)
- [session-closure-overlay.tsx:22](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/8ca325ea8352b9404f30bd6c93900c7e290d532b/src/app/_components/session-closure-overlay.tsx#L22)

Implementation approach:

- Treat Phase A as absorption of S-28 phase 2 overlay scrim work.
- Treat Phase B as state-to-variant mapping for `idle`, `energy_choice`, `work`, `break`, `return`, and `closure`.
- Render only in home hero and desktop rail.
- Keep illustrations `aria-hidden`; text/status remains canonical.
- Use instant swap under reduced motion and <=200ms crossfade otherwise.

The plan must explicitly say the illustration never appears on S-39 gate controls and never delays S-34 optimistic transitions.

## Code References

- `src/app/_components/home-shell.tsx:87-93` - home shell and current generic headline.
- `src/app/_components/pomodoro-dashboard.tsx:303-443` - existing dashboard state derivation and single-column composition.
- `src/hooks/use-pomodoro-cycle.ts:3633` - cycle state surface feeding home/session derivation.
- `src/app/_components/task-suggestion-card.tsx:249` - suggestion heading copy zone.
- `src/app/_components/daily-recap-panel.tsx:89-120` - recap display surface and default expanded behavior.
- `src/lib/recap/types.ts:25` - existing `DailyRecap` shape.
- `src/lib/recap/build-daily-recap.ts:27-100` - existing recap data builder.
- `src/lib/guest/recap.ts:16` - guest recap parity.
- `src/lib/design/illustrations/*.tsx` - existing Calm Garden illustration primitives.
- `src/app/_components/*overlay.tsx` - gate surfaces that must not receive decorative illustrations.

## Architecture Insights

The strongest implementation pattern is to add pure derivation layers and keep the existing cycle/gate engine stable:

- `home-session-state` should derive user-facing home mode from current cycle/session facts.
- `home-module-priority` should map that mode to primary/secondary/hidden modules.
- `format-day-memory` should map existing `DailyRecap` data into narrative copy without changing data access.
- `state-to-illustration-variant` should map existing app mode to decorative `aria-hidden` visuals, never to workflow controls.

This keeps the UX/UI chapter within presentation, IA, and copy boundaries. It also avoids accidental expansion into new domain mechanics or duplicate shipped substrates.

Timer-hub caution applies before editing:

- `src/hooks/use-pomodoro-cycle.ts`
- `src/app/_components/pomodoro-dashboard.tsx`
- `src/lib/wedge/**`

Run:

```powershell
cd D:\repos\10xdev\FlowState; pnpm change-impact -- src/app/_components/pomodoro-dashboard.tsx
```

## Historical Context

The proposals intentionally build on already completed work:

- S-13, S-15, S-27, S-30, and S-31 created the current home/task/recap/focus shell surfaces ([roadmap.md:51-80](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/8ca325ea8352b9404f30bd6c93900c7e290d532b/context/foundation/roadmap.md#L51-L80)).
- S-28 introduced Calm Garden visual assets and deferred phase 2 overlay work ([roadmap.md:77](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/8ca325ea8352b9404f30bd6c93900c7e290d532b/context/foundation/roadmap.md#L77)).
- S-34 sets the optimistic transition constraint that S-43 motion must not delay ([roadmap.md:84](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/8ca325ea8352b9404f30bd6c93900c7e290d532b/context/foundation/roadmap.md#L84)).
- S-39 established accessible wedge gate constraints that S-43 must preserve ([roadmap.md:89](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/8ca325ea8352b9404f30bd6c93900c7e290d532b/context/foundation/roadmap.md#L89)).

Parked and merge constraints to carry forward:

- Preserve max one interstitial plus one gate; do not add ad-hoc overlays.
- S-42: S-30 phase 2 formatter only — no duplicate data pipeline.
- S-43: never on S-39 gate controls; must not delay S-34 optimistic path.
- P-104 session reconnect banner remains parked separately.

## Related Research

- `context/changes/roadmap-ux-ui-story-expand/batch-7-ux-ui-story-chapter.md` - source expand and refinement analysis.
- `context/changes/roadmap-ux-ui-story-expand/expand-refinement-summary.md` - accepted proposal summary and sequencing.
- `context/changes/roadmap-ux-ui-story-expand/parked-comparison.md` - parked/future-idea overlap analysis.
- `context/foundation/roadmap-references/items/S-30.md` - existing daily recap substrate and phase-2 relationship.
- `context/foundation/roadmap-references/items/S-28.md` - existing Calm Garden phase and deferred overlay relationship.

## Open Questions

1. Should roadmap `main_goal` move from quality hardening to a new label such as `ux-story`, or should the new stream stand alone until the roadmap patch is accepted?
2. Should `S-42` run before or after `S-43`? Hard constraints are clear (`F-14` first, `S-40` before `S-41`), but the source docs differ on the final ordering.
3. What is the concrete, deterministic substitute for the proposed "5-second purpose test" and ">=80% pass" acceptance? The app should not add analytics instrumentation for this.
4. Which exact three rail blocks are allowed in `S-41` for authenticated and guest users?
5. Which exact existing session/cycle states bind to the six `S-43` illustration variants?

## Suggested Verification

For implementation slices, start with targeted tests and then run the repo gates:

```powershell
cd D:\repos\10xdev\FlowState; pnpm exec vitest run src/app/_components/home-shell.test.tsx src/app/_components/pomodoro-dashboard.test.tsx src/app/_components/task-suggestion-card.test.tsx src/app/_components/daily-recap-panel.test.tsx src/app/_components/task-list.test.tsx src/lib/wedge/transition-conductor.test.ts
cd D:\repos\10xdev\FlowState; pnpm check
cd D:\repos\10xdev\FlowState; pnpm test
cd D:\repos\10xdev\FlowState; $env:CI="true"; pnpm test:e2e:belt
```
