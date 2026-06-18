---
project: "FlowState"
version: 3
status: draft
created: 2026-06-13
context_type: brownfield
product_type: web-app
target_scale:
  users: small
  qps: low
  data_volume: small
timeline_budget:
  delivery_weeks: 0
  hard_deadline: null
  after_hours_only: true
---

## Current System Overview

FlowState is a shipped single-user web app for interrupt-driven knowledge work. A logged-in user manages tasks, runs Pomodoro cycles linked to a selected task, completes mindful energy check-ins at cycle boundaries, and receives deterministic next-task suggestions with one-line rationale — always with override freedom.

**Architecture:** Next.js App Router monolith with tRPC API layer, Prisma ORM on Neon Postgres, deployed on Vercel with GitHub Actions CI.

**Auth:** Neon Auth — email/password, Google OAuth, password recovery; optional guest trial on `/` with device-local storage and transactional merge on sign-in.

**User base:** Small scale — solo builder plus early users; interrupt-driven knowledge workers (developers, analysts, team contributors).

**Core functionality today (MVP + PRD v2 iteration, shipped 2026-06-07):** Task CRUD with scoring attributes (work type, urgency, importance, effort, commitment horizon, manual order); full Pomodoro session with breaks, check-ins, kickoff/post-check-in suggestions, wind-down nudge, session narrative, resume notes, guest merge, Serene Pastel visual system, and E2E test belt.

## Problem Statement & Motivation

MVP and PRD v2 iteration validated the wedge: session-aware suggestions with mindful transitions and calm visual tone. The product now needs **efficient deepening** — not a second MVP — without regressing what shipped.

**Gap:** Wedge transition beats can still stack competing surfaces (check-in, suggestion, narrative, acknowledgement, break copy), causing interstitial fatigue. First suggestions lack persona context for trust. Daily planning (standing tasks, capacity budget), cycle pause/resume, focus shell during work cycles, Calm Garden craft, optimistic wedge responsiveness, and network-loss recovery on gates remain incomplete or proposed on the roadmap.

**Why now:** Continuous after-hours iteration with `main_goal: quality`. MVP is done; the next contract is orchestrated wedge flow plus the remaining must-have capabilities that make the product feel complete for daily use.

**Current workaround cost:** Users tolerate implicit transition ordering and missing pause/planning features; trust in first suggestions is lower without persona-linked rationale; craft gaps undermine the calm end-of-day promise.

## User & Persona

**Primary persona: The Dynamic Knowledge Worker** — unchanged.

A developer, analyst, or team contributor whose workday is genuinely interrupt-driven. They reach for FlowState because their task list does not answer "what do I do *right now*" or help recover context after interruption. PRD v3 changes affect this persona directly: smoother transitions, persona-aware rationale, daily planning, and polish — not a new persona tier.

## Success Criteria

### Primary
- A logged-in user completes a multi-cycle session where wedge transitions (check-in → suggestion → break confirm → optional wind-down) flow without interstitial fatigue — at most one interstitial line plus one gate per transition beat, orchestrated by the transition conductor.

### Secondary
- Task create with persona preset completes in ≤3 taps without losing the Custom expand path.
- Daily recap (light footprint — minutes per task, not charts) is dismissible and does not block the next session.
- Pause/resume preserves remaining cycle time; pause does not count as interruption; a paused session auto-ends after approximately 30 minutes.
- Daily standing tasks reset predictably at local midnight in the user's browser timezone.
- Serene Pastel and Calm Garden visuals are cohesive on home, wedge overlays, and auth surfaces.
- Guest trial remains narrower than the logged-in product — no full wedge stack.

### Guardrails
- User data (tasks, session state) must never be lost silently — refresh, crash, or guest merge included.
- A configured Pomodoro cycle does not drift by more than ±2 seconds.
- At most one interstitial line plus one gate per transition beat — no regression to stacked wedge overlays.
- One user's data is never visible to another user.
- Wedge transitions (check-in → suggestion) are perceived within 200ms.
- Network loss during wedge gate mutations shows calm recovery — no silent failure or orphaned state.

## User Stories

### US-01: User completes session with orchestrated wedge transitions

- **Given** a logged-in user with multiple active tasks
- **When** they run a full session through check-ins, suggestions, break confirms, and optional wind-down
- **Then** each transition beat shows at most one interstitial line plus one gate, and they end with calm closure
- **Before:** transition surfaces could compete on the same beat without explicit orchestration.

### US-02: User trusts first suggestion via persona context

- **Given** a logged-in user who created tasks with persona presets
- **When** they receive the first kickoff or post-check-in suggestion
- **Then** the rationale references persona preset context and they can accept or override without penalty
- **Before:** rationale did not cite persona preset.

### US-03: User plans day with standing tasks and light recap

- **Given** a logged-in user with daily standing tasks and a focus-hours budget
- **When** they work through a session and dismiss the end-of-day recap
- **Then** they see a light timing footprint per task (not a dashboard) and standing items roll at local midnight
- **Before:** no standing tasks or daily recap.

### US-04: User pauses cycle without losing session integrity

