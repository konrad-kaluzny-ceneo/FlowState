# Design Document: Vercel + Neon Deployment

## Overview

This design covers the migration of FlowState's persistence layer from SQLite (`@libsql/client`) to Neon Postgres (`@neondatabase/serverless`) and the deployment of the Next.js application to Vercel with CI/CD via GitHub integration.

The migration touches four core layers:
1. **Schema layer** — Drizzle ORM table definitions swap from SQLite dialect to PostgreSQL dialect
2. **Driver layer** — Database client swaps from `@libsql/client` to `@neondatabase/serverless` with the `drizzle-orm/neon-http` adapter
3. **Configuration layer** — Environment variables, Drizzle Kit config, and `.env.example` updated for Neon connection strings
4. **Infrastructure layer** — Vercel project creation, Neon provisioning via Vercel Marketplace, and CI/CD pipeline configuration

### Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Neon connection mode | HTTP (serverless) via `@neondatabase/serverless` | Avoids connection pool exhaustion in Vercel serverless functions; no persistent TCP connections needed |
| Drizzle adapter | `drizzle-orm/neon-http` | Purpose-built for Neon's HTTP transport; pairs with `@neondatabase/serverless` |
| Migration execution | `vercel build` script hook | Runs migrations before the app starts serving; uses `DATABASE_URL_UNPOOLED` for direct TCP |
| Pooled vs unpooled | `DATABASE_URL` (pooled) for runtime, `DATABASE_URL_UNPOOLED` (direct) for migrations | Pooled endpoint handles serverless concurrency; direct endpoint supports long-running DDL transactions |
| Table prefix preservation | `.bootstrap-scaffold_` prefix retained via `pgTableCreator` | Maintains multi-project schema isolation pattern from the original scaffold |

## Architecture

```mermaid
graph TD
    subgraph "Vercel Platform"
        A[Next.js App - Serverless Functions]
        B[Build Step]
    end

    subgraph "GitHub"
        C[main branch] -->|merge triggers| B
        D[feature branches] -->|push triggers| E[Preview Deploy]
    end

    subgraph "Neon Postgres"
        F[Pooled Endpoint - HTTP]
        G[Direct Endpoint - TCP]
    end

    B -->|pnpm db:migrate| G
    A -->|runtime queries via drizzle-orm/neon-http| F
    E -->|runtime queries| F

    subgraph "Environment Variables"
        H[DATABASE_URL - pooled]
        I[DATABASE_URL_UNPOOLED - direct]
    end

    H --> F
    I --> G
```

### Deployment Flow

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant GH as GitHub
    participant V as Vercel
    participant N as Neon Postgres

    Dev->>GH: Push/merge to main
    GH->>V: Webhook triggers build
    V->>V: pnpm install
    V->>V: drizzle-kit migrate (via DATABASE_URL_UNPOOLED)
    V->>N: Apply pending DDL migrations
    N-->>V: Migration success
    V->>V: next build
    V->>V: Deploy serverless functions
    V-->>Dev: Production URL live
    
    Note over V,N: Runtime requests use DATABASE_URL (pooled HTTP)
```

## Components and Interfaces

### 1. Schema Module (`src/server/db/schema.ts`)

**Before:** Uses `sqliteTableCreator` from `drizzle-orm/sqlite-core`  
**After:** Uses `pgTableCreator` from `drizzle-orm/pg-core`

```typescript
// Target state
import { sql } from "drizzle-orm";
import { index, pgTableCreator, serial, timestamp, varchar } from "drizzle-orm/pg-core";

export const createTable = pgTableCreator(
  (name) => `.bootstrap-scaffold_${name}`,
);

