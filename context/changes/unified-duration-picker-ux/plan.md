# Unified Duration Picker UX — Implementation Plan

## Overview

Replace the inconsistent idle-state duration controls in `TimerPanel` with a **single, reusable minute-first picker pattern** used for work, short break, and long break. Storage, API, and timer math stay in **seconds**; only presentation and input parsing change. Presets remain shortcuts into the same custom fields users see (no raw `1500` for 25 minutes).

## Current State Analysis

Frame investigation (HIGH confidence) established:

| Finding | Evidence |
| --- | --- |
| Work presets in minutes, custom in seconds | `timer-panel.tsx:157-207` |
| Breaks: minute-only rows, no presets | `timer-panel.tsx:236-284` |
| Storage/API already seconds end-to-end | `duration-storage.ts`, `cycle.ts:53-57` |
| E2E locked to `work-duration-custom-sec` | `e2e/helpers/work-cycle.ts:6-8` |
| FR-010: 1s–90m work; FR-011: 1–30m breaks | `prd.md:98-100` |

Dual state (`selectedSec` + `customSec`) on work causes minor idle confusion but is **not** the primary pain — the picker refactor replaces it with one `valueSec` source of truth per instance.

## Desired End State

- Idle `TimerPanel` shows **three structurally identical pickers** (work always visible; short/long inside collapsible Break settings).
- Each picker: **preset chip row** + **custom minutes + seconds** — **identical control for work and both breaks**.
- Selecting a preset fills custom fields with human-readable values (e.g. 25 min + 0 sec, not 1500).
- Sub-minute durations (e.g. 30s) via min=0, sec=30 without mental ×60 — **work and breaks**.
- Break pickers support presets (3/5/10 short; 10/15/20 long) and custom **1 s – 30 min** (same min+sec fields as work).
- `pnpm test`, `pnpm check`, and E2E specs pass; `setWorkDurationSec(page, N)` still works via updated helper.

### Key Discoveries

- `setLastDuration` runs on cycle start in `use-pomodoro-cycle.ts` — work picker stays local until Start; breaks persist immediately via `setShortBreakDuration` / `setLongBreakDuration` (preserve this).
- No DB or tRPC schema changes required.
- `context/foundation/test-plan.md` cookbook references `work-duration-custom-sec` — update in Phase 4.

## What We're NOT Doing

- Changing timer drift logic, `formatRemainingMs`, or running-state UI.
- New settings page or moving break config out of `TimerPanel`.
- Guest-specific duration UI (guest uses same `TimerPanel`).
- Different picker variants per duration kind (no work-only seconds field).

## Implementation Approach

1. **Extend `duration-bounds`** with break preset lists and shared metadata.
2. **Add pure conversion/validation helpers** (`duration-input.ts`) — sec ↔ min+sec, clamp, preset matching.
3. **Extract `DurationPicker`** — controlled component, `valueSec` + `onChangeSec`, configurable presets/bounds; always min+sec fields.
4. **Refactor `TimerPanel`** — three picker instances; remove `selectedSec`/`customSec`/`shortBreakMin`/`longBreakMin` ad-hoc state.
5. **Migrate tests + E2E helper** — new testids; helper maps seconds → min+sec fields.

## Critical Implementation Details

**Duration validation (all pickers):** Total seconds = `minutes * 60 + seconds`. Work: `[1, 5400]`; when `minutes === 90`, seconds must be `0`. Breaks: `[1, 1800]`; when `minutes === 30`, seconds must be `0`. Empty/partial input during typing should not call `onChangeSec` with invalid totals; disable Start when work total invalid (same as today).

**Break bounds change:** Lower `MIN_BREAK_DURATION_SEC` from `60` to `1` in `duration-bounds.ts` so client matches work picker and API (`cycle.ts` already allows 1s for all kinds). Update `duration-storage.test.ts` clamp expectations accordingly.

**Preset highlight:** Active chip when `valueSec === preset.sec` exactly — single source of truth, no separate `selectedSec`.

## Phase 1: Duration bounds & input utilities

