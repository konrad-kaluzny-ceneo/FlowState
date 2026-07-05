# Expand refinement summary — UX/UI story chapter

Date: 2026-06-26  
Change: `roadmap-ux-ui-story-expand`  
Source: `context/changes/roadmap-ux-ui-story-expand/batch-7-ux-ui-story-chapter.md`

## Goal

Prepare roadmap additions for the next FlowState chapter after PRD v3 and quality hardening:

- make the app purpose obvious on entry
- improve UX hierarchy and desktop layout
- introduce mindful day memory
- make visuals motivating and stateful without generic AI/wellness style

No code implementation in this change. This change exists to write accepted roadmap rows and preserve planning context.

## Scoring model

Weighted total:

```text
(wedge_fit * 3)
+(user_value * 2)
+(feasibility * 2)
+(novelty * 1)
+(sequencing * 1)
--------------------------------
10
```

| Dimension | Weight | Meaning |
| --- | --- | --- |
| wedge_fit | 3 | Strengthens the "what do I do now?" suggestion + rationale mechanic |
| user_value | 2 | User-visible value in first session or daily use |
| feasibility | 2 | Can ship on current stack without scope creep into duplicate shipped slices |
| novelty | 1 | Not a duplicate of shipped S-13/S-28/S-30/etc. |
| sequencing | 1 | Clear dependencies and safe ordering |

Target after refinement: `>= 9.0`.

## Refined proposals

### F-14 candidate — Product Voice Contract

| Field | Value |
| --- | --- |
| P-ID | P-703 |
| Change ID | `product-voice-contract` |
| Score | **9.6** |
| Recommendation | promote |
| Type | foundation |

**Outcome:** Polish-first voice contract making the FlowState promise legible in the first session: "Spokojna odpowiedź na: co teraz?" Reusable copy zones for home header, suggestion, rationale, recap, empty states, and future UX/UI slices.

**Core deliverables:**
- `context/foundation/product-voice.md`
- promise, tone, preferred vocabulary, copy zones
- examples and non-examples for first-session surfaces
- acceptance checklist future slices must cite

**User-value acceptance:**
- A new user can answer "what does this app help me decide?" within 5 seconds.
- First suggestion has a calm rationale aligned with product voice.
- Recap uses closure language: done / remains / return-to.

**Example copy:**
- Header: `Spokojna odpowiedź na: co teraz?`
- Suggestion: `Najpierw dokończ: {task}. To najmniejszy krok, który odblokuje resztę.`
- Recap: `Zrobione: {done}. Zostało: {remaining}. Wróć spokojnie do: {next}.`

**Sequencing:** Do first. It de-risks `home-ia-reset`, `mindful-day-memory`, and rail copy.

---

### S-40 candidate — Home IA Reset

| Field | Value |
| --- | --- |
| P-ID | P-701 |
| Change ID | `home-ia-reset` |
| Score | **9.1** |
| Recommendation | promote |
| Type | vertical UX slice |

**Outcome:** Home becomes a calm decision screen. The first thing the user sees is "Co teraz?", one next-focus suggestion/rationale, and one dominant CTA. Task list is inventory; recap is collapsed context.

**Core deliverables:**
- `home-ia-spec.md`
- pure session-state derivation: idle / steering / active_work / break / returning
- module priority matrix: primary / secondary / hidden
- dashboard composition refactor driven by priority matrix
- Daily recap collapsed by default

**User-value acceptance:**
- >=80% pass a 5-second purpose test.
- Exactly one filled primary CTA above the fold in idle/returning states.
- Recap is not expanded on first paint.
- During active work, timer is hero and recap is hidden.

**Sequencing:** Soft dependency on F-14 for authoritative copy. Hard prerequisite for `desktop-calm-workbench`.

---

### S-41 candidate — Desktop Calm Workbench

| Field | Value |
| --- | --- |
| P-ID | P-702 |
| Change ID | `desktop-calm-workbench` |
| Score | **9.2** |
| Recommendation | promote |
| Type | vertical visual-ui slice |

**Outcome:** At desktop width, FlowState stops looking like a mobile column on a large screen. It becomes a three-zone calm workbench while keeping "Co teraz?" primary.

**Core deliverables:**
- responsive shell at `lg >= 1024px`
- centered `1120-1280px` workbench
- decision column ~60-65%
- task inventory zone
- context rail max 3 blocks
- below 1024px collapse to S-40 priority order

**User-value acceptance:**
- Desktop no longer uses a single `max-w-lg` column.
- Decision column remains visually primary.
- Rail has at most 3 blocks; decision column remains visually primary.
- Guest rail shows sign-in / activation content instead of empty persisted-data panels.

**Sequencing:** Phase 2 after `home-ia-reset`. Do not run independently.

---

### S-42 candidate — Mindful Day Memory

| Field | Value |
| --- | --- |
| P-ID | P-704 |
| Change ID | `mindful-day-memory` |
| Score | **9.3** |
| Recommendation | promote |
| Type | S-30 phase 2 / narrative data-insights slice |

**Outcome:** Replace raw daily recap log with a calm day memory: `Domknięte / Zostaje / Wróć tutaj`. It helps closure and return context.

**Core deliverables:**
- `format-day-memory.ts` pure formatter over existing recap builder
- refactor `daily-recap-panel.tsx`
- collapsed one-line summary on home
- expanded view has exactly three narrative sections
- no new tRPC/Prisma queries

**User-value acceptance:**
- On home load, user sees one calm collapsed line, not a log.
- `Wróć tutaj` names the last focused task after interruption.
- Expanded view is narrative, not `title · 45m · timestamp`.

