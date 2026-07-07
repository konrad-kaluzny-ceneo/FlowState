# Single-Surface Next-Task Suggestion (Star Only) Implementation Plan

## Overview

Collapse the next-task suggestion to a single surface — the star ("gwiazdka") in
the "Gotów skupić się na" (`FocusReadyState`) view. Remove both standalone
`TaskSuggestionCard` panels (the running-break panel and the idle kickoff panel),
full-prune the now-dead break-suggestion (`post_check_in`) machinery, preserve the
scorer's learning signal at the star, and update tests + docs. This is a
deliberate design change (product decision, not a bug) per
`context/changes/fix-suggestion-on-break-view/frame.md`.

## Current State Analysis

- The break panel (`breakSuggestionCard`) renders during a running break, gated on
  `showSuggestionCard = enableSuggestionGate && !cyclePaused && !awaitingWindDown &&
  isBreakRunning && pendingSuggestion.status !== "idle"`
  ([pomodoro-dashboard.tsx:383-388](../../../src/app/_components/pomodoro-dashboard.tsx), render [:872-913](../../../src/app/_components/pomodoro-dashboard.tsx)).
- The idle kickoff panel (`kickoffSuggestionCard`) renders on
  `effectiveShowKickoffCard = showKickoffCard && !suppressKickoffForCalmLanding`
  ([:390-397, :678-681, :915-950](../../../src/app/_components/pomodoro-dashboard.tsx)).
- **No coverage gap (verified):** in every reachable idle state the kickoff panel is
  already suppressed and either `FocusReadyState` (star) or `FocusEmptyState` shows;
  a ready `pendingKickoffSuggestion` is guaranteed to be an active/planned task and is
  pinned into the shown list, so the star always renders
  ([focus-ready-state.tsx:88-105](../../../src/app/_components/focus-ready-state.tsx)).
- The break panel is fed by `pendingSuggestion` (context `post_check_in`), a
  DIFFERENT state from the star's `pendingKickoffSuggestion`. The star / post-break
  handoff runs through the independent `ensureCalmLandingKickoffSuggestion` /
  `pendingKickoffSuggestion` pipeline ([use-pomodoro-cycle.ts:2603-2628](../../../src/hooks/use-pomodoro-cycle.ts), [pomodoro-dashboard.tsx:648-676](../../../src/app/_components/pomodoro-dashboard.tsx)).
- The break panel is the SOLE surface for: `acceptSuggestion` ([:1873-1891](../../../src/hooks/use-pomodoro-cycle.ts)),
  the break-override branch of `selectTask` ([:1823-1832](../../../src/hooks/use-pomodoro-cycle.ts)),
  `dismissPreFocus` break path ([:1776-1811](../../../src/hooks/use-pomodoro-cycle.ts)),
  the `SUGGESTION_ACCEPT` catch-up gate ([derive-gate.ts:40](../../../src/lib/catch-up/derive-gate.ts), rendered [:878-884](../../../src/app/_components/pomodoro-dashboard.tsx)),
  and the break-path `showOverrideAck`.
- Scorer consumes decision history (`SuggestionDecision` table) across BOTH contexts:
  `lastOverride` (accepted=false, POST_CHECK_IN or KICKOFF) → `lastOverrideWorkType`,
  and `priorSuggestionCount` ([suggestion.ts:85-96, :172-174](../../../src/server/api/routers/suggestion.ts)).

## Desired End State

- A running break shows ONLY the calm break atmosphere (S-33) — never a suggestion
  panel. The idle kickoff moment shows the `FocusReadyState` star. The star (and its
  popup) is the single surface for the next-task suggestion.
- No dead break-suggestion code, no permanently-idle gates, no wasted `post_check_in`
  fetch.
- The scorer keeps learning: accept AND override at the star both write a `KICKOFF`
  `SuggestionDecision`, and the scorer's existing consumption of `KICKOFF` rows is
  unchanged.
- Tests assert the new single-surface behavior; docs describe only the star.

### Key Discoveries:

