---
project: "FlowState"
version: 3
status: draft
created: 2026-06-13
updated: 2026-06-27
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
active_change_threads:
  - id: break-alerts-out-of-tab
    shaped: 2026-06-18
    prd_added: 2026-06-18
    status: draft
    version: 1
    timeline_budget:
      delivery_weeks: 2
      hard_deadline: null
      after_hours_only: false
  - id: timer-change-impact-digest
    shaped: 2026-06-18
    prd_added: 2026-06-18
    status: draft
    version: 1
    product_type: cli
    timeline_budget:
      delivery_weeks: 1
      hard_deadline: null
      after_hours_only: true
  - id: revisit-user-choices
    shaped: 2026-06-19
    prd_added: 2026-06-19
    status: draft
    version: 1
    timeline_budget:
      delivery_weeks: 2
      hard_deadline: null
      after_hours_only: false
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

### US-05: User keeps active task list lean via stale-task archive

- **Given** a logged-in user with active tasks that have had no user touch for three or more days
- **When** they open the home task inventory or the dedicated archive view
- **Then** those stale tasks no longer appear in the default active list, they are listed in the archive view, and the user can select multiple archived tasks and permanently remove them in one action
- **Before:** all active tasks stayed in one list regardless of age; no bulk permanent delete in archive.

Value: zwiększenie przejrzystości aplikacji przez zmniejszenie liczby wyświetlanych tasków.

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
- [new] Stale-task archive — active tasks with no user touch for three or more days leave the default list and appear in a dedicated archive view; user can permanently remove multiple archived tasks in one action. Refs: US-05.

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
- **Task archive:** Auto-archive applies only to stale active tasks; mark-done completion semantics unchanged. Archived tasks are excluded from the wedge suggestion pool until restored or permanently removed.
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

---

## Change thread PRD: Break alerts outside active tab (narrow MVP)

**Thread version:** 1  
**Status:** draft  
**Created:** 2026-06-18  
**Context type:** brownfield (delta on PRD v3 above)  
**Shape source:** `shape-notes.md` — Change thread: Break alerts outside active tab  
**Mom Test:** Self-assessment sufficient; full Work Mode Guard deferred.

> **Note on PRD v3 Non-Goals:** v3 states in-tab signals only (no native mobile push). This thread adds **browser system notifications** when the app tab is not focused — not native push, not a mobile app. v3 non-goal on native push remains; out-of-tab browser alerts are an explicit exception for break reachability.

### Current System Overview

**Baseline:** PRD v3 FlowState — timed work sessions with breaks, guest and authenticated paths, in-tab cycle-end alarm, catch-up overlays when the user returns after a cycle completed while away.

**Relevant today:** Break and cycle-end signals reach the user reliably when FlowState is the active browser tab. When the user works in other tabs, break reminders are easy to miss — no out-of-tab alert reaches them.

**Users affected:** Existing users on reactive, interrupt-driven days — especially knowledge workers who context-switch frequently (primary persona unchanged; this thread serves the reactive-day subset).

### Problem Statement & Motivation

**Pain:** On reactive work days, users run continuous sessions and skip breaks until fatigue or hunger — not because the timer is off, but because break reminders do not reach them when FlowState is not the active browser tab.

**Person:** Knowledge worker (friction owner) juggling parallel projects and firefighting days.

**Moment:** Timer transitions to a break while the user is in another tab; the break passes unnoticed.

**Cost today:** Physiological breaks happen only when the body forces them. Prior attempts (alarms, calendar, screen blockers, other Pomodoro tools) were ignored or disabled because they were irritating or easy to dismiss.

**Why now:** Mom Test validation (2026-06-18) on opportunity-map signal 4 → narrow scope accepted. Fix reachability before investing in session profiles or mode-guard logic.

**Insight:** The gap is **reachability of the break signal outside the active tab**, not absence of a timer.

### User & Persona

**Primary persona for this change: Reactive-day knowledge worker** — subset of the Dynamic Knowledge Worker.

