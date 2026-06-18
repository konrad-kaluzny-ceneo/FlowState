---
project: "FlowState"
status: living-document
updated: 2026-06-18
canonical: context/foundation/prd.md
archived_snapshot: context/foundation/archive/2026-06-13-shape-notes-v3-final.md
active_change_threads:
  - id: break-alerts-out-of-tab
    shaped: 2026-06-18
    prd_added: 2026-06-18
    status: prd-draft
    prd: context/foundation/prd.md#change-thread-prd-break-alerts-outside-active-tab-narrow-mvp
  - id: timer-change-impact-digest
    shaped: 2026-06-18
    prd_added: 2026-06-18
    status: prd-draft
    prd: context/foundation/prd.md#change-thread-prd-timer-change-impact-digest-narrow-mvp
---

# Shape notes

## PRD v3 — canonical baseline

Shaping for PRD v3 is complete. **Canonical product contract:** [`prd.md`](prd.md) (v3, brownfield).

Full shaping session snapshot: [`archive/2026-06-13-shape-notes-v3-final.md`](archive/2026-06-13-shape-notes-v3-final.md).

Re-run `/10x-shape` for a new PRD generation from scratch; new threads are appended below, not archived.

---

## Change thread: Break alerts outside active tab (narrow MVP)

**Shaped:** 2026-06-18  
**Status:** PRD draft appended to `prd.md` (2026-06-18)  
**Seed:** Mom Test validation on opportunity map signal 4 → **narrow scope** accepted. Full Work Mode Guard (session profiles, AUTO detector, meeting buffer) explicitly deferred.  
**Sources:** `context/team/opportunity-map.md`, Mom Test self-interview (friction owner).

### Checkpoint

```yaml
context_type: brownfield
current_phase: 8
phases_completed: [1, 2, 3, 4, 5, 6, 7]
gray_areas_resolved:
  - topic: alert channel
    decision: "Poprawa dźwięku w tle + powiadomienie systemowe (Web Notifications)"
  - topic: trigger events
    decision: "Alert tylko przy starcie przerwy (break start), gdy karta aplikacji nieaktywna"
  - topic: permission UX
    decision: "Przy pierwszej sesji timera — krótki explain + prośba o włączenie powiadomień"
  - topic: timeline
    decision: "Część day job — bez sztywnego tygodniowego limitu"
  - topic: validation scope
    decision: "Samoocena właściciela tarć wystarczy; pełny Work Mode Guard odłożony"
frs_drafted: 6
quality_check_status: accepted
product_type: web-app
target_scale:
  users: small
timeline_budget:
  delivery_weeks: 2
  hard_deadline: null
  after_hours_only: false
```

### Current System

**What exists:** FlowState — web app for timed work sessions (Pomodoro-style cycles, breaks, task linkage). Users authenticate or use guest mode. Timer hub drives cycle state; audio manager plays cycle-end alarm via Web Audio / HTML audio when the app tab is active. Visibility handling and in-tab catch-up overlays exist when the user returns after a cycle completed while the tab was hidden.

**Tech stack (user-mentioned / observed):** Next.js web app, existing auth (authenticated + guest), client-side timer hook, audio manager, E2E regression belt.

**Users today:** Solo maintainer / primary friction owner; knowledge workers on multi-project, async, standup-heavy days (target persona for this change).

**Must preserve:** Existing timer flow, pause behavior, cycle/break cadence, guest + authenticated paths, in-tab audio modes (normal / soft / muted), catch-up overlays on return, no work blocking during urgent incidents.

### Vision & Problem Statement

**Pain:** On reactive work days, the user runs continuous sessions and skips breaks until fatigue or hunger — not because the timer is off, but because break reminders are easy to miss when FlowState is not the active browser tab (no audible alert reaches them).

**Person:** Knowledge worker (friction owner) juggling parallel projects and firefighting days.

**Moment:** Mid-afternoon on a deadline day — timer reaches break while the user is in another tab (Linear, IDE, Slack); break passes unnoticed.

**Cost today:** Physiological breaks happen only when the body forces them; prior attempts (alarms, calendar, screen blockers, Pomodoro apps) were ignored or disabled because they were irritating or easy to dismiss.