- Kickoff-panel removal has **no coverage gap** — the star always covers idle.
- `recordKickoffDecision` already records override ([:1840](../../../src/hooks/use-pomodoro-cycle.ts)) and accept-via-`acceptKickoffSuggestion` ([:1911](../../../src/hooks/use-pomodoro-cycle.ts)); the star popup's accept currently calls raw `selectTask(suggestedId)` whose kickoff branch records ONLY overrides — the one gap to close.
- `break-atmosphere.ts`'s `suggestionCardOnBreak` becomes constant-false → remove the param.
- `showInFlowSummary` / `showBreakTransitionLine` were suppressed by `!showSuggestionCard`; once the panel is gone these guards become constant and can be dropped (existing calm break copy behavior stays consistent).

## What We're NOT Doing

- NOT changing the star surface (`FocusReadySuggestionStar`) or its popup — it stays as-is.
- NOT touching the kickoff suggestion pipeline (`pendingKickoffSuggestion`, `fetchKickoffSuggestion`, `ensureCalmLandingKickoffSuggestion`).
- NOT changing the scorer, the `SuggestionDecision` schema, or the `suggestion.next` / `recordDecision` server procedures.
- NOT editing archived research under `context/archive/` (historical record).
- NOT changing guest-mode behavior beyond what falls out of removing the shared panels.

## Implementation Approach

Work top-down: remove the UI surfaces first (Phase 1), then prune the now-unreferenced
hook/gate machinery and stop the fetch (Phase 2), then close the learning-signal gap at
the star (Phase 3), then align tests (Phase 4) and docs (Phase 5). Phases 1–2 must land
together to typecheck (Phase 1 stops referencing hook exports that Phase 2 deletes); they
are split for review clarity and verification checkpoints.

## Critical Implementation Details

- **State sequencing / gates:** when `pendingSuggestion` stops being set (stays idle),
  every derived consumer must be updated so it reads as "no break suggestion", not left
  half-wired: `computeKickoffEligible` (`pendingSuggestionStatus`), `derive-gate.ts`
  `SUGGESTION_ACCEPT`, `home-session-state.ts` `hasBreakSuggestion`,
  `transition-conductor.ts`. Prefer deleting the branch over passing a constant.
- **Learning signal:** the scorer's core signal is `lastOverride` (overrides only),
  already recorded at the star. Accept telemetry is only used by `priorSuggestionCount`
  (persona-clause-first gate) — capturing it (Phase 3) fully honors the "save information
  for future calculation" requirement without reintroducing the break beat.
- **Star coach-line dependency:** `suggestionPersonaLabel` (derived from the removed
  `pendingSuggestion`) feeds `effectiveSuggestionCoachLine`, which is passed as `coachLine`
  into the *kept* star popup ([pomodoro-dashboard.tsx:1066](../../../src/app/_components/pomodoro-dashboard.tsx)),
  not only into the two removed cards. In current code this value is very likely already
  null whenever the star/kickoff path is active (since `pendingSuggestion` is idle then),
  but Phase 1 must explicitly verify the star's coach-line copy is unchanged after removal
  rather than assume it — don't just delete `suggestionPersonaLabel` and move on.

## Phase 1: Remove both panels + gating (UI layer)

### Overview

Delete both standalone `TaskSuggestionCard` panels and their gating from the dashboard;
make the calm break atmosphere unconditional on break.

### Changes Required:

#### 1. Dashboard panels + gates

**File**: `src/app/_components/pomodoro-dashboard.tsx`

**Intent**: Remove the break and kickoff suggestion panels and every gate/derived value
that exists only to drive them, so the running break renders only atmosphere and the idle
kickoff renders only via `FocusReadyState`.

**Contract**: Delete `breakSuggestionCard` ([:872-913](../../../src/app/_components/pomodoro-dashboard.tsx)) and `kickoffSuggestionCard` ([:915-950](../../../src/app/_components/pomodoro-dashboard.tsx)) and their render sites in `HomeLayoutRegion` ([:1171-1172](../../../src/app/_components/pomodoro-dashboard.tsx)). Remove `showSuggestionCard`, `showKickoffCard`, `effectiveShowKickoffCard`, `suggestionPersonaLabel`, `showSuggestionCatchUp`, and the `nextFocusUiActive`/`primaryRegionHasContent` references to them. Simplify `showInFlowSummary` / `showBreakTransitionLine` by dropping the now-constant `!showSuggestionCard` guard. Remove `pendingSuggestionStatus` from the `deriveHomeSessionState` call. Keep the `pendingKickoffSuggestion`-driven `FocusReadyState` wiring (`calmKickoffSuggestionCardData`, `calmKickoffSuggestedTaskId`, `suggestionPopup`, `effectiveShowKickoffCard` consumers that feed the star) untouched except where they referenced the removed kickoff panel.