- Uses FlowState during work blocks but frequently switches to other browser tabs.
- Needs one calm, dismissible signal when a break starts while they are not viewing FlowState.
- Prior behavior: disabled or ignored reminder tools that felt nagging; requires one-action opt-out.

No new persona tier; guest and authenticated users both affected equally.

### Success Criteria

#### Primary

- Over a 2-week observation window on reactive days: **≥1 conscious break per such day** where the user noticed the break because of an out-of-tab alert (not only fatigue/hunger).
- Break-start alert fires when the app tab is not focused and notification permission is granted.

#### Secondary

- User completes first-session notification explain and grant flow (or consciously skips with a visible settings path to enable later).

#### Guardrails

- Existing in-tab timer, audio modes (normal / soft / muted), pause, and catch-up overlays behave as before when the tab is focused.
- User can disable out-of-tab break alerts in **one settings action** without losing in-tab timer functionality.
- **No work blocking** during real incidents — alerts are informational only.
- **At most one notification per break start** — no nag loops.
- Tone: calm, not punitive; no streak shaming.
- A configured Pomodoro cycle does not drift by more than ±2 seconds (PRD v3 guardrail preserved).

### User Stories

#### US-01: Break noticed while working in another tab

- **Given** a user with notification permission granted who started a work session and switched to another browser tab
- **When** the timer transitions to a break while the app tab is not focused
- **Then** they receive a system notification about the break and, where the browser allows, hear the break alarm without returning to the tab first
- **Before:** break signals were in-tab only; breaks were easy to miss when working elsewhere.

#### Acceptance Criteria

- Notification appears only when the app tab is not focused at break start
- Notification copy indicates break started (stand / water — physiological minimum, not moralizing)
- Activating the notification focuses the FlowState tab
- If notification permission denied, user still gets best-effort background audio within browser policy; settings show how to enable notifications

#### US-02: First session notification setup

- **Given** a user who has not yet been prompted for notification permission
- **When** they start their first timed session
- **Then** they see a short explain why out-of-tab alerts help and a single action to enable notifications (browser permission prompt follows)
- **Before:** no out-of-tab alert path existed.

#### Acceptance Criteria

- Prompt shown once per browser profile (not on every session)
- Skipping leaves a clear path in settings to enable later
- Explain mentions easy disable — addresses prior pattern of abandoning irritating apps

### Scope of Change

#### New capabilities

- [new] First-session explain and browser notification permission grant for out-of-tab break alerts.
- [new] System notification when a break starts while the app tab is not focused.
- [new] One settings action to disable all out-of-tab break alerts (notifications and background break-audio path).

#### Modified behavior

- [modified] Break alarm when tab is backgrounded — best-effort audible alert within browser autoplay and visibility policy (was: in-tab alarm only; breaks silently missed off-tab).

#### Preserved behavior

- [preserved] In-tab cycle completion, audio modes (normal / soft / muted), pause, and catch-up overlays unchanged when tab is focused.
- [preserved] User never blocked from continuing work during urgent incidents — alerts informational only.
- [preserved] Timer cadence, pause cap, guest and authenticated session flows unchanged.
- [preserved] Auth model — email, OAuth, guest merge unchanged (PRD v3).

Functional requirements (with Socrates resolutions from shape):

- FR-001: User can grant browser notification permission from a first-session explain prompt. Priority: must-have. Change: new
  > Socrates: Counter-argument: permission prompts on first session add friction before any value. Resolution: kept — break alerts are useless without permission; explain is one-time and skippable with settings fallback.

- FR-002: User receives a system notification when a break starts while the FlowState tab is not focused. Priority: must-have. Change: new
  > Socrates: Counter-argument: notifications feel like nagware; user history of disabling reminder apps. Resolution: kept — one notification per break start only; full disable in one settings action; no blocking.

