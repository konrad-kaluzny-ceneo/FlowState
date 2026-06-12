# Artifact 3 — Kontrybutorzy (git + mapa supportu)

Kto zaoferuje wiedzę domenową w gorących obszarach FlowState — na podstawie historii gita i map strukturalnych.
Wygenerowano: 2026-06-12.

Wejście:
- [artifact-1-territory.md](./artifact-1-territory.md) — aktywność i sprzężenia
- [artifact-2-structure.md](./artifact-2-structure.md) — cykle, granice warstw, ryzyka testowe

---

## Metodologia

| Parametr | Wartość |
|----------|---------|
| Okno czasowe | Ostatnie 12 miesięcy (`--since=2025-06-12`) |
| Commity łącznie (bez merge) | 468 |
| Źródło | `git log`, `git shortlog`, analiza ścieżek per obszar |
| Normalizacja autorów | Wszystkie tożsamości git → jeden autor ludzki |

### Filtr autorów

| Wykluczone | Uzasadnienie |
|------------|--------------|
| Boty (`dependabot`, `github-actions` itd.) | Brak commitów od botów jako `Author` |
| Commity bez wyraźnego autorstwa człowieka | W repo każdy commit ma ludzkiego `Author` |

**Uwaga o agentach AI:** W treści ~273 commitów występuje `Co-authored-by: Cursor <cursoragent@cursor.com>`, sporadycznie Claude (~18). To asysta przy zachowanym autorstwie człowieka — **nie tworzy osobnych kontrybutorów** w statystykach poniżej.

### Korekta tożsamości git

Konto `szielinska15` (15 commitów, 4–9 cze 2026) to **błędna konfiguracja git** na maszynie autora — nie osobny kontrybutor. Wszystkie commity realizował **Konrad Zieliński** (`konrad.kaluzny@ceneo.pl`, konto GitHub `konrad-kaluzny-ceneo`).

| Tożsamość git | Commity | Uwagi |
|---------------|---------|-------|
| `Konrad Zieliński` | 341 | Główna tożsamość (maj–czerwiec 2026) |
| `konrad-kaluzny-ceneo` | 112 | Wczesny scaffold + auth (23–31 maj) |
| `szielinska15` | 15 | Ten sam autor — błędne `user.name` / `user.email` |
| **Razem (znormalizowane)** | **468** | **100% = Konrad Zieliński** |

**Rekomendacja:** Ujednolicić `git config` na `Konrad Zieliński` + `konrad.kaluzny@ceneo.pl` (lub GitHub noreply), żeby przyszłe mapy nie tworzyły fałszywych „drugich kontrybutorów”.

---

## 1. TOP 5 obszarów wymagających kontaktu z kontrybutorem

Obszary wybrane na podstawie artifact-1 (aktywność, sprzężenia) i artifact-2 (blast radius, wyjątki architektoniczne, koszt testów).

| # | Obszar | Dlaczego kontakt | Artifact-1 | Artifact-2 |
|---|--------|------------------|------------|------------|
| 1 | **Hub timera** — `use-pomodoro-cycle` + vertical slice UI/API/E2E | 18 zależności, 9 dependents; test ~2700 linii; tylko 11% commitów solo w `hooks` | #1 plik (56 cmt); trójka components+hooks+e2e (12 cmt) | `timer-hub.svg`; fan-out 18 modułów |
| 2 | **Guest merge** — `lib/guest` + `data-mode` + repozytoria | 3 kanały persystencji (action, tRPC, localStorage); 11 fan-in na `guest/store` | Trójka data-mode+repos+routers (9 cmt); szczyt W23 | Brak testu `data-mode-context` |
| 3 | **Pas E2E** — `e2e/specs` + `e2e/helpers` | Konsolidacja speców 11 cze; 28 plików z historii już nie istnieje | #2 moduł (131 dotknięć); 33% hooks w parze z e2e | E2E jako naturalny poziom dla flow Pomodoro |
| 4 | **Scoring / sugestie** — `lib/scoring` + router `suggestion` | Reguły biznesowe PRD; 8 dependents na `score-task` | Drugi klaster produktowy | Czyste testy unit; semantyka w głowie autora |
| 5 | **Auth** — Neon Auth + anomalia sign-in | Scaffold W21; jedyny cykl importów w repo | 52 dotknięcia; trend spadkowy po maju | `sign-in/action ↔ sign-in-form` |

---

## 2. Kontrybutor znormalizowany

