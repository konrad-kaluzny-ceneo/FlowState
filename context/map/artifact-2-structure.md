# Artifact 2 — Struktura (dependency-cruiser)

Mapa zależności, granic warstw i ryzyk testowalności w FlowState na podstawie analizy grafu importów.
Wygenerowano: 2026-06-12.
Wejście: [artifact-1-territory.md](./artifact-1-territory.md).

## Metodologia

| Parametr | Wartość |
|----------|---------|
| Narzędzie | dependency-cruiser 17.4.3 |
| Konfiguracja | `.dependency-cruiser.cjs` |
| Zakres analizy | `src/` (231 modułów, 677 zależności) |
| Skupienie | TOP moduły z mapy terytorium |
| Metryki | `--metrics`, `--focus`, `--focus-depth`, `--reaches`, `--include-only` |
| Wizualizacja | Graphviz 15.0.0 → `reports/timer-hub.svg` |

### Komendy projektu

```bash
pnpm depcruise              # walidacja reguł na src/
pnpm depcruise:graph        # Mermaid → reports/dependency-graph.mmd
pnpm depcruise:archi      # archi DOT → reports/dependency-archi.dot
pnpm depcruise:report       # HTML → reports/dependency-report.html
```

---

## 1. Konfiguracja narzędzia

Plik `.dependency-cruiser.cjs` (CommonJS, bo `"type": "module"` w `package.json`):

| Reguła | Severity | Cel |
|--------|----------|-----|
| `no-circular` | warn | Cykle importów |
| `no-orphans` | warn | Sieroty (z wyjątkami Next.js, `src/test/`) |
| `not-to-unresolvable` / `no-non-package-json` | error | Nierozwiązywalne importy |
| `not-to-test` / `not-to-spec` | error | Produkcja → pliki testowe |
| `not-to-dev-dep` | error | `src/` → devDependencies (wyjątek: `test-utils/`, `test/`) |
| `server-not-to-app-ui` | warn | `src/server` → `src/app/_components` |
| `lib-not-to-server-runtime` | warn | `src/lib` → runtime serwera (type-only OK) |

Opcje: `tsConfig` (alias `~/`), `tsPreCompilationDeps: true`, `moduleSystems: ['cjs', 'es6']`.

**Pierwszy przebieg po konfiguracji:** 1 ostrzeżenie (`no-circular` w auth/sign-in), 0 błędów.

---

## 2. Cykle zależności (gorące obszary)

Skan: `pnpm exec depcruise src` + `--include-only` per moduł z artifact-1.

### Wniosek główny

**Dokładnie 1 cykl** w całym `src/`. Rdzeń Pomodoro (`hooks`, `_components`, `routers`, `lib/scoring`, `lib/guest`, `lib/repositories`) jest **acykliczny**.

### Jedyny cykl

```
src/app/auth/sign-in/action.ts → sign-in-form.tsx → action.ts
```

- Krawędź `action → form` to `import type { SignInFormState }` (type-only).
- Pozostałe ścieżki auth (`sign-up`, `reset-password`, `forgot-password`) trzymają typy w `schema.ts` — sign-in odstaje od wzorca.
- **Fix:** wydzielić `sign-in/schema.ts` (jak w sign-up).

| Obszar (artifact-1) | Cykle | Dotknięć |
|---------------------|-------|----------|
| `src/app/_components` | 0 | 154 |
| `src/hooks` | 0 | 124 |
| `src/server/api/routers` | 0 | 121 |
| `src/app/auth` | **1** | 52 |
| `src/lib/scoring` | 0 | 27 |
| `src/lib/guest` | 0 | 23 |
| `src/lib/repositories` | 0 | 29 |

---

## 3. Granice warstw

Skan reguł + grep importów `~/server` w gorących obszarach.

### Wniosek główny

Frontend w najaktywniejszych miejscach **respektuje granice warstw**. Brak importów `~/server/db` ani `~/server/api/routers` z `_components` lub `hooks`.

### Wyniki per granica

| Granica | Wynik | Dowód |
|---------|-------|-------|
| `server` → `_components` | OK | 0 naruszeń `server-not-to-app-ui` |
| `lib` → `server` (runtime) | OK | Tylko `import type { AppRouter }` w `lib/trpc/suggestion-priority-link.ts` |
| `hooks` → `server` | OK | Wyłącznie `~/trpc/react` |
| `_components` → `server` | OK | 0 bezpośrednich importów |
| `_components` → `hooks` → `lib` | OK | Jednokierunkowy; brak `hooks` → `_components` |
| `server` → `lib/scoring` | OK | Domain w `lib`, router orkiestruje |

### Wyjątki i zastrzeżenia

| Miejsce | Opis | Ryzyko przy zmianie |
|---------|------|---------------------|
| `pomodoro-dashboard.tsx` | Bezpośredni `api.task.list` **obok** `usePomodoroCycle` | Dwa wejścia do tRPC w jednym komponencie |
| `guest-import-on-mount.tsx` | Server action + tRPC + `guest/store` | Trzy kanały persystencji w jednym flow |
| `app/_actions/import-guest-snapshot.ts` | Importuje `~/server/db` i `~/server/api/lib` | Celowy wzorzec Next.js; sync z routerem `guest` |

---

## 4. Ryzyka testowalności

Metryki fan-in/fan-out + analiza istniejących testów w gorących obszarach.

### Dwa ekstremy

| Typ | Moduł | Metryki | Test |
|-----|-------|---------|------|
| Łatwy | `lib/scoring/score-task.ts` | 1 out / 8 in | `score-task.test.ts`, property-based |
| Trudny | `use-pomodoro-cycle.ts` | 18 out / 9 in | `use-pomodoro-cycle.test.tsx` (~2700 linii mocków) |

### Hubi globalnego stanu