- FR-003: User hears the break alarm when the tab is backgrounded, within browser autoplay and visibility policy limits. Priority: must-have. Change: modified
  > Socrates: Counter-argument: background audio is unreliable across browsers; duplicate channel with notifications. Resolution: kept — user explicitly asked for both channels; notification is primary reach, audio is best-effort complement.

- FR-004: User can disable out-of-tab break alerts in one settings action. Priority: must-have. Change: new
  > Socrates: Counter-argument: settings toggle adds UI surface area. Resolution: kept — required guardrail; user disables apps that cannot be silenced.

- FR-005: In-tab cycle completion, audio modes, pause, and catch-up overlays remain unchanged when tab is focused. Priority: must-have. Change: preserved
  > Socrates: Counter-argument: touching audio paths risks regressions in timer hub. Resolution: kept as explicit preservation — blast radius contained to visibility and break-start branch.

- FR-006: User is never blocked from continuing work during an urgent incident. Priority: must-have. Change: preserved
  > Socrates: Counter-argument: any alert during firefighting is unwanted. Resolution: kept — user can disable; no modal gates or screen lock.

#### Removed

- (none)

### Constraints & Compatibility

- **Backward compatibility:** Existing session data, guest mode, and authenticated timer flows unchanged.
- **Data migration:** None — user preference for out-of-tab alerts stored on device only.
- **Integrations:** No new external services.
- **Preserved:** Timer cadence, pause cap, cycle-end catch-up overlays, audio mode preferences, automated regression coverage for in-tab timer (extend, do not break).
- **Blast radius:** Timer visibility handling, break-start alert path, settings surface, first-session prompt — not dashboard overlay mutex or task CRUD.
- **PRD v3 compatibility:** Does not introduce native mobile push; browser system notifications only.
- User can disable all out-of-tab break alerts in one settings action without losing in-tab timer functionality.
- At most **one** system notification per break start.
- First-session permission explain shown **at most once** per browser profile unless user resets permission in the browser.
- In-tab perceived behavior (audio modes, catch-up timing) must not regress for focused-tab usage.
- Out-of-tab alert attempts fail gracefully when permission denied or autoplay blocked — no broken timer state.

### Business Logic Changes

**Current rule:** When a work cycle completes, the app plays an in-tab alarm and may queue catch-up UI when the user returns if the tab was hidden during the transition.

**Changed rule:** When a **break starts** and the user is **not** viewing the app tab, the system must **reach the user outside the tab** via (1) a system notification and (2) best-effort background audio, subject to browser permission and autoplay policy — so breaks are not silently missed.

**Inputs (user-facing):** break transition, whether the app tab is focused, notification permission, user preference for out-of-tab alerts.

**Output (user-facing):** one notification per break start; optional background alarm; existing in-tab behavior unchanged when focused.

### Access Control Changes

No access control changes — current model preserved. Notification permission is a browser-level capability per device profile; no new app roles or permission tiers.

### Non-Goals

- **Avoid:** Work Mode Guard session profiles (deep vs reactive) — deferred pending validation of this narrow MVP.
- **Avoid:** AUTO-mode detector and nudge after skipped breaks — deferred.
- **Avoid:** Meeting buffer and “where I stopped” capture — deferred.
- **Avoid:** Screen blocking or any UX that prevents continuing work during incidents.
- **Avoid:** Daily shutdown ritual, Daily Recall, Daily Intent, ball-in-court map — separate opportunity-map signals.
- **Avoid:** Multiple notifications per break or punitive streak metrics.
- **Avoid:** Team sync, external tracker integration, export of break data.
- **Avoid:** Native mobile push notifications — browser system notifications only (PRD v3 native-push non-goal preserved).

### Open Questions

1. **Fire-mode suppression** — Should out-of-tab alerts auto-suppress when user marks “reactive day” (future Work Mode Guard), or is settings disable enough for MVP? Owner: product. Block: no for MVP ship; yes before Work Mode Guard.
2. **Notification denied fallback** — Exact copy and settings entry when user dismisses browser permission? Owner: product + UX. Block: no.
3. **Success measurement** — 2-week self-assessment only (no analytics pipeline in MVP)? Owner: friction owner. Block: no.

