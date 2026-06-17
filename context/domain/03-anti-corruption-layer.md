---
title: Anti-Corruption Layer — Prisma domain enums
created: 2026-06-17
type: refactor-plan
---

# Anti-Corruption Layer — plan refaktoru

Plan refaktoru (bez implementacji produkcyjnej). Metodologia: odkrycie → identyfikacja → klasyfikacja → diagnoza → projekt ACL → dowód izolacji → weryfikacja i fazy. Każdy krok zweryfikowany przez sub-agentów eksploracyjnych w repozytorium FlowState.

---

## KROK 0 — Odkrycie kontekstu

### Stack i zależności infrastrukturalne

| Warstwa | Technologia | Wersja (`package.json`) |
|---------|-------------|-------------------------|
| Framework | Next.js (App Router) | `^16.2.6` |
| UI | React + Tailwind CSS 4 | `^19.2.6` / `^4.3.0` |
| API | tRPC 11 + TanStack React Query 5 | `^11.17.0` / `^5.100.14` |
| ORM | Prisma 7 + `@prisma/adapter-neon` | `^7.8.0` |
| DB | Neon Serverless Postgres | `@neondatabase/serverless` `^1.1.0` |
| Auth | Neon Auth (Better Auth) | `@neondatabase/auth` `0.4.1-beta` |
| Walidacja | Zod 4 | `^4.4.3` |
| Serializacja wire | superjson | `^2.2.6` |

Źródło prawdy stacku: `context/foundation/tech-stack.md`. Projekt przeszedł migrację ORM Drizzle → Prisma 7 — koszt wymiany persystencji jest udokumentowany i realny:

```56:61:context/foundation/tech-stack.md
The project migrated from Drizzle ORM to Prisma 7 to leverage:

- **Rust-free TypeScript runtime** — Prisma 7 dropped the Rust query engine for a fully TS-based client, yielding smaller bundles and faster cold starts
- **Driver adapters** — `@prisma/adapter-neon` connects via Neon's HTTP driver (`@neondatabase/serverless`) for optimal serverless performance
- **Schema-first workflow** — `prisma/schema.prisma` is the single source of truth for the database schema
```

### Mapa warstw kodu

```
src/
├── app/                    # UI (App Router), server actions auth, api/trpc route
│   └── _components/        # komponenty strony (timer, overlaye, task list)
├── hooks/                  # use-pomodoro-cycle (hub), mutacje, preferencje
├── lib/                    # logika domenowa / współdzielona
│   ├── data-mode/          # zamierzony ACL guest ↔ auth (types, context, repos)
│   ├── repositories/       # adaptery guest + server (tRPC)
│   ├── scoring/            # czysta logika scoringu (deklarowana jako wzorzec)
│   ├── session/            # narracja, wind-down
│   └── cycle-audio-preference/  # jedyny istniejący ACL enum (audio)
├── server/
│   ├── api/routers/        # tRPC (task, cycle, session, check-in, suggestion, preference)
│   └── db/index.ts         # singleton PrismaClient + Neon adapter
├── trpc/                   # klient React, RSC hydration
prisma/schema.prisma        # SSOT schematu DB (enumy domenowe)
generated/prisma/           # klient generowany (alias `@prisma/generated`)
```

### Deklaracje wymienialności / granic domeny

| Dokument | Cytat | Implikacja |
|----------|-------|------------|
| `AGENTS.md:35` | „Guest + auth through `@src/lib/data-mode/`.” | Produkt wymaga jednego portu persystencji — nie obejścia przez surowe tRPC. |
| `context/foundation/stack-assessment.md:119-124` | „pattern exists in `src/lib/data-mode/` … Reference `useRepositories()` pattern; never bypass data-mode for 'quick fixes.'” | ACL jest zamierzony; kod go częściowo omija. |
| `context/map/repo-map.md:14` | „**Bezpieczny wzorzec:** `lib/scoring` — czysta domena, tanie testy unit.” | Dokumentacja deklaruje scoring jako domenę czystą od infrastruktury. |
| `context/map/repo-map.md:156` | „`src/lib/scoring/score-task.ts` — Wzorzec „dobra” domeny” | Ten sam wzorzec — rozjazd z importem Prisma w kodzie. |
| `context/changes/refactor-opportunities/plan.md:15,61` | K2 `data-mode-acl-hardening`; Path C `useDomainTasks(mode)` | Planowany rollout ACL — enforcement jeszcze nie wdrożony. |

