---
date: 2026-06-10T12:00:00+02:00
researcher: Cursor Agent
git_commit: c2933ee51ee592f01405a4a4c9525d1c05dc25ad
branch: features/suggestion-rationale-expander
repository: FlowState
topic: "Suggestion rationale expander (S-23) — factor breakdown UX, scoring hooks, surfaces, guest path"
tags: [research, codebase, suggestion-rationale-expander, scoring, dominant-factor, task-suggestion-card, FR-021, FR-022, FR-019, S-23]
status: complete
last_updated: 2026-06-10
last_updated_by: Cursor Agent
confidence: 88
---

# Research: Suggestion Rationale Expander (S-23)

**Date**: 2026-06-10  
**Researcher**: Cursor Agent  
**Git Commit**: `c2933ee51ee592f01405a4a4c9525d1c05dc25ad`  
**Branch**: `features/suggestion-rationale-expander`  
**Repository**: [konrad-kaluzny-ceneo/FlowState](https://github.com/konrad-kaluzny-ceneo/FlowState)

## Research Question

How should FlowState implement S-23 — tap **"Why this?"** on the next-task suggestion card for a calm, deterministic factor breakdown (dominant factors + "also considered" chips) on post-check-in break, kickoff, and post-break idle surfaces — without leaving the wedge overlay, without duplicating S-17 narrative, and with guest-ready templates from the local session blob?

**Decision proxies applied:**

1. Show top **2–3 dominant factors** + **"also considered"** chips (not a full ranked list).
2. Include **S-15 kickoff** and **break-idle** suggestion surfaces (same `TaskSuggestionCard` pattern).
3. **Guest mode:** same copy templates computed from local session blob (when suggestions exist).

## Scope Decisions (self-aligned)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Scope | S-23 + S-06/S-15 suggestion stack + scoring lib | Expander is UI on existing card; breakdown must mirror server scorer |
| Depth | Full architecture + implementer-ready API/UI contract | Roadmap risk flags copy overload and S-17 collision |
| Guest | Auth surfaces in MVP; pure functions reusable for guest blob | Guest has **no suggestion card today** — expander follows card, not vice versa |
| Data flow | Breakdown bundled in `suggestion.next` response | Instant expand (<200ms NFR per L-04); no second round-trip |
| Factor source | Extend `dominant-factor.ts` contributions array | Logic already exists internally; zero tests today |

## Summary

**S-23 is UI + scoring-export on a mature suggestion stack.** S-06 (post-check-in), S-15 (kickoff/post-break idle), and S-19 (override ack) are shipped. The card shows a one-line `rationale` string; `getDominantRationaleKey` already ranks five session factors by magnitude but only exposes the winner. There is **no** "Why this?" control, no factor breakdown type, and **no unit tests** for `dominant-factor.ts`.

**Recommended approach (88% confidence):**

| Area | Decision |
|------|----------|
| Breakdown shape | `{ headline, dominant: FactorItem[1..3], alsoConsidered: ChipLabel[] }` where `headline` = existing one-line rationale |
| Factor keys | Reuse `RationaleKey` enum; map to short chip labels ("Energy fit", "Cycles completed", "Time of day", "Interruptions", "Last override") |
| Kickoff headline | Keep `formatKickoffRationale` for one-liner; breakdown still lists underlying contributions (kickoff_fresh/resume excluded from chips) |
| API | Extend `suggestion.next` return with `breakdown`; wire through `SuggestionResult` / `KickoffSuggestionResult` in hook |
| UI | Collapsible panel inside `TaskSuggestionCard` below one-liner; `data-testid="suggestion-rationale-expander"`; toggle ack ≤200ms (local state only) |
| Surfaces | Same component for break suggestion (`showSuggestionCard`) and kickoff idle (`showKickoffCard`) in `pomodoro-dashboard.tsx` |
| coachLine / S-17 | Expander lives **below** rationale; never merge with `coachLine` (onboarding) or future narrative line — different vertical slots |
| Guest | Defer guest card wiring; export `buildRationaleBreakdown(task, context, opts)` as pure fn for future client-side guest scorer from `GuestSnapshotV1` |
| F-05 / S-25 | Ship v1 on current five factors; document refresh hook when Eisenhower scorer or pre-suggestion readiness changes energy input |

## Detailed Findings

### 1. Scoring substrate — ready for export

**Pure scorer** — [`src/lib/scoring/score-task.ts`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/c2933ee51ee592f01405a4a4c9525d1c05dc25ad/src/lib/scoring/score-task.ts):

- `ScoringContext`: `energy`, `completedWorkCycles`, `interruptionCount`, `localHour`, `lastOverrideWorkType?` (lines 3–9).
- `scoreTask` applies multipliers for energy/type fit, fatigue (≥2 / ≥4 cycles), interruptions (capped at 4), late day (hour ≥ 17), override (+15% same work type) (lines 25–58).
- `pickBestTask` tie-breaks on `sortOrder`, then `weight`, then `createdAt` (lines 61–93) — **manual priority (S-26) already shipped**.

**Rationale templates** — [`src/lib/scoring/rationale.ts`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/c2933ee51ee592f01405a4a4c9525d1c05dc25ad/src/lib/scoring/rationale.ts):

- Nine `RationaleKey` values including kickoff-specific `kickoff_fresh` / `kickoff_resume` (lines 3–12).
- `buildRationale(key, context)` returns human one-liners (lines 14–39).

**Dominant factor (partial)** — [`src/lib/scoring/dominant-factor.ts`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/c2933ee51ee592f01405a4a4c9525d1c05dc25ad/src/lib/scoring/dominant-factor.ts):

- `getDominantRationaleKey` builds a `contributions` array with `{ key, magnitude }` for override, interruptions, late_day, fatigue, energy_deep/energy_light (lines 39–64).
- Sorts by magnitude; returns top key or `"default"` (lines 59–64).
- `formatTaskRationale` / `formatKickoffRationale` wrap dominant key → string (lines 67–99).
- Kickoff one-liner prefers `kickoff_fresh` / `kickoff_resume` unless dominant is in `KICKOFF_FALLBACK_KEYS` (override, fatigue, interruptions, late_day) (lines 78–98).

**Gap:** contributions array is **private to the function** — S-23 needs a new exported `buildRationaleBreakdown()` that:

1. Reuses contribution computation (extract shared helper).
2. Filters `magnitude > 0`, sorts desc.
3. Takes top 2–3 as `dominant` with full `buildRationale` copy per factor.
4. Remaining keys → short chip labels in `alsoConsidered` (dedupe energy_deep/energy_light → one "Energy fit" chip).
5. Excludes `default` and kickoff-only keys from chips unless they contributed.

**Tests:** No `dominant-factor.test.ts` exists — plan must add coverage before UI.

### 2. Suggestion API — extend return, not new procedure

[`src/server/api/routers/suggestion.ts`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/c2933ee51ee592f01405a4a4c9525d1c05dc25ad/src/server/api/routers/suggestion.ts):

- `next` discriminated union: `post_check_in` (cycleId + localHour) | `kickoff` (sessionId + localHour) (lines 15–26).
- Post-check-in: energy from cycle check-in; `formatTaskRationale` (lines 184–197).
- Kickoff: synthetic `energy: "STEADY"` (line 229); `formatKickoffRationale` (lines 252–265).
- Returns `{ taskId, title, workType, weight, rationaleKey, rationale }` — **no breakdown field**.

`buildScoringContextForSession` (lines 55–91) already loads override history, completed work cycles, interruption count — all inputs needed for breakdown.

**Recommendation:** After picking winner, call `buildRationaleBreakdown(winner, scoringContext, { kickoff: input.context === "kickoff" })` and attach to response. Keeps client dumb; guarantees expander matches server scorer.

### 3. Client integration — two card surfaces, one component

[`src/app/_components/task-suggestion-card.tsx`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/c2933ee51ee592f01405a4a4c9525d1c05dc25ad/src/app/_components/task-suggestion-card.tsx):

- `TaskSuggestionData` has `rationale: string` only (lines 13–19).
- Ready state renders one-line rationale + "Focus this" CTA (lines 123–142).
- Loading NFR already implemented: skeleton @300ms, slow message @1s (lines 82–83, 117–119).
- Optional `coachLine` renders **above** title area (lines 97–104) — expander must not occupy this slot.

[`src/app/_components/pomodoro-dashboard.tsx`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/c2933ee51ee592f01405a4a4c9525d1c05dc25ad/src/app/_components/pomodoro-dashboard.tsx):

| Surface | When | Lines |
|---------|------|-------|
| Post-check-in (break running) | `showSuggestionCard` = auth + break running + pending suggestion | 87–91, 192–229 |
| Kickoff / post-break idle | `showKickoffCard` = auth + idle + no focus + kickoff pending | 93–98, 231–258 |

Both pass `rationale` from hook state; both can receive `breakdown` the same way.

[`src/hooks/use-pomodoro-cycle.ts`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/c2933ee51ee592f01405a4a4c9525d1c05dc25ad/src/hooks/use-pomodoro-cycle.ts):

- `SuggestionResult` / `KickoffSuggestionResult` types include `rationaleKey` + `rationale` (lines 69–94).
- Fetch handlers copy API fields into state (lines 774–787, 848).
- `kickoffEligible` requires `mode === "authenticated"` (line 866) — guest never fetches suggestions.

### 4. UX contract — calm expander, not scoring debugger

**PRD alignment:**

- FR-021: user always sees rationale — one-liner stays default; expander adds trust on demand.
- FR-022: accept/override unchanged — expander is read-only.
- FR-019: factors map to session context signals (energy fit, cycles, interruptions, time, override).
- NFR: suggestion loading feedback ≥1s — existing; expand toggle is instant local state.

**Layout proposal:**

```
[Suggested next task]
[coachLine — onboarding only, optional]
[Task title + badges]
[One-line rationale — always visible]
[Why this? ▼]  ← text button, aria-expanded
  └─ (expanded)
     • Dominant factor 1 (full sentence)
     • Dominant factor 2 (if magnitude meaningful)
     Also considered: [Time of day] [Interruptions]  ← pill chips, muted
[Focus this]
```

**Anti-patterns (roadmap risk):**

- Do not show numeric scores or ranked list positions.
- Do not stack factor sentences onto `coachLine` or S-17 narrative.
- Do not open a new overlay/modal — inline expand only.
- Cap `alsoConsidered` at ~4 chips; omit zero-magnitude factors.

**Accessibility:** `aria-expanded` on toggle; expanded region `aria-live="polite"` optional (copy is static from API).

### 5. Guest mode — architectural prep, not current UI

**Today:**

- [`GuestPomodoroDashboard`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/c2933ee51ee592f01405a4a4c9525d1c05dc25ad/src/app/_components/pomodoro-dashboard.tsx) does **not** set `enableSuggestionGate` (lines 431–444).
- Guest blob ([`src/lib/guest/schema.ts`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/c2933ee51ee592f01405a4a4c9525d1c05dc25ad/src/lib/guest/schema.ts)) has tasks, sessions (`interruptionCount`), cycles — **no check-ins, no energy, no suggestion decisions**.
- Historical slices (S-06 research, S-16 wind-down) explicitly skip guest for suggestion/check-in gates.

**Decision proxy interpretation:** When guest suggestions ship, use **same** `buildRationaleBreakdown` + `buildRationale` templates with client-built `ScoringContext`:

- `energy: "STEADY"` (kickoff parity) until guest check-ins exist.
- `completedWorkCycles` from guest cycles count.
- `interruptionCount` from guest session.
- `localHour` from `Date.getHours()`.
- `lastOverrideWorkType` from local decision log (not in schema today).

**S-23 MVP:** Auth-only expander UI; pure functions in `~/lib/scoring/` documented for guest reuse. No guest e2e in this slice unless product expands scope.

### 6. Parallel work coordination

| Slice | Impact on S-23 |
|-------|----------------|
| **S-25** (pre-suggestion-readiness, active) | Kickoff may stop hardcoding STEADY — breakdown must use **actual** `ScoringContext.energy` from API, not assume STEADY in UI |
| **S-26** (done) | Tie-break only; no new expander factors |
| **F-05** (proposed) | Roadmap: "rationale templates and S-23 expander factors updated" after Eisenhower scorer — v1 ships five current factors; plan a typed extension point |
| **S-17** (proposed) | Narrative line is separate product surface — expander stays on suggestion card only |
| **S-12** (proposed) | Visual polish may restyle card — expander should use same tokens |

### 7. Testing landscape

| Layer | Existing | S-23 needs |
|-------|----------|------------|
| Unit | `score-task.test.ts`, `suggestion.test.ts` (API) | `dominant-factor` / breakdown tests: top-3 selection, chip dedupe, kickoff headline vs breakdown |
| Component | `task-suggestion-card.test.tsx` (loading/ready/empty/error) | Toggle expand, dominant copy, chips, coachLine coexistence |
| E2E | `e2e/task-suggestion.spec.ts` (S-06 accept/override) | Optional: expand "Why this?" after suggestion visible |

**L-04 reminder:** Expand toggle is its own 200ms surface — component test for immediate panel visibility without async.

## Code References

- `src/lib/scoring/score-task.ts:3-58` — ScoringContext + scoreTask multipliers
- `src/lib/scoring/rationale.ts:3-39` — RationaleKey enum + template strings
- `src/lib/scoring/dominant-factor.ts:4-99` — contribution ranking (export target for breakdown)
- `src/server/api/routers/suggestion.ts:121-266` — suggestion.next post_check_in + kickoff
- `src/hooks/use-pomodoro-cycle.ts:69-94` — SuggestionResult types to extend
- `src/hooks/use-pomodoro-cycle.ts:865-874` — kickoff eligibility (auth-only)
- `src/app/_components/task-suggestion-card.tsx:71-167` — card UI insertion point
- `src/app/_components/pomodoro-dashboard.tsx:87-98` — showSuggestionCard / showKickoffCard gates
- `src/lib/onboarding/copy.ts:28-29` — SUGGESTION_COACH_LINE (must not merge with expander)
- `src/lib/guest/schema.ts:40-71` — guest session/cycle blob (future context source)

## Architecture Insights

1. **Single source of truth:** Breakdown must be computed server-side alongside `pickBestTask` to prevent client/server drift; pure functions stay in `~/lib/scoring/` for testability and future guest client path.
2. **Extract, don't duplicate:** Refactor `getDominantRationaleKey` to call shared `getFactorContributions()` used by both dominant key selection and breakdown builder.
3. **Headline vs detail:** One-liner (`rationale`) remains the dominant/kickoff template; expander adds secondary factors — avoids replacing existing e2e rationale assertions.
4. **Chip labels ≠ rationale strings:** "Also considered" uses short nouns; dominant section uses full template sentences.
5. **Kickoff duality:** Kickoff one-liner may say "Fresh session" while breakdown still shows e.g. "Energy fit" + "Time of day" underneath — intentional per S-15 research.

## Historical Context (from prior changes)

- [`context/archive/2026-06-07-adaptive-task-suggestion/research.md`](context/archive/2026-06-07-adaptive-task-suggestion/research.md) — established deterministic scorer, template rationales, break-card UX; explicitly deferred factor debug view.
- [`context/archive/2026-06-08-session-kickoff-suggestion/research.md`](context/archive/2026-06-08-session-kickoff-suggestion/research.md) — extended `suggestion.next` with kickoff context, STEADY synthetic energy, shared `TaskSuggestionCard`.
- [`context/archive/2026-06-08-mindful-session-wind-down/research.md`](context/archive/2026-06-08-mindful-session-wind-down/research.md) — guest skips suggestion gates; wind-down rationale is separate overlay pattern.
- [`context/foundation/roadmap.md`](context/foundation/roadmap.md) S-23 — risk: dominant + chips; never stack on S-17 narrative; F-05 unlocks factor refresh.

## Related Research

- `context/archive/2026-06-07-adaptive-task-suggestion/research.md` — S-06 scoring + wedge UX foundation
- `context/archive/2026-06-08-session-kickoff-suggestion/research.md` — S-15 kickoff API + idle triggers
- `context/archive/2026-06-08-suggestion-override-acknowledgement/research.md` — override ack on same card surfaces

## Open Questions

1. **Collapsed by default?** Recommended yes — one-liner is FR-021 default; expander is opt-in transparency.
2. **Guest in S-23 scope?** Codebase has no guest suggestion card; recommend auth-only UI with pure-fn guest prep unless product adds guest suggestions in parallel.
3. **S-25 merge timing:** If S-25 lands first on main, rebase and verify kickoff breakdown uses readiness energy — not a research blocker.
4. **F-05 factor set:** v1 five factors sufficient; Eisenhower/importance/effort chips deferred to post-F-05 refresh slice.

## Recommended Plan Phases (for `/10x-plan`)

1. **Scoring export** — `getFactorContributions`, `buildRationaleBreakdown`, chip label map, unit tests.
2. **API** — extend `suggestion.next` response; update router tests.
3. **Hook types** — `breakdown` on `SuggestionResult` / `KickoffSuggestionResult`.
4. **UI** — `TaskSuggestionCard` expander; pass breakdown from dashboard for both surfaces.
5. **E2E/component** — expand toggle smoke; optional e2e on post-check-in path.
