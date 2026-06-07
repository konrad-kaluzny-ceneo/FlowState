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

- Indentation: tabs (size 2). Line endings: LF. Enforced by Biome, `@.editorconfig`, and `@.gitattributes` (`eol=lf` at commit).
- No ESLint or Prettier — Biome is the sole linter/formatter. Do not add either.
- Tailwind class sorting enforced via Biome's `useSortedClasses` rule (utility functions: `clsx`, `cva`, `cn`).
- Path alias: `~/` maps to `src/`. Use it for all intra-project imports.
- **Critical:** Run `pnpm check` (Biome) after each iteration of changes. All errors must be resolved before presenting results or moving to the next task.

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
- **E2E (Playwright):** Never run bare `pnpm test:e2e` without `CI=true` — the `html` reporter blocks the terminal. Always use `CI=true` for the `list` reporter.
 ```
 set CI=true && pnpm test:e2e
 ```
 **Local speed:** Playwright starts `next dev --turbo` on port 3001 (no full build). Fastest loop: keep dev running with `set NEXT_PUBLIC_E2E_MAIN_THREAD_TIMER=1` and `pnpm exec next dev --turbo -p 3001`, then `set CI=true && set E2E_REUSE_SERVER=1 && pnpm test:e2e`. **Workers:** default `1` when `CI=true` (Neon Auth); ~50% CPU cores locally; override with `E2E_WORKERS`. **CI / prod parity:** `set E2E_PRODUCTION_SERVER=1` forces `build && next start` (GitHub Actions sets this automatically via `GITHUB_ACTIONS`).
 - To run a single spec: `set CI=true && pnpm exec playwright test e2e/my-spec.spec.ts`

### E2E Testing Rules

When adding or changing Playwright specs, follow `/10x-e2e` and model every new test on `@e2e/seed.spec.ts`. Risks and priorities live in `@context/foundation/test-plan.md`.

- **Generation exemplar:** Read `e2e/seed.spec.ts` before writing a new spec — copy its structure (provenance header, fixture auth, helpers, business-outcome assertions).
- **Authentication:** Use API sign-up/sign-in via `e2e/fixtures.ts` and `createTestUser` — never log in through the sign-in UI; do not use shared `storageState` / `playwright/.auth/user.json`.
- **Locators:** Prefer `getByRole`, `getByLabel`, and `getByText`. Use `getByTestId` only for overlays and panels where roles are ambiguous (matches existing specs).
- **Never** use CSS selectors, XPath, or DOM-structure locators.
- **Isolation:** Each test must be independently runnable — unique data (`Date.now()` suffix), no ordering assumptions, no shared state between tests.
- **Waits:** Never use `page.waitForTimeout()`. Wait for state: `expect(locator).toBeVisible()`, `page.waitForURL()`, `page.waitForResponse()`.
- **Assertions:** Assert the business outcome from test-plan risk wording, not implementation details.
- **VERIFY before merge:** Run a deliberate-break check on new critical specs; record results in `e2e/DELIBERATE-BREAK.md`.
- **Eligibility:** Do not E2E what an integration test can prove (pure logic, single-endpoint contracts). E2E is for flows crossing auth → routing → API → DB or UI-only state.
- **Workers:** Use `E2E_WORKERS=1` in CI to avoid Neon Auth rate limits (default when `CI=true`).

- **E2E vs integration:** A direct DB query or server-side tRPC caller is an integration test, not e2e. True e2e requires a browser with an authenticated session hitting the running app. Do not claim "e2e verified" unless a real browser flow (with auth) was exercised.
- **Test pyramid:** All changes must include unit and integration tests. Code must be testable at each level of the pyramid (unit → integration → e2e). Do not ship code without covering the appropriate test levels for the change.
- **Vitest agent output (`AI_AGENT=1`):** Vitest 4.1+ switches to compact output (failures only) when `AI_AGENT=1` is set. Use this in agent hooks and scoped test runs so hook feedback stays short and token-cheap — e.g. `set AI_AGENT=1 && pnpm exec vitest related src/hooks/foo.ts --run`. Hooks in `scripts/agent-hooks/related-tests.mjs` set this automatically; set it manually when invoking Vitest from shell scripts the agent will read.