**Insight:** The gap is **reachability of the break signal outside the active tab**, not absence of a timer. A narrow fix (out-of-tab notification + reliable background audio within browser policy) should be validated before investing in session profiles or mode-guard logic.

### User & Persona

**Primary persona — Reactive-day knowledge worker**

- Role: Developer / knowledge worker with daily standup, async handoffs, multiple active threads.
- Context: Uses FlowState timer during work blocks; frequently context-switches to other browser tabs.
- Moment they need this: Break starts while they are not looking at FlowState — they need one calm, dismissible signal that a break began.
- Prior behavior: Disabled or ignored reminder tools that felt nagging; needs one-click opt-out.

### Access Control

**No changes planned — current model preserved.**

Authenticated users and guest users both use the timer. Notification permission is a browser-level capability per device/profile; no new roles or permission tiers in the app auth model.

### Success Criteria

#### Primary

- Over a 2-week observation window on reactive days: **≥1 conscious break per such day** where the user noticed the break because of an out-of-tab alert (not only fatigue/hunger).
- Break-start alert fires when the app tab is not focused and notifications are granted.

#### Secondary

- User completes first-session notification explain + grant flow (or consciously skips with a visible settings path to enable later).

#### Guardrails

- Existing in-tab timer, audio modes, pause, and catch-up overlays behave as before when the tab is focused.
- User can disable out-of-tab break alerts in **one settings action** without uninstalling behavior from the whole app.
- **No work blocking** during real incidents — alerts are informational only.
- **At most one notification per break start** — no nag loops.
- Tone: calm, not punitive; no streak shaming.

### User Stories

#### US-01: Break noticed while working in another tab

- **Given** a user with notifications granted who started a work session and switched to another browser tab
- **When** the timer transitions to a break while the tab is hidden
- **Then** they receive a system notification about the break and, where the browser allows, hear the break alarm without returning to the tab first

**Acceptance Criteria**

- Notification appears only when `document.visibilityState !== "visible"` at break start
- Notification copy indicates break started (stand / water — physiological minimum, not moralizing)
- Clicking the notification focuses the FlowState tab
- If notifications denied, user still gets best-effort background audio within browser policy; settings show how to enable notifications

#### US-02: First session notification setup

- **Given** a user who has not yet been prompted for notification permission
- **When** they start their first timed session
- **Then** they see a short explain why out-of-tab alerts help and a single action to enable notifications (browser prompt follows)

**Acceptance Criteria**

- Prompt shown once per browser profile (not on every session)
- Skipping leaves a clear path in settings to enable later
- Explain mentions easy disable — addresses prior pattern of abandoning irritating apps

### Functional Requirements

#### Out-of-tab break alerts

- FR-001: User can grant browser notification permission from a first-session explain prompt. Priority: must-have. Change: new
  > Socrates: Counter-argument: permission prompts on first session add friction before any value. Resolution: kept — break alerts are useless without permission; explain is one-time and skippable with settings fallback.

- FR-002: User receives a system notification when a break starts while the FlowState tab is not focused. Priority: must-have. Change: new
  > Socrates: Counter-argument: notifications feel like nagware; user history of disabling reminder apps. Resolution: kept — one notification per break start only; full disable in one settings action; no blocking.

- FR-003: User hears the break alarm when the tab is backgrounded, within browser autoplay/visibility policy limits. Priority: must-have. Change: modified
  > Socrates: Counter-argument: background audio is unreliable across browsers; duplicate channel with notifications. Resolution: kept — user explicitly asked for both channels; notification is primary reach, audio is best-effort complement.

- FR-004: User can disable out-of-tab break alerts (notifications and background break audio path) in one settings action. Priority: must-have. Change: new
  > Socrates: Counter-argument: settings toggle adds UI surface area. Resolution: kept — required guardrail; user disables apps that cannot be silenced.

#### Preserved behavior

- FR-005: User experience for in-tab cycle completion, audio modes (normal / soft / muted), pause, and catch-up overlays remains unchanged when the tab is focused. Priority: must-have. Change: preserved
  > Socrates: Counter-argument: touching audio paths risks regressions in the timer hub. Resolution: kept as explicit preservation FR — blast radius contained to visibility + break-start branch.

- FR-006: User is never blocked from continuing work during an urgent incident — alerts are informational only. Priority: must-have. Change: preserved
  > Socrates: Counter-argument: any alert during firefighting is unwanted. Resolution: kept — user can disable; no modal gates or screen lock; defer fire-mode-specific suppression to Open Questions.

