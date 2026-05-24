# Repository Guidelines

- Critical **Tech Stack:** Next.js 15, React 19, TypeScript, Vite, Drizzle, tRPC + Tanstack React Query + Zod, Tailwind CSS.
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

- Drizzle tables must use the `createTable` helper from `@src/server/db/schema.ts` (prefixes tables with `flow_state_`). Raw `pgTable` calls break the naming convention.
- Drizzle migrations must be generated with `pnpm drizzle-kit generate` before `pnpm drizzle-kit migrate`. Running migrate without a pending generation silently does nothing.
- Don't write SQL migration files by hand - always use CLI to generate migration files.

## tRPC

- Every tRPC router must be registered in `@src/server/api/root.ts` — unregistered routers are silently unreachable.
- tRPC middleware runs in declaration order — auth middleware must come before any procedure that reads `ctx.session`.

## Testing

- Run all unit tests after each milestone: `pnpm test`

## Commit Conventions

Allowed commit types: `feat`, `docs`, `init` only. No trailing period.

## GitHub CLI (`gh`)

- `gh` is installed and authenticated with account `konrad-kaluzny-ceneo`. Always use this account.
- Use `gh` for all GitHub operations (PRs, issues, releases, workflows). Prefer non-interactive flags (`--yes`, `--title`, `--body`).
- Use `--json` flag when parsing output (e.g., `gh pr list --json number,title,state`).
- If auth fails, run `gh auth switch --user konrad-kaluzny-ceneo` before retrying.
- Full usage guide: see `.kiro/steering/github-cli.md`.

## Environment & Secrets

- Never commit secrets
- All env vars must be declared in `@src/env.js` (Zod schema).
