# Home IA Reset Implementation Plan

## Overview

S-40 resets the home screen hierarchy so the page answers "Co teraz?" quickly: one dominant next-focus area above the fold, the timer as the hero while working, daily recap collapsed into context, and task inventory treated as secondary. This is an IA and presentation slice over existing session, suggestion, recap, and task behavior.

The plan follows the S4 research baseline: add a pure session-state and module-priority derivation, consume it from the dashboard, reuse F-14 `Home.purposeHeader`, and keep `usePomodoroCycle`, `resolveWedgeBeat`, and conductor-owned overlay sequencing unchanged unless implementation proves that impossible.

## Current State Analysis

Home is assembled by `src/app/_components/home-shell.tsx` and `src/app/_components/pomodoro-dashboard.tsx`. The dashboard currently renders a single fixed vertical stack with inline booleans deciding visibility and order. There is no formal home session-state enum, no module-priority matrix, and no single place that describes whether timer, suggestion, recap, or inventory is primary, secondary, or hidden.

Daily recap is rendered before task inventory and defaults expanded. The task list owns active/completed rows, the stale archive entry, focus footprint rows, and cycle-aware locking. The page already has the copy contract needed for S-40: F-14 shipped `Home.purposeHeader` in both locales, but the header is not rendered.

## Desired End State

The home screen has a typed, pure derivation that maps `idle`, `steering`, `active_work`, `break`, and `returning` states to module priorities (`primary`, `secondary`, `hidden`). The dashboard renders from that derivation through a thin layout/region layer, not another inline matrix inside `pomodoro-dashboard.tsx`.

The user-visible result is:

- Idle and returning states show one dominant next-focus CTA above the fold.
- Active work makes the timer the hero and hides the recap.
- Daily recap is collapsed on first paint and remains secondary context.
- Task inventory remains usable, including archive entry and continue-here row, but is not visually co-primary with next focus.
- The home purpose header passes the 5-second purpose test: "what to do next / co teraz".

### Key Discoveries

- S4 research identifies `src/app/_components/pomodoro-dashboard.tsx` as the current IA owner and recommends a pure derivation module instead of more inline booleans.
- F-14 already shipped `Home.purposeHeader`; S-40 should consume it rather than inventing a temporary copy module.
- The existing pure-helper pattern in `src/lib/wedge/transition-conductor.ts`, `src/lib/design/work-focus-shell.ts`, and `src/lib/design/break-atmosphere.ts` is the local model for this derivation.
- Test-plan §1, §6.9, and §6.11 favor pure unit tests plus component tests for this slice; no new belt e2e is justified unless component tests cannot observe a browser-only layout oracle.

## Acceptance Criteria Mapping

| Source | Acceptance | Plan coverage |
| --- | --- | --- |
| Roadmap S-40 | Home answers "Co teraz?" with one dominant next-focus | Phase 2 renders `Home.purposeHeader` and primary next-focus region; Phase 3 component tests assert one primary CTA in idle/returning |
| Roadmap S-40 | Pure session-state derivation: `idle`, `steering`, `active_work`, `break`, `returning` | Phase 1 creates `src/lib/home/home-session-state.ts` and exhaustive unit tests |
| Roadmap S-40 | Module priority matrix: `primary`, `secondary`, `hidden` | Phase 1 defines typed module keys and priority output; Phase 2 consumes it |
| Roadmap S-40 | Recap collapsed on first paint; hidden during active work; timer hero during work | Phase 2 updates `DailyRecapPanel` defaults and dashboard placement; Phase 3 component tests cover both |
| Roadmap S-40 | Exactly one filled primary CTA above fold in idle/returning | Phase 2 primary-zone rendering; Phase 3 dashboard assertions |
| PRD v3 US-03 | Light timing recap footprint, not dashboard | Recap stays secondary/collapsed and task footprints remain wired through `TaskList` |
| PRD v3 wedge guardrails / US-01 preservation | No stacked transition beats or extra gates | Plan explicitly excludes hook/conductor changes and keeps overlays outside IA zones |
| F-14 product voice | Locale parity, copy zones, 5-second purpose test, non-punitive tone | Phase 2 reuses catalog key and Phase 4 verifies copy-contract checklist |
| DESIGN.md | Calm light-default hierarchy; preserve `data-testid` contracts | Phase 2 uses existing tokens and keeps tested ids intact |

## What We're NOT Doing