### Business Logic

**Current rule:** When a work cycle completes, the app plays an in-tab alarm and may queue catch-up UI when the user returns if the tab was hidden.

**Changed rule:** When a **break starts** and the user is **not** viewing the app tab, the system must **reach the user outside the tab** via (1) a system notification and (2) best-effort background audio, subject to browser permission and autoplay policy — so breaks are not silently missed.

**Inputs (user-facing):** break transition event, tab visibility, notification permission, user preference for out-of-tab alerts.

**Output (user-facing):** one notification per break start; optional background alarm; existing in-tab behavior unchanged when focused.

### Constraints & Preserved Behavior

- **Backward compatibility:** Existing session data, guest mode, and authenticated timer flows unchanged.
- **Integrations:** No new external services; Web Notifications API + existing audio manager only.
- **Preserved:** Timer cadence, pause cap, cycle-end catch-up overlays, audio mode preferences, E2E belt scenarios for in-tab timer (extend, do not break).
- **Blast radius:** Timer hook visibility branch, audio manager, settings surface, first-session prompt — not dashboard overlay mutex or task CRUD.
- **Data migration:** None — client-side notification preference only.

### Non-Functional Requirements

- User can disable all out-of-tab break alerts in one settings action without losing in-tab timer functionality.
- At most **one** system notification per break start — no repeated pings during the same break.
- First-session permission explain shown **at most once** per browser profile unless user resets permission in browser.
- In-tab perceived behavior (audio modes, catch-up timing) must not regress for focused-tab usage.
- Notification and background audio attempts fail gracefully when permission denied or autoplay blocked — no uncaught errors, no broken timer state.

### Non-Goals

- **Avoid:** Work Mode Guard session profiles (deep vs reactive) — deferred pending validation of this narrow MVP.
- **Avoid:** AUTO-mode detector and nudge after skipped breaks — deferred.
- **Avoid:** Meeting buffer and “where I stopped” capture — deferred.
- **Avoid:** Screen blocking or any UX that prevents continuing work during incidents.
- **Avoid:** Daily shutdown ritual, Daily Recall, Daily Intent, ball-in-court map — separate opportunity-map signals.
- **Avoid:** Multiple notifications per break or punitive streak metrics.
- **Avoid:** Team sync, Linear/Slack integration, export of break data.

### Open Questions

1. **Fire-mode suppression** — Should out-of-tab alerts auto-suppress when user marks “reactive day” (future Work Mode Guard), or is settings disable enough for MVP? Owner: product. Target: resolve in `/10x-prd`.
2. **Notification denied fallback** — Exact copy and settings entry when user dismisses browser permission? Owner: product + UX. Target: PRD acceptance criteria.
3. **Success measurement** — 2-week self-assessment only (no analytics pipeline in MVP)? Owner: friction owner. Target: PRD success criteria confirmation.

### Quality cross-check

| Element | Status |
|---|---|
| Access Control | present |
| Business Logic (one-sentence rule) | present |
| Project artifacts | present |
| Timeline-cost acknowledged | present — day job; delivery_weeks: 2 estimate, no hard deadline |
| Non-Goals | present |
| Preserved behavior | present |

### Forward: tech-stack

Informational only — not PRD. Existing Next.js / client timer stack. Web Notifications API; extend existing `createAudioManager` visibility path. No new backend service for MVP.

**Mom Test handoff:** Self-assessment sufficient; narrow MVP accepted over full Work Mode Guard.

---

## Change thread: Timer change-impact digest (narrow MVP)

**Shaped:** 2026-06-18  
**Status:** shape complete → prd draft  
**Seed:** Mom Test validation on `opportunity-map-automated.md` → **narrow scope** accepted (co-change + test commands; full depcruise joiner deferred).  
**Sources:** `context/team/opportunity-map-automated.md`, `context/team/mom-test-validation.md` (git replay 4/5 commits with new co-change signal).

### Checkpoint

