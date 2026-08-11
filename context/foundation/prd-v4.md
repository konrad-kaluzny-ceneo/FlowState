---
project: "FlowState"
version: 4
status: draft
created: 2026-08-11
updated: 2026-08-11
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
supersedes_for:
  - "Day schedule, habit activation, GTD/Atomic Habits operating model — builds on prd.md v3"
  - "Habit-return / named-methodology expand (batch-8-habit-return-methodology) — absorbed into day-open + attention signals; not separate roadmap IDs"
amends_non_goals:
  - "No full recurring rule engine (§Non-Goals v3) — RRULE schedule patterns in scope for v4"
  - "Plan dnia budget-only / no timeline (ui-refactor thread) — real daily time axis in scope for v4"
  - "In-tab signals only (v3) — browser notification carve-out extended for calm day-start nudge (≤1/local day), same precedent as break-alerts"
absorbs_expand:
  - "context/foundation/roadmap-references/expand-batches/batch-8-habit-return-methodology.md → FR-008/019 (S-59), FR-013/020 (S-60)"
source_shape_thread: "context/foundation/shape-notes.md#change-thread-prd-v4--day-schedule-habit-activation-gtdatomic-habits"
---

## Current System Overview

FlowState is a shipped single-user web app for interrupt-driven knowledge work. A logged-in user manages tasks, runs Pomodoro cycles linked to a selected task, completes mindful energy check-ins at cycle boundaries, and receives deterministic next-task suggestions with one-line rationale — always with override freedom.

**Architecture:** Next.js App Router monolith with tRPC API layer, Prisma ORM on Neon Postgres, deployed on Vercel with GitHub Actions CI.

**Auth:** Neon Auth — email/password, Google OAuth, password recovery; optional guest trial with device-local storage and transactional merge on sign-in.

**User base:** Small scale — solo builder plus early users; interrupt-driven knowledge workers (developers, analysts, team contributors).

**Core functionality today (PRD v3 horizon shipped):** Five-section nav (Fokus / Zadania / Plan dnia / Podsumowanie / Ustawienia); full wedge loop with transition conductor; focus-hours budget and daily standing tasks (S-27); day memory and analytics in Podsumowanie (S-42, S-48); honest focus and break time totals (S-52); out-of-tab break alerts; MCP for agents.

**Plan dnia gap:** The view shows a focus-hours budget panel and a blurred **“Kalendarz wkrótce”** placeholder — not a real schedule. Standing tasks are edited on task detail, not on Plan dnia. Plan dnia and Fokus are not connected by a start-from-plan handoff.

## Problem Statement & Motivation

**Pain:** The user forgets to open FlowState and start work. Plan dnia promises a daily schedule but delivers only a placeholder. Daily planning (e.g. 15 minutes) happens outside the app and is untracked. Atomic Habits “make it obvious” and GTD batching (similar tasks at a fixed time, e.g. several phone calls at 10:00) are unsupported. Returning on a new local day with a stale prior-day session shows a false break prompt. There is no measure of time spent **outside** Pomodoro sessions during declared work windows.

**Person:** Dynamic Knowledge Worker — developer/analyst with interrupt-driven days.

**Moment:** Morning (plan the day, forget to start the timer); mid-day (batch work in a time slot); evening (compare plan vs execution and in-session ratio).

**Cost today:** FlowState is a timer and task list, not the **operating system of the workday**. Habit formation lacks scheduled cues in time. Cross-day session state erodes trust on return.

**Why now:** PRD v3 horizon slices (S-01–S-52) are done. The “Kalendarz wkrótce” mock must become real capability or be removed. User explicitly requests PRD v4 to enable true day scheduling, RRULE recurrence, planning-as-work time, activation signals, and off-session metrics.

**Insight:** Habit formation requires **scheduled cues in time** (Atomic Habits implementation intentions) plus **honest measurement** of in-session vs off-session time within user-declared work segments — without streak-shaming or punitive copy.

## User & Persona

**Primary persona: The Dynamic Knowledge Worker** — unchanged from PRD v3.

A developer, analyst, or team contributor whose workday is genuinely interrupt-driven. They reach for FlowState to answer “what do I do *right now*?” and recover context after interruption.

**PRD v4 delta:** The same persona now **plans the day in time** (schedule blocks, RRULE patterns), **batches similar work** (GTD), **tracks planning as work**, **starts focus from the plan**, and **improves in-session ratio** over weeks using calm analytics — not guilt.

## Success Criteria

### Primary

