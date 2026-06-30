# Align README With Implementation Implementation Plan

## Overview

Update `README.md` so the public onboarding documentation reflects FlowState's current implementation: Next.js 16, Prisma 7 with the Neon adapter, current Prisma scripts, required DB/Auth environment variables, and the real source layout. This is a narrow documentation hygiene change; no application code, schema, or runtime behavior changes are part of the work.

## Current State Analysis

The README is broadly useful but stale in several implementation-facing sections. It still describes the ORM as Drizzle and the framework as Next.js 15, while the codebase has already moved to Next.js 16 and Prisma 7. It also describes some `db:*` scripts with Drizzle-era wording and omits required Neon Auth environment variables from setup guidance.

### Key Discoveries:

- `README.md:17-25` says `Next.js 15`, `Drizzle`, and `Vitest + Testing Library`; `package.json:44-52` and `context/foundation/tech-stack.md:37-50` confirm Prisma 7, Next.js 16, and a broader test stack.
- `README.md:50-55` documents only `DATABASE_URL` and `DATABASE_URL_UNPOOLED`; `.env.example:12-21` and `src/env.js:9-38` show Neon Auth variables are also required by runtime env validation, while `CURSOR_API_KEY` is optional for review scripts.
- `README.md:75-85` describes `pnpm build`, `pnpm db:generate`, and `pnpm db:studio` inaccurately versus `package.json:6-24`.
- `README.md:108-118` calls `src/server/db/` a Drizzle schema/client location; `src/server/db/index.ts:1-21`, `prisma/schema.prisma:1-8`, and `prisma.config.ts:4-12` confirm the schema lives under `prisma/` and runtime DB access uses Prisma with `@prisma/adapter-neon`.
- `context/foundation/tech-stack.md:52-76` is the canonical source for the Prisma migration and key files; the README should align to that source rather than introducing a second stack narrative.

## Desired End State

`README.md` accurately describes the implemented stack and setup path. A new contributor can read the README and understand that FlowState uses Next.js 16, Prisma 7, Neon Serverless Postgres, Neon Auth, and pnpm scripts that wrap Prisma CLI commands.

Verification is straightforward: the edited README matches `package.json`, `.env.example`, `src/env.js`, `src/server/db/index.ts`, `prisma/schema.prisma`, `prisma.config.ts`, and `context/foundation/tech-stack.md`; `pnpm check` passes after the documentation edit.

## What We're NOT Doing

- No application code changes.
- No Prisma schema, migration, generated client, or database config changes.
- No package script renames or behavior changes.
- No README rewrite, visual polish pass, or product copy overhaul.
- No exhaustive script inventory; the README should list the core commands useful for setup and day-to-day development.
- No runtime or browser verification; this is a documentation-only slice.

## Implementation Approach

Make a surgical README correction in the sections already identified as stale: Tech Stack, Getting Started env setup, Scripts, and Project Structure. Keep the README concise and beginner-friendly, using `context/foundation/tech-stack.md` as the stack source of truth and `package.json` / `.env.example` as command and env sources of truth.

---

## Phase 1: README Factual Alignment

### Overview

Correct stale README content while keeping the current document structure and tone intact.

### Changes Required:

#### 1. Stack table

**File**: `README.md`

**Intent**: Replace stale stack facts so the README no longer claims the project uses Next.js 15 or Drizzle.

**Contract**: Update the Tech Stack table to reflect Next.js 16, Prisma 7 with `@prisma/adapter-neon`, Neon Serverless Postgres, Neon Auth, and the current testing/tooling summary. Keep the table compact; do not turn it into the full `context/foundation/tech-stack.md`.

#### 2. Environment setup

**File**: `README.md`

**Intent**: Make first-run setup accurate for the app's required runtime env validation.

**Contract**: Keep the `cp .env.example .env` workflow, but mention required database variables and Neon Auth variables. Identify `CURSOR_API_KEY` as optional and scoped to `scripts/cursor-review`, matching `.env.example`.

#### 3. Scripts table

**File**: `README.md`

**Intent**: Correct command descriptions that still use Drizzle-era language and make the day-to-day command list match `package.json`.

**Contract**: Update core script descriptions for `pnpm dev`, `pnpm build`, `pnpm db:generate`, `pnpm db:migrate`, and `pnpm db:studio`. Add only high-signal core commands if needed (`test:e2e:belt`, `test:mutate`, or `db:migrate:prod`), without listing every maintainer script.

