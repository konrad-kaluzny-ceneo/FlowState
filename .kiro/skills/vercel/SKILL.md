---
name: vercel
description: FlowState Vercel CLI and MCP operations — preview/production deploys, env vars, logs, domains, and promotion. Use when deploying, debugging deployments, managing Vercel env vars, inspecting build/runtime logs, or working with Vercel project settings for this repo.
---

# FlowState Vercel

This project deploys on Vercel. Use CLI for quick commands; use MCP when structured deployment data, build logs, or runtime logs are needed.

## Account

| Item | Value |
|------|--------|
| Account | `konradkaluzny-3520` |
| Team | `konrads-projects` |

If auth expires: `vercel login` (device flow).

## CLI operations

CLI is installed globally. Prefer `--yes` on deploy commands to skip prompts.

| Task | Command |
|------|---------|
| Deploy preview | `vercel --yes` |
| Deploy production | `vercel --prod --yes` |
| List deployments | `vercel ls` |
| Inspect deployment | `vercel inspect <url>` |
| View logs | `vercel logs <url>` |
| Follow logs | `vercel logs <url> --follow` |
| Env vars — list | `vercel env ls` |
| Env vars — add | `vercel env add` |
| Env vars — remove | `vercel env rm` |
| Link project | `vercel link` |
| Pull env locally | `vercel env pull .env.local` |
| Domains — list | `vercel domains ls` |
| Domains — add | `vercel domains add` |
| Promote deployment | `vercel promote <url>` |
| Rollback | `vercel rollback <deployment-url>` |

## MCP operations

Vercel MCP is configured in `.cursor/mcp.json` (`https://mcp.vercel.com`). The Vercel plugin also exposes tools (e.g. `list_deployments`, `get_deployment`, `get_deployment_build_logs`, `get_runtime_logs`, `deploy_to_vercel`, `get_project`, domain and toolbar helpers).

**When to use which**

- **MCP** — structured deployment lists, build/runtime logs, project/team metadata, protected URL access, docs search
- **CLI** — one-off deploy, env pull, promote, rollback, quick log tail

Before calling MCP tools, read the tool schema under the Vercel MCP server descriptor folder.

## Rules

1. **Preview first** — `vercel --yes`, verify, then `vercel --prod --yes`.
2. **`--yes`** on deploy/promote when the agent runs commands (non-interactive).
3. **`--token`** only if the user explicitly provides a token — never hardcode tokens.
4. **Never delete production deployments** without explicit user confirmation.
5. **Env var changes** — always specify target: `production`, `preview`, or `development`.
6. **Secrets** — never echo tokens or connection strings; reference env var names only.
7. **New branch → register Neon Auth trusted origin** — on first push of a new branch, add the stable branch alias URL (`https://flow-state-git-<branch>-konrads-projects.vercel.app`) to Neon Auth trusted origins via `configure_neon_auth` MCP tool or Neon Console. Without this, auth flows (sign-up/sign-in) will fail with "Invalid origin" on preview deploys. See [neon-database SKILL](../neon-database/SKILL.md) for details.

## Related context

- Platform limits, rollback vs migrations, Hobby constraints: [foundation-infrastructure](../foundation-infrastructure/SKILL.md)
- Always-applied rules: `.cursor/rules/vercel.mdc`, `AGENTS.md`
- Full platform research: [context/foundation/infrastructure.md](context/foundation/infrastructure.md)