- No changes to `usePomodoroCycle`, cycle persistence, timer worker behavior, or transition conductor priority.
- No new wedge gates, overlay stacks, or interstitial copy.
- No new recap/day-memory narrative for S-42; do not use `DayMemory.*` here.
- No stale-task archive behavior changes; preserve S-44 archive entry/back flow.
- No desktop three-zone workbench; S-41 owns `lg >= 1024` layout expansion.
- No new Playwright belt row unless implementation finds a browser-only oracle that component tests cannot cover.
- No database, tRPC router, Prisma, auth, or guest-merge changes.

## Implementation Approach

Use a conservative three-layer shape:

1. Pure IA model in `src/lib/home/home-session-state.ts`.
2. Thin dashboard consumption and region wrappers in `src/app/_components/pomodoro-dashboard.tsx`.
3. Focused tests: unit tests for the model, component tests for page/header/dashboard/recap behavior.

The derivation should accept already-computed dashboard signals as inputs rather than reaching into hooks or querying data. This keeps domain boundaries explicit: cycle state remains owned by the hook/conductor, while home IA owns only presentation priority.

## Decision Proxies

These decisions are material but resolved conservatively for this bound stage:

| Decision | Choice | Proxy used |
| --- | --- | --- |
| Matrix shape | A typed pure function returning `{ state, modules }`, where `modules` maps known home module keys to `primary | secondary | hidden` | Matches research recommendation and local pure-helper pattern |
| Layout structure | Introduce small presentational zone wrappers or equivalent region structure, then render existing modules into primary/secondary areas | Keeps `pomodoro-dashboard.tsx` from accumulating another inline matrix and gives tests stable DOM anchors |
| Pause edge case | Treat paused WORK as `active_work`; timer remains hero | Research maps pause as orthogonal; conductor suppresses gates while paused |
| Returning state | No return banner; use continue-here row plus steering/kickoff surfaces | S-17 design and existing e2e assert banner absence |
| Copy | Reuse `Home.purposeHeader`; add new keys only if a zone label is truly user-visible | F-14 already shipped required EN/PL copy |
| Test layer | Unit + component first; no new belt e2e | Test-plan cost x signal and research both identify layout/copy/priority as component-observable |

## Phase 1: Pure Home IA Model

### Overview

Create the reusable home session-state and module-priority derivation. This phase should not change visible UI yet beyond imports if needed; it gives implementation a stable contract to consume in Phase 2.

### Changes Required

#### 1. Home IA Derivation Module

**File**: `src/lib/home/home-session-state.ts`

**Intent**: Define the S-40 home IA contract as pure TypeScript. The module converts dashboard-level facts into a normalized home state and module priorities.

**Contract**: Export types for `HomeSessionState`, `HomeModuleKey`, `HomeModulePriority`, and a pure derivation function. Module keys should cover at least purpose/header, timer, next focus/suggestion, steering, recap, inventory, archive, and inline transition/status lines as needed by the renderer. The function must be deterministic and side-effect free.

The function should accept input flags, not hook instances. Minimum inputs:

- data mode (`guest` or authenticated equivalent)
- cycle state/kind and pause/running/break facts already known to the dashboard
- steering gate visibility (`showSessionEnergy`, `showSessionFocus`)
- suggestion/kickoff availability
- continue/returning task availability
- recap availability/loading/dismissed facts as presentation inputs, not data fetches

#### 2. Home IA Unit Tests

**File**: `src/lib/home/home-session-state.test.ts`

**Intent**: Lock the matrix independently of React. These tests are the highest-signal oracle for S-40's state taxonomy and priority behavior.

**Contract**: Cover all five states, guest/auth differences, paused WORK as `active_work`, break state, returning without a banner, and invariants:

- exactly one primary next-focus module in `idle` and `returning` when suggestion/continue affordance exists
- timer is primary in `active_work`
- recap is hidden in `active_work`
- inventory is secondary except when archive view is explicitly active
- no module priority is omitted for known module keys

### Success Criteria

#### Automated Verification

- `src/lib/home/home-session-state.ts` exists and exports typed state/priority contracts.
- `src/lib/home/home-session-state.test.ts` covers all five S-40 states and the pause/guest/returning edge cases.
- Targeted unit run passes: `pnpm exec vitest run src/lib/home/home-session-state.test.ts`.
- Biome/type checks pass for new pure module files: `pnpm check`.

#### Manual Verification

- The derivation contract is readable enough for S-41 to reuse without importing dashboard internals.

