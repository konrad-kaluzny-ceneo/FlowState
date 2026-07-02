---
change_id: mindful-day-memory
title: Mindful day memory (S-42) — Domknięte/Zostaje/Wróć tutaj day-memory narrative
status: planned
created: 2026-06-30
updated: 2026-06-30
archived_at: null
---

## Notes

S-42 — S-30 phase 2. Formatter-only narrative day memory over the existing `DailyRecap`:
section labels **Domknięte / Zostaje / Wróć tutaj** (done / remains / return-to) using the
`DayMemory.*` catalog (reserved by F-14; not yet consumed). No new tRPC or Prisma queries.
Soft dep F-14; built on S-30, S-18. Linear [FLO-90], GitHub [#174].

Worktree set up for implementation at `../FlowState-mindful-day-memory` on branch
`features/mindful-day-memory`, with `.env` copied over.
