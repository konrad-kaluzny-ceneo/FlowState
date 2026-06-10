# Suggestion Rationale Expander (S-23) Implementation Plan

## Overview

Add an opt-in **"Why this?"** expander on the authenticated `TaskSuggestionCard` so users see a calm, deterministic factor breakdown (top 2–3 dominant factors as full sentences + muted "also considered" chips) without leaving the wedge overlay. Breakdown is computed server-side alongside existing `pickBestTask` / rationale formatting and bundled in `suggestion.next` — no second fetch.

## Current State Analysis

S-06 (post-check-in) and S-15 (kickoff/post-break idle) ship a one-line `rationale` on `TaskSuggestionCard`. Scoring already ranks five session factors internally in `getDominantRationaleKey` but only exposes the winner. There is no breakdown type, no "Why this?" control, and no unit tests for `dominant-factor.ts`.

### Key Discoveries:

- `getDominantRationaleKey` builds a private `contributions` array with `{ key, magnitude }` — export target for breakdown (`src/lib/scoring/dominant-factor.ts:39-64`)
- `suggestion.next` returns `{ taskId, title, workType, weight, rationaleKey, rationale }` for both `post_check_in` and `kickoff` contexts — no `breakdown` field (`src/server/api/routers/suggestion.ts:189-265`)
- Same `TaskSuggestionCard` renders on break-running post-check-in and kickoff idle surfaces (`src/app/_components/pomodoro-dashboard.tsx:192-258`)
- `coachLine` (S-11 onboarding) occupies a slot **above** the title — expander must sit **below** the one-line rationale, never merge with coach or future S-17 narrative
- Guest dashboard does not enable suggestion gates — guest expander UI is out of scope; pure scoring fns remain reusable
- **No** `dominant-factor.test.ts` or `rationale-breakdown.test.ts` today — breakdown logic must ship with unit coverage before UI
- L-04: expand toggle is its own 200ms surface — component test must assert immediate panel visibility (local state only)

## Desired End State

1. Authenticated user sees the existing one-line rationale by default on post-check-in break and kickoff idle suggestion cards (FR-021 unchanged).
2. User taps **"Why this?"** → inline panel expands within 200ms showing up to 3 **secondary** factor sentences (headline factor excluded — already visible as the one-liner) + up to 4 "also considered" chip labels (energy fit, cycles completed, time of day, interruptions, last override — FR-019 signals).
3. Accept / override flows unchanged (FR-022); expander is read-only.
4. Breakdown in API response matches server scorer — client does not recompute factors.
5. Kickoff one-liner may still say "Fresh session" while breakdown lists underlying session factors underneath — intentional S-15 duality.
6. Verification: `pnpm check`, `pnpm test`, optional `set CI=true && pnpm test:e2e e2e/task-suggestion.spec.ts` expand smoke.

## What We're NOT Doing

- Full ranked factor list or numeric scores (scoring-debugger anti-pattern)
- Second API procedure or client-side breakdown fetch
- Guest suggestion card / guest expander UI (pure functions only; future guest blob path)
- S-17 session narrative line or analytics screen
- Modal / new overlay — inline expand only
- F-05 Eisenhower factor set (v1 ships five current factors; document extension point for post-F-05 refresh)
- Changing accept/override/decision recording behavior
- Auto-expanding breakdown (collapsed by default)

## Implementation Approach

Four phases: (1) extract shared contribution computation and `buildRationaleBreakdown` with unit tests, (2) attach breakdown to `suggestion.next` and extend hook result types, (3) render expander in `TaskSuggestionCard` + wire dashboard for both surfaces with component tests, (4) optional e2e smoke + test-plan cookbook note. Refactor `getDominantRationaleKey` to call shared `getFactorContributions()` — single source of truth for dominant key and breakdown.

## Critical Implementation Details

