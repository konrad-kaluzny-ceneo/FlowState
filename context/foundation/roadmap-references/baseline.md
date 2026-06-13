> Detail reference — load on demand. Index: [roadmap.md](../roadmap.md).

# Baseline

## Baseline

What's already in place in the codebase as of `2026-05-26` (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present — Next.js 16 + React 19 + Tailwind 4 wired; `src/app/page.tsx` + `src/app/_components/task-list.tsx` already implements full task CRUD UI with active/completed split (covers FR-004–FR-008, FR-009a UI side).
- **Backend / API:** present — tRPC 11 wired (`src/server/api/trpc.ts`, `src/server/api/root.ts`); `taskRouter` registered; protected-procedure helper present and tested.
- **Data:** partial — Prisma 7 + `@prisma/adapter-neon` wired; one `Task` model (`prisma/schema.prisma`) with `id / title / status / userId / timestamps`; one initial migration. Missing: `workType`, `weight` columns on Task; `Session`, `Cycle`, `CheckIn` entities. This is what `F-01` adds.
- **Auth:** present — Neon Auth wired end-to-end: `proxy.ts` middleware, `src/app/auth/sign-in` + `sign-up` routes, `src/app/api/auth/[...path]/route.ts`, `src/lib/auth/{client,server}.ts`. FR-001/FR-002/FR-003 covered. FR-003a (recovery) **technically supported by Neon Auth** but UI surface not verified end-to-end — `S-07` validates and exposes it.
- **Deploy / infra:** present — Vercel project linked; GitHub Actions CI (`.github/workflows/ci.yml`) runs quality + e2e belt on PR/push to main.
- **E2E testing:** absent — no Playwright, no headless browser, no test auth bypass. Unit/integration tests exist (Vitest + fast-check) but cannot verify UI behavior in a browser. This is what `F-02` adds.
- **Observability:** absent — Vercel default request logs only; no Sentry / OTel / log drains. Out of MVP scope; revisit post-launch.
