# Roadmap UX/UI story expand — Implementation Plan

## Overview

Write the accepted UX/UI story chapter into FlowState's roadmap index and reference layer. Five proposals from expand batch 7 become canonical rows **F-14** (`product-voice-contract`) and **S-40**–**S-43** (`home-ia-reset`, `desktop-calm-workbench`, `mindful-day-memory`, `stateful-illustration-system`). This change is **documentation only** — it prepares downstream `/10x-plan` and `/10x-implement` work; it does not modify application code.

## Current State Analysis

- Expand analysis, refinement (all ≥9.0), parked comparison, and feasibility research exist in `context/changes/roadmap-ux-ui-story-expand/`.
- `context/foundation/roadmap.md` ends product slices at **S-39** and quality at **Q-09**; `active_slices: []`; recommended next is undecided post-Q-09.
- S-28 phase 1 shipped; **phase 2 overlay scrims deferred** (`items/S-28.md`).
- S-30 shipped as light list-only recap; mindful day memory must be framed as **phase 2 presentation** (`items/S-30.md`).
- S-39 gate accessibility contract is done and must not be regressed by decorative illustration scope (`items/S-39.md`).

### Key Discoveries

- ID allocation is collision-free: F-14 and S-40–S-43 (`research.md`).
- Patch targets: glance table after Q-09, new stream after Stream Q, backlog handoff, scope merges, item cards, expand-batches record (`research.md`).
- Primary risk is scope discipline (recap co-primary; illustrations on gate controls), not stack feasibility (`research.md`, `parked-comparison.md`).
- Issue creation follows L-01: verify existing `FLO-*` before creating pairs; quality rows Q-08/Q-09 intentionally skip external issues (`lessons.md`, `items/Q-08.md`).

## Desired End State

After this plan completes:

1. `roadmap.md` lists F-14 and S-40–S-43 with short Outcome cells, prerequisites, PRD refs, and `proposed` status.
2. Stream **R — UX/UI story chapter** documents the craft chain F-14 → S-40 → S-41 → S-42 → S-43.
3. Backlog handoff recommends **F-14 / `product-voice-contract`** as first `/10x-plan` target.
4. Item cards exist for each new ID with expand merge notes (S-42↔S-30, S-43↔S-28).
5. A PRD/roadmap decision audit records which old "not doing now" decisions remain locked, which need clarification, and which are absorbed by the new rows.
6. Batch 7 is archived under `roadmap-references/expand-batches/batch-7-ux-ui-story-chapter.md`.
7. `change.md` status is `planned`.

**Verification:** Read `roadmap.md` glance + stream; open the decision audit and each new `items/{ID}.md`; confirm scope merges, source lineage, expand-batches entry, and no `src/` files changed.

## What We're NOT Doing

- Implementing UI, copy migration, layout refactors, or illustration assets in `src/`.
- Creating Linear/GitHub issues before the user accepts the roadmap patch (Phase 4 is gated).
- Changing test-plan phases. Changing PRD v3 or unparking P-104 session-reconnect banner without an explicit decision-audit outcome.
- Adding product telemetry for the proposed "5-second purpose test."

## Implementation Approach

Follow the split-roadmap convention: patch the index (`roadmap.md`) with terse rows; put Outcome detail, Unknowns, Risk, acceptance guardrails, and source lineage in new `roadmap-references/items/{ID}.md` files. Prepend batch 7 summary to expand-batches README. Preserve all upstream analysis in the change folder — copy batch file to foundation, do not delete change-folder artifacts.

**Frozen sequencing (roadmap commit order):**

1. **F-14** `product-voice-contract` — foundation; `context/foundation/product-voice.md`
2. **S-40** `home-ia-reset` — home IA; soft dep F-14
3. **S-41** `desktop-calm-workbench` — hard dep S-40
4. **S-42** `mindful-day-memory` — S-30 phase 2; after F-14; best after S-40/S-41 placement
5. **S-43** `stateful-illustration-system` — absorbs S-28 phase 2; may parallel S-41 implementation once rail slot exists

**`main_goal`:** leave frontmatter as `quality` until F-14 ships; the new stream carries chapter identity without premature relabel.

## Critical Implementation Details

