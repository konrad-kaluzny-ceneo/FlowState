# Implementation Plan: Vercel + Neon Deployment

## Overview

This plan migrates FlowState from SQLite to Neon Postgres and prepares the codebase for Vercel deployment. The implementation proceeds in layers: dependencies first, then schema and driver swap, environment configuration, build pipeline, cleanup, and finally testing. Each task builds incrementally so the project remains buildable after each step.

## Tasks

- [ ] 1. Install dependencies and remove SQLite packages
  - [ ] 1.1 Add Neon and fast-check dependencies, remove libsql
    - Run `pnpm add @neondatabase/serverless` to add the Neon serverless driver
    - Run `pnpm remove @libsql/client` to remove the SQLite driver
    - Run `pnpm add -D fast-check` to add the property-based testing library
    - Verify `package.json` lists `@neondatabase/serverless` in dependencies and does not list `@libsql/client`
    - _Requirements: 2.5, 9.1_

- [ ] 2. Migrate schema from SQLite to PostgreSQL dialect
  - [ ] 2.1 Convert schema module to use pgTableCreator and PostgreSQL column types
    - Replace `import { index, sqliteTableCreator } from "drizzle-orm/sqlite-core"` with `import { index, pgTableCreator, serial, timestamp, varchar } from "drizzle-orm/pg-core"`
    - Replace `sqliteTableCreator` with `pgTableCreator` in the `createTable` helper, preserving the `.bootstrap-scaffold_` prefix
    - Convert `id` column from `d.integer({ mode: "number" }).primaryKey({ autoIncrement: true })` to `serial("id").primaryKey()`
    - Convert `name` column from `d.text({ length: 256 })` to `varchar("name", { length: 256 })`
    - Convert `createdAt` column from `d.integer({ mode: "timestamp" })` to `timestamp("createdAt", { withTimezone: true })` with default `sql\`CURRENT_TIMESTAMP\``
    - Convert `updatedAt` column from `d.integer({ mode: "timestamp" })` to `timestamp("updatedAt", { withTimezone: true }).$onUpdate(() => new Date())`
    - Preserve the `index("name_idx").on(t.name)` index definition
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.7, 1.8, 9.7_

  - [ ] 2.2 Write property test for table name prefix preservation
    - **Property 1: Table name prefix preservation**
    - Import `pgTableCreator` and create a test instance with the `.bootstrap-scaffold_` prefix function
    - Use `fc.string()` filtered to valid SQL identifier characters to generate table names
    - Assert that for any valid table name, the output starts with `.bootstrap-scaffold_` followed by the original name
    - **Validates: Requirements 1.2**

