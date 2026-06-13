---
project: "FlowState"
version: 3
context_type: brownfield
created: 2026-06-13
updated: 2026-06-13
product_type: web-app
target_scale:
  users: small
  qps: low
  data_volume: small
timeline_budget:
  delivery_weeks: 0
  hard_deadline: null
  after_hours_only: true
  note: "0 = no fixed delivery cap; continuous after-hours iteration"
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 4.5, 5, 6, 7]
  product_phase: post-mvp-iteration
  mvp_shipped: 2026-06-07
  prd_version: 3
  prior_prd_archived: context/foundation/archive/2026-06-13-prd-v2.md
  gray_areas_resolved:
    - topic: "PRD v3 impuls"
      decision: "deepen wedge — better suggestions, transitions, trust; plus significant new capability and craft/polish"
    - topic: "change category"
      decision: "significant feature + quality craft"
    - topic: "must preserve"
      decision: "wedge + override freedom; no silent data loss; mindful transitions (max 1 interstitial + 1 gate per beat)"
    - topic: "auth"
      decision: "no changes — current model preserved"
    - topic: "primary success"
      decision: "full session with smooth transitions and no interstitial fatigue"
    - topic: "delivery horizon"
      decision: "open-ended continuous iteration — no fixed ship deadline"
    - topic: "recap vs dashboard"
      decision: "daily recap uses light footprint (minutes per task) — still no full analytics dashboard"
    - topic: "business logic"
      decision: "extend existing scoring rule with new inputs (persona preset, daily standing, capacity)"
    - topic: "scoring weights"
      decision: "coefficients tunable post-ship; implementer owns; Block: no"
    - topic: "pause vs session timeout"
      decision: "pause has own cap (~30 min) then auto-end session; pause does not count as interruption"
    - topic: "standing reset"
      decision: "reset at local midnight in user's browser timezone"
    - topic: "guest narrative"
      decision: "shorten — minimal closure in guest; full FR-040 only after merge"
    - topic: "transition surfaces"
      decision: "F-07 conductor defines beat priority; max 1 interstitial + 1 gate"
  frs_drafted: 10
  quality_check_status: accepted
---

## Current System

FlowState is a shipped single-user web app (MVP 2026-06-07) for interrupt-driven knowledge work: Pomodoro cycles linked to tasks, session-aware next-task suggestions with one-line rationale, mindful check-ins at cycle boundaries, and user override at every suggestion beat. Stack: Next.js, TypeScript, tRPC, Prisma on Neon Postgres, Neon Auth (email + OAuth), guest trial with local merge. PRD v2 iteration deepened wedge overlays, context recovery, session narrative, and Serene Pastel visual system. Roadmap tracks vertical slices (S-01–S-35); active work includes persona presets (S-29).

## Problem Statement & Motivation (delta)

MVP and PRD v2 iteration proved the core loop. The gap now: transitions between wedge beats still risk interstitial fatigue; first suggestions lack trust without persona context; daily planning (standing tasks, capacity) and cycle pause are incomplete; craft (Calm Garden, focus shell) lags the wedge promise. Trigger: continuous quality iteration after MVP — deepen wedge and ship the remaining must-have surface without regressing calm end-of-day feeling.

## User & Persona

**Primary persona: The Dynamic Knowledge Worker** — unchanged from PRD v2. Interrupt-driven developer, analyst, or team contributor who needs "what do I do right now" and context recovery after interruption.

## Access Control

No changes planned — current model preserved. Login (email + password, OAuth), flat user model, optional guest trial with merge on sign-in.

## Success Criteria

### Primary
- A logged-in user completes a multi-cycle session where wedge transitions (check-in → suggestion → break confirm → optional wind-down) flow without interstitial fatigue — at most one interstitial line plus one gate per transition beat, orchestrated by the transition conductor.

### Secondary
- Task create with persona preset completes in ≤3 taps without losing Custom expand path.
- Daily recap (light footprint) is dismissible and does not block the next session.
- Pause/resume preserves remaining cycle time; pause does not count as interruption; paused session auto-ends after ~30 minutes.
- Daily standing tasks reset predictably at local midnight (browser timezone).
- Serene Pastel + Calm Garden visuals are cohesive on home, wedge overlays, and auth.
- Guest trial remains narrower than logged-in (no full wedge stack).

### Guardrails
- User data (tasks, session state) must never be lost silently.
- Pomodoro timer accurate within ±2 seconds.
- Max 1 interstitial + 1 gate per transition beat.
- Strict per-account data isolation.
- Wedge transitions (check-in → suggestion) perceived ≤200ms.
- Calm recovery when network is lost on wedge gates.