**Implementation Note**: Stop after this phase if the derivation needs dashboard-only data that is not yet available as a stable input. Do not solve that by importing the hook into the pure module; adapt dashboard inputs instead.

---

## Phase 2: Home Layout Consumption

### Overview

Consume the derivation from the dashboard and home shell. Render existing modules into primary/secondary/hidden zones while preserving behavior and test ids.

### Changes Required

#### 1. Dashboard IA Consumption

**File**: `src/app/_components/pomodoro-dashboard.tsx`

**Intent**: Replace scattered IA decisions with a call into the home IA derivation, then render existing modules according to the resulting priorities.

**Contract**: Keep all existing hook calls, handlers, and overlay components behaviorally unchanged. Wedge overlays remain outside the new inline IA zones. Preserve `TaskList`, `TaskArchiveView`, `TimerPanel`, suggestion cards, kickoff cards, steering cards, recap, archive entry/back flow, end-session controls, and existing `data-testid` values.

The dashboard may introduce small local region wrappers such as a primary decision region and secondary context region, but they should be presentational only. Prefer stable test ids such as `home-primary-region` and `home-secondary-region` if needed for component tests.

#### 2. Purpose Header

**File**: `src/app/_components/home-shell.tsx`

**Intent**: Render the F-14 purpose header so the page passes the 5-second purpose test without rewriting the product voice.

**Contract**: Use `Home.purposeHeader` from the message catalog. Keep `Home.appName` and `Home.tagline` unless the local hierarchy requires subduing, not deleting, them. Preserve offline banner, guest banner, onboarding, merge UI, and `DataModeProvider` behavior.

#### 3. Daily Recap Collapse

**File**: `src/app/_components/daily-recap-panel.tsx`

**Intent**: Make recap secondary context by default rather than a co-primary panel.

**Contract**: Default sections collapsed on first paint. Preserve dismiss semantics, loading/null behavior, `aria-expanded`, existing test ids, and local-date dismissal. The dashboard host controls hiding during `active_work`; the panel should remain reusable in other states.

#### 4. Message Catalogs

**Files**: `messages/en.json`, `messages/pl.json`

**Intent**: Preserve F-14 locale parity.

**Contract**: Prefer no new strings. If a visible region label or heading is required, add matching EN/PL keys under the right namespace and update tests. Do not use `DayMemory.*` for S-40 recap behavior.

### Success Criteria

#### Automated Verification

- Dashboard consumes the home IA derivation without importing cycle hook/conductor logic into the pure module.
- `DailyRecapPanel` defaults collapsed while preserving existing dismiss and toggle behavior.
- `Home.purposeHeader` renders through `home-shell.tsx`.
- Existing `data-testid` contracts for timer, suggestion, recap, task list, archive entry/back, and overlays remain intact.
- Targeted component tests added/updated in Phase 3 pass before this phase is marked complete.
- `pnpm check` passes.

#### Manual Verification

- In idle and returning states, the eye lands on one next-focus decision before task inventory.
- During active work, the timer is visibly the hero and recap is not present.
- Task create/edit/complete/reorder and archive entry/back remain reachable from the demoted inventory zone.

**Implementation Note**: Before editing `pomodoro-dashboard.tsx`, run `pnpm change-impact` per `AGENTS.md`. Treat the output as advisory test selection, not as permission to broaden scope.

---

## Phase 3: Component and Unit Verification

### Overview

Add the focused test coverage required by the test-plan cost x signal contract. This phase should prove user-visible IA without new belt e2e.

### Changes Required

#### 1. Home Shell Component Test

**File**: `src/app/_components/home-shell.test.tsx`

**Intent**: Prove the purpose header is rendered through the page shell and remains compatible with guest/auth wrapping.

**Contract**: Extend existing tests rather than replacing them. Assert the translated `Home.purposeHeader` appears and the shell still renders the dashboard area.

#### 2. Dashboard Component Matrix

**File**: `src/app/_components/pomodoro-dashboard.test.tsx`

**Intent**: Prove the primary/secondary/hidden mapping is respected at the component boundary.

**Contract**: Mock hooks at the nearest boundary per test-plan §6.9. Add scenarios for idle, returning, steering, active work, and break:

- idle/returning: one filled primary CTA in the primary region
- active work: timer in primary region, recap absent, inventory secondary
- break: break/timer or next-focus surface follows derivation, inventory secondary
- steering: steering card takes priority without adding extra overlay gates
- archive view: inventory/archives remain reachable