### Overview

Centralize preset definitions and second↔minute parsing so picker and tests share one contract.

### Changes Required:

#### 1. Break presets in `duration-bounds`

**File**: `src/lib/duration-bounds.ts`

**Intent**: Add `getShortBreakPresets()` and `getLongBreakPresets()` mirroring `getWorkDurationPresets()` shape (`{ label, sec }`). Update comment on `getMinCustomWorkDurationSec` — no longer "custom seconds field".

**Contract**: Short presets: 3, 5, 10 min. Long presets: 10, 15, 20 min. Labels use `"N min"` format. Set `MIN_BREAK_DURATION_SEC = 1` (was `60`) so breaks support second precision like work. `MAX_BREAK_DURATION_SEC` stays `30 * 60`.

#### 2. Pure input helpers

**File**: `src/lib/duration-input.ts` (new)

**Intent**: Provide conversion and validation used by `DurationPicker` and unit tests.

**Contract**: Export at minimum:
- `splitSecToMinSec(totalSec: number): { minutes: number; seconds: number }`
- `combineMinSecToSec(minutes: number, seconds: number): number`
- `isDurationSecInRange(totalSec: number, minSec: number, maxSec: number): boolean`
- `findMatchingPreset(totalSec: number, presets: ReadonlyArray<{ sec: number }>): { sec: number } | undefined`

No React imports — Vitest-only surface.

#### 3. Bounds tests

**File**: `src/lib/duration-bounds.test.ts`

**Intent**: Assert new break preset lists and label format.

**Contract**: Short/long preset `sec` arrays match plan values; no `"sec"` in labels.

#### 4. Input utility tests

**File**: `src/lib/duration-input.test.ts` (new)

**Intent**: Cover round-trips, edge cases (0:30 → 30s, 90:00 → 5400, 90:01 invalid), preset match.

**Contract**: Tests for `combineMinSecToSec(0, 30) === 30`, `splitSecToMinSec(1500) === { minutes: 25, seconds: 0 }`.

#### 5. Storage tests

**File**: `src/lib/duration-storage.test.ts`

**Intent**: Update break read/write expectations after `MIN_BREAK_DURATION_SEC` drops from 60 to 1.

**Contract**:
- **Write-clamp**: `setShortBreakDuration(0)` / `setLongBreakDuration(0)` expect `1` (not `1 * 60`).
- **Read-path**: stored `"30"` for short/long break keys returns `30` (valid sub-minute value; no longer falls back to default).
- **Round-trip** (optional): `setShortBreakDuration(45)` / `getShortBreakDuration()` → `45` (mirrors work sub-minute test at `:42-44`).

### Success Criteria:

#### Automated Verification:

- `pnpm test` passes (new + updated unit tests)
- `duration-storage.test.ts` break clamp expectations updated for 1s minimum
- `pnpm check` passes
- `pnpm typecheck` passes

#### Manual Verification:

- N/A (no UI yet)

---

## Phase 2: `DurationPicker` component

### Overview

Reusable controlled picker: presets + minutes + seconds (same for work and breaks).

### Changes Required:

#### 1. Component

**File**: `src/app/_components/duration-picker.tsx` (new)

**Intent**: Render preset chips and custom fields; emit `onChangeSec` only when parsed total is in range. Show validation error when user has touched custom fields and total is out of range.

**Contract**: Props (minimum):
- `testIdPrefix: string` — drives `data-testid="{prefix}-min"` and `"{prefix}-sec"` (always both)
- `presets: ReadonlyArray<{ label: string; sec: number }>`
- `valueSec: number`
- `onChangeSec: (sec: number) => void`
- `minSec: number`, `maxSec: number`
- `boundsLabel: string` — e.g. `"1 s – 90 min"` (work) or `"1 s – 30 min"` (breaks)

Behavior:
- Preset click: `onChangeSec(preset.sec)` and sync local min/sec display.
- When `valueSec` changes (init or parent update), custom fields re-derive via `splitSecToMinSec(valueSec)`.
- Custom change: recompute total; if in range, `onChangeSec(total)`; preset highlight follows `valueSec`.
- Layout: preset row centered (match current work style); custom row with min + sec + unit labels (identical across all three instances).