| Moduł | Fan-in | Efekt |
|-------|--------|-------|
| `server/api/trpc.ts` | 25 dependents | Każdy test routera mockuje auth + db |
| `lib/data-mode/types.ts` | 18 dependents | Wspólne typy — zmiana = kaskada |
| `lib/guest/store.ts` | 11 dependents | localStorage; `--reaches` → 50+ krawędzi |
| `lib/data-mode/data-mode-context.tsx` | 6 dependents | Most guest↔server; brak dedykowanego testu |

### Rekomendacje poziomów testów

| Moduł | Poziom | Uzasadnienie |
|-------|--------|--------------|
| `use-pomodoro-cycle.ts` | Integracyjny + E2E | Worker + tRPC + storage + repos |
| `pomodoro-dashboard.tsx` | Smoke unit + E2E | 21 importów; test stubuje hook i TaskList |
| `task-list.tsx` | Unit (mock DnD + mutations) | Wzór: `task-list.test.tsx` |
| `lib/scoring/*` | Unit | Czysta logika domenowa |
| `server/api/routers/cycle.ts` | Integracyjny (mock DB) | `cycle.test.ts`, `cycle-isolation.test.ts` |
| `guest-import-on-mount.tsx` | Unit (5+ mocków) + E2E | `guest-merge-on-sign-in.spec.ts` |
| `home-shell.tsx` | Smoke unit + E2E smoke | Kompozycja root — wszystkie dzieci stubowane |

Mapa terytorium potwierdza strategię: **33% commitów hooks w parze z e2e/specs** — E2E jest naturalnym poziomem dla pełnych ścieżek Pomodoro, nie „obejściem”.

---

## 5. Graf — blast radius timera

**Pytanie:** Jaki jest zasięg zmiany w hubie `use-pomodoro-cycle.ts`?

**Pliki:** `reports/timer-hub.svg`, `reports/timer-hub.dot`

```powershell
pnpm exec depcruise src `
  --focus "^src/hooks/use-pomodoro-cycle" `
  --focus-depth 2 `
  --highlight "^src/hooks/use-pomodoro-cycle" `
  --include-only "^src" `
  -x "(node_modules|generated|\.test\.|\.spec\.)" `
  -T dot -f reports/timer-hub.dot

& "C:\Program Files\Graphviz\bin\dot.exe" -T svg reports/timer-hub.dot -o reports/timer-hub.svg
```

### Fan-in (7 modułów → hook)

`pomodoro-dashboard`, `timer-panel`, `cycle-complete-overlay`, `mid-cycle-completion-prompt`, `tab-return-catchup`, `guest-import-on-mount`, `use-e2e-expose-cycle-recovery`

### Fan-out (18 zależności ← hook)

| Kategoria | Moduły |
|-----------|--------|
| Infrastruktura | `trpc/react`, `timer-worker-logic`, `data-mode-context` |
| Persystencja | `guest/store`, `duration-storage`, `work-type-duration-storage` |
| Domena | `wind-down-nudge`, `rationale-breakdown`, `suggestion-priority`, `catch-up/*`, `audio`, `cycle-end-tab-pulse` |

---

## 6. TOP obserwacje (synteza)

1. **Architektura warstwowa jest zdrowa** w rdzeniu produktu — cykle i naruszenia granic to wyjątki (auth), nie systemowy problem.
2. **Sprzężenie z git ≠ sprzężenie w kodzie** — `components ↔ hooks ↔ routers` często zmieniają się razem (35–50% commitów), ale graf importów jest acykliczny i jednokierunkowy.
3. **Koszt testowania koncentruje się w jednym hubie** — `use-pomodoro-cycle.ts` (#1 plik, 56 commitów) ciągnie 18 modułów; reszta ekosystemu jest testowalna taniej.
4. **Dual path do tRPC** w `pomodoro-dashboard` i `guest-import-on-mount` to główne „zaskoczenia” przy refaktorze — nie łamią reguł, ale mnożą punkty mockowania.
5. **`lib/scoring` to wzorzec do naśladowania** — domain w `lib`, cienkie routery, czyste testy jednostkowe.

---

## 7. Dług strukturalny — priorytety

| Priorytet | Dług | Akcja |
|-----------|------|-------|
| P2 | Cykl `sign-in/action ↔ sign-in-form` | Wydziel `sign-in/schema.ts` |
| P2 | Dual `api` w `pomodoro-dashboard` | Przenieś `task.list` do hooka / `use-domain-tasks` |
| P3 | Brak testu `data-mode-context.tsx` | Test integracyjny z mock `api.useUtils` |
| P3 | `server-repositories.ts` orphan w wąskim skanie | Potwierdzić użycie; ewentualnie test repozytorium |
| P4 | `depcruise` poza CI | Rozważyć gate w `ci.yml` po baseline znanych warnów |

---

## 8. Kolejne kroki

```bash
# Blast radius po zmianie od main
pnpm exec depcruise src --affected -T text

# Metryki fan-in/out gorących modułów
pnpm exec depcruise src --metrics --output-type json > reports/metrics.json

# Cykle po fixie sign-in
pnpm exec depcruise src --include-only "^src/app/auth" -T err-long

# Baseline znanych ostrzeżeń (opcjonalnie)
pnpm exec depcruise-baseline
```

---

## Powiązania

| Artifact | Relacja |
|----------|---------|
| [artifact-1-territory.md](./artifact-1-territory.md) | Priorytetyzacja obszarów (aktywność git) |
| `.dependency-cruiser.cjs` | Reguły walidacji — utrzymywać przy zmianach architektury |
| `reports/timer-hub.svg` | Wizualizacja blast radius huba timera |
| `context/foundation/test-plan.md` | Strategia testów — sekcja ryzyk pokrywa fan-out huba |
