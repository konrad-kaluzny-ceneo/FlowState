---
project: "FlowState"
version: 2
status: draft
created: 2026-05-23
updated: 2026-06-12
updated: 2026-06-12
context_type: greenfield
product_type: web-app
target_scale:
  users: small
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 6
  hard_deadline: null
  after_hours_only: true
---

## Vision & Problem Statement

A knowledge worker in a dynamic team environment faces compounding cognitive load throughout the day: workflow friction from constant context-switching, decision paralysis when the task pile grows and no single task is clearly "the one right now", and coordination overhead from other people's demands arriving unpredictably. By mid-day, after repeated interruptions and context switches, the pile of open tasks feels unmanageable. The day ends with a feeling of overstimulation and lost control rather than accomplishment.

The insight that makes this product worth building: existing productivity tools treat mindfulness and productivity as separate concerns. Task managers optimize for throughput — capturing more, organizing better, tracking completion. They do not address the user's mental state at end of day. FlowState is built on the premise that a calm, focused end-of-day feeling is itself a first-class product outcome, not a side effect of getting more done.

**Product phase (2026-06-12):** MVP shipped 2026-06-07 (north star S-01 through wedge S-06 and PRD must-have FR-001–FR-022). The project is now in **continuous iteration** — deepening the wedge (session-aware suggestions, mindful transitions, context recovery) and well-being craft. Sequencing bias is **quality**, not speed-to-MVP.

## User & Persona

**Primary persona: The Dynamic Knowledge Worker**

A developer, analyst, or team contributor whose workday is genuinely interrupt-driven — pipelines finish, Slack messages arrive, fires need putting out, and meaningful work happens in the gaps between. They are not disorganized; they are operating in an environment that structurally resists sustained focus. They reach for FlowState not because they lack a to-do list, but because their to-do list doesn't help them answer "what do I do *right now*" or recover their context after an interruption.

## Success Criteria

### Primary
- A logged-in user completes a multi-cycle session with mindful transitions at every cycle boundary (check-in → suggestion wedge), receives context-aware task guidance at session kickoff when idle, and ends with a clear active-vs-completed task split and calm visual tone — without silent data loss.

### Secondary
- Pomodoro cycle lengths (work and break durations) are configurable and persist across sessions; work-type duration presets are available at kickoff (tap-to-apply only).
- Resume context notes and tab-return catch-up help the user recover after interruption without re-reading the whole list.
- Session narrative closure and 8h return handoff (FR-040) reinforce calm end-of-day feeling without analytics dashboards.

### Guardrails
- User data (tasks, session state) must never be lost silently — a crash or refresh must not wipe work.
- The Pomodoro timer must be accurate — a configured cycle must not drift by more than a few seconds.
- Auth must not lock a user out of their own data — a failed login attempt must not destroy local state.
- A user must never have access to another user's data — data isolation is strict per account.
- Transition surfaces must not stack into interstitial fatigue — at most one interstitial line plus one gate per transition beat.

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

### US-02: User receives wedge guidance through a full session

- **Given** a logged-in user with multiple active tasks tagged with work type and priority attributes
- **When** they start a session, complete cycles with energy check-ins, and accept or override suggested next tasks
- **Then** they experience kickoff suggestion when idle, post-check-in suggestion with rationale, optional wind-down when fading, and neutral acknowledgement on override — without guilt copy or autopilot transitions

#### Acceptance Criteria
- Kickoff suggestion appears when idle at session start or after break with no pre-selected task
- Every completed work cycle requires energy check-in before the next transition
- Override shows a brief validating line; override feeds session context for the next suggestion
- Wind-down nudge is optional and dismissible when energy is Fading and fatigue signals align

## Functional Requirements

### Authentication

- FR-001: User can register an account. Priority: must-have
  > Socrates: Counter-argument considered: "registration adds friction before value." Resolution: kept; registration is required for data isolation.
- FR-002: User can log in to their account. Priority: must-have
  > Socrates: Counter-argument considered: "login is mechanically implied by registration." Resolution: kept; login is the gate to user data.