**Purpose test (S-40 acceptance):** document a maintainer script — open home idle state, ask "what does this app help me decide?" within 5 seconds; pass if answer matches "what to do next / co teraz." Automate proxy oracles only: exactly one filled primary CTA above fold in idle/returning; recap collapsed on first paint; timer hero during active work. Do not add product telemetry for this check.

**S-41 rail block enum (max 3):** Authenticated — (1) mode/illustration slot, (2) collapsed day-memory line, (3) standing/focus-hours text summary from S-27. Guest — (1) sign-in value prop, (2) guest activation/merge hint, (3) calm empty-state guidance.

**S-43 state map:** Bind six variants to S-40 home-session-state: `idle`, `energy_choice` (steering), `work` (active_work), `break`, `return` (returning), `closure` (session closure beat). Render on home hero and desktop rail only; never on S-39 gate controls; `aria-hidden`; ≤200ms crossfade; instant under `prefers-reduced-motion`; must not delay S-34 optimistic path.

---

## Phase 1: Freeze proposal specifications

### Overview

Lock acceptance language and relationships before editing canonical roadmap files. Resolve the S-42/S-43 ordering conflict in source docs in favor of **S-42 before S-43** (recap remains context after IA; rail illustration slot defined before stateful variants ship).

### Changes Required

#### 1. Proposal spec freeze note

**File**: `context/changes/roadmap-ux-ui-story-expand/expand-refinement-summary.md`

**Intent**: Append a short "Roadmap write stance (frozen)" section capturing commit order, purpose-test substitute, rail enum, and S-42/S-43 relationship wording so implementers do not re-litigate expand decisions.

**Contract**: Single authoritative subsection; no score changes; links to `parked-comparison.md` guardrails.

#### 2. Change status prep

**File**: `context/changes/roadmap-ux-ui-story-expand/change.md`

**Intent**: Ensure Notes list downstream first target `/10x-plan product-voice-contract`.

**Contract**: Frontmatter `status` remains `preparing` until Phase 3 completes, then becomes `planned`.

#### 3. PRD/roadmap decision audit

**File**: `context/changes/roadmap-ux-ui-story-expand/expand-refinement-summary.md`

**Intent**: Append a compact decision-audit table before canonical roadmap edits. The table must make old PRD/roadmap "not doing now" decisions explicit, instead of relying on memory from earlier slices.

**Contract**:

| Decision source | Current stance | Audit action | Required follow-through |
| --- | --- | --- | --- |
| PRD v3 Non-Goals: browser-only/no native mobile push | Still locked | keep | S-41 is desktop web layout only; mobile means responsive collapse, not platform scope |
| `roadmap-references/parked.md`: session reconnect calm banner P-104 | Still parked | keep parked | Do not hide it in S-40/S-42; leave a separate future recovery candidate |
| `items/S-30.md`: light timing recap | Shipped substrate | absorb as phase 2 | S-42 explicitly extends presentation/formatter only; no new data pipeline |
| `items/S-28.md`: Calm Garden phase 2 overlays | Deferred scope | absorb/reframe | S-43 absorbs visual follow-up while preserving S-39 gate exclusions |
| `roadmap.md` frontmatter `main_goal: quality` | Current chapter label | keep for now | Stream R carries UX/UI story until F-14 ships |

If the audit marks any PRD text as stale, Phase 2 must update the relevant PRD or roadmap-reference wording in the same patch.

### Success Criteria

#### Automated Verification

- Frozen stance section exists in `expand-refinement-summary.md`
- All five change IDs appear with explicit promote stance
- Decision-audit table exists with `keep`, `clarify`, or `absorb/reframe` action for each old PRD/roadmap decision touched by batch 7

#### Manual Verification

- S-42 Outcome language includes "S-30 phase 2"
- S-43 Outcome language includes "absorbs S-28 phase 2" and S-39 gate exclusion
- Rail enum lists three blocks per authenticated/guest persona
- Audit follow-through identifies whether PRD v3 itself changes or whether roadmap references carry the clarification

**Implementation Note**: Pause for human confirmation that frozen specs match intent before patching `roadmap.md`.

---

## Phase 2: Patch roadmap index

### Overview

Add F-14 and S-40–S-43 to the canonical roadmap index with stream, handoff, and scope merges.

