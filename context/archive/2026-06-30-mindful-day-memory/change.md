---
change_id: mindful-day-memory
slice: S-42
title: Mindful day memory
status: archived
created: 2026-06-30
updated: 2026-07-02
archived_at: 2026-07-02T13:29:28Z
---

# Mindful day memory (S-42)

**Outcome:** user sees a calm day memory — Domknięte (done) / Zostaje (remains) / Wróć tutaj (return-to) — instead of a raw timing log; collapsed one-line on home; expanded view has exactly three narrative sections; helps closure and return context.

**PRD refs:** US-03 Secondary craft

**Prerequisites (done):** S-30 daily-work-timing-recap, S-18 task-resume-context-note, soft F-14 product-voice-contract; best placed after S-40 home-ia-reset / S-41 desktop-calm-workbench (both done)

**Relationship:** S-30 `daily-work-timing-recap` Phase 2 — presentation/formatter only over the existing recap builder. This is explicitly a formatter-only, presentation-layer change. Do not add new backend queries (tRPC/Prisma).

**Tracking:** Linear [FLO-90], GitHub [#174].

**Acceptance criteria:**
- `format-day-memory.ts` pure formatter over the EXISTING `DailyRecap` — no new tRPC/Prisma queries
- Collapsed one-line on home load — no scroll, no log
- "Wróć tutaj" names the last focused task after interruption
- Expanded view = exactly three narrative sections, NOT `title · 45m · timestamp` raw log style

**Unknowns (non-blocking, implementer decides):**
- Guest parity for the narrative formatter
- Footprint sub-phase coexistence with S-30

**Risk:** Duplicate S-30 substrate or accidental new data pipeline — this MUST be avoided.

See [`research.md`](./research.md) for detailed findings, [`plan.md`](./plan.md) for the implementation plan, and [`reviews/plan-review.md`](./reviews/plan-review.md) for the plan review (PASS_WITH_WARNINGS_FIXED, 3 warnings auto-fixed in-plan, no open findings, 93/100 confidence to proceed).

See [`reviews/impl-review.md`](./reviews/impl-review.md) for the implementation review (1 critical finding fixed during triage — collapsed-line fallback text produced grammatically broken output when there was no return-to task; 1 warning + 1 observation skipped as non-issues).
