## Vercel CLI & MCP Usage

This project is deployed on Vercel. The agent has access to Vercel via both CLI and MCP tools.

### Account

- Vercel account: `konradkaluzny-3520` (team: `konrads-projects`)
- If auth expires, run `vercel login` and follow the device flow.

### CLI Operations

- **Deploy preview:** `vercel` (deploys to preview URL)
- **Deploy production:** `vercel --prod`
- **List deployments:** `vercel ls`
- **Inspect deployment:** `vercel inspect <url>`
- **View logs:** `vercel logs <url>`
- **Environment variables:** `vercel env ls`, `vercel env add`, `vercel env rm`
- **Link project:** `vercel link`
- **Pull env locally:** `vercel env pull .env.local`
- **Domains:** `vercel domains ls`, `vercel domains add`
- **Promote:** `vercel promote <url>`

### MCP Operations (Kiro)

Kiro has a built-in Vercel MCP with tools for:
- Deploying, listing deployments, getting build/runtime logs
- Managing projects, teams, domains
- Fetching protected deployment URLs
- Toolbar comments (list, reply, resolve)

Use MCP tools when structured data is needed. Use CLI for quick operations.

### Rules

- Always deploy to preview first (`vercel`), verify, then promote to production (`vercel --prod`).
- Use `--yes` flag to skip confirmation prompts (e.g., `vercel --yes`).
- Use `--token` flag only if explicitly provided — never hardcode tokens.
- Never delete production deployments without explicit user confirmation.
- For environment variable changes, always specify the environment (`production`, `preview`, `development`).
