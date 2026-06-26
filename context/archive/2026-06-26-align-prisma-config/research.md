---
date: 2026-06-26T12:53:11.6468809+02:00
researcher: GPT-5.5
git_commit: 0af573074d6b125f6b87e32708bac538844a793e
branch: features/align-prisma-config
repository: FlowState
topic: "F-03 align Prisma config hygiene for Prisma 7"
tags: [research, codebase, prisma, neon, config, ci]
status: complete
last_updated: 2026-06-26
last_updated_by: GPT-5.5
---

# Research: F-03 align Prisma config hygiene for Prisma 7

**Date**: 2026-06-26T12:53:11.6468809+02:00  
**Researcher**: GPT-5.5  
**Git Commit**: 0af573074d6b125f6b87e32708bac538844a793e  
**Branch**: features/align-prisma-config  
**Repository**: FlowState

## Research Question

Research roadmap slice F-03 / change `align-prisma-config` for Prisma 7 config hygiene. Focus on existing Prisma config/schema/client setup, env handling, scripts, generated client import paths, migrations, CI/build scripts, documented tech-stack expectations, and current Prisma CLI behavior. Do not implement code.

## Summary

F-03 is a narrow foundation hygiene change centered on `prisma.config.ts`. The current config still uses a custom `.env` parser plus raw `process.env` fallback chain, while both the roadmap and Prisma 7 docs call for `import "dotenv/config"` and `env()` from `prisma/config`.

The runtime database client is already aligned with the desired split: app runtime uses pooled `DATABASE_URL` through `@prisma/adapter-neon`, while CLI operations should use unpooled `DATABASE_URL_UNPOOLED`. The implementation should preserve `prisma/schema.prisma`, generated client output, runtime client setup, migration files, CI topology, and package scripts unless verification exposes an actual break.

The main risk is behavioral strictness: replacing `process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? ""` with `env("DATABASE_URL_UNPOOLED")` intentionally removes the fallback and will fail Prisma CLI commands when the unpooled URL is missing. This matches F-03's outcome, but should be called out in the plan.

## Detailed Findings

### Prisma config is the primary implementation target

- `prisma.config.ts:1-43` imports `readFileSync`, `path`, and `defineConfig`, then manually reads `.env` from the repo root.
- `prisma.config.ts:5-32` contains a hand-rolled `loadEnv()` parser that strips quotes and fills `process.env` only when the key is not already set.
- `prisma.config.ts:34-42` exports `defineConfig` with:
  - `schema: path.join(import.meta.dirname, "prisma", "schema.prisma")`
  - `migrations.path: "prisma/migrations"`
  - `datasource.url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? ""`
- F-03 asks for the official Prisma 7 pattern: `import "dotenv/config"`, `env()` from `prisma/config`, relative schema/migrations paths, and `DATABASE_URL_UNPOOLED` for CLI datasource operations (`context/foundation/roadmap-references/items/F-03.md:7`).

### Current Prisma 7 docs support the target pattern

Context7 Prisma docs for Prisma 7 show `prisma.config.ts` using:

- `import "dotenv/config"` before config access.
- `import { defineConfig, env } from "prisma/config"`.
- Relative `schema: "prisma/schema.prisma"` and `migrations.path: "prisma/migrations"`.
- `datasource.url: env("DATABASE_URL")` or typed `env<Env>("DATABASE_URL")`.

The docs also show `env()` reads `process.env` and throws a Prisma config env error if the variable is not defined. For FlowState, the expected variable is `DATABASE_URL_UNPOOLED`, not `DATABASE_URL`, because migrations and CLI database operations need the direct Neon endpoint.

### Schema and generated client are already aligned

- `prisma/schema.prisma:1-3` declares the Postgres datasource provider without a `url`, which is consistent with Prisma 7 config-file datasource URLs.
- `prisma/schema.prisma:5-8` uses generator provider `prisma-client` and outputs to `../generated/prisma`.
- `tsconfig.json:29-32` maps `@prisma/generated` to `./generated/prisma/client`.
- `vitest.config.ts:19-23` mirrors that alias for tests.
- `.gitignore:223-224` ignores `/generated`, so generated Prisma output remains build/dev generated rather than committed.

No schema, generator, migration, or alias change is required for F-03.

### Runtime DB access should remain unchanged

- `src/server/db/index.ts:1-21` imports `PrismaNeon`, imports `PrismaClient` from `@prisma/generated`, and creates the adapter with `env.DATABASE_URL`.
- Runtime access already uses the pooled Neon URL, exactly matching `context/changes/align-prisma-config/change.md:20`.
- The runtime split is also documented in `context/foundation/tech-stack.md:52-67`: Prisma 7 with `@prisma/adapter-neon`, schema in `prisma/schema.prisma`, CLI config in `prisma.config.ts`, and generated client at `generated/prisma/`.

F-03 should not edit `src/server/db/index.ts` unless verification proves the config change broke generated client imports.