Brak jawnej deklaracji „wymienialnego ORM” w PRD — ale migracja Drizzle→Prisma i istniejący wzorzec `cycle-audio-preference` pokazują, że zespół **wie**, jak izolować enumy persystencji. Problem: zrobiono to dla jednego enumu, nie dla całej domeny.

---

## KROK 1 — Przeciekające zależności

Przeskanowano importy infrastruktury w `src/`. Poniżej osie z przeciekiem przez ≥2 warstwy.

### Oś A: `@prisma/generated` — **14 plików produkcyjnych `src/`**

| Warstwa | Plik | Linia | Import |
|---------|------|-------|--------|
| lib | `src/lib/scoring/score-task.ts` | 1–5 | `CommitmentHorizon`, `EnergyLevel`, `WorkType` |
| lib | `src/lib/duration-bounds.ts` | 1 | `WorkType` |
| lib | `src/lib/work-type-duration-storage.ts` | 1 | `WorkType` |
| lib | `src/lib/session/narrative-context.ts` | 1 | `EnergyLevel` |
| lib | `src/lib/session/narrative-builder.ts` | 1 | `EnergyLevel` |
| lib | `src/lib/session/wind-down-nudge.ts` | 1 | `EnergyLevel` |
| lib | `src/lib/cycle-audio-preference/types.ts` | 1 | `CycleEndAudioMode` (alias Prisma) |
| hooks | `src/hooks/use-pomodoro-cycle.ts` | 26 | `EnergyLevel` |
| app | `src/app/_components/kickoff-duration-chips.tsx` | 3 | `WorkType` |
| server | `src/server/db/index.ts` | 2 | `PrismaClient` |
| server | `src/server/api/routers/suggestion.ts` | 1 | `EnergyLevel` |
| server | `src/server/api/lib/active-session.ts` | 1 | `Session` |
| server | `src/server/api/lib/import-guest-snapshot.ts` | 1 | `PrismaClient` |
| test | `src/server/api/routers/preference.test.ts` | 1 | `CycleEndAudioMode` (mock DB) |

### Oś B: `@neondatabase/auth` — lib + app (5 plików prod.)

| Plik | Linia |
|------|-------|
| `src/lib/auth/server.ts` | 1 |
| `src/lib/auth/client.ts` | 2 |
| `src/app/auth/sign-in/action.ts` | 3 |
| `src/app/auth/forgot-password/action.ts` | 3 |
| `src/app/auth/reset-password/action.ts` | 3 |

### Oś C: `zod` — równoległe schematy enumów (app + server + lib)

| Plik | Linia | Duplikacja |
|------|-------|------------|
| `src/server/api/routers/task.ts` | 7–10 | `workTypeSchema`, `commitmentHorizonSchema` |
| `src/lib/guest/schema.ts` | 7–18 | te same literały co router task |
| `src/lib/data-mode/types.ts` | 3, 28 | `CommitmentHorizon`, `workType` inline |
| `src/server/api/routers/check-in.ts` | 20 | `energy: z.enum(["FOCUSED", "STEADY", "FADING"])` |
| `src/server/api/routers/suggestion.ts` | 26 | ten sam `energy` enum |

### Oś D: `superjson` — 3 pliki (infrastruktura wire, oczekiwane)

`src/server/api/trpc.ts:10`, `src/trpc/react.tsx:8`, `src/trpc/query-client.ts:5` — symetria serwer/klient; nie jest naruszeniem domeny.

### Oś E: `@trpc/*` omijający repozytoria

| Plik | Linia | Wzorzec |
|------|-------|---------|
| `src/lib/data-mode/data-mode-context.tsx` | 12, 41–96 | tRPC wewnątrz ACL |
| `src/hooks/use-pomodoro-cycle.ts` | 54 | bezpośrednie `api.checkIn` / `api.suggestion` |
| `src/hooks/use-task-mutations.ts` | 11 | `api.task.*` + `RouterOutputs` |
| `src/app/_components/pomodoro-dashboard.tsx` | 29, 452 | dual path: `api.task.list` + `useDataMode()` |
| `src/lib/trpc/suggestion-priority-link.ts` | 1–4 | `@trpc/server/observable` w `lib/` |

