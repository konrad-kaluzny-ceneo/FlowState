# Repository Guidelines

- Critical **Tech Stack:** Next.js 16, React 19, TypeScript 6, Prisma 7, tRPC + Tanstack React Query + Zod 4, Tailwind CSS 4.
- **Package Manager:** pnpm (strict isolated `node_modules`, no hoisting). Use `pnpm` for all install/run commands. Never use `npm` or `yarn`.
- Rest of Stack: see `@package.json`.

## Terminal Commands

- Agent AI commands are always runned in Windows OS. Use always Windows compatibile commands.

## Project Structure

- Page-level components go in `_components/` co-located with their route.
- tRPC routers go in `src/server/api/routers/<feature>.ts`.
- Foundation docs live in `context/foundation/` — see `@context/foundation/prd.md` for product requirements and `@context/foundation/tech-stack.md` for stack rationale.

## Coding Style & Naming

- Indentation: tabs (size 2). Line endings: LF. Enforced by Biome and `@.editorconfig`.
- No ESLint or Prettier — Biome is the sole linter/formatter. Do not add either.
- Tailwind class sorting enforced via Biome's `useSortedClasses` rule (utility functions: `clsx`, `cva`, `cn`).
- Path alias: `~/` maps to `src/`. Use it for all intra-project imports.

## Database

- ORM: **Prisma 7** with `@prisma/adapter-neon` for serverless Neon connectivity.
- Schema defined in `prisma/schema.prisma`. All tables use `@@map("flow_state_<name>")` to maintain the `flow_state_` prefix convention.
- Prisma client generated to `./generated/prisma/client` (gitignored). Import via `@prisma/generated` path alias.
- Migrations: `pnpm prisma migrate dev` (local), `pnpm db:migrate:prod` (production). Never write migration SQL by hand.
- Config: `prisma.config.ts` at project root (loads `.env` automatically for CLI commands).
- Build script runs `prisma generate` only — migrations are NOT run at build time on Vercel.
- Prefer Prisma `enum` over `String @db.VarChar` for columns with a fixed set of values — enums give DB-level enforcement and end-to-end type safety without runtime Zod ↔ string mapping.

## tRPC

- Every tRPC router must be registered in `@src/server/api/root.ts` — unregistered routers are silently unreachable.
- tRPC middleware runs in declaration order — auth middleware must come before any procedure that reads `ctx.session`.
- All `create` mutations must `return` the created entity so clients can use it without a refetch.
- All `list` queries must use `take: DEFAULT_LIST_LIMIT` (from `~/server/api/config`) to prevent unbounded result sets.

## Testing

- Run all unit tests after each milestone: `pnpm test`
- **Critical:** Always run `pnpm test` at the end of every work cycle before presenting results.
- **E2E vs integration:** A direct DB query or server-side tRPC caller is an integration test, not e2e. True e2e requires a browser with an authenticated session hitting the running app. Do not claim "e2e verified" unless a real browser flow (with auth) was exercised.
- **Test pyramid:** All changes must include unit and integration tests. Code must be testable at each level of the pyramid (unit → integration → e2e). Do not ship code without covering the appropriate test levels for the change.

## Commit Conventions

Allowed commit types: `feat`, `docs`, `init` only. No trailing period.

## GitHub CLI (`gh`)

- `gh` is installed and authenticated with account `konrad-kaluzny-ceneo`. Always use this account.
- Use `gh` for all GitHub operations (PRs, issues, releases, workflows). Prefer non-interactive flags (`--yes`, `--title`, `--body`).
- Use `--json` flag when parsing output (e.g., `gh pr list --json number,title,state`).
- If auth fails, run `gh auth switch --user konrad-kaluzny-ceneo` before retrying.
- Full usage guide: see `.kiro/steering/github-cli.md`.

## Roadmap, Linear & GitHub (issue tracking)

- **Map:** `@context/foundation/roadmap.md` links roadmap IDs (`F-01`…`S-07`) ↔ Linear `FLO-*` ↔ GitHub `#*` on `konrad-kaluzny-ceneo/FlowState`.
- **Linear ↔ GitHub:** two-way sync enabled — edit status in one place, then **verify the pair** on the other (not instant).
- **On ship:** PR with `Fixes #N`, close issue (either side), verify sync, update roadmap `Status`.
- **Full workflow:** invoke skill **`update-status`** (`.cursor/skills/update-status/`, `.kiro/skills/update-status/`). Uses **`github-cli`** for `gh`.

## Neon Database CLI & MCP

- **Project:** `flow-state` (ID: `hidden-hall-84768725`), region `aws-eu-central-1`, Postgres 18.
- CLI: `neonctl` installed globally. Always pass `--project-id hidden-hall-84768725` and `--output json`.
- Use Prisma (`pnpm prisma migrate dev`) for app schema changes. Use Neon MCP/CLI only for exploration or out-of-band fixes.
- Test DDL on a temporary branch first — never run untested schema changes on main.
- Never run destructive SQL without explicit user confirmation.
- Connection strings are secrets — reference by env var name (`DATABASE_URL`), never echo values.
- Full usage guide: see `.kiro/steering/neon.md`.

## Vercel CLI & MCP

- **Account:** `konradkaluzny-3520` (team: `konrads-projects`). Vercel CLI is installed globally.
- Deploy preview first (`vercel --yes`), verify, then production (`vercel --prod --yes`).
- Use `vercel env ls/add/rm` for environment variables — always specify target environment.
- Use `vercel logs <url>` to debug deployment issues.
- Never delete production deployments without explicit user confirmation.
- Vercel MCP is available for structured queries (deployments, build logs, runtime logs, domains).
- Full usage guide: see `.kiro/steering/vercel.md`.

## Environment & Secrets

- Never commit secrets
- All env vars must be declared in `@src/env.js` (Zod schema).