- FR-003: User can log out. Priority: must-have
  > Socrates: Counter-argument considered: "nobody logs out on a personal device." Resolution: kept; required for session security.
- FR-003a: User can reset a forgotten password or recover account access. Priority: must-have
  > Socrates: Counter-argument considered: "recovery flow is complex and rarely used in MVP." Resolution: kept; without it, a forgotten password = permanent lockout, violating the guardrail that auth must not lock a user out of their own data.
- FR-023: User can sign in or sign up with an OAuth social account in one click, alongside email and password. Priority: must-have

### Guest trial (try before signup)

- FR-003b: A visitor without an account can open `/`, manage tasks, and run Pomodoro cycles with data stored in device-local storage (single versioned blob). Priority: must-have
  > Socrates: Counter-argument considered: "guest mode weakens registration-first and complicates the data model." Resolution: kept; reduces onboarding friction while accounts remain required for durable, cross-device data. Guest scope is intentionally narrower than the logged-in product (no check-ins, scoring, or full wedge stack).
- FR-003c: After sign-in or sign-up, guest tasks and cycles import into the user's account in one transactional merge; on title collision with an existing account task, the imported task receives a numbered suffix (` (2)`, ` (3)`, …). Priority: must-have
  > Socrates: Counter-argument considered: "silent merge could overwrite server data." Resolution: kept; additive merge with explicit suffix policy satisfies the no-silent-data-loss guardrail. Guest blob is cleared after successful import.
- FR-024: After authenticating with guest data present, user sees an explicit merge-success moment naming imported tasks and what unlocked (full sessions, check-ins, suggestions) — not a silent import. Priority: must-have

### Task List

- FR-004: User can add a task to their list. Priority: must-have
  > Socrates: Counter-argument considered: "tasks could be imported from existing tools instead." Resolution: kept; user needs to name what they're working on, task list is the minimal shape.
- FR-005: User can edit a task. Priority: must-have
  > Socrates: Counter-argument considered: "editing invites over-polishing — users might endlessly refine task names instead of starting work." Resolution: kept; editing is essential for correcting mistakes and updating scope as understanding evolves.
- FR-006: User can delete a task. Priority: must-have
  > Socrates: Counter-argument considered: "deletion destroys history — a completed/archived state would preserve the record for session analytics." Resolution: kept; users need a clean list to reduce cognitive load; archival is a post-MVP concern.
- FR-007: User can mark a task as completed. Priority: must-have
  > Socrates: Counter-argument considered: "completion is binary — what about tasks that are partially done or blocked?" Resolution: kept; binary completion is the simplest model that closes the Pomodoro loop; partial states add complexity without MVP value.
