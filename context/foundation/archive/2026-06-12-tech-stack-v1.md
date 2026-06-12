---
starter_id: t3
version: 1
archived: 2026-06-12
package_manager: pnpm
project_name: flow-state
hints:
  language_family: js
  team_size: solo
  deployment_target: vercel
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: verified
  path_taken: custom
  quality_override: false
  self_check_answers:
    typed: true
    from_official_starter: true
    conventions: true
    docs_current: true
    can_judge_agent: true
  has_auth: true
  auth_provider: neon-auth
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
---

## Why this stack

Solo builder shipping a Pomodoro + adaptive-focus web-app with auth on a 6-week after-hours timeline. T3-derived stack (Next.js + tRPC + Prisma + Tailwind) delivers type-safe contracts from database to UI with zero assembly — the three load-bearing factors are verified bootstrapper confidence, all four agent-friendly gates passing, and a clear path to production auth via Neon Auth (PRD FR-001 through FR-003a). Vercel is the native deployment target; GitHub Actions with auto-deploy-on-merge is the default CI shape. pnpm strict-isolated workspace provides dependency safety without changing the starter's core scaffold.

## Core Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js | 16 |
| Language | TypeScript | 6 |
| UI | React | 19 |
| Styling | Tailwind CSS | 4 |
| ORM | Prisma (with @prisma/adapter-neon) | 7 |
| API | tRPC + Tanstack React Query | 11 / 5 |
| Validation | Zod | 4 |
| Database | Neon Serverless Postgres | 18 |
| Auth | Neon Auth (Better Auth) | 0.4.x-beta |
| Linter/Formatter | Biome | 2 |
| Testing | Vitest + fast-check | 4 / 4 |
| Package Manager | pnpm | 11 |

## ORM: Prisma

**Provider: Prisma 7** with `@prisma/adapter-neon` for serverless Neon connectivity.

The project migrated from Drizzle ORM to Prisma 7 to leverage:

- **Rust-free TypeScript runtime** — Prisma 7 dropped the Rust query engine for a fully TS-based client, yielding smaller bundles and faster cold starts
- **Driver adapters** — `@prisma/adapter-neon` connects via Neon's HTTP driver (`@neondatabase/serverless`) for optimal serverless performance
- **Schema-first workflow** — `prisma/schema.prisma` is the single source of truth for the database schema
- **Type-safe client** — generated at `./generated/prisma/client` with full model types and query builder

**Key files:**
- `prisma/schema.prisma` — schema definition (maps to `flow_state_task` table)
- `prisma.config.ts` — Prisma CLI configuration (datasource URL, migration path)
- `src/server/db/index.ts` — PrismaClient instantiation with Neon adapter
- `generated/prisma/` — auto-generated client (gitignored, regenerated on build/dev)

**Workflow:**
```
1. Edit prisma/schema.prisma
2. pnpm prisma migrate dev (creates migration + applies)
3. pnpm prisma generate (regenerates client types)
```

**Table naming:** All tables use `@@map("flow_state_<name>")` to maintain the `flow_state_` prefix convention from the original Drizzle schema.

## Authentication

**Provider: Neon Auth** (https://neon.com/docs/auth/overview)

Neon Auth is the chosen authentication solution for FlowState. It integrates directly with the Neon Postgres database already used for data storage, providing:

- Built-in user management backed by the same Neon infrastructure as the app database
- OAuth social login support (Google, GitHub, etc.) and email/password flows
- Session handling with JWT tokens
- Password reset and account recovery (satisfies FR-003a)
- User data co-located with application data in the same Neon project — no separate auth service to manage

**Route protection:** Uses Next.js 16 `proxy.ts` convention (replaces deprecated `middleware.ts`). The proxy calls `auth.middleware()` from `@neondatabase/auth/next/server`.

**Rationale over NextAuth/Auth.js:**
- Zero additional infrastructure — auth lives inside the existing Neon project
- Tighter integration with Prisma schema (user table is a native Postgres table in the same DB)
- Reduces vendor surface: one fewer dependency to maintain, one fewer service to monitor
- Co-location eliminates the network hop between auth verification and user data queries

## Notable Upgrades (May 2026)

The stack underwent a major upgrade cycle:

| Package | From | To | Notes |
|---------|------|-----|-------|
| ORM | Drizzle 0.45 | Prisma 7.8 | Full migration including schema, queries, tests |
| Next.js | 15.5 | 16.2 | Adopted `proxy.ts` convention, `jsx: react-jsx` |
| TypeScript | 5.8 | 6.0 | Removed deprecated `baseUrl`, paths work without it |
| Zod | 3.24 | 4.4 | Major version, compatible with @t3-oss/env-nextjs |
| React | 19.0 | 19.2 | Patch upgrade |
| tRPC | 11.0 | 11.17 | Patch upgrade |
| Tailwind | 4.0 | 4.3 | Patch upgrade |
| Biome | 2.2 | 2.4 | Patch upgrade |
| esbuild | — | 0.28 | Transitive dep (tsx/vite), removed as direct dep |
| PostCSS | 8.5.3 | 8.5.15 | Transitive dep (@tailwindcss/postcss), removed as direct dep |
