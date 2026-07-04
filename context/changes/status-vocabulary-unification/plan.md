# Status Vocabulary Unification — Implementation Plan

## Overview

Fix wave 4 from the post-MVP defect register (**D-10**): unify Polish status vocabulary across the entire app to match the task-list canonical terms **Ukończone** / **Aktywne** / **Zarchiwizowane**. The S-42 “zoned vocabulary” (Domknięte / Zostaje / Zrobione / otwarte in day-memory and recap surfaces) is **unieważnione** per product decision 2026-07-03. This change amends `product-voice.md` and updates `messages/pl.json` only — no runtime TypeScript changes, no `en.json` edits, no schema work.

## Current State Analysis

From `context/changes/mvp-defect-intake/research.md` and grep of `messages/pl.json`:

- **Canonical reference (already correct):** `Tasks.sectionActive` = `Aktywne ({count})`, `Tasks.sectionCompleted` = `Ukończone ({count})`, archive strings use **Zarchiwizowane** (`pl.json:247-248,275-277`).
- **Banned vocabulary still in PL catalog:**

| Key | Line | Current value (fragment) |
| --- | --- | --- |
| `DayMemory.sectionDone` | 332 | Domknięte |
| `DayMemory.sectionRemains` | 333 | Zostaje |
| `DayMemory.collapsedLine` | 335 | Zrobione: … Zostało: … |
| `DayMemory.collapsedLineNoReturn` | 336 | Zrobione: … Zostało: … |
| `DayMemory.remainingCount` | 338 | otwarte / otwartych |
| `HomeFocusSummary.standingOpen` | 328 | otwarte / otwartych |
| `HomeFocusSummary.standingDone` | 329 | domknięte / domkniętych |
| `Recap.markedDone` | 378 | zrobione |
| `Recap.todayDoneTag` | 381 | Zrobione dziś |
| `Session.narrative.taskDone` | 104 | zrobione / zrobionych |

- **Contract drift:** `context/foundation/product-voice.md:45-46,133-147,162-163,182` still documents Domknięte / Zostaje / Zrobione as F-14 acceptance examples.
- **Runtime:** All user-visible strings are i18n-driven via `narrative-copy.ts`, `format-day-memory.ts`, and components — **no hardcoded PL status words in `src/`** except test assertions.
- **Tests with exact-string oracles:** `src/lib/voice/acceptance-copy.test.ts:68-84`, `src/lib/recap/format-day-memory.test.ts:279-362`.

### Key Discoveries:

- `format-day-memory.ts` composes collapsed lines from `DayMemory.*` keys via `narrative-copy.ts` — changing `pl.json` alone updates home day-memory, expanded sections, and recap-adjacent copy.
- `DayMemory.sectionReturnTo` (**Wróć tutaj**) is **not** banned — stays unchanged.
- `HomeFocusSummary.budgetLine` uses lowercase “zostało” as quantity (“remaining hours”) — **not** a status label; out of scope.
- No e2e specs assert banned PL status terms.
- `messages/en.json` structure unchanged — `messages-parity.test.ts` should still pass.

## Desired End State

- Every Polish status surface uses **Ukończone** (completed/done), **Aktywne** (open/remaining work), or **Zarchiwizowane** (archived) — aligned with the task list.
- `product-voice.md` documents the unified vocabulary; F-14 acceptance examples and checklist reference Ukończone / Aktywne.
- `pnpm check` and `pnpm test` green; grep of `messages/pl.json` finds no banned status roots in the keys listed above.
- Manual PL pass: home day-memory collapsed + expanded sections, daily recap panel, home focus summary standing counts, session narrative task-done line — all show unified terms.

## What We're NOT Doing

- **`en.json` changes** — PL-only defect (D-10).
- **Runtime TypeScript / component edits** — strings are catalog-driven; no logic changes.
- **Roadmap / archive doc rewrites** — historical S-42 docs may still mention old terms; update only `product-voice.md` contract.
- **D-08 / D-09 / D-02–D-05 / D-04** — other defect waves; no overlap.
- **Renaming `Tasks.sectionActive/Completed` keys** — already canonical.
- **Changing `Wróć tutaj` / return-to vocabulary** — not in banned list.

## Implementation Approach

Four phases, each independently green. Phase 1 settles the contract (source of truth for reviewers). Phase 2 updates all `pl.json` keys in one commit-sized batch. Phase 3 aligns test oracles. Phase 4 runs full verification + manual PL checklist. Phases 2–3 must stay in sync — never merge contract without catalog, or tests without catalog.

## Phase 1: Product Voice Contract Amendment (D-10)

### Overview

Amend `product-voice.md` to unieważnić S-42 zoned day-memory labels and document unified PL status vocabulary aligned with `Tasks.sectionActive` / `Tasks.sectionCompleted`.

### Changes Required:

#### 1. Preferred vocabulary table

**File**: `context/foundation/product-voice.md`