### Konrad Zieliński

| Pole | Wartość |
|------|---------|
| Email | `konrad.kaluzny@ceneo.pl` |
| GitHub | `konrad-kaluzny-ceneo` |
| Udział | **100%** commitów (468 / 468) |
| Asysta agenta | ~273 commitów z `Co-authored-by: Cursor` |
| Charakter repo | Solo-maintained; brak innych ludzkich autorów w oknie 12 miesięcy |

**Wniosek operacyjny:** Kontakt z kontrybutorem we wszystkich 5 obszarach = kontakt z **Konradem**. Rozróżnienie dotyczy **fazy** pracy (scaffold maj vs szczyt timera W23 vs E2E czerwiec), nie osoby.

---

## 3. Aktywność tematyczna per obszar supportu

Liczby commitów: dotknięcia plików w danym obszarze (bez merge), wszystkie tożsamości git zsumowane.

### 3.1 Hub timera — ~56 commitów

**Pliki:** `use-pomodoro-cycle.ts`, `timer-worker-*`, `pomodoro-dashboard.tsx`, `timer-panel.tsx`, `cycle.ts`, testy cycle.

| Temat | Przykłady z historii |
|-------|---------------------|
| Stan maszyny cyklu Pomodoro | `use-pomodoro-cycle.ts` — 56 commitów na plik (#1 w repo) |
| Web Worker / synchronizacja czasu | `timer-worker-logic`, fixy E2E z fake clock |
| Integracja UI ↔ hook | dashboard, timer-panel, overlaye cyklu |
| API cyklu (tRPC) | `cycle.ts`, `cycle-isolation.test.ts` |
| Optymistyczny start/przerwanie | `fix-title-multiline-and-cycle-optimistic` (9 cze) |
| Custom work duration | `feat(timer): custom work duration` (4 cze) |
| Mid-cycle rebind | fix B-03 — stabilizacja server cycle id + E2E |

**Pytania do autora:** Stany cyklu „święte”; worker vs main-thread timer; kiedy test hooka vs `pomodoro-cycle.spec.ts`.

---

### 3.2 Guest / data-mode — ~8 commitów (ścieżkowo)

**Pliki:** `lib/guest/*`, `lib/data-mode/*`, `lib/repositories/*`, `guest-import-on-mount`, `import-guest-snapshot`, router `guest`.

| Temat | Przykłady |
|-------|-----------|
| Guest trial i store | `feat(guest-trial)` |
| Merge po logowaniu | `auth-merge-first-impression` (S-14) |
| Typy domenowe | `eisenhower-effort-task-attributes` schema, `sortOrder` |
| Server action import | `_actions/import-guest-snapshot` |

**Uwaga:** Niski wolumen ścieżkowy, ale wysoki wpływ strukturalny (artifact-2: 3 kanały persystencji, 11 fan-in na `guest/store`).

**Pytania do autora:** Dlaczego import przez server action zamiast routera `guest`; kolejność po merge (action → invalidate → clear store).

---

### 3.3 Pas E2E — ~93 commity

**Pliki:** cały katalog `e2e/`.

| Temat | Przykłady |
|-------|-----------|
| E2E belt / CI gate | `testing-e2e-belt-fast`, axe CI w rebrandzie |
| Stabilizacja timera w przeglądarce | `pomodoro-cycle.spec`, `work-cycle.ts`, fake clock |
| Konsolidacja speców (11 cze) | refactor po usunięciu starszych speców (`6ed9bda`) |
| Auth pool / fixtures | `fixtures.ts`, `global-setup.ts` |
| Critical-path persistence | dokumentacja + implementacja (4–5 cze) |

**Pytania do autora:** Które usunięte specy są pokryte przez `smoke` / `seed` / `mindful-session-wind-down`; konwencje helperów.

---

### 3.4 Scoring / sugestie — ~9 commitów (wąski filtr ścieżek)

**Pliki:** `lib/scoring/*`, `routers/suggestion.ts`, `task-suggestion-card.tsx`.

| Temat | Przykłady |
|-------|-----------|
| Silnik scoringu v1/v2 | `adaptive-task-suggestion`, Eisenhower scorer |
| Rationale / breakdown | `suggestion-rationale-expander` |
| API kickoff / readiness | `session-kickoff-suggestion`, `pre-suggestion-readiness` |
| Wind-down + scoring | integracja w hooku timera |

**Szerzej:** ~90 commitów tematycznych „scoring/suggestion” w całym repo (cross-cutting slice'y).

**Pytania do autora:** Scenariusze scoringu krytyczne dla PRD; wpływ `recordDecision` na przyszłe sugestie.

---

### 3.5 Auth — ~18 commitów

**Pliki:** `src/app/auth/*`, `src/lib/auth/*`.

| Temat | Faza |
|-------|------|
| Neon Auth integracja | 24–25 maj (`konrad-kaluzny-ceneo`) |
| Google OAuth | `google-oauth-provider` (31 maj) |
| Account recovery | forgot-password, reset-password |
| Migracja stacku | Drizzle → Prisma (25 maj) |
| Cykl sign-in | jedyny cykl w repo (artifact-2) |

**Uwaga:** Wysoka aktywność w W21 (19% commitów), potem rzadko dotykany — wiedza może być „zamrożona” z maja.

**Pytania do autora:** Dlaczego sign-in bez `schema.ts`; mapowanie błędów Neon Auth na UX.

---

## 4. Macierz supportu

| Obszar (TOP 5) | Kontrybutor | Siła wiedzy | Kiedy pisać |
|----------------|-------------|-------------|-------------|
| Hub timera | Konrad Zieliński | **Bardzo wysoka** | Refaktor hooka, worker, stan cyklu, E2E timera |
| Guest / data-mode | Konrad Zieliński | **Wysoka** (architektura) | Zmiana merge flow, `DataModeProvider`, guest store |
| E2E harness | Konrad Zieliński | **Bardzo wysoka** | Nowe specy, belt CI, helpery, pokrycie po konsolidacji |
| Scoring / suggestion | Konrad Zieliński | **Wysoka** | Algorytm, rationale, kickoff, wind-down |
| Auth | Konrad Zieliński | **Średnio-wysoka** | Zmiana logowania, OAuth, recovery; scaffold maj |

---

## 5. Rozkład tematyczny (całe repo)

Klasyfikacja commitów Konrada po temacie (na podstawie subject line), wszystkie tożsamości git:

| Temat | Szac. commity | Obszar supportu |
|-------|---------------|-----------------|
| Scoring & suggestions | ~90 | #4 |
| Timer & Pomodoro cycle | ~85 | #1 |
| E2E harness | ~85 | #3 |
| Docs & test strategy | ~62 | #3 (plany testów) |
| Other / infra | ~151 | scaffold, CI, roadmap, archive |
| Auth | ~33 | #5 |
| UI / visual craft | ~24 | overlaye, rebrand (powiązane z #1) |
| Guest mode | ~20 | #2 |
| Tasks UI | ~15 | task-list (powiązane z #1, #4) |

---

## 6. Fazy czasowe (kontekst dla rozmowy)

| Faza | Okres | Dominanta | Co Konrad pamięta najlepiej |
|------|-------|-----------|----------------------------|
| Scaffold | W21 (23–25 maj) | Infra, auth, tRPC, Drizzle→Prisma | Auth, `env.js`, `root.ts` |
| Core MVP | W22 (26 maj–1 cze) | cycle API, task-list, timer hook | Pierwsza wersja huba timera |
| Szczyt feature | W23 (2–8 cze) | timer, scoring, guest, eksplozja E2E | Pełny vertical slice |
| Stabilizacja | W24 (9–12 cze) | UI polish, E2E helpers, rebrand | Harness testów, visual craft |

---

## 7. Podsumowanie

| Werdykt | Opis |
|---------|------|
| Liczba ludzkich kontrybutorów | **1** — Konrad Zieliński |
| Fałszywi „drudzy” autorzy | `szielinska15` — do zignorowania po normalizacji |
| Model supportu | Solo-maintained; brak rotacji wiedzy między osobami |
| Priorytet rozmowy | Zacząć od huba timera — rozstrzyga większość ryzyk z pozostałych 4 obszarów |
| Ryzyko bus factor | **Wysokie** — cała wiedza domenowa u jednej osoby |

---

## Powiązania

| Artifact | Relacja |
|----------|---------|
| [artifact-1-territory.md](./artifact-1-territory.md) | Priorytetyzacja obszarów (aktywność git) |
| [artifact-2-structure.md](./artifact-2-structure.md) | Uzasadnienie „dlaczego kontakt” (graf, testy, granice) |
| `reports/timer-hub.svg` | Wizualizacja blast radius — argument za rozmową o hubie timera |