- A logged-in user plans a local day with **time blocks** (focus, meeting, break, personal, **planning**, **batch/context**), materializes **RRULE patterns** onto days, starts focus from a block in ≤2 actions, and completes ≥1 Pomodoro linked to the plan.
- User can run a **planning session** (“teraz planuję”); elapsed time counts as **work time** (planning category) in day totals.
- On **first visit of a new local day** with a stale prior-day session, user sees calm **day-open steering** — not a spurious break prompt.

### Secondary

- User defines **work-day segment(s)** (start/end work, multiple per day) and sees **off-session time** and **in-session %** trend in Podsumowanie.
- User who opts in receives calm **browser notification** (≤1 per local day) and/or **title/favicon pulse** (and, when installed, optional badge) when idle/kickoff-ready, unfinished plan, or a scheduled block starts while the tab is not focused.
- Podsumowanie compares **planned blocks vs actual** focus, planning, and break time (extends S-48 plan-vs-execution).
- User can **name and recall** the in-session loop as a short teachable method (≈5 beats, “Co teraz?” framing) without a second product or streak checklist.
- User can **install** FlowState as a desktop PWA (manifest + calm install affordance) so opening the day’s methodology is one dock/taskbar click — no service-worker push.

### Guardrails

- Wedge transition conductor mutex preserved — at most one interstitial line plus one gate per beat.
- Schedule and RRULE **propose**; user always overrides; no auto-start Pomodoro without explicit action.
- No streak-shaming or punitive copy for missed blocks or sessions.
- Timer accuracy ±2 seconds; no silent data loss on cross-day recovery or guest merge.
- Deterministic scorer unchanged — no ML personalization.
- External calendar import/sync **out of scope** for v4.
- PRD v3 user stories **US-01–US-07** and their guardrails remain in force unless explicitly modified above.

## User Stories

### US-08: User plans day with time blocks

- **Given** a logged-in user on Plan dnia
- **When** they add and resize blocks on the daily time axis (including planning and batch types)
- **Then** blocks persist for that local day and replace the “Kalendarz wkrótce” placeholder
- **Before:** only focus budget plus blurred mock calendar.

### US-09: User applies recurring schedule patterns

- **Given** a logged-in user with an RRULE pattern (e.g. Mon–Fri 9:00 daily planning block)
- **When** a new local day begins and they open Plan dnia
- **Then** blocks materialize from the pattern and remain editable for that day without breaking the pattern
- **Before:** no recurrence beyond boolean daily standing tasks.

### US-10: User starts focus from plan block

- **Given** a logged-in user with an upcoming or current focus block
- **When** they tap start from Plan dnia
- **Then** they land on Fokus with kickoff suggestion respecting block context and standing tasks
- **Before:** Plan dnia and Fokus were disconnected.

### US-11: User day-open on return

- **Given** a returning user on first visit of a new local day with prior history (including after only 1–2 prior sessions)
- **When** they open FlowState idle with zero cycles today
- **Then** they see day memory (“Wróć tutaj” / prior close cue when present) and **one** dominant F-07-gated path to plan or start the next block / kickoff — not a false break state, not a streak nudge, not a second first-run modal
- **Before:** day memory hidden on calm landing; cross-day stale session confused state; no deliberate next-day activation bridge.
- **Absorbs:** habit-return expand P-102 (next-day return), thin P-109 (no MIT triad), progressive coach beat from P-104 when still early in product literacy.

### US-12: User tracks plan vs execution

- **Given** a logged-in user with planned blocks and completed sessions
- **When** they open Podsumowanie for that day
- **Then** they see planned vs actual (focus, planning, breaks) including in-session % within work segments
- **Before:** S-48 trends without schedule blocks or off-session metric.

### US-13: User receives calm attention signals

- **Given** a user who opted in and has kickoff-ready state, an unfinished planned day (blocks or standing commitments present, no session started), or scheduled block start while the tab is backgrounded
- **When** eligibility conditions are met (≤1 notification per local day; pulse stops on session start or focus)
- **Then** browser notification and/or title/favicon pulse (optional installed badge for unfinished plan) draws attention without notification-hub behavior or streak language
- **Before:** out-of-tab alerts only on break start.
- **Absorbs:** habit-return expand P-106 (unfinished-day title/badge cues).

### US-14: User runs planning session

- **Given** a logged-in user in a planning block or who taps “Teraz planuję”
- **When** they start and end a planning session
- **Then** elapsed time counts as work (planning category) in day totals
- **Before:** planning was untracked and indistinguishable from idle time.

