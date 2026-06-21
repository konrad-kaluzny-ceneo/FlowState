# UI polish — beige palette, task editing, icons, simplified overlays — Plan Brief

> Full plan: `context/changes/ui-polish-fixes/plan.md`
> Research: `context/changes/ui-polish-fixes/research.md`

## What & Why

FlowState's timer hub and task list have accumulated small UI inconsistencies — a plum accent the user finds harsh, mismatched create/edit task chrome, unreadable strikethrough on done tasks, unstyled checkboxes, verbose break-alert settings, and session buttons missing obvious icons. This slice delivers a cohesive cool-stone beige palette and targeted UX polish across nine logged items without touching backend contracts or wedge transition logic.

## Starting Point

The app uses a semantic token architecture (`globals.css` `@theme` → Tailwind utilities) established in F-06 Serene Pastel, with plum `#5E5290` as CTA accent and lavender-tinted shell neutrals. Task create and edit diverge inside monolithic `task-list.tsx`; completed tasks render read-only in a separate section; lucide-react is only used on persona presets. Research mapped every touch point and confirmed server accepts updates on completed tasks — locks are UI-only.

## Desired End State

Users open a calm cool-stone interface where CTAs, focus rings, and shell gradients feel cohesive (not plum-on-lavender). Creating and editing tasks share the same bordered field panel; completed tasks are editable on click and show done state via dim text plus a checkmark (no strikethrough). Daily standing and break-alert toggles use a styled shared checkbox (standing defaults on for new tasks). Daily recap is a raised hub card with lucide X dismiss (no subtitle); Last 24h omitted when empty; Today uses chevron toggles without link underline. Session controls use icon-only buttons where intent is obvious (Pause, Add, Focus, Interrupt) while End session keeps its label. The timer focus card matches DESIGN.md elevation and typography tiers.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Beige hue family | Cool stone (OKLCH h ~95–110) | Retints lavender shell toward a restrained stone accent without generic cream body bg | Plan |
| Daily standing default | UI-only `true` on create form | New tasks default checked without migrating existing DB rows | Plan |
| Completed task editing | Click-to-edit in Completed section | Lowest-friction path; server already allows field updates | Plan |
| Done-state styling | Dim text + checkmark icon, no strikethrough | Keeps titles readable while signaling completion | Plan |
| Icon policy | Icon-only for Pause/Add/Focus/Interrupt; End session keeps text | High-discoverability footer action stays labeled; obvious controls gain icons | Plan |
| Scope boundary | Core 9 items only | Defer break-alerts permission overlay "Not now" consistency to a follow-up | Plan |
| Daily recap dismiss | lucide `X` icon-only + `aria-label` | Matches change.md item 2 (“even better icon X”); testid stable; no visible “Close” text | Plan (post–Phase 1 feedback) |
| Daily recap layout | Raised card + omit empty Last 24h + chevron toggles | Phase 1 tokens exposed flat panel; reduce copy; section UX without link underline | Plan (post–Phase 1 feedback) |
| Task unification depth | Extract `TaskFieldsPanel`; persona presets create-only | Aligns chrome without expanding edit scope to presets (S-29 boundary) | Research / Plan |

## Scope

**In scope:**

- Cool stone token recolor in `globals.css` + `DESIGN.md`; fix hardcoded purple in `pomodoro-dashboard.tsx`
- Shared `StyledCheckbox` for Daily standing + out-of-tab break alerts
- Daily standing UI default `true`; styled toggle
- Break alerts settings simplified to checkbox + error-only extras
- Daily recap visual polish: raised card elevation, lucide X dismiss, no subtitle, omit Last 24h when empty, chevron section toggles
- Task create/edit field panel unification
- Completed-section click-to-edit
- Done-state: remove strikethrough, add checkmark visual
- lucide icons on Pause, Resume, Interrupt, Focus, Add
- Timer focus card elevation/typography polish

**Out of scope:**

- Prisma migration for `isDailyStanding @default(true)`
- Break-alerts first-session permission overlay copy (`break-alerts-permission-prompt.tsx`)
- Wedge transition conductor / F-07 overlay stack changes
- New `IconButton` abstraction (optional helper only if duplication warrants)
- Analytics, scoring, or suggestion logic changes

## Architecture / Approach

Palette change is token-layer only — preserve semantic token names so ~15 consuming components inherit new values automatically. Retint shell neutrals from lavender toward cool stone chroma (0.005–0.015 per Impeccable) rather than swapping to generic cream. UI work centers on `task-list.tsx` extraction (`TaskFieldsPanel`) and localized overlay/timer edits. E2E contracts preserve `data-testid` values; icon-only buttons must keep `aria-label` matching current accessible names (Add, Focus, Interrupt, Pause, Resume).

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Cool stone token recolor | Beige palette + DESIGN.md + purple hardcode fix | CTA contrast / a11y regression on light shell |
| 2. Shared checkbox + alerts | StyledCheckbox, standing default, simplified break alerts | Tests assume unchecked standing default today |
| 3. Daily recap visual polish | Raised card, X dismiss, no subtitle, omit empty Last 24h, chevron toggles | Unit tests assume Last 24h always present + empty-state copy today |
| 4. Task create/edit unify | TaskFieldsPanel extraction, aligned bordered chrome | Large file touch; L-04 component test for title control |
| 5. Completed edit + done-state | Click-to-edit completed rows; checkmark + dim, no strikethrough | Completed row must reuse edit commit paths |
| 6. Icons + timer card | lucide icon-only session buttons; timer card elevation | E2E role-name selectors for Add/Focus/Interrupt |

**Prerequisites:** Research complete (`research.md`); feature branch `features/ui-polish-fixes`.
**Estimated effort:** ~2–3 implementation sessions across 6 phases.

## Open Risks & Assumptions

- Cool stone CTA may need ink (`text-primary`) on-cta instead of white — validate contrast after token pick.
- `ring-focus` utility may lack a `--color-focus` alias in `@theme`; Phase 1 adds alias if ring color is invisible.
- `task-list.tsx` size (~1,257 lines) makes Phase 4 the highest regression surface — run targeted Vitest + belt e2e after.
- Icon-only buttons rely on `aria-label`; e2e specs using `getByRole('button', { name: 'Focus' })` remain valid via aria-label.

## Success Criteria (Summary)

- Visual: plum accent replaced by cool stone beige across shell, CTAs, and focus ring; no hardcoded purple classes remain.
- Task UX: create and edit share bordered field styling; completed tasks editable on click; done tasks readable without strikethrough.
- Controls: styled checkboxes with standing default-on for new tasks; break alerts settings reduced to intent checkbox plus error states only.
- Session hub: obvious action buttons have icons; timer focus card matches DESIGN.md card elevation spec; `pnpm check`, `pnpm test`, belt e2e, and a11y e2e pass.
