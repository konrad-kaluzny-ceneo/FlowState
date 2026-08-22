# FlowState

Przestań walczyć z listą zadań. Zacznij naprawdę pracować.

FlowState pomaga pracować spokojniej i skuteczniej. Planuj dzień, wybieraj jedno najważniejsze zadanie i realizuj je w sesjach głębokiego skupienia, bez ciągłego przełączania uwagi i poczucia przytłoczenia.

![FlowState](./promo-header.png)

## Odzyskaj spokój w pracy

FlowState to aplikacja stworzona dla osób, które chcą odzyskać kontrolę nad swoim dniem pracy. Zamiast kolejnego rozbudowanego menedżera zadań otrzymujesz spokojne środowisko, które pomaga skupić się na jednej rzeczy naraz i ograniczyć ciągłe przełączanie uwagi.

Aplikacja łączy świadome planowanie dnia, sesje Pomodoro oraz zasady Deep Work, dzięki czemu łatwiej utrzymać koncentrację i realizować zadania, które naprawdę mają znaczenie. FlowState prowadzi Cię przez cały proces: od zaplanowania dnia, przez wybór najważniejszego zadania, aż po podsumowanie wykonanej pracy.

Interfejs został zaprojektowany tak, aby nie rozpraszał. Na ekranie widzisz tylko to, czego potrzebujesz w danym momencie, dzięki czemu możesz skupić się na pracy zamiast na zarządzaniu kolejną listą zadań.

## Co oferuje FlowState?

- Planowanie dnia z podziałem na sesje pracy i przerwy.
- Minimalistyczne zarządzanie zadaniami.
- Sesje Pomodoro wspierające zdrowy rytm pracy.
- Ograniczenie przełączania kontekstu poprzez pracę nad jednym zadaniem.
- Statystyki pomagające budować dobre nawyki, zamiast rozliczać z produktywności.
- Cykliczne mierzenie wskaźników: ocena energii, wyczerpania poznawczego, postępu pracy, oceny efektywności.
- Ocena jak liczba równoległych zadań i sesji Agentów AI wpływa na wskaźniki pracy i samopoczucie po jej zakończeniu.

## Dla kogo?

FlowState powstał z myślą o programistach, testerach, projektantach, freelancerach, managerach i wszystkich osobach pracujących umysłowo, które każdego dnia mierzą się z nadmiarem zadań, spotkań i rozpraszaczy.

## Nasza filozofia

Nie chodzi o robienie większej liczby rzeczy. Chodzi o wykonywanie właściwych zadań we właściwym czasie, z pełnym skupieniem i bez poczucia ciągłego chaosu.

**FlowState. Mniej chaosu. Więcej skupienia.**

![FlowState](./promo.png)

## Pracuj z AI, nie przeciwko niemu

FlowState jest projektowany z myślą o pracy z Agentami AI.

AI pozwala prowadzić wiele zadań równolegle, ale jednoczesne zarządzanie nimi może zwiększać obciążenie poznawcze. FlowState pomaga znaleźć równowagę między wykorzystaniem równoległości AI a ochroną własnej uwagi.

Zamiast wymuszać jeden sposób pracy, FlowState pozwala określić charakter każdego projektu i dobrać do niego odpowiedni poziom autonomii AI.

### Charakterystyka projektu

Każdy projekt może być opisany za pomocą kilku parametrów:

- Złożoność - ile elementów i zależności trzeba uwzględnić.
- Trudność - jak wymagające jest rozwiązanie problemu.
- Jakość dokumentacji - jak dobrze agent może zrozumieć kontekst projektu.
- Ryzyko - konsekwencje błędnej decyzji lub implementacji.
- Tag Human-first - zadania celowo przewidziane do wykonania samodzielnie.

Na tej podstawie FlowState może pomóc dobrać sposób delegowania pracy, częstotliwość kontroli i poziom autonomii agenta.

### Zasady pracy z agentami

FlowState promuje kilka prostych zasad:

1. AI może pracować równolegle nad wieloma zadaniami.
1. Człowiek nie musi równolegle utrzymywać wszystkich tych kontekstów.
1. Agenci powinni pracować autonomicznie tak długo, jak długo mają jasno określony cel i możliwość samodzielnej walidacji.
1. Człowiek powinien być angażowany przede wszystkim wtedy, gdy potrzebna jest decyzja, ocena jakości lub wiedza kontekstowa.
1. Przerwy inżyniera powinny być prawdziwymi przerwami, bez ciągłego sprawdzania postępu agentów.
1. Praca wymagająca głębokiego skupienia nie powinna być przerywana przez powiadomienia AI.
1. Część zadań warto wykonywać samodzielnie, aby utrzymywać umiejętności i zdolność samodzielnego rozwiązywania problemów.