### Oś F: `@neondatabase/serverless`, `@prisma/client`, `better-auth`

Brak bezpośrednich importów w `src/` (Neon przez adapter w `server/db`).

---

## KROK 2 — Klasyfikacja i wybór #1

| Oś | (a) Warstwy / pliki | (b) Koszt wymiany dziś | (c) Rozjazd intencja ↔ kod |
|----|---------------------|------------------------|----------------------------|
| **A. `@prisma/generated`** | **4 warstwy, 14 prod.** | **Bardzo wysoki** — scoring, narracja, UI, hook, routery | **Duży** — „czysta domena” vs import Prisma w `score-task.ts` |
| B. Neon Auth | 2 warstwy, 5 prod. | Średni — wymiana providera = nowy `lib/auth` | Mały — stack deklaruje Neon Auth |
| C. Zod duplikaty | 3+ warstwy | Wysoki — drift przy migracji schematu | Średni — brak SSOT dla enumów |
| D. superjson | 3 pliki infra | Niski | Brak |
| E. tRPC bypass | hooks + app | Średni — K2 Path C planowany | Uznany w `refactor-opportunities` |

### Wybór #1: `@prisma/generated` (enumy i typy modeli Prisma)

**Uzasadnienie:**

1. **Najgłębsza penetracja** — jedyna oś sięgająca do `lib/scoring`, `lib/session`, hooków i komponentów UI, nie tylko `server/`.
2. **Historyczny dowód kosztu wymiany** — migracja Drizzle→Prisma (`tech-stack.md:56-61`) dotknęła całego stosu; dziś każdy enum Prisma w `lib/` mnoży ten koszt przy kolejnej zmianie ORM lub kształtu enumów.
3. **Największy rozjazd dokumentacja↔kod** — repo-map poleca `score-task.ts` jako wzorzec czystej domeny, podczas gdy plik importuje typy z `@prisma/generated`.
4. **Wzorzec naprawy już istnieje** — `cycle-audio-preference/types.ts` + `preference.ts` pokazują ACL; pozostałe enumy go nie mają.
5. **Wzmacnia osie C i E** — surowe wiersze Prisma na wire (`task.list`) i potrójne definicje Zod wynikają z braku domenowego SSOT enumów.

---

## KROK 3 — Diagnoza

### 3.1 Zduplikowane definicje enumów (brak mappera)

**Prisma SSOT:**

```12:16:prisma/schema.prisma
enum WorkType {
  DEEP_WORK
  OPERATIONAL
  REACTIVE
}
```

```18:22:prisma/schema.prisma
enum EnergyLevel {
  FOCUSED
  STEADY
  FADING
}
```

**Kopia domenowa w data-mode (bez `fromPrisma`/`toPrisma`):**

```3:3:src/lib/data-mode/types.ts
export type CommitmentHorizon = "ASAP" | "THIS_WEEK" | "WHEN_POSSIBLE";
```

```28:28:src/lib/data-mode/types.ts
	workType: "DEEP_WORK" | "OPERATIONAL" | "REACTIVE";
```

**Kopia w routerze tRPC:**

```7:10:src/server/api/routers/task.ts
const workTypeSchema = z.enum(["DEEP_WORK", "OPERATIONAL", "REACTIVE"]);
const axisSchema = z.number().int().min(1).max(3);
const effortMinutesSchema = z.number().int().min(5).max(240).nullable();
const commitmentHorizonSchema = z.enum(["ASAP", "THIS_WEEK", "WHEN_POSSIBLE"]);
```

**Kopia w guest localStorage:**

```7:18:src/lib/guest/schema.ts
export const commitmentHorizonSchema = z.enum([
	"ASAP",
	"THIS_WEEK",
	"WHEN_POSSIBLE",
]);

export const guestTaskSchema = z.object({
	id: z.string().uuid(),
	title: z.string().min(1).max(256),
	status: z.enum(["active", "completed"]),
	workType: z
		.enum(["DEEP_WORK", "OPERATIONAL", "REACTIVE"])
```

Cztery niezależne miejsca utrzymują te same literały. Zmiana w `schema.prisma` wymaga ręcznej synchronizacji wszystkich kopii.

