---
project: "FlowState"
context_type: greenfield
created: 2026-05-23
updated: 2026-05-23
product_type: web-app
target_scale:
  users: small
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 6
  hard_deadline: 2026-07-05
  after_hours_only: true
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  gray_areas_resolved:
    - topic: "pain category"
      decision: "workflow friction + decision paralysis + coordination overhead"
    - topic: "insight"
      decision: "mindfulness and productivity are treated as separate concerns — tools optimize for throughput, not end-of-day mental state"
    - topic: "primary persona scope"
      decision: "knowledge worker in a dynamic team environment"
    - topic: "access model"
      decision: "login (email + password / OAuth / passwordless); flat user model — one role"
    - topic: "MVP timeline"
      decision: "6 weeks, hard deadline 2026-07-05, user accepted sustained-effort cost"
    - topic: "task-pomodoro link"
      decision: "user selects a task to focus on before starting a Pomodoro cycle"
    - topic: "cycle-end notification"
      decision: "in-browser audio signal + UI prompt to confirm next cycle"
    - topic: "task completed mid-cycle"
      decision: "user is prompted to choose: pick next task and continue cycle, or take a break now"
    - topic: "task completion celebration"
      decision: "full surprise animation — distinct, delightful, unexpected (nice-to-have)"
  frs_drafted: 22
  quality_check_status: accepted
---

## Vision & Problem Statement

A knowledge worker in a dynamic team environment faces compounding cognitive load throughout the day: workflow friction from constant context-switching, decision paralysis when the task pile grows and no single task is clearly "the one right now", and coordination overhead from other people's demands arriving unpredictably. By mid-day, after repeated interruptions and context switches, the pile of open tasks feels unmanageable. The day ends with a feeling of overstimulation and lost control rather than accomplishment.

The insight that makes this product worth building: existing productivity tools treat mindfulness and productivity as separate concerns. Task managers optimize for throughput — capturing more, organizing better, tracking completion. They do not address the user's mental state at end of day. FlowState is built on the premise that a calm, focused end-of-day feeling is itself a first-class product outcome, not a side effect of getting more done.

## User & Persona

**Primary persona: The Dynamic Knowledge Worker**

A developer, analyst, or team contributor whose workday is genuinely interrupt-driven — pipelines finish, Slack messages arrive, fires need putting out, and meaningful work happens in the gaps between. They are not disorganized; they are operating in an environment that structurally resists sustained focus. They reach for FlowState not because they lack a to-do list, but because their to-do list doesn't help them answer "what do I do *right now*" or recover their context after an interruption.

## Access Control

Authentication: login required (email + password, OAuth, or passwordless — exact mechanism is downstream). Each user authenticates to access their own data.

Role model: flat — every logged-in user has identical capabilities. No admin surface, no role-based permission boundaries in the MVP.

## Success Criteria

### Primary
- A logged-in user completes a full Pomodoro session with at least one task, marks it done, and ends the session with a clear view of completed vs. open work — the full loop working end-to-end.

### Secondary
- Pomodoro cycle lengths (work and break durations) are configurable and the setting persists across sessions.
- The completed/active task split is visually clear at a glance.

### Guardrails
- User data (tasks, session state) must never be lost silently — a crash or refresh must not wipe work.
- The Pomodoro timer must be accurate — a configured cycle must not drift by more than a few seconds.
- Auth must not lock a user out of their own data — a failed login attempt must not destroy local state.
- A user must never have access to another user's data — data isolation is strict per account.

## Timeline acknowledgment

Acknowledged on 2026-05-23: 6-week MVP (hard deadline 2026-07-05) requires sustained dedication over evenings/weekends; user accepted.

## Functional Requirements

### Authentication

- FR-001: User can register an account. Priority: must-have
  > Socrates: Counter-argument considered: "registration adds friction before value." Resolution: kept; registration is required for data isolation.
- FR-002: User can log in to their account. Priority: must-have
  > Socrates: Counter-argument considered: "login is mechanically implied by registration." Resolution: kept; login is the gate to user data.
- FR-003: User can log out. Priority: must-have
  > Socrates: Counter-argument considered: "nobody logs out on a personal device." Resolution: kept; required for session security.

### Task List

- FR-004: User can add a task to their list. Priority: must-have
  > Socrates: Counter-argument considered: "tasks could be imported from existing tools instead." Resolution: kept; user needs to name what they're working on, task list is the minimal shape.
- FR-005: User can edit a task. Priority: must-have
  > Socrates: No counter-argument; stands as written — core task management logic.
- FR-006: User can delete a task. Priority: must-have
  > Socrates: No counter-argument; stands as written — core task management logic.
- FR-007: User can mark a task as completed. Priority: must-have
  > Socrates: No counter-argument; stands as written — core task management logic.
- FR-008: User can view active tasks and completed tasks in separate, clearly distinguished lists. Priority: must-have
  > Socrates: No counter-argument; stands as written — core task management logic.
- FR-009: User can select a task to focus on before starting a Pomodoro cycle. Priority: must-have
  > Socrates: No counter-argument; stands as written — core Pomodoro logic.

### Pomodoro

- FR-010: User can configure the work cycle duration. Priority: must-have
  > Socrates: No counter-argument; stands as written — core Pomodoro logic.
- FR-011: User can configure the break cycle duration. Priority: must-have
  > Socrates: No counter-argument; stands as written — core Pomodoro logic.
- FR-012: User can start a Pomodoro cycle linked to the selected task. Priority: must-have
  > Socrates: No counter-argument; stands as written — core Pomodoro logic.