**Headline vs breakdown:** The card keeps rendering `suggestion.rationale` as the visible one-liner. API `breakdown.headline` mirrors that string for contract completeness; UI must not replace or duplicate the one-liner when collapsed. **Do not repeat the headline factor in the expander** — roadmap S-23 requires trust *beyond* the one-liner. Pass `headlineKey: rationaleKey` into `buildRationaleBreakdown`; exclude that key from `dominant` and `alsoConsidered` before ranking (kickoff `kickoff_fresh` / `kickoff_resume` keys are not contribution factors, so breakdown still lists underlying session signals). When exclusion leaves no secondary factors, hide the expander control.

**S-25 coordination:** Kickoff currently hardcodes `energy: "STEADY"` in the router. Breakdown must consume whatever `ScoringContext` the API builds — never assume STEADY in UI. If S-25 lands on main first, rebase and verify kickoff breakdown reflects readiness energy; no S-23 code change required beyond using API payload.

**Hide empty expander:** When all factor magnitudes are zero (default-only rationale), omit the "Why this?" control — avoid an expander with nothing to show.

## Phase 1: Scoring breakdown export

### Overview

Extract factor contributions from `getDominantRationaleKey`, add `buildRationaleBreakdown` + chip label map, and lock behavior with unit tests before any API/UI work.

### Changes Required:

#### 1. Shared contributions helper

**File**: `src/lib/scoring/dominant-factor.ts`

**Intent**: Single computation path for dominant key selection and breakdown builder — prevents drift.

**Contract**: Export `getFactorContributions(task: ScoringTask, context: ScoringContext): Array<{ key: RationaleKey; magnitude: number }>`. Refactor `getDominantRationaleKey` to sort/filter this array and return top key or `"default"`. Preserve existing magnitude math and energy key selection (`energy_deep` vs `energy_light`).

#### 2. Breakdown types and builder

**File**: `src/lib/scoring/rationale-breakdown.ts` (new)

**Intent**: Produce the S-23 breakdown shape from contributions + existing rationale templates.

**Contract**: Export types:

```typescript
export type RationaleFactorItem = { key: RationaleKey; copy: string };
export type RationaleBreakdown = {
  headline: string;
  dominant: RationaleFactorItem[]; // length 0–3 secondary factors (headline key excluded)
  alsoConsidered: string[]; // short chip labels, max 4
};
```

Export `FACTOR_CHIP_LABELS: Partial<Record<RationaleKey, string>>` mapping session factors to short nouns: `override_preference` → "Last override", `interruptions` → "Interruptions", `late_day` → "Time of day", `fatigue` → "Cycles completed", `energy_deep`/`energy_light` → "Energy fit".

Export `buildRationaleBreakdown(task, context, opts: { headline: string; headlineKey: RationaleKey })`:

1. Call `getFactorContributions`, filter `magnitude > 0`, sort desc.
2. Drop `opts.headlineKey` from the ranked list (when it is a contribution key).
3. Take top 2–3 remaining keys → `dominant` with `copy: buildRationale(key, context)`.
4. Remaining keys → chip labels via `FACTOR_CHIP_LABELS`; dedupe `energy_deep`/`energy_light` to one "Energy fit"; cap `alsoConsidered` at 4.
5. Exclude `default`, `kickoff_fresh`, `kickoff_resume` from chips (kickoff headline keys are not contribution factors).
6. Set `headline` from `opts.headline` (caller passes existing formatted rationale).

#### 3. Unit tests

**File**: `src/lib/scoring/rationale-breakdown.test.ts` (new)

**Intent**: Guard breakdown selection, headline exclusion, chip dedupe, kickoff vs post-check-in parity.

**Contract**: Cases: (a) FOCUSED + deep work → headline key excluded from dominant; secondary energy-related copy only when a second factor contributes; (b) ≥2 cycles fatigue + late day → up to 2–3 secondary dominant + chips for remainder; (c) override preference surfaces in dominant when magnitude wins and headline is kickoff-specific; (d) all-zero magnitudes → empty dominant/chips; (e) energy_deep + energy_light never both appear as chips; (g) post-check-in fixture where headlineKey matches top contribution → dominant does not repeat one-liner copy.