```yaml
context_type: brownfield
current_phase: 8
phases_completed: [1, 2, 3, 4, 5, 6, 7]
gray_areas_resolved:
  - topic: MVP scope — co-change vs full joiner
    decision: "v1 = git co-change top-N + static test commands; depcruise fan-out count only (no graph)"
  - topic: Noise on trivial edits
    decision: "Default quiet below line threshold; --strict forces all co-change warnings"
  - topic: CI promotion
    decision: "Out of MVP — manual CLI only until used on ≥3 consecutive timer slices"
  - topic: Reference path
    decision: "Primary target use-pomodoro-cycle.ts; same script accepts any path under timer hub"
  - topic: Parallel zero-code mitigation
    decision: "Optional PR template checklist (repo-map link + test commands) — not blocking MVP script"
frs_drafted: 6
quality_check_status: accepted
product_type: cli
target_scale:
  users: small
timeline_budget:
  delivery_weeks: 1
  hard_deadline: null
  after_hours_only: true
```

### Current System

**What exists:** FlowState — shipped Pomodoro web app; ~50% git activity on timer vertical slice. Timer hub (`use-pomodoro-cycle.ts`, dashboard, wedge overlays) has high blast radius (~19 depcruise dependents, 35 dashboard co-changes, 27 E2E co-changes per L3 research).

**Mitigation today (manual):** `context/map/repo-map.md`, architect report, slice research prose, mental checklist, post-hoc `pnpm test` / `pnpm test:e2e:belt`. No repeatable pre-change check at edit time.

**Users today:** Solo maintainer (primary); future contributors on timer slice.

**Must preserve:** All FlowState product runtime behavior; existing lefthook/CI gates; repo-map as canonical static reference (not replaced).

### Vision & Problem Statement

**Pain:** Before editing the timer hub, the maintainer must remember which files and test layers historically change together. That knowledge lives in research documents and static maps — not in a command run at edit time.

**Person:** Solo maintainer merging timer PRs.

**Moment:** Starting a slice that touches the central timer hook — deciding what else to open and which tests to run before merge.

**Cost today:** Re-reading research mid-edit; missed co-change layers; follow-up fix commits (≥4 e2e/hook/dashboard stabilization chains in 8 weeks per git replay).

**Insight:** Git co-change frequency answers a different question than dependency structure — what humans actually touch together. Mom Test git replay: **4/5** last timer commits would surface co-change rows worth a conscious skip decision; full three-way joiner is over-scoped for v1.

### User & Persona

**Primary persona — Timer-slice maintainer**

- Owns regression risk on the timer hub; cannot hold 29 co-change paths in working memory.
- Wants a ~30-second sanity check before coding, not another document to maintain.
- Runs after-hours iteration; tool is local-only, read-only, throwaway-safe.

### Access Control

**No changes planned — current FlowState product auth model preserved.**

Single user; no auth. Tool runs locally on developer clone against local git history. Read-only — no writes to repo or CI config.

### Success Criteria

#### Primary

- Maintainer runs one command with a timer-hub path (default: central cycle hook) and receives a one-screen report listing top co-changed paths and copy-paste test commands within 30 seconds.

#### Secondary

- Report optionally includes dependency fan-out **count** when local analysis output is present.
- `--strict` surfaces co-change warnings even for trivial edits; default mode suppresses noise below a line-count threshold.

#### Guardrails

- Tool is read-only — never modifies source, git state, or CI config.
- Does not replace or auto-update repo-map.
- FlowState product behavior unchanged — zero runtime impact on the app.
- Existing lefthook/CI gates remain authoritative; CLI is advisory in v1.

### User Stories

#### US-01: Maintainer runs pre-change digest before editing the timer hook

- **Given** a local clone with git history since 2026-04-01
- **When** the maintainer runs the digest CLI against the central cycle hook path
- **Then** they see top co-changed files ranked by frequency and suggested test commands before opening the hook file

**Acceptance Criteria**

- Default run completes in < 30 seconds on Windows dev environment.
- Output includes: target path, `--since` date, top 5+ co-changed paths with counts, test command block.
- Exit code 0 on success; non-zero with clear message if path invalid or git unavailable.
- No files modified.

### Functional Requirements

#### Change-impact digest

- FR-001: Maintainer can pass a file path and receive stdout report of top-N git co-changed paths since a `--since` date. Priority: must-have. Change: new
  > Socrates: Counter-argument — co-change stats duplicate repo-map tables. Resolution: kept; repo-map is static and not run at edit time; replay showed 4/5 commits gain live signal.

