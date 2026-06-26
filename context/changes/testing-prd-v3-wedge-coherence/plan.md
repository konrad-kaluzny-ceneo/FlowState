# PRD v3 Wedge Coherence Implementation Plan

## Overview

This change closes the remaining test gaps for test-plan Phase 8 / roadmap Q-08. It proves shipped PRD v3 wedge behavior across transition mutex, actionability, pause semantics, optimistic handoff, sync recovery, and S-39 operability without reopening product scope.

The rollout is test-focused. Production code changes are out of scope unless a test exposes shipped behavior that cannot truthfully satisfy the existing contract; in that case, record the bug and keep any fix minimal and local to the failing contract.

## Current State Analysis

The shipped wedge surfaces already have substantial coverage. The conductor has a focused unit suite, `use-pomodoro-cycle` has broad hook coverage for pause, optimism, and sync recovery, and dashboard/component tests cover many overlay visibility and operability paths.

The remaining gaps are narrow and layer-local:

- The named Risk #12 break-alerts permission deferral incident lacks a dashboard oracle proving deferred `pomodoro.start` fires after dismiss or enable.
- `break-alerts-permission-prompt` has only a dismiss assertion and lacks enable-path and S-39 operability tests.
- `wedge-sync-recovery` has no co-located component test for role/name, polite status, or keyboard retry.
- Pause has no oracle that it does not count as interruption, and no persisted PAUSED integration round-trip.
- The conductor's one-gate invariant is only implied by construction, not asserted as a beat-level mutual-exclusion property.
- The optimistic check-in path lacks a direct "no stale suggestion card" oracle.

## Desired End State

Phase 8 is complete when risks #8-#12 have explicit, cheapest-layer oracles and the durable cookbook tells future wedge changes how to add the same proofs. A future implementer should be able to run targeted Vitest commands for each risk path, then `pnpm check` and `pnpm test`, without adding or relying on Playwright belt coverage.

### Key Discoveries:

- `context/changes/testing-prd-v3-wedge-coherence/research.md` found no production-code blocker; all gaps are reachable through existing hook, component, router, and module-mock seams.
- `context/foundation/test-plan.md` requires hook/component-first selection and says belt extensions belong only when cheaper layers cannot observe dismiss or operability.
- `context/foundation/lessons.md` requires every affected wedge gate to prove it opens, accepts the primary action, closes, and unblocks the next beat.
- Plan-review spot checks found the break-alerts prompt and sync-recovery surface may need small local semantic fixes if the new S-39 assertions expose missing dialog naming, focus, or polite-status behavior. Those fixes stay in scope only when required to satisfy the existing shipped operability contract.

## What We're NOT Doing

- No new product behavior, wedge surfaces, conductor priority changes, or UX redesign.
- No reopening shipped rows F-07, S-21, S-24, S-28, S-34, S-35, or S-39 as feature work.
- No Playwright belt or full-catalog e2e additions; research found cheaper layers observe every contract.
- No app-wide accessibility audit, broad axe expansion, or vision-based review.
- No Phase 5 mutation-oracle hardening outside the Phase 8 wedge risk paths.
- No general refactor of `use-pomodoro-cycle`, `pomodoro-dashboard`, or `src/lib/wedge/**`.

## Implementation Approach

Work from the most user-blocking deferral risk outward. First prove the break-alerts permission gate cannot deadlock a start action. Then add the missing recovery and pause contracts. Finally harden the pure conductor and optimistic suggestion invariants, and update the §6.10 cookbook with the new reference tests.

Each phase should land independently with targeted Vitest commands. The final phase runs the repository gates: `pnpm check` and `pnpm test`. No e2e belt command is part of this plan.

## Decisions Recorded