#### 2. Break atmosphere signature

**File**: `src/lib/design/break-atmosphere.ts`

**Intent**: `suggestionCardOnBreak` is now always false — remove it so the break wash shows whenever a break is running (and no wedge gate is active).

**Contract**: Drop `suggestionCardOnBreak` from `BreakAtmosphereInput` and the early-return condition; update the `useSyncBreakAtmosphere` call site in the dashboard and the `break-atmosphere.test.ts` cases.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- `break-atmosphere` unit tests pass: `pnpm test break-atmosphere`

#### Manual Verification:

- During a running short/long break, the calm atmosphere shows and no "Sugerowane następne zadanie" card appears.
- Idle with focusable tasks shows the "Gotów skupić się na" view with the star; no standalone kickoff card.

**Implementation Note**: Phase 1 alone may leave `pendingSuggestion` fetched-but-unused (harmless transient); it is fully cleaned in Phase 2. Pause for manual confirmation before Phase 2.

---

## Phase 2: Stop the fetch + full-prune dead machinery

### Overview

Stop fetching the `post_check_in` break suggestion and remove all now-dead
break-suggestion state, actions, and gates from the hook and gate modules.

### Changes Required:

#### 1. Hook — remove break-suggestion state + actions + fetch

**Files**: `src/hooks/use-pomodoro-cycle.ts`, `src/hooks/use-pomodoro-cycle.test.tsx`

**Intent**: Remove the `post_check_in` suggestion end-to-end: stop fetching it, and delete
the state and the actions that only the break panel drove.

**Contract**: Remove `pendingSuggestion` state, `suggestionCycleId`/`postCheckInReadyTaskId`, `fetchPostCheckInSuggestion` / `fetchSuggestion` / `retrySuggestion` / `clearSuggestion` (post-check-in), `acceptSuggestion` ([:1873-1891](../../../src/hooks/use-pomodoro-cycle.ts)), `recordSuggestionDecision` ([:1258-1277](../../../src/hooks/use-pomodoro-cycle.ts)), the break-override branch of `selectTask` ([:1823-1832](../../../src/hooks/use-pomodoro-cycle.ts)), the break path of `dismissPreFocus` ([:1776-1811](../../../src/hooks/use-pomodoro-cycle.ts)), and the break-suggestion half of the combined stale-task invalidation effect ([:1469-1559](../../../src/hooks/use-pomodoro-cycle.ts) — the effect also handles the kickoff stale-task case at `:1485-1504`, which must be kept). At the check-in→break transition (`continueAfterCheckIn` [:2688](../../../src/hooks/use-pomodoro-cycle.ts) and the optimistic/guest/recovery paths [:2722, :2856, :2987, :3281](../../../src/hooks/use-pomodoro-cycle.ts)) drop the `suggestion_fetch` step so no `post_check_in` fetch fires. Remove `pendingSuggestion`/`acceptSuggestion`/`retrySuggestion`/`overrideAcknowledgement`(break)/`showSuggestionCatchUp` from the hook's returned context. Keep ALL `pendingKickoffSuggestion` / `recordKickoffDecision` machinery.

**Contract note**: `overrideAcknowledgement` is shared — the KICKOFF override branch ([:1840-1844](../../../src/hooks/use-pomodoro-cycle.ts)) still calls `showOverrideAck`, so keep `overrideAcknowledgement` state and its dashboard render ([:1181-1190](../../../src/app/_components/pomodoro-dashboard.tsx)); only the break-override caller is removed.

**Test file note**: `use-pomodoro-cycle.test.tsx` has ~29 references to `pendingSuggestion`/`acceptSuggestion`/`post_check_in` break-suggestion state (verified via review pass) — these must be removed/reworked in this same phase, not deferred to Phase 4, because Phase 2's own success criteria (`pnpm test … use-pomodoro-cycle`) cannot pass while the test still exercises deleted hook surface.

#### 2. Gates — drop SUGGESTION_ACCEPT and break-suggestion inputs

