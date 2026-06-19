---
project: FlowState
version: 3
status: draft
created: 2026-05-26
updated: 2026-06-19
structure: split
active_slices: [revisit-user-choices]
prd_version: 3
main_goal: quality
top_blocker: flow-coherence (S-21 / S-34 unblocked)
---

# Roadmap: FlowState

> Derived from `context/foundation/prd.md` (v3). MVP shipped 2026-06-07; PRD v3 contracts post-MVP deepening under `main_goal: quality`.
> **Detail on demand:** slice/foundation Outcome, Unknowns, Risk, expand batches, Done log → [`roadmap-references/`](roadmap-references/README.md). **PRD v3 → slice map:** [`roadmap-references/prd-v3-horizon.md`](roadmap-references/prd-v3-horizon.md). This file is the **index only** (~165 lines).
> **Issue tracking:** Linear team `FLO` + GitHub `konrad-kaluzny-ceneo/FlowState`; IDs in glance table.
> **No Linear ↔ GitHub auto-sync** — this file is the pairing table; update both on ship.

## Vision recap

FlowState is a single-user web app for interrupt-driven knowledge work: mindful Pomodoro cycles linked to tasks, with session-aware next-task suggestions and one-line rationale; user always overrides. **MVP shipped 2026-06-07** (PRD v1). PRD v2 deepened wedge, context recovery, narrative, and well-being craft. **PRD v3 (2026-06-13)** contracts orchestrated transitions (US-01), persona trust (US-02), daily planning + light recap (US-03), and pause/resume (US-04) — continuous iteration, no fixed ship deadline.

**Wedge:** the system observes session state and proposes the *next* task with rationale while preserving override freedom. Every decision below protects that wedge.

## North star

**S-01: First Pomodoro cycle on an existing task** — done (2026-06-06). Validation milestone; iteration now deepens craft and flow coherence.

## At a glance

