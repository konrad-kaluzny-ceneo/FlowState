# Align Prisma Config Implementation Plan

## Overview

Align FlowState's Prisma CLI configuration with the official Prisma 7 `prisma.config.ts` pattern while preserving the existing runtime Neon adapter split. This is a foundation hygiene slice: make CLI behavior clearer and stricter without changing schema models, migrations, generated-client paths, package scripts, or product runtime database access unless verification proves a narrow CI adjustment is required.

## Current State Analysis

FlowState already runs Prisma 7 with `@prisma/adapter-neon`, a schema-only datasource in `prisma/schema.prisma`, generated client output under `generated/prisma`, and runtime database access through pooled `DATABASE_URL` in `src/server/db/index.ts`.

The remaining drift is isolated to `prisma.config.ts`: it manually parses `.env`, uses `path.join(import.meta.dirname, ...)` for the schema path, and falls back from `DATABASE_URL_UNPOOLED` to `DATABASE_URL` to an empty string. Prisma 7 docs and F-03 call for `import "dotenv/config"`, `env()` from `prisma/config`, relative config paths, and a direct unpooled Neon URL for CLI datasource operations.

### Key Discoveries

- `prisma.config.ts:1-43` is the primary target: custom env loader, absolute-ish schema path via `path.join`, and permissive datasource fallback.
- `prisma/schema.prisma:1-8` is already aligned with Prisma 7 config-file datasource URLs and `prisma-client` output to `../generated/prisma`; no schema or generator change is needed.
- `src/server/db/index.ts:1-21` already uses pooled `env.DATABASE_URL` through `PrismaNeon`; runtime behavior should stay unchanged.
- `src/env.js:9-29` and `.env.example` already require both `DATABASE_URL` and `DATABASE_URL_UNPOOLED`, so strict CLI-side use of the unpooled URL is consistent with the app env contract.
- `.github/workflows/ci.yml:40-47` runs `pnpm exec prisma generate` in the `quality` job without DB env, while `.github/workflows/ci.yml:59-68` gives the `e2e` job real DB URLs for migration/build smoke. If Prisma 7 `env("DATABASE_URL_UNPOOLED")` is evaluated during generate, the quality job should get a generate-only dummy Postgres URL, not repository secrets.
- Current Prisma docs for v7 show `import "dotenv/config"`, `{ defineConfig, env }` from `prisma/config`, relative `schema` / `migrations.path`, and `datasource.url: env("DATABASE_URL")`; for FlowState the variable is intentionally `DATABASE_URL_UNPOOLED`.

## Desired End State

`prisma.config.ts` matches the Prisma 7 config style:

- `import "dotenv/config"` executes before config env access.
- `defineConfig` and `env` are imported from `prisma/config`.
- `schema` is the relative string `"prisma/schema.prisma"`.
- `migrations.path` remains the relative string `"prisma/migrations"`.
- `datasource.url` is `env("DATABASE_URL_UNPOOLED")`, intentionally failing clearly when the direct Neon CLI URL is missing.

Runtime database access still uses pooled `DATABASE_URL` through `@prisma/adapter-neon`; generated client aliasing still resolves through `@prisma/generated`; no Prisma schema, migration SQL, model, or package-script behavior changes.

## What We're NOT Doing

- No edits to `prisma/schema.prisma` models, datasource provider, generator output, or migration files.
- No runtime Prisma client changes in `src/server/db/index.ts`.
- No env-schema changes in `src/env.js` unless verification proves the current required variables are wrong, which research does not indicate.
- No package-script renames or command churn.
- No generated Prisma client commits.
- No README/docs cleanup for stale Drizzle wording in this slice.
- No Playwright or product UI verification; this config-only change is covered by Prisma CLI, typecheck, lint, and unit/integration gates.

## Implementation Approach