### 3.2 Przeciek przez granicę lib (domena „wie” o Prisma)

```1:5:src/lib/scoring/score-task.ts
import type {
	CommitmentHorizon,
	EnergyLevel,
	WorkType,
} from "@prisma/generated";
```

```27:30:src/lib/scoring/score-task.ts
export const TYPE_FIT: Record<EnergyLevel, Record<WorkType, number>> = {
	FOCUSED: { DEEP_WORK: 1.5, OPERATIONAL: 1.0, REACTIVE: 0.7 },
	STEADY: { DEEP_WORK: 1.1, OPERATIONAL: 1.2, REACTIVE: 1.0 },
	FADING: { DEEP_WORK: 0.6, OPERATIONAL: 1.3, REACTIVE: 1.4 },
```

Dokumentacja deklaruje ten moduł jako czystą domenę:

```14:14:context/map/repo-map.md
**Boli:** szeroki blast radius timera, bus factor (jeden autor), wyjątki od wzorców (dual tRPC w dashboardzie, guest merge przez 3 kanały, cykl w sign-in). **Bezpieczny wzorzec:** `lib/scoring` — czysta domena, tanie testy unit.
```

Kod nie dotrzymuje deklaracji — `EnergyLevel` i `WorkType` pochodzą z warstwy persystencji.

### 3.3 Przeciek na wire (surowe wiersze Prisma)

```33:37:src/server/api/routers/task.ts
	list: protectedProcedure.query(async ({ ctx }) => {
		return ctx.db.task.findMany({
			where: { userId: ctx.session.user.id },
			orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
		});
	}),
```

Router zwraca typ wygenerowany przez Prisma. Klient odbiera kształt ORM, nie `DomainTask`.

Adapter repozytorium mapuje dopiero po stronie klienta — i duplikuje kształt wiersza:

```52:68:src/lib/repositories/server-repositories.ts
type TrpcTaskRow = {
	id: number;
	userId: string;
	title: string;
	status: string;
	workType: "DEEP_WORK" | "OPERATIONAL" | "REACTIVE";
	weight: number;
	importance?: number;
	urgency?: number;
	effortMinutes?: number | null;
	commitmentHorizon?: "ASAP" | "THIS_WEEK" | "WHEN_POSSIBLE";
	sortOrder: number;
	resumeNote?: string | null;
	personaPresetId?: string | null;
	createdAt: Date;
	updatedAt: Date | null;
};
```

```122:124:src/lib/repositories/server-repositories.ts
export function createServerTaskRepository(client: TrpcClient): TaskRepository {
	return {
		list: async () => (await client.task.list.fetch()).map(toDomainTask),
```

Dashboard omija repozytorium i rzutuje typy w UI:

```451:470:src/app/_components/pomodoro-dashboard.tsx
function AuthenticatedPomodoroDashboard() {
	const [tasks] = api.task.list.useSuspenseQuery();
	const utils = api.useUtils();
	const {
		scope: onboardingScope,
		shouldShowCheckInCoach,
		shouldShowSuggestionCoach,
		markCheckInCoachSeen,
		markSuggestionCoachSeen,
	} = useOnboarding();

	const domainTasks = useMemo(
		() =>
			tasks.map((t) => ({
				...t,
				weight: t.weight as 1 | 2 | 3,
				importance: t.importance as 1 | 2 | 3,
				urgency: t.urgency as 1 | 2 | 3,
			})),
		[tasks],
	);
```

### 3.4 Kontrast — jedyny poprawny ACL (`CycleEndAudioMode`)

Domena odseparowana od Prisma; mapper dwukierunkowy:

```1:7:src/lib/cycle-audio-preference/types.ts
import type { CycleEndAudioMode as PrismaCycleEndAudioMode } from "@prisma/generated";

export type CycleEndAudioMode = "normal" | "soft" | "muted";

export const DEFAULT_CYCLE_END_AUDIO_MODE: CycleEndAudioMode = "normal";

export const cycleEndAudioModeSchema = ["normal", "soft", "muted"] as const;
```