| ID | Change ID | Linear | GitHub | Outcome (user can …) | Prerequisites | PRD refs | Status |
| ---- | --- | --- | --- | --- | --- | --- | --- |
| F-01 | session-domain-model | [FLO-6](https://linear.app/flowstate-10xdev/issue/FLO-6) | [#5](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/5) | (foundation) Session domain in Prisma + tRPC | — | preserved | done |
| F-02 | e2e-test-infra | [FLO-14](https://linear.app/flowstate-10xdev/issue/FLO-14) | [#6](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/6) | (foundation) Playwright + test auth | — | guardrails | done |
| S-01 | first-pomodoro-cycle | [FLO-8](https://linear.app/flowstate-10xdev/issue/FLO-8) | [#7](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/7) | one work cycle + audio + refresh recovery | F-01, F-02 | preserved | done |
| S-02 | full-session-with-breaks | [FLO-10](https://linear.app/flowstate-10xdev/issue/FLO-10) | [#10](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/10) | multi-cycle session + breaks + 4h timeout | S-01 | preserved | done |
| S-03 | mid-cycle-completion-prompt | [FLO-11](https://linear.app/flowstate-10xdev/issue/FLO-11) | [#11](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/11) | mark done mid-cycle → next task or break | S-01 | preserved | done |
| S-04 | task-attributes-for-scoring | [FLO-9](https://linear.app/flowstate-10xdev/issue/FLO-9) | [#8](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/8) | work type + weight on tasks | F-01, F-02 | preserved | done |
| S-05 | end-of-cycle-checkin | [FLO-12](https://linear.app/flowstate-10xdev/issue/FLO-12) | [#12](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/12) | Focused/Steady/Fading at cycle end | S-01 | preserved | done |
| S-06 | adaptive-task-suggestion | [FLO-13](https://linear.app/flowstate-10xdev/issue/FLO-13) | [#13](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/13) | suggested next task + rationale + override | S-04, S-05 | preserved | done |
| S-07 | account-recovery-flow | [FLO-7](https://linear.app/flowstate-10xdev/issue/FLO-7) | [#9](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/9) | password reset without data loss | F-02 | preserved | done |
| S-08 | guest-local-storage-merge | [FLO-21](https://linear.app/flowstate-10xdev/issue/FLO-21) | [#30](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/30) | guest trial → merge on sign-in | S-01, F-02 | preserved | done |
| S-09 | optimistic-task-mutations | [FLO-24](https://linear.app/flowstate-10xdev/issue/FLO-24) | [#35](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/35) | optimistic task CRUD when logged in | S-01, F-02 | guardrails | done |
| S-10 | google-oauth-provider | [FLO-20](https://linear.app/flowstate-10xdev/issue/FLO-20) | [#20](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/20) | Google sign-in | F-02 | preserved | done |
| F-03 | align-prisma-config | [FLO-22](https://linear.app/flowstate-10xdev/issue/FLO-22) | [#33](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/33) | (foundation) Prisma 7 config hygiene | — | — | proposed |
| F-04 | impeccable-design-foundation | [FLO-25](https://linear.app/flowstate-10xdev/issue/FLO-25) | [#36](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/36) | (foundation) DESIGN.md | S-09 | preserved | done |
| S-11 | first-run-wedge-onboarding | [FLO-26](https://linear.app/flowstate-10xdev/issue/FLO-26) | [#37](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/37) | first-run teaches check-in → suggestion wedge | S-06, S-08 | preserved | done |
| S-12 | wedge-overlay-visual-polish | [FLO-28](https://linear.app/flowstate-10xdev/issue/FLO-28) | [#38](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/38) | cohesive check-in/suggestion overlays | S-09, F-04 | preserved | done |
| S-13 | focus-home-visual-craft | [FLO-29](https://linear.app/flowstate-10xdev/issue/FLO-29) | [#39](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/39) | branded home + task list clarity | S-09, F-04 | preserved | done |
| S-14 | auth-merge-first-impression | [FLO-27](https://linear.app/flowstate-10xdev/issue/FLO-27) | [#40](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/40) | auth value prop + merge success moment | S-08 | preserved | done |
| S-15 | session-kickoff-suggestion | [FLO-30](https://linear.app/flowstate-10xdev/issue/FLO-30) | [#41](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/41) | idle kickoff suggestion + duration presets | S-06 | preserved | done |
| S-16 | mindful-session-wind-down | [FLO-31](https://linear.app/flowstate-10xdev/issue/FLO-31) | [#42](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/42) | optional end-session nudge when Fading | S-05, S-06 | preserved | done |
| S-17 | session-narrative-summary | [FLO-32](https://linear.app/flowstate-10xdev/issue/FLO-32) | [#43](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/43) | in-flow narrative + closure + 8h handoff | S-02, S-05, S-18 | modified guest | done |
| S-18 | task-resume-context-note | [FLO-33](https://linear.app/flowstate-10xdev/issue/FLO-33) | [#44](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/44) | resume note at interrupt / mid-cycle switch | S-06 | preserved | done |
| S-19 | suggestion-override-acknowledgement | [FLO-34](https://linear.app/flowstate-10xdev/issue/FLO-34) | [#45](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/45) | validating override acknowledgement | S-06 | US-01 | done |
| S-20 | persistent-quiet-cycle-audio | [FLO-35](https://linear.app/flowstate-10xdev/issue/FLO-35) | [#46](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/46) | mute/soften chime + optional title pulse | S-01 | preserved | done |
| S-21 | mindful-transition-copy | [FLO-36](https://linear.app/flowstate-10xdev/issue/FLO-36) | [#47](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/47) | skippable break/re-entry copy by energy | F-07, S-02, S-05, S-12 | US-01 | proposed |
| S-22 | background-tab-return-catchup | [FLO-37](https://linear.app/flowstate-10xdev/issue/FLO-37) | [#48](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/48) | catch-up when tab was backgrounded at cycle end | S-01, S-05, S-06 | preserved | done |
| S-23 | suggestion-rationale-expander | [FLO-38](https://linear.app/flowstate-10xdev/issue/FLO-38) | [#49](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/49) | "Why this?" factor breakdown | S-06 | preserved | done |
| S-24 | cycle-pause-resume | [FLO-39](https://linear.app/flowstate-10xdev/issue/FLO-39) | [#50](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/50) | pause/resume; suppress wedge gates while PAUSED; ~30 min cap → calm session end | S-01, S-02 | **US-04** | done |
| B-01 | fix-cycle-audio-toggle | [FLO-53](https://linear.app/flowstate-10xdev/issue/FLO-53) | [#72](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/72) | **(bug)** audio toggle responds + persists | S-20 | preserved | done |
| B-02 | fix-task-title-multiline-edit | [FLO-54](https://linear.app/flowstate-10xdev/issue/FLO-54) | [#73](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/73) | **(bug)** multiline task title edit | — | preserved | done |
| B-03 | fix-cycle-start-interrupt-optimistic | [FLO-55](https://linear.app/flowstate-10xdev/issue/FLO-55) | [#74](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/74) | **(bug)** Start/Interrupt within 200ms | S-09 | guardrails | done |
| B-04 | fix-cycle-complete-flash-after-checkin | [FLO-56](https://linear.app/flowstate-10xdev/issue/FLO-56) | [#75](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/75) | **(bug)** no Cycle Complete flash after check-in | S-05, S-06 | preserved | done |
| B-05 | fix-closure-kickoff-mutex | [FLO-67](https://linear.app/flowstate-10xdev/issue/FLO-67) | [#110](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/110) | **(bug)** closure without kickoff/check-in stacking | — | **US-01** | done |
| B-06 | fix-timeout-closure-on-load | [FLO-68](https://linear.app/flowstate-10xdev/issue/FLO-68) | [#111](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/111) | **(bug)** timeout closure on page load, not cycle start | B-05 | US-01 | done |
| B-07 | fix-wind-down-cycle-threshold | [FLO-69](https://linear.app/flowstate-10xdev/issue/FLO-69) | [#112](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/112) | **(bug)** wind-down at 3rd completed work cycle | — | US-01 | done |
| B-08 | fix-graceful-session-end-while-running | [FLO-70](https://linear.app/flowstate-10xdev/issue/FLO-70) | [#113](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/113) | **(bug)** calm end session while timer running | F-07; S-24 full | US-04 | proposed |
| F-05 | eisenhower-effort-task-attributes | [FLO-57](https://linear.app/flowstate-10xdev/issue/FLO-57) | [#78](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/78) | (foundation) scorer v2 substrate | S-04, S-06 | modified | done |
| S-25 | pre-suggestion-readiness | [FLO-58](https://linear.app/flowstate-10xdev/issue/FLO-58) | [#79](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/79) | readiness gate before suggestion | S-05, S-06, S-15 | preserved | done |
| S-26 | task-manual-priority-order | [FLO-59](https://linear.app/flowstate-10xdev/issue/FLO-59) | [#81](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/81) | drag-reorder tie-breaker | S-04, S-06, S-09 | preserved | done |
| S-27 | daily-standing-tasks-capacity-plan | [FLO-60](https://linear.app/flowstate-10xdev/issue/FLO-60) | [#80](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/80) | daily standing + focus-hours budget | F-05, S-06, S-15 | **US-03** | done |
| F-06 | serene-pastel-rebrand | [FLO-62](https://linear.app/flowstate-10xdev/issue/FLO-62) | [#97](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/97) | (foundation) Serene Pastel tokens | F-04, S-13 | Secondary | done |
| S-28 | wellness-illustration-foundation | [FLO-63](https://linear.app/flowstate-10xdev/issue/FLO-63) | [#98](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/98) | Calm Garden illustrations + overlay phase 2 | F-06 | Secondary | ready |
| S-29 | task-create-persona-presets | [FLO-64](https://linear.app/flowstate-10xdev/issue/FLO-64) | [#105](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/105) | persona presets + Custom expand | F-05, F-06, S-13 | **US-02** | done |
| S-30 | daily-work-timing-recap | [FLO-65](https://linear.app/flowstate-10xdev/issue/FLO-65) | [#106](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/106) | light timing recap; dismissible footprint | S-02, S-18 | **US-03** | ready |
| S-31 | work-focus-shell | [FLO-66](https://linear.app/flowstate-10xdev/issue/FLO-66) | [#107](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/107) | WORK cycle focus shell | S-13, F-06 | Secondary | ready |
| F-07 | wedge-transition-conductor | [FLO-71](https://linear.app/flowstate-10xdev/issue/FLO-71) | [#114](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/114) | (foundation) max 1 interstitial + 1 gate; return handoff before kickoff | B-05, B-06, S-12, S-19 | **US-01** | done |
| S-32 | create-wedge-trust-bridge | [FLO-72](https://linear.app/flowstate-10xdev/issue/FLO-72) | [#115](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/115) | first suggestion cites persona preset in rationale | S-36, F-05, S-06 | **US-02** | done |
| S-33 | break-restoration-atmosphere | — | — | home break atmosphere during breaks | F-06, S-13, F-07 | US-01 craft | proposed |
| S-34 | optimistic-wedge-transitions | [FLO-73](https://linear.app/flowstate-10xdev/issue/FLO-73) | [#116](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/116) | optimistic check-in → suggestion ≤200ms | F-07, S-06, S-09, S-25 | **US-01** | done |
| S-35 | wedge-transition-sync-recovery | [FLO-74](https://linear.app/flowstate-10xdev/issue/FLO-74) | [#117](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/117) | calm network-loss recovery on wedge gates | F-07, S-06, S-22 | **US-01** | proposed |
| S-36 | persona-presets-v2 | [FLO-75](https://linear.app/flowstate-10xdev/issue/FLO-75) | [#118](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/118) | 8 personas + row labels + visible effort | S-29, F-05 | **US-02** | done |
| S-37 | revisit-user-choices | — | — | see and change prior choices (MVP: out-of-tab notification prefs on timer hub) | break-alerts-out-of-tab (merged) | revisit-user-choices PRD thread | active |

Detail for any row: [`roadmap-references/items/{ID}.md`](roadmap-references/items/). **PRD v3 scope map:** [`roadmap-references/prd-v3-horizon.md`](roadmap-references/prd-v3-horizon.md). **Flow coherence (B-05–B-08):** [`roadmap-references/flow-coherence-recommendations.md`](roadmap-references/flow-coherence-recommendations.md).

## Streams

| Stream | Theme | Chain | Note |
| ------ | --- | --- | --- |
| A | Core loop | F-01 → F-02 → S-01 → S-02 → S-03 | MVP complete |
| B | Scoring substrate | S-04 ∥ A | Task attributes |
| C | Wedge convergence | S-05 → S-06 | Differentiating mechanic |
| D | Auth hardening | S-07, S-10 | Needs F-02 |
| E | UX responsiveness | S-09 | Optimistic tasks |
| F | First impression | S-09 → F-04 → S-12 ∥ S-13; S-11 ∥ S-14 | Impeccable craft |
| G | Intelligent wedge | S-15 ∥ S-16; S-17; S-18 | Kickoff, wind-down, narrative |
| H | Story & mindfulness | S-19 ∥ S-20; S-21; S-22 | Override ack, audio, copy |
| I | Calm focus UX | S-22 ∥ S-23 ∥ S-20; S-24 | Catch-up, transparency, pause |
| J | Task planning | S-26 ∥ S-25 ∥ S-23; F-05 → S-27 | Drag-drop, Eisenhower, standing |
| K | Wellness re-skin | F-06 → S-28 | Pastel + Calm Garden |
| L | Task UX + standup | S-29 → **S-36** (done); S-32 after S-36; S-30; S-27 | PRD v3 US-02–03 |
| M | Coherence craft | S-31 ∥ S-28; S-30 footprint | Focus shell, atmosphere |
| N | PRD v3 flow conductor | **B-05 → B-06 → F-07 (+B-07)** → S-21 ∥ S-33; S-34 ∥ S-35; S-24 → B-08 | US-01 — see [`prd-v3-horizon.md`](roadmap-references/prd-v3-horizon.md) |
| O | Choice revisit | break-alerts-out-of-tab (merged) → **S-37** | MVP: notification prefs on timer hub; broader pattern deferred |

## Backlog Handoff

| Roadmap ID | Change ID | Ready for `/10x-plan` | Notes |
| ---------- | --------- | --------------------- | ----- |
| B-05 | fix-closure-kickoff-mutex | **yes** | P0 hotfix; T-01; parallel S-29; US-01 |
| B-06 | fix-timeout-closure-on-load | **yes** | after B-05; T-03 |
| B-07 | fix-wind-down-cycle-threshold | **yes** | with F-07 faza 2 |
| B-08 | fix-graceful-session-end-while-running | revise | minimal after F-07; full after S-24 |
| S-29 | task-create-persona-presets | **done** | merged PR #109 |
| S-36 | persona-presets-v2 | **done** | US-02; [PR #119](https://github.com/konrad-kaluzny-ceneo/FlowState/pull/119) |
| S-32 | create-wedge-trust-bridge | **yes** | after S-36; US-02 |
| F-07 | wedge-transition-conductor | **yes** | after B-06; US-01; **pol-10** handoff before kickoff |
| S-24 | cycle-pause-resume | **yes** | US-04; pause cap ~30 min; **pol-12** suppress gates while PAUSED |
| S-27 | daily-standing-tasks-capacity-plan | **yes** | US-03; local-midnight reset |
| S-30 | daily-work-timing-recap | **yes** | US-03; light footprint only |
| S-31 | work-focus-shell | **yes** | Secondary craft |
| S-28 | wellness-illustration-foundation | **yes** | Secondary craft |
| S-21 | mindful-transition-copy | **yes** | US-01; F-07 done |
| S-33 | break-restoration-atmosphere | **yes** | pair S-21 |
| S-34 | optimistic-wedge-transitions | **yes** | US-01; F-07 done |
| S-35 | wedge-transition-sync-recovery | **yes** | bundle with S-34 |
| F-03 | align-prisma-config | **yes** | hygiene; parallel when idle |
| S-11 ext. | post-merge-wedge-coach | **yes** | after F-07; T-05 / hot-1; P-GAP-102 promoted — see [`flow-coherence-recommendations.md`](roadmap-references/flow-coherence-recommendations.md) Phase 4 |
| S-37 | revisit-user-choices | **yes** | MVP: notification preference revisit; broader pattern deferred |

**Recommended next:** **S-32** (S-36 done) ∥ **B-06** (active) → **F-07** → **S-11 ext.** ∥ **S-27** ∥ **S-30** ∥ **S-31** ∥ **S-28** → **S-24** → **S-34** ∥ **S-35**; **S-21** ∥ **S-33** after F-07.

## Reference appendix (load on demand)

| Topic | File |
| --- | --- |
| **Agent context router** | [`../README.md`](../README.md) |
| **PRD US ↔ slices** | [`prd-refs.md`](prd-refs.md) |
| **PRD v3 scope → slices** | [`roadmap-references/prd-v3-horizon.md`](roadmap-references/prd-v3-horizon.md) |
| Baseline (2026-05-26) | [`roadmap-references/baseline.md`](roadmap-references/baseline.md) |
| All foundations / slices (bulk) | [`foundations.md`](roadmap-references/foundations.md), [`slices.md`](roadmap-references/slices.md) |
| Expand batch merge history | [`expand-batches/README.md`](roadmap-references/expand-batches/README.md) |
| Research before plan | [`research-requirements.md`](roadmap-references/research-requirements.md) |
| Open questions | [`open-questions.md`](roadmap-references/open-questions.md) |
| Future ideas | [`future-ideas.md`](roadmap-references/future-ideas.md) |
| Parked | [`parked.md`](roadmap-references/parked.md) |
| Done / archive log | [`done.md`](roadmap-references/done.md) |
| User flow map (T-01–T-06) | [`user-flow.md`](user-flow.md) |
| Flow coherence recommendations | [`roadmap-references/flow-coherence-recommendations.md`](roadmap-references/flow-coherence-recommendations.md) |
| Agent index | [`roadmap-references/README.md`](roadmap-references/README.md) |

## Scope merges (expand → existing slices)

| Proposal | Target | Action |
| --- | --- | --- |
| P-202 insight beat separation | S-17 + S-30 | plan scope only |
| P-203 empty→cycle activation | S-29 | plan scope |
| P-204 feature discovery coaches | S-29, S-30 | plan scope |
| P-205 calm insights voice | S-21 | plan scope |
| P-103 persona user defaults | S-29 phase 2 | park |
| P-103 (coherence) manual order coach | S-23 | plan follow-up |
| P-104 context-switch trail | S-30 | plan sub-phase |
| P-105 Eisenhower literacy | S-29 phase 2 | plan scope |
| P-GAP-109 garden on overlays | S-28 phase 2 | already in S-28 detail |
| P-GAP-110 progressive coaching | S-11 extension | park in [`parked.md`](roadmap-references/parked.md) |
| P-GAP-102 guest activation | S-11 extension | **active extension** (promoted from parked); after F-07 — event storming hot-1 |

Full evaluator tables: [`expand-batches/README.md`](roadmap-references/expand-batches/README.md).

## Done

- **S-27: daily standing + focus-hours budget** — Archived 2026-06-19 → `context/archive/2026-06-19-daily-standing-tasks-capacity-plan/`. Lesson: —.
