# Requirements Document

## Introduction

This specification covers the deployment infrastructure for FlowState: migrating the persistence layer from SQLite (via `@libsql/client`) to Neon Postgres (via `@neondatabase/serverless`), deploying the application to Vercel, and configuring the CI/CD pipeline for automated production deploys on merge to `main`. The scope includes schema migration (Drizzle ORM dialect swap), environment variable management, Vercel project setup, and Neon database provisioning via the Vercel Marketplace integration.

## Glossary

- **Vercel_Platform**: The Vercel hosting platform (Hobby tier) used to deploy and serve the Next.js application
- **Neon_Database**: The Neon Postgres serverless database instance provisioned via Vercel Marketplace in the `eu-central-1` (Frankfurt) region
- **Drizzle_ORM**: The TypeScript ORM used for schema definition, query building, and migration generation
- **Schema_Module**: The file `src/server/db/schema.ts` containing Drizzle table definitions and the `createTable` helper
- **DB_Client_Module**: The file `src/server/db/index.ts` that instantiates the database connection
- **Env_Schema**: The Zod-validated environment variable declarations in `src/env.js`
- **Migration_Pipeline**: The sequence of `drizzle-kit generate` followed by `drizzle-kit migrate` that applies schema changes to the database
- **GitHub_Integration**: The Vercel-GitHub connection that triggers automatic deployments on push/merge events
- **Preview_Deploy**: An automatic Vercel deployment created for every non-production branch push, accessible via a unique URL
- **Connection_String**: The `DATABASE_URL` environment variable containing the Neon Postgres connection URI (pooled endpoint)

## Requirements

### Requirement 1: Migrate Drizzle Schema from SQLite to PostgreSQL

**User Story:** As a developer, I want to convert the Drizzle ORM schema from SQLite dialect to PostgreSQL dialect, so that the application can use Neon Postgres as its persistence layer.

#### Acceptance Criteria

1. WHEN the schema migration is applied, THE Schema_Module SHALL use `pgTableCreator` from `drizzle-orm/pg-core` instead of `sqliteTableCreator` from `drizzle-orm/sqlite-core`
2. THE Schema_Module SHALL preserve the existing `createTable` helper function that accepts a table name and returns it prefixed with `.bootstrap-scaffold_`, maintaining the same function signature and prefix string
3. WHEN column types are converted, THE Schema_Module SHALL map SQLite `integer({ mode: "timestamp" })` columns to PostgreSQL `timestamp with time zone` columns
4. WHEN column types are converted, THE Schema_Module SHALL map SQLite `integer({ mode: "number" })` primary key columns with `autoIncrement` to PostgreSQL `serial` primary key columns
5. WHEN column types are converted, THE Schema_Module SHALL map SQLite `text` columns that specify an explicit `length` option to PostgreSQL `varchar` columns with the same maximum length value
6. WHEN column types are converted, THE Schema_Module SHALL map SQLite `text` columns that do not specify a `length` option to PostgreSQL `varchar(256)` columns
7. WHEN default value expressions are converted, THE Schema_Module SHALL replace the SQLite `sql\`(unixepoch())\`` default with the PostgreSQL-equivalent `sql\`CURRENT_TIMESTAMP\`` default for timestamp columns
8. THE Schema_Module SHALL preserve all existing index definitions after the dialect conversion, maintaining the same index names and indexed column references

### Requirement 2: Replace Database Driver with Neon Serverless

**User Story:** As a developer, I want to replace the `@libsql/client` driver with `@neondatabase/serverless`, so that the application connects to Neon Postgres in both development and production environments.

#### Acceptance Criteria

1. THE DB_Client_Module SHALL use `@neondatabase/serverless` to create database connections
2. THE DB_Client_Module SHALL use the `drizzle-orm/neon-http` adapter for the Drizzle ORM instance
3. THE DB_Client_Module SHALL read the connection string from the `DATABASE_URL` environment variable
4. WHILE `NODE_ENV` is not `production`, THE DB_Client_Module SHALL store the database client instance on `globalThis` so that subsequent HMR updates reuse the existing connection instead of creating a new one
5. THE package.json SHALL include `@neondatabase/serverless` as a dependency and SHALL NOT include `@libsql/client`
6. IF the `DATABASE_URL` environment variable is missing or empty, THEN THE application SHALL fail to start with an error message indicating the missing variable

### Requirement 3: Update Drizzle Configuration for PostgreSQL

**User Story:** As a developer, I want to update the Drizzle Kit configuration to target PostgreSQL, so that migration generation and push commands work against the Neon database.

#### Acceptance Criteria