### Env handling already requires both URLs for the app

- `src/env.js:9-29` validates both `DATABASE_URL` and `DATABASE_URL_UNPOOLED` as required server variables with `postgresql://` or `postgres://` prefixes.
- `src/env.js:60-64` maps both variables from `process.env`.
- `.env.example:12-18` documents both Neon DB URLs and Neon Auth variables.
- `vitest.config.ts:12-17` provides dummy Postgres-format values for both DB URLs during tests.
- `e2e/README.md:120` and `.github/workflows/ci.yml:3-4` document the same required secrets.

The Prisma CLI does not use `src/env.js`, so F-03's key value is making CLI-side config fail clearly when `DATABASE_URL_UNPOOLED` is missing rather than silently falling back to pooled `DATABASE_URL`.

### Package scripts and CI already exercise Prisma config

- `package.json:7-16` runs Prisma through:
  - `build`: `prisma generate && next build`
  - `db:generate`: `prisma generate`
  - `db:migrate`: `prisma migrate dev`
  - `db:migrate:prod`: `prisma migrate deploy`
  - `db:push`: `prisma db push`
  - `db:studio`: `prisma studio`
  - `dev`: `prisma generate && next dev --turbo`
- `.github/workflows/ci.yml:40-41` runs `pnpm exec prisma generate` in the `quality` job before lint/typecheck/test.
- `.github/workflows/ci.yml:84-91` runs `pnpm exec prisma generate`, then `pnpm db:migrate:prod` in the `e2e` job with both DB URLs injected at `.github/workflows/ci.yml:65-68`.
- `.github/workflows/ci.yml:101-105` builds and runs the e2e belt after migrations.
- `lefthook.yml:1-25` has no Prisma command, but pre-commit typecheck and tests depend on generated client availability.
- `pnpm-workspace.yaml:8-25` explicitly allows Prisma packages to run dependency build scripts under strict pnpm build controls.

The highest-signal verification for F-03 is CLI execution, not product tests: `pnpm db:generate`, `pnpm exec prisma validate`, and `pnpm exec prisma migrate status`.

### Existing docs have a small stale README mismatch

- `README.md:75-85` still describes `pnpm build` as "Run migrations + production build" and `pnpm db:generate` / `pnpm db:studio` as Drizzle commands.
- Current `package.json:7-16` shows `build` runs `prisma generate && next build`, `db:generate` runs `prisma generate`, and `db:studio` runs `prisma studio`.

This is not required for F-03 unless the implementation plan chooses to include adjacent docs hygiene. Keep it out of the main config change unless the plan explicitly budgets it.

## Code References

- `prisma.config.ts:1-43` - Current custom env loader and `process.env` fallback datasource URL.
- `prisma/schema.prisma:1-8` - Prisma 7 datasource/provider and `prisma-client` generator output.
- `src/server/db/index.ts:1-21` - Runtime Prisma client with Neon adapter and pooled `DATABASE_URL`.
- `src/env.js:9-29` - Required server env validation for `DATABASE_URL` and `DATABASE_URL_UNPOOLED`.
- `src/env.js:60-64` - Runtime env mapping for the same DB variables.
- `.env.example:12-18` - Local env documentation for both Neon URLs and auth vars.
- `package.json:7-16` - Prisma generate/migrate/push/studio scripts.
- `package.json:44-45` - Runtime Prisma dependencies: `@prisma/adapter-neon`, `@prisma/client`.
- `package.json:75-79` - `dotenv` and Prisma CLI dev dependencies.
- `tsconfig.json:29-32` - `@prisma/generated` alias.
- `vitest.config.ts:12-23` - Test env DB URL placeholders and alias mirror.
- `.github/workflows/ci.yml:40-47` - Quality job Prisma generation before lint/typecheck.
- `.github/workflows/ci.yml:65-68` - E2E job DB/auth secrets.
- `.github/workflows/ci.yml:84-91` - E2E job Prisma generate and migrate deploy.
- `prisma/migrations/migration_lock.toml:1-3` - Postgres migration provider lock.
- `.gitignore:223-224` - Generated Prisma client ignored.
- `context/foundation/roadmap-references/items/F-03.md:7-17` - Slice outcome and verification line.
- `context/changes/align-prisma-config/change.md:14-20` - Active change scope.

## Architecture Insights

- FlowState has a clean CLI/runtime database split: Prisma CLI should use the direct Neon URL; app runtime should use the pooled Neon URL through the Neon adapter.
- The generated client path is intentionally root-level and aliased. The implementation should not move `generated/prisma` or change `@prisma/generated` imports.
- Generated client correctness is treated as a build contract in the test plan, not something to unit-test (`context/foundation/test-plan.md:385`).
- Config path changes should be minimal: relative `schema` and `migrations.path` are enough. Avoid touching schema models, migration SQL, or package scripts.
- `dotenv` is already present in `package.json`, and `playwright.config.ts:13-18` already uses dotenv loading for `.env` / `.env.local`, so adopting `import "dotenv/config"` in Prisma config does not add a dependency.

