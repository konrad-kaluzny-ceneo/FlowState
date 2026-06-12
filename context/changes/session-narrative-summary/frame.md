---
change_id: session-narrative-summary
created: 2026-06-12
status: accepted
---

# Frame Brief — session-narrative-summary (S-17)

## Observation (fixed ground)

Users completing Pomodoro sessions lack lightweight narrative continuity: no in-session progress line, no calm closure on session end, and no contextual handoff when returning after a long absence — despite resume notes (S-18) now existing for context recovery.

## Initial framing (preserved)

- **Stated scope:** Three narrative beats per FR-040 — in-flow summary, session closure, 8h return handoff composing S-18 resume note.
- **Pre-dispatch narrowing:** Leading concern is **return handoff + closure** (context recovery wedge); in-flow summary is secondary and must not compete with suggestion card on the same transition beat.

## Framing challenge result

| Hypothesis | Verdict | Rationale |
|------------|---------|-----------|
| This is analytics/dashboard scope creep | **Rejected** | FR-040 explicitly forbids charts/trends; roadmap parked analytics |
| Handoff requires blocking on new schema beyond S-18 | **Rejected** | S-18 shipped `Task.resumeNote`; handoff composes existing fields + session context |
| All three beats must ship atomically | **Rejected** | Roadmap orchestrator note: closure/intention can ship before handoff phase; phased plan is valid |
| In-flow summary overlaps suggestion rationale | **Accepted risk** | Mitigation: show summary between cycles only, never stacked on suggestion card (roadmap risk note) |

## Locked product decisions (decision proxy — orchestrator)

| Unknown (roadmap) | Decision | Confidence |
|-------------------|----------|------------|
| Timeout-ended session closure | Same calm closure overlay as user-initiated end | 85% |
| Guest mode narrative | Derive from local guest session blob; omit server-only fields | 88% |
| Cycle intention prompt | First work cycle of session only; skippable | 82% |
| 8h return threshold anchor | Elapsed since `Session.endedAt` (or guest equivalent); fixed 8h | 90% |
| Intention storage | `Cycle.intention` (nullable string, ~80 chars) for logged-in; ephemeral in guest blob | 85% |
| Handoff composition priority | Resume note clause first when present; task title second; max two clauses | 88% |
| Transition surface rule | At most one interstitial line + one gate per beat (PRD open Q2) | 95% |

## Scope boundaries

**In:** In-flow one-liner (cycles done, tasks completed, latest energy, optional intention), closure line on session end, dismissible 8h return handoff, guest parity from local blob.

**Out:** Charts, streaks, totals, comparative stats, analytics screens, third celebration surface (P-207 rejected), scoring changes.

## Recommended plan structure

1. **Phase A — Domain + copy module:** session narrative builder (pure functions), optional `Cycle.intention` migration.
2. **Phase B — In-flow + closure UI:** summary strip between cycles; closure overlay on session end (user + timeout paths).
3. **Phase C — Return handoff:** 8h dismissible banner composing closure + resume note.
4. **Phase D — Tests + cookbook:** unit tests for builder; e2e for closure + handoff paths.

## Next

`/10x-research session-narrative-summary` then `/10x-plan session-narrative-summary`.
