---
name: neon-database
description: Neon serverless Postgres for FlowState — neonctl CLI, Neon MCP (branches, SQL, schema, migrations), Drizzle workflow, and safety rules. Use when exploring the database, running neonctl, using Neon MCP, branching for DDL tests, debugging queries, connection strings, or out-of-band schema fixes.
---

# Neon Database (FlowState)

## Project

| Item | Value |
|------|--------|
| Neon project | `flow-state` |
| Project ID | `hidden-hall-84768725` (always pass explicitly) |
| Region | `aws-eu-central-1` |
| Postgres | 18 |
| Organization | `org-square-brook-03702226` |
| App env var | `DATABASE_URL` — never echo connection strings |

App schema changes use **Drizzle** (`pnpm db:generate` then `pnpm db:migrate`). Tables must use `createTable` from `src/server/db/schema.ts` (`flow_state_` prefix).

Neon MCP is configured in `.cursor/mcp.json` (`neon` → `https://mcp.neon.tech/sse`). Read MCP tool schemas before calling. Always-applied rules also live in `.cursor/rules/neon.mdc` and `AGENTS.md`.

## When to use what

| Task | Tool |
|------|------|
| App schema migrations | Drizzle (`pnpm db:generate` / `pnpm db:migrate`) |
| Schema inspection, ad-hoc SQL, branch experiments | Neon MCP |
| Quick one-off checks, branch CRUD from terminal | `neonctl` |

## CLI (`neonctl`)

Always: `--project-id hidden-hall-84768725` and `--output json`.

```bash
neonctl projects list --output json
neonctl branches list --project-id hidden-hall-84768725 --output json
neonctl branches create --project-id hidden-hall-84768725 --name <name>
neonctl branches delete <branch-id> --project-id hidden-hall-84768725
neonctl connection-string --project-id hidden-hall-84768725
neonctl sql --project-id hidden-hall-84768725 -- "SELECT 1"
neonctl databases list --project-id hidden-hall-84768725 --branch main
```

## MCP (`neon` server)

Prefer MCP for structured work:

- `run_sql` / `run_sql_transaction` — queries on any branch
- `create_branch` / `delete_branch` — branch management
- `get_database_tables` / `describe_table_schema` — schema inspection
- `prepare_database_migration` / `complete_database_migration` — safe migration workflow
- `get_connection_string` — retrieve strings (do not echo to user)
- `list_slow_queries` / `explain_sql_statement` — performance analysis

Use MCP for migrations (out-of-band), schema inspection, and performance. Use CLI for quick terminal checks.

## Safety rules

1. **Drizzle first** for app schema; Neon MCP migrations only for exploration or out-of-band fixes.
2. **Branch before DDL** — test on a temporary branch; never run untested DDL on `main`.
3. **No destructive SQL** without explicit user confirmation: `DROP`, `DELETE` without `WHERE`, `TRUNCATE`.
4. **Secrets** — reference `DATABASE_URL` by name only; never log or paste connection strings.

## Neon Auth — Trusted Origins for Vercel Preview Deploys

Neon Auth validates the `Origin` header on every sign-in/sign-up request. Vercel generates a unique branch alias URL for each new branch on first push (e.g. `https://flow-state-git-<branch>-konrads-projects.vercel.app`). This URL is **not** automatically trusted by Neon Auth — you must register it manually.

**On first push of a new branch to GitHub:**

1. Note the stable branch alias URL from Vercel (visible in the deployment details or PR comment):
   `https://flow-state-git-<branch-name>-konrads-projects.vercel.app`
2. Add it as a trusted origin in Neon Auth using MCP:
   ```
   configure_neon_auth(operation: "add_trusted_origin", projectId: "hidden-hall-84768725", trusted_origin: "https://flow-state-git-<branch-name>-konrads-projects.vercel.app")
   ```
   Or via the Neon Console → Project → Auth → Trusted Origins.
3. Auth flows (sign-up, sign-in, OAuth callbacks) will now work on that preview deploy.

**Currently registered trusted origins:**
- `https://flow-state-ecru-ten.vercel.app` (production)
- `https://flow-state-git-features-neon-auth-konrads-projects.vercel.app` (feature branch)
- `https://flow-state-konrads-projects.vercel.app` (project alias)
- `localhost` (allowed via `allow_localhost: true`)

**Important:** Per-deployment URLs (e.g. `flow-state-50m1ope0s-konrads-projects.vercel.app`) change on every push. Always use the stable branch alias instead.

## Schema change workflow

```
1. Edit Drizzle schema (createTable helper)
2. pnpm db:generate
3. Optional: create Neon branch → pnpm db:migrate against branch URL (exploration)
4. pnpm db:migrate on target environment after review
```

Code rollback does not revert applied migrations — plan forward fixes if schema and code diverge.

## Additional reference

Full steering copy: [.kiro/steering/neon.md](.kiro/steering/neon.md). Hosting context: [foundation-infrastructure](../foundation-infrastructure/SKILL.md).