---

## Change thread PRD: Timer change-impact digest (narrow MVP)

**Thread version:** 1  
**Status:** draft  
**Created:** 2026-06-18  
**Context type:** brownfield (internal dev tooling delta — no end-user product change)  
**Shape source:** `shape-notes.md` — Change thread: Timer change-impact digest  
**Mom Test:** Git replay 4/5 commits with new co-change signal; narrow co-change MVP accepted; full joiner and CI gate deferred.

> **Note on PRD v3 scope:** This thread does **not** modify FlowState product behavior, personas, or user-facing capabilities. It adds a local read-only developer CLI for the solo maintainer. PRD v3 sections above remain the canonical product contract.

### Current System Overview

**Baseline:** PRD v3 FlowState — timer vertical slice drives ~50% of git activity. Central cycle hook, dashboard, and wedge overlays form a high blast-radius hub (~19 dependency dependents, 35 historical co-changes with dashboard, 27 with E2E specs per architecture research).

**Relevant today:** Blast-radius knowledge lives in static repo-map, architect report, and slice research prose. Maintainer relies on mental checklist and post-hoc test runs; no repeatable pre-change check at edit time.

**Users affected:** Solo maintainer (primary); future contributors touching the timer hub. **No end-user impact.**

### Problem Statement & Motivation

**Pain:** Before editing the timer hub, the maintainer must remember which files and test layers historically change together. That knowledge is documented but not invoked as a repeatable command at slice start.

**Person:** Solo maintainer owning timer PR regression risk.

**Moment:** Starting a slice on the central cycle hook — deciding what else to open and which tests to run before merge.

**Cost today:** Re-reading research mid-edit; missed co-change layers; follow-up fix commits (≥4 e2e/hook/dashboard stabilization chains in 8 weeks per git replay).

**Why now:** Mom Test validation (2026-06-18) on automated opportunity map → narrow scope accepted after git replay met proceed thresholds (4/5 commits with new co-change signal).

**Insight:** Git co-change frequency shows what humans actually touch together — complementary to static dependency maps. Replay value comes almost entirely from co-change + test command block, not full dependency joiner.

### User & Persona

**Primary persona for this change: Timer-slice maintainer** — not an end-user persona.

- Owns regression risk on the timer hub; cannot hold dozens of co-change paths in working memory.
- Needs a ~30-second sanity check before coding, not another static document to maintain.
- Works after-hours; tool is local-only, read-only, throwaway-safe.

No change to PRD v3 Dynamic Knowledge Worker persona or guest/authenticated user flows.

### Success Criteria

#### Primary

- Maintainer runs one command with a timer-hub path (default: central cycle hook) and receives a one-screen report listing top co-changed paths and copy-paste test commands within 30 seconds on a typical dev machine.

#### Secondary

- Report optionally includes dependency fan-out **count** when local analysis output is present.
- `--strict` surfaces co-change warnings even for trivial edits; default mode suppresses noise below a configurable line-count threshold.

#### Guardrails

- Tool is read-only — never modifies source, git state, or CI configuration.
- Does not replace or auto-update repo-map.
- FlowState product runtime behavior unchanged — zero impact when tool is not invoked.
- Existing lefthook and CI gates remain authoritative; CLI is advisory in v1.

### User Stories

#### US-01: Maintainer runs pre-change digest before editing the timer hook

- **Given** a local clone with git history since 2026-04-01
- **When** the maintainer runs the digest CLI against the central cycle hook path
- **Then** they see top co-changed files ranked by frequency and suggested test commands before opening the hook file
- **Before:** maintainer relied on memory, repo-map, or research docs opened ad hoc during the slice.

#### Acceptance Criteria

- Default run completes in < 30 seconds on maintainer's Windows dev environment.
- Output includes: target path, `--since` date used, top co-changed paths with commit counts, test command block.
- Exit code 0 on success; non-zero with clear message if path invalid or git unavailable.
- No workspace files modified.

