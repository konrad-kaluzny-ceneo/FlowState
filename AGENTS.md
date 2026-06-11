# Repository Guidelines

FlowState is a Next.js Pomodoro app on the T3-style stack. Agents run terminal commands in **Windows PowerShell**. Stack and scripts: `@package.json`, `@context/foundation/tech-stack.md`.

## Hard rules

- **Never** commit or push to `main`/`master`. All slice work on `features/<change-id>` (kebab-case Change ID from `@context/foundation/roadmap.md` or `context/changes/<change-id>/`).
- Before the first edit for a change: `git switch main; git pull; git switch -c features/<change-id>` — or resume with `git switch features/<change-id>`.
- **Two or more parallel slices:** one [git worktree](https://git-scm.com/docs/git-worktree) per slice at `../FlowState-<change-id>`; do not bounce `git switch` in one checkout. Single slice: the main clone is enough.
- **pnpm only** — never `npm` or `yarn`.
- Never commit secrets; declare env vars in `@src/env.js`.
- After each code iteration: `pnpm check`. Before presenting results: `pnpm test`.
- E2E belt (CI merge gate): `set CI=true && pnpm test:e2e:belt` — 12 tests via `--grep-invert @skip-belt`; partial specs tag non-belt cases `@skip-belt`. Full catalog: `set CI=true && pnpm test:e2e` (ad-hoc local / pre-release). `CI=true` only selects the list reporter (non-blocking terminal); Playwright starts `next dev` on port **3001** (or `next start` in GHA). Auth pool: `e2e/global-setup.ts` provisions 4 users; fixtures map workers to `e2e/.auth/worker-{n}.json`; default **4 workers** (`E2E_WORKERS=4` in CI). Neon secrets from `.env`/`.env.local` only — no E2E flags required per run. Optional: `E2E_REUSE_SERVER=1` with a manual dev server; `E2E_WORKERS=1` if Neon Auth 429; `E2E_PRODUCTION_SERVER=1` for local prod parity. See `@e2e/README.md`. Bare `pnpm test:e2e` / `pnpm test:e2e:belt` blocks on the html reporter.

## Commands

- `pnpm dev` — local dev server
- `pnpm check` — Biome lint/format (sole linter; no ESLint/Prettier)
- `pnpm typecheck` — TypeScript
- `pnpm test` — Vitest unit/integration
- `pnpm prisma migrate dev` — local schema migrations; never hand-write migration SQL
- Hooks: `@lefthook.yml` — pre-commit: Biome on staged files, typecheck, `vitest related`; pre-push: `check`, typecheck, full `test`

## Layout & conventions

- Page UI: `_components/` co-located with the route. tRPC routers: `src/server/api/routers/<feature>.ts` — every router must be registered in `@src/server/api/root.ts`.
- Path alias `~/` → `src/`. Tabs (size 2), LF; enforced by `@biome.json`, `@.editorconfig`, `@.gitattributes`.
- Prisma tables: `@@map("flow_state_<name>")`; import client via `@prisma/generated`. Product requirements: `@context/foundation/prd.md`.

## Testing & delivery

- Model Playwright specs on `@e2e/seed.spec.ts`; risk priorities in `@context/foundation/test-plan.md`. Use `/10x-e2e` for browser-level tests.
- Vitest: co-located `*.test.ts` beside source under `src/`; single file: `pnpm exec vitest run src/<path>/<name>.test.ts`.
- Co-located component smoke for form controls when text is unbounded (e.g. `textarea` vs `input` for inline edit); canonical example: `src/app/_components/task-list.test.tsx`.
- Commit types: `feat`, `chore`, `fix`, `refactor`, `docs`; `test` when scoped — no trailing period. Pattern: `feat(<change-id>): title (pN)`.
- PRs from feature branches with `Fixes #N`; must pass `@.github/workflows/ci.yml` (quality + e2e on PR/push to main). Issue sync (Linear `FLO-*` ↔ GitHub `#*`): `@.cursor/skills/update-status/SKILL.md`. `gh` account `konrad-kaluzny-ceneo`: `@.cursor/skills/github-cli/SKILL.md`.
- Neon DB, Vercel deploy, agent hooks: `@.cursor/skills/neon-database/SKILL.md`, `@.cursor/skills/vercel/SKILL.md`, `@.cursor/hooks.json`.
- `needs-research` tasks: research before `/10x-plan` — see `@context/foundation/roadmap.md`.
