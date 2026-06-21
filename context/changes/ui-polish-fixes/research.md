---
date: 2026-06-21T00:00:00+02:00
researcher: Auto (Cursor Agent)
git_commit: fb247917616d8d6bee6e1266f252b0a212cbd483
branch: features/fix-graceful-session-end-while-running
repository: FlowState
topic: "UI polish batch — beige palette, task editing, icons, overlay simplification"
tags: [research, codebase, design-tokens, task-list, timer-panel, overlays, lucide-react]
status: complete
last_updated: 2026-06-21
last_updated_by: Auto (Cursor Agent)
---

# Research: UI polish batch — beige palette, task editing, icons, overlay simplification

**Date**: 2026-06-21
**Researcher**: Auto (Cursor Agent)
**Git Commit**: `fb247917616d8d6bee6e1266f252b0a212cbd483`
**Branch**: `features/fix-graceful-session-end-while-running`
**Repository**: FlowState

## Research Question

Map the codebase for nine UI polish items logged in `change.md`:

1. Replace purple primary with friendly beige (Impeccable-aligned)
2. Daily recap dismiss — "Close" or X icon instead of "Not now"
3. Daily standing checkbox — styled + default `true`
4. Unify task edit styling with task create
5. Allow editing completed tasks (currently blocked)
6. Replace strikethrough on completed tasks with clearer, more readable done-state
7. Add icons to session/task buttons (icon-only where obvious)
8. Style focus timer card ("Ready to focus on" / "Focusing on")
9. Simplify out-of-tab break alerts to a single styled checkbox

## Summary

FlowState already uses a **semantic token architecture** (`globals.css` `@theme` → Tailwind utilities). A beige primary is primarily a **token + DESIGN.md recolor** (~2 files + 2 hardcoded purple lines in `pomodoro-dashboard.tsx`), not a component rewrite. The current plum CTA (`#5E5290`) was chosen deliberately in F-06 Serene Pastel rebrand; shell neutrals are already warm linen with **lavender tint** — swapping to beige requires retinting neutrals toward a new brand hue, not dropping in generic cream/sand.

Overlay fixes are **localized**: daily recap dismiss (`daily-recap-panel.tsx`), daily standing toggle (`task-list.tsx`), break alerts control (`out-of-tab-break-alerts-control.tsx`). Do not conflate break-alerts **settings** with the first-session **permission overlay** (`break-alerts-permission-prompt.tsx`).

Task create vs edit diverge inside **`task-list.tsx` only** (~1,257 lines): create uses bordered `<input>` + persona presets; edit uses borderless `<textarea>` + full attribute panel always visible. Completed tasks are excluded from `SortableActiveTaskRow` by list split — **UI-only guard**, server accepts updates on completed tasks. Strikethrough appears on both `doneForToday` active rows and completed-section rows.

Session buttons have **no lucide icons** except `persona-preset-picker.tsx`. Established icon-only precedent: delete (`✕`), drag (`⋮⋮`), mark-complete (empty box) — all with `aria-label`. Timer focus card uses lighter styling than DESIGN.md overlay/card spec (no shadow, smaller title tier).

**Recommended plan phasing:**

| Phase | Items | Risk |
| --- | --- | --- |
| P1 | Token recolor + DESIGN.md (1) | Contrast / a11y — run `pnpm test:e2e:a11y` |
| P2 | Shared checkbox + daily standing default (3, 9 partial) | DB default optional; tests assume `false` today |
| P3 | Daily recap close (2), break alerts simplify (9) | Low |
| P4 | TaskFieldsPanel extract + create/edit unify (4) | Medium — large file, L-04 per-surface tests |
| P5 | Completed edit + done-state styling (5, 6) | Product decision on completed-section UX |
| P6 | Icon-only buttons + timer card polish (7, 8) | E2E uses role names for Add/Focus/Interrupt |

## Detailed Findings

### 1. Primary color — purple → beige

**Token hub:** `src/styles/globals.css:3-62` (light), `:65-113` (dark). No `tailwind.config.*` — Tailwind v4 CSS-first via `postcss.config.js` + `layout.tsx` import.

**Purple/plum tokens to retune:**

| Token | Light value | Lines |
| --- | --- | --- |
| `accent-cta` / `accent-cta-hover` | `#5e5290` / `#6e619f` | `globals.css:33-34` |
| `segment-active` | `#5e5290` | `globals.css:41` |
| `focus-ring` | `#7c6ead` | `globals.css:30` |
| `energy-steady` (+ border/bg) | `#5e5290` derivations | `globals.css:48-50` |