### Scope of Change

#### New capabilities

- [new] Read-only CLI: given a timer-hub file path, print top-N git co-changed paths since a configurable date.
- [new] Static test-command block mapped from co-changed path prefixes (hook unit test, dashboard smoke, belt E2E per repo-map).
- [new] `--strict` flag to force co-change warnings regardless of edit size; default quiet mode for trivial edits.

#### Modified behavior

- (none — no product or CI behavior change in v1)

#### Preserved behavior

- [preserved] All FlowState product runtime, API, and database behavior unchanged.
- [preserved] repo-map remains canonical static reference — not replaced or auto-updated.
- [preserved] lefthook, GitHub Actions CI, and Playwright belt unchanged in MVP.
- [preserved] All existing timer-hub development workflows valid without invoking the tool.

Functional requirements (with Socrates resolutions from shape):

- FR-001: Maintainer can pass a file path and receive stdout report of top-N git co-changed paths since a `--since` date. Priority: must-have. Change: new
  > Socrates: Counter-argument — co-change stats duplicate repo-map tables. Resolution: kept; repo-map is static and not run at edit time; replay showed 4/5 commits gain live signal.

- FR-002: Report includes a static test-command block mapped from co-changed paths. Priority: must-have. Change: new
  > Socrates: Counter-argument — maintainer always runs full belt anyway. Resolution: kept; belt not always run locally; command block removes recall friction.

- FR-003: Report fits one terminal screen (~40 lines) for the default reference path. Priority: must-have. Change: new
  > Socrates: Counter-argument — truncating hides rare co-changes. Resolution: top-N with `--top` flag; default N=8.

- FR-004: Maintainer can pass `--strict` to force co-change warnings regardless of diff size. Priority: must-have. Change: new
  > Socrates: Counter-argument — two modes confuse. Resolution: kept; mom-test identified false-positive risk on trivial edits.

- FR-005: Report optionally prints dependency fan-out count when local analysis output is present; omits gracefully when absent. Priority: nice-to-have. Change: new
  > Socrates: Counter-argument — dependency analysis adds setup cost. Resolution: nice-to-have; optional second line only.

- FR-006: FlowState product and existing CI/hook behavior unchanged when the tool is not invoked. Priority: must-have. Change: preserved
  > Socrates: Counter-argument — trivial if tool is separate script. Resolution: kept as explicit preservation FR.

#### Removed

- (none)

### Constraints & Compatibility

- **Backward compatibility:** Zero impact on app runtime, API, database, or end-user experience.
- **Data migration:** None.
- **Integrations:** lefthook, GitHub Actions CI, Playwright belt unchanged in MVP.
- **Preserved:** repo-map canonical; timer-hub workflows without the tool remain valid.
- **Deployment:** Developer machine only in v1 — not production CI until manual habit proven (≥3 consecutive timer slices).
- **Blast radius of implementation:** New script entry + package script only — no required `src/` product edits for MVP.
- **PRD v3 compatibility:** No change to product personas, scoring, wedge flow, or auth model.

### Business Logic Changes

No domain logic change to FlowState product — infrastructure-only developer tooling.

**New rule (maintainer-facing):** Given a source file path, rank companion files by historical co-change frequency in git log and surface the test layers that most often accompany edits to that path — so the maintainer makes a conscious confirm-or-skip decision before coding.

**Inputs (maintainer-facing):** file path, `--since` date, `--top N`, `--strict` flag.

**Output (maintainer-facing):** ordered co-change list with counts; mapped test commands; optional fan-out count.

### Access Control Changes

No access control changes — current FlowState product auth model preserved. Tool has no auth surface; runs locally on maintainer clone.

### Non-Functional Requirements

- Pre-change report generation completes in **< 30 seconds** on a typical solo dev laptop.
- Tool operates **read-only** — no network calls, no workspace writes beyond stdout.
- Default output **≤ 40 lines** for the reference path (one screen).
- Invocable via project script entry without global install.

