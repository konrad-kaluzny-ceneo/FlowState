---
change_id: align-prisma-config
title: Align Prisma config with Prisma 7 conventions
status: archived
created: 2026-06-26
updated: 2026-06-26
archived_at: 2026-06-26T11:32:00Z
---

## Notes

Roadmap slice F-03. Linear: FLO-22. GitHub: #33.

Foundation hygiene change to align `prisma.config.ts` with Prisma 7 conventions:
- import `dotenv/config`
- use `env()` from `prisma/config`
- keep schema and migrations paths relative to the config file
- use `DATABASE_URL_UNPOOLED` for Prisma CLI datasource operations

Runtime database access should remain on pooled `DATABASE_URL` through `@prisma/adapter-neon` in `src/server/db/index.ts`.

This slice has no PRD user-story dependency and can run in parallel with product slices. Main value is reducing Prisma CLI and agent confusion after the Prisma 7 migration.
