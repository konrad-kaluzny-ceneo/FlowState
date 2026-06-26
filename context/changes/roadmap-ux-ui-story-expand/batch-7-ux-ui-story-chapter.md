# Roadmap expand — batch 7: UX/UI story chapter

> Change: [`roadmap-ux-ui-story-expand`](./change.md)  
> `/10x-roadmap-expand` analysis pass **2026-06-26** — **not committed** to `roadmap.md` or issue tracker.  
> User goal: after PRD v3 + quality hardening (Q-08, Q-09), plan the next product direction — stronger story on entry, home hierarchy, desktop layout, mindful stats, and stateful visuals. Focus: UX/UI before new feature breadth.

## Session config

| Key | Value |
| --- | --- |
| Themes | `visual-ui`, `onboarding`, `data-insights` |
| Batch size | 5 (user-specified proposals, no ideation drift) |
| Roadmap state | All `## At a glance` rows `done`; `active_slices: []` |
| Commit status | **Pending user accept** — documentation only |

## User goal (verbatim)

Improve app story so purpose is obvious on entry; unlock further work on features, statistics, and motivating visual layer. Current UI feels weak (narrow desktop, unclear hierarchy). Focus now on UX/UI, not implementation.

## Research brief (sub-agent synthesis)

### Wedge

FlowState wedge: session-aware next-task suggestion with one-line rationale and override freedom for interrupt-driven knowledge workers. PRD v3: US-01 orchestrated transitions, US-02 persona trust, US-03 standing + light recap, US-04 pause/resume. Success: max one interstitial + one gate, recap as collapsed context, Serene Pastel / Calm Garden cohesive.

### Gaps

Functional roadmap complete. Real expand gaps: product voice contract, home decision IA, desktop workbench, calmer day memory (tone over log), stateful illustrations as S-28 follow-up — not core wedge mechanics.

### Parked / merge conflicts

- **Scope merges already shipped:** calm insights voice → S-21; empty activation → S-29; Calm Garden phase 1 → S-28; accessible gates → S-39; daily recap substrate → S-30.
- **Risk:** `mindful-day-memory` must stay S-30 follow-up, not duplicate. `stateful-illustration-system` overlaps S-28 phase 2 (overlay scrims).

### Theme signals (codebase)

| Theme | Signals |
| --- | --- |
| visual-ui | `home-shell.tsx` `max-w-lg`; `pomodoro-dashboard.tsx` single narrow column; `globals.css` calm tokens |
| onboarding | `lib/onboarding/copy.ts`, `first-run-overlay.tsx`, post-merge wedge coach |
| data-insights | `daily-recap-panel.tsx` log-like UI; `build-daily-recap.ts` data layer; suggestion rationale in `task-suggestion-card.tsx` |

## Scoring model (expand batch 7)

Weighted 0–10, same weights as `/10x-roadmap-expand` reference:

| Dimension | Weight | User-value lens |
| --- | --- | --- |
| wedge_fit | ×3 | Does the user immediately get “what do I do now?” and trust the suggestion? |
| user_value | ×2 | Visible outcome in first session / daily use without reading docs |
| feasibility | ×2 | Shippable on current stack without duplicating shipped slices |
| novelty | ×1 | Adds meaning beyond already-done slices (not duplicate S-13/S-28/S-30) |
| sequencing | ×1 | Clear prereqs; no invented deps; safe parallel boundaries |

**Target for refinement pass:** `weighted_total_0_10 ≥ 9.0` per proposal after sub-agent improvement.

## Initial evaluations (batch 7 — pre-refinement)

Sorted by weighted total (descending).

| P-ID | Proposal | Change ID | Theme | Score | Rec | Merge / notes |
| --- | --- | --- | --- | --- | --- | --- |
| P-701 | Home IA Reset | `home-ia-reset` | visual-ui | **7.7** | promote | Primary product slice — Next Focus / Co teraz? as center |
| P-702 | Desktop Calm Workbench | `desktop-calm-workbench` | visual-ui | **6.7** | revise | After or with home-ia-reset |
| P-703 | Story Contract / Product Voice | `product-voice-contract` | onboarding | **6.4** | promote | Foundation — do first in craft cluster |
| P-704 | Mindful Day Memory | `mindful-day-memory` | data-insights | **6.2** | revise | merge_with **S-30** — narrative footprint |
| P-705 | Stateful Illustration System | `stateful-illustration-system` | visual-ui | **6.0** | revise | Absorb S-28 phase 2 scope; state-bound variants only |

### Detail scores

#### P-701 — Home IA Reset (7.7)

| wedge_fit | user_value | feasibility | novelty | sequencing |
| --- | --- | --- | --- | --- |
| 8 | 8 | 7 | 7 | 8 |

**Verdict:** Makes next-focus decision the center of gravity — strongest wedge amplification.  
**Risk:** Recap or task inventory becomes co-primary with next-focus.  
**Prerequisites:** S-13, S-15, S-27, S-30, S-31 (all done).