### Non-Goals

- **Avoid:** CI gate or PR comment bot in v1 — manual habit must prove value first.
- **Avoid:** Full dependency graph in v1 — fan-out count only when available.
- **Avoid:** Auto-fix or code modification — report only.
- **Avoid:** Replacing repo-map — static map stays canonical.
- **Avoid:** Coverage of all vertical slices — timer hub paths only in v1.
- **Avoid:** Multi-maintainer shared config server or team dashboard.
- **Avoid:** End-user-visible product changes — this thread is maintainer tooling only.

### Open Questions

1. **Default `--since` date** — 90-day rolling vs fixed 2026-04-01 (product epoch). Owner: maintainer. Block: no for MVP ship; resolve in `/10x-plan`.
2. **Line-count threshold for quiet mode** — exact N for suppressing warnings on trivial edits. Owner: maintainer. Block: no; resolve during prototype dry-run.
3. **Maintainer habit confirmation** — did digest change behavior on last 3 slices before CI promotion? Owner: maintainer. Block: no for MVP ship; yes before v2 CI gate.

---

## Change thread PRD: Revisit user choices (notification preference revisit MVP)

**Thread version:** 1  
**Status:** draft  
**Created:** 2026-06-19  
**Context type:** brownfield (delta on PRD v3 above)  
**Shape source:** `shape-notes.md` — Change thread: Revisit user choices (preferences visibility & change)  
**Change folder:** `context/changes/revisit-user-choices/change.md`