## Agent hooks (Cursor + VS Code)

Shared scripts live in `scripts/agent-hooks/`; IDE configs only point at them.

- **Cursor:** `.cursor/hooks.json` only — `afterFileEdit` → 3 scripts per edit. `.cursor/settings.json` disables `.github/hooks` and `.claude/settings.json` so hooks are not loaded twice. **Normal cost: 3 executions per `.ts` edit** (lint + typecheck + related-tests skip). Restart Cursor after hook changes if old paths linger in Execution Log.
- **VS Code / Copilot:** `.github/hooks/quality.json` — same scripts via `PostToolUse`. `.vscode/settings.json` loads only `.github/hooks`. VS Code **ignores matchers**; scripts filter by `tool_name`. Verify in **GitHub Copilot Chat Hooks** output channel.
- **Pre-commit:** `lefthook.yml` — lint + typecheck + `vitest related` on staged files. Lefthook lint runs `biome check --write` then `git add` on each staged file — **stage the whole file** before commit; unstaged hunks in the same file can otherwise be swept into the commit. **Scope asymmetry:** agent `related-tests` hook runs only on risk dirs (`scripts/agent-hooks/lib/risk-areas.mjs`); lefthook runs `vitest related` on **all** staged `*.{ts,tsx}` — stricter human gate at commit time.
- **Pre-push:** `lefthook.yml` — full `pnpm check`, typecheck, and `pnpm test` before `git push` (parallel). Catches cross-file drift and regressions outside the staged diff.

## Mutation testing

Repo uses Stryker for selective mutation testing on risk-critical modules.
Run it only for code covered by the current change or a risk from `@context/foundation/test-plan.md`,
prefer narrowed scope with `--mutate "path/to/file.ts:start-end"`, and do not chase
100% mutation score. Survived mutants should be reviewed one by one: add an
assertion only when the mutant represents a user-visible or business-relevant bug.

- Command: `pnpm test:mutate` (full scope) or `pnpm exec stryker run --mutate "src/lib/foo.ts"`.
- Mutation score is not line coverage — do not treat a high score as a substitute for meaningful assertions.

## Manual verification (agent-owned when possible)

Plan steps and `/10x-implement` gates labeled **Manual Verification** must be executed by the agent whenever feasible — do not routinely defer them to the human.

**Preferred order (use the shallowest layer that proves the behavior):**

1. **Automated checks already in the plan** — run `pnpm test`, `pnpm typecheck`, `pnpm check` and cite results.
2. **Ad-hoc scripts** — `tsx` one-offs, server-side `createCaller` integration, `renderHook` / component smoke tests in Vitest for hooks and workers without UI.
3. **Playwright E2E** — `pnpm test:e2e` with the authenticated fixture from F-02 when the flow is user-visible or needs a real browser context.
4. **Running app / browser** — `pnpm dev` plus Playwright, or another automated browser pass; use interactive clicking only when automation cannot cover the check (e.g. subjective audio UX across engines).

**Phase without UI yet (e.g. server-only or hook-only):** satisfy manual items via integration callers and hook/worker unit tests — not by asking the user to use React DevTools or Prisma Studio unless the agent is blocked (missing env, auth, or hardware).

**When asking the human:** state what was already run, what gap remains, and the minimal human action (e.g. "confirm chime is audible in Chrome"). Do not treat manual gates as a default handoff.

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

## Research-gated tasks (`needs-research`)

- Issues labeled `needs-research` (Linear + GitHub) are complex and **must not be planned without prior research**.
- Before running `/10x-plan` on these tasks, generate `context/changes/<change-id>/research.md` using `/10x-research` (internal codebase research) **and** external research (exa.ai for web search, Context7 for library docs).
- Research targets per task are listed in `context/foundation/roadmap.md` § "Research requirements".
- Tasks **without** this label are straightforward implementations on the existing stack — proceed directly to `/10x-plan`.

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
