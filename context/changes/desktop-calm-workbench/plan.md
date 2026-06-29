# Desktop Calm Three-Zone Workbench Implementation Plan

## Overview

Implement S-41 as the first responsive desktop breakpoint in FlowState's home surface. At `lg >= 1024px`, the home becomes a centered calm workbench with a visually primary decision column, task inventory, and a capped context rail; below `lg`, the S-40 mobile-first priority order remains unchanged.

## Current State Analysis

S-40 already provides the layout-agnostic home IA via `deriveHomeSessionState`, and `PomodoroDashboardBody` renders the result through two structural regions: `home-primary-region` and `home-secondary-region`. The current product has no responsive breakpoint usage in `src/`, and two width caps keep the home at mobile width even on desktop: the shell `container` in `src/app/_components/home-shell.tsx` and the dashboard root `max-w-lg` in `src/app/_components/pomodoro-dashboard.tsx`.

The implementation is presentation/composition only. It must not alter session-state derivation, cycle state, wedge sequencing, tRPC data loading, Prisma schema, or persisted data.

## Desired End State

At desktop width, the dashboard renders a centered 1120-1280px workbench. The decision column occupies roughly 60-65% of the visual width, inventory remains subordinate to the decision path, and a right rail contains no more than three contextual blocks. Authenticated users see the rail illustration slot, collapsed S-30 recap line, and S-27 standing/focus-hours summary. Guests see sign-in value, activation/merge guidance, and calm empty-state guidance, without empty persisted-data panels.

Below `lg`, users see the same S-40 single-column priority order they see today. Structural tests prove region membership, rail block caps, mode-specific rail content, and preservation of one dominant primary CTA; jsdom does not need pixel measurement.

### Key Discoveries:

- `src/lib/home/home-session-state.ts:320-327` owns the pure S-40 IA derivation and stays unchanged.
- `src/app/_components/pomodoro-dashboard.tsx:83-98` is the local region wrapper seam for adding a third structural zone.
- `src/app/_components/pomodoro-dashboard.tsx:762-833` currently renders primary and secondary regions; S-41 splits secondary context from inventory at `lg` while preserving mobile order.
- `src/app/_components/home-shell.tsx:95` and `src/app/_components/pomodoro-dashboard.tsx:763` are the two desktop width blockers.
- `src/app/_components/pomodoro-dashboard.tsx:835-975` contains wedge overlays and end-session controls that must remain outside the desktop grid.
- `src/app/_components/pomodoro-dashboard.test.tsx:1047-1258` contains the existing S-40 structural oracle to extend.

## Decisions

| Decision | Choice | Rationale | Confidence |
| --- | --- | --- | --- |
| Responsive introduction | Additive `lg:` classes only; mobile remains default | This is the first breakpoint in the codebase, and S-41 explicitly preserves S-40 below 1024px | High |
| IA ownership | Reuse `deriveHomeSessionState` unchanged | S-40 deliberately made the matrix layout-agnostic for S-41 | High |
| Desktop split | Prototype around a ~62/38 decision-vs-rail split, with rail capped at <=40% | Matches S-41 acceptance while leaving enough space for calm context | Medium |
| Inventory placement | Keep inventory under the decision column at desktop, not as a co-primary middle column | Preserves the "Co teraz?" decision path and keeps inventory subordinate | Medium |
| Guest banner | Keep current header guest banner below `lg`; at `lg`, suppress the header placement and render guest value/activation content in the rail | Avoids duplicated sign-in messaging on desktop while keeping current mobile behavior | High |
| Collapsed recap line | Use the existing S-30 `DailyRecapPanel` collapsed state in the rail; do not consume `DayMemory.*` | `DayMemory.*` is reserved for S-42; S-41 only re-flows shipped recap content | High |
| Auth focus summary | Add a display-only rail summary for S-27 focus/standing facts; do not use `FocusBudgetPrompt` as the accepted summary block | `FocusBudgetPrompt` is a setup prompt and returns `null` once a budget exists, so it cannot satisfy the always-contextual "standing/focus-hours text summary" acceptance contract | High |
| Stateful art | Define a static `HomeHeroSprig` rail slot; leave stateful illustration behavior to S-43 | S-43 can parallelize once the rail slot exists | High |
| Test layer | Component RTL structural tests only; no new e2e belt row | S-41 is layout over unchanged behavior, and jsdom can assert structure/classes better than pixels | High |