### AI jako warstwa wykonawcza

Docelowo FlowState może współpracować z agentami AI poprzez współdzielony kontekst projektu.

FlowState dostarcza informacje o aktualnym stanie pracy, priorytetach i charakterystyce zadania, a agent wykorzystuje je do dobrania odpowiedniego sposobu działania.

Dzięki temu zamiast kopiować ten sam rozbudowany prompt do każdego zadania, zasady pracy mogą być definiowane raz i stosowane konsekwentnie przez różnych agentów.

AI powinno zwiększać przepustowość człowieka, a nie zwiększać liczbę rzeczy, które człowiek musi jednocześnie kontrolować.

Jeśli dłuższy kontekst pozwala agentowi zrobić zadanie dobrze i bez Twojej ingerencji, koszt tokenów może być świetnym trade-offem. Twój najdroższy zasób to prawdopodobnie uwaga, nie tokeny.

### FlowState AI Inbox

FlowState AI Inbox to miejsce, gdzie człowiek może przeglądać i analizować wyniki pracy agentów AI:

- Wskaźniki pracy agentów AI (czas pracy, czas oczekiwania na decyzję).
- Stan poszczególnych agentów AI (Done, In Progress, Blocked, Decision Required).
- Priorytet poszczególnych zadań AI (Low, Medium, High).
- Oznaczenie wybranego poziomu autonomii dla danego agenta AI.

## What it does

- **Pomodoro timer** with configurable work/break durations (1 sec–90 min work, 1 sec–30 min break)
- **Task management** — add, edit, complete, and revert tasks with clear active/done separation
- **Adaptive focus scoring** — suggests your next task based on energy level, work type, urgency, and session context
- **Mindful check-ins** — after each cycle, declare your energy state (Focused / Steady / Fading) to guide suggestions
- **Session persistence** — browser crash or refresh won't lose your task list or timer state

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript |
| UI | React 19, Tailwind CSS 4 |
| API | tRPC 11 + Tanstack React Query |
| Database | Neon Serverless Postgres |
| ORM | Prisma 7 (`@prisma/adapter-neon`) |
| Auth | Neon Auth |
| Linter/Formatter | Biome |
| Testing | Vitest + Playwright (e2e) |
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

   Fill in your Neon database and auth variables (see `.env.example`):

   ```env
   # Neon DB
   DATABASE_URL="postgresql://user:password@host:5432/dbname"
   DATABASE_URL_UNPOOLED="postgresql://user:password@host:5432/dbname"

   # Neon Auth (required at runtime — validated in src/env.js)
   NEON_AUTH_BASE_URL="https://your-project.neonauth.com"
   NEON_AUTH_COOKIE_SECRET="your-secret-at-least-32-characters-long"
   ```

   Optional: `CURSOR_API_KEY` for `scripts/cursor-review` only (not used by the Next.js app).

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
| `pnpm dev` | Regenerate Prisma client and start dev server (Turbopack) |
| `pnpm build` | Regenerate Prisma client and production build |
| `pnpm start` | Start production server |
| `pnpm test` | Run unit/integration tests (single run) |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm test:e2e:belt` | Run CI e2e belt (critical flows) |
| `pnpm typecheck` | TypeScript type checking |
| `pnpm check` | Biome lint + format check |
| `pnpm check:write` | Auto-fix lint/format issues |
| `pnpm db:generate` | Regenerate Prisma client (`prisma generate`) |
| `pnpm db:migrate` | Create and apply migrations in dev (`prisma migrate dev`) |
| `pnpm db:migrate:prod` | Apply pending migrations in production (`prisma migrate deploy`) |
| `pnpm db:studio` | Open Prisma Studio (DB browser) |

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
├── hooks/                # React hooks (Pomodoro cycle, etc.)
├── i18n/                 # Internationalization
├── lib/                  # Shared utilities, data mode, wedge logic
├── server/
│   ├── api/              # tRPC routers and procedures
│   └── db/               # Prisma client (Neon adapter)
├── trpc/                 # tRPC client setup (React + server)
├── workers/              # Web Workers (timer)
├── styles/               # Global CSS (Tailwind)
└── env.js                # Environment variable schema (Zod)

prisma/
├── schema.prisma         # Database schema (source of truth)
└── migrations/           # Prisma migration files
```

## Deployment

FlowState deploys to **Vercel** with auto-deploy on merge to `main`.

1. Link the project: `vercel link`
2. Provision Neon Postgres via Vercel Marketplace (Storage → Add Database → Neon, `eu-central-1`)
3. Push to `main` — Vercel handles the rest

Preview deploys are created automatically for every PR branch.

## License

Private project — not licensed for redistribution.
