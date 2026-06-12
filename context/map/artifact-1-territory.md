# Artifact 1 — Terytorium (historia gita)

Mapa aktywności i sprzężeń w FlowState na podstawie analizy historii gita.
Wygenerowano: 2026-06-12.

## Metodologia

| Parametr | Wartość |
|----------|---------|
| Okno czasowe | Ostatnie 12 miesięcy (`--since=2025-06-12`) |
| Commity łącznie | 506 |
| Metryka | Liczba commitów, w których plik/moduł pojawił się w diff (`A/C/M/R`) |
| Commity z ≥2 modułami | 453 |

### Filtr szumu (wykluczone z liczenia)

Lockfile (`pnpm-lock.yaml`), `package.json`, configi (Biome, TS, Playwright, Vitest, Next, lefthook), `.env*`, `.gitignore`, `context/` (plany/roadmapa), `AGENTS.md` / `README` / `DESIGN`, `prisma/` (schema + migracje + generated), `.github/`, `.cursor/`, `.vscode/`, `.kiro/`, snapshoty, `drizzle/`, `e2e/.auth/`, `scripts/agent-hooks/`.

### Normalizacja modułów

| Ścieżka | Klucz modułu |
|---------|--------------|
| `src/app/_components/*` | `src/app/_components` |
| `src/server/api/routers/*` | `src/server/api/routers` |
| `src/server/api/*` (poza routers) | `src/server/api (infra)` |
| `src/hooks/*` | `src/hooks` |
| `src/lib/<name>/*` | `src/lib/<name>` |
| `src/app/auth/*` | `src/app/auth` |
| `e2e/helpers/*` | `e2e/helpers` |
| `e2e/*.spec.ts` | `e2e/specs` |
| pozostałe `e2e/*` | `e2e/infra` |

Po filtrze: **998 dotknięć plików** w commitach.

---

## 1. Aktywność — TOP 10

### a) Moduły / foldery

| # | Moduł | Dotknięć | Udział | Charakter |
|---|--------|----------|--------|-----------|
| 1 | `src/app/_components` | 154 | 15,4% | UI produktu: dashboard, lista zadań, timer, overlaye |
| 2 | `e2e/specs` | 131 | 13,1% | Testy przeglądarkowe (Playwright) |
| 3 | `src/hooks` | 124 | 12,4% | Logika kliencka — głównie cykl Pomodoro |
| 4 | `src/server/api/routers` | 121 | 12,1% | tRPC: cycle, task, suggestion, guest, session |
| 5 | `e2e/helpers` | 80 | 8,0% | Helpery E2E |
| 6 | `src/app/auth` | 52 | 5,2% | Strony/logika auth (Neon Auth) |
| 7 | `src/lib/repositories` | 29 | 2,9% | Persystencja (guest + server repos) |
| 8 | `src/lib/scoring` | 27 | 2,7% | Algorytm sugestii zadań |
| 9 | `src/server/api (infra)` | 27 | 2,7% | `root.ts`, setup tRPC |
| 10 | `src/lib/guest` | 23 | 2,3% | Tryb gościa, import danych, trial |

**Wzorzec:** ~50% aktywności to cykl Pomodoro + zadania (UI + hooki + routery); ~21% to E2E.

#### Drill-down w TOP modułach

- **`src/app/_components`:** `pomodoro-dashboard.tsx` (29), `task-list.tsx` (26), `timer-panel.tsx` (14)
- **`src/server/api/routers`:** `cycle.ts` (15), `task.ts` / `suggestion.ts` (po 9), testy cycle/suggestion/guest
- **`src/hooks`:** `use-pomodoro-cycle.ts` (56) + test (31); dalej `use-task-mutations.ts` (10)
- **`e2e/specs`:** `pomodoro-cycle.spec.ts` (17), potem onboarding/guest/reorder/suggestion (po 9)

### b) Pliki

| # | Plik | Commity | Obszar |
|---|------|---------|--------|
| 1 | `src/hooks/use-pomodoro-cycle.ts` | 56 | Serce timera |
| 2 | `src/hooks/use-pomodoro-cycle.test.tsx` | 31 | Testy jednostkowe timera |
| 3 | `src/app/_components/pomodoro-dashboard.tsx` | 29 | Główny widok sesji |
| 4 | `src/app/_components/task-list.tsx` | 26 | Lista zadań |
| 5 | `e2e/helpers/work-cycle.ts` | 20 | Helper E2E cyklu |
| 6 | `e2e/pomodoro-cycle.spec.ts` | 17 | E2E ścieżki cyklu |
| 7 | `src/server/api/routers/cycle.ts` | 15 | API cyklu Pomodoro |
| 8 | `src/app/_components/timer-panel.tsx` | 14 | Panel timera |
| 9 | `src/server/api/routers/cycle.test.ts` | 13 | Testy routera cycle |
| 10 | `e2e/helpers/suggestion.ts` | 12 | Helper E2E sugestii |

