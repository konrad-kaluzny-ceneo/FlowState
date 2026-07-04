# Task Edit Interaction Fixes — Plan Brief

> Full plan: `context/changes/task-edit-interaction-fixes/plan.md`
> Research: `context/changes/task-edit-interaction-fixes/research.md`

## What & Why

Post-MVP defects D-08 and D-09: users report horizon "Gdy się da" (`WHEN_POSSIBLE`) as not clickable, and preset names (e.g. "Gaszenie") disappearing from task badges after edit. D-09 has a confirmed code cause (display oracle demotes to "Własny" per obsolete S-36 rule + guest hook drops `personaPresetId`). D-08 wiring is correct; fixes target UX clarity, hit targets, blur-save race, and missing tests.

## Starting Point

- `getTaskBadgeDisplayMode` returns `"custom-detail"` when attrs diverge from preset bundle despite stored `personaPresetId` (`persona-presets.ts:176-198`).
- Guest `createTask` omits `personaPresetId` (`use-task-mutations.ts:496-506`).
- Horizon SegmentedControl works but WHEN_POSSIBLE active styling ≈ inactive (`task-fields-panel.tsx:152`); task row uses `overflow-hidden` (`task-list.tsx:338`); blur-save may race on Safari (`task-list.tsx:407-412`).
- Work-type SegmentedControl has component test; horizon path has none.

## Desired End State

Preset label persists on tasks with a valid stored preset id (auth + guest), including after inline attribute edits. Horizon "Gdy się da" is visually distinct when selected, clickable in inline edit at mobile widths, and survives blur-save on touch browsers. Full test suite and e2e belt green.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Badge when attrs diverge | Always `"persona"` for valid catalog id | Product decision D-09 overrides S-36 demotion rule | Research |
| Diverged display detail | Preset label + effort only (no fourth mode) | Simplest fix matching "preset name visible" requirement | Plan |
| Guest create | Forward `personaPresetId` in hook | Confirmed gap; repo already supports field | Research |
| WHEN_POSSIBLE active color | `bg-worktype-ops-bg text-worktype-ops-text` | Reuses existing token; matches ASAP/THIS_WEEK pattern | Plan |
| Edit row overflow | Drop `overflow-hidden` while editing | Plausible hit-target clipping at narrow widths | Research |
| Blur-save | Deferred commit + cancel on in-panel pointerdown | Belt-and-suspenders for Safari `relatedTarget=null` | Research / Plan |
| Create custom panel | Out of scope | `markCreateFormCustom()` sending `"custom"` is separate create-flow behavior | Research |

## Scope

**In scope:** D-09 oracle revision, guest hook parity, D-08 styling/overflow/blur hardening, component tests, belt, manual repro checklists.

**Out of scope:** Create-form Własny panel semantics, D-10 vocabulary, D-04 illustrations, schema/tRPC changes, clearing `personaPresetId` on edit.

## Architecture / Approach

Display fix is isolated to `getTaskBadgeDisplayMode` + `TaskBadges` consumer (no persistence change). Guest parity is one field in guest create branch. D-08 changes are localized to `task-fields-panel.tsx` colorMap, conditional `<li>` overflow in `task-list.tsx`, and deferred blur timer on edit panel — preserving existing `commitEditIfDirty` and document `pointerdown` from fix-task-edit-blur-save.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. D-09 oracle + guest | Preset badge survives edit; guest parity | Test expectation churn on divergence case |
| 2. D-08 UX + overflow | Distinct WHEN_POSSIBLE color; horizon component test | Overflow change affects drag/animation clipping |
| 3. Blur hardening | Safari-safe deferred blur commit | Timer edge cases if over-deferred |
| 4. Belt + repro | Full gates + manual checklist | None — verification only |

**Prerequisites:** Wave 1 (`task-ui-quick-fixes`) not blocking; can run on `features/task-edit-interaction-fixes` branch.

**Estimated effort:** ~2 sessions across 4 phases.

## Open Risks & Assumptions

- D-08 primary user repro may have been UX-only (already on WHEN_POSSIBLE); styling fix may be sufficient without blur hardening.
- Create-form path (preset → Własny → change attrs → Add) still shows "Własny" by design — not a bug for this change.
- No dedicated e2e for horizon chips; component tests are the automated oracle.

## Success Criteria (Summary)

- "Gaszenie" badge visible after create and after inline edit that changes non-effort attrs.
- Guest preset tasks show persona badge.
- Horizon chip click in inline edit updates and saves WHEN_POSSIBLE with visible active state.
- `pnpm test` and e2e belt green.