| Decision | Choice | Confidence | Rationale |
| --- | --- | ---: | --- |
| Layer selection | Hook/component/integration only; no belt e2e | 95% | Research found every gap is observable below browser level and test-plan §1/§6.10 prefers cheaper layers. |
| Phase order | Start with Risk #12 permission deferral | 95% | It is the named reference incident behind stuck-gate risk and has the largest current oracle gap. |
| Risk #8 oracle | Enumerated mutual-exclusion matrix, not fast-check by default | 80% | The input space is small and explicit cases will be easier to maintain; fast-check can be added later only if the matrix becomes unwieldy. |
| Pause integration placement | Prefer `src/server/api/routers/cycle.test.ts` unless it becomes too dense | 80% | Existing cycle router integration patterns already cover create/getActive/complete round-trips. |
| Cookbook scope | Update only §6.10 with landed Phase 8 patterns | 90% | Frame and test-plan both make §6.10 durable guidance; broader refresh is out of scope. |

## Phase 1: Break-Alerts Permission Deferral

### Overview

Close the highest-value Risk #12 gap: a start action deferred behind the break-alerts permission prompt must resume after either "Not now" or enable, and the prompt itself must satisfy the S-39 modal operability contract.

### Changes Required:

#### 1. Break-Alerts Permission Prompt Component Tests

**File**: `src/app/_components/break-alerts-permission-prompt.test.tsx`

**Intent**: Expand the component smoke from dismiss-only to the full permission gate contract. The prompt is a blocking modal gate, so it must be named, focusable, actionable with native buttons, and able to complete both dismiss and enable paths.

**Contract**: Given the prompt is visible, when the user dismisses or enables alerts, then the appropriate callback fires once and the gate is no longer blocking. Given keyboard interaction on the enable/dismiss controls, then native button behavior triggers the same callbacks. Assert role/name and focus behavior through the existing overlay primitive rather than re-testing implementation details. If these assertions expose missing modal semantics, make the smallest component-level attribute/wiring fix needed for the shipped S-39 contract instead of weakening the oracle.

#### 2. Dashboard Deferral Chain Tests

**File**: `src/app/_components/pomodoro-dashboard.test.tsx`

**Intent**: Prove the dashboard does not reproduce the permission deferral deadlock that motivated Risk #12. Starting a cycle may park behind the permission prompt, but dismissal or enable must replay the pending start.

**Contract**: Given `handleStartWithPermission` determines that the first-run permission prompt is needed, when the user starts a session, then `pomodoro.start` is not called before the prompt action. When the user dismisses the prompt, then the prompt clears and `pomodoro.start` fires once. Repeat the same BDD path for the enable action. Mock notification permission/defer modules at their boundaries; do not modify product logic.

### Success Criteria:

#### Automated Verification:

- Risk #12 prompt component oracle passes: `pnpm exec vitest run src/app/_components/break-alerts-permission-prompt.test.tsx`
- Risk #12 dashboard deferral oracle passes: `pnpm exec vitest run src/app/_components/pomodoro-dashboard.test.tsx`
- Combined phase command passes: `pnpm exec vitest run src/app/_components/break-alerts-permission-prompt.test.tsx src/app/_components/pomodoro-dashboard.test.tsx`

#### Manual Verification:

- Review the tests and confirm they use user-visible behavior: role/name, focus/action callbacks, prompt visibility, and `pomodoro.start` replay.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for review before proceeding to the next phase.

---

## Phase 2: Wedge Sync Recovery Operability

### Overview

Close the Risk #11 component-layer gap. The hook already preserves wedge intent and supports retry; this phase proves the recovery UI is operable and accessible enough to expose that behavior to the user.

### Changes Required:

#### 1. Wedge Sync Recovery Component Test

**File**: `src/app/_components/wedge-sync-recovery.test.tsx`

**Intent**: Add the missing co-located component smoke for the recovery surface. This should verify the user can recognize the recovery state and retry without mouse-only or screen-reader-hostile behavior.