#### 4. Dominant-key regression tests

**File**: `src/lib/scoring/dominant-factor.test.ts` (new)

**Intent**: Lock `getFactorContributions` / `getDominantRationaleKey` outputs after refactor.

**Contract**: Case (f): `getDominantRationaleKey` unchanged outputs for fixed fixtures (regression).

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `pnpm exec vitest run src/lib/scoring/rationale-breakdown.test.ts src/lib/scoring/dominant-factor.test.ts`
- Full test suite passes: `pnpm test`
- Lint/format passes: `pnpm check`
- Typecheck passes: `pnpm typecheck`

#### Manual Verification:

- N/A — pure library phase

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: API + hook wire-up

### Overview

Attach `breakdown` to both `suggestion.next` branches; extend client result types and fetch handlers so breakdown reaches dashboard state.

### Changes Required:

#### 1. Router — post-check-in breakdown

**File**: `src/server/api/routers/suggestion.ts`

**Intent**: Bundle breakdown with existing post-check-in response using the same `scoringContext` and winner task.

**Contract**: After `formatTaskRationale(winner, scoringContext)`, call `buildRationaleBreakdown(winner, scoringContext, { headline: rationale, headlineKey: rationaleKey })`. Return field `breakdown: RationaleBreakdown` alongside existing fields. `null` return when no tasks unchanged.

#### 2. Router — kickoff breakdown

**File**: `src/server/api/routers/suggestion.ts`

**Intent**: Same breakdown contract for kickoff path using `formatKickoffRationale` headline.

**Contract**: After `formatKickoffRationale`, attach `breakdown` with `{ headline: rationale, headlineKey: rationaleKey }`. Breakdown lists underlying session contributions even when headline is `kickoff_fresh` / `kickoff_resume`.

#### 3. Router tests

**File**: `src/server/api/routers/suggestion.test.ts`

**Intent**: Lock breakdown shape on both contexts without regressing existing rationale assertions.

**Contract**: Extend post-check-in and kickoff `next` success tests to assert `breakdown.headline === rationale`, `breakdown.dominant` is array length 0–3, `alsoConsidered` length ≤ 4, and post-check-in fixture does not repeat `rationale` text inside `breakdown.dominant[0].copy` when headlineKey matches top contribution. Fixture with high interruption count → "Interruptions" appears in dominant or chips. Post-check-in regression tests unchanged for task pick + rationaleKey.

#### 4. Hook result types + fetch mapping

**File**: `src/hooks/use-pomodoro-cycle.ts`

**Intent**: Propagate breakdown from API into `pendingSuggestion` / `pendingKickoffSuggestion` ready state.

**Contract**: Import `RationaleBreakdown` from `~/lib/scoring/rationale-breakdown`. Add `breakdown: RationaleBreakdown` to `SuggestionResult` and `KickoffSuggestionResult`. In `fetchPostCheckInSuggestion` data mapping (~L774-787), copy `result.breakdown`. Kickoff path assigns `data: result` when no `cycleId` — breakdown flows through automatically once API returns it; no field-by-field mapping needed.

### Success Criteria:

#### Automated Verification:

- Router tests pass: `pnpm exec vitest run src/server/api/routers/suggestion.test.ts`
- Full test suite passes: `pnpm test`
- Lint/format passes: `pnpm check`
- Typecheck passes: `pnpm typecheck`

#### Manual Verification:

- N/A — no UI yet

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Expander UI + component tests

### Overview

Render collapsible "Why this?" panel inside `TaskSuggestionCard`; pass breakdown from both dashboard surfaces; prove instant toggle and coachLine coexistence with component tests.

### Changes Required:

#### 1. Extend card data type

**File**: `src/app/_components/task-suggestion-card.tsx`

**Intent**: Accept optional breakdown on ready-state suggestion payload.

**Contract**: Extend `TaskSuggestionData` with optional `breakdown?: RationaleBreakdown`. When `breakdown` absent or both `dominant` and `alsoConsidered` empty, hide expander control.