---

## 2. Ewolucja w czasie

### Uwaga o zakresie

W oknie „12 miesięcy” **cała historia commitów mieści się w ~3 tygodniach** (23 maj → 12 cze 2026). Kwartały kalendarzowe 2025-Q3–2026-Q1 mają **0 commitów**; całość w **2026-Q2**.

| Kwartał | Commity |
|---------|---------|
| 2025-Q3 – 2026-Q1 | 0 |
| 2026-Q2 | 506 |

### Maj vs czerwiec

| Moduł | Maj (136 cmt) | Czerwiec (370 cmt) | Trend |
|-------|---------------|---------------------|-------|
| routers | 18,4% | 9,2% | ↓ |
| auth | 11,1% | 2,5% | ↓ |
| other (infra) | 32,6% | 7,2% | ↓ |
| components | 13,0% | 16,6% | ↑ |
| hooks | 6,6% | 15,1% | ↑↑ |
| lib | 15,5% | 19,8% | ↑ |
| e2e-specs | 2,5% | 18,0% | ↑↑↑ |
| e2e-helpers | 0,3% | 11,6% | ↑↑↑ |

### Tydzień po tygodniu

| Tydzień | Commity | Dominujące moduły | Charakter |
|---------|---------|-------------------|-----------|
| W21 (23–25.V) | 53 | other 50%, auth 19%, routers 14% | Scaffold: DB, tRPC, auth |
| W22 (26.05–01.VI) | 83 | lib 24%, routers 21%, components 18% | Core MVP: cycle API, task-list, timer hook |
| W23 (02–08.VI) | 263 | lib 23%, hooks 18%, e2e-specs 17% | Szczyt: timer, scoring, guest, eksplozja E2E |
| W24 (09–12.VI) | 107 | components 25%, e2e-specs 21%, e2e-helpers 15% | Stabilizacja UI + helpery E2E |

**Narracja:** fundament → MVP → feature-complete + E2E belt → polish.

---

## 3. Sprzężenia — współzmiany w commitach

### TOP pary (globalnie)

| # | Para | Commity |
|---|------|---------|
| 1 | `src/app/_components` + `src/hooks` | **35** |
| 2 | `e2e/helpers` + `e2e/specs` | 31 |
| 3 | `e2e/specs` + `src/hooks` | 27 |
| 4 | `src/hooks` + `src/server/api/routers` | 21 |
| 5 | `src/app/_components` + `src/server/api/routers` | 19 |
| 6 | `e2e/helpers` + `src/hooks` | 19 |

### TOP trójki (globalnie)

| # | Trójka | Commity |
|---|--------|---------|
| 1 | `e2e/helpers` + `e2e/specs` + `src/hooks` | **13** |
| 2 | `e2e/specs` + `src/app/_components` + `src/hooks` | **12** |
| 3 | `src/app/_components` + `src/hooks` + `src/server/api/routers` | 10 |
| 4 | `src/lib/data-mode` + `src/lib/repositories` + `routers` | 9 |

### Wnioski dla TOP 3 modułów z rankingu

#### `src/app/_components` (70 commitów z modułem)

| Partner | Wspólne commity | Udział |
|---------|-----------------|--------|
| `src/hooks` | 35 | **50%** |
| `src/server/api/routers` | 19 | 27% |
| `e2e/specs` | 15 | 21% |

Tylko **23%** commitów solo. Dominuje pionowy slice: komponent + hook + router.

#### `e2e/specs` (66 commitów)

| Partner | Wspólne commity | Udział |
|---------|-----------------|--------|
| `e2e/helpers` | 31 | **47%** |
| `src/hooks` | 27 | **41%** |
| `src/app/_components` | 15 | 23% |

Specy prawie zawsze idą z helperami; silne sprzężenie z hookami (timer w przeglądarce).

#### `src/hooks` (82 commitów)

| Partner | Wspólne commity | Udział |
|---------|-----------------|--------|
| `src/app/_components` | 35 | **43%** |
| `e2e/specs` | 27 | 33% |
| `src/server/api/routers` | 21 | 26% |

Najbardziej sprzężony moduł — **tylko 11%** commitów solo. `use-pomodoro-cycle` to hub grawitacji.

### Wzorce pracy

1. **Feature slice** — `components ↔ hooks ↔ routers` (core produktu)
2. **E2E harness** — `e2e/specs ↔ e2e/helpers`
3. **End-to-end proof** — wszystkie trzy TOP-3 moduły razem (**12 commitów**)

**Implikacja:** refaktor timera/UI wymaga planowania pod 4 katalogi (hooks, components, routers, e2e).