## Implementation Risks

1. **Strict env behavior replaces a fallback.** `env("DATABASE_URL_UNPOOLED")` will throw if the var is missing. Current config falls back to `DATABASE_URL` and then `""`. This is the intended hygiene improvement, but it can break local CLI usage for anyone missing `DATABASE_URL_UNPOOLED`.

2. **Import order matters.** `import "dotenv/config"` must execute before `env("DATABASE_URL_UNPOOLED")` is evaluated.

3. **Relative path resolution must be verified through Prisma CLI.** Prisma docs show relative paths in `prisma.config.ts`; verify with `pnpm db:generate` and `pnpm exec prisma migrate status` from repo root.

4. **Generated client alias must keep resolving.** Any accidental change to `schema.prisma` generator output or `tsconfig`/Vitest alias would ripple into `src/server/db/index.ts` and persistence mappers.

5. **CI can fail earlier if secrets are incomplete.** The e2e job injects `DATABASE_URL_UNPOOLED`; quality job runs `prisma generate` without DB env in the workflow. Verify whether `prisma generate` with `env("DATABASE_URL_UNPOOLED")` requires the variable during generation in CI. If yes, either quality job needs env injection or the config must use a Prisma-supported pattern that keeps generate non-DB-dependent while migrations remain strict.

6. **Stale docs can mislead future agents.** README still names Drizzle commands for Prisma scripts. This is not a code risk for F-03 but is a known documentation drift.

## Files Likely Affected

Primary:

- `prisma.config.ts` - Replace custom loader with Prisma 7 config pattern.

Possible verification-only / documentation-only:

- `context/changes/align-prisma-config/plan.md` - Next stage should record strict-env decision and CI verification.
- `README.md` - Optional docs cleanup if plan broadens to remove stale Drizzle script descriptions.

Files that should remain unchanged:

- `prisma/schema.prisma`
- `prisma/migrations/**`
- `src/server/db/index.ts`
- `src/env.js`
- `package.json` scripts
- `tsconfig.json`
- `vitest.config.ts`
- `.github/workflows/ci.yml` unless `prisma generate` proves it now requires DB env in the quality job

## Test and Verification Recommendations

Aligned with `context/foundation/test-plan.md` and repo commands:

1. `pnpm exec prisma validate` - Fast schema/config sanity check.
2. `pnpm db:generate` - Confirms Prisma can load config and generate `generated/prisma`.
3. `pnpm exec prisma migrate status` - Confirms CLI can read `DATABASE_URL_UNPOOLED` and locate migrations.
4. `pnpm check` - Required local lint/format gate.
5. `pnpm typecheck` - Confirms `@prisma/generated` alias still resolves after generation.
6. `pnpm test` - Required unit/integration gate; no new tests expected for generated Prisma client per test-plan negative space.

No Playwright belt is recommended for this config-only slice unless a build/runtime change is unexpectedly introduced. The test plan treats generated Prisma client behavior as a generator/build contract, not an e2e user-flow risk.

## Historical Context

- `context/archive/2026-06-05-align-prisma-config/change.md:1-12` is an archived earlier change with the same `change_id` and the same intent. It contains only a change stub and `prisma.config.ts` still has the custom loader, so the work appears to have been opened and archived without landing.
- `context/archive/2026-05-26-session-domain-model/plan-brief.md:12-67` records Prisma 7 foundations, `@@map("flow_state_<name>")`, generated client alias, Neon adapter, and the sanctioned migration hand-edit for the partial unique session index. This is migration context, not F-03 implementation scope.
- `context/archive/2026-06-17-data-mode-acl-hardening/plan-brief.md:20` records the architectural rule that `@prisma/generated` imports should be constrained to `server/db` and `persistence/prisma`; current `rg` shows that is true in `src/`.
- `context/foundation/infrastructure.md:110-114` documents Vercel + Neon provisioning, both database URLs, and the deployment rule that builds run `prisma generate` while migrations run separately.

## Related Research

- `context/foundation/tech-stack.md` - Current stack contract for Prisma 7 + Neon adapter.
- `context/foundation/test-plan.md` - Quality gate and generated-client testing guidance.
- `context/foundation/roadmap-references/items/F-03.md` - Slice outcome and verification.
- `context/archive/2026-06-05-align-prisma-config/change.md` - Prior archived stub for the same change.

## Open Questions

- Does `pnpm exec prisma generate` require `DATABASE_URL_UNPOOLED` once `env("DATABASE_URL_UNPOOLED")` is used in `prisma.config.ts`, even though generation should not connect to the DB? This must be verified before closing the plan because the CI quality job currently does not inject DB secrets.
- Should stale README Drizzle script descriptions be cleaned in F-03 or left for a docs hygiene follow-up? Recommended default: leave out of implementation unless the plan explicitly includes docs drift cleanup.
