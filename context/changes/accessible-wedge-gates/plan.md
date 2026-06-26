# Accessible Wedge Gates Implementation Plan

## Overview

Implement S-39 as a bounded wedge-gate operability slice: existing gate surfaces become screen-reader-safe, focus-predictable, calmly announced, and keyboard-first while preserving the F-07 one-gate transition invariant. The plan is primitive-first and two-tier: modal gate behavior belongs in the shared overlay shell, while inline gates get labelled regions, native button state, and polite status announcements without a global shortcut manager.

## Current State Analysis

FlowState already has the core flow-control shape this slice needs. `resolveWedgeBeat` in `src/lib/wedge/transition-conductor.ts` enforces the one blocking gate per transition beat, and `src/app/_components/pomodoro-dashboard.tsx` uses `wedgeGateActive` to suppress inline surfaces while conductor gates are active. The missing contract is accessibility and operability, not gate priority.

The shared overlay primitive is the highest-leverage gap. `src/app/_components/overlay-shell.tsx` exposes `OverlayScrim` and `OverlayCard`, but the scrim currently defaults to `role="presentation"` and has no `aria-modal`, heading association, initial focus, focus containment, Escape policy, or focus restoration. Several modal gates pass `role="dialog"` but remain unlabelled; `src/app/_components/cycle-complete-overlay.tsx` behaves as a modal gate while not passing dialog semantics at all.

Inline gates have a different shape. `src/app/_components/task-suggestion-card.tsx`, `src/app/_components/session-steering-card.tsx`, `src/app/_components/energy-selector.tsx`, and gate-adjacent timer controls mostly use native buttons, so Enter/Space behavior already exists. Their gaps are labelled regions/groups, explicit selected/expanded state, a labelled custom focus input, and polite live status for content that changes without focus moving.

Test coverage exists around conductor priority, hook dismiss paths, dashboard visibility, and the Playwright belt, but there are no focused assertions for gate roles, labels, focus entry/restore, or live status. `@axe-core/playwright` is already present for a home task-list scan, so any browser-level accessibility coverage can extend that existing path without adding a new dependency.

## Desired End State

A keyboard or screen-reader user can encounter each target wedge gate, understand what changed, land on a sensible focus target, operate the visible primary/secondary controls with standard keyboard behavior, and continue to the next beat without focus being stranded. Modal gates are labelled dialogs with consistent focus lifecycle; inline gates are labelled regions/groups in normal tab order with polite announcements only for gate-change status.

### Key Discoveries:

- `context/changes/accessible-wedge-gates/frame.md` confirms the problem: FlowState needs a bounded operability contract for focus, announcement, and keyboard-first action across existing wedge gates while preserving F-07 one-gate behavior.
- `context/changes/accessible-wedge-gates/research.md` found no focus management in wedge overlays and no wedge live-region contract, while confirming that native buttons already cover most keyboard action behavior.
- `context/foundation/test-plan.md` Phase 8 and §6.10 already own wedge coherence and stuck-gate dismiss oracles; S-39 should extend those oracles with accessibility assertions instead of creating a separate broad audit.
- `context/foundation/roadmap-references/items/S-39.md` explicitly excludes app-wide accessibility cleanup and shortcut overload.

## What We're NOT Doing

- No broad app-wide accessibility audit.
- No global shortcut manager or single-key accelerator system.
- No new conductor gate, no change to `GATE_PRIORITY`, and no replacement of F-07 transition behavior.
- No visual redesign or Calm Garden rebrand work.
- No mobile/native push/accessibility platform expansion.
- No new test dependency unless implementation proves the existing component assertions plus Playwright axe path cannot observe a required gate behavior.

## Implementation Approach

Use the existing UI architecture rather than adding a new layer. Phase 1 adds a modal-gate accessibility contract to `OverlayScrim` and opts conductor modal overlays into it. Phase 2 handles inline gate semantics and live status in the surfaces that are not true modals. Phase 3 updates the Phase 8 quality contract and runs the focused regression belt so S-39 becomes part of the wedge-coherence cookbook.

### DDD / Module Boundaries

