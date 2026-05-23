---
project: "FlowState"
context_type: greenfield
created: 2026-05-23
updated: 2026-05-23
checkpoint:
  current_phase: 4.5
  phases_completed: [1, 2, 3]
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
  frs_drafted: 15
  frs_drafted: 0
  quality_check_status: pending
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
- FR-002: User can log in to their account. Priority: must-have
- FR-003: User can log out. Priority: must-have

### Task List

- FR-004: User can add a task to their list. Priority: must-have
- FR-005: User can edit a task. Priority: must-have
- FR-006: User can delete a task. Priority: must-have
- FR-007: User can mark a task as completed. Priority: must-have
- FR-008: User can view active tasks and completed tasks in separate, clearly distinguished lists. Priority: must-have
- FR-009: User can select a task to focus on before starting a Pomodoro cycle. Priority: must-have

### Pomodoro

- FR-010: User can configure the work cycle duration. Priority: must-have
- FR-011: User can configure the break cycle duration. Priority: must-have
- FR-012: User can start a Pomodoro cycle linked to the selected task. Priority: must-have
- FR-013: User receives an in-browser audio signal and a UI prompt when a work cycle ends. Priority: must-have
- FR-014: User confirms the transition to the next cycle (work → break → work). Priority: must-have
- FR-015: When a user marks a task done mid-cycle, the system prompts them to choose: pick the next task and continue the current cycle, or end the cycle and take a break now. Priority: must-have

### Delight

- FR-016: User sees a full surprise animation when they complete a task. Priority: nice-to-have

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

