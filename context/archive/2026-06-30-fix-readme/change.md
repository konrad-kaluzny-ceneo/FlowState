---
change_id: fix-readme
title: Align README with actual implementation for documentation consistency
status: archived
created: 2026-06-30
updated: 2026-07-05
archived_at: 2026-07-05T19:46:03Z
---

## Notes

utwórz follow-up task odnośnie uwag do readme, by była spójność dokumentacji względem implementacji.

Konkretne rozbieżności wykryte podczas analizy MVP (README.md vs kod):

- Sekcja "Tech Stack" wymienia **Drizzle** jako ORM — projekt faktycznie używa **Prisma 7** (`package.json`, katalog `prisma/`, import `@prisma/generated`).
- "Framework | Next.js 15" — `package.json` ma `next: ^16.2.6` (Next.js 16).
- Skrypty opisane jako Drizzle: `db:generate` ("Generate Drizzle migration files"), `db:migrate`, `db:studio` ("Open Drizzle Studio") — w rzeczywistości to komendy Prisma (`prisma generate`, `prisma migrate dev`, `prisma studio`).
- Sekcja "Project Structure" wspomina `server/db/` jako "Drizzle schema and DB client" — zweryfikować rzeczywistą strukturę.

Cel: README ma odzwierciedlać faktyczny stack i komendy, bez wprowadzania w błąd.