- FR-008: User can view active tasks and completed tasks in separate, clearly distinguished lists. Priority: must-have
  > Socrates: Counter-argument considered: "two lists add visual noise — a single list with strikethrough would be simpler." Resolution: kept; separation reinforces the end-of-day accomplishment feeling (seeing what's done vs. what remains).
- FR-009: User can select a task to focus on before starting a Pomodoro cycle. Priority: must-have
  > Socrates: Counter-argument considered: "manual selection defeats the purpose of the scoring suggestion — why not auto-select?" Resolution: kept; user autonomy is a core principle; the system suggests, the user decides.
- FR-009a: User can revert a completed task back to active. Priority: must-have
  > Socrates: Counter-argument considered: "undo adds UI complexity and muddies the 'done' signal for scoring." Resolution: kept; accidental completion with no undo violates the guardrail that data must never be lost silently; one-tap undo is minimal cost.
- FR-034: User can drag-reorder active tasks; order persists across refresh and guest merge; manual order is a deterministic tie-breaker when suggestion scores tie — not the primary ranking signal. Priority: must-have
- FR-035: User can assign importance (1–3 scale) to a task, separate from urgency. Priority: must-have
- FR-036: User can optionally assign an effort estimate in minutes to a task. Priority: must-have
- FR-037: User can assign a commitment horizon to a task: ASAP, this week, or when possible. Priority: must-have
- FR-028: User can capture or attach a one-line resume note (~120 characters) when switching focus mid-cycle or when marking a task done mid-cycle and choosing the next task to continue — skippable at capture; the note appears on the suggestion card and when manually re-selecting that task. Priority: must-have

### Pomodoro

- FR-010: User can configure the work cycle duration (default: 25 minutes; presets 15/25/45/60 minutes; custom range 1 second–90 minutes). Priority: must-have
  > Socrates: Counter-argument considered: "configurability adds UI complexity — a fixed 25-minute cycle is the Pomodoro standard and simpler to build." Resolution: kept; different work types (deep work vs. admin) benefit from different cycle lengths; configurability supports the adaptive focus rule.
- FR-011: User can configure break cycle durations via the same picker as work (preset chips + custom minutes and seconds). Defaults: 5 minutes short break, 15 minutes long break every 4 cycles. Short break presets: 3, 5 (default), 10 minutes. Long break presets: 10, 15 (default), 20 minutes. Allowed range: 1 second–30 minutes. Priority: must-have
  > Socrates: Counter-argument considered: "break duration could be auto-calculated from session fatigue instead of user-configured." Resolution: kept; auto-calculation is a post-MVP sophistication; user-set breaks are the minimal viable control.
- FR-012: User can start a Pomodoro cycle linked to the selected task. Priority: must-have
  > Socrates: Counter-argument considered: "linking cycle to task adds coupling — what if the user wants to work on something untracked?" Resolution: kept; the link is what makes session context meaningful for scoring; untracked work defeats the feedback loop.
- FR-013: User receives an in-browser audio signal and a UI prompt when a work cycle ends. Priority: must-have
  > Socrates: Counter-argument considered: "audio signals can be disruptive in open offices or shared spaces." Resolution: kept; the signal is the mindful transition trigger — without it, cycles end silently and the user stays on autopilot.
- FR-014: User confirms the transition to the next cycle (work → break → work). Priority: must-have
  > Socrates: Counter-argument considered: "forced confirmation adds friction — auto-transition would keep flow uninterrupted." Resolution: kept; forced confirmation IS the mindfulness mechanic — it prevents autopilot, which is the core product differentiator.
- FR-015: When a user marks a task done mid-cycle, the system prompts them to choose: pick the next task and continue the current cycle, or end the cycle and take a break now. If no active tasks remain, the only option is to end the cycle and take a break. Priority: must-have
  > Socrates: Counter-argument considered: "mid-cycle completion is rare — most tasks span multiple cycles, making this an edge case not worth the UI complexity." Resolution: kept; the prompt is a mindful decision point that prevents the user from mindlessly jumping to the next task without checking their state.
- FR-030: User can set cycle-end audio preference to Normal, Soft, or Muted; preference persists across sessions. Priority: must-have
- FR-031: When returning to a backgrounded tab after a cycle ended while away, user sees a calm catch-up surface showing what finished and the single next action (check-in, break confirm, or suggestion) — not a silent missed gate. Priority: must-have
- FR-042: User can pause and resume a work or break cycle with remaining time preserved, without counting pause as an interruption for scoring purposes. Priority: must-have
- FR-041: User sees calm, skippable one-line prompts at break start and when confirming break → work transition; re-entry copy is keyed to last check-in energy (Focused / Steady / Fading). Priority: must-have

### Delight

- FR-016: User sees a full surprise animation when they complete a task. Priority: nice-to-have
  > Socrates: Counter-argument considered: "delight features only land when the core loop is already smooth." Resolution: kept as nice-to-have; FR-038 ships calm completion moment instead.
- FR-038: User sees a brief calm completion moment (restrained motion, sub-second) when marking a task done — not surprise arcade animation. Priority: must-have

### Adaptive Focus (scoring + mindful transitions)

- FR-017: User can assign a work type (deep work / admin / reactive) to a task. Priority: must-have
  > Socrates: Counter-argument considered: "three categories may not cover all work — what about creative, collaborative, or learning tasks?" Resolution: kept; three types are the minimal taxonomy that enables meaningful scoring; more categories add decision cost at task creation without proportional scoring benefit.
- FR-018: User can assign urgency (1–3 scale) to a task. Priority: must-have
  > Socrates: Counter-argument considered: "users are bad at self-assessing urgency — everything becomes a 3." Resolution: kept; even imperfect urgency signals improve over no signal; the scoring formula can weight other factors (type fit, energy) more heavily if urgency clusters.
- FR-019: System tracks session context (cycles completed, interruptions count, time of day). A session starts when the user starts their first Pomodoro cycle after login or after explicitly ending a prior session. A session ends when the user clicks "End session", or after 4 hours of inactivity (no cycle started). A user may have multiple sessions per day. Priority: must-have
  > Socrates: Counter-argument considered: "tracking interruptions requires defining what counts as an interruption — mid-cycle task switch? page refresh? manual pause?" Resolution: kept; interruption = user-initiated task change or mid-cycle completion; pause (FR-042) is explicitly excluded when shipped.
- FR-020: After each cycle, user completes a mindful check-in by selecting one of three energy states: "Focused" (ready for demanding work), "Steady" (can work but not peak), "Fading" (low energy, prefer light tasks or stop). Priority: must-have
  > Socrates: Counter-argument considered: "check-in fatigue — after 6+ cycles the user will click through without thinking, making the data meaningless." Resolution: kept; the check-in is intentionally minimal (one tap from 3 options); if fatigue occurs, that itself is a signal the session should end.
- FR-021: System suggests the next task based on deterministic scoring (urgency × importance × work type fit × session context × effort × commitment horizon). Priority: must-have
  > Socrates: Counter-argument considered: "a deterministic formula may feel robotic or wrong — users might distrust suggestions they can predict." Resolution: kept; predictability builds trust; the user always sees the rationale and can override; a black-box model would be worse for trust.
- FR-022: User can accept the suggestion or manually override with a different task. Priority: must-have
  > Socrates: Counter-argument considered: "allowing override means users can ignore the system entirely, reducing it to a fancy task list." Resolution: kept; override preserves autonomy — the value is in the suggestion + rationale, not in enforcement; forced compliance would undermine the mindfulness premise.
- FR-026: When idle at session start or after break with no pre-selected task, user sees a suggested task with one-line rationale and may accept one-tap work-cycle duration presets matched to work type (tap-to-apply only; remembers last accepted duration per type). Priority: must-have
- FR-027: When check-in energy is Fading and session fatigue signals align, user receives an optional dismissible prompt to end the session with one-line rationale — and may override to continue. Priority: must-have
- FR-029: When user overrides a suggested task (post-check-in or kickoff), they see a brief neutral validating acknowledgement line — no guilt or patronizing copy. Priority: must-have
- FR-032: User can tap "Why this?" on the suggestion card for a deterministic factor breakdown — no analytics screen. Priority: must-have
- FR-033: User declares Focused/Steady/Fading at session kickoff and before next-task suggestion when no check-in gate is active — energy feeds the scorer instead of a hardcoded default. Priority: must-have
- FR-040: User sees a lightweight session narrative: in-flow one-line summary during session, calm closure line on session end, and on return after more than 8 hours a single dismissible handoff composing closure and resume note (max two clauses) — without charts or trends. Priority: must-have
- FR-043: User can mark tasks as daily standing items; they roll into today's plan with a focus-hours budget; suggestions include capacity-aware rationale (no recurring rule engine / RRULE). Priority: must-have

### Onboarding & visual well-being

- FR-025: On first visit, user follows a dismissible first-run flow teaching check-in → suggestion wedge; empty active list shows ongoing guidance; first check-in and first suggestion include inline coach copy (subcopy only). Priority: must-have
- FR-039: User sees a cohesive Serene Pastel well-being visual design on home, wedge overlays, and auth surfaces — calm, not generic boilerplate. Priority: must-have
- FR-044: User sees Calm Garden illustration system on home accent, atmosphere, and empty active-task state — shared visual primitives, no decorative clutter on wedge gates. Priority: must-have

## Non-Functional Requirements

- User sees acknowledgement of any action (task add, cycle start, check-in) within 200ms. Operations requiring longer processing (suggestion generation) provide continuous visible feedback if they exceed 1s.
- A configured Pomodoro cycle does not drift by more than ±2 seconds from the set duration, regardless of whether the browser tab is active or in the background.
- A browser crash, page refresh, or connection loss does not cause loss of: task list, cycle configuration, or current session state. The user returns to the state before the interruption.
- One user's data (tasks, session history, check-ins) is never visible to another user. No query returns cross-account data.
- Mental state data (check-in responses, energy patterns) does not leave the system in a form that enables user identification. It is not shared with third parties or used for purposes other than generating suggestions for the same user.
- The product works correctly on the two latest major versions of Chrome, Firefox, Safari, and Edge (desktop).
- Session history (completed cycles, check-ins, suggestions) remains accessible to the user for a minimum of 90 days. After that period it may be archived but not deleted without warning.

## Business Logic

FlowState observes the user's session state (interruption count, completed cycles, time of day, declared energy at each transition) and suggests which task to work on next — matching work type and task attributes to current focus capacity while enforcing mindful transitions between cycles.

**Inputs the rule consumes (user-facing):**
- Task urgency (1–3), importance (1–3), optional effort estimate (minutes), commitment horizon (ASAP / this week / when possible)
- Task work type (deep work / admin / reactive)
- Mindful check-in or pre-suggestion readiness response (Focused / Steady / Fading)
- Manual task order (tie-breaker only)
- Resume note (display and context recovery; does not override scoring rank)

**Inputs the rule consumes (session-derived):**
- Number of Pomodoro cycles completed in the current session
- Number of interruptions (task switches, mid-cycle completions — not pause/resume per FR-042)
- Time of day
- Recent override decisions

**Output:**
A ranked suggestion of which task to work on next with a one-line rationale and optional factor breakdown. High energy and low interruption favor demanding deep work; low energy, high interruptions, or late session favor lighter admin/reactive tasks and lower-effort options.

**How the user encounters it:**
At session kickoff when idle, after every cycle-end check-in, and during breaks — the system presents a suggested next task. The user accepts with one click, applies optional duration presets, or overrides without penalty. Wind-down and session narrative reinforce calm closure without analytics dashboards.

## Access Control

Authentication: login required for account-backed, cross-device data (email + password, OAuth social login, or passwordless — exact mechanism is downstream). Each authenticated user accesses only their own server data. Optional guest trial on `/` uses device-local storage only until the user registers or signs in and imports guest work into their account (FR-003b, FR-003c).

Role model: flat — every logged-in user has identical capabilities. No admin surface, no role-based permission boundaries.

## Non-Goals

- No mobile app or native push notifications — browser-only; in-tab signals and optional title/favicon pulse when muted only.
- No historical analytics or dashboards — session history is stored per NFR, but no charts, trends, weekly reports, or pattern visualizations.
- No team or social features — no shared tasks, no team visibility, no manager view. Single-user experience only.
- No AI/ML-powered scoring — deterministic formula only; no trained model or LLM personalization.
- No integrations with external tools — no import/export in current scope.
- No full RRULE / habit tracker — daily standing tasks (FR-043) use a boolean flag and local-day reset, not recurring rule engines.
- No Eisenhower 2×2 matrix screen — attributes feed scoring only; no quadrant dashboard.

## Open Questions

1. **What are the exact weights and thresholds in the scoring formula (v2)?** — Directional behavior is implemented; coefficients for Eisenhower/Pareto/Ockham branches, late-day threshold, and capacity decrement (FR-043) remain tunable after real usage. Owner: implementer. Block: no.
2. **Which transition surfaces may fire on the same beat?** — Check-in, suggestion, FR-041 copy, FR-040 narrative, FR-029 ack — orchestrator rule: at most one interstitial line plus one gate per transition. Owner: implementer. Block: no for individual slices; yes for polish pass.
3. **Does pause (FR-042) reset the 4-hour session inactivity timeout?** — Owner: user. Block: yes for `/10x-plan` on cycle-pause-resume.
4. **Local-day reset semantics for daily standing tasks (FR-043)?** — Owner: implementer. Block: yes for daily-standing-tasks-capacity-plan slice.
5. **Guest mode scope for FR-040 narrative and FR-041 copy?** — Omit, shorten, or derive from local blob only? Owner: user. Block: no.