### US-15: User batches similar tasks in one slot

- **Given** a logged-in user with a batch block (e.g. “Telefony 10:00–10:30”)
- **When** they attach multiple tasks to the block
- **Then** they can work through the batch with context visible; suggestion respects batch context when starting focus from the block
- **Before:** no batch slot; tasks only in a flat list.

### US-16: User declares work-day segments

- **Given** a logged-in user
- **When** they tap Start dnia pracy / Koniec dnia pracy (possibly multiple segments per day)
- **Then** off-session time accrues only inside active segments
- **Before:** no work-window concept.

### US-17: User improves in-session ratio over time

- **Given** a logged-in user with at least two weeks of segment data
- **When** they view Podsumowanie trends
- **Then** they see a calm trend of in-session % without streak language
- **Before:** no off-session metric.

### US-18: User not misled by cross-day stale session

- **Given** a logged-in user whose session/cycle was active across local midnight
- **When** they open the app on the new local day
- **Then** the prior day closes calmly and the UI reflects a fresh day (no spurious break prompt)
- **Before:** the app suggested break though the user had just started the second day.

### US-19: User recalls the named in-session method

- **Given** a logged-in user who has completed at least one real session (or returns after 1–2 sessions)
- **When** they see day-open coaching or wedge transition chrome
- **Then** the existing loop is labeled as a short named method (≈5 beats: Steer → Suggest → Focus → Check → Close — exact EN/PL TBD under F-14) mapped 1:1 to shipped beats — no new gates, no completeness checklist, no streak
- **Before:** methodology existed only as lived behavior; users could not retell it like GTD / Atomic Habits.
- **Absorbs:** habit-return expand P-101 (Co teraz? five), P-103 (method-step beat cues as chrome on existing interstitial/gate), progressive map from P-104; rejects P-111 completeness glance.

### US-20: User installs FlowState for one-click return

- **Given** a user on a supported desktop browser
- **When** they install via calm Ustawienia / browser affordance (manifest + icons)
- **Then** they can reopen FlowState as a standalone window from dock/taskbar — no service-worker push; install enables optional Badging for unfinished-day cues (US-13)
- **Before:** web tab only; no install path.
- **Absorbs:** habit-return expand P-105 (`pwa-installable-shell`).

## Scope of Change

### New capabilities (must-have)

- [new] **Daily time axis** — view and edit blocks on Plan dnia: focus, meeting, break, personal, **planning**, **batch/context**. Replaces “Kalendarz wkrótce” mock. Refs: US-08, FR-001.
- [new] **Block attachments** — zero or one focus task per focus block; multiple tasks per batch block (GTD). Refs: US-15, FR-002.
- [new] **RRULE recurrence** — recurring patterns materialize blocks onto future local days; per-day edits do not break the pattern. Refs: US-09, FR-003.
- [new] **GTD context** — bounded context (e.g. phone, computer, office) on blocks and/or batch task filter. Refs: FR-004.
- [new] **Planning session mode** — distinct from focus Pomodoro; elapsed time counts as work; no wedge check-in/suggestion gates during planning. Refs: US-14, FR-005.
- [new] **Default daily planning block** — e.g. 15 minutes via schedule or RRULE. Refs: FR-006.
- [new] **Plan-to-focus handoff** — start from Plan dnia block → Fokus + kickoff suggestion. Refs: US-10, FR-007.
- [new] **Day-open steering** — first visit of new local day (zero cycles today): day memory + next block or kickoff path; single F-07-gated beat; includes next-day return activation and early progressive loop literacy (not a second first-run modal). Refs: US-11, US-19, FR-008, FR-019.
- [new] **Work-day segments** — user-declared start/end work (multiple per day). Refs: US-16, FR-009.
- [new] **Off-session time metric** — within active segments: segment elapsed minus focus, planning, and break session time. Refs: US-16, US-17, FR-010.
- [new] **In-session % in Podsumowanie** — extends plan-vs-execution analytics. Refs: US-12, US-17, FR-011.
- [new] **Calm day-start browser notification** — opt-in, ≤1 per local day when tab not focused and kickoff-ready or block start. Refs: US-13, FR-012.
- [new] **Idle / unfinished-day title/favicon pulse** — when tab open and idle/kickoff-ready or planned day unfinished, until session starts or tab focused; respects reduced-motion; optional installed badge. Refs: US-13, FR-013.
- [new] **Named Co teraz? method packaging** — teachable ≈5-beat labels on day-open / existing wedge chrome (F-14 voice); no new product surface stack. Refs: US-19, FR-019.
- [new] **Installable desktop PWA shell** — manifest + icons + calm install affordance; no SW push. Refs: US-20, FR-020.