#### 2. Component tests

**File**: `src/app/_components/duration-picker.test.tsx` (new)

**Intent**: Test preset selection, custom minutes, sub-minute (0 min 45 sec), validation errors, preset highlight sync.

**Contract**: Test with `testIdPrefix="work-duration"` and at least one break prefix; cover sub-minute (`0` min `45` sec), preset sync, and max-boundary (30 min 0 sec for breaks).

### Success Criteria:

#### Automated Verification:

- `pnpm test` passes (`duration-picker.test.tsx`)
- `pnpm check` passes

#### Manual Verification:

- N/A (not wired to `TimerPanel` yet)

---

## Phase 3: `TimerPanel` integration

### Overview

Replace inline duration UI with three `DurationPicker` instances; simplify start logic.

### Changes Required:

#### 1. Timer panel refactor

**File**: `src/app/_components/timer-panel.tsx`

**Intent**: Remove `selectedSec`, `customSec`, `parseCustomSecInput`, `presetToCustomSec`, `shortBreakMin`, `longBreakMin`, and dual-state highlight logic. Use:

- **Work picker**: `testIdPrefix="work-duration"`, presets from `getWorkDurationPresets()`, `valueSec` from `getLastDuration()` init + local state, bounds work min/max. On valid change, update local `workDurationSec` only (persist on Start via existing hook).
- **Short break picker** (inside expanded break settings): `testIdPrefix="short-break-duration"`, presets from `getShortBreakPresets()`, init from `getShortBreakDuration()`, bounds break min/max, `onChangeSec` → `setShortBreakDuration` — **same min+sec UI as work**.
- **Long break picker**: `testIdPrefix="long-break-duration"`, same pattern with long presets/storage.

Start button: `onStart(workDurationSec)` when work total valid; disabled when invalid or `isStarting`.

Add section labels: `"Work duration"` above work picker; `"Short break"` / `"Long break"` above each break picker inside panel.

Remove `data-testid="work-duration-custom-sec"`, `short-break-input`, `long-break-input`.

#### 2. Timer panel tests

**File**: `src/app/_components/timer-panel.test.tsx`

**Intent**: Update to new testids and minute-based interaction; preserve behavioral contracts (90s custom start, 15 min preset → `15*60`, validation disables Start).

**Contract**: Use `work-duration-min` + `work-duration-sec`; error copy references minutes/seconds not raw 5400 sec string.

### Success Criteria:

#### Automated Verification:

- `pnpm test` passes
- `pnpm check` passes
- `pnpm typecheck` passes

#### Manual Verification:

- Idle panel: click 25 min preset → custom shows 25 min (and 0 sec), not 1500
- Set 0 min 30 sec work → Start runs ~30s cycle
- Break settings: short/long presets work; custom min+sec (e.g. 4 min 30 sec) persists after reload
- Start Cycle disabled on invalid work duration

**Implementation Note**: Pause after manual verification before Phase 4.

---

## Phase 4: E2E, docs & PRD alignment

### Overview

Keep E2E fast-cycle ergonomics; update references to old testids.

### Changes Required:

#### 1. E2E helper

**File**: `e2e/helpers/work-cycle.ts`

**Intent**: `setWorkDurationSec(page, seconds)` fills `work-duration-min` and `work-duration-sec` derived from `splitSecToMinSec` logic (inline or shared).

**Contract**: Public API unchanged (`seconds: number`). `startFocusedWorkCycle` callers need no edits.

#### 2. E2E README, test-plan cookbook & root README

**Files**: `e2e/README.md`, `context/foundation/test-plan.md`, `README.md`

**Intent**: Replace `work-duration-custom-sec` references with `work-duration-min` / `work-duration-sec` and note helper abstraction. Update root README break range to **1 second–30 minutes** (was minute-only wording).

**Contract**: §6 cookbook entry for persistence-reload still documents 30s fast cycles via helper.