## User Stories

### US-01: User completes session with orchestrated wedge transitions

- **Given** a logged-in user with multiple active tasks and persona attributes set
- **When** they run a full session through check-ins, suggestions, break confirms, and optional wind-down
- **Then** each transition beat shows at most one interstitial line plus one gate — no stacked overlays — and they end with calm closure
- **Before:** transition surfaces could compete on the same beat; orchestration was implicit.

### US-02: User trusts first suggestion via persona context

- **Given** a logged-in user who created tasks with persona presets
- **When** they receive the first kickoff or post-check-in suggestion
- **Then** the rationale cites the persona preset context and they can accept or override without penalty
- **Before:** rationale did not reference persona preset.

### US-03: User plans day with standing tasks and light recap

- **Given** a logged-in user with daily standing tasks and focus-hours budget
- **When** they work through a session and dismiss the end-of-day recap
- **Then** they see a light footprint of timing per task (not a dashboard) and standing items rolled at local midnight
- **Before:** no standing tasks or daily recap.

## Scope of Change

### Must-have (new)

- [new] Persona presets at task create with Custom expand (S-29)
- [new] First suggestion trust bridge — rationale cites persona preset (S-32)
- [new] Wedge transition conductor — max 1 interstitial + 1 gate per beat (F-07)
- [new] Cycle pause/resume with ~30 min pause cap then auto-end session (S-24)
- [new] Daily standing tasks + focus-hours capacity in suggestions (S-27)
- [new] Daily work timing recap — light footprint, dismissible (S-30)
- [new] WORK cycle focus shell (S-31)
- [new] Calm Garden illustration system polish (S-28)
- [new] Optimistic wedge transitions ≤200ms perceived (S-34)
- [new] Calm network-loss recovery on wedge gates (S-35)

### Modified

- [modified] Scoring rule — extended inputs: persona preset attributes, daily standing flag, focus-hours capacity budget
- [modified] Guest session narrative — shortened closure only; full narrative after merge
- [modified] Daily standing reset — local midnight browser timezone

### Preserved

- [preserved] Wedge + override freedom — suggestion with rationale; user always decides
- [preserved] No silent data loss on refresh, crash, or guest merge
- [preserved] Mindful transitions — check-in gate before next work cycle
- [preserved] Deterministic scoring — no AI/ML personalization
- [preserved] Single-user — no team features
- [preserved] Auth model unchanged

## Constraints & Preserved Behavior

- Backward compatibility: existing tasks, sessions, and guest merge flows must continue working.
- Guest scope remains narrower than logged-in — no full wedge stack for guest.
- Scoring coefficients remain tunable by implementer without PRD block.
- Pause does not count as interruption for scoring (FR-042 semantics preserved).
- No regression to timer accuracy, data isolation, or auth lockout guardrails from PRD v2.

## Business Logic Changes

**Current rule:** FlowState observes session state and task attributes and suggests which task to work on next — matching work type and attributes to focus capacity while enforcing mindful transitions.

**Change:** Extend inputs consumed by the rule:
- Persona preset attributes at task create (feeds work-type fit and rationale)
- Daily standing flag and focus-hours capacity budget (feeds capacity-aware rationale)
- Transition conductor as separate orchestration rule: which surfaces may fire per beat (priority order owned by F-07 foundation slice)

Output unchanged: ranked suggestion with one-line rationale; user override always available.

## Non-Functional Requirements (delta)

- Wedge transitions (check-in → suggestion) perceived ≤200ms.
- Calm, non-blocking recovery when network is lost during wedge gate mutations.
- Daily recap dismissible; does not block session start.
- Pause cap ~30 minutes then session auto-ends.

## Non-Goals (v3 horizon)

- No mobile app or native push — browser-only.
- No team or social features.
- No AI/ML scoring.
- No external tool import/export.
- No full analytics dashboard — light daily footprint only, not charts/trends/weekly reports.

## Open Questions

1. **Exact pause cap duration** — ~30 min proposed; confirm or tune. Owner: user. Block: no.
2. **Scoring coefficient tuning** — tunable post-ship; no PRD lock. Owner: implementer. Block: no.
3. **Conductor beat priority order** — documented in F-07 foundation slice. Owner: implementer. Block: no for individual slices.

## Timeline acknowledgment

Acknowledged on 2026-06-13: PRD v3 horizon is open-ended continuous iteration (after-hours); no fixed ship deadline; quality over speed-to-MVP.