#### 4. Project structure

**File**: `README.md`

**Intent**: Fix the misleading DB/schema location and acknowledge the main directories a contributor will actually encounter.

**Contract**: Replace the Drizzle description under `src/server/db/` with Prisma client wording, note `prisma/` as the schema/migrations location, and include the main implemented areas (`src/lib/`, `src/hooks/`, `src/workers/`, `src/i18n/`) only if the structure block stays readable.

### Success Criteria:

#### Automated Verification:

- Lint/format check passes: `pnpm check`

#### Manual Verification:

- README stack table matches `context/foundation/tech-stack.md` and `package.json`.
- README env setup matches `.env.example` and `src/env.js` without exposing secrets.
- README script descriptions match `package.json` for the documented core commands.
- README project structure no longer references Drizzle and correctly points schema/migrations to `prisma/`.

**Implementation Note**: After completing this phase and automated verification passes, pause for manual confirmation that the README reads clearly and the scope stayed limited to factual drift.

---

## Phase 2: Source-of-Truth Verification and Handoff

### Overview

Perform the final doc consistency pass and prepare the change for implementation review.

### Changes Required:

#### 1. Documentation consistency check

**File**: `README.md`

**Intent**: Catch any remaining contradictions between README and the source-of-truth files before the change is presented.

**Contract**: Compare the final README against `package.json`, `.env.example`, `src/env.js`, `src/server/db/index.ts`, `prisma/schema.prisma`, `prisma.config.ts`, and `context/foundation/tech-stack.md`. Adjust only README wording if drift remains.

### Success Criteria:

#### Automated Verification:

- Final lint/format check passes: `pnpm check`

#### Manual Verification:

- Final diff is limited to `README.md` plus change artifacts under `context/changes/fix-readme/`.
- No generated files, schema files, package scripts, or runtime source files are changed.
- The README remains concise and does not duplicate the full foundation tech-stack document.

**Implementation Note**: This phase is verification-only unless the source comparison exposes a missed README correction.

---

## Testing Strategy

### Unit Tests:

- No new unit tests are expected; no runtime logic changes are part of this plan.

### Integration Tests:

- No integration tests are expected; the only automated gate is `pnpm check` for markdown formatting/lint coverage.

### Manual Testing Steps:

1. Read the edited Tech Stack table next to `context/foundation/tech-stack.md` and `package.json`.
2. Read the edited env setup next to `.env.example` and `src/env.js`.
3. Read the edited Scripts table next to `package.json`.
4. Read the edited Project Structure block next to `src/server/db/index.ts`, `prisma/schema.prisma`, and `prisma.config.ts`.
5. Confirm no stale `Drizzle` or `Next.js 15` wording remains in `README.md`.

## Performance Considerations

None. This is a documentation-only change.

## Migration Notes

No data migration, Prisma migration, or deployment migration is part of this plan.

## References

- Change brief: `context/changes/fix-readme/change.md`
- Current README: `README.md`
- Script and package source: `package.json`
- Env source: `.env.example`, `src/env.js`
- Prisma source: `prisma/schema.prisma`, `prisma.config.ts`, `src/server/db/index.ts`
- Stack source of truth: `context/foundation/tech-stack.md`
- Similar plan convention: `context/archive/2026-06-26-align-prisma-config/plan.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: README Factual Alignment

#### Automated

- [x] 1.1 `pnpm check` passes

#### Manual

- [ ] 1.2 README stack table matches `context/foundation/tech-stack.md` and `package.json`
- [ ] 1.3 README env setup matches `.env.example` and `src/env.js` without exposing secrets
- [ ] 1.4 README script descriptions match `package.json` for documented core commands
- [ ] 1.5 README project structure no longer references Drizzle and correctly points schema/migrations to `prisma/`

### Phase 2: Source-of-Truth Verification and Handoff

#### Automated

- [ ] 2.1 Final `pnpm check` passes

#### Manual

- [ ] 2.2 Final diff is limited to `README.md` plus change artifacts under `context/changes/fix-readme/`
- [ ] 2.3 No generated files, schema files, package scripts, or runtime source files are changed
- [ ] 2.4 README remains concise and does not duplicate the full foundation tech-stack document