### Changes Required

#### 1. Roadmap frontmatter and glance table

**File**: `context/foundation/roadmap.md`

**Intent**: Insert five new rows after Q-09 in `## At a glance` with `proposed` status, concise Outcome cells, prerequisites, and PRD refs (Secondary / US-03 craft where applicable).

**Contract**:

| ID | Change ID | Outcome (short) | Prerequisites |
| --- | --- | --- | --- |
| F-14 | product-voice-contract | (foundation) Polish-first voice contract — promise, tone, copy zones | S-21, S-30, F-04, F-06 |
| S-40 | home-ia-reset | home answers "Co teraz?" — one dominant next-focus, recap collapsed, inventory secondary | S-13, S-15, S-27, S-30, S-31; soft F-14 |
| S-41 | desktop-calm-workbench | lg≥1024 calm three-zone workbench; decision column primary; rail ≤3 blocks | S-40; soft F-14 |
| S-42 | mindful-day-memory | S-30 phase 2 — Domknięte/Zostaje/Wróć tutaj narrative; formatter only | S-30, S-18; soft F-14 |
| S-43 | stateful-illustration-system | S-28 phase 2 — state-bound Calm Garden on hero/rail; not on gates | S-28, F-06, F-07, S-39 |

Linear/GitHub columns: `—` until Phase 4.

#### 2. Streams table

**File**: `context/foundation/roadmap.md`

**Intent**: Add Stream **R — UX/UI story chapter** after Stream Q: `F-14 → S-40 → S-41 → S-42 → S-43`; note S-43 may parallel S-41 once rail slot exists.

**Contract**: One row; theme "UX/UI story craft"; references expand batch 7.

#### 3. Backlog handoff

**File**: `context/foundation/roadmap.md`

**Intent**: Replace post-Q-09 "choose deliberately" note with handoff rows for F-14–S-43; set **Recommended next:** F-14 `product-voice-contract`.

**Contract**: F-14 marked `ready for /10x-plan`; S-41 marked `no` until S-40 planned/shipped; others `no` or `revise` per dependency chain.

#### 4. Scope merges

**File**: `context/foundation/roadmap.md`

**Intent**: Append merge rows for batch 7 proposals (P-703→F-14, P-701→S-40, P-702→S-41, P-704→S-42 merge S-30 phase 2, P-705→S-43 absorb S-28 phase 2).

**Contract**: Matches format of existing scope merges table (~line 168+).

#### 5. Decision-audit follow-through

**Files**:
- `context/foundation/prd.md` (only if the audit marks PRD text stale)
- `context/foundation/roadmap-references/prd-v3-horizon.md`
- `context/foundation/roadmap-references/parked.md`
- `context/foundation/roadmap-references/future-ideas.md`

**Intent**: Apply the Phase 1 decision audit. Default stance: clarify the new UX/UI chapter in roadmap references; edit `prd.md` only when the audit explicitly says the PRD wording itself is outdated.

**Contract**: No silent unpark. Each touched decision is one of `keep`, `clarify`, `absorb/reframe`, or `unpark later`, with a target file named in the audit. P-104 remains parked unless the user explicitly changes that decision.

### Success Criteria

#### Automated Verification

- `roadmap.md` contains exactly one row each for F-14, S-40, S-41, S-42, S-43
- Stream R row present
- Recommended next points to F-14
- Decision-audit follow-through applied or explicitly marked "no PRD text change"

#### Manual Verification

- Glance table stays index-sized (~no Outcome bloat)
- Prerequisites match research sequencing and decision-audit outcomes
- No duplicate IDs or re-used change IDs

**Implementation Note**: Pause for human review of glance rows before creating item cards.

---

## Phase 3: Reference cards and expand batch record

### Overview

Create load-on-demand item cards and register batch 7 in the foundation expand-batches layer.

### Changes Required

#### 1. Foundation item cards

**Files**:
- `context/foundation/roadmap-references/items/F-14.md`
- `context/foundation/roadmap-references/items/S-40.md`
- `context/foundation/roadmap-references/items/S-41.md`
- `context/foundation/roadmap-references/items/S-42.md`
- `context/foundation/roadmap-references/items/S-43.md`