1. THE Drizzle_ORM configuration file SHALL specify `dialect: "postgresql"` and retain the existing `schema` path pointing to `./src/server/db/schema.ts`
2. THE Drizzle_ORM configuration file SHALL reference the `DATABASE_URL` environment variable via the `env` helper from `~/env` as the value of `dbCredentials.url`
3. THE Drizzle_ORM configuration file SHALL preserve the `tablesFilter` pattern `.bootstrap-scaffold_*`
4. WHEN `pnpm db:generate` is executed, THE Migration_Pipeline SHALL produce migration SQL files containing only PostgreSQL-dialect statements (e.g., `CREATE TABLE`, `SERIAL`, `TEXT`, `TIMESTAMP`) and exit with code 0
5. WHEN `pnpm db:migrate` is executed against a reachable Neon database, THE Migration_Pipeline SHALL apply all pending migrations, exit with code 0, and the target tables SHALL exist in the database schema
6. IF the `DATABASE_URL` environment variable is missing or empty WHEN a Drizzle Kit command is executed, THEN THE System SHALL fail with a validation error from the env schema before attempting any database connection

### Requirement 4: Configure Environment Variables for Neon

**User Story:** As a developer, I want to update the environment variable schema to accept Neon Postgres connection strings, so that the application validates its configuration at build time and runtime.

#### Acceptance Criteria

1. THE Env_Schema SHALL validate `DATABASE_URL` as a required server variable whose value starts with `postgresql://` or `postgres://` and contains at minimum a host segment (e.g., `postgresql://user:password@host/dbname`)
2. THE Env_Schema SHALL validate `DATABASE_URL_UNPOOLED` as a required server variable applying the same `postgresql://` or `postgres://` prefix and host-segment check used for `DATABASE_URL`
3. IF `DATABASE_URL` or `DATABASE_URL_UNPOOLED` is missing or fails the URI prefix validation at build time, THEN THE Env_Schema SHALL reject the build with an error message indicating which variable failed and that a `postgresql://` or `postgres://` connection string is expected
4. THE `.env.example` file SHALL document both `DATABASE_URL` and `DATABASE_URL_UNPOOLED` with placeholder values using the format `postgresql://user:password@host:5432/dbname` (pooled) and `postgresql://user:password@host:5432/dbname` (direct/unpooled) respectively
5. THE Env_Schema SHALL include `DATABASE_URL_UNPOOLED` in the `runtimeEnv` mapping so the variable is accessible to server-side code at runtime

### Requirement 5: Deploy Application to Vercel

**User Story:** As a developer, I want to deploy FlowState to Vercel, so that the application is accessible on the internet with zero-config Next.js optimization.

#### Acceptance Criteria

1. WHEN the Vercel project is created, THE Vercel_Platform SHALL be linked to the FlowState GitHub repository such that pushes to any branch trigger a build
2. WHEN a commit is merged to the `main` branch, THE GitHub_Integration SHALL trigger an automatic production deployment
3. WHEN a commit is pushed to a non-production branch, THE Vercel_Platform SHALL create a Preview_Deploy with a unique HTTPS-accessible URL that resolves to the branch build
4. THE Vercel_Platform SHALL use `pnpm` as the package manager for build commands (detected from `pnpm-lock.yaml`)
5. WHEN the production deployment completes, THE Vercel_Platform SHALL serve the application such that tRPC API endpoints return successful responses (HTTP 200) to valid requests within 10 seconds
6. THE Vercel_Platform SHALL have all required environment variables (including `DATABASE_URL`) configured in project settings and scoped to the appropriate environment (Production, Preview, Development)
7. IF a deployment build fails, THEN THE Vercel_Platform SHALL retain the previous successful deployment as the active production version and report the build failure in the deployment dashboard

### Requirement 6: Provision Neon Database via Vercel Marketplace

**User Story:** As a developer, I want to provision a Neon Postgres database through the Vercel Marketplace, so that connection strings are automatically injected into the Vercel project environment.

#### Acceptance Criteria

1. WHEN the Neon integration is added via Vercel Marketplace, THE Neon_Database SHALL be provisioned in the `eu-central-1` (Frankfurt) region
2. WHEN the Neon integration is configured, THE Vercel_Platform SHALL inject `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` (direct) into the project environment variables for all three environment scopes (Production, Preview, and Development)
3. THE Neon_Database SHALL use the serverless (HTTP) connection mode via `DATABASE_URL` for all runtime application queries to avoid connection pool exhaustion in serverless functions
4. WHEN a schema migration is executed, THE Neon_Database SHALL be accessed via the `DATABASE_URL_UNPOOLED` (direct TCP) connection to support long-running migration transactions
5. WHEN a Preview_Deploy is created, THE Vercel_Platform SHALL provide environment-scoped `DATABASE_URL` and `DATABASE_URL_UNPOOLED` variables so that the preview deployment connects to the Neon database without manual configuration

### Requirement 7: Configure Production Environment Variables in Vercel

**User Story:** As a developer, I want all required environment variables configured in Vercel project settings, so that builds and runtime execution have access to validated configuration.