**Intent**: Replace day-memory row entries that cite Domknięte / Zostaje with Ukończone / Aktywne; note alignment with task-list section headers.

**Contract**: §Preferred vocabulary rows for “Day memory — done” and “Day memory — remains” (~lines 45–46).

#### 2. Day memory closure acceptance table

**File**: `context/foundation/product-voice.md`

**Intent**: Update F-14 acceptance table (~lines 133–137) PL labels to Ukończone / Aktywne; add footnote that PL status vocabulary is unified app-wide (amended 2026-07-04 per D-10).

**Contract**: §Day memory closure table — PL column for Done and Remains rows.

#### 3. Collapsed one-line template

**File**: `context/foundation/product-voice.md`

**Intent**: Update PL collapsed-line example (~line 143) from `Zrobione:` / `Zostało:` prefixes to `Ukończone:` / `Aktywne:`.

**Contract**: §Collapsed one-line PL template row.

#### 4. Examples and checklist

**File**: `context/foundation/product-voice.md`

**Intent**: Update ✓ PL day-memory example (~line 162) and future-slice checklist item (~line 182) to reference Ukończone / Aktywne instead of Domknięte / Zostaje / Zrobione.

**Contract**: §Examples and non-examples (Day memory); §Future-slice acceptance checklist (Day memory vocabulary bullet).

#### 5. Promise table (optional consistency)

**File**: `context/foundation/product-voice.md`

**Intent**: Update PL Success row (~line 15) prose “co domknięte, a co zostaje” → phrasing using ukończone / aktywne so the contract does not reintroduce banned terms in maintainer-facing copy.

**Contract**: §Promise table PL Success cell.

### Success Criteria:

#### Automated Verification:

- `pnpm check` passes
- Grep `product-voice.md` for `Domknięte|Zostaje|Zrobione` returns zero matches in status-label contexts (Wróć tutaj and non-status prose may remain)

#### Manual Verification:

- Contract reads coherently: unified PL status vocabulary is explicit and references task-list canonical terms

**Implementation Note**: Pause for manual confirmation before phase commit.

---

## Phase 2: Polish Message Catalog (D-10)

### Overview

Update all `messages/pl.json` keys that carry banned status vocabulary to unified Ukończone / Aktywne forms.

### Changes Required:

#### 1. DayMemory namespace

**File**: `messages/pl.json`

**Intent**: Replace section labels and collapsed-line prefixes; update `remainingCount` plural forms from otwarte → aktywne.

**Contract**:

| Key | Target direction |
| --- | --- |
| `DayMemory.sectionDone` | `Ukończone` |
| `DayMemory.sectionRemains` | `Aktywne` |
| `DayMemory.collapsedLine` | `Ukończone: {done}. Aktywne: {remaining}. Wróć spokojnie do: {next}.` |
| `DayMemory.collapsedLineNoReturn` | `Ukończone: {done}. Aktywne: {remaining}.` |
| `DayMemory.remainingCount` | plural: `aktywne` / `aktywnych` (preserve ICU plural structure) |

**Addendum (impl-review 2026-07-04):** `remainingCount` ships as `zadanie`/`zadania`/`zadań` — mirrors `doneCount` and EN `{n} open`, avoiding redundant "Aktywne: N aktywne."

#### 2. HomeFocusSummary namespace

**File**: `messages/pl.json`

**Intent**: Align daily-standing summary strings with unified vocabulary.

**Contract**:

| Key | Target direction |
| --- | --- |
| `HomeFocusSummary.standingOpen` | replace `otwarte`/`otwartych` → `aktywne`/`aktywnych` |
| `HomeFocusSummary.standingDone` | replace `domknięte`/`domkniętych` → `ukończone`/`ukończonych` |

#### 3. Recap namespace

**File**: `messages/pl.json`

**Intent**: Unify recap surface status wording.

**Contract**:

| Key | Target direction |
| --- | --- |
| `Recap.markedDone` | `Oznaczono jako ukończone · {title}` |
| `Recap.todayDoneTag` | `Ukończone dziś` |

#### 4. Session narrative

**File**: `messages/pl.json`

**Intent**: Replace `zrobione`/`zrobionych` in task-done count line with `ukończone`/`ukończonych`.