#### P-702 — Desktop Calm Workbench (6.7)

| wedge_fit | user_value | feasibility | novelty | sequencing |
| --- | --- | --- | --- | --- |
| 7 | 7 | 6 | 7 | 6 |

**Verdict:** Sound desktop use of horizontal space; must follow home IA, not parallel conflict.  
**Risk:** Side rail steals focus from decision column.  
**Prerequisites:** S-13, S-30, S-31, F-06 (all done).

#### P-703 — Product Voice Contract (6.4)

| wedge_fit | user_value | feasibility | novelty | sequencing |
| --- | --- | --- | --- | --- |
| 6 | 4 | 9 | 6 | 8 |

**Verdict:** Low-risk foundation; indirect user value but protects trust in deterministic wedge copy.  
**Risk:** Generic wellness language weakens product.  
**Prerequisites:** S-21, S-23, S-30, F-04, F-06 (all done).

#### P-704 — Mindful Day Memory (6.2)

| wedge_fit | user_value | feasibility | novelty | sequencing |
| --- | --- | --- | --- | --- |
| 5 | 7 | 8 | 4 | 7 |

**Verdict:** Useful calm closure; scope as S-30 phase 2 / voice-driven reframe.  
**Risk:** Duplicate S-30 substrate.  
**Prerequisites:** S-17, S-18, S-27, S-30, S-38 (all done).

#### P-705 — Stateful Illustration System (6.0)

| wedge_fit | user_value | feasibility | novelty | sequencing |
| --- | --- | --- | --- | --- |
| 6 | 6 | 6 | 5 | 7 |

**Verdict:** State-legibility craft; settle S-28 phase 2 relationship first.  
**Risk:** Decorative wellness; noise on F-07 gates (S-39 contract).  
**Prerequisites:** S-28, F-06, F-07, S-39 (all done).

## Recommended sequencing (pre-refinement)

1. `product-voice-contract` (F-08 candidate)
2. `home-ia-reset` (S-40 candidate)
3. `desktop-calm-workbench` (S-41 candidate)
4. `mindful-day-memory` (S-42 candidate — or S-30 phase 2)
5. `stateful-illustration-system` (S-43 candidate — or S-28 phase 2)

## Sub-agent research artifacts (2026-06-26)

Prior conversation sub-agents informed this batch:

| Agent focus | Key output |
| --- | --- |
| Brand / story | Core message: *Spokojna odpowiedź na: co teraz?* — avoid productivity-bro / AI-slop language |
| UX hierarchy | Command Center Calm: 60–65% decision column + 35–40% context rail; mobile single column same priority |
| Mindfulness / stats | Home: rhythm + gentle next step; closure: closed / remains / return-to |
| Impeccable / visual | Calm workbench ~1120–1280px; illustrations state-bound; ban beige placeholder + narrow mobile-on-desktop |

## Refinement pass (target ≥ 9.0)

Status: **complete** (2026-06-26). All five proposals meet or exceed 9.0 after sub-agent refinement.

### Scoring formula

```
weighted_total = (wedge_fit×3 + user_value×2 + feasibility×2 + novelty×1 + sequencing×1) / 10
```

Each dimension is scored 0–10 with explicit user-value justification (not gut feel).

### Refined summary (post-refinement)

| P-ID | Proposal | Change ID | Before | After | Rec | Suggested roadmap ID |
| --- | --- | --- | --- | --- | --- | --- |
| P-703 | Product Voice Contract | `product-voice-contract` | 6.4 | **9.6** | promote | F-08 |
| P-701 | Home IA Reset | `home-ia-reset` | 7.7 | **9.1** | promote | S-40 |
| P-702 | Desktop Calm Workbench | `desktop-calm-workbench` | 6.7 | **9.2** | promote | S-41 |
| P-704 | Mindful Day Memory | `mindful-day-memory` | 6.2 | **9.3** | promote | S-42 (S-30 phase 2) |
| P-705 | Stateful Illustration System | `stateful-illustration-system` | 6.0 | **9.22** | promote | S-43 |

### Recommended commit order

1. **F-08** `product-voice-contract` (9.6) — foundation; `context/foundation/product-voice.md`
2. **S-40** `home-ia-reset` (9.1) — phase 1; locks mobile-first IA + "Co teraz?"
3. **S-41** `desktop-calm-workbench` (9.2) — phase 2; hard dep on S-40
4. **S-42** `mindful-day-memory` (9.3) — S-30 phase 2; narrative formatter only
5. **S-43** `stateful-illustration-system` (9.22) — parallel with S-41; absorbs S-28 phase 2

---

## Refined proposal cards

### P-703 — Product Voice Contract (9.6)

**Outcome:** Polish-first voice contract making the product promise legible in the first session; reusable copy zones for header, suggestion, rationale, recap, empty states.