- **Wedge domain logic** remains in `src/lib/wedge/transition-conductor.ts` and `src/hooks/use-pomodoro-cycle.ts`; this slice must not move accessibility concerns into conductor priority or session state.
- **UI primitives** live in `src/app/_components/overlay-shell.tsx` and any tiny local helper it owns. Modal focus lifecycle belongs here because the modal overlays already share this primitive.
- **Modal gate components** own their headings, descriptions, and dismiss contracts for the S-39 target gates: cycle complete, check-in, wind-down, and session closure. End-session confirm and mid-cycle prompt are compatibility-only surfaces for shared primitive API changes, not standalone S-39 deliverables.
- **Inline gate components** own non-modal semantics: suggestion card, steering cards, energy selector, and timer-panel start controls.
- **Dashboard orchestration** may wrap status text in live-region primitives and pass focus/label props, but it must keep `wedgeGateActive` suppression and conductor wiring intact.
- **Test-plan documentation** remains in `context/foundation/test-plan.md`; implementation phases update only Phase 8 / §6.10 guidance relevant to S-39 gate operability.

### BDD Acceptance

```gherkin
Scenario: Modal wedge gate is operable by keyboard and screen reader
  Given a logged-in user reaches a conductor-gated wedge modal
  When the gate opens
  Then focus moves into the labelled dialog
  And the dialog exposes its heading and purpose to assistive technology
  And tab navigation stays within the blocking gate until the user acts

Scenario: Gate action preserves one-gate transition flow
  Given a wedge gate is visible
  When the user activates its primary or dismiss action with Enter or Space
  Then the current gate closes
  And focus is restored or transferred to the next meaningful beat
  And no second blocking gate stacks on the same transition beat

Scenario: Inline suggestion gate announces status calmly
  Given a suggestion card changes from loading to ready, empty, error, or override acknowledgement
  When focus remains outside the changed text
  Then exactly one polite live status conveys the visible state
  And no new interstitial copy or assertive chatter is introduced

Scenario: Keyboard-first does not become shortcut overload
  Given a user can tab to gate controls
  When they use standard button keys on accept, override, start, skip, or dismiss controls
  Then the action works without requiring custom single-key shortcuts
```

## Critical Implementation Details

### Focus Policy

Default modal focus should land on the first meaningful interactive control when the gate has an obvious next action; otherwise the labelled dialog container or heading can receive focus so the user hears context first. Focus restore should prefer the element that opened the gate when still mounted; when the flow advances to another beat, transfer to the next gate's initial focus target instead of restoring to a stale hidden element.

### Live Status Policy

Use polite announcements for gate-state changes and reuse existing visible copy where possible. Do not wrap the ticking countdown in a live region, do not use assertive announcements for ordinary wedge transitions, and do not add separate spoken-only interstitial copy that changes the one-interstitial-plus-one-gate product feel.

### Escape Policy

Escape should be wired only for gates where the same non-destructive dismiss path already exists, such as closure acknowledgement or "Continue later" style paths. Gates that intentionally require a choice, such as energy check-in, should not gain a hidden Escape bypass unless there is already an equivalent visible cancel/dismiss control.

## Phase 1: Shared Modal Gate Contract

### Overview

Centralize labelled dialog semantics and focus lifecycle in the shared overlay primitive, then opt the modal wedge gates into the contract without changing conductor priority or session state.

### Changes Required:

#### 1. Overlay Shell Primitive

**File**: `src/app/_components/overlay-shell.tsx`

**Intent**: Extend the shared modal wrapper so blocking wedge overlays can declare a labelled dialog, initial focus behavior, optional Escape handling, focus containment, and focus restoration through one primitive.