## What We're NOT Doing

- No changes to `src/lib/home/home-session-state.ts` behavior or module priority rules.
- No changes to `src/hooks/use-pomodoro-cycle.ts`, `src/lib/wedge/**`, transition-conductor priority, session gates, or overlay sequencing.
- No Prisma schema, tRPC router, or data-fetching changes.
- No new Playwright belt scenario or full-catalog e2e row.
- No S-42 `DayMemory.*` namespace consumption and no S-43 stateful illustration logic.
- No visual pixel assertions in jsdom; desktop width is verified structurally through classes and region membership.

## Implementation Approach

Use the existing S-40 renderer as the source of truth and add a desktop-only physical layout layer. The root shell and dashboard root widen at `lg`; the dashboard body introduces a workbench wrapper that remains a single column below `lg` and becomes a desktop grid at `lg`. Existing modules are assigned to three structural regions: decision, inventory, and context rail. Rail blocks branch by `dataMode` and are capped by construction.

## Critical Implementation Details

Before editing `src/app/_components/pomodoro-dashboard.tsx`, run `cd D:\repos\10xdev\FlowState-desktop-calm-workbench; pnpm change-impact`. The output is advisory, but the command is required by `AGENTS.md` because this file is timer-hub maintained.

Keep all wedge overlays and fixed/absolute gate surfaces outside the new grid. The desktop workbench wraps persistent inline modules only; layout is not a transition beat.

## Phase 1: Desktop Workbench Frame

### Overview

Create the desktop responsive frame and zone contracts without adding final rail content. This phase widens both width caps, introduces the `lg` grid, preserves mobile order, and keeps overlays outside the grid.

### Changes Required:

#### 1. Timer-Hub Impact Preflight

**File**: `context/changes/desktop-calm-workbench/plan.md`

**Intent**: Record and require the timer-hub maintainer preflight before implementation touches `pomodoro-dashboard.tsx`.

**Contract**: The implementer runs `cd D:\repos\10xdev\FlowState-desktop-calm-workbench; pnpm change-impact` before the first code edit to `src/app/_components/pomodoro-dashboard.tsx`.

#### 2. Shell Desktop Width

**File**: `src/app/_components/home-shell.tsx`

**Intent**: Let the page shell host a centered desktop workbench while retaining the current mobile-first centered stack.

**Contract**: The shell container at the home main content widens only at `lg` to support a 1120-1280px dashboard. The `#home-shell-main` id, data-attribute hooks, header content, and guest mobile banner behavior stay intact.

#### 3. Dashboard Workbench Regions

**File**: `src/app/_components/pomodoro-dashboard.tsx`

**Intent**: Add structural zones for decision, inventory, and context rail while preserving the existing S-40 primary/secondary order below `lg`.

**Contract**: `HomeLayoutRegion` or a nearby wrapper supports a new `home-context-rail` test id and a desktop workbench parent. The dashboard root widens from `max-w-lg` to a desktop max width at `lg`, stays single-column below `lg`, and applies a desktop grid at `lg`.

#### 4. Overlay Boundary

**File**: `src/app/_components/pomodoro-dashboard.tsx`

**Intent**: Keep transition gates, catch-up banners, sync recovery, and end-session controls outside the desktop grid.

**Contract**: The grid contains only persistent inline modules. Existing overlay render conditions and handlers remain after the grid block and are not moved into `home-primary-region`, inventory, or `home-context-rail`.

### Success Criteria:

#### Automated Verification:

- S-41 acceptance "Centered 1120-1280px workbench at lg>=1024": component/class assertions verify widened shell and dashboard root include desktop-only max-width/grid classes.
- S-41 acceptance "Decision column visually primary; rail never >~40% width": component/class assertions verify the desktop grid template encodes the chosen ~62/38 split or equivalent rail cap.
- S-41 acceptance "below 1024px collapses to S-40 priority order": existing `home-primary-region` / `home-secondary-region` tests still pass without changing `deriveHomeSessionState`.
- Timer-hub rule: `pnpm change-impact` is run before `pomodoro-dashboard.tsx` edits.

#### Manual Verification:

- On a desktop browser width, the dashboard appears centered and wider than the mobile card stack.
- On a mobile/narrow viewport, the current S-40 order and spacing are unchanged.
- Wedge overlays and end-session controls still appear centered and not clipped by grid columns.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Authenticated And Guest Rail Content

### Overview

Populate the context rail with the accepted mode-specific content and cap it at three blocks by construction. Authenticated rail uses existing shipped data/components; guest rail uses sign-in/activation content and calm guidance only.

### Changes Required:

#### 1. Authenticated Rail

**File**: `src/app/_components/pomodoro-dashboard.tsx`

**Intent**: Render the authenticated rail as contextual support, not a second decision surface.

**Contract**: The authenticated `home-context-rail` contains at most three blocks: a static `HomeHeroSprig` illustration slot, the existing S-30 `DailyRecapPanel` collapsed by default, and a display-only S-27 standing/focus-hours text summary derived from existing `dayPlan` / standing-task facts. It does not use the `DayMemory.*` namespace. Do not use `FocusBudgetPrompt` as this accepted summary block: it is a budget setup prompt, contains action controls, and returns `null` once `dayPlan.hasBudget` is true.

#### 2. Guest Rail

**File**: `src/app/_components/pomodoro-dashboard.tsx`

**Intent**: Give guests useful account/activation context without showing empty authenticated-data panels.

**Contract**: Guest `home-context-rail` contains at most three blocks: sign-in value prop, activation/merge hint, and calm empty-state guidance. It does not render `DailyRecapPanel`, `FocusBudgetPrompt`, day-plan rows, or empty persisted-data placeholders.

#### 3. Guest Header Suppression At Desktop

**File**: `src/app/_components/home-shell.tsx`

**Intent**: Avoid duplicate guest sign-in messaging once the guest rail is visible.

**Contract**: The existing `GuestBanner` remains in the shell below `lg`, and is suppressed at `lg` when its value/activation content is represented in the rail. The shell test contract for header and purpose copy remains unchanged.

#### 4. Panel Width Relaxation

**File**: `src/app/_components/guest-banner.tsx`

**Intent**: Allow guest rail content to fill its desktop column without changing mobile card width.

**Contract**: The banner keeps mobile `max-w-lg` behavior and supports `lg`/zone usage as full-width content when rendered inside the rail.

#### 5. Recap And Focus Panel Width Relaxation

**File**: `src/app/_components/daily-recap-panel.tsx`

**Intent**: Let the collapsed recap line sit naturally inside the desktop rail.

**Contract**: The panel keeps mobile behavior, remains collapsed on first paint, and can fill its rail zone at `lg` without changing dismiss/toggle behavior.

#### 6. Focus Budget Prompt Boundary

**File**: `src/app/_components/focus-budget-prompt.tsx`

**Intent**: Preserve the existing budget setup prompt without letting it become a fourth desktop rail block or substitute for the accepted summary.

**Contract**: The prompt keeps existing auth-only/dismiss/budget behavior in the mobile/S-40 flow. At desktop, do not render `FocusBudgetPrompt` as an additional `home-context-rail` block when the display-only S-27 summary is present; either keep the prompt outside the accepted rail block list or replace it with the summary at `lg`. The `home-context-rail` direct block cap remains three.

#### 7. Auth Focus Summary Copy And Oracle

**Files**: `src/app/_components/pomodoro-dashboard.tsx`, `messages/en.json`

**Intent**: Satisfy the S-41 authenticated rail contract with contextual text even when the focus budget is already configured.