**Intent**: Each card follows F-07/S-39 skeleton: Outcome, Change ID, Linear/GitHub (`—` until Phase 4), PRD refs, Prerequisites, Parallel with, Blockers, Unknowns, Risk, Status `proposed`, and Source / Lineage. Lift acceptance criteria from `expand-refinement-summary.md`, guardrails from `parked-comparison.md`, and implementation feasibility from `research.md`.

**Contract**: S-42 card includes `## Expand merge scope` noting S-30 phase 2. S-43 card notes S-28 phase 2 absorption + S-39/S-34 constraints. S-41 card lists rail enum. Every card links the change-folder research, refinement, and parked-comparison sources so future `/10x-plan` runs do not re-derive lineage.

#### 2. Item index

**File**: `context/foundation/roadmap-references/README.md`

**Intent**: Extend item index table with F-14 and S-40–S-43.

**Contract**: Status "see glance"; link pattern `items/F-14.md`, etc.

#### 3. Expand batch archive

**Files**:
- `context/foundation/roadmap-references/expand-batches/batch-7-ux-ui-story-chapter.md` (copy from change folder)
- `context/foundation/roadmap-references/expand-batches/README.md`

**Intent**: Prepend batch 7 evaluator summary (scores, promote stance, recommended `/10x-plan` order) following batch 6 unpark review format.

**Contract**: Header notes commit date and "synced to roadmap" once Phase 2 lands.

#### 4. Change folder status

**File**: `context/changes/roadmap-ux-ui-story-expand/change.md`

**Intent**: Set `status: planned`, `updated: 2026-06-26`.

**Contract**: Notes reference `plan.md` and foundation batch path.

### Success Criteria

#### Automated Verification

- All five item card files exist
- `expand-batches/batch-7-ux-ui-story-chapter.md` exists
- `README.md` item index lists F-14 and S-40–S-43
- `change.md` status is `planned`

#### Manual Verification

- Each card Risk section cites implementation risks (scope creep, duplicate substrate, gate regressions)
- Each card has Source / Lineage links to research, refinement, and parked-comparison docs
- No duplicate Outcome prose copied into `roadmap.md` glance rows
- Batch 7 README entry matches accepted proposals

---

## Phase 4: External tracker preparation (on user accept)

### Overview

After human accepts the roadmap patch, create Linear `FLO-*` and GitHub `#*` pairs for F-14 and S-40–S-43. Skip only if user explicitly opts out for F-14 doc-only foundation (default: create pairs for all five).

### Changes Required

#### 1. Duplicate check

**Intent**: Before any create, grep `roadmap.md` and Linear for existing IDs tied to the five change IDs (L-01).

**Contract**: Zero duplicates; abort create if collision found.

#### 2. Issue pair creation

**Intent**: One Linear + one GitHub issue per row; titles match Outcome-first pattern from existing slices.

**Contract**: Update glance table Linear/GitHub columns and item cards with issued URLs.

#### 3. Post-create verification

**Intent**: Run L-03 verification after bulk create — confirm canonical pairs open, no attachment duplication.

**Contract**: Document issued IDs in `change.md` Notes.

### Success Criteria

#### Automated Verification

- Each accepted row has exactly one Linear URL and one GitHub URL in glance table (or documented opt-out for F-14 if user chose)

#### Manual Verification

- Linear issue bodies include Change ID, Prerequisites, and link to item card
- No duplicate GitHub attachments on canceled/duplicate issues

**Implementation Note**: This phase runs only after explicit user accept of Phase 2 glance rows. Default implementation may stop at Phase 3 if user wants roadmap-only commit first.

---

## Phase 5: Downstream handoff

### Overview

Close the meta-change and point to the first product slice plan.

### Changes Required

#### 1. Handoff note

**File**: `context/changes/roadmap-ux-ui-story-expand/change.md`

**Intent**: Add handoff: `/10x-plan product-voice-contract` then `/10x-new home-ia-reset` when F-14 is planned.

**Contract**: Clear STOP between meta-change and child implementation changes.

#### 2. Optional archive prep

**Intent**: Do not archive until user confirms roadmap commit merged; note that `/10x-archive roadmap-ux-ui-story-expand` runs after PR merge.

**Contract**: Change folder remains source for parked-comparison and research lineage.

