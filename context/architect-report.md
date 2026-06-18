---
title: "Raport architektoniczny — moduł 4 (10xArchitect)"
created: 2026-06-18
sources:
  L2: context/map/repo-map.md
  L3: context/changes/repo-map-analysis/research.md
  L4: context/changes/refactor-opportunities/plan.md
  L5: context/domain/01-domain-distillation.md, 02-invariant-aggregate-refactor.md, 03-anti-corruption-layer.md
repository: konrad-kaluzny-ceneo/FlowState
---

# Raport architektoniczny — FlowState (moduł 4)

Synteza czterech artefaktów L2–L5. Wszystkie pochodzą z repozytorium **FlowState** (`konrad-kaluzny-ceneo/FlowState`). Inne repozytoria w workspace nie występują w wejściach.

---

## 1. Opisane projekty

| Repo | Stack (z artefaktów) | Skala (orientacyjnie) | Artefakty |
|------|----------------------|------------------------|-----------|
| **FlowState** | Next.js App Router, tRPC 11, Prisma 7 + Neon, Playwright; solo-maintained | ~3 tygodnie historii git (maj–czerwiec 2026), 468 commitów / 1 autor, 231 modułów w depcruise `src/` | **L2**, **L3**, **L4**, **L5** |

---

## 2. Mapa projektu (L2)

**Źródło:** `context/map/repo-map.md` — FlowState.

**Kluczowe wnioski:**