### Modified behavior

- [modified] **Cross-day session recovery** — on local date rollover, stale prior-day session/cycle closes calmly; day-open does not show false break. Refs: US-18, FR-014.
- [modified] **US-03 daily planning** — Plan dnia is harmonogram + budget + standing commitments, not budget-only.
- [modified] **Podsumowanie analytics** — plan-vs-execution includes schedule blocks, planning time, off-session % (extends S-48).
- [modified] **Kickoff/suggestion inputs** — active block context may inform scorer; override freedom unchanged.
- [modified] **Wind-down / closure (optional thin trail)** — at session wind-down, user may optionally leave one tomorrow cue that seeds next day-open (not a full Daily Shutdown ritual). Refs: US-11, FR-008; absorbs habit-return P-108.

### Preserved behavior

- [preserved] Wedge check-in → suggestion → break flow with transition conductor mutex (F-07). Refs: FR-015.
- [preserved] Honest focus and break time totals including partial cycles (S-52); planning time is a separate category — no double-count. Refs: FR-016.
- [preserved] Guest trial narrower than authenticated product; schedule parity TBD in Open Questions. Refs: FR-017.
- [preserved] Deterministic task suggestion; user override never penalized. Refs: FR-018.
- [preserved] All PRD v3 guardrails: no silent data loss, ±2s timer, per-account isolation, calm product voice.
- [preserved] Break-alerts out-of-tab behavior unchanged when enabled.

### Removed

- [removed] **“Kalendarz wkrótce” placeholder** as the target UX for Plan dnia — replaced by real schedule (mock may remain for guest/disabled until parity decided).

### Functional requirements (traceability)

Requirements from shaping; `Change:` tags map to Scope categories above.

#### Day schedule and recurrence

- FR-001: User can view and edit a daily time axis with blocks (focus, meeting, break, personal, planning, batch/context). Priority: must-have. Change: new
  > Socrates: Counter-argument: duplicates mock calendar without value. Resolution: mock is removed/replaced; blocks persist and drive activation metrics.
- FR-002: User can attach zero or one focus task per focus block; multiple tasks per batch block (GTD). Priority: must-have. Change: new
  > Socrates: Scope creep vs task list. Resolution: batch block is explicit GTD batching — kept.
- FR-003: User can define recurring patterns (RRULE) that materialize blocks onto future local days; user can edit a day without breaking the pattern. Priority: must-have. Change: new
  > Socrates: RRULE complexity vs boolean standing (S-27). Resolution: user explicitly chose full RRULE; amends v3 non-goal.
- FR-004: User can assign GTD context (e.g. phone, computer, office) to blocks and/or filter batch tasks by context. Priority: must-have. Change: new
  > Socrates: Tag taxonomy creep. Resolution: bounded context enum — not full project system.

#### Planning as work

- FR-005: User can start a planning session distinct from focus Pomodoro; elapsed time counts toward work time and appears separately in Podsumowanie. Priority: must-have. Change: new
  > Socrates: Planning session bypasses wedge. Resolution: no check-in/suggestion gates during planning — kept by user request.
- FR-006: User can schedule a default daily planning block (e.g. 15 min) via schedule or RRULE. Priority: must-have. Change: new
  > Socrates: Overlap with FR-005. Resolution: FR-006 is schedule slot; FR-005 is runtime mode — both kept.

#### Activation and handoff

- FR-007: User can start focus from a plan block (Plan dnia → Fokus + kickoff suggestion). Priority: must-have. Change: new
  > Socrates: Duplicates idle kickoff (S-15). Resolution: explicit plan→do bridge; conductor mutex defines precedence.
- FR-008: On first visit of a new local day (no cycles today), user sees day-open steering — day memory (including “Wróć tutaj” / optional authored tomorrow cue from prior wind-down) + next block or kickoff path; early users may see one progressive loop-map line — still a single F-07-gated beat; no streak language. Priority: must-have. Change: new
  > Socrates: Overlays stack with energy gate. Resolution: single F-07-gated day-open beat. Absorbs habit-return P-102/P-104/P-108.

#### Work-day segments and off-session metrics

- FR-009: User can declare work-day segment(s) (start work / end work) one or more times per local day. Priority: must-have. Change: new
  > Socrates: Manual burden. Resolution: user explicitly wants definable segments — kept.