**Contract**: `OverlayScrim` accepts explicit label/description ids and focus options for modal gates; it emits `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, and optional `aria-describedby` only for modal usage. The primitive must keep presentation usage available for non-modal visual wrappers if any remain.

#### 2. Modal Overlay Consumers

**Files**: `src/app/_components/cycle-complete-overlay.tsx`, `src/app/_components/check-in-overlay.tsx`, `src/app/_components/wind-down-overlay.tsx`, `src/app/_components/session-closure-overlay.tsx`

**Intent**: Give each blocking gate a stable heading/description association and wire the existing dismiss or submit callbacks into the modal focus lifecycle where appropriate.

**Contract**: Every blocking modal gate exposes a stable heading id for `aria-labelledby`, passes dialog semantics intentionally, preserves native button controls, and does not introduce a new gate boolean or conductor priority. `cycle-complete-overlay` must stop relying on the `presentation` default.

**Compatibility note**: If `OverlayScrim` API changes require touching `src/app/_components/end-session-confirm-overlay.tsx` or `src/app/_components/mid-cycle-completion-prompt.tsx`, keep those edits mechanical and covered by existing tests. Do not expand their copy or behavior as S-39 scope.

#### 3. Modal Gate Component Tests

**Files**: `src/app/_components/overlay-shell.test.tsx`, `src/app/_components/cycle-complete-overlay.test.tsx`, `src/app/_components/check-in-overlay.test.tsx`, `src/app/_components/wind-down-overlay.test.tsx`, `src/app/_components/session-closure-overlay.test.tsx`

**Intent**: Prove each modal gate is labelled, focusable, keyboard-dismissable only where allowed, and does not regress its existing primary action/dismiss callback.

**Contract**: Tests assert role/name/description, initial focus or focus transfer, Tab containment for modal gates, focus restore/next-beat transfer for dismissable gates, and existing action callbacks. Tests should use React Testing Library role queries rather than snapshot-only assertions.

### Success Criteria:

#### Automated Verification:

- Modal gate component tests pass: `pnpm exec vitest run src/app/_components/overlay-shell.test.tsx src/app/_components/cycle-complete-overlay.test.tsx src/app/_components/check-in-overlay.test.tsx src/app/_components/wind-down-overlay.test.tsx src/app/_components/session-closure-overlay.test.tsx`
- Wedge conductor remains unchanged by behavior: `pnpm exec vitest run src/lib/wedge/transition-conductor.test.ts`
- Code quality passes after the phase: `pnpm check`

#### Manual Verification:

- Keyboard tab order stays inside each blocking modal until an existing visible action closes it.
- Closing a modal returns focus to a sensible control or transfers it to the next visible gate without stacking overlays.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that modal focus behavior feels calm before proceeding.

---

## Phase 2: Inline Gate Semantics and Live Status

### Overview

Make non-modal wedge gates understandable and keyboard-first without converting them into dialogs or introducing custom shortcut infrastructure.

### Changes Required:

#### 1. Suggestion Card Semantics

**File**: `src/app/_components/task-suggestion-card.tsx`

**Intent**: Treat the suggestion card as an inline decision region with a clear accessible name, visible status announcements, and complete expander relationships.

**Contract**: The card exposes a labelled region/group contract, "Why this?" has both `aria-expanded` and `aria-controls`, loading/ready/empty/error states are announced through one polite live region, and accept/override buttons remain native button controls.

#### 2. Steering and Energy Selection Semantics

**Files**: `src/app/_components/session-steering-card.tsx`, `src/app/_components/energy-selector.tsx`

**Intent**: Label inline readiness/intention cards and energy chip groups so keyboard and screen-reader users understand the prompt and selected state without a modal.

**Contract**: Steering cards use labelled regions, the custom focus input has a real label or `aria-label`, chip groups expose an accessible group name, and selected/active chip state is represented with `aria-pressed` or an equivalent button-group pattern consistent with existing UI.

#### 3. Gate-Adjacent Timer and Dashboard Status

**Files**: `src/app/_components/timer-panel.tsx`, `src/app/_components/pomodoro-dashboard.tsx`

**Intent**: Ensure start/accept/override/status surfaces that participate in wedge gates are discoverable without announcing noisy timer ticks.

**Contract**: Idle Start has an accessible label where needed; in-flow summary, break transition line, suggestion override acknowledgement, and suggestion async state use a single polite status contract per beat. The countdown itself is not put into a live region.

#### 4. Inline Gate Tests

**Files**: `src/app/_components/task-suggestion-card.test.tsx`, `src/app/_components/session-steering-card.test.tsx`, `src/app/_components/energy-selector.test.tsx`, `src/app/_components/timer-panel.test.tsx`, `src/app/_components/pomodoro-dashboard.test.tsx`

**Intent**: Prove inline gates have labels, selected/expanded state, polite announcements, and standard keyboard activation while preserving dashboard suppression of competing gates.

**Contract**: Tests assert role/name queries, `aria-pressed` or equivalent state, `aria-controls`, exactly one polite live status for changed gate text, and existing accept/override/start callbacks. Dashboard tests must keep the current overlay visibility matrix and `wedgeGateActive` suppression intact.

### Success Criteria:

#### Automated Verification:

- Inline gate component tests pass: `pnpm exec vitest run src/app/_components/task-suggestion-card.test.tsx src/app/_components/session-steering-card.test.tsx src/app/_components/energy-selector.test.tsx src/app/_components/timer-panel.test.tsx src/app/_components/pomodoro-dashboard.test.tsx`
- Hook/dashboard wedge dismiss oracles still pass: `pnpm exec vitest run src/hooks/use-pomodoro-cycle.test.tsx src/app/_components/pomodoro-dashboard.test.tsx`
- Code quality passes after the phase: `pnpm check`

#### Manual Verification:

- A keyboard-only user can tab through inline readiness, suggestion, override, and start controls in a predictable order.
- Live status announces gate changes without repeatedly announcing countdown ticks or adding extra visible interstitial copy.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation of keyboard order and announcement tone.

---

## Phase 3: Phase 8 Quality Companion and Regression Belt

### Overview

Extend the existing Phase 8 wedge-coherence quality contract with S-39 accessibility assertions, then run the focused wedge regression set and the required project gates.

### Changes Required:

#### 1. Test-Plan Phase 8 Coverage

**File**: `context/foundation/test-plan.md`

**Intent**: Update Phase 8 / §6.10 guidance so future wedge-gate changes include S-39 role, label, focus, live-status, and keyboard-first oracles as part of the stuck-gate dismiss matrix.

**Contract**: The update stays scoped to Phase 8 and §6.10. It must not rewrite the whole strategy, change completed rollout states, or add a broad accessibility-audit phase.

#### 2. Optional Wedge-Scoped Axe Extension

**File**: `e2e/accessibility.spec.ts`

**Intent**: Extend the existing Playwright axe path only if component tests cannot catch dialog labelling or live-region regressions at the right confidence level.

**Contract**: Any e2e accessibility addition uses the existing `@axe-core/playwright` dependency and scopes `.include()` to wedge gate test ids or a seeded gate state. It must not become an app-wide scan or merge-gate replacement for component oracles.

#### 3. Regression Commands and Belt

**Files**: test-only changes as required by Phase 1 and 2

**Intent**: Run the same high-signal wedge regression set called out by research and AGENTS.md so focus work does not reintroduce dead-end gates, stacked overlays, or cycle behavior drift.

**Contract**: Run targeted Vitest for conductor, hook, dashboard, overlay/inline components; then run full local gates. Use the belt command with `CI=true` on Windows syntax before presenting implementation results in S7.

### Success Criteria:

#### Automated Verification:

- Test-plan Phase 8 documentation includes S-39 gate operability criteria: role/name, initial focus, focus restore or next-beat transfer, single polite live status, and keyboard-first action.
- Optional axe coverage, if added, passes: `set CI=true && pnpm test:e2e:a11y`
- Focused wedge regression passes: `pnpm exec vitest run src/lib/wedge/transition-conductor.test.ts src/hooks/use-pomodoro-cycle.test.tsx src/app/_components/pomodoro-dashboard.test.tsx`
- Required project checks pass: `pnpm check`
- Required unit/integration suite passes: `pnpm test`
- Required e2e belt passes: `set CI=true && pnpm test:e2e:belt`

#### Manual Verification:

- S-39 remains bounded to wedge gates and Phase 8 coverage; no broad audit or shortcut-manager scope has been introduced.
- A final keyboard-only smoke through cycle complete, check-in, suggestion accept/override, and closure confirms each gate opens, announces, accepts action, and closes.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before S7 implementation completion is declared.

---

## Testing Strategy

### Unit and Component Tests:

- Prefer component/RTL role assertions for labels, dialog semantics, live-region existence, focus entry, Tab containment, and button activation.
- Extend `overlay-shell.test.tsx` as the primitive contract and keep per-overlay tests focused on each consumer's heading/description/action wiring.
- Extend inline component tests for `task-suggestion-card`, `session-steering-card`, `energy-selector`, and `timer-panel` before adding browser coverage.

### Hook and Dashboard Tests:

- Keep `transition-conductor.test.ts` as a pure one-gate invariant guard.
- Use `use-pomodoro-cycle.test.tsx` and `pomodoro-dashboard.test.tsx` for gate close/next-beat/focus transfer oracles where component-only tests cannot observe flow progression.
- Add S-39 assertions to the existing §6.10 stuck-gate matrix rather than creating a separate accessibility-only matrix.

### E2E Tests:

- Use the existing Playwright axe setup only for a wedge-scoped check if component tests cannot observe the required confidence.
- Do not add a new belt row unless hook/component evidence cannot observe the user-visible behavior.
- The final implementation phase still runs the existing belt because the slice touches wedge surfaces.

### Manual Testing Steps:

1. Use keyboard only to reach and operate a cycle complete gate.
2. Confirm focus enters the check-in gate, stays in the blocking gate while open, and moves forward after an energy choice.
3. Confirm suggestion accept and override are reachable by Tab and activate with Enter/Space.
4. Confirm closure acknowledgement restores or transfers focus without stacked overlays.
5. Confirm live status copy is calm and not repeated by timer ticks.

## Performance Considerations

Focus management and live-region wrappers should be lightweight React/browser behavior with no network or timer-loop work. Do not put countdown text in an `aria-live` region, and avoid effects that re-run on every timer tick. No database, API, or scoring performance changes are expected.

## Migration Notes

No database migration, data migration, or API migration is required. This slice is UI operability and test-plan documentation only.

## References

- Roadmap item: `context/foundation/roadmap-references/items/S-39.md`
- Roadmap index: `context/foundation/roadmap.md`
- PRD: `context/foundation/prd.md`
- Test plan Phase 8 / §6.10: `context/foundation/test-plan.md`
- Frame brief: `context/changes/accessible-wedge-gates/frame.md`
- Research: `context/changes/accessible-wedge-gates/research.md`
- Lessons: `context/foundation/lessons.md`
- Shared modal primitive: `src/app/_components/overlay-shell.tsx`
- Wedge conductor: `src/lib/wedge/transition-conductor.ts`
- Dashboard orchestration: `src/app/_components/pomodoro-dashboard.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Shared Modal Gate Contract