#### 2. Expander UI

**File**: `src/app/_components/task-suggestion-card.tsx`

**Intent**: Calm inline transparency panel — not a scoring debugger.

**Contract**:

- Collapsed by default; local `useState` for expanded (no network).
- Text button **"Why this?"** with `aria-expanded` and `data-testid="suggestion-rationale-toggle"`, placed below one-line rationale, above "Focus this" CTA.
- Expanded region: `data-testid="suggestion-rationale-expander"`; unordered list of dominant `copy` strings; optional "Also considered:" row of muted pill chips (`alsoConsidered` labels).
- No numeric scores, rank numbers, or modal. Styling: muted text (`text-white/50` tier) consistent with existing card tokens.
- `coachLine` slot unchanged above title.

#### 3. Dashboard wiring

**File**: `src/app/_components/pomodoro-dashboard.tsx`

**Intent**: Feed breakdown to both post-check-in and kickoff card instances.

**Contract**: Pass `breakdown: pomodoro.pendingSuggestion.data.breakdown` and `breakdown: pomodoro.pendingKickoffSuggestion.data.breakdown` into respective `suggestion` props (~L213-219, ~L243-249).

#### 4. Component tests

**File**: `src/app/_components/task-suggestion-card.test.tsx`

**Intent**: L-04 oracle for expand toggle; guard layout regression with coachLine.

**Contract**: New tests: (a) "Why this?" hidden when breakdown empty/missing; (b) click toggle → expander visible synchronously (no timer wait); (c) dominant copy + chip labels render when provided and do not duplicate the visible one-liner; (d) `aria-expanded` toggles true/false; (e) coachLine + expander coexist without duplicate rationale stacking.

### Success Criteria:

#### Automated Verification:

- Component tests pass: `pnpm exec vitest run src/app/_components/task-suggestion-card.test.tsx`
- Full test suite passes: `pnpm test`
- Lint/format passes: `pnpm check`
- Typecheck passes: `pnpm typecheck`

#### Manual Verification:

- Post-check-in: complete work cycle + check-in → suggestion card shows one-liner; tap "Why this?" → factor breakdown inline; accept still works
- Kickoff idle: session-start idle with tasks → same expander behavior on kickoff card
- Collapsed state default on page load; no layout jump pushing "Focus this" off-screen on mobile-width viewport
- Onboarding coachLine still visible on first-run without overlapping expander

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: E2E smoke + cookbook

### Overview

Add lightweight browser proof that expander works on the post-check-in path; update test-plan cookbook entry for S-23.

### Changes Required:

#### 1. E2E expand smoke

**File**: `e2e/task-suggestion.spec.ts`

**Intent**: Browser-level proof that "Why this?" expands after suggestion visible — extends existing S-06 spec pattern.

**Contract**: After `expectSuggestionVisible`, click `suggestion-rationale-toggle` (shipped in Phase 3). Assert `suggestion-rationale-expander` visible. Do not assert specific factor copy (fixtures vary). Existing accept/override tests unchanged.

#### 2. Test-plan cookbook note

**File**: `context/foundation/test-plan.md` §6

**Intent**: Document S-23 test location for future `/10x-tdd` / `/10x-e2e` handoffs.

**Contract**: Add bullet under adaptive task suggestion entry: S-23 expander component tests (`task-suggestion-card.test.tsx`) + optional e2e expand step in `task-suggestion.spec.ts`; reference `rationale-breakdown.test.ts` and `dominant-factor.test.ts` for breakdown oracles.

### Success Criteria:

#### Automated Verification:

- E2E passes: `set CI=true && pnpm test:e2e e2e/task-suggestion.spec.ts`
- Full test suite passes: `pnpm test`
- Lint/format passes: `pnpm check`
- Typecheck passes: `pnpm typecheck`

#### Manual Verification:

