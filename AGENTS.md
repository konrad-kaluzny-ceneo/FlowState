# Repository Guidelines

FlowState is a Next.js 15 (App Router) application using tRPC 11, Drizzle ORM with SQLite (@libsql), React 19, Tailwind CSS 4, and TypeScript 5.8. Scaffolded via create-t3-app (v7.40.0).

## Build, Test, and Development Commands

- `npm run dev` — start dev server with Turbopack
- `npm run build` — production build (validates env vars via `@src/env.js`)
- `npm run test` — run tests once (Vitest)
- `npm run typecheck` — type-check without emitting
- `npm run check` — lint and format check (Biome)
- `npm run check:write` — auto-fix lint/format issues
- `npm run db:push` — push schema changes to SQLite
- `npm run db:generate` — generate Drizzle migrations
- `npm run db:migrate` — apply migrations

## Project Structure

```
src/
  app/           → Next.js App Router pages and API routes
  app/_components/ → page-level React components (underscore-prefixed)
  server/api/    → tRPC router definitions and initialization
  server/db/     → Drizzle schema and DB client
  trpc/          → client-side tRPC hooks and query-client setup
  test/          → Vitest setup and test files
  styles/        → global CSS (Tailwind)
  env.js         → runtime env validation (Zod schema)
```

Foundation docs live in `context/foundation/` — see `@context/foundation/prd.md` for product requirements and `@context/foundation/tech-stack.md` for stack rationale.

## Coding Style & Naming

- Indentation: tabs (size 2). Line endings: LF. Enforced by Biome and `@.editorconfig`.
- Biome handles linting, formatting, and import sorting — no ESLint in this project.
- Tailwind class sorting enforced via Biome's `useSortedClasses` rule (utility functions: `clsx`, `cva`, `cn`).
- Path alias: `~/` maps to `src/`. Use it for all intra-project imports.
- Page-level components go in `_components/` co-located with their route.
- tRPC routers go in `src/server/api/routers/<feature>.ts` and must be registered in `@src/server/api/root.ts`.
- Drizzle tables use the `createTable` helper from `@src/server/db/schema.ts` (prefixes tables with `.bootstrap-scaffold_`).

## Testing

- Framework: Vitest 4 with jsdom environment and React Testing Library.
- Setup file: `@src/test/setup.ts` (extends matchers via `@testing-library/jest-dom`).
- Place test files in `src/test/` or co-locate as `*.test.ts(x)`.
- Run a single test: `npx vitest run src/test/smoke.test.ts`

## Commit Conventions

Conventional Commits format: `type(scope): lowercase description`. Types observed: `feat`, `docs`, `init`. No trailing period. Keep descriptions concise.

## Environment & Secrets

- Copy `.env.example` to `.env` for local development. Never commit `.env`.
- All env vars must be declared in `@src/env.js` (Zod schema). Build fails on missing vars unless `SKIP_ENV_VALIDATION=1`.
- Currently required: `DATABASE_URL` (SQLite file path, e.g. `file:./db.sqlite`).