**Files**: `src/lib/catch-up/derive-gate.ts`, `src/lib/catch-up/types.ts`, `src/lib/catch-up/copy.ts`, `src/lib/wedge/transition-conductor.ts`, `src/lib/home/home-session-state.ts`

**Intent**: Remove the now-unreachable `SUGGESTION_ACCEPT` catch-up gate — including its type and copy — and the
`pendingSuggestionStatus`/`hasBreakSuggestion` inputs that only the break suggestion set.

**Contract**: In `derive-gate.ts` remove the `SUGGESTION_ACCEPT` gate branch ([:37-43](../../../src/lib/catch-up/derive-gate.ts)). In `types.ts` remove the `"SUGGESTION_ACCEPT"` member from the `CatchUpGate` union ([:5](../../../src/lib/catch-up/types.ts)). In `copy.ts` remove the `case "SUGGESTION_ACCEPT":` switch branch ([:62](../../../src/lib/catch-up/copy.ts)). In `transition-conductor.ts` remove `pendingSuggestionStatus` from `KickoffEligibilityInput` / `computeKickoffEligible` ([:45, :147](../../../src/lib/wedge/transition-conductor.ts)) — leave `postBreakIdleFlag` ([:49, :150](../../../src/lib/wedge/transition-conductor.ts)) untouched, it is the existing (unrelated) post-break idle kickoff path. In `home-session-state.ts` remove `pendingSuggestionStatus` / `hasBreakSuggestion` ([:93-100](../../../src/lib/home/home-session-state.ts)), including the second `hasBreakSuggestion` read inside `deriveBreakModules` ([:276](../../../src/lib/home/home-session-state.ts)). The dashboard's `catchUp?.gate === "SUGGESTION_ACCEPT"` check ([pomodoro-dashboard.tsx:502](../../../src/app/_components/pomodoro-dashboard.tsx)) falls away as part of Phase 1's `showSuggestionCatchUp` removal — no separate action needed here. Update all call sites and the corresponding unit tests: `derive-gate.test.ts`, `copy.test.ts` (check for `SUGGESTION_ACCEPT` fixtures), and `src/app/_components/tab-return-catchup.test.tsx` (remove/rework the `makeCatchUp("SUGGESTION_ACCEPT")` case at [:66](../../../src/app/_components/tab-return-catchup.test.tsx)).

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Affected unit tests pass: `pnpm test derive-gate transition-conductor home-session-state use-pomodoro-cycle`
- No remaining references: `rg "pendingSuggestion|acceptSuggestion|SUGGESTION_ACCEPT|suggestionCardOnBreak" src` returns nothing outside kickoff/unrelated matches.

#### Manual Verification:

- Full session run (check-in → break → next work) works; no console errors; break shows atmosphere only.
- Network tab shows no `suggestion.next` call with `context: "post_check_in"` at break start.

**Implementation Note**: Pause for manual confirmation before Phase 3.

---

## Phase 3: Preserve the learning signal at the star

### Overview

Ensure accepting the suggested task via the star popup records a `KICKOFF`
`SuggestionDecision` (accept), so both accept and override telemetry survive the
break-panel removal.

### Changes Required:

#### 1. Star accept records a decision

**Files**: `src/app/_components/pomodoro-dashboard.tsx` (star `suggestionPopup.onAccept` [:1063-1081](../../../src/app/_components/pomodoro-dashboard.tsx)), `src/hooks/use-pomodoro-cycle.ts`

**Intent**: The star popup's accept currently calls raw `selectTask(suggestedId)`, whose
kickoff branch records only overrides — so an accept records nothing. Route the star accept
through a path that records a `KICKOFF` accept decision without changing the focus behavior
the star already produces.

**Contract**: Either point the star `onAccept` at `acceptKickoffSuggestion` (which already
records accept + pre-focuses [:1893-1911](../../../src/hooks/use-pomodoro-cycle.ts)), or add a `recordKickoffDecision(suggestedId, suggestedId)` alongside the existing `selectTask(suggestedId)` call. Pick whichever preserves the current star selection/focus behavior (verify against the `focus-ready` popup tests). Net effect: accepting the star suggestion writes one `KICKOFF` row with `accepted=true`; overrides continue to write via the existing `selectTask` kickoff branch.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- `pnpm test use-pomodoro-cycle pomodoro-dashboard` pass (including a new assertion that star-accept records a KICKOFF decision).