```21:28:src/lib/cycle-audio-preference/types.ts
export function fromPrismaMode(
	mode: PrismaCycleEndAudioMode,
): CycleEndAudioMode {
	return PRISMA_TO_CLIENT[mode];
}

export function toPrismaMode(mode: CycleEndAudioMode): PrismaCycleEndAudioMode {
	return CLIENT_TO_PRISMA[mode];
}
```

Router tłumaczy na granicy — klient nigdy nie widzi `NORMAL`/`SOFT`/`MUTED`:

```17:21:src/server/api/routers/preference.ts
		return {
			cycleEndAudioMode: row
				? fromPrismaMode(row.cycleEndAudioMode)
				: DEFAULT_CYCLE_END_AUDIO_MODE,
		};
```

```30:46:src/server/api/routers/preference.ts
		.mutation(async ({ ctx, input }) => {
			const prismaMode = toPrismaMode(input.cycleEndAudioMode);

			const row = await ctx.db.userPreference.upsert({
				where: { userId: ctx.session.user.id },
				create: {
					userId: ctx.session.user.id,
					cycleEndAudioMode: prismaMode,
				},
				update: {
					cycleEndAudioMode: prismaMode,
				},
			});

			return {
				cycleEndAudioMode: fromPrismaMode(row.cycleEndAudioMode),
			};
		}),
```

`WorkType`, `EnergyLevel`, `CommitmentHorizon` nie mają analogicznego modułu — stąd przeciek w całym stosie.

### 3.5 Brak wciągnięcia serwera do bundla klienta

`@prisma/generated` w `kickoff-duration-chips.tsx:3` i hookach to **importy typów** (`import type`) — nie pakują Prisma Client do bundla przeglądarki. Ryzyko jest architektoniczne (coupling, koszt wymiany), nie runtime bundle leak. `PrismaClient` pozostaje w `src/server/db/index.ts:2` z markerem `server-only`.

---

## KROK 4 — Projekt ACL

### 4.1 Decyzje kontraktowe (na podstawie `prisma/schema.prisma`)

| Enum Prisma | Wartości | Decyzja domenowa |
|-------------|----------|------------------|
| `WorkType` | `DEEP_WORK`, `OPERATIONAL`, `REACTIVE` | **Tożsamość** — UI i `WORK_TYPE_CONFIG` już używają SCREAMING_SNAKE |
| `EnergyLevel` | `FOCUSED`, `STEADY`, `FADING` | **Tożsamość** — przyciski check-in i scoring używają tych samych stringów |
| `CommitmentHorizon` | `ASAP`, `THIS_WEEK`, `WHEN_POSSIBLE` | **Tożsamość** — już w `data-mode/types.ts` |
| `CycleEndAudioMode` | `NORMAL`, `SOFT`, `MUTED` | **Transformacja** — domena pozostaje lowercase (`"normal" \| "soft" \| "muted"`) jak dziś |

Przeciek dotyczy **pochodzenia typów**, nie kształtu wartości (poza audio). ACL nie wymusza renamingu produktowego.

### 4.2 Moduły domenowe (jedyny SSOT enumów w aplikacji)

```
src/lib/domain/
  energy-level.ts
  work-type.ts
  commitment-horizon.ts
  cycle-end-audio-mode.ts   # przeniesienie z cycle-audio-preference
  index.ts
```

**Sygnatury (pseudokod):**

```typescript
// energy-level.ts
export type EnergyLevel = "FOCUSED" | "STEADY" | "FADING";
export const energyLevelSchema = ["FOCUSED", "STEADY", "FADING"] as const;
export function parseEnergyLevel(raw: unknown): EnergyLevel | null { /* exhaustive */ }

// work-type.ts
export type WorkType = "DEEP_WORK" | "OPERATIONAL" | "REACTIVE";
export const workTypeSchema = ["DEEP_WORK", "OPERATIONAL", "REACTIVE"] as const;

// commitment-horizon.ts
export type CommitmentHorizon = "ASAP" | "THIS_WEEK" | "WHEN_POSSIBLE";
export const commitmentHorizonSchema = [...] as const;

// cycle-end-audio-mode.ts — istniejąca logika fromPrismaMode/toPrismaMode
export type CycleEndAudioMode = "normal" | "soft" | "muted";
export function fromPrismaCycleEndAudioMode(p: PrismaCycleEndAudioMode): CycleEndAudioMode;
export function toPrismaCycleEndAudioMode(d: CycleEndAudioMode): PrismaCycleEndAudioMode;
```