- **Given** a logged-in user mid-work or mid-break cycle
- **When** they pause and later resume within the pause cap
- **Then** remaining time is preserved, pause does not increment interruption count, and exceeding the cap ends the session calmly
- **Before:** pause/resume not shipped.

## Scope of Change

### New capabilities (must-have)

- [new] Persona presets at task create with Custom expand path — reduces attribute-entry friction and feeds scorer context.
- [new] Trust bridge — first suggestion rationale cites persona preset so user understands why this task now.
- [new] Wedge transition conductor — defines beat priority; enforces max one interstitial line plus one gate per transition.
- [new] Cycle pause and resume with remaining time preserved; pause excluded from interruption count; ~30 minute pause cap then auto-end session.
- [new] Daily standing tasks with focus-hours capacity budget; suggestions include capacity-aware rationale.
- [new] Daily work timing recap — light footprint (minutes per task), dismissible, not a dashboard.
- [new] WORK cycle focus shell — reduced distraction during active work cycles.
- [new] Calm Garden illustration system on home accent, atmosphere, and empty states.
- [new] Optimistic wedge transitions — check-in to suggestion perceived within 200ms.
- [new] Calm network-loss recovery on wedge gates — user sees recoverable state, not silent loss.

### Modified behavior

- [modified] Scoring rule inputs extended: persona preset attributes, daily standing flag, focus-hours capacity budget.
- [modified] Guest session narrative shortened — minimal closure in guest mode; full session narrative only after account merge.
- [modified] Daily standing reset at local midnight in browser timezone.

### Preserved behavior

- [preserved] Wedge plus override freedom — system suggests with rationale; user always decides.
- [preserved] No silent data loss on refresh, crash, or guest merge.
- [preserved] Mindful check-in gate before next work cycle transition.
- [preserved] Deterministic scoring — no trained model or LLM personalization.
- [preserved] Single-user experience — no team or social features.
- [preserved] Auth model — email, OAuth, guest merge unchanged.
- [preserved] Timer accuracy, per-account isolation, and auth lockout guardrails from PRD v2.

### Removed

- (none planned)

## Constraints & Compatibility

- **Backward compatibility:** Existing tasks, sessions, check-ins, and guest merge must continue working; new fields are additive.
- **Guest scope:** Guest trial remains narrower — no full wedge stack, shortened narrative only.
- **Data:** No breaking schema changes without migration path; guest blob merge policy unchanged (suffix on title collision).
- **Integrations:** None external — in-app only.
- **Preserved SLAs from PRD v2:** 200ms acknowledgement for user actions; 90-day session history retention; mainstream desktop browser support (two latest major versions of Chrome, Firefox, Safari, Edge).
- **Scoring coefficients:** Remain tunable by implementer after ship — not locked in PRD v3.

## Business Logic Changes

**Current rule:** FlowState observes session state (interruption count, completed cycles, time of day, declared energy) and task attributes (urgency, importance, work type, effort, commitment horizon, manual order) and suggests which task to work on next — matching work type and attributes to focus capacity while enforcing mindful transitions between cycles.

**Changes:**

1. **Extended scoring inputs:** Persona preset attributes at task create; daily standing flag; focus-hours capacity budget. Output unchanged — ranked suggestion with one-line rationale and optional factor breakdown; high energy favors demanding work; low energy favors lighter tasks.

2. **New orchestration rule (transition conductor):** At each transition beat, at most one interstitial line plus one gate may fire. The conductor defines priority order among check-in, suggestion, override acknowledgement, break/re-entry copy, and session narrative lines. Prevents interstitial fatigue without changing what the scorer decides.

3. **Pause semantics:** Pause suspends cycle timer without counting as interruption; session auto-ends if pause exceeds approximately 30 minutes.

4. **Standing reset:** Daily standing items roll at local midnight in the user's browser timezone.

## Access Control Changes

No access control changes — current model preserved. Login required for account-backed cross-device data (email, OAuth, password recovery). Flat user model — every logged-in user has identical capabilities. Guest trial on `/` uses device-local storage until merge on sign-in.

## Non-Goals

- No mobile app or native push notifications — browser-only; in-tab signals only.
- No team or social features — no shared tasks, manager view, or collaboration.
- No AI/ML-powered scoring — deterministic formula only.
- No external tool import/export integrations.
- No full analytics dashboard — no charts, trends, or weekly reports. Daily recap is a light narrative footprint only.
- No full recurring rule engine — daily standing tasks use boolean flag and local-day reset, not RRULE.
- No fixed delivery deadline for PRD v3 scope — continuous after-hours iteration; roadmap slices sequence work.

## Open Questions

1. **Exact pause cap duration** — approximately 30 minutes proposed for auto-end session after pause. Owner: user. Block: no.
2. **Scoring coefficient values (v2 branches)** — Eisenhower/Pareto/Ockham weights, late-day threshold, capacity decrement remain tunable after real usage. Owner: implementer. Block: no.
3. **Conductor beat priority order** — which surface wins when multiple could fire; documented in wedge-transition-conductor foundation slice. Owner: implementer. Block: no for individual feature slices; yes for polish pass if beats still collide.
4. **Delivery week count in frontmatter** — `delivery_weeks: 0` signals no fixed cap; horizon is continuous iteration. Owner: user. Block: no.