Make the smallest config-only edit first, then verify Prisma CLI behavior before considering any CI workflow adjustment. Treat the strict `DATABASE_URL_UNPOOLED` requirement as the intended behavior for local and migration commands. If `pnpm exec prisma generate` requires the datasource env during config evaluation, update only the CI quality job's Prisma generate step to provide a generate-only dummy Postgres URL; do not use production or Neon secrets for non-DB generate checks, and do not alter runtime code or migration topology.

## Critical Implementation Details

**Strict env is intentional.** Replacing the fallback chain with `env("DATABASE_URL_UNPOOLED")` will break Prisma CLI commands when the unpooled URL is missing. That is the hygiene improvement: migrations, db push, and studio should use the direct Neon endpoint and fail clearly when it is absent.

**Import order is load-bearing.** `import "dotenv/config"` must appear before `env("DATABASE_URL_UNPOOLED")` is evaluated so local `.env` values are available to Prisma CLI commands.

**CI generate is the only conditional broadening.** Do not preemptively edit `.github/workflows/ci.yml`. First verify whether `prisma generate` evaluates the datasource env. If it does and the quality job would fail without DB env, add only a dummy `DATABASE_URL_UNPOOLED` to the `Generate Prisma client` step; leave e2e secrets, migrations, build, and scripts otherwise unchanged.

---

## Phase 1: Prisma Config Alignment

### Overview

Replace the custom env loader and permissive datasource fallback with the official Prisma 7 config pattern.

### Changes Required

#### 1. Prisma CLI configuration

**File**: `prisma.config.ts`

**Intent**: Make the Prisma CLI config match Prisma 7 conventions and the F-03 roadmap outcome, using `.env` through `dotenv/config` and `DATABASE_URL_UNPOOLED` through Prisma's `env()` helper.

**Contract**: Keep `defineConfig`; import `env` from `prisma/config`; remove `readFileSync`, `path`, `loadEnv()`, and `process.env` fallback logic; set `schema` to `"prisma/schema.prisma"`; preserve `migrations.path` as `"prisma/migrations"`; set `datasource.url` to `env("DATABASE_URL_UNPOOLED")`.

### Success Criteria

#### Automated Verification

- Prisma schema/config validates: `pnpm exec prisma validate`
- Prisma client generation succeeds with local env loading: `pnpm db:generate`
- Lint/format passes: `pnpm check`

#### Manual Verification

- Diff is limited to `prisma.config.ts` unless Phase 2 proves a CI env adjustment is required.
- Runtime client split is preserved: `src/server/db/index.ts` still uses pooled `DATABASE_URL`.

**Implementation Note**: Pause after Phase 1 if `pnpm db:generate` fails because `DATABASE_URL_UNPOOLED` is absent locally; fix local env rather than reintroducing fallback behavior.

---

## Phase 2: Generate and CI Behavior Check

### Overview

Verify that the stricter config works for local and CI-like generate paths. Apply a narrow CI env adjustment only if the generate command requires datasource env at config evaluation time.

### Changes Required

#### 1. CI quality generate env, only if proven necessary

**File**: `.github/workflows/ci.yml`

**Intent**: Keep the quality job's existing Prisma generate step working after `env("DATABASE_URL_UNPOOLED")` becomes strict, if local CI-like verification shows Prisma evaluates the datasource during generate.

**Contract**: If needed, add a generate-only dummy env binding such as `DATABASE_URL_UNPOOLED: postgresql://user:pass@localhost:5432/flowstate_generate` to the quality job's `Generate Prisma client` step only. Do not use repository secrets for this non-DB command, and do not change e2e job secrets, migration commands, build command, branch triggers, job names, package scripts, or runtime env validation.

### Success Criteria

#### Automated Verification

- Prisma generate succeeds after the config change: `pnpm db:generate`
- TypeScript still resolves `@prisma/generated`: `pnpm typecheck`
- Required local quality gate passes: `pnpm check`
- Required unit/integration gate passes: `pnpm test`

#### Manual Verification

- Confirm whether `.github/workflows/ci.yml` changed. If it did, the only change is a generate-only dummy `DATABASE_URL_UNPOOLED` on the quality job's Prisma generate step.
- Confirm no generated files under `generated/prisma` were committed.

