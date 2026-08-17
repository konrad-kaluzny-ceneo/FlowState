# Day schedule timeline — Plan Brief

> Full plan: `context/changes/day-schedule-timeline/plan.md`

## What & Why

Plan dnia today shows a blurred “Kalendarz wkrótce” mock while focus budget and delegation are real. S-54 delivers a **persisted daily time axis** with editable blocks (focus, meeting, break, personal, planning, batch) so users can plan their workday in time — the foundation for RRULE (S-56), planning sessions (S-55), and plan→focus handoff (S-58).

## Starting Point

- `plan-dnia-view.tsx` — static `DayCalendarMock` inside `ComingSoonPreview` (lines 17–95, 292–297).
- `DayPlan` Prisma model — budget + energy only; no schedule entities.
- `dayPlan` tRPC router — auth-only; no block CRUD.
- `@dnd-kit/*` already used in `task-list.tsx` for reorder.
- Guest `/plan` — mock calendar + `guestEmpty`; no day-plan persistence.

## Desired End State

A logged-in user opens Plan dnia, sees a **06:00–22:00 scrollable timeline**, adds/moves/resizes blocks with **15-minute snap**, attaches **one focus task** or **multiple batch tasks** (with optional meta label), assigns **fixed or custom GTD context**, and all changes persist per `localDateKey` with **optimistic UI** and **overlap prevention**. Guest users still see the blurred mock. Budget panel and delegation card remain unchanged below the timeline.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| -------- | ------ | ------------------ | ------ |
| Guest schedule | Auth-only | Matches current day-plan auth pattern; avoids guest snapshot scope creep | Plan |
| GTD context | Fixed enum + per-user custom tags table | Bounded defaults with reusable user labels — not free-form per block | Plan |
| Block attachments | Full FR-002 in S-54 | Focus 0–1 task; batch checklist + optional meta label | Plan |
| Timeline UX | Drag + resize on axis | Custom `@dnd-kit/core` Draggable + Y→minute mapping — not task-list SortableContext | Plan |
| Overlaps | Prevent (server reject) | Keeps axis readable; simpler than column stacking | Plan |
| Axis range | 06:00–22:00 fixed | Wider than mock; covers typical workday without week view | Plan |
| Time snap | 15 minutes | Balances precision and calm editing | Plan |
| Mutations | Optimistic CRUD | Meets ≤200ms NFR; Phase 2 pessimistic API-first, Phase 3–4 optimistic per L-04 surface oracles | Plan |
| API shape | Extend `dayPlan` router | Same `localDateKey` namespace as budget/energy | Plan |

## Scope

**In scope:** Prisma schedule models; `dayPlan` block + context-tag procedures; auth repository/hook layer; timeline UI replacing mock; FR-002 attachments; FR-004 context; vitest + component tests; belt e2e for `/plan` block CRUD smoke.

**Out of scope:** RRULE/recurrence (S-56); planning session timer (S-55); plan→Fokus handoff (S-58); guest schedule storage; week view; external calendar; Podsumowanie schedule analytics (S-61); scorer changes from block context.

## Architecture / Approach

New `ScheduleBlock` (+ join table for batch tasks, `UserContextTag` for custom contexts) keyed by `(userId, localDateKey)` — independent of whether a `DayPlan` budget row exists. Extend `dayPlan` tRPC with block CRUD and overlap validation. New `useDaySchedule` hook wraps optimistic mutations. `DayScheduleTimeline` component replaces `ComingSoonPreview` for auth users; guest branch unchanged.

```
Plan page (auth) → useDaySchedule → dayPlan.listBlocks / mutations → ScheduleBlock tables
                 → plan-dnia-view → DayScheduleTimeline (@dnd-kit drag/resize)
                 → useDayPlan (unchanged budget panel)
```

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Schema & domain | Models, enums, migration, shared types | Overlap invariants must be enforceable in SQL/app layer |
| 2. Repository & tRPC | Block CRUD, context tags, overlap validation, hook skeleton | dayPlan router growth; isolation tests |
| 3. Timeline UI | 06–22 axis, drag/resize, 15-min snap, replace mock | Vertical dnd-kit timeline is greenfield UX |
| 4. Attachments & context | FR-002 + FR-004 pickers on block edit panel | Batch checklist UX complexity |
| 5. Tests & verification | Vitest, component, e2e belt | Flaky drag e2e — prefer API seed + smoke |

**Prerequisites:** S-53 merged; local dev DB; auth e2e pool.  
**Estimated effort:** ~4–5 implementation sessions across 5 phases.

## Open Risks & Assumptions

- Vertical timeline drag/resize is greenfield — Phase 3 uses `Draggable` + custom modifiers, not `SortableContext` from `task-list.tsx`; budget spike time if needed.
- Custom context tags: trim, strip control chars, max 32 chars label, cap 50 tags per user.
- Auth-only guest exception documented in plan; FR-017 preserved explicitly.
- Overlap checks run inside DB transactions to prevent concurrent double-booking.
- No timer-hub edits in this slice — no `pnpm change-impact` required unless scope creeps.

## Success Criteria (Summary)

- Authenticated user adds, moves, resizes, and deletes blocks on Plan dnia; changes survive reload for the same local day.
- Overlapping blocks are rejected with calm inline error; optimistic rollback on failure.
- Focus block holds ≤1 task; batch block holds multiple tasks with optional meta label; context assignable from fixed set or user tags.