#### Manual Verification:

- Accept a suggestion at the star → a `SuggestionDecision` row (context `KICKOFF`, `accepted=true`) is written.
- Override (pick a different task) at the star → a `KICKOFF` `accepted=false` row is written and the next suggestion reflects `lastOverrideWorkType`.

**Implementation Note**: Pause for manual confirmation before Phase 4.

---

## Phase 4: Tests

### Overview

Remove break/kickoff-panel tests, add a regression guard for the calm break, and
repoint e2e helpers to the star-only route.

### Changes Required:

#### 1. Component tests

**File**: `src/app/_components/pomodoro-dashboard.test.tsx`

**Intent**: Remove assertions that depend on the standalone break/kickoff panels; add a
regression test that a running break shows atmosphere and no suggestion card.

**Contract**: Remove/rework the break-panel tests at [:292-342, :523-555, :1248-1273](../../../src/app/_components/pomodoro-dashboard.test.tsx) and the `breakSuggestionReady` fixture usage. Keep the star tests at [:419-485](../../../src/app/_components/pomodoro-dashboard.test.tsx). Add a test: running SHORT_BREAK → `queryByTestId("task-suggestion-card")` is null and the break-atmosphere marker is present.

#### 2. E2E helpers + specs

**Files**: `e2e/helpers/suggestion.ts`, `e2e/helpers/kickoff.ts`, `e2e/helpers/idle-cycle.ts`, `e2e/daily-standing-capacity.spec.ts`

**Intent**: Remove the break-panel e2e helpers; make the kickoff helper star-only; fix the
one spec that asserted a break suggestion.

**Contract**: Delete/replace `waitForSuggestionNext` / `expectSuggestionVisible` / `acceptSuggestion` / `overrideSuggestionByFocusingTask` in `suggestion.ts` (break panel). In `kickoff.ts` drop the dead standalone-card branch in `expectKickoffVisible` ([:131-136](../../../e2e/helpers/kickoff.ts)) and repoint `waitForKickoffSuggestion` to the star/popup. Clean the now-dead `dismissTaskSuggestionIfVisible` branch in `idle-cycle.ts`. In `daily-standing-capacity.spec.ts` ([:80-98](../../../e2e/daily-standing-capacity.spec.ts)) move the "min left today" capacity-rationale assertion to the star popup (or drop the break-beat portion).

### Success Criteria:

#### Automated Verification:

- Unit suite passes: `pnpm test`
- Targeted e2e specs pass: `pnpm exec playwright test e2e/daily-standing-capacity.spec.ts` (and any spec touching kickoff, run one at a time per lessons.md).

#### Manual Verification:

- Full e2e belt is green as the final gate.

**Implementation Note**: Run e2e one spec at a time during iteration (lessons.md). Pause for manual confirmation before Phase 5.

---

## Phase 5: Docs

### Overview

Update the contradicting flow doc to the single-surface decision and record a lesson.

### Changes Required:

#### 1. User-flow doc

**File**: `context/foundation/user-flow.md`

**Intent**: Replace the panel/during-break suggestion descriptions with the single star
surface.

**Contract**: Update lines [:49, :109, :113, :160, :178, :214-225](../../../context/foundation/user-flow.md) so the next-task suggestion is described as the star in "Gotów skupić się na" (opening the explanation popup), not a `TaskSuggestionCard` panel and not a break-running card. PRD needs no change (it is surface-agnostic).

#### 2. Lessons entry

**File**: `context/foundation/lessons.md`

**Intent**: Capture the single-surface rule so a future change doesn't reintroduce a panel.

**Contract**: Add a short lesson: "Next-task suggestion surfaces only via the FocusReady star (+ its popup) — never as a standalone panel on break or idle; accept/override are recorded as KICKOFF `SuggestionDecision`s." Include trigger + rule + applies-to, matching the file's format.

#### 3. Test-plan doc

**File**: `context/foundation/test-plan.md`

**Intent**: Update stale test references left over from the removed break-panel tests, so the doc doesn't point at deleted test names.

**Contract**: Update the references at [:395, :398, :417, :427](../../../context/foundation/test-plan.md) — these currently name `task-suggestion-card.test.tsx` and a `use-pomodoro-cycle.test.tsx` case literally titled "hides stale post-check-in suggestion…", which Phase 2/4 remove or rename. Point them at the star-surface tests instead (or drop the row if no longer applicable).