**Implementation Note**: If CI env injection is needed, keep it in this phase so reviewers can separate the config edit from CI compatibility.

---

## Phase 3: Final Prisma CLI Smoke

### Overview

Run the highest-signal Prisma CLI checks for the actual foundation outcome: config loading, generated client creation, and direct database CLI access through the unpooled URL.

### Changes Required

No additional file changes expected. This phase is verification-only unless a Prisma CLI command exposes a config regression.

### Success Criteria

#### Automated Verification

- Prisma migration status can read config and migrations: `pnpm exec prisma migrate status`
- Full required local quality gate passes: `pnpm check`
- Full required unit/integration gate passes: `pnpm test`

#### Manual Verification

- `pnpm exec prisma migrate status` reports against the intended Neon database URL source, not a pooled runtime fallback.
- `git diff` shows no schema, migration, generated-client, runtime DB, or package-script churn.

**Implementation Note**: Do not run `pnpm prisma migrate dev`, `pnpm db:push`, or any write-capable Prisma command unless the implementer intentionally needs a local DB write check. F-03 is config hygiene, not schema migration work.

---

## Testing Strategy

### Unit Tests

No new unit tests are expected. The test plan explicitly treats generated Prisma client behavior as a generator/build contract rather than a unit-test target.

### Integration Tests

No new integration tests are expected. Existing `pnpm test` should pass to prove the generated client alias and persistence-layer imports still compile and execute.

### Manual Testing Steps

1. Inspect `prisma.config.ts` diff for the official Prisma 7 pattern and no fallback to `DATABASE_URL`.
2. Run `pnpm exec prisma validate`.
3. Run `pnpm db:generate`.
4. Run `pnpm exec prisma migrate status` with `DATABASE_URL_UNPOOLED` available.
5. Confirm no generated client files are staged.

## Performance Considerations

None. The change affects Prisma CLI config evaluation only. App runtime uses the same pooled Neon adapter path as before.

## Migration Notes

No database migration is part of this plan. Existing migrations and `migration_lock.toml` remain unchanged.

## References

- Roadmap slice: `context/foundation/roadmap-references/items/F-03.md`
- Change brief: `context/changes/align-prisma-config/change.md`
- Research: `context/changes/align-prisma-config/research.md`
- Tech stack: `context/foundation/tech-stack.md`
- Test plan negative space for generated Prisma client: `context/foundation/test-plan.md`
- Prisma docs: Context7 `/prisma/prisma/7.6.0` examples for `prisma.config.ts`, `dotenv/config`, and `env()`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Prisma Config Alignment

#### Automated

- [x] 1.1 `pnpm exec prisma validate` passes
- [x] 1.2 `pnpm db:generate` passes
- [x] 1.3 `pnpm check` passes

#### Manual

- [x] 1.4 Diff is limited to `prisma.config.ts` unless Phase 2 proves CI env is required
- [x] 1.5 Runtime client split remains pooled `DATABASE_URL` in `src/server/db/index.ts`

### Phase 2: Generate and CI Behavior Check

#### Automated

- [ ] 2.1 `pnpm db:generate` passes after strict config change
- [ ] 2.2 `pnpm typecheck` passes
- [ ] 2.3 `pnpm check` passes
- [ ] 2.4 `pnpm test` passes

#### Manual

- [ ] 2.5 CI workflow is unchanged, or only the quality Prisma generate step receives a generate-only dummy `DATABASE_URL_UNPOOLED`
- [ ] 2.6 No files under `generated/prisma` are committed

### Phase 3: Final Prisma CLI Smoke

#### Automated

- [ ] 3.1 `pnpm exec prisma migrate status` passes
- [ ] 3.2 Final `pnpm check` passes
- [ ] 3.3 Final `pnpm test` passes

#### Manual

- [ ] 3.4 Migration status uses `DATABASE_URL_UNPOOLED` with no pooled runtime fallback
- [ ] 3.5 Final diff has no schema, migration, generated-client, runtime DB, or package-script churn