export const posts = createTable(
  "post",
  (d) => ({
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 256 }),
    createdAt: timestamp("createdAt", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [index("name_idx").on(t.name)],
);
```

**Column type mapping:**

| SQLite | PostgreSQL |
|--------|-----------|
| `integer({ mode: "number" }).primaryKey({ autoIncrement: true })` | `serial("id").primaryKey()` |
| `text({ length: 256 })` | `varchar("name", { length: 256 })` |
| `integer({ mode: "timestamp" })` | `timestamp("col", { withTimezone: true })` |
| `sql\`(unixepoch())\`` | `sql\`CURRENT_TIMESTAMP\`` |

### 2. Database Client Module (`src/server/db/index.ts`)

**Before:** Uses `@libsql/client` with `drizzle-orm/libsql`  
**After:** Uses `@neondatabase/serverless` with `drizzle-orm/neon-http`

```typescript
// Target state
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import { env } from "~/env";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  client: ReturnType<typeof neon> | undefined;
};

export const client = globalForDb.client ?? neon(env.DATABASE_URL);
if (env.NODE_ENV !== "production") globalForDb.client = client;

export const db = drizzle(client, { schema });
```

### 3. Environment Schema (`src/env.js`)

**Changes:**
- `DATABASE_URL` validation: `z.string().url()` → custom refinement checking `postgresql://` or `postgres://` prefix
- Add `DATABASE_URL_UNPOOLED` with same validation
- Add both to `runtimeEnv` mapping

```javascript
// Target state (server section)
server: {
  DATABASE_URL: z.string().refine(
    (val) => val.startsWith("postgresql://") || val.startsWith("postgres://"),
    { message: "DATABASE_URL must be a postgresql:// or postgres:// connection string" }
  ),
  DATABASE_URL_UNPOOLED: z.string().refine(
    (val) => val.startsWith("postgresql://") || val.startsWith("postgres://"),
    { message: "DATABASE_URL_UNPOOLED must be a postgresql:// or postgres:// connection string" }
  ),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
},
```

### 4. Drizzle Configuration (`drizzle.config.ts`)

**Changes:**
- `dialect: "sqlite"` → `dialect: "postgresql"`
- `dbCredentials.url` → uses `DATABASE_URL` (unchanged variable name, new value format)

```typescript
// Target state
import type { Config } from "drizzle-kit";
import { env } from "~/env";

export default {
  schema: "./src/server/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: env.DATABASE_URL,
  },
  tablesFilter: [".bootstrap-scaffold_*"],
} satisfies Config;
```

### 5. Build Script with Migration Hook

The `package.json` `build` script is updated to run migrations before the Next.js build:

```json
{
  "scripts": {
    "build": "drizzle-kit migrate && next build",
    "db:migrate:prod": "drizzle-kit migrate"
  }
}
```

The migration uses `DATABASE_URL_UNPOOLED` (direct TCP connection) which Drizzle Kit reads from the env schema. The `drizzle.config.ts` will be updated to use `DATABASE_URL_UNPOOLED` for migrations:

```typescript
// drizzle.config.ts - uses unpooled for migration DDL
export default {
  schema: "./src/server/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: env.DATABASE_URL_UNPOOLED,
  },
  tablesFilter: [".bootstrap-scaffold_*"],
} satisfies Config;
```

### 6. Vitest Configuration Update

The `vitest.config.ts` test environment variable for `DATABASE_URL` must be updated to a valid PostgreSQL-format string:

```typescript
env: {
  SKIP_ENV_VALIDATION: "1",
  DATABASE_URL: "postgresql://test:test@localhost:5432/test",
  DATABASE_URL_UNPOOLED: "postgresql://test:test@localhost:5432/test",
  NODE_ENV: "test",
},
```

## Data Models

### Posts Table (PostgreSQL)

| Column | Type | Constraints | Default |
|--------|------|-------------|---------|
| `id` | `serial` | PRIMARY KEY | auto-increment |
| `name` | `varchar(256)` | nullable | — |
| `createdAt` | `timestamp with time zone` | NOT NULL | `CURRENT_TIMESTAMP` |
| `updatedAt` | `timestamp with time zone` | nullable | set on update |

**Indexes:**
- `name_idx` on `name` column

**Table name:** `.bootstrap-scaffold_post` (via `pgTableCreator` prefix)

### Generated Migration SQL (target)

```sql
CREATE TABLE ".bootstrap-scaffold_post" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" varchar(256),
  "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" timestamp with time zone
);

CREATE INDEX "name_idx" ON ".bootstrap-scaffold_post" ("name");
```

### Environment Variables

| Variable | Scope | Format | Purpose |
|----------|-------|--------|---------|
| `DATABASE_URL` | Production, Preview, Development | `postgresql://user:pass@host/db?sslmode=require` | Pooled HTTP endpoint for runtime queries |
| `DATABASE_URL_UNPOOLED` | Production, Preview, Development | `postgresql://user:pass@host/db?sslmode=require` | Direct TCP endpoint for migrations |
| `NODE_ENV` | All | `production` / `development` / `test` | Runtime mode |

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Table name prefix preservation

*For any* valid table name string, passing it through the `createTable` naming function SHALL produce a string that starts with `.bootstrap-scaffold_` followed by the original table name, with no other modifications.

**Validates: Requirements 1.2**

### Property 2: Connection string validation accepts only PostgreSQL URIs

*For any* string value, the Neon connection string validator (used for both `DATABASE_URL` and `DATABASE_URL_UNPOOLED`) SHALL accept the value if and only if it starts with `postgresql://` or `postgres://` and contains at minimum a host segment after the protocol prefix. All other strings SHALL be rejected with a descriptive error message.

**Validates: Requirements 4.1, 4.2**

## Error Handling

### Environment Validation Errors

| Scenario | Behavior | User-Facing Message |
|----------|----------|---------------------|
| `DATABASE_URL` missing at build time | Build fails with non-zero exit | `❌ Invalid environment variables: DATABASE_URL — Required` |
| `DATABASE_URL` has wrong prefix | Build fails with non-zero exit | `❌ Invalid environment variables: DATABASE_URL — DATABASE_URL must be a postgresql:// or postgres:// connection string` |
| `DATABASE_URL_UNPOOLED` missing at build time | Build fails with non-zero exit | `❌ Invalid environment variables: DATABASE_URL_UNPOOLED — Required` |
| `DATABASE_URL_UNPOOLED` has wrong prefix | Build fails with non-zero exit | Same pattern as DATABASE_URL |

### Migration Errors

| Scenario | Behavior |
|----------|----------|
| Migration SQL fails (syntax error, constraint violation) | `drizzle-kit migrate` exits non-zero → `next build` never runs → Vercel marks deploy as failed → previous production version remains active |
| `DATABASE_URL_UNPOOLED` unreachable | Connection timeout → non-zero exit → deploy aborted |
| No pending migrations | `drizzle-kit migrate` exits 0 immediately → build proceeds |

### Runtime Database Errors

| Scenario | Behavior |
|----------|----------|
| Neon endpoint unreachable | tRPC procedure returns error response; Vercel function does not hang (HTTP transport has built-in timeout) |
| Query timeout (>10s) | Vercel terminates the serverless function; client receives 504 Gateway Timeout |
| Cold start after idle (>5min) | Neon serverless wakes within ~500ms; first query may be slower but completes within function timeout |

### Deployment Rollback

Vercel's deployment model is immutable: each deploy creates a new deployment artifact. If a build fails, the previous successful deployment remains active. There is no automatic database rollback — DDL statements that were applied before the failure remain committed. This is acceptable for the current schema complexity (single table) but should be revisited if migrations become multi-step.

## Testing Strategy

### Unit Tests (Vitest)

Unit tests verify specific examples and edge cases:

| Test | What it verifies |
|------|-----------------|
| `createTable` prefix | The naming function produces correct prefixed names |
| Env validation — valid URLs | `postgresql://user:pass@host/db` passes validation |
| Env validation — invalid URLs | `file:./db.sqlite`, empty string, `http://` are rejected |
| Env validation — missing vars | Missing `DATABASE_URL` or `DATABASE_URL_UNPOOLED` throws |
| Schema column types | Posts table has correct PostgreSQL column types |

### Property-Based Tests (Vitest + fast-check)

Property-based tests verify universal properties across generated inputs:

- **Library:** `fast-check` (most popular PBT library for TypeScript/Vitest)
- **Minimum iterations:** 100 per property
- **Tag format:** `Feature: vercel-neon-deployment, Property {number}: {property_text}`

| Property | Generator | Assertion |
|----------|-----------|-----------|
| Property 1: Table name prefix | `fc.string()` filtered to valid SQL identifiers | Output starts with `.bootstrap-scaffold_` + input |
| Property 2: Connection string validation | `fc.oneof(fc.constant("postgresql://"), fc.constant("postgres://")).chain(prefix => fc.string().map(s => prefix + "user:pass@host/" + s))` for valid; `fc.string()` for invalid | Valid strings pass, invalid strings (no pg prefix) fail |

### Integration Tests (Manual / CI)

These require a live Neon database and Vercel deployment:

| Test | What it verifies |
|------|-----------------|
| `pnpm db:generate` | Produces PostgreSQL-dialect SQL files |
| `pnpm db:migrate` | Applies migrations to Neon, tables exist |
| Production HTTP 200 | Root path responds within 5s |
| tRPC endpoint | Database query returns valid response |
| Cold start latency | First request after idle completes within timeout |

### Smoke Tests (Post-Deploy)

| Check | Method |
|-------|--------|
| No `@libsql/client` imports | `grep -r "@libsql/client" src/` returns empty |
| No `db.sqlite` in repo | File does not exist |
| `package.json` dependencies correct | `@neondatabase/serverless` present, `@libsql/client` absent |
| Drizzle config dialect | `dialect: "postgresql"` in `drizzle.config.ts` |
| `.gitignore` entries | `*.sqlite` and `*.sqlite-journal` present |

### Test Environment Configuration

The `vitest.config.ts` uses `SKIP_ENV_VALIDATION: "1"` to bypass the Zod env schema during tests. For property tests that exercise the validation logic directly, the validation function is imported and tested in isolation (not through the `createEnv` wrapper).