1. **Epicentrum ryzyka:** vertical slice timera — `use-pomodoro-cycle` (18 fan-out w mapie; L3 doprecyzowuje 19), dashboard, `cycle.ts`; ~50% commitów git.
2. **Lokalne centra:** hub hooka timera (#1 churn); `server/api/trpc.ts` (25 dependents, mało własnych commitów); `lib/data-mode` + `repositories/` jako most guest↔server mimo niskiego churnu git (~3%).
3. **Entry pointy:** `/` → prefetch `task.list` + `cycle.getActive`; `src/app/auth/` — jedyny cykl importów w `src/`; E2E poza grafem depcruise (27 wspólnych commitów z hookiem).
4. **Wzorzec bezpieczny:** `lib/scoring` — czysta domena, tanie testy unit (deklaracja mapy; L5 kwestionuje zgodność z kodem).
5. **Unknowns (jawnie w mapie):** zachowanie Neon/Vercel/CI; zależności `e2e/`; intencja usuniętych speców E2E (11% plików z historii); pokrycie % i jakość kodu.

---

## 3. Analiza ficzera (L3)

**Źródło:** `context/changes/repo-map-analysis/research.md` — FlowState, commit `29a62d3`, branch `main`.

**Przepływ i powiązanie z mapą:** Badany hub timera Pomodoro (`use-pomodoro-cycle`) — bezpośrednio **strefa ryzyka #1** z L2 (18 zależności, test ~2700 linii, zmiana bez E2E = ślepa strefa).

**Feature overview (3–4 zdania):** Wejście od `/` przez `HomeShell` i `DataModeProvider` do `PomodoroDashboard` → `usePomodoroCycle()`. Stan zmienia się w hooku (maszyna stanów, timer worker/fallback) i persystuje przez `useRepositories()` (guest: localStorage; auth: tRPC → routery → Prisma/Neon); część mutacji (`checkIn`, `suggestion`) omija repo i idzie bezpośrednio przez `api.*`. E2E belt (`pomodoro-cycle.spec.ts`) dowodzi wąskiej ścieżki auth: zadanie → focus → start → fake clock → continue later → check-in → break.

**Technical debt — 3 najważniejsze ryzyka:**

| Ryzyko | Opis (z L3) | Dowód |
|--------|-------------|-------|
| **Dual tRPC / niespójny ACL** | Hook: cykl/sesja przez repo; `checkIn`/`suggestion` przez `api.*`; dashboard: jedyne `api.task.list.useSuspenseQuery` w `src/` | **ast-grep potwierdzone** — twierdzenia #4, #7, #8 w sekcji weryfikacji |
| **Luki testowe ACL** | `data-mode-context`, `server-repositories`, `narrative-context` — 0 plików testowych; dashboard to smoke ze stubowanym hookiem (10 testów) | **ast-grep potwierdzone** — #11–#14 |
| **Blast radius huba** | 19 fan-out + 9 fan-in (depcruise); zmiana timera wymaga hook + dashboard + test hooka + ≥1 spec E2E; git: 35 co-change `_components`↔`hooks`, 27 `e2e/specs`↔`hooks` | depcruise + git co-change (L3); fan-out **19** potwierdzony ast-grepem (#1) |

---

## 4. Plan refaktoryzacji (L4)

**Źródło:** `context/changes/refactor-opportunities/plan.md` — FlowState. Meta-change **nie modyfikuje `src/`** — rollout przez child change-id.

**Co refaktoryzowane (wybrana opcja i kształt docelowy):**

- **#1 K5 → B-05 → B-06 → F-07:** hotfix mutex closure↔kickoff (T-01), potem timeout closure on load (T-03), potem czysty **`src/lib/wedge/transition-conductor.ts`** — priorytet beatów (OQ2: closure > wind-down > check-in > suggestion > kickoff > narracja > catch-up); dashboard konsumuje conductor zamiast rozproszonych `&&`.
- **#2 K1:** pure extracts (`cycle-end-time.ts`, `cycle-kind.ts`) przy zachowaniu facade `usePomodoroCycle` (63 pola bez zmian).
- **#3 K2:** Path C — `useDomainTasks(mode)` po char testach ACL.

**Czego świadomie NIE robimy:** implementacja w folderze `refactor-opportunities/`; Path B (pełna unifikacja React Query); split hooka na wiele publicznych hooków; unifikacja gate guest/auth; B-08; K3 guest merge w tym rollout; zmiana `refreshGuest`/`refreshKey` bez osobnego designu.

**Fazy (jedna linia + weryfikacja):**

| Faza | Cel | Auto | Ręcznie |
|------|-----|------|---------|
| 1 | Manifest `rollout.md` + decision log | pliki istnieją | kolejność vs roadmap Stream N |
| 2 | B-05 `fix-closure-kickoff-mutex` | char → mechanism → enforcement; CI (`check`, `test`, `e2e:belt`) | end session → closure → dismiss → brak kickoff |
| 3 | B-06 `fix-timeout-closure-on-load` | Vitest hydrate timing | closure on load przed kickoff |
| 4 | F-07 `wedge-transition-conductor` | `transition-conductor.test.ts`; belt green | brak stackowania overlayów |
| 5 | K2 char | `data-mode-context.test.tsx`, zero prod diff | review guest vs auth shapes |
| 6 | K1 extracts | `src/lib/cycle/` + hook tests | belt pomodoro |
| 7 | K2 Path C enforcement | full `pnpm test` | spójność task list hook + TaskList |
| 8 | Zamknięcie rollout | wszystkie wiersze `merged` | sign-off; opcjonalnie K4 sign-in schema |

Każda faza L4 wymaga **pauzy na manual confirmation** przed kolejną.

---

## 5. Domena wg DDD (L5)

**Źródło:** `context/domain/` (3 pliki) — FlowState, 2026-06-17.

**Ubiquitous language — 5 pojęć + rozjazdy model↔kod:**

| Pojęcie | Sens (skrót) | Rozjazd |
|---------|--------------|---------|
| **Wedge** | sesja-aware sugestia z override freedom | brak typu/modułu `Wedge` w kodzie |
| **Transition beat** | max 1 interstitial + 1 gate | **BRAK** `transition-conductor` w `src/` (0 dopasowań) |
| **Session / Cycle** | agregaty persystencji timera | serwer egzekwuje RUNNING mutex; pause (S-24) **BRAK** w `CycleState` |
| **CheckIn / SuggestionDecision** | energia na granicy WORK; rekord override | serwer OK; optimistic wedge post-check-in **ignorowany** (sekwencyjne `await`) |
| **DataMode** | guest \| authenticated → repozytoria | zgodne z PRD dla węższego guest wedge; tRPC bypass w hooku (G8, L3) |

**Niezmiennik #1 i agregat:** **I-01 beat-mutex** — „≤1 linia interstitial + ≤1 gate na transition beat” (`prd.md:62`; aktywnie naruszany T-01). Agregat docelowy: **`WedgeTransitionBeat`** (proces domenowy, niepersystowany) — `02-invariant-aggregate-refactor.md`; strażnik dziś rozproszony między dashboard (`&&`) a ~40 flagami w hooku.

**Anti-Corruption Layer:** Wybrany przeciek **#1: `@prisma/generated`** — enumy Prisma (`WorkType`, `EnergyLevel`, `CommitmentHorizon` itd.) w **14 plikach prod. przez 4 warstwy** (`lib/scoring`, `lib/session`, hooks, `app/_components`, routery) — `03-anti-corruption-layer.md`. Kontrast: dokumentacja L2/L5 wskazuje `score-task.ts` jako czystą domenę, kod importuje `@prisma/generated`. Wzorzec naprawy istnieje tylko dla `CycleEndAudioMode` (`cycle-audio-preference`); plan L4 adresuje osobno K2 (tRPC/data-mode), nie pełny ACL Prisma w tym rollout.

---

## 6. Decyzje, które należą do mnie

*Uwaga: brak osobnego „decision logu człowieka”; poniżej synteza z L4 (sekcje „decided”) i bram manualnych w planie.*

1. **Ranking K5 → K1 → K2** wyszedł z researchu AI (`refactor-opportunities/research.md`); **zatwierdzenie kolejności i meta-rollout** jest etapem planowania — plan L4 zamraża sekwencję B-05 → B-06 → F-07 przed K1/K2.
2. AI rekomendowało **odrzucenie Path B** (rewrite huba na React Query) — plan L4 utrwala to jako świadomie poza scope; **Path C** (unifikacja odczytu tasków) wybrany przed rozszerzeniem repo o `checkIn`/`suggestion`.
3. AI zaprojektowało agregat **`WedgeTransitionBeat`** (L5-02); plan L4 **upraszcza wdrożenie** do pure `transition-conductor.ts` + stan w hooku — facade 63 pól **bez splitu public API** (osobna decyzja planu vs pełny agregat w hooku z L5-02).
4. **OQ2 priorytet beatów** (closure > wind-down > check-in > …) — zamrożony w L4 jako input do F-07; wymaga ręcznej akceptacji przed Phase 4 (brak overlay stacking).
5. Każda faza L4 ma **obowiązkową manual verification** przed następną — to jedyne explicite oznaczone punkty decyzyjne człowieka w artefaktach (Phase 1.3, 2.2, 4.3 itd.).

---

*Ograniczenia raportu: tylko treść L2–L5; status implementacji child changes (np. `fix-closure-kickoff-mutex`) — **BRAK artefaktu** w wejściach (plan Progress = wszystko `[ ]`).*