> **Note on break-alerts-out-of-tab:** That slice shipped on `main` (PR #138). It delivers out-of-tab break alerts and a first-session permission prompt with a settings fallback. This thread adds the **revisit pattern** on the timer hub: a visible three-state label (enabled / disabled / not configured), enable/disable after "Not now" without replaying the first-session explain, and browser permission only when enabling from settings and permission is not yet granted. Broader choice types (check-in, wedge dismissals) follow in phased rollout after this MVP proves the pattern.

### Current System Overview

**Baseline:** PRD v3 FlowState — timed work sessions with breaks, guest and authenticated paths, session overlays for check-in, onboarding, suggestions, wind-down, and notification permission. Out-of-tab break alerts shipped via break-alerts-out-of-tab (PR #138): first-session explain, system notification when tab is not focused, one-action disable.

**Relevant today:** User choices and dismissals ("Not now", check-in selections, permission skips) are persisted in various client stores but there is **no unified place** to review or change them after the moment passes. The break-alerts slice added a settings fallback path in principle; users who skipped the first-session prompt still lack a clear, always-visible readout of current out-of-tab notification state on the timer hub.

**Users affected:** Existing users on reactive, interrupt-driven days — especially knowledge workers who dismiss prompts and later want to verify or revise those choices (primary persona unchanged; this thread serves the reactive-day subset).

### Problem Statement & Motivation

**Pain:** During normal use the user makes decisions — selects check-in status, clicks through overlays, dismisses prompts with "Not now", skips notification setup — but afterward cannot see what they chose or find a path to change it.

**Person:** Knowledge worker (friction owner) running timed sessions with frequent context switches.

**Moment:** Mid-session or next day — user realizes they dismissed something they now want (e.g., out-of-tab notifications) or wants to correct an earlier status/check-in choice, but the UI offers no review or edit surface.

**Cost today:** Dismissals and choices feel permanent and invisible; user either accepts wrong state or abandons the feature entirely (pattern from prior reminder apps).

**Why now:** Break-alerts-out-of-tab (PR #138) shipped the alert channel; the remaining gap is **visibility of committed user state** — users do not know what they chose, so they do not know they can change it.

**Insight:** The gap is **visibility of committed user state**, not absence of the underlying features. A reusable "see what I chose + change it calmly" pattern should precede rolling out per-feature fixes.

### User & Persona

**Primary persona for this change: Reactive-day knowledge worker** — subset of the Dynamic Knowledge Worker.

- Uses FlowState timer; encounters multiple optional prompts per session.
- After dismissing or selecting something, wants to verify or revise that choice without replaying the whole session flow.
- Prior behavior: disabled apps where "Not now" felt like a dead end with no return path.

No new persona tier; guest and authenticated users both affected equally with the same UX (persistence differs only by existing data-mode rules).

### Success Criteria

#### Primary

- User who previously skipped the notification permission prompt can **see current out-of-tab notification state** (enabled / disabled / not configured) and **enable or disable** out-of-tab break alerts without replaying the first-session explain flow.
- Pattern is validated as reusable for subsequent choice types (check-in, wedge dismissals, etc.).

#### Secondary

- Revisit pattern documented in change plan / shape thread so rollout to the next choice type is mechanical, not ad hoc.

#### Guardrails

- Existing timer, pause, and cycle behavior unchanged — UI-only slice reads/writes existing preference flags.
- No re-prompt spam after a conscious user decision; changing a choice is always user-initiated from a visible settings surface on the timer hub.
- Calm UX preserved — no nag loops; at most one notification per break start (consistent with break-alerts thread).
- Guest and authenticated paths both supported with same UX.
- A configured Pomodoro cycle does not drift by more than ±2 seconds (PRD v3 guardrail preserved).

### User Stories

#### US-01: Re-enable out-of-tab break alerts after "Not now"

- **Given** a user on the timer hub who previously dismissed the first-session notification prompt
- **When** they open notification preferences on the timer hub
- **Then** they see the current state (not configured / disabled / enabled) and can enable out-of-tab break alerts; the browser permission prompt appears only if not yet granted
- **Before:** dismissals were written to storage but not surfaced; "Not now" felt like a dead end with no visible return path.

#### Acceptance Criteria

- Current state is visible without starting a new timed session
- Three-state label accurately reflects stored preference (enabled / disabled / not configured)
- Enable action does not replay the full first-session explain overlay
- Disable remains one action when already enabled
- Enabling from settings triggers browser notification permission flow only when permission is not already granted
- Guest and authenticated users see the same controls; persistence follows existing data-mode rules
- No automatic re-prompt on later sessions after a conscious skip unless user opens preferences on the timer hub
- Settings surface lives on timer hub / dashboard (not a separate settings page in v1)

### Scope of Change

#### New capabilities

- [new] Visible three-state readout for out-of-tab break-alert preference on the timer hub (enabled / disabled / not configured).
- [new] Enable out-of-tab break alerts from timer hub preferences after previously choosing "Not now" on the first-session prompt — without replaying the full explain overlay.
- [new] Browser notification permission flow triggered from settings enable action only when permission is not already granted.

#### Modified behavior

- [modified] Disable out-of-tab break alerts — remains one settings action; now reachable from the same visible timer hub preference surface with accurate state label (was: disable path existed in break-alerts slice but state was not always visible after skip).

#### Preserved behavior

- [preserved] Timer, pause, cycle cadence, and in-tab audio modes unchanged when notification preferences are viewed or edited.
- [preserved] Out-of-tab break alert delivery behavior from break-alerts-out-of-tab (PR #138) unchanged when enabled.
- [preserved] First-session explain flow for users who have not yet been prompted — unchanged from break-alerts slice.
- [preserved] Guest and authenticated session flows, calm tone, and catch-up overlays unchanged.
- [preserved] Auth model — email, OAuth, guest merge unchanged (PRD v3).

Functional requirements (with Socrates resolutions from shape):

- FR-001: User can see current out-of-tab break-alert state (enabled / disabled / not configured). Priority: must-have. Change: new
  > Socrates: No counter-argument; visibility is the core gap.

- FR-002: User can enable out-of-tab break alerts from a visible settings surface on the timer hub after previously choosing "Not now" on the first-session prompt. Priority: must-have. Change: new
  > Socrates: No counter-argument; settings path is intentional return from dead-end dismissals.

- FR-003: User can disable out-of-tab break alerts in one settings action. Priority: must-have. Change: modified
  > Socrates: No counter-argument; aligns with break-alerts thread and calm opt-out.

- FR-004: Enabling from settings triggers the browser notification permission flow only when permission is not already granted. Priority: must-have. Change: new
  > Socrates: No counter-argument; avoids permission fatigue on repeat enable.

- FR-005: Timer, pause, cycle cadence, and in-tab audio modes behave unchanged when notification preferences are viewed or edited. Priority: must-have. Change: preserved
  > Socrates: Kept as explicit preservation FR — blast radius must stay UI-only.

#### Removed

- (none)

### Constraints & Compatibility

- **Backward compatibility:** Existing timer hub, guest merge, and break-alert storage keys continue to work; new UI reads/writes the same flags where possible.
- **Data migration:** None required for MVP — surface existing notification dismiss/grant state.
- **Integrations:** Browser Notification API permission model unchanged; browser system notifications only (not native push).
- **Preserved:** Timer/pause/cycles, in-tab audio modes, catch-up overlays, calm tone, guest + auth data-mode split, out-of-tab alert behavior from PR #138 when enabled.
- **Blast radius:** UI-only — timer hub preference surface; read/write existing preference flags; no timer hub logic change.
- **PRD v3 compatibility:** Does not introduce native mobile push; browser system notifications only.
- **Relationship to break-alerts-out-of-tab:** Builds on shipped slice (PR #138); this thread owns the revisit pattern and settings visibility; product contract is broader than break-alerts alone (phased rollout to other choice types follows).
- Notification preference surface is reachable in **≤ 2 user actions** from the timer hub during an active or idle session.
- Displayed notification state matches stored state on every timer hub load (no stale labels after enable/disable).

### Business Logic Changes

**Current rule (implicit today):** Dismissals and one-off selections are written to storage but not surfaced — the user cannot verify or revise them.

**Changed rule:** The application always reflects the user's stored choice honestly on a findable surface and lets them change it without replaying session overlays.

**Inputs (user-facing):** prior dismissals and permission state already in client storage; user-initiated open of preference surface on timer hub; enable/disable actions.

**Output (user-facing):** accurate three-state current-state label (enabled / disabled / not configured); successful enable/disable without forced re-onboarding; browser permission prompt only when enabling and permission not yet granted.

### Access Control Changes

No access control changes — current model preserved. Authenticated users and guest users both retain existing access boundaries. The change adds review/edit surfaces for choices each user already made; no new roles, routes, or permission tiers. Guest and authenticated users get the **same UX** for viewing and changing prior choices; persistence differs only by existing data-mode rules (local vs account-backed).

### Non-Goals

- **Avoid:** Unified preferences hub covering all choice types in v1 — MVP proves the pattern on out-of-tab notifications only; broader rollout is a follow-on slice.
- **Avoid:** Check-in status revision, wedge dismissals, and onboarding coach dismissals in v1 — deferred to phased rollout after pattern validation.
- **Avoid:** Dedicated `/settings` page in v1 — preference surface lives on timer hub.
- **Avoid:** Native mobile push notifications — browser system notifications only (consistent with PRD v3).
- **Avoid:** Timer hub or wedge conductor refactor — UI-only slice.
- **Avoid:** Re-prompt spam or punitive re-onboarding after conscious user decisions.

### Open Questions

1. **Rollout order after notifications** — check-in vs wedge dismissals vs audio mode: which choice type next? Owner: user. Block: no for MVP ship; resolve in `/10x-plan` or follow-on shape append.
2. **Implementation sequencing vs break-alerts-out-of-tab** — build revisit UI before, with, or after break-alerts permission prompt lands? Owner: maintainer. Block: no — break-alerts shipped (PR #138); revisit UI is the remaining work. Resolve sequencing in `/10x-plan`.
3. **Exact label copy for three notification states** (enabled / disabled / not configured) — Owner: user + design. Block: no; resolve in `/10x-plan`.