- FR-010: Within active segments, app tracks off-session time (segment elapsed minus focus, planning, and break session time). Priority: must-have. Change: new
  > Socrates: Surveillance feel. Resolution: calm analytics only; no alerts or shame copy.
- FR-011: User sees in-session % and trend in Podsumowanie (extends plan-vs-execution). Priority: must-have. Change: modified
  > Socrates: Analytics non-goal. Resolution: carve-out same as S-48 Podsumowanie charts.

#### Attention signals

- FR-012: While idle/kickoff-ready or at scheduled block start, user can opt into browser notification (≤1/day calm nudge) when tab not focused. Priority: must-have. Change: new
  > Socrates: Notification hub. Resolution: single opt-in nudge; break-alerts precedent.
- FR-013: While tab open and idle/kickoff-ready **or** planned day unfinished (blocks/standing present, no session started today), user sees calm title/favicon pulse until session starts or tab focused; when installed (FR-020), optional Badging API for unfinished plan — no streak encoding. Priority: must-have. Change: new
  > Socrates: Annoying pulse. Resolution: S-20 reduced-motion pattern; stop on start. Absorbs habit-return P-106.

#### Methodology packaging & install (habit-return absorb)

- FR-019: User sees the in-session loop packaged as a named ≈5-beat method (“Co teraz?” framing; exact labels under F-14) on day-open and as quiet chrome on existing wedge beats — no new gates, no completeness checklist. Priority: must-have (craft). Change: new
  > Socrates: Second framework product. Resolution: labels map 1:1 to shipped beats only; absorbs P-101/P-103; rejects P-111.
- FR-020: User can install FlowState as a desktop PWA (manifest + icons + calm install affordance); no service-worker push; enables optional badge path for FR-013. Priority: must-have (platform). Change: new
  > Socrates: Safari/Firefox install variance. Resolution: Chromium-first calm path + honest fallback copy; absorbs P-105.

#### Correctness

- FR-014: On local date rollover, stale prior-day session/cycle is calmly closed; day-open does not offer false break. Priority: must-have. Change: modified
  > Socrates: Auto-close vs data loss. Resolution: closure preserves S-52 totals; no silent loss.

#### Preserved (defensive)

- FR-015: Wedge check-in → suggestion → break flow with conductor mutex unchanged. Priority: must-have. Change: preserved
- FR-016: Focus and break time totals (S-52) remain honest for partial cycles. Priority: must-have. Change: preserved
- FR-017: Guest trial remains narrower than authenticated product. Priority: must-have. Change: preserved
- FR-018: Deterministic task suggestion; user override freedom. Priority: must-have. Change: preserved

## Constraints & Compatibility

- **Backward compatibility:** Existing tasks, sessions, cycles, day-plan budget/energy, guest merge, and wedge flow must continue working. Schedule and segment data are **additive** extensions keyed to the same local day as the existing day plan.
- **Day plan merge:** Focus-hours budget and energy level remain on the existing day-plan record for a local date — not a duplicate day model.
- **Standing tasks:** Boolean daily standing (`isDailyStanding`) remains; mapping to plan panel and batch blocks — see Open Questions.
- **Cross-day recovery:** Must not lose S-52 totals or day-memory anchors; closure copy is calm, not punitive.
- **Guest scope:** Guest schedule may be device-local with reduced parity — see Open Questions; guest wedge stack remains narrower than auth.
- **RRULE:** Local timezone; materialization on day open or first Plan dnia visit; week view deferred to v4.1 phase within this PRD contract.
- **Planning vs focus:** Planning session time is a separate work category in day totals — must not double-count as focus or break.
- **Integrations:** No Google/Outlook/ICS in v4; MCP unchanged.
- **Preserved SLAs from PRD v3:** User-perceived acknowledgement ≤200ms for schedule block edits; cross-day recovery before day-open renders without false break flash (target ≤1s); RRULE materialization for one day perceived ≤200ms on Plan dnia open; notification and favicon signals respect reduced-motion preference; per-account data isolation.
- **Phased delivery:** Implementation expected across multiple roadmap slices (see shape-notes forward block); `delivery_weeks: 0` — continuous after-hours iteration.

## Business Logic Changes

**Current rule (PRD v3):** FlowState observes session state and task attributes and suggests which task to work on next while enforcing mindful wedge transitions; daily planning is focus-hours budget plus boolean standing tasks at local midnight reset.