**Shell neutrals already warm but lavender-tinted:**

| Token | Value | Notes |
| --- | --- | --- |
| `shell-top` | `#faf8f5` | Linen — already in Impeccable "cream band" warning zone |
| `shell-bottom` | `#f0ebf8` | Lavender gradient end |
| `surface-card-muted` | `#f5f3f8` | Lavender-gray |
| `border-subtle` | `#e5e0eb` | Lavender-gray border |

**Hardcoded purple leak:** `pomodoro-dashboard.tsx:407,534` — `border-purple-400/30 bg-purple-500/10 text-purple-100/90` (break transition + override ack). Must migrate to semantic tokens.

**Component impact:** ~15 files use `bg-accent-cta`, `text-accent-cta`, `bg-segment-active`, `ring-focus*` — all inherit new values automatically if token **names** are preserved.

**Impeccable constraints for beige:**

- Do not swap plum → generic cream/sand body bg
- Tint neutrals toward beige brand hue (OKLCH chroma 0.005–0.015)
- Re-validate `on-cta` — beige fill may need **ink text** (`text-primary`) instead of white
- Keep semantic accents (break teal, success green, suggestion amber) unless they clash
- Resolve `ring-focus` vs `--color-focus-ring` naming (components use `ring-focus`; CSS defines `--color-focus-ring` only)

**Design contract:** `DESIGN.md:4-37` YAML + `:109-176` strategy prose documents "Restrained + muted plum-lavender primary". Update alongside `globals.css`.

### 2. Daily recap dismiss

**Component:** `src/app/_components/daily-recap-panel.tsx` — inline panel on timer hub, not modal.

**Mount:** `pomodoro-dashboard.tsx:551-555`

**Dismiss button:** `:96-104` — visible text `"Not now"`, `aria-label="Dismiss daily recap"`, `data-testid="daily-recap-dismiss"`.

**Behavior:** `sessionStorage` key `flowstate:daily-recap-dismiss:{localDateKey}` = `"1"`; per local calendar day; no undo.

**Change surface:** Replace label with `"Close"` or lucide `X` icon-only + keep `aria-label`. E2E uses testid (`e2e/daily-work-timing-recap.spec.ts:78`) — stable. Unit test `daily-recap-panel.test.tsx:71-78` may need update if asserting visible text.

### 3. Daily standing checkbox

**Component:** `DailyStandingToggle` in `task-list.tsx:260-278` — native `<input type="checkbox">` with label only; **no custom styling**.

**Usage:** Create form `:1053-1056`, edit panel `:599-602`. Badge when flagged: `:644-650` (`"Daily"`).

**Defaults (all `false` today):**

| Layer | Location |
| --- | --- |
| Create form state | `task-list.tsx:752,763` |
| Edit form initial | `task-list.tsx:791` |
| Domain helper | `src/lib/data-mode/types.ts:14,22` |
| Prisma | `prisma/schema.prisma:77` `@default(false)` |
| Guest repo | `guest-repositories.ts:145` |

**Recommendation:** Extract shared `StyledCheckbox` (used also by item 9). UI default `true` in create form; optional Prisma migration for DB default. Update `task-list.test.tsx`, `e2e/daily-standing-capacity.spec.ts` if they assume unchecked-by-default.

### 4. Task create vs edit styling

All in `task-list.tsx`:

| Aspect | Create (`:994-1130`) | Edit (`:528-603`) |
| --- | --- | --- |
| Title control | `<input type="text">` | `<textarea rows={2}>` (B-02) |
| Title chrome | `rounded-lg border border-border-subtle bg-surface-card px-4 py-2` | `rounded bg-surface-panel px-2 py-1` (no border) |
| Persona presets | `PersonaPresetPicker` (create-only, S-29) | Absent — always full Eisenhower panel |
| Container | Top `<form>` | Inline `<div>` inside row |
| Commit | Form submit | Blur, pointerdown, Enter, Focus switch |

**Unification path:** Extract `TaskFieldsPanel` + `useTaskDraft` hook; keep persona presets create-only; align title field to bordered card style for both modes; consider `<textarea>` for create too (B-02 parity). See L-04 — add component test for title control if changed.

### 5. Completed task editing blocked

**Three lock layers:**

