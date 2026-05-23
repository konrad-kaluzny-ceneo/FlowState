# Repository Guidelines

FlowState is a Next.js 15 (App Router) application using tRPC 11, Drizzle ORM with SQLite (@libsql), React 19, Tailwind CSS 4, and TypeScript 5.8. Scaffolded via create-t3-app (v7.40.0).

## Tripwires

- All env vars must be declared in `@src/env.js` (Zod schema). Build fails on missing vars unless `SKIP_ENV_VALIDATION=1`.
- Every tRPC router must be registered in `@src/server/api/root.ts` — unregistered routers are silently unreachable.
- Drizzle tables must use the `createTable` helper from `@src/server/db/schema.ts` (prefixes tables with `.bootstrap-scaffold_`). Raw `sqliteTable` calls break the naming convention.
- Drizzle migrations must be generated with `npx drizzle-kit generate` before `npx drizzle-kit migrate`. Running migrate without a pending generation silently does nothing.
- tRPC middleware runs in declaration order — auth middleware must come before any procedure that reads `ctx.session`.

## Build, Test, and Development Commands

See `@package.json` scripts section.

## Project Structure

See `@src/` for full layout. Non-obvious conventions:
- Page-level components go in `_components/` co-located with their route.
- tRPC routers go in `src/server/api/routers/<feature>.ts`.
- Foundation docs live in `context/foundation/` — see `@context/foundation/prd.md` for product requirements and `@context/foundation/tech-stack.md` for stack rationale.

## Coding Style & Naming

- Indentation: tabs (size 2). Line endings: LF. Enforced by Biome and `@.editorconfig`.
- No ESLint or Prettier — Biome is the sole linter/formatter. Do not add either.
- Tailwind class sorting enforced via Biome's `useSortedClasses` rule (utility functions: `clsx`, `cva`, `cn`).
- Path alias: `~/` maps to `src/`. Use it for all intra-project imports.

## Testing

- Setup file: `@src/test/setup.ts` (extends matchers via `@testing-library/jest-dom`).
- Place test files in `src/test/` or co-locate as `*.test.ts(x)`.
- Run a single test: `npx vitest run src/test/smoke.test.ts`

## Commit Conventions

Commits: `type(scope): msg`. Allowed types: `feat`, `docs`, `init`. No trailing period.

## Environment & Secrets

- Currently required: `DATABASE_URL` (SQLite file path, e.g. `file:./db.sqlite`).