#### 3. PRD addendum (minimal)

**File**: `context/foundation/prd.md`

**Intent**: Update FR-011: break durations configurable via same picker as work (presets + min+sec custom); range **1 second–30 minutes**; preset examples (short: 3/5/10 min includes default 5; long: 10/15/20 min includes default 15). FR-010 unchanged.

**Contract**: FR-011 wording aligned with FR-010 precision model (second-level floor, minute-oriented presets).

### Success Criteria:

#### Automated Verification:

- `set CI=true && pnpm test:e2e` passes (or targeted: `persistence-reload.spec.ts`, `pomodoro-cycle.spec.ts`, `guest-trial.spec.ts`)
- `pnpm test` passes (full suite)
- `pnpm check` passes

#### Manual Verification:

- Smoke: focus task → set 1s work via 0:01 → cycle starts and completes in E2E time scale

---

## Testing Strategy

### Unit Tests

- `duration-input.test.ts` — conversion edge cases
- `duration-bounds.test.ts` — break presets
- `duration-picker.test.tsx` — interaction model
- `timer-panel.test.tsx` — integration + Start contract

### Integration Tests

- `duration-storage.test.ts` — update break clamp tests for new 1s minimum
- No new tRPC tests (API unchanged)

### Manual Testing Steps

1. Open idle timer with focused task — verify 25 min preset shows 25 in min field
2. Enter 42 min custom work — Start uses 42×60s
3. Enter 0 min 45 sec — Start uses 45s
4. Expand breaks — click 5 min short preset; set 4 min 30 sec long break; reload; both persist
5. Invalid 91 min work — error shown, Start disabled
6. Set short break to 0 min 45 sec — value persists and is used on next break cycle

## Performance Considerations

Negligible — local state only, no extra network calls. Three pickers on idle panel is fine for DOM size.

## Migration Notes

- **localStorage**: No key migration; values remain seconds. Sub-minute values (e.g. 30) display as 0 min 30 sec for work and breaks via `splitSecToMinSec`. Existing break values stored as whole minutes (e.g. 300s) display as N min 0 sec.
- **E2E**: Helper absorbs UI change; spec files should not need per-line edits unless they reference old testids directly (grep confirms only helper does).

## References

- Frame brief: `context/changes/unified-duration-picker-ux/frame.md`
- Current UI: `src/app/_components/timer-panel.tsx`
- Bounds: `src/lib/duration-bounds.ts`
- Prior Phase 4 seconds decision: `context/changes/testing-critical-path-persistence-timer/plan.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Duration bounds & input utilities

#### Automated

- [x] 1.1 `pnpm test` passes (new + updated unit tests)
- [x] 1.2 `duration-storage.test.ts` break clamp expectations updated for 1s minimum
- [x] 1.3 `pnpm check` passes
- [ ] 1.4 `pnpm typecheck` passes

### Phase 2: `DurationPicker` component

#### Automated

- [x] 2.1 `pnpm test` passes (`duration-picker.test.tsx`)
- [x] 2.2 `pnpm check` passes

### Phase 3: `TimerPanel` integration

#### Automated

- [x] 3.1 `pnpm test` passes
- [x] 3.2 `pnpm check` passes
- [ ] 3.3 `pnpm typecheck` passes

#### Manual

- [ ] 3.4 Idle panel: 25 min preset shows 25 min and 0 sec, not 1500
- [ ] 3.5 Set 0 min 30 sec work → Start runs ~30s cycle
- [ ] 3.6 Break settings: short/long presets and custom min+sec persist after reload
- [ ] 3.7 Start Cycle disabled on invalid work duration

### Phase 4: E2E, docs & PRD alignment

#### Automated

- [ ] 4.1 `set CI=true && pnpm test:e2e` passes (or targeted persistence/pomodoro/guest specs)
- [x] 4.2 `pnpm test` passes (full suite)
- [x] 4.3 `pnpm check` passes

#### Manual

- [ ] 4.4 E2E-scale 1s work smoke verified