1. **`status === "completed"`** — structural. Active/completed split at `task-list.tsx:803-804`. Completed section `:1200-1254` uses plain `<li>` with read-only `<span>` — no edit wiring.
2. **`cycleLocked`** — blocks active-row edit during running/paused/completed cycle (`:805-808`, `:606-612`). Does not affect completed section except revert/delete.
3. **`doneForToday`** — does **not** block edit on active rows.

**Server:** `src/server/api/routers/task.ts:127-185` — no status guard on field updates. Enabling completed-task edit is **UI-only** work.

**Options:** (a) Allow click-to-edit in completed section; (b) Add explicit "Edit" action; (c) Move completed row into shared row variant with `variant: 'completed'`.

### 6. Completed / done-state styling

| State | Location | Current styling |
| --- | --- | --- |
| `doneForToday` (active) | `task-list.tsx:466,609,654` | Row `opacity-60`; title `line-through opacity-70`; badges dimmed |
| `status === "completed"` | `task-list.tsx:1208,1224` | `bg-surface-card-muted`; title `text-text-secondary line-through` |
| Animation | `task-list.tsx:465,796-801`; `globals.css:127-157` | `animate-task-complete` pulse |

**DESIGN.md spec:** `:197-204` — completed row `text-text-dimmed` + `line-through` (codified strikethrough).

**Alternatives already in codebase:** `TaskBadges` dimming via `opacity-60` without strikethrough (`:102`); muted card background; daily recap uses "Done today" label without strikethrough.

**Recommendation:** Drop `line-through`; use `text-text-dimmed` + muted row bg + optional checkmark icon (reuse mark-complete visual). Keep `animate-task-complete` on transition. Update DESIGN.md task hierarchy table.

### 7. Button icons

**Icon library:** `lucide-react` ^1.18.0 — **only** `persona-preset-picker.tsx:3-13`. No shared `IconButton`.

| Button | File:lines | E2E contract |
| --- | --- | --- |
| Pause | `timer-panel.tsx:163-170` | `data-testid="timer-pause"` ✓ |
| Interrupt | `timer-panel.tsx:171-178` | role name `"Interrupt"` |
| Resume | `timer-panel.tsx:152-160` | testid |
| Focus | `task-list.tsx:663-674` | role name `"Focus"` |
| Add | `task-list.tsx:1032-1038` | role name `"Add"` |
| End session | `pomodoro-dashboard.tsx:680-689` | `data-testid="end-session-btn"` ✓ |

**Icon-only precedent:** delete/drag/mark-complete in `task-list.tsx` with `aria-label`.

**Suggested lucide mapping:** Pause/`Pause`, Resume/`Play`, Interrupt/`Square`, Focus/`Target`, Add/`Plus`, End session keep text or `LogOut` + aria-label.

**Optional:** Small `icon-button.tsx` helper — not required for this slice.

### 8. Focus timer card styling

**Location:** `timer-panel.tsx:126-209` — inline card, not popover.

| State | Copy | Lines |
| --- | --- | --- |
| Idle | "Ready to focus on" + title | `:199-209` |
| Running work | "Focusing on" + title | `:130-142` |
| Break | "Short Break" / "Long Break" | `:130-137` |

**Gaps vs DESIGN.md:**

| Spec | Actual | Fix |
| --- | --- | --- |
| Card `border-card-border shadow-sm` (`DESIGN.md:224`) | `border-border-subtle`, no shadow | Add `shadow-sm`, use `card-border` |
| Overlay heading `text-2xl font-semibold` | Title `text-lg font-medium` | Bump title tier or add section label |
| Destructive interrupt filled red (`DESIGN.md:250`) | Outline + red text hover | Align interrupt styling |

Mount: `pomodoro-dashboard.tsx:433-450`.

### 9. Out-of-tab break alerts simplification

**Settings control:** `out-of-tab-break-alerts-control.tsx` — mounted via `timer-panel.tsx:181-187,244-248`.

**Current structure:**

| Element | Lines | Copy |
| --- | --- | --- |
| Fieldset legend (title) | `:48-49` | "Out-of-tab break alerts" |
| Status paragraph | `:51-56` | Three-state label from `preference-status.ts:23-31` |
| Checkbox | `:57-66` | "Alert me when break starts (other tab)" |
| Extra — denied | `:67-82` | Blocked browser copy + "Try again" |
| Extra — default permission | `:83-88` | Permission hint |

**Default:** enabled `true` when unset (`storage.ts:49-65`, `timer-panel.tsx:76-77`).

**Simplification:** Remove legend + status `<p>`; keep styled checkbox + intent label; show `:67-88` blocks **only** on permission denied / error. Update `out-of-tab-break-alerts-control.test.tsx` status assertions.

