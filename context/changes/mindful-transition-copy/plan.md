# Mindful Transition Copy (S-21) Implementation Plan

## Overview

Add calm, skippable one-line prompts at **break start** and **break→work confirm**, keyed to last check-in energy (Focused / Steady / Fading) with neutral fallback. Respects US-01 beat mutex: inline interstitial + existing gate only — no new blocking overlay, no timer delay.

## Current State Analysis

- F-07 conductor enforces one blocking gate (closure → wind-down → check-in → cycle complete). S-21 was explicitly deferred.
- Break→work copy is hardcoded in `cycle-complete-overlay.tsx` (`"Break's over!"`, generic subtitle).
- No in-tab break-start interstitial; `notify-break-start.ts` covers out-of-tab OS notifications only.
- Dashboard mutex pattern exists: `showInFlowSummary` hidden when `wedgeGateActive` or `showSuggestionCard`; override ack is inline without gate.
- Energy available via `narrativeLatestEnergy` after check-ins; guests skip check-in → neutral fallback only.

## Desired End State

1. **`src/lib/session/transition-copy.ts`** — pure selectors: `getBreakStartLine(breakKind)`, `getBreakReentryLine(energy | null)`.
2. **Break-start interstitial** — one skippable line above timer during `SHORT_BREAK` / `LONG_BREAK` running; dismiss via click or ~5s auto-dismiss.
3. **Break→work re-entry** — energy-keyed subtitle inside existing `CycleCompleteOverlay` break card (gate unchanged).
4. **Mutex** — break-start line hidden when `wedgeGateActive`, `showSuggestionCard`, paused, or not on break running.
5. **Tests** — copy tone oracle, hook dismiss, dashboard suppression, break overlay subtitle, belt e2e smoke.

## What We're NOT Doing

- S-33 break atmosphere / shell wash
- Conductor `WedgeGate` extension (dashboard mutex sufficient for MVP)
- Guest energy-keyed re-entry (neutral only)
- Rotating copy pools or copy-module merge with S-19/S-17 (P-205 follow-up)
- Changing break durations, suggestion logic, or wind-down triggers

## Decisions (decision proxy)

| Decision | Rationale |
|----------|-----------|
| One fixed line per energy bucket | MVP simplicity; roadmap unknown resolved |
| Break-start: break-kind only (no energy) | Energy captured at check-in; break-start is rest moment — kind distinguishes short vs long |
| Re-entry: `narrativeLatestEnergy` + null → neutral | Matches FR-041; guest/auth without check-in get neutral |
| 5s auto-dismiss + click to skip | Skippable without blocking; longer than override ack (3s) — user may read break-start |
| Fading re-entry: invitational | Avoid S-16 wind-down preachiness — distinct strings, no "stop working" framing |

## Phase 1: Copy module (TDD)

### Overview

Pure copy library with tone guards.

### Changes Required

#### 1. Transition copy module

**File**: `src/lib/session/transition-copy.ts` (new)

**Exports**:
- `getBreakStartLine(breakKind: "SHORT_BREAK" | "LONG_BREAK"): string`
- `getBreakReentryLine(energy: EnergyLevel | null): string`
- Constants for test assertions

**Tone**: calm, invitational; no `should`, `mistake`, `wrong`, preachy stop language (mirror `override-ack-copy.test.ts`).

#### 2. Unit tests

**File**: `src/lib/session/transition-copy.test.ts` (new)

**Intent**: All energy buckets + neutral fallback; break kind variants; tone guards; Fading line ≠ wind-down copy themes.

### Success Criteria

#### Automated Verification

- [ ] `pnpm exec vitest run src/lib/session/transition-copy.test.ts` passes
- [ ] `pnpm check` passes

---

## Phase 2: Hook state (break-start line)

### Overview

Set/clear break-start interstitial when break timer starts; expose energy for overlay.

### Changes Required

#### 1. Hook state + helpers

**File**: `src/hooks/use-pomodoro-cycle.ts`

**Pre-edit**: run `pnpm change-impact -- src/hooks/use-pomodoro-cycle.ts` (AGENTS.md maintainer tooling).

