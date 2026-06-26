# Align Prisma Config — Plan Brief

> Full plan: `context/changes/align-prisma-config/plan.md`
> Research: `context/changes/align-prisma-config/research.md`

## What & Why

F-03 aligns `prisma.config.ts` with Prisma 7 conventions: load `.env` with `dotenv/config`, use `env()` from `prisma/config`, keep relative schema/migration paths, and require `DATABASE_URL_UNPOOLED` for Prisma CLI datasource operations.

The value is clearer, stricter CLI behavior after the Prisma 7 migration. Runtime database access remains unchanged on pooled `DATABASE_URL` through `@prisma/adapter-neon`.

## Starting Point

Prisma schema, generated client output, TypeScript aliasing, app runtime DB setup, package scripts, and env validation are already aligned. The drift is concentrated in `prisma.config.ts`, which still has a hand-rolled `.env` loader and falls back from `DATABASE_URL_UNPOOLED` to `DATABASE_URL`.

## Desired End State

Prisma CLI config follows the official Prisma 7 style and fails clearly when the direct Neon CLI URL is missing. `pnpm exec prisma validate`, `pnpm db:generate`, `pnpm exec prisma migrate status`, `pnpm check`, `pnpm typecheck`, and `pnpm test` are the verification spine. No schema, migration, generated client, runtime DB, or package-script churn is expected.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Primary scope | `prisma.config.ts` only | Research shows all other Prisma surfaces are already aligned | Research |
| CLI datasource URL | `env("DATABASE_URL_UNPOOLED")` | Migrations and Prisma CLI operations need the direct Neon endpoint | Roadmap / Research |
| Runtime database URL | Preserve pooled `DATABASE_URL` in `src/server/db/index.ts` | Runtime is already correct through `@prisma/adapter-neon` | Research / Tech stack |
| Env loading | `import "dotenv/config"` before Prisma config env access | Matches Prisma 7 docs and removes custom parser risk | Prisma docs / Roadmap |
| Strict missing-env behavior | Keep it strict, no fallback | Clear failure is the hygiene improvement and prevents accidental pooled CLI use | Plan |
| CI workflow | Change only if generate proves it needs env in quality job | CI quality currently runs generate without DB env; generate-only checks should use a dummy URL instead of repository secrets | Research / Plan review |
| Tests | CLI + quality gates, no new tests | Generated Prisma client is a build contract per the test plan | Test plan |
| Docs drift | Leave README cleanup out of F-03 | Stale Drizzle wording is adjacent docs hygiene, not required config behavior | Research / Plan |

## Scope

**In scope:**

- Replace custom `prisma.config.ts` env loader with Prisma 7 config pattern.
- Require `DATABASE_URL_UNPOOLED` for Prisma CLI datasource URL.
- Verify Prisma config behavior with validate, generate, migrate status, check, typecheck, and tests.
- Add a CI quality generate dummy env binding only if verification proves it is required.

**Out of scope:**

- Prisma schema/model/migration changes.
- Runtime Prisma client or Neon adapter changes.
- Generated client output or alias changes.
- Package script churn.
- README docs cleanup.
- Playwright/browser verification for this config-only slice.

## Architecture / Approach

Keep the existing split: Prisma CLI reads `DATABASE_URL_UNPOOLED` from `prisma.config.ts`; application runtime reads pooled `DATABASE_URL` from `src/env.js` in `src/server/db/index.ts`. Implementation is config-first, then verification-first: only broaden to CI if strict config evaluation would break the existing quality job, and use a generate-only dummy URL there rather than real database secrets.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Prisma Config Alignment | Official Prisma 7 `prisma.config.ts` shape | Missing local `DATABASE_URL_UNPOOLED` breaks CLI commands |
| 2. Generate and CI Behavior Check | Confirms generate/typecheck/test behavior; optional CI env fix | CI quality job may lack datasource env after strict config |
| 3. Final Prisma CLI Smoke | Validates migration status and final quality gates | Accidentally using pooled runtime fallback or committing generated churn |

**Prerequisites:** Branch `features/align-prisma-config`; local `.env` with `DATABASE_URL_UNPOOLED` for CLI smoke; no pending intent to change schema/migrations.

**Estimated effort:** ~1 short implementation session across 3 narrow phases.

## Open Risks & Assumptions

- Assumes the project wants strict failure when `DATABASE_URL_UNPOOLED` is missing; this is explicitly aligned with F-03.
- Prisma generate may evaluate datasource env even though it does not connect to the DB; Phase 2 handles this without preemptive CI churn or secret-dependent quality checks.
- Local verification depends on valid Neon env vars already stored in `.env` / `.env.local`; do not paste secrets into docs or code.

## Success Criteria (Summary)

- `prisma.config.ts` uses `dotenv/config`, `env()` from `prisma/config`, relative paths, and `DATABASE_URL_UNPOOLED`.
- Runtime stays on pooled `DATABASE_URL`; no schema, migration, generated-client, package-script, or product runtime changes land.
- `pnpm exec prisma validate`, `pnpm db:generate`, `pnpm exec prisma migrate status`, `pnpm check`, `pnpm typecheck`, and `pnpm test` pass or expose the single planned CI env adjustment.