`data-mode/types.ts` importuje z `~/lib/domain` zamiast redefiniować unie:

```typescript
import type { WorkType, CommitmentHorizon } from "~/lib/domain";
export type DomainTask = { workType: WorkType; commitmentHorizon: CommitmentHorizon; /* ... */ };
```

### 4.3 Adapter persystencji (jedyne miejsce znające `@prisma/generated` enumy)

```
src/lib/persistence/prisma/
  enum-mappers.ts       # fromPrisma*/toPrisma* dla wszystkich enumów
  task-mapper.ts        # Prisma Task row ↔ DomainTask
  check-in-mapper.ts    # Prisma CheckIn row ↔ DomainCheckIn
  preference-mapper.ts    # UserPreference row ↔ domain DTO
  session-mapper.ts     # Session row ↔ DomainSession (absorpcja active-session leak)
```

**Pseudokod `enum-mappers.ts`:**

```typescript
import type {
  EnergyLevel as PrismaEnergyLevel,
  WorkType as PrismaWorkType,
  CommitmentHorizon as PrismaCommitmentHorizon,
} from "@prisma/generated";
import type { EnergyLevel, WorkType, CommitmentHorizon } from "~/lib/domain";

const ENERGY_FROM_PRISMA: Record<PrismaEnergyLevel, EnergyLevel> = {
  FOCUSED: "FOCUSED", STEADY: "STEADY", FADING: "FADING",
};
// Record<> wymusza compile-time exhaustiveness przy nowym wariancie w schema

export function fromPrismaEnergyLevel(v: PrismaEnergyLevel): EnergyLevel {
  return ENERGY_FROM_PRISMA[v];
}
export function toPrismaEnergyLevel(v: EnergyLevel): PrismaEnergyLevel { /* inverse */ }
// analogicznie WorkType, CommitmentHorizon (identity maps)
```

**Pseudokod `task-mapper.ts`:**

```typescript
export function mapTaskFromPrisma(row: PrismaTask): DomainTask {
  return {
    id: row.id,
    title: row.title,
    workType: fromPrismaWorkType(row.workType),
    commitmentHorizon: fromPrismaCommitmentHorizon(row.commitmentHorizon),
    // ... pozostałe pola skalarne bez zmiany semantyki
  };
}
export function mapTaskToPrismaCreate(input: CreateTaskDomainInput): Prisma.TaskCreateInput {
  return {
    title: input.title,
    workType: input.workType != null ? toPrismaWorkType(input.workType) : undefined,
    // ...
  };
}
```

### 4.4 Wąski port domenowy

Istniejące interfejsy w `src/lib/data-mode/types.ts:75-131` (`TaskRepository`, `CycleRepository`, `SessionRepository`) pozostają portem aplikacji. Po refaktorze:

- Sygnatury portów używają wyłącznie typów z `~/lib/domain` i `DomainTask` / `DomainSession`.
- `server-repositories.ts` i `guest-repositories.ts` nie definiują własnych unii stringów — importują domenę.
- Routery tRPC wołają mappery na granicy ingress/egress (jak `preference.ts` dziś), nie eksportują typów Prisma na wire.

**Otwarte pytanie:** czy `EnergyLevel` na wire check-in ma pozostać `FOCUSED|STEADY|FADING` (tożsamość z DB)?

**Rozstrzygnięcie:** tak — wartości identyczne z Prisma; decyzja zakodowana w `enum-mappers.ts` jako mapy tożsamościowe, nie w routerze. Router importuje `z.enum(energyLevelSchema)` z domeny. Gdyby kiedyś produkt wymagał etykiet user-facing innych niż DB, transformacja trafia wyłącznie do ACL (wzorzec `CycleEndAudioMode`).

### 4.5 Granica routera (kontrakt wire)

| Router | Dziś | Po ACL |
|--------|------|--------|
| `preference.ts` | ✅ mapuje | import z `~/lib/domain/cycle-end-audio-mode` |
| `task.ts` | surowe `findMany` | `rows.map(mapTaskFromPrisma)`; Zod z `workTypeSchema` |
| `check-in.ts` | surowe `create`/`findMany` | `energyLevelSchema`; mapowanie odpowiedzi |
| `suggestion.ts` | `EnergyLevel` z Prisma | `EnergyLevel` z domeny; scoring context z typów domenowych |