### Success Criteria:

#### Automated Verification:

- Markdown lint passes if configured: `pnpm lint` (or n/a).

#### Manual Verification:

- `user-flow.md` contains no remaining description of a suggestion panel or a break-running suggestion card.
- `lessons.md` has the new single-surface rule.
- `test-plan.md` no longer references deleted/renamed test names.

---

## Testing Strategy

### Unit Tests:

- Break atmosphere shows on break with no `suggestionCardOnBreak` input.
- Gate modules (`derive-gate`, `transition-conductor`, `home-session-state`) behave with the break-suggestion inputs removed.
- Star accept records a KICKOFF decision; override still records.

### Integration / Component Tests:

- `pomodoro-dashboard.test.tsx`: running break → atmosphere, no card; star surface intact.

### Manual Testing Steps:

1. Run a full authenticated session; at break, confirm only atmosphere (no card).
2. After break → idle, confirm the star appears in "Gotów skupić się na".
3. Accept via star → KICKOFF `accepted=true` row; override → `accepted=false` row + next suggestion reflects it.
4. Confirm no `post_check_in` `suggestion.next` network call at break start.

## Performance Considerations

Removing the `post_check_in` fetch eliminates one network call per break — a small
improvement. No new hot paths.

## Migration Notes

No schema changes. Existing `SuggestionDecision` rows (both contexts) remain valid; the
scorer keeps reading them. No data migration.

## References

- Frame brief: `context/changes/fix-suggestion-on-break-view/frame.md`
- Scorer decision consumption: [suggestion.ts:85-96, :172-174](../../../src/server/api/routers/suggestion.ts)
- Star surface: [focus-ready-state.tsx:107-127, :375-393](../../../src/app/_components/focus-ready-state.tsx)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Remove both panels + gating (UI layer)

#### Automated

- [ ] 1.1 Type checking passes: `pnpm typecheck`
- [ ] 1.2 Linting passes: `pnpm lint`
- [ ] 1.3 break-atmosphere unit tests pass: `pnpm test break-atmosphere`

#### Manual

- [ ] 1.4 Running break shows atmosphere, no "Sugerowane następne zadanie" card
- [ ] 1.5 Idle with tasks shows "Gotów skupić się na" star; no standalone kickoff card

### Phase 2: Stop the fetch + full-prune dead machinery

#### Automated

- [ ] 2.1 Type checking passes: `pnpm typecheck`
- [ ] 2.2 Linting passes: `pnpm lint`
- [ ] 2.3 Affected unit tests pass: `pnpm test derive-gate transition-conductor home-session-state use-pomodoro-cycle`
- [ ] 2.4 No stale references: `rg "pendingSuggestion|acceptSuggestion|SUGGESTION_ACCEPT|suggestionCardOnBreak" src` clean

#### Manual

- [ ] 2.5 Full session runs; break shows atmosphere only; no console errors
- [ ] 2.6 No `post_check_in` `suggestion.next` call at break start (network tab)

### Phase 3: Preserve the learning signal at the star

#### Automated

- [ ] 3.1 Type checking passes: `pnpm typecheck`
- [ ] 3.2 `pnpm test use-pomodoro-cycle pomodoro-dashboard` pass (incl. star-accept records KICKOFF decision)

#### Manual

- [ ] 3.3 Star accept → KICKOFF `accepted=true` row
- [ ] 3.4 Star override → KICKOFF `accepted=false` row + next suggestion reflects lastOverrideWorkType

### Phase 4: Tests

#### Automated

- [ ] 4.1 Unit suite passes: `pnpm test`
- [ ] 4.2 Targeted e2e specs pass (one at a time): `pnpm exec playwright test e2e/daily-standing-capacity.spec.ts`

#### Manual

- [ ] 4.3 Full e2e belt green as final gate

### Phase 5: Docs

#### Automated

- [ ] 5.1 Lint passes (or n/a): `pnpm lint`

#### Manual

- [ ] 5.2 `user-flow.md` has no suggestion-panel / break-card descriptions
- [ ] 5.3 `lessons.md` has the single-surface rule
- [ ] 5.4 `test-plan.md` no longer references deleted/renamed test names