**Contract**: Add the smallest display-only rail block needed to summarize today's focus-hours budget/remaining state and standing-task facts from existing `dayPlan`, `tasks`, and recap facts. The block has its own test id, uses `next-intl` copy, introduces no new query or mutation, and does not contain budget setup controls. Keep `FocusBudgetPrompt` as the existing optional setup prompt for the mobile/S-40 flow; on desktop, the summary block is the accepted S-27 rail block so the rail never grows beyond three direct blocks.

### Success Criteria:

#### Automated Verification:

- S-41 acceptance "Rail max 3 blocks - authenticated": component tests assert authenticated `home-context-rail` has no more than three accepted direct rail blocks and contains illustration slot, `daily-recap-panel`, and the display-only standing/focus-hours summary when data is available, including a `dayPlan.hasBudget === true` case where `FocusBudgetPrompt` would otherwise render `null`.
- S-41 acceptance "Rail max 3 blocks - guest": component tests assert guest `home-context-rail` has no more than three direct rail blocks and contains sign-in value, activation/merge hint, and calm empty-state guidance.
- S-41 acceptance "Guest rail shows sign-in/activation content, not empty persisted-data panels": component tests assert guest rail excludes `daily-recap-panel`, `focus-budget-prompt`, and auth-only empty panels.
- S-41 acceptance "Decision column visually primary": component tests assert guest/auth rail content does not introduce filled primary CTA controls into the decision region.

#### Manual Verification:

- Authenticated desktop rail reads as supporting context and does not compete with the main timer/next-focus decision.
- Guest desktop rail shows sign-in/activation value once, while the mobile header guest banner still appears below `lg`.
- The rail never feels like a fourth dashboard column or an empty account-data placeholder.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Structural Oracles And Final Verification

### Overview

Extend the component test suite with structural desktop-layout oracles and run the required quality gates. No new e2e belt row is added.

### Changes Required:

#### 1. Dashboard Structural Tests

**File**: `src/app/_components/pomodoro-dashboard.test.tsx`

**Intent**: Extend the existing S-40 region-membership matrix for S-41 desktop zones.

**Contract**: Add oracles for `home-context-rail`, rail block count, auth-vs-guest content, inventory staying outside the decision column, and one enabled filled primary CTA remaining in `home-primary-region`.

#### 2. Shell Layout Tests

**File**: `src/app/_components/home-shell.test.tsx`

**Intent**: Protect shell header/purpose copy and desktop guest-banner suppression behavior if the shell owns the suppression class/placement.

**Contract**: Existing shell header assertions remain; add only structural assertions needed to prove mobile guest banner stays available and desktop suppression class/contract exists.

#### 3. Targeted Component And Unit Runs

**File**: `package.json`

**Intent**: Use existing scripts; no script changes expected.

**Contract**: Run the targeted Vitest command below, then `pnpm check`, then `pnpm test` before presenting implementation results.

### Success Criteria:

#### Automated Verification:

- S-41 acceptance "below 1024px collapses to S-40 priority order": existing S-40 region-membership scenarios continue to pass.
- S-41 acceptance "rail max 3 blocks" and mode-specific content: new RTL tests pass for authenticated and guest rail variants.
- S-41 acceptance "centered 1120-1280px" and "rail never >~40%": class/structure assertions pass without pixel measurement.
- Targeted run passes: `cd D:\repos\10xdev\FlowState-desktop-calm-workbench; pnpm exec vitest run src/lib/home/home-session-state.test.ts src/app/_components/pomodoro-dashboard.test.tsx src/app/_components/home-shell.test.tsx src/app/_components/task-list.test.tsx src/app/_components/daily-recap-panel.test.tsx src/app/_components/guest-banner.test.tsx`.
- Required gates pass: `cd D:\repos\10xdev\FlowState-desktop-calm-workbench; pnpm check` and `cd D:\repos\10xdev\FlowState-desktop-calm-workbench; pnpm test`.

#### Manual Verification:

- Desktop `lg` viewport: workbench is centered, decision column is dominant, rail is <=3 blocks and contextual.
- Narrow viewport: S-40 mobile order is unchanged and guest banner behavior matches pre-S-41 expectations.
- Authenticated and guest modes both look calm with no duplicated or empty rail content.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before closing the slice.