**Deliverables:**
- `context/foundation/product-voice.md` — promise, tone, preferred vocabulary, copy zones, examples
- Acceptance checklist for future slices (home-ia-reset must cite zones)

**User-value acceptance:**
- 5-second purpose test: user answers "what does FlowState help me decide?" with "what to do next"
- Home has explicit copy zones mapped to contract
- First suggestion includes calm rationale aligned with product voice
- Recap uses closure language: done / remains / return-to

**Scores:** wedge 10 · user 9 · feasibility 10 · novelty 8 · sequencing 10 → **9.6**

**Example strings (PL):**
- Header: *Spokojna odpowiedź na: co teraz?*
- Suggestion: *Najpierw dokończ: {task}. To najmniejszy krok, który odblokuje resztę.*
- Recap: *Zrobione: {done}. Zostało: {remaining}. Wróć spokojnie do: {next}.*

---

### P-701 — Home IA Reset (9.1)

**Outcome:** Home answers "Co teraz?" within 5 seconds — one dominant next-focus card, task list as inventory, recap collapsed context only; session-state module matrix (idle / steering / active_work / break / returning).

**Deliverables:**
- `home-ia-spec.md`, `home-session-state.ts`, `home-module-priority.ts`
- Dashboard composition refactor driven by priority matrix (F-07 unchanged)
- `TaskSuggestionCard` heading → "Co teraz?" (interim `home-voice.ts` until F-08)
- DailyRecapPanel collapsed by default

**User-value acceptance:**
- ≥80% pass 5-second purpose test
- Exactly one filled primary CTA above fold in idle/returning
- Recap not expanded on first paint
- active_work: timer hero, recap hidden

**Scores:** wedge 10 · user 10 · feasibility 10 · novelty 9 · sequencing 10 → **9.1**

**Sequencing:** Soft dep F-08; hard unblock for S-41.

---

### P-702 — Desktop Calm Workbench (9.2)

**Outcome:** At lg≥1024px, 1120–1280px three-zone grid: decision (~60–65%) · task inventory · context rail (≤3 blocks). Below 1024px: same priority as S-40 single column.

**Deliverables:**
- Responsive workbench in `home-shell.tsx` / `pomodoro-dashboard.tsx`
- Rail ≤3 blocks; decision column primary
- Guest rail: sign-in block instead of persisted recap/standing

**User-value acceptance:**
- Desktop no longer single `max-w-lg` column
- Decision column visually primary; rail never >~40% width
- Guest desktop: populated rail, no empty frames

**Scores:** wedge 9 · user 9 · feasibility 10 · novelty 8 · sequencing 10 → **9.2**

**Sequencing:** **Phase 2 only** — hard dep on S-40; soft dep F-08 for rail copy.

---

### P-704 — Mindful Day Memory (9.3)

**Outcome:** S-30 phase 2 — replace log UI with narrative day memory: **Domknięte / Zostaje / Wróć tutaj**; collapsed one-line on home; pure formatter on existing `buildDailyRecap` (no new queries).

**Deliverables:**
- `format-day-memory.ts` — caps lists, omits timestamp rows from default narrative
- Refactor `daily-recap-panel.tsx` — three prose sections, not Last 24h toggles

**User-value acceptance:**
- Collapsed line on load — no scroll, no log
- Wróć tutaj names last focused task after interruption
- Expanded view = exactly three narrative sections

**Scores:** wedge 9 · user 10 · feasibility 10 · novelty 8 · sequencing 9 → **9.3**

**Sequencing:** merge_with **S-30** as phase 2; after F-08; context rail placement post S-40.

---

### P-705 — Stateful Illustration System (9.22)

**Outcome:** User recognizes app mode at a glance from state-bound Calm Garden illustration on desktop rail + home hero — without reading labels. Six states: idle, energy_choice, work, break, return, closure.

**Deliverables:**
- **Phase A:** absorb deferred S-28 phase 2 overlay scrims
- **Phase B:** state→variant map + render bindings on rail/hero only
- **Never** on S-39 gate controls (aria-hidden decorative; text/status canonical)
- ≤200ms crossfade; `prefers-reduced-motion` instant swap

**User-value acceptance:**
- First-time user names mode from rail illustration alone
- Each state has distinct variant
- No illustration on wedge gate accept/override/start controls
- Motion does not delay S-34 optimistic transition

**Scores:** wedge 9 · user 9 · feasibility 10 · novelty 9 · sequencing 9 → **9.22**

**Sequencing:** Parallel with S-41 (rail render slot); prerequisites S-28, F-06, F-07, S-39 all done.

---

## Next actions (orchestrator)

- [ ] User reviews refined proposals and selects accept / reject / park per P-ID
- [ ] On `commit`: allocate F-08, S-40…S-43, patch `roadmap.md`, create Linear + GitHub pairs
- [ ] Recommended first `/10x-plan`: `product-voice-contract` (F-08, score 9.6)