**Contract**: Given a wedge sync failure message and retry callback, when the recovery component renders, then it exposes a labelled user-facing region or alert/status surface, exactly one polite status for the recovery state, and a native retry button. When the user activates retry by click or keyboard, then the retry callback fires once. If the current markup is assertive or unnamed, make the smallest local semantic fix needed for the S-39 operability contract.

#### 2. Dashboard Recovery Render Guard

**File**: `src/app/_components/pomodoro-dashboard.test.tsx`

**Intent**: Preserve the existing dashboard assertion that wedge sync recovery appears instead of a generic Pomodoro error, while avoiding duplicated hook recovery logic in component tests.

**Contract**: If existing dashboard coverage already asserts the recovery component renders for wedge recovery state, leave it as-is. Extend only if Phase 2 reveals that the dashboard does not assert a user-visible recovery surface at all.

### Success Criteria:

#### Automated Verification:

- Risk #11 component oracle passes: `pnpm exec vitest run src/app/_components/wedge-sync-recovery.test.tsx`
- Dashboard recovery guard remains green if touched: `pnpm exec vitest run src/app/_components/pomodoro-dashboard.test.tsx`
- Combined phase command passes: `pnpm exec vitest run src/app/_components/wedge-sync-recovery.test.tsx src/app/_components/pomodoro-dashboard.test.tsx`

#### Manual Verification:

- Review that the test stays presentational: props in, retry callback out, no hook or tRPC behavior duplicated.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for review before proceeding to the next phase.

---

## Phase 3: Pause Semantics and Persistence

### Overview

Close the Risk #10 contract gaps: pause is not an interruption, and PAUSED state can round-trip through the cycle API shape used by authenticated sessions.

### Changes Required:

#### 1. Pause Does Not Count as Interruption

**File**: `src/hooks/use-pomodoro-cycle.test.tsx`

**Intent**: Add a behavior-contract oracle that pause and resume preserve interruption semantics. Pause freezes the timer; it is not a user interruption and must not call the interrupt path or increment interruption count.

**Contract**: Given a running work cycle, when the user pauses, resumes, and reaches the pause cap path, then pause/resume behavior does not invoke the interrupt mutation and does not expose an incremented `interruptionCount`. Keep the assertion at the public hook/mutation boundary already used by existing pause tests.

#### 2. Persisted PAUSED Round Trip

**File**: `src/server/api/routers/cycle.test.ts`

**Intent**: Add the missing authenticated integration proof for persisted pause state. The hook already hydrates PAUSED cycles; the router layer should preserve the state and remaining-time fields needed for that hydration.

**Contract**: Given an authenticated caller with an active cycle, when the cycle is paused through the existing API contract and then read back through the active-cycle path, then the response represents PAUSED state with the same user ownership, task/session association, and pause timing fields required by the hook. If the existing router exposes pause through a different procedure or helper, follow that existing boundary rather than adding a new API.

### Success Criteria:

#### Automated Verification:

- Risk #10 hook oracle passes: `pnpm exec vitest run src/hooks/use-pomodoro-cycle.test.tsx`
- Risk #10 router integration passes: `pnpm exec vitest run src/server/api/routers/cycle.test.ts`
- Combined phase command passes: `pnpm exec vitest run src/hooks/use-pomodoro-cycle.test.tsx src/server/api/routers/cycle.test.ts`

#### Manual Verification:

- Review that the hook test asserts "not an interruption" directly, not merely that pause UI appears.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for review before proceeding to the next phase.

---

## Phase 4: Mutex and Optimistic Suggestion Oracles

### Overview

Close the remaining Risk #8 and Risk #9 gaps with cheap, durable oracles: one gate per beat at the conductor boundary, and no stale suggestion card during the optimistic post-check-in handoff.

### Changes Required:

#### 1. Conductor Mutual-Exclusion Matrix

**File**: `src/lib/wedge/transition-conductor.test.ts`