Define the "filled primary CTA" oracle through existing user-action test ids, not wrapper presence alone. The primary region should contain exactly one enabled filled next-step action from the relevant state, such as `suggestion-accept-btn`, `timer-start-cycle`, `timer-pause`, `timer-resume`, or the kickoff duration/start path when pre-focus is staged. In idle/returning tests, assert that secondary inventory controls such as `task-archive-entry` and edit/create controls are outside `home-primary-region` even when they remain reachable elsewhere.

#### 3. Daily Recap Component Test

**File**: `src/app/_components/daily-recap-panel.test.tsx`

**Intent**: Prove recap starts collapsed and existing accessibility/dismiss behavior still works.

**Contract**: Update existing toggle/dismiss tests for collapsed initial state. Keep `aria-expanded` assertions and avoid snapshot-only oracles.

#### 4. Regression Test Selection

**Files**: existing targeted tests only

**Intent**: Run the cheapest suite that covers S-40's blast radius.

**Contract**: Expected targeted command:

`pnpm exec vitest run src/lib/home/home-session-state.test.ts src/app/_components/home-shell.test.tsx src/app/_components/pomodoro-dashboard.test.tsx src/app/_components/daily-recap-panel.test.tsx src/app/_components/task-list.test.tsx`

Escalate to wedge or belt commands only if implementation touches overlay sequencing, hook state, or behavior not observable at component level.

### Success Criteria

#### Automated Verification

- Pure IA unit tests pass.
- Home shell component tests assert the purpose header.
- Dashboard component tests assert module priority per session state.
- Daily recap component tests assert collapsed first paint and preserved dismiss/toggle behavior.
- Task-list smoke still passes for inventory behavior: `pnpm exec vitest run src/app/_components/task-list.test.tsx`.
- Full local quality gates pass: `pnpm check` and `pnpm test`.

#### Manual Verification

- No new Playwright belt row was added unless the implementation report documents a browser-only oracle.
- If any hook/conductor file was touched unexpectedly, wedge dismiss/operability oracles from test-plan §6.10 were run and documented.

---

## Phase 4: Documentation and Handoff

### Overview

Keep durable planning/test docs aligned without bloating foundation documents unnecessarily.

### Changes Required

#### 1. Test Cookbook Decision

**File**: `context/foundation/test-plan.md`

**Intent**: Decide whether S-40 introduced a reusable testing pattern that belongs in the cookbook.

**Contract**: Default is no foundation update: test-plan §6.1, §6.9, and §6.11 already cover pure module, component, and recap tests. Update the cookbook only if implementation creates a reusable home IA test pattern that future S-41/S-42/S-43 slices should follow.

#### 2. Change Notes

**File**: `context/changes/home-ia-reset/change.md`

**Intent**: Keep the change metadata consistent with implementation status.

**Contract**: `/10x-implement` should move status from `planned` to `implementing`/done according to its normal workflow. Do not archive in this plan.

#### 3. Implementation Report Inputs

**File**: `context/changes/home-ia-reset/plan.md`

**Intent**: Preserve material decision context for S7 execution and review.

**Contract**: Implementation report should mention whether the conservative decisions held: no hook/conductor changes, no new belt e2e, no new copy keys unless needed, and whether test-plan cookbook stayed unchanged.

### Success Criteria

#### Automated Verification

- If `context/foundation/test-plan.md` is edited, `pnpm check` passes and the edit is limited to cookbook guidance.
- `pnpm check` passes.
- `pnpm test` passes.

#### Manual Verification

- Implementation report maps shipped behavior to S-40, PRD US-03/Secondary craft, F-14, and test-plan cost x signal.
- The reviewer can identify the next S7 phase from `## Progress` without reading prose.

---

## Testing Strategy

### Unit Tests

- `src/lib/home/home-session-state.test.ts`: exhaustive matrix for session state and module priorities.
- Keep the pure function free of React/hook imports so tests are deterministic.

### Component Tests

- `src/app/_components/home-shell.test.tsx`: purpose header rendered.
- `src/app/_components/pomodoro-dashboard.test.tsx`: region/priority matrix across session states.
- `src/app/_components/daily-recap-panel.test.tsx`: collapsed first paint plus toggle/dismiss.
- `src/app/_components/task-list.test.tsx`: inventory behavior remains safe after demotion.

### E2E

