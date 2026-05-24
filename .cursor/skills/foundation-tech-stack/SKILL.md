---
name: foundation-tech-stack
description: FlowState tech stack — T3 starter rationale, Neon Auth integration, Vercel deployment, GitHub Actions CI, and pnpm conventions. Use when adding dependencies, changing auth, modifying build/deploy config, evaluating stack alternatives, or questioning "why this stack".
---

# FlowState Tech Stack

## Stack at a glance

| Layer | Choice |
|-------|--------|
| Starter | **T3** (create-t3-app) — Next.js + tRPC + Drizzle + Tailwind |
| Framework | Next.js 15, React 19, TypeScript (strict) |
| API | tRPC + TanStack React Query + Zod + superjson |
| Database | Drizzle ORM on Neon Postgres (`@neondatabase/serverless`) |
| Auth | **Neon Auth** (`@neondatabase/auth`) — co-located with DB |
| Styling | Tailwind CSS 4 |
| Lint/format | Biome (no ESLint/Prettier) |
| Testing | Vitest |
| Package manager | **pnpm** (strict isolated `node_modules`, no hoisting) |
| Deploy | **Vercel** (native Next.js target) |
| CI | GitHub Actions, auto-deploy-on-merge |

Project conventions live in `AGENTS.md`. Operational deploy/Neon CLI rules are in the [foundation-infrastructure](foundation-infrastructure/SKILL.md) skill.

## Why T3

Solo builder, ~6-week after-hours MVP. T3 was chosen because it delivers **deep type-safe contracts from database → tRPC → UI with minimal assembly. All four agent-friendly quality gates passed (typed, official starter, documented conventions, bootstrapper can judge agent output). Vercel is the native deployment target; GitHub Actions with auto-deploy-on-merge is the default CI shape.

**Do not swap core layers** (Next.js, tRPC, Drizzle, Tailwind) without explicit user approval — they are load-bearing for the MVP timeline.

## Authentication — Neon Auth

**Provider:** [Neon Auth](https://neon.com/docs/auth/overview) (`@neondatabase/auth`)

Auth lives inside the existing Neon project — no separate auth service.

| Capability | Detail |
|------------|--------|
| User storage | Native Postgres tables in the same Neon DB as app data |
| Flows | OAuth (Google, GitHub, etc.), email/password, password reset (FR-003a) |
| Sessions | JWT + cookie-based session handling |
| Server setup | `createNeonAuth` in `src/lib/auth/server.ts` |
| Required env | `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET` (declared in `src/env.js`) |

**Why Neon Auth over NextAuth/Auth.js:**

- Zero additional infrastructure — auth co-located with the DB
- Drizzle-native user tables in the same Postgres instance
- One fewer vendor and service to monitor
- No network hop between auth verification and user data queries

When changing auth flows, read the full doc for integration details and PRD auth FRs (FR-001–003a).

## Dependency & tooling rules

- **pnpm only** — never `npm` or `yarn`
- **Env vars** — declare all new vars in `src/env.js` (Zod schema via `@t3-oss/env-nextjs`); never commit secrets
- **Drizzle** — use `createTable` helper from `src/server/db/schema.ts`; generate migrations with `pnpm db:generate` before `pnpm db:migrate`
- **tRPC** — register every router in `src/server/api/root.ts`; auth middleware before procedures that read `ctx.session`
- **Path alias** — `~/` maps to `src/`

## CI/CD shape

- **GitHub Actions** runs checks on PRs
- **Auto-deploy on merge** to `main` via Vercel GitHub integration
- Manual preview-first deploys: see foundation-infrastructure skill

## Evaluating new dependencies

Before adding a package, check:

1. Does it fit the T3 type-safe stack (works with Next.js App Router, server/client boundaries)?
2. Does it duplicate an existing layer (e.g. another ORM, REST client alongside tRPC)?
3. Does it require a separate service when Neon/Vercel already cover the need?
4. Is it compatible with pnpm strict isolation?

Prefer official or T3-community patterns over ad-hoc alternatives.

## When to read the full research doc

Read [context/foundation/tech-stack.md](context/foundation/tech-stack.md) for:

- Complete starter selection rationale and bootstrapper metadata
- Full Neon Auth rationale and PRD cross-references
- Deployment target and CI shape decision context

**Trigger checklist:**

- [ ] Adding or replacing a dependency — align with stack rationale
- [ ] Changing auth flow, session handling, or user schema
- [ ] Modifying CI/CD, build scripts, or deploy config
- [ ] Questioning "why this stack" or evaluating an alternative
- [ ] Onboarding — understand load-bearing choices before refactoring

## Stack boundaries (MVP)

| In scope | Out of scope (see PRD non-goals) |
|----------|----------------------------------|
| Neon Auth, Drizzle, tRPC | Separate auth service, REST API layer |
| Vercel serverless + Neon Postgres | Background jobs, realtime, AI/ML libs |
| Deterministic scoring in-app | External analytics or team features |
| Browser in-tab notifications | Mobile app, native push |

For hosting limits, rollback, and production ops, use the [foundation-infrastructure](foundation-infrastructure/SKILL.md) skill instead.