**Separate surface:** `break-alerts-permission-prompt.tsx` — first-session overlay with its own "Not now" (`:54-61`). Out of scope for item 9 unless product wants consistency pass.

## Code References

- `src/styles/globals.css:3-62` — light theme semantic tokens (primary recolor hub)
- `src/styles/globals.css:65-113` — dark theme overrides
- `DESIGN.md:4-37,109-176,197-204` — design contract for colors + task hierarchy
- `src/app/_components/pomodoro-dashboard.tsx:407,534` — hardcoded purple classes
- `src/app/_components/daily-recap-panel.tsx:96-104` — "Not now" dismiss
- `src/app/_components/task-list.tsx:260-278` — unstyled DailyStandingToggle
- `src/app/_components/task-list.tsx:528-603` — edit panel
- `src/app/_components/task-list.tsx:994-1130` — create form
- `src/app/_components/task-list.tsx:803-804,1200-1254` — active/completed split
- `src/app/_components/task-list.tsx:609,1224` — strikethrough classes
- `src/app/_components/timer-panel.tsx:126-209` — focus timer card
- `src/app/_components/timer-panel.tsx:152-178` — Pause/Interrupt/Resume
- `src/app/_components/out-of-tab-break-alerts-control.tsx:48-88` — verbose break alerts UI
- `src/app/_components/persona-preset-picker.tsx:3-13` — sole lucide-react consumer
- `src/server/api/routers/task.ts:127-185` — update handler (no completed-status block)
- `src/lib/break-out-of-tab-alert/preference-status.ts:8-31` — three-state status labels

## Architecture Insights

1. **Semantic tokens first** — F-06 rebrand established `@theme` as single runtime source; palette changes are token-layer work with high leverage.
2. **Monolithic task-list** — create, edit, active row, completed row, badges, and DnD all live in one file; unification benefits from extraction before further feature work.
3. **Icon pattern is ad hoc** — unicode symbols for task actions; lucide only on persona presets. New icons should follow delete/drag precedent: `aria-label` required when text removed.
4. **Overlay vs inline panels** — daily recap and timer card are inline hub surfaces; wedge overlays use `overlay-shell.tsx` with different padding/heading tiers. Timer card should either align with overlay spec or be documented as "hub card" tier.
5. **E2E mixed selectors** — some actions use testids (pause, end session), others use accessible names (Add, Focus, Interrupt). Icon-only changes must preserve `aria-label` matching current names or update e2e helpers.

## Historical Context (from prior changes)

- `context/archive/2026-06-12-serene-pastel-rebrand/research.md` — F-06 deliberately chose plum `#5E5290` as restrained accent; auth migrated to `accent-cta`. This slice **revises** that decision toward beige.
- `context/archive/2026-06-12-serene-pastel-rebrand/plan.md:189` — codified completed row `line-through` + `text-text-dimmed`; item 6 intentionally diverges from shipped spec.
- `context/archive/2026-06-11-impeccable-design-foundation/research.md` — early task list used `line-through` on dark theme; pattern predates Serene Pastel.
- `context/foundation/lessons.md` L-04 — per-surface 200ms / component test oracles when changing interactive controls (applies to task title field unification).

## Related Research

- `context/archive/2026-06-12-serene-pastel-rebrand/research.md` — token architecture baseline
- `context/archive/2026-06-13-task-create-persona-presets/research.md` — create-only persona presets (edit scope boundary)
- `context/archive/2026-06-11-impeccable-design-foundation/research.md` — Impeccable integration origin

## Open Questions

1. **Beige hue direction:** Warm taupe vs cool stone vs olive-beige? Needs one Impeccable scene sentence + OKLCH palette mock before plan (run `/impeccable colorize` or palette script during plan phase).
2. **Daily standing DB default:** UI-only default `true` vs Prisma `@default(true)` migration — affects existing rows?
3. **Completed task edit UX:** Inline edit in Completed section vs "Revert to active" then edit vs unified row component?
4. **Done-state without strikethrough:** Checkmark + dim text only, or move completed tasks to collapsible section with no title mutation?
5. **End session icon-only:** Footer button is high-discoverability — keep text or icon+tooltip?
6. **`ring-focus` utility:** Verify compiled Tailwind output for `ring-focus` vs `ring-focus-ring`; add alias if broken.
7. **Break alerts permission overlay:** Include "Not now" → "Close"/X consistency in this slice or defer?