No new belt e2e is planned. Existing belt/full-catalog flows already exercise underlying session, suggestion, task, archive, and recap behavior; S-40's oracle is layout and priority, which component tests can observe. Add or update e2e only if implementation introduces a browser-only acceptance point that cannot be expressed in Vitest/RTL.

### Manual Testing Steps

1. Open home idle with tasks and confirm the page answers "what to do next / co teraz" within 5 seconds.
2. Trigger returning state and confirm no return banner appears; the continue-here/next-focus affordance remains visible.
3. Start a work cycle and confirm the timer is the hero, recap is hidden, and inventory is secondary.
4. Finish or enter a break and confirm break/next-focus surfaces remain primary while inventory stays available.
5. Open task archive from inventory and return with `task-archive-back`.

## Performance Considerations

The new derivation is pure, cheap, and computed from values already available in the dashboard render. Avoid new queries, timers, or layout effects. Do not block user taps behind animation or derived state; L-04's 200ms principle still applies to all existing interactive surfaces.

## Migration Notes

No database, API, auth, or persisted data migration is required. Recap dismissal continues using the existing per-date sessionStorage behavior. Guest and authenticated data-mode boundaries stay unchanged.

## References

- Roadmap row: `context/foundation/roadmap.md` S-40
- Item card: `context/foundation/roadmap-references/items/S-40.md`
- Research: `context/changes/home-ia-reset/research.md`
- Change brief: `context/changes/home-ia-reset/change.md`
- PRD v3: `context/foundation/prd.md` US-03 and Secondary craft
- PRD map: `context/foundation/prd-refs.md`
- Product voice: `context/foundation/product-voice.md`
- Design system: `DESIGN.md`
- Test strategy: `context/foundation/test-plan.md` §1, §6.1, §6.9, §6.10, §6.11
- Lessons: `context/foundation/lessons.md` L-04 and wedge transition lesson
- Repo rules: `AGENTS.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Pure Home IA Model

#### Automated

- [x] 1.1 Add typed pure home IA derivation module — e0f5c99
- [x] 1.2 Add exhaustive home IA unit tests — e0f5c99
- [x] 1.3 Run targeted home IA unit test — e0f5c99
- [x] 1.4 Run `pnpm check` for pure module phase — e0f5c99

#### Manual

- [ ] 1.5 Confirm derivation contract is reusable by S-41

### Phase 2: Home Layout Consumption

#### Automated

- [x] 2.1 Run `pnpm change-impact` before dashboard edit — 703401d
- [x] 2.2 Consume home IA derivation from dashboard without hook/conductor changes — 703401d
- [x] 2.3 Render `Home.purposeHeader` through home shell — 703401d
- [x] 2.4 Make daily recap collapsed by default and hidden during active work — 703401d
- [x] 2.5 Preserve existing `data-testid` contracts — 703401d
- [x] 2.6 Run `pnpm check` for layout phase — 703401d

#### Manual

- [ ] 2.7 Verify idle and returning states have one dominant next-focus decision
- [ ] 2.8 Verify active work makes timer hero and hides recap
- [ ] 2.9 Verify task inventory and archive remain reachable

### Phase 3: Component and Unit Verification

#### Automated

- [x] 3.1 Extend home shell component tests for purpose header — 441b6d7
- [x] 3.2 Extend dashboard component tests for state priority matrix — 441b6d7
- [x] 3.3 Extend daily recap tests for collapsed first paint — 441b6d7
- [x] 3.4 Run targeted S-40 Vitest command — 441b6d7
- [x] 3.5 Run `pnpm check` — 441b6d7
- [x] 3.6 Run `pnpm test` — 441b6d7

#### Manual

- [ ] 3.7 Confirm no new belt e2e was added without browser-only oracle
- [ ] 3.8 Document wedge oracle runs if hook or conductor files changed

### Phase 4: Documentation and Handoff

#### Automated

- [x] 4.1 Decide whether test-plan cookbook update is needed — 3c6fc55
- [x] 4.2 Apply cookbook update only if a reusable S-40 test pattern emerged — 3c6fc55
- [x] 4.3 Run `pnpm check` — 3c6fc55
- [x] 4.4 Run `pnpm test` — 3c6fc55

#### Manual

- [ ] 4.5 Confirm implementation report maps outcomes to S-40, PRD, F-14, and test-plan
- [ ] 4.6 Confirm next-stage handoff is `/10x-implement home-ia-reset phase 1`