- FR-013: User receives an in-browser audio signal and a UI prompt when a work cycle ends. Priority: must-have
  > Socrates: No counter-argument; stands as written — core Pomodoro logic.
- FR-014: User confirms the transition to the next cycle (work → break → work). Priority: must-have
  > Socrates: No counter-argument; stands as written — core Pomodoro logic.
- FR-015: When a user marks a task done mid-cycle, the system prompts them to choose: pick the next task and continue the current cycle, or end the cycle and take a break now. Priority: must-have
  > Socrates: No counter-argument; stands as written — core Pomodoro logic.

### Delight

- FR-016: User sees a full surprise animation when they complete a task. Priority: nice-to-have
  > Socrates: Counter-argument considered: "delight features only land when the core loop is already smooth — shipping this before the Pomodoro cycle feels rock-solid risks polishing a broken experience." Resolution: kept as nice-to-have; explicitly deferred until core loop is solid.

### Adaptive Focus (scoring + mindful transitions)

- FR-017: User can assign a work type (deep work / admin / reactive) to a task. Priority: must-have
  > Socrates: No counter-argument; stands as written — required input for scoring rule.
- FR-018: User can assign a weight/urgency (1–3 scale) to a task. Priority: must-have
  > Socrates: No counter-argument; stands as written — required input for scoring rule.
- FR-019: System tracks session context (cycles completed, interruptions count, time of day). Priority: must-have
  > Socrates: No counter-argument; stands as written — required input for scoring rule.
- FR-020: After each cycle, user completes a mindful check-in (declares current energy/readiness state). Priority: must-have
  > Socrates: No counter-argument; stands as written — core mindfulness mechanic.
- FR-021: System suggests the next task based on scoring (weight × work type fit × session context). Priority: must-have
  > Socrates: No counter-argument; stands as written — the domain rule made concrete.
- FR-022: User can accept the suggestion or manually override with a different task. Priority: must-have
  > Socrates: No counter-argument; stands as written — user autonomy preserved.

## User Stories

### US-01: User completes a full Pomodoro session

- **Given** a logged-in user with at least one active task
- **When** they select a task, start a Pomodoro cycle, work through it, receive the end-of-cycle notification, and confirm the transition
- **Then** the cycle completes, the break timer starts, and the user's task list reflects any tasks marked done during the session

#### Acceptance Criteria
- The selected task is visually highlighted as the active focus during the cycle
- The audio signal plays and a UI prompt appears at cycle end — the timer does not auto-transition
- Completed tasks move to the completed list immediately on marking; they do not disappear
- A user who refreshes the page mid-session does not lose their task list or cycle configuration

## Business Logic

FlowState observes the user's session state (interruption count, completed cycles, time of day, declared energy at each transition) and suggests which task to work on next — matching work type to current focus capacity while enforcing mindful transitions between cycles.

**Inputs the rule consumes (user-facing):**
- Task weight/urgency (1–3 scale, set by user at task creation)
- Task work type (deep work / admin / reactive, set by user at task creation)
- Mindful check-in response (energy/readiness declaration after each cycle)

**Inputs the rule consumes (session-derived):**
- Number of Pomodoro cycles completed in the current session
- Number of interruptions (task switches, mid-cycle completions) in the current session
- Time of day

**Output:**
A ranked suggestion of which task to work on next. The suggestion favors high-weight tasks when the user declares high energy and session context supports deep work; it shifts toward lighter admin/reactive tasks when energy is low, interruptions are high, or the session is late in the day.

**How the user encounters it:**
After every cycle-end check-in, the system presents a suggested next task with a brief rationale ("deep work — you're fresh and uninterrupted" or "light admin — energy dipping after 4 cycles"). The user can accept with one click or override by selecting any other task from their list. The override is not penalized — it feeds back into the session context for the next suggestion.

## Non-Functional Requirements

- User sees acknowledgement of any action (task add, cycle start, check-in) within 200ms. Operations requiring longer processing (suggestion generation) provide continuous visible feedback if they exceed 1s.
- A configured Pomodoro cycle does not drift by more than ±2 seconds from the set duration, regardless of whether the browser tab is active or in the background.
- A browser crash, page refresh, or connection loss does not cause loss of: task list, cycle configuration, or current session state. The user returns to the state before the interruption.
- One user's data (tasks, session history, check-ins) is never visible to another user. No query returns cross-account data.
- Mental state data (check-in responses, energy patterns) does not leave the system in a form that enables user identification. It is not shared with third parties or used for purposes other than generating suggestions for the same user.
- The product works correctly on the two latest major versions of Chrome, Firefox, Safari, and Edge (desktop).
- Session history (completed cycles, check-ins, suggestions) remains accessible to the user for a minimum of 90 days. After that period it may be archived but not deleted without warning.

## Non-Goals

- No mobile app or native push notifications — MVP is browser-only; notifications exist only within the active tab.
- No historical analytics or dashboards — session history is stored per NFR, but no charts, trends, weekly reports, or pattern visualizations in MVP.
- No team or social features — no shared tasks, no team visibility, no manager view. Single-user experience only.
- No AI/ML-powered scoring — the suggestion algorithm is a simple deterministic formula (weight × type fit × session context), not a trained model. No LLM, no personalization beyond current session state.
- No integrations with external tools — no Jira, Todoist, Google Calendar, or Slack import/export in MVP.


## Quality cross-check

All elements present — no gaps. Quality check passed on 2026-05-23.

- Access Control: present
- Business Logic: present (one-sentence rule + supporting detail)
- Project artifacts: present
- Timeline-cost acknowledged: present (6-week timeline, acknowledged)
- Non-Goals: present (5 entries)
- Preserved behavior: n/a (greenfield)