**Sequencing:** After F-14. Placement should follow S-40/S-41 so it remains context, not primary surface.

---

### S-43 candidate — Stateful Illustration System

| Field | Value |
| --- | --- |
| P-ID | P-705 |
| Change ID | `stateful-illustration-system` |
| Score | **9.22** |
| Recommendation | promote |
| Type | visual-ui slice / S-28 phase 2 absorption |

**Outcome:** User recognizes app mode at a glance from state-bound Calm Garden illustration on desktop rail and home hero. It is a state cue, not decoration.

**State map:**
- idle
- energy_choice
- work
- break
- return
- closure

**Core deliverables:**
- Phase A: absorb deferred S-28 phase 2 overlay scrims
- Phase B: state-to-variant map
- render on desktop rail / home hero only
- never render on S-39 gate controls
- illustrations `aria-hidden`, text/status canonical
- <=200ms crossfade; reduced motion instant swap

**User-value acceptance:**
- First-time user can name current app mode from rail illustration alone.
- Each state has a distinct variant.
- No illustration appears on accept/override/start gate controls.
- Motion does not delay S-34 optimistic transition.

**Sequencing:** Can run in parallel with S-41 if rail slot is defined; prerequisites S-28, F-06, F-07, S-39 are done.

## Recommended roadmap order

1. F-14 `product-voice-contract`
2. S-40 `home-ia-reset`
3. S-41 `desktop-calm-workbench`
4. S-43 `stateful-illustration-system`
5. S-42 `mindful-day-memory`

## Suggested next skill flow

1. `/10x-research roadmap-ux-ui-story-expand`
2. `/10x-plan roadmap-ux-ui-story-expand`

Research should verify:
- exact roadmap patch locations and ID allocation
- whether S-42 should be a new S-row or S-30 phase detail
- whether S-43 should be a new S-row or S-28 phase detail
- issue creation strategy for foundation vs slices

## Roadmap write stance (frozen)

Date: 2026-06-26. Authoritative for `/10x-implement roadmap-ux-ui-story-expand` — do not re-litigate expand scores or promote/reject decisions. Merge notes: [`parked-comparison.md`](./parked-comparison.md).

### Commit order (canonical)

1. **F-14** `product-voice-contract` — foundation; `context/foundation/product-voice.md`
2. **S-40** `home-ia-reset` — home IA; soft dep F-14
3. **S-41** `desktop-calm-workbench` — hard dep S-40
4. **S-42** `mindful-day-memory` — S-30 phase 2; after F-14; best after S-40/S-41 placement
5. **S-43** `stateful-illustration-system` — absorbs S-28 phase 2; may parallel S-41 once rail slot exists

**S-42 before S-43:** recap remains context after IA is locked; rail illustration slot is defined before stateful variants ship.

### Promote stance (all five)

| ID | Change ID | Score | Stance |
| --- | --- | --- | --- |
| F-14 | `product-voice-contract` | 9.6 | promote — foundation first |
| S-40 | `home-ia-reset` | 9.1 | promote — hard unblock for S-41 |
| S-41 | `desktop-calm-workbench` | 9.2 | promote — phase 2 after S-40 only |
| S-42 | `mindful-day-memory` | 9.3 | promote — S-30 phase 2 / formatter only |
| S-43 | `stateful-illustration-system` | 9.22 | promote — S-28 phase 2 absorption |

### Purpose test (S-40 acceptance)

Maintainer script: open home idle state, ask "what does this app help me decide?" within 5 seconds; pass if answer matches "what to do next / co teraz." Automate proxy oracles only: exactly one filled primary CTA above fold in idle/returning; recap collapsed on first paint; timer hero during active work. Do not add product telemetry for this check.

### S-41 rail block enum (max 3)

**Authenticated:** (1) mode/illustration slot, (2) collapsed day-memory line, (3) standing/focus-hours text summary from S-27.

**Guest:** (1) sign-in value prop, (2) guest activation/merge hint, (3) calm empty-state guidance.

### S-43 state map

Bind six variants to S-40 home-session-state: `idle`, `energy_choice` (steering), `work` (active_work), `break`, `return` (returning), `closure` (session closure beat). Render on home hero and desktop rail only; never on S-39 gate controls; `aria-hidden`; ≤200ms crossfade; instant under `prefers-reduced-motion`; must not delay S-34 optimistic path.

### `main_goal` frontmatter

Leave `main_goal: quality` until F-14 ships; Stream R carries UX/UI story chapter identity without premature relabel.

## PRD / roadmap decision audit

| Decision source | Current stance | Audit action | Required follow-through |
| --- | --- | --- | --- |
| PRD v3 Non-Goals: browser-only/no native mobile push | Still locked | keep | S-41 is desktop web layout only; mobile means responsive collapse, not platform scope |
| `roadmap-references/parked.md`: session reconnect calm banner P-104 | Still parked | keep parked | Do not hide it in S-40/S-42; leave a separate future recovery candidate |
| `items/S-30.md`: light timing recap | Shipped substrate | absorb as phase 2 | S-42 explicitly extends presentation/formatter only; no new data pipeline |
| `items/S-28.md`: Calm Garden phase 2 overlays | Deferred scope | absorb/reframe | S-43 absorbs visual follow-up while preserving S-39 gate exclusions |
| `roadmap.md` frontmatter `main_goal: quality` | Current chapter label | keep for now | Stream R carries UX/UI story until F-14 ships |

**PRD text change:** none for this meta-change. MVP-era scope notes on dashboards, charts, stats, AI, and streaks are superseded — removed from Stream R item cards and expand docs.