---

## Testing Strategy

### Unit Tests:

- Keep `src/lib/home/home-session-state.test.ts` green to prove the S-40 IA matrix remains unchanged.
- Do not add new unit tests for CSS grid math unless a pure zone helper is introduced; if added, test mapping contracts only.

### Integration Tests:

- None. This slice does not touch server state, Prisma, tRPC, auth procedures, or persistence boundaries.

### Component Tests:

- Extend `src/app/_components/pomodoro-dashboard.test.tsx` with structural region/rail oracles.
- Extend `src/app/_components/home-shell.test.tsx` only if guest banner desktop suppression is expressed in the shell.
- Keep `src/app/_components/task-list.test.tsx` and `src/app/_components/daily-recap-panel.test.tsx` green to protect inventory and collapsed recap behavior.

### Manual Testing Steps:

1. Run the app and view the home page at a desktop width >=1024px as an authenticated user.
2. Confirm the workbench is centered, the decision column dominates, and the rail contains no more than three contextual blocks.
3. Repeat as a guest and confirm the rail shows sign-in/activation/guidance content without recap or focus-budget placeholders.
4. Resize below `lg` and confirm the current S-40 single-column order and guest header banner behavior remain intact.
5. Trigger a common wedge overlay or end-session confirmation and confirm it is not constrained by the grid.

## Performance Considerations

No new queries or heavy computation are planned. The rail reuses data already loaded by the dashboard. The only performance risk is unnecessary duplicate rendering of panels, especially guest sign-in content; implement by moving or conditionally rendering rather than duplicating hidden interactive surfaces where possible.

## Migration Notes

No database, environment, or persisted-data migration is required. This is a client-rendered presentation slice.

## References

- Change brief: `context/changes/desktop-calm-workbench/change.md`
- Research: `context/changes/desktop-calm-workbench/research.md`
- Acceptance source: `context/foundation/roadmap-references/items/S-41.md`
- Test strategy: `context/foundation/test-plan.md`
- Lessons: `context/foundation/lessons.md`
- Repository rules: `AGENTS.md`
- Renderer: `src/app/_components/pomodoro-dashboard.tsx`
- Shell: `src/app/_components/home-shell.tsx`
- S-40 IA: `src/lib/home/home-session-state.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Desktop Workbench Frame

#### Automated

- [ ] 1.1 Verify centered desktop workbench class contract
- [ ] 1.2 Verify decision/rail split class contract
- [ ] 1.3 Verify S-40 mobile region oracles remain green
- [ ] 1.4 Run timer-hub change-impact preflight

#### Manual

- [ ] 1.5 Desktop dashboard appears centered and wider than mobile stack
- [ ] 1.6 Narrow viewport preserves S-40 order and spacing
- [ ] 1.7 Wedge overlays remain outside grid constraints

### Phase 2: Authenticated And Guest Rail Content

#### Automated

- [ ] 2.1 Verify authenticated rail has <=3 accepted blocks
- [ ] 2.2 Verify guest rail has <=3 accepted blocks
- [ ] 2.3 Verify guest rail excludes persisted-data panels
- [ ] 2.4 Verify rail content does not add primary CTAs to decision region

#### Manual

- [ ] 2.5 Authenticated rail reads as supporting context
- [ ] 2.6 Guest rail shows sign-in/activation once on desktop
- [ ] 2.7 Rail avoids empty or fourth-column feel

### Phase 3: Structural Oracles And Final Verification

#### Automated

- [ ] 3.1 Verify S-40 region-membership scenarios still pass
- [ ] 3.2 Verify S-41 rail structural oracles pass
- [ ] 3.3 Verify desktop class/structure assertions pass without pixel measurement
- [ ] 3.4 Run targeted Vitest command
- [ ] 3.5 Run pnpm check
- [ ] 3.6 Run pnpm test

#### Manual

- [ ] 3.7 Authenticated desktop workbench matches S-41 acceptance
- [ ] 3.8 Guest desktop workbench matches S-41 acceptance
- [ ] 3.9 Narrow viewport and common overlay smoke pass