---

## 4. Wspólny mianownik — plik łączący wiele obszarów

### Brak klasycznego huba (i18n, generated client)

W repo nie ma pliku tłumaczeń ani centralnego artefaktu generowanego stale obecnego w commitach cross-cutting.

### Najszerszy zasięg modułów (inne moduły w tym samym commicie)

| Plik | Inne moduły | Commity | Charakter |
|------|-------------|---------|-----------|
| `task-list.tsx` | **9** | 26 | Hub feature'u „zadania” |
| `src/env.js` | **9** | 7 | Najbliżej repo-wide infra |
| `use-pomodoro-cycle.ts` | 8 | 56 | Hub timera (częsty) |
| `pomodoro-dashboard.tsx` | 8 | 29 | UI timera |
| `e2e/fixtures.ts` | 7 | 5 | Infra testów E2E |
| `src/lib/data-mode/types.ts` | 6 | **12** | Wspólne typy domenowe |
| `src/server/api/root.ts` | 6 | 6 | Rejestr routerów tRPC |

### Kandydaci infra-hub

1. **`src/env.js`** — jedyny plik infra z zasięgiem 9/9 kategorii modułów; rzadko (7 commitów), przy nowych zmiennych env.
2. **`src/lib/data-mode/types.ts`** — 6 modułów, 12 commitów; częstszy, mniejszy zasięg.
3. **`src/server/api/root.ts`** — rejestracja routerów; 6 modułów, 6 commitów.
4. **`e2e/fixtures.ts`** — hub testowy; 7 modułów, 5 commitów.

**Wniosek:** dwa wzorce — **infra-hub** (rzadko, szeroko) vs **feature-hub** (często, w obrębie slice'a).

---

## 5. Weryfikacja istnienia plików

### Rdzeń sprzężeń — wszystko na miejscu (2026-06-12)

Wszystkie pliki z TOP rankingu i głównego trójkąta sprzężeń (`components ↔ hooks ↔ e2e-specs`) **istnieją na dysku**.

### Pliki z historii już nieobecne

**28 z 251** unikalnych plików `src/` + `e2e/` w oknie (~11%) — usunięte lub przeniesione.

| Plik (był w statystykach) | Commity | Status |
|---------------------------|---------|--------|
| `e2e/first-run-onboarding.spec.ts` | 10 | Usunięty 2026-06-11 (`6ed9bda`) |
| `e2e/task-reorder.spec.ts` | 10 | Usunięty 2026-06-11 (`6ed9bda`) |
| `e2e/persistence-reload.spec.ts` | 7 | Usunięty 2026-06-07 |
| `src/server/db/schema.ts` | 6 | Usunięty 2026-05-25 (Drizzle → Prisma) |

**Masowe czyszczenie E2E** (`6ed9bda`, 11 cze): usunięto m.in. `task-reorder`, `first-run-onboarding`, `quiet-cycle-audio`, `guest-*` specs — scenariusze prawdopodobnie wchłonięte przez `smoke.spec.ts`, `seed.spec.ts`, `mindful-session-wind-down.spec.ts`.

Wczesny scaffold (nie wpływa na obecne sprzężenia TOP-3): `post.ts`, `middleware.ts`, `auth.setup.ts`, `global.setup.ts`.

**Refaktor lib:** `src/lib/scoring/adaptive-score.ts` nie istnieje — scoring w `score-task.ts`, `dominant-factor.ts`, `rationale.ts`.

### Rekomendacja na przyszłe analizy

- Filtrować od ostatniej dużej konsolidacji (np. po `6ed9bda`), albo
- Wykluczać pliki z `diff-filter=D` w historii, albo
- Grupować po katalogu + `git log --follow` przy refaktorach nazw.

---

## 6. Podsumowanie operacyjne

| Obszar | Werdykt |
|--------|---------|
| Epicentrum produktu | Cykl Pomodoro: `use-pomodoro-cycle` + dashboard + `cycle` router |
| Drugi klaster | Zadania i sugestie: `task-list`, `task.ts`, `suggestion.ts`, scoring |
| Testy | First-class: ~21% aktywności modułowej to E2E |
| Wzorzec dostawy | Vertical slice — nie wspólny config, lecz sprzężone katalogi |
| Ryzyko analizy historycznej | 11% plików z okna już nie istnieje; głównie E2E sprzed 11 cze |

**Hotspoty na przyszłe zmiany:** `src/hooks/use-pomodoro-cycle.ts`, `src/app/_components/{pomodoro-dashboard,task-list,timer-panel}.tsx`, `src/server/api/routers/cycle.ts`, `e2e/pomodoro-cycle.spec.ts`, `e2e/helpers/work-cycle.ts`.