- FR-002: Report includes a static test-command block mapped from co-changed paths (hook test, dashboard smoke, belt E2E per repo-map). Priority: must-have. Change: new
  > Socrates: Counter-argument — maintainer always runs full belt anyway. Resolution: kept; belt not always run locally; command block removes recall friction.

- FR-003: Report fits one terminal screen (~40 lines) for the default reference path. Priority: must-have. Change: new
  > Socrates: Counter-argument — truncating hides rare co-changes. Resolution: top-N with `--top` flag; default N=8.

- FR-004: Maintainer can pass `--strict` to force co-change warnings regardless of diff size. Priority: must-have. Change: new
  > Socrates: Counter-argument — two modes confuse. Resolution: kept; mom-test identified false-positive risk on trivial edits.

- FR-005: Report optionally prints dependency fan-out count when local analysis output is present; omits gracefully when absent. Priority: nice-to-have. Change: new
  > Socrates: Counter-argument — dependency analysis adds setup cost. Resolution: nice-to-have; optional second line only.

#### Preserved behavior

- FR-006: FlowState product and existing CI/hook behavior unchanged when the tool is not invoked. Priority: must-have. Change: preserved
  > Socrates: Counter-argument — trivial if tool is separate script. Resolution: kept as explicit preservation FR.

### Business Logic

**Rule:** Given a source file path, rank companion files by historical co-change frequency in git log and surface the test layers that most often accompany edits to that path — so the maintainer makes a conscious confirm-or-skip decision before coding.

**Inputs (user-facing):** file path, `--since` date, `--top N`, `--strict` flag.

**Output (user-facing):** ordered co-change list with counts; mapped test commands; optional fan-out count.

**Product domain:** No change — infrastructure-only developer tooling.

### Constraints & Preserved Behavior

- **Backward compatibility:** Zero impact on app runtime, API, or database.
- **Data migration:** None.
- **Integrations:** lefthook, GitHub Actions CI, Playwright belt unchanged in MVP.
- **Preserved:** repo-map remains canonical static reference; all timer-hub workflows valid without the tool.
- **Deployment:** Developer machine only in v1 — not production CI (explicit non-goal until habit proven).
- **Blast radius of building the tool:** New script under `scripts/` or `tools/` + package.json script entry only — no `src/` product edits required for MVP.

### Non-Functional Requirements

- Pre-change report generation completes in **< 30 seconds** on a typical solo dev laptop.
- Tool operates **read-only** — no network calls, no workspace writes beyond stdout.
- Default output **≤ 40 lines** for reference path.
- Invocable via project script entry — no global install required.

### Non-Goals

- **Avoid:** CI gate or PR comment bot in v1 — manual habit must prove value first (≥3 consecutive timer slices).
- **Avoid:** Full dependency graph in v1 — fan-out count only.
- **Avoid:** Auto-fix or code modification — report only.
- **Avoid:** Replacing repo-map — static map stays canonical.
- **Avoid:** Coverage of all vertical slices — timer hub paths only in v1.
- **Avoid:** Multi-maintainer shared config server or team dashboard.
- **Avoid:** Full Work Mode Guard, wedge conductor, or ACL char tests — separate in-flight/planned slices.

### Open Questions

1. **Default `--since` date** — 90-day rolling vs fixed 2026-04-01 (product epoch). Owner: maintainer. Target: `/10x-plan`.
2. **Line-count threshold for quiet mode** — exact N for suppressing warnings on trivial edits. Owner: maintainer. Target: prototype dry-run.
3. **Maintainer habit confirmation** — did digest change behavior on last 3 slices? Owner: maintainer (mom-test Q1–3). Target: before CI promotion.

### Quality cross-check

| Element | Status |
|---|---|
| Access Control | present |
| Business Logic (one-sentence rule) | present |
| Project artifacts | present |
| Timeline-cost ack | present — delivery_weeks: 1 |
| Non-Goals | present |
| Preserved behavior | present |

### Forward: tech-stack

Informational only — not PRD. Node script in `scripts/` or `tools/`; git subprocess for co-change v1. Optional: read existing dependency analysis JSON if present. No new backend service.

**Mom Test handoff:** Git replay 4/5; narrow co-change MVP accepted; full joiner and CI gate deferred.
