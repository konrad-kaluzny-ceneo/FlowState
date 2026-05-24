---
name: foundation-prd
description: FlowState product requirements — functional specs (FR-001–FR-022), user stories, acceptance criteria, adaptive scoring, NFRs, and scope boundaries. Use when implementing features, writing tests, making UX decisions, scoping work, or verifying acceptance criteria.
---

# FlowState Product Requirements

## Product at a glance

| Item | Value |
|------|--------|
| Product | Pomodoro + adaptive-focus web app for knowledge workers |
| Persona | Interrupt-driven developer/analyst who needs "what do I do *right now*" |
| Core outcome | Calm, focused end-of-day feeling — not just throughput |
| Auth | Login required (email/password, OAuth, or passwordless); flat role model |
| MVP timeline | ~6 weeks, after-hours; hard deadline 2026-07-05 |

## Core loop

```
task list → select task → Pomodoro cycle → end-of-cycle signal + prompt
→ mindful check-in → next-task suggestion → repeat
```

User autonomy is non-negotiable: the system **suggests**, the user **decides**. Forced cycle confirmation (FR-014) is the mindfulness mechanic — do not auto-transition.

## Success criteria & guardrails

**Primary:** Logged-in user completes a full Pomodoro session with at least one task, marks it done, and sees completed vs. open work clearly.

**Guardrails (never violate):**
- Task list, cycle config, and session state survive refresh/crash — no silent data loss
- Timer accuracy: configured cycle must not drift more than ±2s (active or background tab)
- Auth failure must not destroy local state; forgotten password must not mean permanent lockout
- Strict per-account data isolation — no cross-user queries

## Functional requirements (quick ref)

| Domain | FRs | Must-know |
|--------|-----|-----------|
| Authentication | FR-001–003a | Register, login, logout, password recovery |
| Task List | FR-004–009a | CRUD, active/completed split, select focus task, revert completed → active |
| Pomodoro | FR-010–015 | Configurable work (5–90 min, default 25) and break (1–30 min); cycle linked to task; audio + UI at end; user confirms transitions; mid-cycle completion prompt |
| Delight | FR-016 | Surprise animation on task complete — **nice-to-have**, defer until core loop is solid |
| Adaptive Focus | FR-017–022 | Work type + weight on tasks; session context tracking; post-cycle check-in; scored suggestion; user can override |

**US-01** (full session): Given logged-in user with ≥1 active task, when they select → start → work → end notification → confirm transition, then cycle completes, break starts, and completed tasks stay visible in the completed list.

## Non-functional targets

| Requirement | Target |
|-------------|--------|
| Action acknowledgement | ≤200ms (task add, cycle start, check-in) |
| Long operations | Visible feedback if >1s (e.g. suggestion generation) |
| Timer drift | ≤±2s per configured cycle |
| Persistence | Tasks, cycle config, session state survive refresh/crash |
| Data isolation | One user never sees another user's data |
| Mental state data | Not shared externally; used only for same-user suggestions |
| Browsers | Latest 2 major versions of Chrome, Firefox, Safari, Edge (desktop) |
| Session history | Accessible ≥90 days; archive OK after, delete only with warning |

## Adaptive focus / scoring

**User inputs:** task weight (1–3), work type (deep work / admin / reactive), check-in energy (Focused / Steady / Fading).

**Session-derived inputs:** cycles completed, interruptions (task switch or mid-cycle completion), time of day. Session starts at first Pomodoro after login or after explicit "End session"; ends on "End session" or 4h inactivity.

**Output:** Ranked next-task suggestion with brief rationale. High energy + low interruptions → favor high-weight deep work; low energy / high interruptions / late day → lighter admin/reactive tasks.

**Formula:** Deterministic `weight × type fit × session context` — not ML. Exact coefficients TBD at implementation; directional behavior is the contract.

**Override:** User may pick any task; override is not penalized and feeds session context.

## Non-goals (MVP)

- No mobile app or native push — browser-only, in-tab notifications
- No analytics dashboards — history stored, no charts/trends/reports
- No team/social features — single-user only
- No AI/ML scoring — deterministic formula only
- No external tool integrations — no import/export

## When to read the full PRD

Read [context/foundation/prd.md](context/foundation/prd.md) for:

- Full acceptance criteria per user story (e.g. US-01 details)
- Per-FR Socrates rationale and priority notes
- Complete business logic section and open questions (scoring coefficients)
- Access control details and all NFR wording

**Trigger checklist:**

- [ ] Implementing or changing a feature — map to FR number and acceptance criteria
- [ ] Writing tests — verify against user stories and guardrails
- [ ] UX or timing decisions — check NFRs (200ms, ±2s timer, confirmation flows)
- [ ] Scoping or prioritizing — check non-goals and FR-016 deferral
- [ ] Adaptive scoring — confirm inputs, session boundaries, and override behavior

## Implementation reminders

- **Mid-cycle task done (FR-015):** Prompt — continue cycle with next task, or end cycle and break now; if no active tasks remain, only "end cycle" option.
- **Completed tasks:** Move immediately on mark; stay visible in completed list; support one-tap revert (FR-009a).
- **Cycle end (FR-013–014):** Audio + UI prompt; timer does **not** auto-transition to break.
- **Session boundaries (FR-019):** Interruption = user-initiated task change or mid-cycle completion — narrow, measurable definition.