**Intent**: Make the PRD "at most one gate" invariant explicit instead of relying on construction. This protects future conductor edits from accidentally exposing multiple `show*` booleans.

**Contract**: Given representative candidate inputs where multiple gates could be eligible, when `resolveWedgeBeat` returns, then no more than one gate boolean is true. Include paused-cycle suppression and a case where suggestion eligibility coexists with another gate candidate. Prefer an enumerated matrix unless implementation shows fast-check would be clearer.

#### 2. No-Stale-Suggestion Optimistic Handoff

**File**: `src/hooks/use-pomodoro-cycle.test.tsx`

**Intent**: Extend the S-34 optimistic suite to prove the old suggestion does not remain visible while a new post-check-in suggestion is being resolved.

**Contract**: Given a previous suggestion exists and the user submits a check-in, when the check-in mutation is deferred and the next suggestion is still pending, then the hook state hides or invalidates the stale suggestion before the fresh suggestion resolves. When the fresh suggestion resolves, then the current suggestion state reflects the fresh response.

#### 3. Suggestion Card Loading-to-Ready Smoke

**File**: `src/app/_components/task-suggestion-card.test.tsx`

**Intent**: Keep the visual handoff honest at component level without duplicating hook timing logic. The card should not show old task content while the hook says the suggestion is loading or unavailable.

**Contract**: Given loading or empty suggestion props after check-in, then stale title/rationale content is absent and the user sees the established loading/empty state. Given fresh suggestion props, then the fresh suggestion title and rationale render.

### Success Criteria:

#### Automated Verification:

- Risk #8 conductor oracle passes: `pnpm exec vitest run src/lib/wedge/transition-conductor.test.ts`
- Risk #9 hook oracle passes: `pnpm exec vitest run src/hooks/use-pomodoro-cycle.test.tsx`
- Risk #9 component smoke passes: `pnpm exec vitest run src/app/_components/task-suggestion-card.test.tsx`
- Combined phase command passes: `pnpm exec vitest run src/lib/wedge/transition-conductor.test.ts src/hooks/use-pomodoro-cycle.test.tsx src/app/_components/task-suggestion-card.test.tsx`

#### Manual Verification:

- Review that the no-stale oracle asserts user-visible absence of old suggestion content, not only internal ID invalidation.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for review before proceeding to the next phase.

---

## Phase 5: Cookbook Update and Final Verification

### Overview

Capture the landed Phase 8 patterns in the durable test-plan cookbook and run final local gates. This phase completes Q-08 without broadening into a test-plan refresh.

### Changes Required:

#### 1. Wedge Cookbook Update

**File**: `context/foundation/test-plan.md`

**Intent**: Update §6.10 so future wedge-transition changes inherit the Phase 8 deferral, recovery, pause, mutex, and stale-suggestion oracle patterns.

**Contract**: Add the new reference tests and reusable guidance discovered while implementing this plan. At minimum, §6.10 should mention the break-alerts permission deferral row, `wedge-sync-recovery.test.tsx`, the pause-not-interruption oracle, conductor mutual-exclusion matrix, and no-stale-suggestion handoff if those tests landed. Do not rewrite §1-§5 strategy or unrelated cookbook sections.

#### 2. Final Repository Gates

**File**: repository root

**Intent**: Verify the whole non-e2e suite after all focused oracles and cookbook updates land.

**Contract**: Run `pnpm check` and `pnpm test`. Do not run `pnpm test:e2e:belt` for this plan unless a prior phase discovers that a contract cannot be observed below browser level and the plan is explicitly amended.

### Success Criteria:

#### Automated Verification:

- Cookbook references the new Phase 8 patterns in §6.10.
- Quality gate passes: `pnpm check`
- Unit/integration gate passes: `pnpm test`

#### Manual Verification:

- Review §6.10 for scope discipline: it should teach reusable wedge coherence patterns without broad strategy refresh or unrelated cookbook churn.

