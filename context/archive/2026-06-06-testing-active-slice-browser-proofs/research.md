---
date: 2026-06-06T12:00:00+02:00
researcher: Cursor Agent (Auto)
git_commit: 3cb2f55bd760c1e74b1029f1c1c8f2b16a7a10ae
branch: features/testing-isolation-abuse-guest-merge
repository: FlowState
topic: "Phase 2 browser proofs — Risk #3 (FR-015 mid-cycle prompt) and Risk #7 (FR-020 check-in gate)"
tags: [research, codebase, e2e, playwright, fr-015, fr-020, s-03, s-05, test-plan, risk-3, risk-7]
status: complete
last_updated: 2026-06-06
last_updated_by: Cursor Agent (Auto)
---

# Research: Phase 2 browser proofs — Risk #3 (FR-015 mid-cycle prompt) and Risk #7 (FR-020 check-in gate)

**Date**: 2026-06-06T12:00:00+02:00  
**Researcher**: Cursor Agent (Auto)  
**Git Commit**: [`3cb2f55`](https://github.com/konrad-kaluzny-ceneo/FlowState/commit/3cb2f55bd760c1e74b1029f1c1c8f2b16a7a10ae)  
**Branch**: `features/testing-isolation-abuse-guest-merge`  
**Repository**: [konrad-kaluzny-ceneo/FlowState](https://github.com/konrad-kaluzny-ceneo/FlowState)

## Research Question

Ground test-plan Phase 2 (`testing-active-slice-browser-proofs`) for **Risk #3** (mid-cycle task completion offers wrong choices or skips the mindful break/end prompt — FR-015) and **Risk #7** (end-of-cycle check-in can be skipped or declared energy fails to persist — FR-020).

Research must locate where failures would live in the live codebase, what e2e infrastructure already exists, what product slices (S-03, S-05) must land first, and the highest-signal Playwright scenarios to write once UI exists.

## Summary

**Both target features are not implemented in product code.** Phase 2 e2e is blocked on S-03 (`mid-cycle-completion-prompt`, active) and S-05 (`end-of-cycle-checkin`, active) landing in `src/` before browser proofs can run.

| Risk | PRD | Roadmap slice | UI status | Server status | E2e status |
|------|-----|---------------|-----------|---------------|------------|
| #3 | FR-015 | S-03 active | Mark-complete **disabled** during running cycle (`cycleLocked`); no mid-cycle prompt component | `task.update` has no cycle guard; `cycle.getActive` detects RUNNING | None — planned in this change |
| #7 | FR-020 | S-05 active | No check-in modal; `confirmComplete` goes straight to break | `checkIn.create`/`list` implemented + integration-tested | None — integration shipped in `testing-check-in-persistence` |

**Critical finding:** The test-plan anti-patterns apply directly — you cannot unit-test an isolated prompt component or snapshot a check-in modal without cycle-in-flight / gate context because those components do not exist yet. The cheapest correct sequence is: **ship S-03 + S-05 product slices with stable `data-testid`s → extend e2e helpers → write Playwright specs**.

**E2e infrastructure is ready.** Phase 1 established per-test auth (`e2e/fixtures.ts`), idle reset (`e2e/helpers/idle-cycle.ts`), short work cycles (`e2e/helpers/work-cycle.ts`), and end-of-cycle overlay flows (`e2e/pomodoro-cycle.spec.ts`). New specs should follow the same skeleton; `ensureIdleCycle` must gain a check-in dismissal step once S-05 ships.

**Recommended `/10x-plan` scope:** Treat this change as **e2e authoring gated on product dependencies**. Plan should either (a) bundle minimal S-03/S-05 UI implementation + testids + e2e in one rollout, or (b) split into product changes first with e2e as a follow-up once UI merges. Do not write e2e that asserts disabled buttons as the final oracle.

## Detailed Findings

### Risk #3 — FR-015 mid-cycle completion prompt (S-03)

#### PRD expectation

From [`context/foundation/prd.md`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/3cb2f55/context/foundation/prd.md#L108-L109):

1. Mid-cycle with active tasks remaining → user chooses **continue current cycle with next task** OR **end cycle and break now**
2. Mid-cycle with no active tasks → only **end cycle and break**

#### Current behavior — block, not prompt

Mark-complete is disabled whenever a cycle is in flight:

- [`task-list.tsx:115`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/3cb2f55/src/app/_components/task-list.tsx#L115) — `cycleLocked = cycleState === "running" || cycleState === "completed"`
- [`task-list.tsx:247-250`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/3cb2f55/src/app/_components/task-list.tsx#L247-L250) — `disabled={cycleLocked || isPending}` on `aria-label="Mark complete"`

The only completion UI is [`cycle-complete-overlay.tsx`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/3cb2f55/src/app/_components/cycle-complete-overlay.tsx) — shown at **natural timer expiry** (`state === "completed"`), not mid-cycle mark-done. Work-cycle buttons are "Done — mark task complete" and "Continue later"; both call `confirmComplete` → complete cycle + auto-start break ([`use-pomodoro-cycle.ts:433-525`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/3cb2f55/src/hooks/use-pomodoro-cycle.ts#L433-L525)).

#### Cycle-in-flight detection (ground truth for e2e setup)

| Layer | Signal | Location |
|-------|--------|----------|
| Client hook | `state === "running"` + `activeCycle != null` | [`use-pomodoro-cycle.ts:29`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/3cb2f55/src/hooks/use-pomodoro-cycle.ts#L29), recovery at `:242-253` |
| UI oracle | `data-testid="timer-panel-running"` | [`timer-panel.tsx:87`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/3cb2f55/src/app/_components/timer-panel.tsx#L87) |
| Server | `cycle.getActive` where `state: RUNNING` | [`cycle.ts:37-45`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/3cb2f55/src/server/api/routers/cycle.ts#L37-L45) |
| Dashboard wiring | `cycleState={pomodoro.state}` → TaskList | [`pomodoro-dashboard.tsx:66-74`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/3cb2f55/src/app/_components/pomodoro-dashboard.tsx#L66-L74) |

Task select/clear also blocked during `running` or `completed` ([`use-pomodoro-cycle.ts:319-337`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/3cb2f55/src/hooks/use-pomodoro-cycle.ts#L319-L337)).

#### Edge cases for e2e (once S-03 ships)

| Scenario | Current | FR-015 expectation |
|----------|---------|-------------------|
| Mark done while `running` | Checkbox disabled | Prompt with two choices |
| Last active task mid-cycle | Disabled | Only "end cycle and break" |
| Revert completed → active during cycle | Disabled (`cycleLocked`) | Must not bypass prompt (FR-009a) |
| API-only `task.update(completed)` during cycle | Succeeds (no server guard) | Product may need server-side guard or prompt trigger |
| Break cycle running | Mark complete disabled | FR-015 is work-cycle scoped |
| `interruptionCount` (FR-019) | Never incremented in codebase | Should increment on mid-cycle completion path |

#### S-03 implementation gaps (product, not test)

Minimum product work before e2e:

1. Enable mark-complete during `running` WORK cycles (narrow `cycleLocked`)
2. New component (e.g. `MidCycleCompletionPrompt`) with conditional choices based on remaining active tasks
3. Hook logic: rebind running cycle to next task (preserve remaining time) OR early-complete + break
4. **`data-testid`s** on overlay and action buttons (recommended: `mid-cycle-prompt-overlay`, `mid-cycle-continue-btn`, `mid-cycle-end-break-btn`)
5. Optional server: cycle `taskId` swap mutation; `interruptionCount` increment

Reuse patterns from `CycleCompleteOverlay`, `canMarkTaskDone` / `activeTaskIds` in [`pomodoro-dashboard.tsx:27-28`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/3cb2f55/src/app/_components/pomodoro-dashboard.tsx#L27-L28).

#### Proposed e2e scenarios (Risk #3)

| Spec | Flow | Key assertions |
|------|------|----------------|
| `mid-cycle-completion.spec.ts` | 2 tasks → start 30s cycle → mark one done mid-flight | Prompt visible; both choices offered; branch A continues timer with new focus; branch B ends cycle + break |
| `mid-cycle-last-task.spec.ts` | 1 task → start cycle → mark done mid-flight | Only end-cycle option visible |

Setup: extend `e2e/helpers/work-cycle.ts` with `addTasks(page, titles[])` and `markTaskCompleteMidCycle(page, title)` once mark-complete is enabled.

---

### Risk #7 — FR-020 check-in gate (S-05)

#### PRD expectation

After each work cycle, user selects one of three energy states (Focused / Steady / Fading) before transition ([`prd.md:124-125`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/3cb2f55/context/foundation/prd.md#L124-L125)). Roadmap treats check-in as **non-skippable in MVP** ([`roadmap.md:200`](https://github.com/konrad-kaluzny-ceneo/FlowState/context/foundation/roadmap.md)).

#### Current behavior — no gate

Transition path today:

1. Timer expires → `handleCycleExpired` → `state = "completed"` ([`use-pomodoro-cycle.ts:110-118`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/3cb2f55/src/hooks/use-pomodoro-cycle.ts#L110-L118))
2. `CycleCompleteOverlay` shown ([`cycle-complete-overlay.tsx:26-28`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/3cb2f55/src/app/_components/cycle-complete-overlay.tsx#L26-L28))
3. User clicks confirm → `confirmComplete` → `cycles.complete()` → auto break ([`use-pomodoro-cycle.ts:433-525`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/3cb2f55/src/hooks/use-pomodoro-cycle.ts#L433-L525))

**Zero client references** to `checkIn` in `src/`. `cycle.complete` does not require a check-in row ([`cycle.ts:129-186`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/3cb2f55/src/server/api/routers/cycle.ts#L129-L186)).

Existing e2e proves the gap: [`pomodoro-cycle.spec.ts`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/3cb2f55/e2e/pomodoro-cycle.spec.ts) completes cycle via overlay with no check-in step.

#### Intended S-05 insertion point

Per [`roadmap.md:201`](https://github.com/konrad-kaluzny-ceneo/FlowState/context/foundation/roadmap.md): check-in lives **between work-end-prompt and break-start**, not before the audio signal.

Recommended flow:

1. Timer expires → audio + `CycleCompleteOverlay` (unchanged S-01)
2. User clicks "Done" / "Continue later"
3. **[S-05 gate]** Energy selection + `checkIn.create` must succeed
4. Only then → `cycle.complete` + break auto-start

Gate implementation options: sub-state `"awaiting-check-in"` in hook, or split `confirmComplete` so WORK cycles cannot complete until check-in resolves. Optional server hardening: reject `cycle.complete` without check-in (not present today).

#### Persistence model (already tested — integration layer)

| Piece | Status | Reference |
|-------|--------|-----------|
| Prisma `CheckIn` model, `EnergyLevel` enum | ✅ | [`schema.prisma:18-22,100-111`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/3cb2f55/prisma/schema.prisma) |
| `checkIn.create` / `checkIn.list` | ✅ | [`check-in.ts`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/3cb2f55/src/server/api/routers/check-in.ts) |
| Create→list round-trip, energies, ordering, limit | ✅ | [`check-in.test.ts`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/3cb2f55/src/server/api/routers/check-in.test.ts) |
| Isolation / IDOR / duplicate | ✅ | [`check-in-isolation.test.ts`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/3cb2f55/src/server/api/routers/check-in-isolation.test.ts) |
| S-06 reader (suggestion scoring) | ❌ proposed | No hook reads `checkIn.list` yet |

Guest mode: check-ins excluded from MVP per PRD — e2e should use authenticated fixture only.

#### Skip vectors to test once S-05 lands

| Vector | Risk | Notes |
|--------|------|-------|
| Escape key | High if modal dismissible | No dialog pattern on current overlay; test-plan flags keyboard skip |
| `end-session-btn` during completed state | Medium | Enabled when `completed` ([`pomodoro-dashboard.tsx:88-89`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/3cb2f55/src/app/_components/pomodoro-dashboard.tsx)) |
| Browser refresh mid-gate | Medium | Recovery returns to `completed` without check-in unless server persists gate state |
| Direct tRPC `cycle.complete` | High | No server coupling to `CheckIn` today |
| Double-click on confirm | Medium | `isConfirming` prop exists on overlay but not wired from dashboard |

#### Proposed e2e scenarios (Risk #7)

| Spec | Flow | Key assertions |
|------|------|----------------|
| `check-in-gate.spec.ts` | Complete 1s work cycle → overlay → "Continue later" | Check-in modal visible; **break timer NOT visible** until energy selected; after selection, break starts |
| `check-in-persistence.spec.ts` | Complete check-in → `waitForResponse(checkIn.create)` | Response contains `{ energy, cycleId }`; optional reload proves session proceeds |

Recommended testids: `check-in-overlay`, `check-in-energy-focused`, `check-in-energy-steady`, `check-in-energy-fading`, `check-in-submit-btn`.

**Anti-pattern (test-plan):** Do not snapshot modal markup without asserting gate blocks transition — assert `timer-panel-running` for break is absent until check-in completes.

---

### E2e infrastructure (reusable for Phase 2)

#### Spec inventory

| File | Covers | Pattern |
|------|--------|---------|
| [`e2e/pomodoro-cycle.spec.ts`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/3cb2f55/e2e/pomodoro-cycle.spec.ts) | S-01 cycle-end overlay | `startFocusedWorkCycle` → `advanceClockThroughFastWork` → overlay buttons |
| [`e2e/persistence-reload.spec.ts`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/3cb2f55/e2e/persistence-reload.spec.ts) | Risk #1 mid-cycle reload | `waitForResponse(cycle.getActive)` before/after reload |
| [`e2e/guest-trial.spec.ts`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/3cb2f55/e2e/guest-trial.spec.ts) | Guest reload | No auth fixture; guest banner oracle |
| [`e2e/smoke.spec.ts`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/3cb2f55/e2e/smoke.spec.ts) | Shell load | Minimal |

#### Auth fixture

[`e2e/fixtures.ts`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/3cb2f55/e2e/fixtures.ts) — fresh API user per test via `POST /api/auth/sign-up/email`; exports `waitForCycleGetActive`. No shared `storageState` (Phase 1 decision).

#### Helpers

| Helper | File | Purpose |
|--------|------|---------|
| `startFocusedWorkCycle(page, title, durationSec)` | [`work-cycle.ts:14-31`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/3cb2f55/e2e/helpers/work-cycle.ts#L14-L31) | Add task → Focus → set duration → Start Cycle |
| `setWorkDurationSec(page, seconds)` | [`work-cycle.ts:8-12`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/3cb2f55/e2e/helpers/work-cycle.ts#L8-L12) | Fills `work-duration-min/sec` |
| `advanceClockThroughFastWork(page)` | [`work-cycle.ts:33-36`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/3cb2f55/e2e/helpers/work-cycle.ts#L33-L36) | Clock install + 2500ms advance |
| `ensureIdleCycle(page)` | [`idle-cycle.ts:3-37`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/3cb2f55/e2e/helpers/idle-cycle.ts#L3-L37) | Dismiss overlays, interrupt, end session |

**Gap:** `ensureIdleCycle` must be extended to dismiss check-in overlay once S-05 ships.

#### Standard authenticated `beforeEach`

```typescript
await page.goto("/");
await expect(page.getByTestId("task-list")).toBeVisible();
await waitForCycleGetActive(page);
await ensureIdleCycle(page);
```

#### Playwright config notes

- Port 3001, `NEXT_PUBLIC_E2E_MAIN_THREAD_TIMER=1` ([`playwright.config.ts`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/3cb2f55/playwright.config.ts))
- Run: `set CI=true && pnpm test:e2e`
- Worker timer path not exercised in e2e (Risk #2 covered in unit/hook tests per Phase 1 scope cut)

#### Existing `data-testid` inventory (cycle/task UI)

| testid | Component |
|--------|-----------|
| `task-list` | Task list container |
| `timer-panel-idle` / `timer-panel-running` | Timer states |
| `timer-countdown` | Running countdown |
| `cycle-complete-overlay` | S-01 end-of-cycle overlay |
| `break-continue-btn` | Break completion |
| `work-duration-min/sec` | Duration picker |
| `end-session-btn` | Session end |

Task rows use role/aria selectors (`aria-label="Mark complete"`, button `"Focus"`) — no per-task testids.

---

## Code References

### Risk #3 — mid-cycle prompt

- [`src/app/_components/task-list.tsx:115`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/3cb2f55/src/app/_components/task-list.tsx#L115) — `cycleLocked` gate
- [`src/app/_components/task-list.tsx:247-264`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/3cb2f55/src/app/_components/task-list.tsx#L247-L264) — mark-complete handler (disabled mid-cycle)
- [`src/app/_components/cycle-complete-overlay.tsx`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/3cb2f55/src/app/_components/cycle-complete-overlay.tsx) — cycle-end overlay (not FR-015)
- [`src/hooks/use-pomodoro-cycle.ts:433-525`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/3cb2f55/src/hooks/use-pomodoro-cycle.ts#L433-L525) — `confirmComplete` transition chain
- [`src/server/api/routers/cycle.ts:37-45`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/3cb2f55/src/server/api/routers/cycle.ts#L37-L45) — `getActive` RUNNING detection

### Risk #7 — check-in gate

- [`src/hooks/use-pomodoro-cycle.ts`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/3cb2f55/src/hooks/use-pomodoro-cycle.ts) — no `checkIn` import or gate state
- [`src/app/_components/pomodoro-dashboard.tsx:76-82`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/3cb2f55/src/app/_components/pomodoro-dashboard.tsx#L76-L82) — wires `onConfirm={pomodoro.confirmComplete}` directly
- [`src/server/api/routers/check-in.ts`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/3cb2f55/src/server/api/routers/check-in.ts) — persistence API ready
- [`src/server/api/routers/cycle.ts:129-186`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/3cb2f55/src/server/api/routers/cycle.ts#L129-L186) — `complete` without check-in prerequisite

### E2e infrastructure

- [`e2e/fixtures.ts`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/3cb2f55/e2e/fixtures.ts) — per-test auth
- [`e2e/helpers/work-cycle.ts`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/3cb2f55/e2e/helpers/work-cycle.ts) — cycle start helpers
- [`e2e/helpers/idle-cycle.ts`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/3cb2f55/e2e/helpers/idle-cycle.ts) — idle reset (needs check-in step)
- [`e2e/pomodoro-cycle.spec.ts`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/3cb2f55/e2e/pomodoro-cycle.spec.ts) — baseline cycle-end flow

## Architecture Insights

1. **Test-plan principle #3 holds:** Risks are scenarios, not code locations. Research confirms both failure surfaces are **missing product features**, not untested edge cases in existing UI.

2. **S-01 overlay is the wrong component for both risks.** `CycleCompleteOverlay` handles natural timer expiry; FR-015 needs a separate mid-cycle prompt; FR-020 needs a post-overlay check-in step in the transition chain.

3. **UI gates vs server guards are asymmetric.** `task.update` and `cycle.complete` do not enforce mindfulness controls — only UI disables mark-complete today. E2e proves user-visible gates; integration already covers check-in persistence contract.

4. **Phase 1 explicitly deferred this work.** `testing-critical-path-persistence-timer` plan non-goals included risks #3 and #7; `testing-check-in-persistence` shipped integration only with e2e deferred to Phase 2.

5. **Cost × signal for Phase 2:** Playwright e2e is the correct layer once UI exists (test-plan row #3 and #7). Writing e2e now would only assert disabled buttons — zero signal for FR-015/FR-020 protection.

## Historical Context (from prior changes)

| Artifact | Relevance |
|----------|-----------|
| [`context/changes/testing-critical-path-persistence-timer/research.md`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/3cb2f55/context/changes/testing-critical-path-persistence-timer/research.md) | Phase 1 e2e patterns, auth isolation, scope cut (no countdown oracle on reload) |
| [`context/changes/testing-critical-path-persistence-timer/reviews/scope-addendum.md`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/3cb2f55/context/changes/testing-critical-path-persistence-timer/reviews/scope-addendum.md) | Reload specs assert `timer-panel-running` only, not ±2s countdown |
| [`context/changes/testing-check-in-persistence/research.md`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/3cb2f55/context/changes/testing-check-in-persistence/research.md) | Risk #7 integration layer complete; UI gate deferred here |
| [`context/changes/first-pomodoro-cycle/plan.md`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/3cb2f55/context/changes/first-pomodoro-cycle/plan.md) | Explicit deferral of mid-cycle prompt to S-03 |
| [`context/foundation/test-plan.md:71`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/3cb2f55/context/foundation/test-plan.md#L71) | Phase 2 row — this change |

## Related Research

- [`context/changes/testing-check-in-persistence/research.md`](context/changes/testing-check-in-persistence/research.md) — Risk #7 server persistence (integration)
- [`context/changes/testing-critical-path-persistence-timer/research.md`](context/changes/testing-critical-path-persistence-timer/research.md) — Phase 1 e2e infrastructure
- [`context/changes/e2e-test-infra/research.md`](context/changes/e2e-test-infra/research.md) — Original e2e setup decisions

## Open Questions

1. **Bundling vs sequencing:** Should `/10x-plan` combine S-03 + S-05 product work with Phase 2 e2e in one change, or open separate product changes (`mid-cycle-completion-prompt`, `end-of-cycle-checkin`) first? Roadmap lists both as `active` with no `context/changes/` folders yet.

2. **Server-side enforcement:** Should `cycle.complete` reject WORK cycles without a check-in once S-05 ships? E2e alone cannot prevent API bypass; integration test would complement browser gate.

3. **Guest mid-cycle path:** FR-015 applies to guest mode via same UI — is guest e2e in scope for Phase 2 or auth-only?

4. **Refresh mid-gate recovery:** If user reloads during pending check-in, what state should recovery restore? Needs product decision before e2e for Risk #7 skip vector.

5. **`ensureIdleCycle` ordering:** Once check-in exists, idle reset must handle check-in → overlay → interrupt chain — confirm dismiss order in plan.
