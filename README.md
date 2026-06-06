# FlowState

A Pomodoro-based productivity app that combines focused work sessions with adaptive task suggestions and mindful transitions. Built for knowledge workers who face constant context-switching and want to end the day feeling calm and in control — not overstimulated.

## What it does

- **Pomodoro timer** with configurable work/break durations (1 sec–90 min work, 1 sec–30 min break)
- **Task management** — add, edit, complete, and revert tasks with clear active/done separation
- **Adaptive focus scoring** — suggests your next task based on energy level, work type, urgency, and session context
- **Mindful check-ins** — after each cycle, declare your energy state (Focused / Steady / Fading) to guide suggestions
- **Session persistence** — browser crash or refresh won't lose your task list or timer state

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router, Turbopack) |
| Language | TypeScript |
| UI | React 19, Tailwind CSS 4 |
| API | tRPC 11 + Tanstack React Query |
| Database | Neon Postgres (serverless driver) |
| ORM | Drizzle |
| Auth | Neon Auth |
| Linter/Formatter | Biome |
| Testing | Vitest + Testing Library |
| Deployment | Vercel |

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/) 11+
- A [Neon](https://neon.tech/) Postgres database

## Getting Started

1. **Clone and install dependencies:**

   ```bash
   git clone <repo-url>
   cd FlowState
   pnpm install
   ```

2. **Set up environment variables:**

   ```bash
   cp .env.example .env
   ```

   Fill in your Neon database connection strings:

   ```env
   DATABASE_URL="postgresql://user:password@host:5432/dbname"
   DATABASE_URL_UNPOOLED="postgresql://user:password@host:5432/dbname"
   ```

3. **Run database migrations:**

   ```bash
   pnpm db:migrate
   ```

4. **Start the dev server:**

   ```bash
   pnpm dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev server with Turbopack |
| `pnpm build` | Run migrations + production build |
| `pnpm start` | Start production server |
| `pnpm test` | Run tests (single run) |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm typecheck` | TypeScript type checking |
| `pnpm check` | Biome lint + format check |
| `pnpm check:write` | Auto-fix lint/format issues |
| `pnpm db:generate` | Generate Drizzle migration files |
| `pnpm db:migrate` | Apply pending migrations |
| `pnpm db:studio` | Open Drizzle Studio (DB browser) |

## Local quality gates

Three local layers catch issues before code reaches the remote. CI is the fourth layer on merge.

| Layer | When | What runs |
|-------|------|-----------|
| **Per-edit (agent hooks)** | After the AI agent edits a file | Biome on the edited file, project typecheck, `vitest related` only in [risk dirs](context/foundation/test-plan.md) (`src/hooks/`, `src/workers/`, routers, repositories, `_components/`) |
| **Pre-commit** | `git commit` | Biome + typecheck + `vitest related` on **staged** files ([Lefthook](lefthook.yml)) |
| **Pre-push** | `git push` | Full `pnpm check`, typecheck, and `pnpm test` ([Lefthook](lefthook.yml)) |

**Setup:** `pnpm install` runs `lefthook install` via the `prepare` script and wires Git hooks automatically.

**IDE config:**

- **Cursor** — [`.cursor/hooks.json`](.cursor/hooks.json) (`afterFileEdit` → shared scripts in [`scripts/agent-hooks/`](scripts/agent-hooks/))
- **VS Code / Copilot** — [`.github/hooks/quality.json`](.github/hooks/quality.json) (same scripts via `PostToolUse`)

Hook scripts return exit code **2** on failure so the agent sees lint, type, or test output in context. See [`AGENTS.md`](AGENTS.md) for Windows paths, Copilot payload quirks, and staging notes for pre-commit lint.

## Project Structure

```
src/
├── app/                  # Next.js App Router pages and layouts
│   ├── _components/      # Page-level components
│   └── api/              # API routes (tRPC handler)
├── server/
│   ├── api/              # tRPC routers and procedures
│   └── db/              # Drizzle schema and DB client
├── trpc/                 # tRPC client setup (React + server)
├── styles/               # Global CSS (Tailwind)
└── env.js                # Environment variable schema (Zod)
```

## Deployment

FlowState deploys to **Vercel** with auto-deploy on merge to `main`.

1. Link the project: `vercel link`
2. Provision Neon Postgres via Vercel Marketplace (Storage → Add Database → Neon, `eu-central-1`)
3. Push to `main` — Vercel handles the rest

Preview deploys are created automatically for every PR branch.

## License

Private project — not licensed for redistribution.