**Contract**: `Session.narrative.taskDone` ICU plural string (~line 104).

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/i18n/messages-parity.test.ts` passes (structure unchanged vs `en.json`)
- Grep `messages/pl.json` for keys above: no `Domknięte`, `Zostaje`, `Zrobione`, `otwarte`, `domknięte`, `zrobione` in those namespaces

#### Manual Verification:

- Skim updated PL strings for natural grammar (especially `HomeFocusSummary` plural forms)

**Implementation Note**: Pause for manual confirmation before phase commit.

---

## Phase 3: Test Oracle Updates (D-10)

### Overview

Update co-located tests that assert exact PL acceptance strings to match Phase 2 catalog values.

### Changes Required:

#### 1. F-14 voice acceptance tests

**File**: `src/lib/voice/acceptance-copy.test.ts`

**Intent**: Rename test description and expectations from Domknięte/Zostaje to Ukończone/Aktywne; update collapsed-line PL expected string (~lines 68–84).

**Contract**: `getDayMemorySectionDone("pl")`, `getDayMemorySectionRemains("pl")`, `buildDayMemoryCollapsedLine(..., "pl")` assertions.

#### 2. formatDayMemory tests

**File**: `src/lib/recap/format-day-memory.test.ts`

**Intent**: Update PL collapsed-line expectations and `remainingCount` plural boundary table (~lines 279–362).

**Contract**: Expected strings must match post-change `pl.json` templates exactly (including `3 aktywne` / `0 aktywnych` forms).

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/lib/voice/acceptance-copy.test.ts src/lib/recap/format-day-memory.test.ts`
- `pnpm check`
- `pnpm test`

#### Manual Verification:

- None required beyond automated pass

**Implementation Note**: Pause for manual confirmation before phase commit.

---

## Phase 4: Full Verification + PL Manual Pass (D-10)

### Overview

Run full quality gates and execute manual PL checklist across affected surfaces.

### Changes Required:

#### 1. Verification only

**Intent**: Confirm no regressions and no remaining banned terms in user-facing PL catalog.

**Contract**: No code changes unless grep discovers a missed key.

### Success Criteria:

#### Automated Verification:

- `pnpm check`
- `pnpm test`
- Grep `messages/pl.json` for `\b(Domknięte|Zostaje|Zrobione|otwarte|domknięte|zrobione)\b` in DayMemory, HomeFocusSummary, Recap, Session.narrative — zero matches

#### Manual Verification:

- PL locale home: day-memory collapsed line shows **Ukończone** / **Aktywne** prefixes
- PL locale home: expanded day-memory sections labeled **Ukończone** / **Aktywne** / **Wróć tutaj**
- PL locale: daily recap panel shows **Ukończone dziś** tag
- PL locale: task list sections still **Aktywne** / **Ukończone** (unchanged — regression check)
- PL locale: home focus summary standing counts use ukończone/aktywne wording

**Implementation Note**: Final phase — epilogue commit lands plan Progress + `change.md` → implemented.

---

## Testing Strategy

### Unit Tests:

- `acceptance-copy.test.ts` — F-14 PL day-memory acceptance strings
- `format-day-memory.test.ts` — PL collapsed line composition + plural boundaries
- `messages-parity.test.ts` — key structure parity after pl.json edits

### Integration Tests:

- None required — pure copy change

### Manual Testing Steps:

1. Switch app to PL (`/pl` or user preference).
2. Authenticated home with completed + remaining tasks: read collapsed day-memory line.
3. Expand day-memory: verify section headers.
4. Open daily recap / mark task done: verify **Ukończone dziś** and marked-done line.
5. Guest + auth task list: confirm **Aktywne** / **Ukończone** section headers unchanged.

## Performance Considerations

None — static message catalog and contract edits only.

## Migration Notes

No data migration. Existing users see new PL copy on next page load. EN locale unaffected.

## References

- Defect register: `context/changes/mvp-defect-intake/change.md` (D-10)
- Parent research: `context/changes/mvp-defect-intake/research.md` (Wave 4)
- Contract: `context/foundation/product-voice.md`
- Canonical task labels: `messages/pl.json` (`Tasks.sectionActive`, `Tasks.sectionCompleted`)
- Runtime formatters: `src/lib/recap/format-day-memory.ts`, `src/lib/session/narrative-copy.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Product Voice Contract Amendment

#### Automated

- [x] 1.1 `pnpm check` passes after contract edits
- [x] 1.2 Grep `product-voice.md` — no Domknięte/Zostaje/Zrobione in status-label contexts

#### Manual

- [x] 1.3 Contract reads coherently; unified vocabulary explicit

### Phase 2: Polish Message Catalog

#### Automated

- [x] 2.1 `pnpm exec vitest run src/i18n/messages-parity.test.ts`
- [x] 2.2 Grep `messages/pl.json` — banned terms absent from target namespaces

#### Manual

- [x] 2.3 PL strings grammatically natural (especially HomeFocusSummary plurals)

### Phase 3: Test Oracle Updates

#### Automated

- [x] 3.1 `pnpm exec vitest run src/lib/voice/acceptance-copy.test.ts src/lib/recap/format-day-memory.test.ts`
- [x] 3.2 `pnpm check`
- [x] 3.3 `pnpm test`

### Phase 4: Full Verification + PL Manual Pass

#### Automated

- [x] 4.1 `pnpm check`
- [x] 4.2 `pnpm test`
- [x] 4.3 Grep `messages/pl.json` — zero banned status roots in target keys

#### Manual

- [x] 4.4 PL home day-memory collapsed + expanded sections
- [x] 4.5 PL recap today-done tag + marked-done line
- [x] 4.6 PL task list sections unchanged (regression)
- [x] 4.7 PL home focus summary standing counts