`ctx.db` zostaje w routerach — ACL na granicy typów/wartości, zgodnie z obecną architekturą T3. Pełne repozytoria serwerowe (`CheckInRepository`) to Path A, poza tym slice'em.

---

## KROK 5 — Dowód izolacji + before/after

### 5.1 Wymiana biblioteki dotyka tylko adaptera

Po Phase 7c zmiana ORM / kształtu enumów w DB wymaga edycji wyłącznie:

| Plik | Rola przy wymianie |
|------|-------------------|
| `src/server/db/index.ts` | Bootstrap klienta |
| `src/lib/persistence/prisma/enum-mappers.ts` | Mapowanie enumów |
| `src/lib/persistence/prisma/*-mapper.ts` | Mapowanie wierszy modeli |
| `prisma/schema.prisma` + migracje | SSOT schematu |

**Nie dotknięte przy wymianie ORM:** `score-task.ts`, `narrative-builder.ts`, `kickoff-duration-chips.tsx`, `use-pomodoro-cycle.ts`, testy unit scoringu, komponenty UI — o ile importują `~/lib/domain`.

### 5.2 Before / after — zduplikowane miejsca

**`score-task.ts`**

```typescript
// BEFORE (src/lib/scoring/score-task.ts:1-5)
import type { CommitmentHorizon, EnergyLevel, WorkType } from "@prisma/generated";

// AFTER
import type { CommitmentHorizon, EnergyLevel, WorkType } from "~/lib/domain";
// TYPE_FIT, ScoringContext — logika bez zmian
```

**`kickoff-duration-chips.tsx`**

```typescript
// BEFORE (src/app/_components/kickoff-duration-chips.tsx:3)
import type { WorkType } from "@prisma/generated";

// AFTER
import type { WorkType } from "~/lib/domain/work-type";
```

**`task` router `list`**

```typescript
// BEFORE (src/server/api/routers/task.ts:33-37)
return ctx.db.task.findMany({ where: { userId }, orderBy: [...] });

// AFTER
const rows = await ctx.db.task.findMany({ where: { userId }, orderBy: [...] });
return rows.map(mapTaskFromPrisma);
```

**UI dostaje dane domenowe**

```typescript
// BEFORE — dashboard (pomodoro-dashboard.tsx:452-470)
const [tasks] = api.task.list.useSuspenseQuery();
const domainTasks = tasks.map(t => ({ ...t, weight: t.weight as 1|2|3, ... }));

// AFTER — Path C (useDomainTasks)
const { tasks: domainTasks } = useDomainTasks("authenticated");
// domainTasks: DomainTask[] — bez castów, bez RouterOutputs["task"]["list"]
```

---

## KROK 6 — Weryfikacja i plan faz

### 6.1 Kryterium sukcesu (grep)

```powershell
rg "@prisma/generated" src --glob "!**/persistence/prisma/**" --glob "!**/server/db/**"
# oczekiwany wynik: 0 dopasowań w plikach produkcyjnych
```

### 6.2 Pliki znające zależność — dziś vs po refaktorze

| Plik | Dziś | Po refaktorze |
|------|------|---------------|
| `src/lib/scoring/score-task.ts` | ✅ zna | ❌ → `~/lib/domain` |
| `src/lib/duration-bounds.ts` | ✅ | ❌ |
| `src/lib/work-type-duration-storage.ts` | ✅ | ❌ |
| `src/lib/session/narrative-*.ts`, `wind-down-nudge.ts` | ✅ | ❌ |
| `src/hooks/use-pomodoro-cycle.ts` | ✅ | ❌ |
| `src/app/_components/kickoff-duration-chips.tsx` | ✅ | ❌ |
| `src/server/api/routers/suggestion.ts` | ✅ | ❌ |
| `src/lib/cycle-audio-preference/types.ts` | ✅ | ❌ (shim → usunięty) |
| `src/server/api/lib/active-session.ts` | ✅ (`Session`) | ❌ → `session-mapper` |
| `src/server/api/lib/import-guest-snapshot.ts` | ✅ (`PrismaClient`) | opcjonalnie barrel w persistence |
| `src/server/db/index.ts` | ✅ | ✅ (infra) |
| `src/lib/persistence/prisma/*.ts` | — | ✅ (nowe) |
| `src/server/api/routers/preference.test.ts` | ✅ | ❌ (mock przez mapper/DTO) |