- Kickoff path: manual expand on session-start idle (no dedicated kickoff e2e required this slice)
- Override after viewing breakdown still shows S-19 ack — no regression

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- `rationale-breakdown.test.ts` — headline exclusion, top-3 secondary dominant, chip dedupe, cap, kickoff headline vs breakdown independence
- `dominant-factor.test.ts` — `getFactorContributions` / `getDominantRationaleKey` regression
- `suggestion.test.ts` — breakdown field on both API contexts

### Component Tests:

- `task-suggestion-card.test.tsx` — toggle latency (L-04), aria, empty breakdown hide, coachLine coexistence

### Manual Testing Steps:

1. Post-check-in with FOCUSED energy + deep task → expand shows energy-related dominant copy
2. Session with ≥2 interruptions → "Interruptions" in dominant or chips
3. Kickoff fresh session → one-liner "Fresh session" + underlying factors in expander
4. First-run onboarding → coachLine + collapsed expander both present
5. Accept suggestion after expand → timer starts normally

## Performance Considerations

Breakdown computed in the same `suggestion.next` mutation as rationale — no added round-trip. Expander toggle is local React state only (<200ms NFR). Contribution array is five elements — negligible CPU.

## Migration Notes

No schema migration. API response is additive (`breakdown` field). Older clients ignore the field. Rebase onto S-25 if merged first — verify kickoff energy flows through `buildScoringContextForSession` automatically.

## References

- Related research: `context/changes/suggestion-rationale-expander/research.md`
- Scoring substrate: `src/lib/scoring/dominant-factor.ts`, `src/lib/scoring/rationale.ts`
- Card surfaces: `src/app/_components/task-suggestion-card.tsx`, `src/app/_components/pomodoro-dashboard.tsx`
- Prior slices: `context/archive/2026-06-07-adaptive-task-suggestion/plan.md`, `context/archive/2026-06-08-session-kickoff-suggestion/plan.md`
- Lessons: L-04 (200ms per surface)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Scoring breakdown export

#### Automated

- [x] 1.1 Unit tests pass: `pnpm exec vitest run src/lib/scoring/rationale-breakdown.test.ts src/lib/scoring/dominant-factor.test.ts` — f58838f
- [x] 1.2 Full test suite passes: `pnpm test` — f58838f
- [x] 1.3 Lint/format passes: `pnpm check` — f58838f
- [x] 1.4 Typecheck passes: `pnpm typecheck` — f58838f

#### Manual

- [x] 1.5 N/A — pure library phase (confirm proceed) — f58838f

### Phase 2: API + hook wire-up

#### Automated

- [x] 2.1 Router tests pass: `pnpm exec vitest run src/server/api/routers/suggestion.test.ts` — 282b4e7
- [x] 2.2 Full test suite passes: `pnpm test` — 282b4e7
- [x] 2.3 Lint/format passes: `pnpm check` — 282b4e7
- [x] 2.4 Typecheck passes: `pnpm typecheck` — 282b4e7

#### Manual

- [x] 2.5 N/A — no UI yet (confirm proceed) — 282b4e7

### Phase 3: Expander UI + component tests

#### Automated

- [x] 3.1 Component tests pass: `pnpm exec vitest run src/app/_components/task-suggestion-card.test.tsx`
- [x] 3.2 Full test suite passes: `pnpm test`
- [x] 3.3 Lint/format passes: `pnpm check`
- [x] 3.4 Typecheck passes: `pnpm typecheck`

#### Manual

- [ ] 3.5 Post-check-in and kickoff surfaces show expander; collapsed default; accept/override unchanged
- [ ] 3.6 coachLine + expander coexist; no mobile layout regression

### Phase 4: E2E smoke + cookbook

#### Automated

- [ ] 4.1 E2E passes: `set CI=true && pnpm test:e2e e2e/task-suggestion.spec.ts`
- [ ] 4.2 Full test suite passes: `pnpm test`
- [ ] 4.3 Lint/format passes: `pnpm check`
- [ ] 4.4 Typecheck passes: `pnpm typecheck`

#### Manual

- [ ] 4.5 Kickoff manual expand smoke; override ack after expand still works
