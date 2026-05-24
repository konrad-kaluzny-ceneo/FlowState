## Neon Database CLI & MCP Usage

This project uses Neon serverless Postgres. The agent has access via both `neonctl` CLI and Neon MCP power.

### Project Details

- **Neon project:** `flow-state` (ID: `hidden-hall-84768725`)
- **Region:** `aws-eu-central-1`
- **Postgres version:** 18
- **Organization:** `org-square-brook-03702226`

### CLI Operations (`neonctl`)

- **List projects:** `neonctl projects list --output json`
- **List branches:** `neonctl branches list --project-id hidden-hall-84768725 --output json`
- **Create branch:** `neonctl branches create --project-id hidden-hall-84768725 --name <name>`
- **Delete branch:** `neonctl branches delete <branch-id> --project-id hidden-hall-84768725`
- **Connection string:** `neonctl connection-string --project-id hidden-hall-84768725`
- **Run SQL:** `neonctl sql --project-id hidden-hall-84768725 -- "SELECT 1"`
- **List databases:** `neonctl databases list --project-id hidden-hall-84768725 --branch main`

### MCP Operations (Kiro Power: `neon`)

Kiro has a Neon MCP power with tools for:
- `run_sql` / `run_sql_transaction` — execute queries against any branch
- `create_branch` / `delete_branch` — manage database branches
- `get_database_tables` / `describe_table_schema` — inspect schema
- `prepare_database_migration` / `complete_database_migration` — safe migration workflow
- `get_connection_string` — retrieve connection strings
- `list_slow_queries` / `explain_sql_statement` — performance analysis

Use MCP tools for structured operations (migrations, schema inspection). Use CLI for quick checks.

### Rules

- Always use Drizzle for schema changes in the app (`pnpm db:generate` then `pnpm db:migrate`). Use Neon MCP migrations only for out-of-band fixes or exploration.
- Test schema changes on a temporary branch first — never run untested DDL on the main branch.
- Never run destructive SQL (DROP, DELETE without WHERE, TRUNCATE) without explicit user confirmation.
- Use `--output json` with `neonctl` for parseable output.
- The project ID is `hidden-hall-84768725` — always pass it explicitly.
- Connection strings are secrets — never echo them in responses. Reference by env var name (`DATABASE_URL`).