**Intent**:
- Add `breakTransitionLine: string | null` + `clearBreakTransitionLine()`.
- Set line in `startBreakAfterWorkComplete` and optimistic break path in `continueAfterCheckIn` using `getBreakStartLine`.
- Auto-dismiss timer (~5s) + clear on break end / session end / pause.
- Export `narrativeLatestEnergy` (or existing field) to dashboard for re-entry copy.

#### 2. Hook tests

**File**: `src/hooks/use-pomodoro-cycle.test.tsx`

**Intent**: Break start sets line; dismiss clears; line cleared when break completes; guest path sets break-start line.

### Success Criteria

#### Automated Verification

- [ ] `pnpm exec vitest run src/hooks/use-pomodoro-cycle.test.tsx` passes (new cases)
- [ ] `pnpm test` passes

---

## Phase 3: Dashboard + overlay UI

### Overview

Render break-start interstitial; swap break→work subtitle.

### Changes Required

#### 1. Dashboard interstitial

**File**: `src/app/_components/pomodoro-dashboard.tsx`

**Intent**:
- Compute `showBreakTransitionLine` = line present && break running && !wedgeGateActive && !showSuggestionCard && !cyclePaused.
- Render skippable strip (`data-testid="break-transition-line"`) styled like override ack; onClick → clear.
- Pass `getBreakReentryLine(narrativeLatestEnergy)` into break `CycleCompleteOverlay`.

#### 2. Cycle complete overlay

**File**: `src/app/_components/cycle-complete-overlay.tsx`

**Intent**: Accept optional `reentryCopy?: string`; replace hardcoded subtitle when provided; preserve heading + CTAs.

#### 3. Component tests

**Files**: `src/app/_components/pomodoro-dashboard.test.tsx`, `src/app/_components/cycle-complete-overlay.test.tsx`

**Intent**:
- Break transition line hidden when wedge gate active / suggestion card visible.
- Break overlay renders energy-keyed reentry copy prop.
- Skip click clears line.

### Success Criteria

#### Automated Verification

- [ ] `pnpm exec vitest run src/app/_components/pomodoro-dashboard.test.tsx src/app/_components/cycle-complete-overlay.test.tsx` passes
- [ ] `pnpm test` passes

---

## Phase 4: E2E belt smoke

### Overview

One belt spec asserting break re-entry copy visible after authenticated work→check-in→break→break-end path.

### Changes Required

#### 1. E2E spec extension

**File**: `e2e/pomodoro-cycle.spec.ts` (or focused helper)

**Intent**: After break ends, overlay subtitle matches energy bucket (Focused path); `@skip-belt` only if flaky — prefer belt-safe assertion on neutral/guest fallback if auth path too heavy.

### Success Criteria

#### Automated Verification

- [ ] `set CI=true && pnpm test:e2e:belt` passes

#### Manual Verification

- [ ] Authenticated: Fading check-in → break start line → break end shows invitational Fading re-entry (not wind-down tone)
- [ ] Skip break-start line does not block timer or suggestion card

---

## References

- `context/changes/mindful-transition-copy/research.md`
- `context/foundation/roadmap-references/items/S-21.md`
- `context/foundation/user-flow.md` (beat mutex)
- `context/foundation/lessons.md` (transition dismiss oracles)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Copy module (TDD)

#### Automated

- [x] 1.1 Add `transition-copy.ts` with break-start + re-entry selectors
- [x] 1.2 Add `transition-copy.test.ts` tone + energy oracle

### Phase 2: Hook state (break-start line)

#### Automated

- [x] 2.1 Wire break-start line set/clear/dismiss in `use-pomodoro-cycle.ts`
- [x] 2.2 Hook tests for break transition line lifecycle

### Phase 3: Dashboard + overlay UI

#### Automated

- [x] 3.1 Dashboard interstitial + mutex guards
- [x] 3.2 `CycleCompleteOverlay` reentry copy prop
- [x] 3.3 Component tests (dashboard + overlay)

### Phase 4: E2E belt smoke

#### Automated

- [x] 4.1 Belt e2e assertion for break re-entry copy

#### Manual

- [x] 4.2 Smoke Fading path — no wind-down tone overlap
