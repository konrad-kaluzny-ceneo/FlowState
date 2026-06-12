> Detail reference — load on demand. Index: [roadmap.md](../roadmap.md).

# Parked

## Parked

- **FR-016: full surprise animation on task completion** — Why parked: PRD marks full surprise animation as `nice-to-have`; FR-038 (calm completion moment) shipped in S-13 instead.
- **Mobile / native push notifications** — Why parked: PRD §Non-Goals — browser-only.
- **Historical analytics or dashboards** — Why parked: PRD §Non-Goals — session history retained but no charts/trends.
- **Team / social / shared-task features** — Why parked: PRD §Non-Goals — single-user only.
- **AI/ML-powered scoring** — Why parked: PRD §Non-Goals — deterministic formula only.
- **External integrations (Jira / Todoist / Calendar / Slack)** — Why parked: PRD §Non-Goals.
- **Observability stack (Sentry / OTel / log drains)** — Why parked: not gated by must-have FR; revisit when operational need arises.
- **Cross-day focus streak nudge (P-106 / ideas-notes "statystyki" adjacent)** — Why parked: return-day streak surfacing is cross-session pattern analytics — conflicts with PRD §Non-Goals and parked "Historical analytics or dashboards" even without charts. Expand score 39/100 — **reject**.
- **ideas-notes: tagi / projekty / SMART / deadline'y / zadania cykliczne / nawyki / mobile / AI plan tuning** — Why parked: either generic CRUD not tied to wedge (tags, projects, SMART tooling), future platform scope (mobile), or explicit Non-Goals (AI/ML scoring). Revisit only if a slice proves they feed FR-021 scoring or context recovery — not as standalone list features.
- **Recurring wedge kickoff tasks (P-109)** — Why parked: daily recurring template reopens ideas-notes recurring/habits scope and RRULE creep; kickoff scoring can weight standing tasks via work-type/weight today. Expand score 53/90 — **reject** (roadmap-expand 2026-06-07).
- **Session-end completion moment (P-207 / follow-up batch 2)** — Why parked: duplicate of S-13 per-task delight + S-17 session closure; a third celebration surface adds motion fatigue without wedge value. Expand score 45/90 — **reject** (follow-up 2026-06-07).
- **Suggestion helpfulness one-tap (P-207 / ideation)** — Why parked: PRD forbids AI/ML scoring; no MVP consumer for Helpful/Not quite without formula calibration path — collecting feedback is dead weight. Expand score 43/100 — **reject** (UX gaps batch 2026-06-07).
- **Accessible wedge overlay gates (P-102 / roadmap-expand 2026-06-12)** — Why parked: S-12 polished visuals but full SR/focus-trap/live-region coverage on wedge gates unsliced; gates keyboard shortcuts. Expand score 66/90 — **park** until S-21/S-28 land.
- **Wedge keyboard shortcuts (P-103 / research gap)** — Why parked: accept/override/start without mouse — power-user speed; ship after accessible overlay gates or as combined slice. Expand score 67/90 — **park**.
- **Session reconnect calm banner (P-104 / research gap)** — Why parked: NFR connection-loss recovery exists but no UX surface; lightweight banner slice candidate. Expand score 61/90 — **park**.
- **Post-merge wedge activation coach (P-106 / roadmap-expand 2026-06-12)** — Why parked: real FR-025 gap for merged accounts but too small for standalone slice — extend S-11/S-14 acceptance criteria instead. Expand score 69/90 — **park**.