#### Automated

- [x] 1.1 Modal gate component tests pass — 905666b
- [x] 1.2 Wedge conductor behavior remains unchanged — 905666b
- [x] 1.3 Code quality passes after modal gate changes — 905666b

#### Manual

- [ ] 1.4 Keyboard focus stays inside each blocking modal until visible action
- [ ] 1.5 Modal close restores or transfers focus without stacking overlays

### Phase 2: Inline Gate Semantics and Live Status

#### Automated

- [x] 2.1 Inline gate component tests pass — 6060279
- [x] 2.2 Hook and dashboard wedge dismiss oracles still pass — 6060279
- [x] 2.3 Code quality passes after inline gate changes — 6060279

#### Manual

- [ ] 2.4 Keyboard-only inline gate traversal is predictable
- [ ] 2.5 Live status announces gate changes without timer chatter

### Phase 3: Phase 8 Quality Companion and Regression Belt

#### Automated

- [x] 3.1 Test-plan Phase 8 includes S-39 operability criteria
- [x] 3.2 Optional wedge-scoped axe decision recorded, and coverage passes if added
- [x] 3.3 Focused wedge regression passes
- [x] 3.4 Required project checks pass
- [x] 3.5 Required unit and integration suite passes
- [x] 3.6 Required e2e belt passes

#### Manual

- [ ] 3.7 Scope remains bounded to wedge gates and Phase 8 coverage
- [ ] 3.8 Final keyboard-only gate smoke confirms open, announce, act, and close flow
