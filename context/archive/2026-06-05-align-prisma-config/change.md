---
change_id: align-prisma-config
title: Align Prisma config with Prisma 7 conventions
status: archived
created: 2026-06-05
updated: 2026-06-07
archived_at: 2026-06-07T13:19:10Z
---

## Notes

poprawienie konfiguracji prisma — zamienić własną `loadEnv()` na `import "dotenv/config"`, użyć `env()` z `prisma/config`, uprościć ścieżki; `DATABASE_URL_UNPOOLED` w `datasource.url` dla CLI (migracje), runtime bez zmian (`DATABASE_URL` + adapter Neon).