#### Acceptance Criteria

1. THE Vercel_Platform SHALL have `DATABASE_URL` configured for the Production environment scope with a value that is a valid PostgreSQL connection URL (pooled endpoint)
2. THE Vercel_Platform SHALL have `DATABASE_URL` configured for the Preview environment scope with a value that is a valid PostgreSQL connection URL (pooled endpoint)
3. THE Vercel_Platform SHALL have `DATABASE_URL_UNPOOLED` configured for the Production environment scope with a value that is a valid PostgreSQL direct connection URL (used by migration tooling)
4. IF a server-side environment variable declared in the Env_Schema (`src/env.js`) is missing or empty during build, THEN THE Vercel_Platform SHALL fail the deployment with a non-zero exit code and the build log SHALL contain the variable name that failed validation
5. THE Vercel_Platform SHALL NOT expose `DATABASE_URL` or `DATABASE_URL_UNPOOLED` to client-side bundles (variables are declared in the `server` section of the Env_Schema without a `NEXT_PUBLIC_` prefix)
6. THE Env_Schema (`src/env.js`) SHALL declare `DATABASE_URL_UNPOOLED` in the `server` section with a `z.string().url()` validator so that builds fail if the variable is missing or malformed

### Requirement 8: Run Database Migrations on Deploy

**User Story:** As a developer, I want database migrations to execute as part of the deployment process, so that schema changes are applied before the new application version serves traffic.

#### Acceptance Criteria

1. WHEN a deployment includes new migration files, THE Migration_Pipeline SHALL execute `drizzle-kit migrate` using the `DATABASE_URL_UNPOOLED` connection string before the application starts serving requests
2. IF a deployment contains no pending migration files, THEN THE Migration_Pipeline SHALL skip the migration step and proceed with deployment without error
3. IF a migration fails (non-zero exit code from `drizzle-kit migrate`), THEN THE Migration_Pipeline SHALL abort the deployment, leave already-applied migration statements committed (no automatic rollback of partial DDL), report the error in build logs, and prevent the new application version from serving requests
4. IF the `DATABASE_URL_UNPOOLED` environment variable is not available at deploy time, THEN THE Migration_Pipeline SHALL abort the deployment and report a configuration error in build logs

### Requirement 9: Remove SQLite Artifacts

**User Story:** As a developer, I want to remove all SQLite-specific files and dependencies, so that the codebase has no dead references to the previous database setup.

#### Acceptance Criteria

1. WHEN the migration is complete, THE package.json SHALL NOT list `@libsql/client` in dependencies or devDependencies
2. WHEN the migration is complete, THE project source files SHALL contain zero import or require statements referencing `@libsql/client`
3. WHEN the migration is complete, THE project SHALL NOT contain the `db.sqlite` file in the repository
4. WHEN the migration is complete, THE `.gitignore` SHALL include entries for `*.sqlite` and `*.sqlite-journal` to prevent accidental commits of local SQLite files
5. WHEN the migration is complete, THE `drizzle.config.ts` SHALL specify `dialect: "postgresql"` and SHALL NOT reference the `better-sqlite3` or `libsql` driver
6. WHEN the migration is complete, THE `drizzle/` directory SHALL contain only migration files generated for the PostgreSQL dialect (SQL files using PostgreSQL syntax such as `CREATE TABLE`, `serial`, `timestamp`, and no SQLite-specific syntax such as `integer PRIMARY KEY AUTOINCREMENT` or `text NOT NULL` without explicit type length)
7. WHEN the migration is complete, THE database schema file (`src/server/db/schema.ts`) SHALL use `pgTable` (via the `createTable` helper) and SHALL NOT import or reference `sqliteTable`

### Requirement 10: Validate End-to-End Deployment

**User Story:** As a developer, I want to verify that the deployed application functions correctly, so that I have confidence the migration and deployment succeeded.

#### Acceptance Criteria

1. WHEN the production deployment is live, THE Vercel_Platform SHALL serve the application root path (`/`) with HTTP 200 status and a non-empty HTML response body within 5 seconds of the request
2. WHEN a tRPC procedure is called on the deployed application, THE DB_Client_Module SHALL connect to the Neon_Database and return a non-error response conforming to the procedure's expected schema within 3 seconds of the request
3. WHILE the application has been idle for more than 5 minutes, WHEN the next database request arrives, THE Neon_Database SHALL return the first response within 500ms measured from the moment the DB_Client_Module initiates the connection
4. IF the Vercel function execution exceeds 10 seconds, THEN THE Vercel_Platform SHALL terminate the function and return an error response indicating a timeout to the calling client
5. IF the DB_Client_Module fails to connect to the Neon_Database within 3 seconds, THEN THE application SHALL return an error response indicating database unavailability rather than hanging indefinitely