**Implementation Note**: After completing this phase and all automated verification passes, Q-08 can move to implementation review / archive flow.

---

## Testing Strategy

### Unit and Hook Tests:

- Conductor mutex: `src/lib/wedge/transition-conductor.test.ts`
- Pause semantics and optimistic no-stale suggestion: `src/hooks/use-pomodoro-cycle.test.tsx`

### Component Tests:

- Permission prompt: `src/app/_components/break-alerts-permission-prompt.test.tsx`
- Dashboard deferral/recovery matrix: `src/app/_components/pomodoro-dashboard.test.tsx`
- Recovery UI: `src/app/_components/wedge-sync-recovery.test.tsx`
- Suggestion card loading/ready handoff: `src/app/_components/task-suggestion-card.test.tsx`

### Integration Tests:

- Persisted PAUSED state: `src/server/api/routers/cycle.test.ts`

### E2E:

- No Playwright belt or full-catalog additions are planned. Research found every Phase 8 gap is observable through cheaper layers.

## Performance Considerations

The plan adds test oracles only. It should not change runtime performance. The Risk #9 hook tests should preserve the established deferred-mock pattern for perceived responsiveness instead of adding brittle wall-clock assertions.

## Migration Notes

No database migration or data migration is planned. Persisted pause integration should use existing API/schema contracts only.

## References

- Change brief: `context/changes/testing-prd-v3-wedge-coherence/change.md`
- Frame brief: `context/changes/testing-prd-v3-wedge-coherence/frame.md`
- Research: `context/changes/testing-prd-v3-wedge-coherence/research.md`
- Test plan: `context/foundation/test-plan.md`
- Roadmap item: `context/foundation/roadmap-references/items/Q-08.md`
- Lessons: `context/foundation/lessons.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Break-Alerts Permission Deferral

#### Automated

- [x] 1.1 Risk #12 prompt component oracle passes — dc6c60b
- [x] 1.2 Risk #12 dashboard deferral oracle passes — dc6c60b
- [x] 1.3 Combined Phase 1 Vitest command passes — dc6c60b

#### Manual

- [ ] 1.4 Tests assert user-visible prompt actionability and deferred start replay

### Phase 2: Wedge Sync Recovery Operability

#### Automated

- [x] 2.1 Risk #11 component oracle passes — 1cb31a4
- [x] 2.2 Dashboard recovery guard remains green if touched — 1cb31a4
- [x] 2.3 Combined Phase 2 Vitest command passes — 1cb31a4

#### Manual

- [ ] 2.4 Recovery test stays presentational and does not duplicate hook recovery logic

### Phase 3: Pause Semantics and Persistence

#### Automated

- [x] 3.1 Risk #10 hook no-interruption oracle passes — 9c98b30
- [x] 3.2 Risk #10 router persisted-pause integration passes — 9c98b30
- [x] 3.3 Combined Phase 3 Vitest command passes — 9c98b30

#### Manual

- [ ] 3.4 Hook oracle directly proves pause is not an interruption

### Phase 4: Mutex and Optimistic Suggestion Oracles

#### Automated

- [ ] 4.1 Risk #8 conductor mutual-exclusion oracle passes
- [ ] 4.2 Risk #9 hook no-stale-suggestion oracle passes
- [ ] 4.3 Risk #9 suggestion card smoke passes
- [ ] 4.4 Combined Phase 4 Vitest command passes

#### Manual

- [ ] 4.5 No-stale oracle asserts user-visible absence of old suggestion content

### Phase 5: Cookbook Update and Final Verification

#### Automated

- [ ] 5.1 Cookbook references the new Phase 8 patterns in §6.10
- [ ] 5.2 Quality gate passes: `pnpm check`
- [ ] 5.3 Unit/integration gate passes: `pnpm test`

#### Manual

- [ ] 5.4 §6.10 update stays scoped to reusable wedge coherence patterns