**Bilans:** 14 importerów produkcyjnych → 2 infra + ~4–5 mapperów.

### 6.3 Plan faz (zgodny z `data-mode-acl-hardening` / K2)

Child change: `data-mode-acl-hardening` na `features/data-mode-acl-hardening`. Kolejność względem parent rollout (`refactor-opportunities/plan.md`):

```
F-07 merged → Phase 5 (char data-mode) → Phase 5e (ACL mechanism)
  → Phase 6 (K1 hook extracts) → Phase 7a (router enforcement)
  → Phase 7b (Path C useDomainTasks) → Phase 7c (consumer sweep)
```

| Faza | Zakres | Commit discipline |
|------|--------|-------------------|
| **5** | `data-mode-context.test.tsx` char | Bez zmian prod (istniejący plan K2) |
| **5e** | `src/lib/domain/*` + `src/lib/persistence/prisma/*` + testy mapperów | Mechanism only — konsumenci bez zmian |
| **6** | K1 pure extracts (`cycle-end-time`, `cycle-kind`) | Parent plan — bez kolizji z 5e |
| **7a** | `task.ts`, `check-in.ts`, `suggestion.ts`, `preference.ts` import paths | Enforcement — osobny commit od 5e |
| **7b** | `useDomainTasks(mode)`, dashboard unified read | Path C z parent plan |
| **7c** | sweep: scoring, session, hooks, UI, `data-mode/types`, repos | grep = 0 poza adapterem |
| **7d** | `active-session.ts`, `import-guest-snapshot.ts` → persistence | Opcjonalny follow-up w tym samym PR |

**Bramki weryfikacji per faza:**

```powershell
pnpm exec vitest run src/lib/domain
pnpm exec vitest run src/lib/persistence/prisma
pnpm exec vitest run src/lib/data-mode/data-mode-context.test.tsx
pnpm test
pnpm check
```

Manual: task CRUD auth, check-in energy round-trip, kickoff chips, audio preference, guest task z `workType`.

### 6.4 Poza zakresem tego slice'u

- Path A: `CheckInRepository` / `SuggestionRepository` w data-mode (po F-07)
- K3 konsolidacja guest merge
- ACL dla `SessionState`, `CycleKind` (hook już ma lokalne unie)
- Oś E (tRPC bypass) — częściowo rozwiązana przez Path C, nie przez enum ACL

---

## Podsumowanie

Przeciek numer jeden w FlowState to `@prisma/generated`: czternaście plików produkcyjnych w czterech warstwach importuje enumy i typy ORM, podczas gdy dokumentacja wskazuje `lib/scoring` jako czystą domenę i `data-mode` jako obowiązkowy port guest/auth. Jedyny poprawny wzorzec ACL — `CycleEndAudioMode` w `cycle-audio-preference` z mapperami w `preference.ts` — nie został uogólniony na `WorkType`, `EnergyLevel` i `CommitmentHorizon`, co prowadzi do czterech niezależnych kopii tych samych literałów w Prisma, data-mode, routerach Zod i guest schema. Router `task.list` zwraca surowe wiersze Prisma, a dashboard rzutuje je w UI zamiast otrzymywać `DomainTask`. Projekt ACL zakłada moduł `src/lib/domain/` jako SSOT enumów oraz `src/lib/persistence/prisma/` jako jedyne miejsce mapowania z/do Prisma, z routerami tłumaczącymi na granicy wire jak `preference.ts`. Po Phase 7c `rg "@prisma/generated" src` (z wyłączeniem `server/db` i `persistence/prisma`) zwraca zero — wymiana ORM lub zmiana enumów dotyka wyłącznie adaptera i schematu, nie scoringu, API kontraktów ani UI. Rollout wpisuje się w child change `data-mode-acl-hardening` między char testem data-mode (Phase 5) a Path C `useDomainTasks` (Phase 7), z osobnymi commitami mechanism vs enforcement zgodnie z dyscypliną parent planu.