**New rule (v4):** A local workday is a user-authored **time contract** (blocks + optional RRULE patterns + work segments); FlowState measures execution against that contract and proposes focus entry points — it never auto-starts work or punishes missed blocks.

**Changes:**

1. **Schedule contract:** Blocks on the daily axis are the user's plan in time. RRULE patterns materialize **proposals** editable per day without breaking the pattern.

2. **Planning as work:** Planning session elapsed time is a first-class work category separate from Pomodoro focus and breaks; it does not trigger wedge gates.

3. **GTD batching:** Batch blocks hold multiple tasks for context-based work (e.g. phone calls in one slot); focus blocks allow at most one attached task.

4. **Work segments and off-session time:** Off-session time = active segment elapsed minus (focus + planning + break session time). Metric is for calm self-improvement — no streak or guilt copy.

5. **Scorer input (optional):** Active block context may inform kickoff/suggestion; user override always available.

6. **Cross-day boundary:** Local date rollover triggers calm closure of stale prior-day session state before day-open steering.

7. **Named method packaging:** The shipped wedge loop is teachable as ≈5 labeled beats on day-open and existing transition chrome — packaging only; conductor and scorer rules unchanged.

8. **Install for return:** Desktop PWA install is an activation affordance for reopening the day contract — not a push channel.

## Access Control Changes

No access control changes — current model preserved. Single-user flat role model. Schedule, RRULE patterns, work-day segments, and planning sessions are scoped per authenticated account; guest follows existing device-local rules where schedule is supported.

## Non-Goals

- **Avoid:** Google/Outlook/ICS import or two-way sync in v4 — deferred to a future thread.
- **Avoid:** Native mobile push notification hub — browser notification carve-out only (≤1 calm nudge per local day), same family as break-alerts.
- **Avoid:** Full GTD system — no someday/maybe backlog, weekly review project management, or reference filing beyond the daily planning session and batch blocks.
- **Avoid:** AI/ML schedule optimization or auto-rescheduling.
- **Avoid:** Streak counters, guilt copy, or punitive missed-block alerts — includes parked habit-return P-106 streak nudge and P-111 methodology-completeness checklist.
- **Avoid:** Physical environment blocking — S-49 workspace coaching remains advisory only.
- **Avoid:** Team/shared calendars or multi-user scheduling.
- **Avoid:** Replacing the wedge loop with calendar-driven auto-timer — schedule proposes; user starts explicitly.
- **Avoid:** Full external notification aggregation — unchanged from PRD v3.
- **Avoid:** Session Work Mode Guard / workType-driven conductor beat-density profiles (habit-return P-110 revise / beat-profiles reject) — batching is via **schedule batch blocks** (US-15), not alternate wedge profiles or multi-task-in-one-Pomodoro (ops-batch reject).
- **Avoid:** Authored start-work ritual checklist competing with kickoff (habit-return P-112).
- **Avoid:** Scoring “laws” lecture UI as a separate product surface (habit-return P-107) — optional calm factor wording may follow F-14 later outside this must-have set.
- **Avoid:** Service-worker push or offline-first shell beyond installability (FR-020) — no native push by another name.

## Open Questions

1. **Guest schedule parity** — full local schedule for guest or auth-only? Owner: user. Block: no (plan may default auth-first).
2. **Batch block UX** — checklist of tasks vs single meta-task “Telefony”. Owner: user. Block: no.
3. **Context enum** — fixed set (Phone/Computer/Office/…) vs user-defined tags. Owner: user. Block: no.
4. **Work segment start** — manual button only vs offered at day-open. Owner: user. Block: no.
5. **Off-session while in app** — count idle time on FlowState without running timer, or only segment-minus-sessions. Owner: implementer. Block: no.
6. **Cross-day close trigger** — automatic at local midnight vs prompt on first open. Owner: implementer. Block: no for bug-fix slice.
7. **Week view in v4.1** — must ship in first code phase or after day axis stable. Owner: user. Block: no.
8. **Planning session UI** — dedicated timer surface vs minimal banner on Plan dnia. Owner: implementer. Block: no.
9. **Method beat labels (EN/PL)** — exact five names for FR-019 under F-14 voice. Owner: user. Block: no for S-59 ship (placeholders OK).
10. **PWA phase order** — ship FR-013 title pulse before FR-020 install, or install first for badge? Owner: implementer. Block: no (S-60 may phase).
11. **Tomorrow cue at wind-down** — skippable invite vs omit until day-open alone proves enough. Owner: user. Block: no.