### Success Criteria

#### Automated Verification

- Handoff commands documented in `change.md`

#### Manual Verification

- User knows first visible product work starts at F-14, not S-40
- Stream R visible in roadmap matches intended craft narrative

---

## Testing Strategy

### Unit Tests

- Not applicable — documentation-only change.

### Integration Tests

- Not applicable.

### Manual Testing Steps

1. Open `roadmap.md` — confirm five new rows, Stream R, updated recommended next.
2. Open decision audit — confirm every old PRD/roadmap "not doing now" decision has a `keep`, `clarify`, `absorb/reframe`, or `unpark later` outcome.
3. Open each new item card — confirm prerequisites, merge notes, source lineage, and parked guardrails.
4. Cross-check `parked-comparison.md` — merge relationships (S-30, S-28, S-39, P-104) are explicit.
5. Confirm zero diffs under `src/`, `prisma/`, `e2e/`.
6. If Phase 4 ran — verify Linear/GitHub pairs match glance table (L-03).

## Performance Considerations

None — markdown-only edits.

## Migration Notes

Existing shipped slices (S-28, S-30) remain `done`. New rows reference their phase-2 relationships without reopening archived implementation folders. Historical expand batches unchanged except new batch 7 entry.

## References

- Research: `context/changes/roadmap-ux-ui-story-expand/research.md`
- Expand batch: `context/changes/roadmap-ux-ui-story-expand/batch-7-ux-ui-story-chapter.md`
- Refinement: `context/changes/roadmap-ux-ui-story-expand/expand-refinement-summary.md`
- Parked comparison: `context/changes/roadmap-ux-ui-story-expand/parked-comparison.md`
- Roadmap index: `context/foundation/roadmap.md`
- PRD v3 horizon / non-goals: `context/foundation/prd.md`, `context/foundation/roadmap-references/prd-v3-horizon.md`
- Parked/future decisions: `context/foundation/roadmap-references/parked.md`, `context/foundation/roadmap-references/future-ideas.md`
- Item card patterns: `context/foundation/roadmap-references/items/F-07.md`, `items/S-39.md`
- Lessons L-01–L-03: `context/foundation/lessons.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Freeze proposal specifications

#### Automated

- [x] 1.1 Frozen stance section exists in expand-refinement-summary.md
- [x] 1.2 All five change IDs documented with promote stance
- [x] 1.3 Decision-audit table records keep/clarify/absorb outcomes for old PRD/roadmap decisions

#### Manual

- [ ] 1.4 Human confirms S-42/S-43 relationship, rail guardrails, and decision-audit outcomes before roadmap patch

### Phase 2: Patch roadmap index

#### Automated

- [x] 2.1 roadmap.md contains F-14 and S-40–S-43 glance rows
- [x] 2.2 Stream R row present in roadmap.md
- [x] 2.3 Recommended next points to F-14 product-voice-contract
- [x] 2.4 Scope merges table includes batch 7 rows
- [x] 2.5 Decision-audit follow-through applied or marked no PRD text change

#### Manual

- [ ] 2.6 Human reviews glance Outcome cells, prerequisites, and PRD/roadmap decision outcomes

### Phase 3: Reference cards and expand batch record

#### Automated

- [x] 3.1 Item cards F-14.md and S-40–S-43.md exist
- [x] 3.2 expand-batches/batch-7-ux-ui-story-chapter.md exists
- [x] 3.3 roadmap-references/README.md item index updated
- [x] 3.4 change.md status set to planned
- [x] 3.5 Item cards include Source / Lineage links to research, refinement, and parked-comparison docs

#### Manual

- [ ] 3.6 Each item card Risk section cites implementation risks

### Phase 4: External tracker preparation (on user accept)

#### Automated

- [x] 4.1 L-01 duplicate check completed before issue create — F-08/F-09–F-13 tracker collisions avoided by choosing F-14
- [x] 4.2 Glance table Linear/GitHub columns populated for accepted rows

#### Manual

- [x] 4.3 L-03 verification after bulk issue create

### Phase 5: Downstream handoff

#### Automated

- [x] 5.1 change.md documents /10x-plan product-voice-contract handoff

#### Manual

- [x] 5.2 User confirms meta-change complete and picks F-14 as next slice
