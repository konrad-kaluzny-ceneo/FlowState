---
date: 2026-06-07T12:00:00+02:00
researcher: Cursor Agent
git_commit: ef6892c4d28a3c872629b1b5c3b91b03f3eff4fe
branch: features/adaptive-task-suggestion
repository: FlowState
topic: "Adaptive task suggestion (S-06) — scoring inputs, integration hooks, UX, and v1 formula"
tags: [research, codebase, adaptive-task-suggestion, scoring, check-in, session-context, FR-021, FR-022]
status: complete
last_updated: 2026-06-07
last_updated_by: Cursor Agent
---

# Research: Adaptive Task Suggestion (S-06)

**Date**: 2026-06-07  
**Researcher**: Cursor Agent  
**Git Commit**: `ef6892c4d28a3c872629b1b5c3b91b03f3eff4fe`  
**Branch**: `features/adaptive-task-suggestion`  
**Repository**: [konrad-kaluzny-ceneo/FlowState](https://github.com/konrad-kaluzny-ceneo/FlowState)

## Research Question

How should FlowState implement adaptive next-task suggestion with override (FR-021, FR-022) on top of the shipped S-04 (task attributes) and S-05 (check-in) substrate? What exists in code, what gaps remain, and what are best-practice UX and v1 formula recommendations?

## Scope Decisions (self-aligned)

Research scope was set to **feature + prerequisites + integration points**, **detailed architectural depth**, with focus on **patterns, integration hooks, and UX flow** — appropriate for `/10x-plan` on the wedge slice.

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Scope | S-06 + S-04/S-05 substrate + cycle-end flow | S-06 cannot be planned in isolation; hooks live in `use-pomodoro-cycle` and dashboard overlays |
| Depth | Full architecture + concrete v1 formula proposal | Roadmap flags medium research need; PRD leaves coefficients open but directional behavior is clear |
| Output | Comprehensive research doc with implementer-ready recommendations | Enables `/10x-plan` without re-auditing codebase |
| Guest mode | Auth-only for suggestion | PRD FR-003b excludes check-ins and scoring from guest slice |
| Formula location | Server-side pure function + tRPC procedure | Testable, single source of truth, no client/server drift |
| Override persistence | Lightweight `SuggestionDecision` row or session-scoped last choice | PRD requires override to feed next suggestion; no schema exists yet |

## Summary

**S-06 is greenfield in application code.** All scoring *inputs* are shipped: `Task.workType` + `Task.weight` (S-04), `CheckIn.energy` per cycle (S-05), session lifecycle and `cycle.countCompletedWork` (F-01/S-01). There is **no** scoring module, suggestion UI, override recording, or client consumer of `checkIn.list`.

The natural integration point is **`submitCheckIn` success** in [`use-pomodoro-cycle.ts`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/ef6892c4d28a3c872629b1b5c3b91b03f3eff4fe/src/hooks/use-pomodoro-cycle.ts#L630-L661): after `checkIn.create`, fetch suggestion, then proceed to break via `confirmComplete`. **UX best practice:** show the suggestion as a **persistent, non-blocking card during the break** (not another modal gate — check-in fatigue is already one gate). Pre-focus the suggested task so break-end "Continue" can become one-click accept. Override remains the existing **Focus** buttons on `TaskList` — never hide alternatives.

**Gaps to close in S-06:** (1) deterministic scorer + rationale templates, (2) tRPC `suggestion.next` (or similar), (3) `TaskSuggestionCard` UI, (4) override persistence, (5) wire `Session.interruptionCount` increment on mid-cycle rebind/completion (column exists, never updated), (6) auth-only guard mirroring check-in.

## Detailed Findings

### 1. Scoring inputs — Task attributes (S-04, done)

Prisma [`Task`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/ef6892c4d28a3c872629b1b5c3b91b03f3eff4fe/prisma/schema.prisma#L42-L59) exposes:

- `workType`: `DEEP_WORK` | `OPERATIONAL` | `REACTIVE` (default `OPERATIONAL`; migrated from `ADMIN`)
- `weight`: `Int` 1–3 (default `2`)
- `status`: `"active"` | `"completed"` (string, not enum)

tRPC [`task.list`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/ef6892c4d28a3c872629b1b5c3b91b03f3eff4fe/src/server/api/routers/task.ts#L7-L11) returns **all** tasks — no server-side active filter. Client precedent for candidates: `tasks.filter(t => t.status === "active")` in [`task-list.tsx:117-118`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/ef6892c4d28a3c872629b1b5c3b91b03f3eff4fe/src/app/_components/task-list.tsx#L117-L118) and [`pomodoro-dashboard.tsx:26-40`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/ef6892c4d28a3c872629b1b5c3b91b03f3eff4fe/src/app/_components/pomodoro-dashboard.tsx#L26-L40).

UI labels in [`task-list.tsx`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/ef6892c4d28a3c872629b1b5c3b91b03f3eff4fe/src/app/_components/task-list.tsx#L8-L14): Deep / Ops / Reactive; weight Light (1) / Medium (2) / Heavy (3). Full create/edit/display shipped in S-04 archive.

**Suggestion candidates:** active tasks only; exclude currently focused task if still active (optional — usually cleared on break). Completed tasks must never appear.

### 2. Check-in substrate (S-05, done)

[`CheckIn`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/ef6892c4d28a3c872629b1b5c3b91b03f3eff4fe/prisma/schema.prisma#L100-L111) is **cycle-scoped** (`cycleId @unique`), energy enum `FOCUSED | STEADY | FADING`.

tRPC [`checkIn.create`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/ef6892c4d28a3c872629b1b5c3b91b03f3eff4fe/src/server/api/routers/check-in.ts#L16-L54) and [`checkIn.list`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/ef6892c4d28a3c872629b1b5c3b91b03f3eff4fe/src/server/api/routers/check-in.ts#L8-L14) exist; **only `create` is used client-side today.**

Cycle-end flow (authenticated WORK):

1. Timer expires → `CycleCompleteOverlay` confirm
2. `onCycleCompleteConfirm` → `awaitingCheckIn = true` ([`use-pomodoro-cycle.ts:624-625`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/ef6892c4d28a3c872629b1b5c3b91b03f3eff4fe/src/hooks/use-pomodoro-cycle.ts#L624-L625))
3. [`CheckInOverlay`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/ef6892c4d28a3c872629b1b5c3b91b03f3eff4fe/src/app/_components/check-in-overlay.tsx) — non-dismissible, z-60
4. `submitCheckIn` → `checkIn.create` → `confirmComplete` → break starts
5. Break end → idle → user picks task via Focus

Guest skips check-in entirely ([`pomodoro-dashboard.tsx:151-165`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/ef6892c4d28a3c872629b1b5c3b91b03f3eff4fe/src/app/_components/pomodoro-dashboard.tsx#L151-L165)).

### 3. Session context (FR-019, partial)

[`Session`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/ef6892c4d28a3c872629b1b5c3b91b03f3eff4fe/prisma/schema.prisma#L62-L77): `interruptionCount`, `startedAt`, `lastActivityAt`, lifecycle via [`active-session.ts`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/ef6892c4d28a3c872629b1b5c3b91b03f3eff4fe/src/server/api/lib/active-session.ts).

| Signal | Status |
|--------|--------|
| Cycles completed | ✅ [`cycle.countCompletedWork`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/ef6892c4d28a3c872629b1b5c3b91b03f3eff4fe/src/server/api/routers/cycle.ts#L24-L35) |
| Latest energy | ✅ Just-created check-in on current cycle |
| Interruption count | ❌ Column exists; **never incremented** in app code |
| Time of day | ❌ Not computed anywhere in `src/` |
| Override history | ❌ Not modeled |

Mid-cycle paths exist ([`cycle.rebindTask`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/ef6892c4d28a3c872629b1b5c3b91b03f3eff4fe/src/server/api/routers/cycle.ts#L188-L224), [`onMidCycleEndCycleAndBreak`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/ef6892c4d28a3c872629b1b5c3b91b03f3eff4fe/src/hooks/use-pomodoro-cycle.ts#L664-L705)) but do not touch session context counters.

### 4. Recommended UX flow (best practice)

**Principle:** Suggest, don't enforce (PRD FR-022). Predictable rationale builds trust (PRD FR-021 Socrates note). Minimize gates — user already passed check-in.

| Phase | UX | Why |
|-------|-----|-----|
| After check-in submit | Fetch suggestion async; do **not** block break start | NFR: break transition must stay smooth; suggestion can load during break |
| During break | Show **`TaskSuggestionCard`** below timer — task title, badges, one-line rationale, "Focus this" CTA | User reflects during rest; aligns with PRD "after check-in" without a third modal |
| Break end (`CycleCompleteOverlay` break variant) | If suggestion pre-focused: primary button **"Continue with [task title]"**; secondary "Choose different task" dismisses pre-focus | One-click accept at natural decision point |
| Override | Any **Focus** on `TaskList` clears suggestion highlight + records override | Zero new navigation; list always visible |
| Loading >1s | Skeleton/spinner on card per NFR continuous feedback | |
| Accept/override ack | Optimistic `selectTask` + highlight ≤200ms | Matches NFR + S-09 direction |
| Empty candidates | Card: "No active tasks — add one or end session" | Avoid silent failure |
| Guest | No suggestion UI | PRD FR-003b |

**Rationale copy:** template-driven, not ML — e.g. `"Deep work — you're focused with few interruptions"`, `"Light ops — energy fading after 3 cycles"`. Map from scorer debug factors to i18n-ready strings in `/10x-plan`.

**Z-index:** suggestion card inline (no overlay); below check-in z-60 if ever shown concurrently during transition.

### 5. Recommended v1 scoring formula

Deterministic, transparent, unit-testable. PRD: `weight × type fit × session context`. Coefficients are **starting points** for post-launch calibration (PRD Open Q1).

```typescript
// Pure function: scoreTask(task, context) → number
// context: { energy, completedWorkCycles, interruptionCount, hourOfDay, lastOverrideWorkType? }

// Base
score = task.weight  // 1–3

// Energy → work type fit multiplier
TYPE_FIT = {
  FOCUSED: { DEEP_WORK: 1.5, OPERATIONAL: 1.0, REACTIVE: 0.7 },
  STEADY:  { DEEP_WORK: 1.1, OPERATIONAL: 1.2, REACTIVE: 1.0 },
  FADING:  { DEEP_WORK: 0.6, OPERATIONAL: 1.3, REACTIVE: 1.4 },
}
score *= TYPE_FIT[energy][task.workType]

// Session fatigue (after 3+ work cycles, bias away from deep work)
if (completedWorkCycles >= 4) score *= task.workType === "DEEP_WORK" ? 0.75 : 1.1
else if (completedWorkCycles >= 2) score *= task.workType === "DEEP_WORK" ? 0.9 : 1.05

// Interruptions (when wired)
score *= Math.max(0.7, 1 - interruptionCount * 0.1)

// Late day (local hour ≥ 17)
if (hourOfDay >= 17) score *= task.workType === "DEEP_WORK" ? 0.85 : 1.1

// Override feedback: slight boost to user's chosen work type next round
if (lastOverrideWorkType === task.workType) score *= 1.15

// Pick argmax; tie-break: higher weight, then older createdAt
```

**Rationale generation:** expose top contributing factor (energy fit vs fatigue vs late day) as the template key.

**Server procedure sketch:** `suggestion.next({ cycleId })` — loads cycle → session, latest check-in for cycle, active tasks, session metrics, optional last override; returns `{ taskId, title, workType, weight, rationaleKey, rationale }`.

### 6. Override persistence (recommended minimal schema)

PRD: override feeds next suggestion. No existing model.

**Option A (recommended):** new `SuggestionDecision` table:

- `id`, `userId`, `cycleId` (unique — one decision per suggestion point)
- `suggestedTaskId`, `chosenTaskId` (equal if accepted)
- `accepted: boolean`
- `createdAt`

Write on accept (chosen = suggested) or override (chosen ≠ suggested). Scorer reads latest decision in session for `lastOverrideWorkType`.

**Option B (lighter):** JSON on `Session` — harder to query/test; skip unless migration aversion is strong.

### 7. `interruptionCount` wiring (include in S-06)

Increment in [`cycle.rebindTask`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/ef6892c4d28a3c872629b1b5c3b91b03f3eff4fe/src/server/api/routers/cycle.ts#L188-L224) and mid-cycle completion path (server-side in `cycle.complete` when flagged, or dedicated mutation). Without this, PRD session-context input is always zero — formula still works but "uninterrupted" rationale is wrong.

### 8. Integration hook map

| Hook | File | Action |
|------|------|--------|
| Fetch suggestion | `use-pomodoro-cycle.ts` after `checkIn.create` success | Call `suggestion.next`, store `pendingSuggestion` |
| Break start | same `submitCheckIn` path | Keep `confirmComplete` — don't await suggestion |
| Display | `pomodoro-dashboard.tsx` after check-in block (~L117-125) | Render `TaskSuggestionCard` when break running + suggestion present |
| Accept | suggestion card + break-end overlay | `selectTask(suggestedId)` |
| Override | `task-list.tsx` Focus handler | Record decision + clear highlight |
| Tests | `src/server/.../suggestion.test.ts` | Pure scorer golden cases; integration for procedure |

## Code References

- [`prisma/schema.prisma:12-28`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/ef6892c4d28a3c872629b1b5c3b91b03f3eff4fe/prisma/schema.prisma#L12-L28) — `WorkType`, `EnergyLevel`, `SessionState`, `CycleState` enums
- [`prisma/schema.prisma:42-59`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/ef6892c4d28a3c872629b1b5c3b91b03f3eff4fe/prisma/schema.prisma#L42-L59) — `Task` scoring fields
- [`prisma/schema.prisma:62-111`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/ef6892c4d28a3c872629b1b5c3b91b03f3eff4fe/prisma/schema.prisma#L62-L111) — `Session`, `Cycle`, `CheckIn`
- [`src/server/api/routers/task.ts:7-57`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/ef6892c4d28a3c872629b1b5c3b91b03f3eff4fe/src/server/api/routers/task.ts#L7-L57) — task CRUD with attributes
- [`src/server/api/routers/check-in.ts:8-54`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/ef6892c4d28a3c872629b1b5c3b91b03f3eff4fe/src/server/api/routers/check-in.ts#L8-L54) — check-in list/create
- [`src/server/api/routers/cycle.ts:24-35`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/ef6892c4d28a3c872629b1b5c3b91b03f3eff4fe/src/server/api/routers/cycle.ts#L24-L35) — `countCompletedWork`
- [`src/hooks/use-pomodoro-cycle.ts:604-661`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/ef6892c4d28a3c872629b1b5c3b91b03f3eff4fe/src/hooks/use-pomodoro-cycle.ts#L604-L661) — check-in gate + submit flow
- [`src/app/_components/pomodoro-dashboard.tsx:106-125`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/ef6892c4d28a3c872629b1b5c3b91b03f3eff4fe/src/app/_components/pomodoro-dashboard.tsx#L106-L125) — overlay orchestration
- [`src/app/_components/check-in-overlay.tsx:44-74`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/ef6892c4d28a3c872629b1b5c3b91b03f3eff4fe/src/app/_components/check-in-overlay.tsx#L44-L74) — check-in UI pattern to mirror for suggestion card (without modal)
- [`src/app/_components/task-list.tsx:117-118,340-351`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/ef6892c4d28a3c872629b1b5c3b91b03f3eff4fe/src/app/_components/task-list.tsx#L117-L118) — active filter + Focus override path
- [`context/changes/adaptive-task-suggestion/change.md`](context/changes/adaptive-task-suggestion/change.md) — change stub (pre-research)

## Architecture Insights

- **Layering:** Keep scorer pure (`src/server/scoring/` or `src/lib/scoring/`); tRPC thin; hook owns when to fetch; dashboard owns display. Matches existing router + hook split.
- **No `PomodoroSession`:** Domain is `Session` + `Cycle`; join check-ins via `cycleId → sessionId`.
- **Check-in is not session-scoped:** Scorer must join or pass `cycleId` into `suggestion.next`.
- **Guest boundary:** Task attributes work in guest; suggestion auth-only — consistent with check-in gate.
- **Testing:** Unit tests for scorer matrices; integration for procedure; e2e extends `pomodoro-cycle.spec.ts` or new `task-suggestion.spec.ts`. Reuse `e2e/helpers/check-in.ts` pattern.
- **Avoid over-engineering:** No ML, no ranking UI for all tasks, no analytics — single top suggestion per PRD.

## Historical Context (from prior changes)

- [`context/archive/2026-05-26-session-domain-model/plan.md`](context/archive/2026-05-26-session-domain-model/plan.md) — F-01 schema: Task attrs, CheckIn, Session.interruptionCount; explicitly deferred scoring UI to S-06.
- [`context/archive/2026-05-30-task-attributes-for-scoring/plan.md`](context/archive/2026-05-30-task-attributes-for-scoring/plan.md) — S-04 closed UI/repo gap; "No scoring formula → S-06".
- [`context/archive/2026-06-05-testing-check-in-persistence/research.md`](context/archive/2026-06-05-testing-check-in-persistence/research.md) — `checkIn.list` substrate for S-06; cycle-scoped check-in model documented.
- [`context/archive/2026-06-06-testing-active-slice-browser-proofs/plan.md`](context/archive/2026-06-06-testing-active-slice-browser-proofs/plan.md) — S-05 UI gate shipped; `awaitingCheckIn` pattern; no suggestion reader yet.
- [`context/foundation/roadmap.md`](context/foundation/roadmap.md) — S-06 wedge; formula coefficients owned by `/10x-plan`; risk = over-engineering formula before data.
- [`context/foundation/prd.md`](context/foundation/prd.md) — FR-021/022, Business Logic §, guest exclusions, Open Q1.
- [`context/foundation/test-plan.md`](context/foundation/test-plan.md) — Risk #7 closed at persistence layer; S-06 e2e not yet in cookbook.

## Related Research

- [`context/archive/2026-06-05-testing-check-in-persistence/research.md`](context/archive/2026-06-05-testing-check-in-persistence/research.md) — check-in API patterns for suggestion consumer
- Roadmap §Research requirements — external targets (Pomodoro energy matching, weighted prioritization) inform formula design above; no separate exa pass required for planning.

## Open Questions

1. **Migration for `SuggestionDecision`** — confirm in `/10x-plan` vs session JSON shortcut.
2. **Mid-cycle check-in path** — [`onMidCycleEndCycleAndBreak`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/ef6892c4d28a3c872629b1b5c3b91b03f3eff4fe/src/hooks/use-pomodoro-cycle.ts#L703-L704) also sets `awaitingCheckIn`; suggestion must run there too.
3. **Single active task edge case** — scorer returns null; card copy vs hide.
4. **`check-in-gate.spec.ts` deferred** — bundle suggestion e2e or restore dedicated spec?
5. **Post-login guest merge** — merged tasks with attrs participate immediately; no special case needed beyond active task list.