- [ ] 3. Replace database driver with Neon serverless
  - [ ] 3.1 Rewrite database client module to use Neon HTTP adapter
    - Replace `import { type Client, createClient } from "@libsql/client"` with `import { neon } from "@neondatabase/serverless"`
    - Replace `import { drizzle } from "drizzle-orm/libsql"` with `import { drizzle } from "drizzle-orm/neon-http"`
    - Update `globalForDb` type to `{ client: ReturnType<typeof neon> | undefined }`
    - Replace `createClient({ url: env.DATABASE_URL })` with `neon(env.DATABASE_URL)`
    - Keep the HMR caching pattern (`globalForDb.client` assignment when not production)
    - Keep `export const db = drizzle(client, { schema })`
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [ ] 4. Update environment variable schema and configuration
  - [ ] 4.1 Update env schema to validate PostgreSQL connection strings
    - In `src/env.js`, replace `DATABASE_URL: z.string().url()` with a `z.string().refine()` that checks the value starts with `postgresql://` or `postgres://`
    - Add `DATABASE_URL_UNPOOLED` with the same refine validation in the `server` section
    - Add `DATABASE_URL_UNPOOLED: process.env.DATABASE_URL_UNPOOLED` to the `runtimeEnv` mapping
    - Provide descriptive error messages indicating a `postgresql://` or `postgres://` connection string is expected
    - _Requirements: 4.1, 4.2, 4.3, 4.5, 7.5, 7.6_

  - [ ] 4.2 Update Drizzle config to use PostgreSQL dialect and unpooled URL
    - Change `dialect: "sqlite"` to `dialect: "postgresql"` in `drizzle.config.ts`
    - Change `dbCredentials.url` from `env.DATABASE_URL` to `env.DATABASE_URL_UNPOOLED`
    - Keep `schema` path and `tablesFilter` unchanged
    - _Requirements: 3.1, 3.2, 3.3, 9.5_

  - [ ] 4.3 Update .env.example with Neon placeholder values
    - Replace the existing `DATABASE_URL` placeholder with `postgresql://user:password@host:5432/dbname`
    - Add `DATABASE_URL_UNPOOLED=postgresql://user:password@host:5432/dbname`
    - _Requirements: 4.4_

  - [ ] 4.4 Write property test for connection string validation
    - **Property 2: Connection string validation accepts only PostgreSQL URIs**
    - Use `fc.oneof(fc.constant("postgresql://"), fc.constant("postgres://"))` chained with `fc.string()` to generate valid prefixed strings
    - Use `fc.string()` filtered to exclude strings starting with `postgresql://` or `postgres://` for invalid cases
    - Assert valid strings pass the refine check and invalid strings are rejected
    - **Validates: Requirements 4.1, 4.2**

- [ ] 5. Checkpoint - Ensure build and type checks pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Update build pipeline and test configuration
  - [ ] 6.1 Update build script to run migrations before next build
    - In `package.json`, change `"build": "next build"` to `"build": "drizzle-kit migrate && next build"`
    - Add `"db:migrate:prod": "drizzle-kit migrate"` script for standalone migration execution
    - _Requirements: 8.1, 8.2, 8.3_

  - [ ] 6.2 Update Vitest config with PostgreSQL-format test env vars
    - Change `DATABASE_URL: "file::memory:"` to `DATABASE_URL: "postgresql://test:test@localhost:5432/test"`
    - Add `DATABASE_URL_UNPOOLED: "postgresql://test:test@localhost:5432/test"` to the test env block
    - _Requirements: 4.1, 4.2_

- [ ] 7. Remove SQLite artifacts and update gitignore
  - [ ] 7.1 Remove SQLite database file and update .gitignore
    - Delete `db.sqlite` from the repository root
    - Add `*.sqlite` and `*.sqlite-journal` entries to `.gitignore` if not already present
    - Remove old SQLite migration files from the `drizzle/` directory
    - _Requirements: 9.2, 9.3, 9.4, 9.6_

- [ ] 8. Generate initial PostgreSQL migration
  - [ ] 8.1 Generate Drizzle migration for the PostgreSQL schema
    - Run `pnpm db:generate` to produce the initial PostgreSQL migration SQL
    - Verify the generated SQL uses PostgreSQL syntax (`serial`, `timestamp with time zone`, `varchar`)
    - Verify the generated table name is `.bootstrap-scaffold_post`
    - _Requirements: 3.4, 9.6_

- [ ] 9. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- Requirements 5, 6, 7, and 10 cover Vercel platform setup, Neon provisioning, and end-to-end validation — these are infrastructure tasks performed via the Vercel dashboard/CLI and are not coding tasks
- The `drizzle-kit migrate` command in the build script uses `DATABASE_URL_UNPOOLED` (direct TCP) as configured in `drizzle.config.ts`

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "4.1"] },
    { "id": 2, "tasks": ["2.2", "3.1", "4.2", "4.3"] },
    { "id": 3, "tasks": ["4.4", "6.1", "6.2"] },
    { "id": 4, "tasks": ["7.1"] },
    { "id": 5, "tasks": ["8.1"] }
  ]
}
```
