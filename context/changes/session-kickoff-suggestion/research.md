---
date: 2026-06-08T14:00:00+02:00
researcher: Cursor Agent
git_commit: 14c263b048651033c38a96fb394bf78ee779c70e
branch: features/session-kickoff-suggestion
repository: FlowState
topic: "Session kickoff suggestion (S-15) — scoring contract, trigger moments, duration presets, persistence, integration"
tags: [research, codebase, session-kickoff-suggestion, suggestion, scoring, duration-presets, FR-021, FR-019, FR-009, FR-010, FR-017, S-15]
status: complete
last_updated: 2026-06-08
last_updated_by: Cursor Agent
confidence: 85
---

# Research: Session Kickoff Suggestion (S-15)

**Date**: 2026-06-08  
**Researcher**: Cursor Agent  
**Git Commit**: `14c263b048651033c38a96fb394bf78ee779c70e`  
**Branch**: `features/session-kickoff-suggestion`  
**Repository**: [konrad-kaluzny-ceneo/FlowState](https://github.com/konrad-kaluzny-ceneo/FlowState)

## Research Question

Roadmap S-15 (`session-kickoff-suggestion`) needs evidence before `/10x-plan` on five `needs-research` targets:

1. Kickoff scoring contract without check-in — reuse `suggestion.next` with synthetic context vs dedicated kickoff API?
2. When should kickoff fire (session start, post-break idle, mid-session clear focus)?
3. Work-type duration presets (45/25/15) — where cycle duration is stored today, guest vs logged-in persistence patterns
4. Per-type remembered defaults storage (mirror guest localStorage / server profile patterns)
5. Integration points: pomodoro dashboard, session state, existing suggestion UI, S-19 override ack for kickoff surface

**Decision proxy applied** (confidence ≥ 80%): kickoff on first cycle of new session OR post-break idle without pre-selected task; extend `suggestion.next` with `context: 'kickoff'`; presets deep=45 / admin=25 / reactive=15 min tap-to-apply; per-type defaults in scoped localStorage (guest) + `UserPreference` JSON for auth.

## Summary

**S-15 is greenfield in `src/`** — only S-06 post-check-in suggestion exists today. The wedge stack is ready: `pickBestTask` / `ScoringContext`, `TaskSuggestionCard`, `SuggestionDecision`, override ack (S-19 post-check-in only). Kickoff requires extending the suggestion API contract, new idle-gated client state, work-type duration chips, and kickoff decision persistence (today `SuggestionDecision` is cycle-keyed and check-in-gated).

**Recommended approach (85% confidence):**

| Question | Decision |
|----------|----------|
| API shape | **Extend `suggestion.next`** with `context: 'kickoff' \| 'post_check_in'` (default post_check_in). Kickoff input uses `sessionId` + `localHour`; post-check-in keeps `cycleId` + `localHour`. Extract shared scoring helper from router. |
| Scoring without check-in | Synthetic `energy: STEADY` for kickoff MVP (neutral TYPE_FIT). Post-break kickoff may later use last session check-in — defer to avoid dual paths in MVP. |
| Trigger moments | **MVP:** (a) idle after mount/recovery with active tasks, no focus, no running cycle; (b) idle after break confirm with focus cleared. **Exclude:** mid-session manual focus clear, `dismissPreFocus`, `interrupt`. |
| Duration presets | PRD defaults map: `DEEP_WORK→2700s`, `OPERATIONAL→1500s`, `REACTIVE→900s`. Chips on kickoff card / idle timer panel; never auto-apply on accept. |
| Per-type memory | New `flowstate:workTypeDurationSec` (guest) and `flowstate:workTypeDurationSec:{userId}` (auth), JSON map by `WorkType`. Optional Phase 2: Prisma `UserPreference` for cross-device sync. |
| Override ack | Reuse S-19: `showOverrideAck()` + dashboard banner; extend `selectTask` kickoff branch; `recordDecision` with kickoff context. |

## Detailed Findings

### 1. Kickoff scoring contract — reuse `suggestion.next` vs fork

**Current `suggestion.next`** (`src/server/api/routers/suggestion.ts:19-115`):

- Input: `{ cycleId, localHour }` only — no `context` parameter.
- Hard gate: `cycle.checkIn == null` → `BAD_REQUEST` (lines 39-44).
- Builds `ScoringContext` from DB: `energy` from check-in, `completedWorkCycles`, `interruptionCount`, `lastOverrideWorkType`, `localHour` (lines 74-80).
- Returns task + `rationaleKey` + `rationale` via `pickBestTask` + `formatTaskRationale`.

**Scoring lib** (`src/lib/scoring/score-task.ts:3-86`):

- `energy` is **required** — `TYPE_FIT[context.energy][task.workType]` (line 27); no null path.
- Pure functions — reusable once `ScoringContext` is supplied.

**`recordDecision`** (`suggestion.ts:117-200`):

- Requires WORK cycle + check-in (lines 136-148).
- Upsert keyed on `cycleId` (`prisma/schema.prisma:117-131`) — kickoff has no WORK cycle yet.

**Feasibility of extend vs fork:**

| Approach | Pros | Cons |
|----------|------|------|
| Extend `suggestion.next` | Single router; shared `pickBestTask`; override query reuse; matches decision proxy | Input union widens; tests must branch; `recordDecision` needs parallel kickoff path |
| New `suggestion.kickoff` | Clean contract | Duplicated router boilerplate; two client mutations |

**Recommendation:** Extend `suggestion.next` per decision proxy:

```typescript
// Proposed input (discriminated union)
z.discriminatedUnion("context", [
  z.object({
    context: z.literal("post_check_in"),
    cycleId: z.number().int(),
    localHour: z.number().int().min(0).max(23),
  }),
  z.object({
    context: z.literal("kickoff"),
    sessionId: z.number().int(),
    localHour: z.number().int().min(0).max(23),
  }),
])
```

Kickoff branch:

1. Load session by `sessionId` + `userId`; verify active (not ended).
2. Skip check-in gate.
3. Build `ScoringContext` with `energy: "STEADY"`, session `interruptionCount`, `completedWorkCycles` count, `lastOverrideWorkType` from session-scoped `suggestionDecision` query (same as lines 55-63).
4. Add kickoff-specific `rationaleKey` (e.g. `kickoff_fresh`) in `rationale.ts` / `dominant-factor.ts`.

**Kickoff `recordDecision`:** Extend input with optional `context: 'kickoff'` + `sessionId`; persist via new `sessionId` column on `SuggestionDecision` (nullable `cycleId`) **or** session-scoped client-side queue until first WORK cycle starts. **MVP recommendation:** add nullable `sessionId` + `context` enum on `SuggestionDecision` so override signal feeds next kickoff/post-check-in score immediately.

### 2. When kickoff should fire

**Session lifecycle (FR-019):**

- Session starts lazily on first WORK `cycle.create` (`use-pomodoro-cycle.ts` → `sessions.getOrCreateActive`).
- Session ends on explicit end or 4h inactivity (`active-session.ts`).
- Client `hasActiveSession` is false until first `start()` or cycle recovery.

**Idle states in code today:**

| State | `state` | `focusedTaskId` | `cycleKind` | Kickoff eligible? |
|-------|---------|-----------------|-------------|-------------------|
| Cold start / post-endSession | `idle` | `null` | `null` | **Yes** (a) |
| Post-break, no pre-focus | `idle` | `null` | `null` | **Yes** (b) — `confirmComplete` break branch lines 780-783 |
| Idle with task selected | `idle` | set | `null` | No — user already chose; show `DurationPicker` |
| Break running + S-06 suggestion | `running` | varies | break | No — S-06 owns break suggestions |
| WORK running/completed | `running`/`completed` | varies | WORK | No |
| `dismissPreFocus` / `clearTask` | `idle` | `null` | `null` | **No for MVP** — mid-session focus clear |

**Client trigger hook (proposed):**

```
kickoffEligible =
  mode === "authenticated"
  && enableKickoffGate
  && state === "idle"
  && cycleKind === null
  && focusedTaskId === null
  && !awaitingCheckIn
  && activeTasks.length > 0
  && (postBreakIdleFlag || sessionStartIdleFlag)
```

- `sessionStartIdleFlag`: mount/recovery found no RUNNING cycle AND (`!hasActiveSession` OR `completedWorkCycles === 0` after recovery).
- `postBreakIdleFlag`: set in break `confirmComplete` when `preFocusedTask == null` (line 780-783); cleared on `selectTask` / `acceptKickoff` / `start`.

**Risk mitigation:** Do not fetch kickoff on every `focusedTaskId → null` transition — prevents duplicate wedge with S-06 post-check-in path and nag on intentional focus clear.

**Guest mode:** Auth-only (mirror S-06) — `GuestPomodoroDashboard` passes no suggestion gates (`pomodoro-dashboard.tsx:252`).

### 3. Work-type duration presets — storage today

**Cycle duration field:** `configuredDurationSec` (integer seconds), not minutes.

| Layer | Location | Notes |
|-------|----------|-------|
| API create | `cycle.ts:53-57` | `minWorkCycleSec`..`90*60` |
| Prisma | `schema.prisma:89` | `configuredDurationSec` on `Cycle` |
| Guest blob | `guest-repositories.ts:246-255` | Same field in `flowstate:guest-v1` |
| UI picker | `duration-picker.tsx`, `timer-panel.tsx:133-142` | Generic presets 15/25/45/60 via `getWorkDurationPresets()` (`duration-bounds.ts:29-38`) |
| Last-used global | `duration-storage.ts:8-56` | `flowstate:lastDurationSec` — device-local, **not** user-scoped for auth |
| Save timing | `use-pomodoro-cycle.ts:637` | `setLastDuration` on `start()` only |

**No per-work-type mapping exists.** S-15 adds:

```typescript
// Proposed in duration-bounds.ts
const KICKOFF_PRESET_SEC: Record<WorkType, number> = {
  DEEP_WORK: 45 * 60,
  OPERATIONAL: 25 * 60,
  REACTIVE: 15 * 60,
};
```

Preset chips appear on kickoff accept path (before `start(durationSec)`). Accepting suggestion alone does **not** change duration until user taps a chip or starts with picker default.

### 4. Per-type remembered defaults

**Existing persistence patterns to mirror:**

| Feature | Guest key | Auth key | Module |
|---------|-----------|----------|--------|
| Onboarding flags | `flowstate:onboarding:guest` | `flowstate:onboarding:{userId}` | `onboarding/keys.ts` |
| Global last duration | `flowstate:lastDurationSec` | same (device) | `duration-storage.ts` |
| Guest domain data | `flowstate:guest-v1` | Postgres | `guest/schema.ts` |

**No `UserPreference` Prisma model** — greenfield for server-side per-type memory.

**MVP recommendation (decision proxy):**

1. **Guest:** `flowstate:workTypeDurationSec` — JSON `{ DEEP_WORK?: number, OPERATIONAL?: number, REACTIVE?: number }`.
2. **Auth:** `flowstate:workTypeDurationSec:{userId}` — same shape, user-scoped (mirror onboarding).
3. **Write:** Only on explicit chip tap ("your usual" label when value exists).
4. **Read order:** per-type remembered → `KICKOFF_PRESET_SEC[workType]` → `getLastDuration()` global fallback.
5. **Phase 2 (optional):** Prisma `UserPreference` table with `userId` + JSON `workTypeDurations` for cross-device sync (align with future S-20 audio preference).

Do **not** store duration prefs inside `flowstate:guest-v1` — merge imports tasks/cycles only.

### 5. Integration points

**Hook — `use-pomodoro-cycle.ts`:**

| Existing | Kickoff extension |
|----------|-------------------|
| `fetchSuggestion(cycleId)` L461-495 | `fetchKickoffSuggestion(sessionId)` — parallel `pendingKickoffSuggestion` state |
| `acceptSuggestion` L556-575 | `acceptKickoffSuggestion` — `preFocusTask` + optional duration chip selection |
| `selectTask` override L529-535 | Add kickoff idle branch: `kickoffEligible && pendingKickoff.ready && taskId !== suggested` → `recordDecision` + `showOverrideAck()` |
| `clearSuggestion` | Clear kickoff state on `start()` (already clears post-check-in L588) |
| Post-check-in trigger L916-918 | Separate effect on `kickoffEligible` transition |

**Dashboard — `pomodoro-dashboard.tsx`:**

- Today: `showSuggestionCard` = break running only (L69-72).
- Kickoff: `showKickoffCard` = idle + no focus + `pendingKickoff !== idle` — reuse `TaskSuggestionCard` in same slot (above `TaskList`, L105-132 pattern).
- Add duration preset row component (new or extend `TaskSuggestionCard`).
- Reuse override ack banner L134-141 (`data-testid="suggestion-override-ack"`).

**S-19 override ack (`override-ack-copy.ts`, shipped):**

- Post-check-in only today; kickoff deferred per archive note.
- Reuse `OVERRIDE_ACK_LINE` + `showOverrideAck()` — no new component extraction required for MVP.
- Kickoff override **should** feed same `lastOverrideWorkType` session query (roadmap open question resolved: yes, same signal).

**API registration:** `root.ts` — no new router; extend `suggestionRouter` only.

**E2E:** Model on `e2e/task-suggestion.spec.ts`; add `e2e/session-kickoff.spec.ts` using `e2e/helpers/idle-cycle.ts`.

## Code References

- `src/server/api/routers/suggestion.ts:19-115` — `suggestion.next` contract and check-in gate
- `src/server/api/routers/suggestion.ts:117-200` — `recordDecision` cycle/check-in guards
- `src/lib/scoring/score-task.ts:3-86` — `ScoringContext`, `TYPE_FIT`, `pickBestTask`
- `src/hooks/use-pomodoro-cycle.ts:461-575` — fetch/accept/override suggestion client flow
- `src/hooks/use-pomodoro-cycle.ts:767-785` — post-break focus clear (kickoff trigger b)
- `src/app/_components/pomodoro-dashboard.tsx:59-141` — timer visibility, suggestion card gate, override ack UI
- `src/app/_components/task-suggestion-card.tsx` — reusable kickoff card
- `src/lib/duration-bounds.ts:29-38` — work duration presets (generic)
- `src/lib/duration-storage.ts:8-56` — global last duration localStorage
- `src/lib/suggestion/override-ack-copy.ts:2-5` — S-19 ack copy (reuse for kickoff)
- `prisma/schema.prisma:117-131` — `SuggestionDecision` cycle-keyed schema
- `src/server/api/routers/cycle.ts:48-105` — `configuredDurationSec` persistence

## Architecture Insights

1. **Single scoring pipeline** — `pickBestTask` is context-agnostic; kickoff is an input-construction problem, not a new formula.
2. **Wedge moment discipline** — S-06 owns break-time suggestions after check-in; S-15 owns idle-time suggestions before cycle start. Mutual exclusion via state gates prevents double cards.
3. **Decision persistence gap** — `SuggestionDecision.cycleId @unique` assumes one suggestion point per completed WORK cycle. Kickoff needs session-anchored decisions without a WORK cycle — schema extension is the main migration risk.
4. **Duration is client-preference layer** — cycle length is snapshotted per `Cycle` at create time; presets/memory are UX convenience only (FR-010 tap-to-apply).
5. **Auth-only wedge extension** — consistent with FR-003b guest trial boundaries and S-06 implementation.

## Historical Context (from prior changes)

- `context/archive/2026-06-07-adaptive-task-suggestion/research.md` — established server-side scoring, break-time non-blocking card, `SuggestionDecision` for override signal, auth-only guard. Kickoff was out of S-06 scope.
- `context/archive/2026-06-07-adaptive-task-suggestion/plan.md` — shipped `suggestion.next` + `TaskSuggestionCard` + break pre-focus pattern; kickoff explicitly not included.
- `context/archive/2026-06-08-suggestion-override-acknowledgement/research.md` — inline ack banner, 3s auto-dismiss, always show on override; kickoff surface deferred to S-15.
- `context/archive/2026-06-08-suggestion-override-acknowledgement/plan.md` — post-check-in ack shipped PR #67; kickoff ack wired when S-15 lands.
- `context/foundation/roadmap.md:393-411` — S-15 outcome, unknowns, P-205 per-type memory merge.
- `context/foundation/roadmap.md:490` — S-19 done; kickoff ack blocked on S-15.
- `proposed-FR-session-start-guidance` — referenced in roadmap but **not yet in `prd.md`**; behavior captured in S-15 outcome text (idle suggestion + optional duration preset, never auto-applied).

## Recommended Plan Phases Outline

| Phase | Focus | Deliverables |
|-------|-------|--------------|
| **P1** | API + schema | Extend `suggestion.next` / `recordDecision` with `context`; migration for kickoff `SuggestionDecision` (nullable `cycleId`, `sessionId`, `context`); kickoff rationale keys; unit tests |
| **P2** | Hook + eligibility | `pendingKickoffSuggestion` state; `fetchKickoffSuggestion`; trigger on session-start idle + post-break idle; auth guard |
| **P3** | Kickoff UI | Idle-gated `TaskSuggestionCard`; accept → pre-focus; extend `selectTask` override + S-19 ack |
| **P4** | Duration presets | `KICKOFF_PRESET_SEC`; chip row on kickoff card; `workTypeDurationSec` storage module (guest + auth keys); "your usual" label |
| **P5** | E2E + cookbook | `e2e/session-kickoff.spec.ts`; test-plan §6 cookbook entry; `pnpm check` + `pnpm test` |

**Defer to follow-up:** cross-device `UserPreference` Prisma model; kickoff using last session check-in energy; mid-session focus-clear kickoff; reset-to-PRD-defaults UI; guest kickoff.

## Open Questions

| Item | Status | Notes |
|------|--------|-------|
| Synthetic energy default | **Resolved MVP** | `STEADY` per decision proxy |
| Kickoff trigger scope | **Resolved MVP** | Session-start + post-break idle only |
| API reuse vs fork | **Resolved** | Extend `suggestion.next` with `context: 'kickoff'` |
| Per-type storage | **Resolved MVP** | Scoped localStorage; server table Phase 2 |
| `SuggestionDecision` schema for kickoff | **Needs plan detail** | Nullable `cycleId` + `sessionId` recommended |
| `proposed-FR-session-start-guidance` in PRD | **Open** | Add to PRD in separate docs slice or accept roadmap as source |
| Preset chips on accept vs on focus | **Lean plan** | Show chips after accept when task work type known; tap applies to next `start()` |

## Confidence Assessment

| Area | Confidence |
|------|------------|
| Reuse `suggestion.next` with kickoff context | 88% |
| Trigger moments (session-start + post-break) | 90% |
| Duration preset mapping 45/25/15 | 92% |
| localStorage per-type memory pattern | 87% |
| S-19 ack reuse | 95% |
| `SuggestionDecision` schema extension | 78% |
| **Overall** | **85%** |
