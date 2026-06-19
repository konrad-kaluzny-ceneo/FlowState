---
date: 2026-06-17T12:00:00+02:00
researcher: Cursor Agent
git_commit: 98860eba8c2543dc7e88d7cd607ed7a257b79395
branch: main
repository: konrad-kaluzny-ceneo/FlowState
topic: "Refactor opportunities — ranking structural debt from repo-map-analysis"
tags: [research, refactor, use-pomodoro-cycle, data-mode, guest-merge, auth, wedge-conductor, verified]
status: complete
last_updated: 2026-06-17
last_updated_by: Cursor Agent
verification_commit: 98860eba8c2543dc7e88d7cd607ed7a257b79395
verification_date: 2026-06-17
---

# Research: Refactor opportunities (from repo-map-analysis)

**Date**: 2026-06-17T12:00:00+02:00  
**Researcher**: Cursor Agent  
**Git Commit**: [`98860eb`](https://github.com/konrad-kaluzny-ceneo/FlowState/commit/98860eba8c2543dc7e88d7cd607ed7a257b79395)  
**Branch**: main  
**Repository**: [konrad-kaluzny-ceneo/FlowState](https://github.com/konrad-kaluzny-ceneo/FlowState)

## Research Question

Na podstawie [`context/changes/repo-map-analysis/research.md`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/98860eba8c2543dc7e88d7cd607ed7a257b79395/context/changes/repo-map-analysis/research.md) i [`context/map/repo-map.md`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/98860eba8c2543dc7e88d7cd607ed7a257b79395/context/map/repo-map.md): **które** z odnotowanych problemów warto naprawić, w jakim docelowym kształcie i w jakiej kolejności? Eksploracja bez refaktoru i bez decyzji implementacyjnych.

## Summary

Z **35 odnotowanych problemów** **5** kwalifikuje się jako **KANDYDAT** (naprawa zmieniłaby strukturę kodu). Pozostałe **30** to luki testowe, dług operacyjny lub opisy blast radius — wejście do oceny kosztu migracji, nie osobne refaktory strukturalne.

**Ranking propozycji (dla sesji planowania):**

| # | Kandydat | Obecny → docelowy kształt | Dlaczego to miejsce |
|---|----------|---------------------------|---------------------|
| 1 | **K5** Wedge gate orchestration | Rozproszone `&&` w dashboard + flagi w hook → **F-07 conductor** (+ hotfix **B-05**) | P0 produktowy (T-01), już w roadmapie jako top blocker; inkrementalna ścieżka B-05 → F-07 |
| 2 | **K1** Monolithic cycle hook | 2357 LOC, 63 pola zwrotne → **facade + wyekstrahowane moduły** (timer, pure helpers) przy conductorze | Najwyższy koszt zmiany timera (19 fan-out, 27 co-change E2E); F-07 adresuje orchestrację, K1 resztę monolitu |
| 3 | **K2** Inconsistent client data-access | Repo + bezpośrednie `api.*` + `useSuspenseQuery` → **spójny ACL** (repo rozszerzone lub wspólny hook odczytu) | Odblokowuje bezpieczniejsze refaktory K1/K5; `data-mode-context` bez testów |

**Rozważeni i odrzuceni z top-3:** K4 (łatwy, ale niski wpływ strukturalny), K3 (ważny, ale niższy churn i osobna ścieżka produktowa), pełna unifikacja na React Query (Path B — zbyt wysoki blast radius).

---

## Audyt: pełna lista problemów i klasyfikacja

Źródło ustaleń: [`repo-map-analysis/research.md`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/98860eba8c2543dc7e88d7cd607ed7a257b79395/context/changes/repo-map-analysis/research.md) + [`repo-map.md` §4](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/98860eba8c2543dc7e88d7cd607ed7a257b79395/context/map/repo-map.md). Klasyfikacja **KANDYDAT** = naprawa zmieniłaby strukturę kodu.

### Architektura — wyjątki od wzorca (§1)

| ID | Problem | Klasyfikacja |
|----|---------|--------------|
| P1 | Dual tRPC w dashboardzie (repo + `api.task.list` + direct `api.checkIn/suggestion` w hooku) | **KANDYDAT → K2** |
| P2 | Brak testu ACL (`data-mode-context`, `server-repositories`) | wejście wykonalności (K2, K3) |
| P3 | Guest merge (3 kanały persystencji) | **KANDYDAT → K3** |
| P4 | E2E poza grafem depcruise | wejście wykonalności (ograniczenie narzędzia, nie refaktor `src/`) |

### Test pyramid — luki (§2)

| ID | Problem | Klasyfikacja |
|----|---------|--------------|
| P5 | `data-mode-context` — 0 testów | wejście wykonalności |
| P6 | `server-repositories` — 0 testów | wejście wykonalności |
| P7 | `narrative-context` — 0 testów | wejście wykonalności |
| P8 | `pomodoro-dashboard` — smoke ze stubowanym hookiem | wejście wykonalności |
| P9 | Hook: `onWindDownEndSession` tylko E2E `@skip-belt` | wejście wykonalności |
| P10 | Hook: error/retry paths | wejście wykonalności |
| P11 | Hook: guest flows — 4 testy | wejście wykonalności |
| P12 | Hook: real Worker timer | wejście wykonalności |
| P13 | Router `cycle.ts` edge cases NOT_FOUND/BAD_REQUEST | wejście wykonalności |

### E2E poza beltem (§2)

| ID | Problem | Klasyfikacja |
|----|---------|--------------|
| P14 | Interrupt w trakcie RUNNING | wejście wykonalności |
| P15 | Long break po 4. cyklu WORK | wejście wykonalności |
| P16 | Tab-return catch-up na bramkach | wejście wykonalności |
| P17 | Cycle intention submit | wejście wykonalności |
| P18 | Optimistic start rollback przy błędzie sieci | wejście wykonalności |
| P19 | Real Worker timer (E2E) | wejście wykonalności |

### Blast radius — szwy (§3)

| ID | Problem | Klasyfikacja |
|----|---------|--------------|
| P20 | Hook return API — 63 pola | **KANDYDAT → K1** (objaw monolitu) |
| P21 | `CycleRepository` seam | wejście wykonalności (część K2/K3) |
| P22–P25 | tRPC `cycle.*`, Prisma, timer worker, E2E env | wejście wykonalności (kontrakty, nie osobne refaktory) |

### Operacyjne (§4)

| ID | Problem | Klasyfikacja |
|----|---------|--------------|
| P26 | Bus factor (100% jeden autor) | dług organizacyjny — poza refaktorem kodu |
| P27 | Konsolidacja E2E (11% plików usuniętych) | wejście wykonalności / wiedza autora |
| P28 | NFR 200ms per surface (L-04) | wejście wykonalności |
| P29 | Harness E2E ≠ produkcja (fake clock, main-thread timer) | świadomy harness testowy |

### Strefy ryzyka repo-map (§4)

| ID | Problem | Klasyfikacja |
|----|---------|--------------|
| P30 | `use-pomodoro-cycle.ts` hub | **KANDYDAT → K1** |
| P31 | Guest merge flow | **KANDYDAT → K3** (duplikat P3) |
| P32 | E2E harness | wejście wykonalności |
| P33 | `pomodoro-dashboard.tsx` dual path + overlaye | **KANDYDAT → K2 + K5** |
| P34 | Auth / sign-in cykl importów | **KANDYDAT → K4** |
| P35 | Bus factor | dług organizacyjny |

### Architecture insights / ast-grep

| ID | Problem | Klasyfikacja |
|----|---------|--------------|
| P36 | Hub anty-wzorzec testowalności | **KANDYDAT → K1** |
| P37 | `checkIn`/`suggestion` omijają `useRepositories` | **KANDYDAT → K2** |
| P38 | Data-mode jako most (wysoki wpływ strukturalny) | wejście wykonalności (K2/K3) |

### Lista kandydatów (deduplikacja)

| Kod | Kandydat | Problemy źródłowe |
|-----|----------|-------------------|
| **K1** | Monolithic cycle hook | P20, P30, P36 |
| **K2** | Inconsistent client data-access | P1, P33 (część), P37 |
| **K3** | Guest merge multi-channel persistence | P3, P31 |
| **K4** | Auth sign-in import cycle | P34 |
| **K5** | Ad-hoc overlay/gate orchestration | P33 (część), AGENTS.md wedge rules, F-07 |

**Uwaga:** K1 i K5 są sprzężone — F-07 (K5) wycina orchestrację z monolitu (K1), ale nie zastępuje całego K1.

---

## K1: Monolithic cycle hook (`use-pomodoro-cycle.ts`)

### Obecny kształt

| Twierdzenie | Tag |
|-------------|-----|
| Plik ma **2357 LOC** (raport: 2358); return API **63 klucze** (L2282–2355 w `return {`) | evidence |
| Jedyne wywołanie produkcyjne `usePomodoroCycle()` — [`pomodoro-dashboard.tsx:62`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/98860eba8c2543dc7e88d7cd607ed7a257b79395/src/app/_components/pomodoro-dashboard.tsx#L62) | evidence |
| **19 fan-out** (depcruise, raport 2026-06-15); **9 fan-in** | evidence (priory) |
| Klastry odpowiedzialności w jednym hooku: FSM cyklu, timer Worker+fallback, recovery, UX gates, sugestie, narrative, audio, onboarding, guest/auth branch | evidence |
| Czysta logika już wyekstrahowana: `derive-gate`, `narrative-builder`, `wind-down-nudge`, `timer-worker-logic`, `suggestion-priority` itd. | evidence |
| Brak sub-hooków (`useTimer`, `useSuggestions`) — orchestracja sekwencji zostaje inline | evidence |
| `checkIn`/`suggestion` przez direct `api.*` (L303–306, raport: L304–307) — część K2, nie K1 | evidence |

### Werdykt intencjonalności

| Werdykt | Uzasadnienie |
|---------|--------------|
| **Świadome ograniczenie nośne + organiczny wzrost** | S-01 (`first-pomodoro-cycle`) zaplanował hook jako **„single orchestration hook”** (Worker + audio + visibility + tRPC + recovery). Każdy kolejny wedge (check-in, suggestion, kickoff, wind-down, catch-up, narrative) **rozszerzał hub**, nie dzielił go. F-07 w roadmapie uznaje obecny rozmiar za dług do naprawy. |

Nie jest to przypadkowa złożoność od zera — to **load-bearing decision**, które stało się **accidental complexity** przez wzorzec „extend the hub”.

### Notatki o wykonalności

| Aspekt | Ocena |
|--------|-------|
| Istniejące abstrakcje | Timer math, catch-up, narrative, wind-down — **gotowe**; inline: `cycleEndTimeMs`, recovery guard, **43** `useState` (raport: ~40) |
| Blast radius | Git: `_components↔hooks` 35, `e2e↔hooks` 27; test hooka **2854 LOC / 65 przypadków** |
| Osłony CI | `pnpm test` (pełny Vitest); belt E2E 12 scenariuszy — wąska ścieżka auth |
| Pierwszy krok-prerekwizyt | Ekstrakcja **pozostałych pure helpers** (`cycleEndTimeMs`, deduplikacja `isBreakKind`) + testy współlokalizowane — zero zmiany API zwrotnego |
| Redesign pojęć biznesowych? | **Nie** — domena Pomodoro stabilna; dług to orchestracja, nie model cyklu |

**Docelowy kształt (nazwa, nie pełna architektura):** `usePomodoroCycle` jako **stabilna fasada** + wewnętrzne moduły (timer engine, gate conductor z F-07) + dalsze pure extracts.

---

## K2: Inconsistent client data-access

### Obecny kształt

| Ścieżka | Gdzie | Tag |
|---------|-------|-----|
| `cycles`/`sessions`/`tasks.update` | `useRepositories()` w hooku L225 (raport: L226) | evidence |
| `checkIn`, `suggestion.*` | `api.*.useMutation()` L303–306, L1961 (raport: L304–307) | evidence |
| `task.list` (UI auth) | `pomodoro-dashboard.tsx:452` `useSuspenseQuery` | evidence |
| `task.list` (hook) | `utils.client.task?.list?.query` L650–656 (raport: `utils.client.task.list.query()` L650–658) | evidence |
| Task CRUD (TaskList) | `useTaskMutations` — optimistic cache | evidence |
| `refreshGuest()` | no-op w obu trybach (`data-mode-context.tsx:37,104`) | evidence |
| Brak `CheckInRepository` / `SuggestionRepository` w `types.ts` | — | evidence |

### Werdykt intencjonalności

| Element | Werdykt |
|---------|---------|
| Repo layer S-08 (task/cycle/session) | **Świadome** — guest trial parity |
| checkIn/suggestion poza repo | **Świadome** — auth-only, slice plans wskazują `api.useMutation` |
| SuspenseQuery read + repo/hook write dla tasków | **Drift S-08 → świadomy po S-09** (optimistic cache) |
| `refreshGuest` no-op | **Przypadkowy / niedokończony** scaffold |

### Notatki o wykonalności

| Ścieżka migracji | Koszt | Uwagi |
|------------------|-------|-------|
| **Path A:** rozszerz repo o checkIn/suggestion | Niski | 1 consumer (hook); nie naprawia dual read tasków |
| **Path C:** `useDomainTasks(mode)` — wspólny odczyt | Średni-niski | Naprawia dual read; zostawia checkIn/suggestion |
| **Path B:** pełna unifikacja na RQ | Wysoki | Hub rewrite — odrzucone jako pierwszy krok |

| Blast radius | `api.checkIn`/`suggestion` — głównie hook + router tests + 4 belt E2E; `task.list` — dashboard, hook, `use-task-mutations`, `page.tsx` |
| Osłony | `use-pomodoro-cycle.test.tsx` mocne; **`data-mode-context` 0 testów** — krytyczna luka |
| Pierwszy krok | **`data-mode-context.test.tsx`** (charakteryzacja guest vs auth repo) + inventory ścieżek dostępu |

**Docelowy kształt:** jeden **ACL** — albo repo kompletne (task/cycle/session/checkIn/suggestion), albo wspólne hooki odczytu + spójna invalidacja cache.

---

## K3: Guest merge multi-channel persistence

### Obecny kształt

| Kanał | Rola w merge | Tag |
|-------|--------------|-----|
| **localStorage** `flowstate:guest-v1` | Odczyt przed merge, clear po sukcesie | evidence |
| **Server action** `importGuestSnapshotAction` | **Jedyna ścieżka zapisu UI** (`guest-import-on-mount.tsx:57`, raport: L58) | evidence |
| **tRPC** `guest.import` | Ten sam core `importGuestSnapshot`; **tylko testy** w prod UI | evidence |
| **sessionStorage** | import-guard + merge-success-pending (S-14) | evidence |
| **tRPC invalidate** | `task.list` + `cycle.getActive` po merge (L86–87, raport: L85–88) | evidence |

`DataModeProvider` przełącza guest ↔ server repos — nie jest czwartym kanałem persystencji, ale **ACL bridge**.

### Werdykt intencjonalności

| Aspekt | Werdykt |
|--------|---------|
| Dual-store guest + server | **Świadome** (S-08, PRD FR-003b/c) |
| Server action zamiast tRPC w UI | **Unknown rationale** — pivot `ed6e9f0` (2026-05-31) „try fix bugs”, brak ADR |
| Dual server entry (action + router) | **Accidental drift** — plan S-08: tRPC only; router nie usunięty |
| Trzeci sessionStorage (merge-success) | **Świadome** rozszerzenie S-14 |

### Notatki o wykonalności

| Aspekt | Ocena |
|--------|-------|
| Core merge | Już **skonsolidowany** w `importGuestSnapshot` |
| Blast radius | **9 prod** importerów `guest/store`; data-mode + 6 consumerów |
| Osłony | `guest.test.ts` (8 przypadków); belt `guest-merge-on-sign-in.spec.ts`; **brak** `data-mode-context` testów |
| Pierwszy krok | Testy bezpieczeństwa: `data-mode-context.test.tsx` + failure path w `guest-import-on-mount.test.tsx` |
| Konsolidacja entry points | Możliwa po testach; **unknown** czy target = action vs tRPC |

**Docelowy kształt:** **jeden** server entry point + uproszczone guardy sessionStorage; localStorage pozostaje dla guest trial.

---

## K4: Auth sign-in import cycle

### Obecny kształt

```
action.ts --import type SignInFormState--> sign-in-form.tsx
     ^                                              |
     +-------- import { signInAction } -------------+
```

| Fakt | Tag |
|------|-----|
| Jedyny cykl importów w `src/` | evidence (artifact-2) |
| Krawędź `action → form` to `import type` only | evidence |
| sign-up / forgot / reset używają `schema.ts` — acykliczne | evidence |
| sign-in **brak** `schema.ts` | evidence |

### Werdykt intencjonalności

| Werdykt | Uzasadnienie |
|---------|--------------|
| **Przypadkowy dług** | Scaffold W21 (2026-05-24) — typ w `page.tsx`. Sign-up naprawiony tego samego dnia (`schema.ts`). Google OAuth (2026-05-31) przeniósł typ do `sign-in-form.tsx` bez wydzielenia `schema.ts`. |

### Notatki o wykonalności

| Aspekt | Ocena |
|--------|-------|
| Blast radius | **2 pliki** cyklu + 3 pliki testów `action` |
| Osłony | `action.test.ts`, `validation.test.ts`, `error-clearing.test.ts`; belt **nie** testuje formularza sign-in (API auth w global-setup) |
| `depcruise` | **Poza CI** — cykl niewidoczny na merge gate |
| Pierwszy krok | Baseline `pnpm depcruise` + `sign-in/schema.ts` (mirror sign-up) |

**Docelowy kształt:** `sign-in/schema.ts` z `SignInFormState`; action i form importują ze schema.

---

## K5: Ad-hoc overlay/gate orchestration

### Obecny kształt

| Warstwa | Odpowiedzialność | Tag |
|---------|------------------|-----|
| **Hook** | Stan bramek (`awaiting*`, `pendingClosureLine`, `catchUp`), transitions, kickoff effect L1082–1114 (raport: L1082–1109) | evidence |
| **Dashboard** | **8** lokalnych `show*` + JSX `&&` (L82–434; raport: ~15) | evidence |
| **Brak F-07 conductor** | 0 plików `*conductor*` | evidence |
| Częściowe mutexy | `deriveCatchUpGate`, `kickoffEligible`, `isPostCheckInTransitioning`, DOM `useWedgeGateSuppressed` | evidence |
| **T-01 bug** | `SessionClosureOverlay` bez guarda vs kickoff; kickoff z=60 > closure z=58 | evidence ([`user-flow.md`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/98860eba8c2543dc7e88d7cd607ed7a257b79395/context/foundation/user-flow.md)) |

Przykład luki mutex (evidence):

```371:395:src/app/_components/pomodoro-dashboard.tsx
			{enableSuggestionGate &&
				pomodoro.awaitingKickoffReadiness &&
				!pomodoro.awaitingCheckIn &&
				!pomodoro.awaitingWindDown &&
				!pomodoro.isPostCheckInTransitioning && (
					<KickoffReadinessOverlay ... />
				)}

			{pomodoro.pendingClosureLine != null && (
				<SessionClosureOverlay ... />
			)}
```

(Weryfikacja: kickoff guard L371–375 bez `pendingClosureLine`; closure L390–395 bez guarda kickoff — patrz § Weryfikacja V21–V22.)

### Werdykt intencjonalności

| Aspekt | Werdykt |
|--------|---------|
| Rozproszenie hook + dashboard per slice | **Świadoma taktyka dostawy** (parallel worktrees, minimal diff) |
| Brak centralnego conductora | **Odroczone**, nie wybrane — PRD v3 (2026-06-13) + F-07 formalizują lukę |
| T-01 stacking | **Accidental integration debt** — closure dodane bez aktualizacji pełnej macierzy mutex |

### Notatki o wykonalności

| Aspekt | Ocena |
|--------|-------|
| F-07 zastępuje | Scattered guards → `isGateActive` matrix; hook zachowuje timer/cycle/mutations |
| B-05 prerequisite | Hotfix T-01: mutex closure↔kickoff + abort async kickoff po `endSession()` |
| Blast radius | Dashboard + 8+ overlayów + hook + belt specs (closure, kickoff, wind-down, pomodoro-cycle) |
| Osłony | 65 testów hooka (brak testu mutex closure+kickoff); belt `session-closure.spec.ts` **omija** T-01 (`dismissKickoffReadinessIfVisible` przed end session) |
| Pierwszy krok | **B-05** (`fix-closure-kickoff-mutex`) — przed pełnym F-07 |

**Docelowy kształt:** moduł **wedge-transition-conductor** (F-07) — pure priority matrix; hook = facade; dashboard = render wg conductora.

---

## Refactor opportunities — ranking

### #1 — Wedge gate orchestration (K5 → B-05 → F-07)

| | |
|---|---|
| **Obecny → docelowy** | Rozproszone `&&` + flagi w hooku → **conductor** z macierzą priorytetów (closure > wind-down > check-in > suggestion > kickoff) |
| **Dlaczego #1** | Jedyny kandydat z **aktywnym bugiem produktowym** (T-01); PRD v3 guardrail; roadmap Stream N top blocker; blokuje S-21, S-34, S-35 |
| **Koszt długu vs zmiany** | Dług: nakładające się overlaye, race kickoff po `endSession`, DOM-based suppression. Zmiana: średni — B-05 mały (S), F-07 większy (M) ale zaplanowany z testami parity |
| **Blast radius** | Dashboard, hook (flagi/effects), 8 overlayów, 4 belt E2E; **nie** dotyka Prisma ani guest merge |
| **Ścieżka inkrementalna** | B-05 hotfix (mutex + abort) → B-06 timeout closure → F-07 conductor za stabilną fasadą `usePomodoroCycle` |
| **Pierwszy krok** | `/10x-new fix-closure-kickoff-mutex` — test belt: end session → brak kickoff-readiness pod closure |

### #2 — Monolithic cycle hook decomposition (K1)

| | |
|---|---|
| **Obecny → docelowy** | 2358 LOC / 63 pola → **facade** + timer engine + pure modules; orchestracja bramek do conductora (K5) |
| **Dlaczego #2** | Najwyższy koszt każdej zmiany timera (19 fan-out, 35 co-change UI, 27 E2E); anty-wzorzec testowalności mimo 2854 LOC testów |
| **Koszt długu vs zmiany** | Dług: każdy wedge dokleja stan do tego samego pliku. Zmiana: wysoka bez F-07; **niższa** jeśli conductor wycina ~gate orchestration najpierw |
| **Blast radius** | Hook + dashboard + timer-panel + overlaye + `cycle.ts` + E2E helpers — checklist z repo-map-analysis |
| **Ścieżka inkrementalna** | Pure extracts (`cycleEndTimeMs`) → B-05/F-07 (orchestracja) → opcjonalny timer-engine wewnętrzny przy niezmienionym return API |
| **Pierwszy krok** | Ekstrakcja `cycleEndTimeMs` + test współlokalizowany — revertowalne, zero API churn |

### #3 — Data-mode ACL completion (K2)

| | |
|---|---|
| **Obecny → docelowy** | Repo (3 encje) + direct `api.*` + dual task read → **spójny ACL** z testami; opcjonalnie repo rozszerzone o checkIn/suggestion |
| **Dlaczego #3** | Odblokowuje bezpieczne refaktory K1/K5; `data-mode-context` to most guest↔server **bez jednego testu**; dual invalidation tasków ryzykuje niespójność cache |
| **Koszt długu vs zmiany** | Dług: reasoning przy każdej zmianie persystencji. Zmiana: średni-niski jeśli zacząć od testów + Path C (task read); Path A (repo extend) tani dla checkIn/suggestion |
| **Blast radius** | `data-mode-context`, repositories, hook (4 mutacje), dashboard (`task.list`), `use-task-mutations` |
| **Ścieżka inkrementalna** | `data-mode-context.test.tsx` → `useDomainTasks(mode)` → opcjonalnie `CheckInRepository` |
| **Pierwszy krok** | **`data-mode-context.test.tsx`** — wspólny prerekwizyt K2 i K3 |

---

### Kandydaci rozważeni i odrzuconi z top-3

| Kandydat | Dlaczego nie top-3 |
|----------|-------------------|
| **K4** Auth sign-in cycle | **Najłatwiejszy** refactor (2 pliki, wzorzec istnieje 3×), ale **niski wpływ strukturalny** na produkt Pomodoro; izolowany moduł auth; dobry **quick win** równoległy do innej pracy, nie priorytet timera |
| **K3** Guest merge | Core merge już skonsolidowany; dual entry (action/tRPC) to drift, nie aktywny bug; **~3% churn git**; sensowny po testach ACL, ale nie blokuje wedge flow jak K5 |
| **Path B** (pełna unifikacja RQ) | Blast radius = rewrite huba; odrzucone jako pierwsza ścieżka — zbyt kosztowne vs sygnał |
| **Pełny split hooka na wiele public hooks** | Zmiana 63-polowego API — blast radius większy niż F-07 za fasadą; wymaga osobnej analizy kontraktu |
| **Unifikacja guest/auth flow** (jeden zestaw bramek) | **Redesign pojęć biznesowych** — świadoma divergencja produktowa; poza refaktorem struktury |

### Problemy nie-kandydaci — jak wpływają na ranking

| Grupa | Wpływ na wykonalność top-3 |
|-------|---------------------------|
| P2, P5–P8, P21 (brak testów ACL/repo/dashboard) | **Blokuje** bezpieczny K2/K3; **nie blokuje** B-05 (hook tests wystarczają) |
| P9–P19 (luki testowe hook/E2E) | F-07 wymaga testów parity; belt Phase 8 (po B-05) |
| P26, P35 (bus factor) | Dokumentacja / onboarding — nie zmienia kolejności refaktorów |
| P29 (E2E harness) | Świadomy — nie refaktorować |
| P4, P32 (E2E poza depcruise) | Ograniczenie konfiguracji depcruise — opcjonalny CI gate, nie zmiana `src/` |

---

## Architecture Insights

1. **K5 i K1 to jedna historia** — S-01 wybrał monolit; wedge slices dokleiły bramki; F-07 jest zaplanowanym cięciem orchestracji, nie nowym pomysłem.
2. **K2 i K3 dzielą `data-mode-context`** — testy ACL to wspólny prerekwizyt obu ścieżek.
3. **K4 jest outlierem pozytywnym** — ten sam folder auth ma gotowy wzorzec naprawy; niski koszt, niski zysk na timerze.
4. **Ranking nie zastępuje planu** — B-05/F-07 mają już wpisy w `roadmap.md`; ten research porządkuje *dlaczego* ta kolejność ma sens dowodowo.

---

## Historical Context

- [`context/changes/repo-map-analysis/research.md`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/98860eba8c2543dc7e88d7cd607ed7a257b79395/context/changes/repo-map-analysis/research.md) — źródło problemów i blast radius
- [`context/archive/2026-05-28-first-pomodoro-cycle/plan.md`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/98860eba8c2543dc7e88d7cd607ed7a257b79395/context/archive/2026-05-28-first-pomodoro-cycle/plan.md) — birth of monolithic hook (K1)
- [`context/archive/2026-05-29-guest-local-storage-merge/`](https://github.com/konrad-kaluzny-ceneo/FlowState/tree/98860eba8c2543dc7e88d7cd607ed7a257b79395/context/archive/2026-05-29-guest-local-storage-merge) — data-mode + guest merge (K2, K3)
- [`context/foundation/roadmap-references/items/F-07.md`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/98860eba8c2543dc7e88d7cd607ed7a257b79395/context/foundation/roadmap-references/items/F-07.md) — wedge conductor (K5)
- [`context/foundation/flow-coherence-recommendations.md`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/98860eba8c2543dc7e88d7cd607ed7a257b79395/context/foundation/roadmap-references/flow-coherence-recommendations.md) — B-05 → F-07 sequence

---

## Related Research

- [`context/map/artifact-1-territory.md`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/98860eba8c2543dc7e88d7cd607ed7a257b79395/context/map/artifact-1-territory.md) — git co-change
- [`context/map/artifact-2-structure.md`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/98860eba8c2543dc7e88d7cd607ed7a257b79395/context/map/artifact-2-structure.md) — depcruise, sign-in cycle, K4 fix hint

---

## Weryfikacja twierdzeń (ast-grep)

Narzędzia: `ast-grep` 0.43.0 (`sg --pattern`), `depcruise` (fan-in/out), `rg` dla zer ast-grep. Commit weryfikacji: [`98860eb`](https://github.com/konrad-kaluzny-ceneo/FlowState/commit/98860eba8c2543dc7e88d7cd607ed7a257b79395).

### Twierdzenia strukturalne → wynik

| # | Twierdzenie (ranking / kandydat) | Wzorzec / reguła | Werdykt | Dowód |
|---|----------------------------------|------------------|---------|-------|
| V1 | K1: hook **2358 LOC** | `(Get-Content …).Count` | **Doprecyzowane → 2357** | `src/hooks/use-pomodoro-cycle.ts` — 2357 linii |
| V2 | K1: return API **63 klucze** | parse `return {` L2281+ | **Potwierdzone** | 63 klucze L2282–2355 |
| V3 | K1: jedyne prod. `usePomodoroCycle()` | `sg 'usePomodoroCycle($$$)' src/app` + `rg 'usePomodoroCycle\(' src/app` | **Potwierdzone** | Call L62 — `pomodoro-dashboard.tsx`; 0 innych w `src/app` |
| V4 | K1: **19 fan-out / 9 fan-in** | `depcruise --focus src/hooks/use-pomodoro-cycle.ts` JSON | **Potwierdzone** | 19 followable deps; 9 dependents (dashboard, timer-panel, 4 overlaye, guest-import, e2e-expose, 2× test) |
| V5 | K1: brak sub-hooków `useTimer` / `useSuggestions` | `rg 'useTimer\|useSuggestions' src/hooks` | **Potwierdzone** | 0 hitów |
| V6 | K1/K2: `api.checkIn` + `api.suggestion` w hooku | `sg 'api.checkIn'`, `sg 'api.suggestion'` w hooku | **Doprecyzowane** | L303 (`checkIn.create`), L304–306 (`suggestion.*`); raport: L304–307 |
| V7 | K2: `useRepositories()` w hooku | `sg 'useRepositories' src/hooks/use-pomodoro-cycle.ts` | **Doprecyzowane** | Import L13; call L225 (raport: L226) |
| V8 | K2: `api.task.list.useSuspenseQuery` tylko w dashboardzie auth | `sg 'api.task.list.useSuspenseQuery' src` | **Potwierdzone** | Jedyny hit: `pomodoro-dashboard.tsx:452` |
| V9 | K2: hook czyta `task.list` imperatywnie | `sg 'utils.client.task.list.query'` → 0; `rg 'utils\.client\.task'` | **Doprecyzowane** | L650–656: `utils.client.task?.list?.query` przypisane do `queryTasks`, potem `queryTasks()` — nie literal `utils.client.task.list.query()` |
| V10 | K2: `refreshGuest` no-op | `rg 'refreshGuest'` w `data-mode-context.tsx` | **Potwierdzone** | L37, L104: `refreshGuest: () => {}` |
| V11 | K2: brak `CheckInRepository` / `SuggestionRepository` | `sg 'CheckInRepository' src`; `sg 'SuggestionRepository' src` → 0; `rg 'interface.*Repository' types.ts` | **Potwierdzone** | Tylko `TaskRepository`, `CycleRepository`, `SessionRepository` — `types.ts:75–130` |
| V12 | K2: cykl/sesja przez repo, nie `api.cycle` | `rg 'api\.cycle' hook`; `rg 'cycles\.' hook` | **Potwierdzone** | 0× `api.cycle`; `cycles.create` L1402, L1598; `cycles.complete` L1652, L1723, L2047; `sessions.getOrCreateActive` L1103, L1381, L1974 |
| V13 | K2: `tasks.update` przez repo | `rg 'tasks\.update' hook` | **Potwierdzone** | L1867, L1872 |
| V14 | K3: prod UI nie woła `api.guest` | `sg 'api.guest' src` → 0; `rg 'api\.guest' src` | **Potwierdzone** | 0 hitów w `src/` (router testowany przez `guest.test.ts` poza UI) |
| V15 | K3: merge UI przez server action | `sg 'importGuestSnapshotAction' guest-import-on-mount.tsx` | **Doprecyzowane** | Import L5; await L57 (raport: L58) |
| V16 | K3: **9 prod** importerów `guest/store` | `rg "from ['\"]~/lib/guest/store"` w `src/` minus `*.test.*` | **Potwierdzone** | 9 plików: `guest-repositories`, `import-guard`, `use-domain-tasks`, `use-return-handoff`, `narrative-context`, `defer`, `use-onboarding-state`, `use-pomodoro-cycle`, `guest-import-on-mount` |
| V17 | K4: cykl `action.ts` ↔ `sign-in-form.tsx` | `sg 'import type { SignInFormState }' sign-in`; `sg 'signInAction' sign-in-form` | **Potwierdzone** | `action.ts:6` → form; `sign-in-form.tsx:8` → action |
| V18 | K4: sign-in **brak** `schema.ts` | `glob sign-in/schema.ts` | **Potwierdzone** | 0 plików |
| V19 | K4: sign-up/forgot/reset mają `schema.ts` | `rg 'from ["\']\./schema' src/app/auth/{sign-up,forgot-password,reset-password}` | **Potwierdzone** | `SignUpFormState` / `ForgotPasswordFormState` / `ResetPasswordFormState` w `*/schema.ts` |
| V20 | K5: **0** plików `*conductor*` | `glob **/*conductor* src` | **Potwierdzone** | 0 plików |
| V21 | K5: kickoff guard **bez** `pendingClosureLine` | read `pomodoro-dashboard.tsx` L371–375 | **Potwierdzone** | Guard: `awaitingKickoffReadiness` + 3 negacje; brak `!pendingClosureLine` |
| V22 | K5: `SessionClosureOverlay` **bez** guarda kickoff | read L390–395 | **Potwierdzone** | Warunek: tylko `pendingClosureLine != null` |
| V23 | K5: **~15** lokalnych `show*` | `rg 'const show' pomodoro-dashboard.tsx` | **Doprecyzowane → 8** | `showTimer`, `showSuggestionCard`, `showKickoffCard`, `showKickoffDurationChips`, `showCycleCompleteCatchUp`, `showCheckInCatchUp`, `showSuggestionCatchUp`, `showInFlowSummary` (L82–145) |
| V24 | K5: kickoff effect L1082–1109 | read hook L1082–1114 | **Doprecyzowane** | `useEffect` L1082–1114 (deps array L1110–1114); async IIFE kończy L1109 |
| V25 | K1: **~40** `useState` w hooku | `rg 'useState' use-pomodoro-cycle.ts` | **Doprecyzowane → 43** | 43 dopasowania (w tym typy generyczne `useState<…>`) |
| V26 | K1: **65** testów hooka (61+4) | `rg '^\s*(it\|test)\(' use-pomodoro-cycle*.test.tsx` | **Potwierdzone** | 61 + 4 |
| V27 | K1: test hooka **2854 LOC** | `(Get-Content use-pomodoro-cycle.test.tsx).Count` | **Potwierdzone** | 2854 linii (+ 292 guest = 3146 łącznie) |
| V28 | K2/K3: `data-mode-context` **0** testów | `glob **/*data-mode-context*.test*` | **Potwierdzone** | 0 plików |
| V29 | K3: `guest.test.ts` **8** przypadków | `rg '^\s*it\(' guest.test.ts` | **Potwierdzone** | 8× `it` |
| V30 | K5: auth przekazuje `enable*Gate`, guest nie | `rg 'enableCheckInGate' pomodoro-dashboard.tsx` | **Potwierdzone** | Domyślne L34–36; auth L485–487; `GuestPomodoroDashboard` L510–515 bez propsów |

### Wzorce ast-grep (kopiowalne)

```bash
# K1 — prod caller
sg --pattern 'usePomodoroCycle($$$)' src/app
rg 'usePomodoroCycle\(' src/app

# K2 — dual data access
sg --pattern 'api.task.list.useSuspenseQuery' src
sg --pattern 'api.checkIn' src/hooks/use-pomodoro-cycle.ts
sg --pattern 'api.suggestion' src/hooks/use-pomodoro-cycle.ts
sg --pattern 'useRepositories' src/hooks/use-pomodoro-cycle.ts
rg 'utils\.client\.task' src/hooks/use-pomodoro-cycle.ts

# K3 — merge paths
sg --pattern 'importGuestSnapshotAction' src/app/_components/guest-import-on-mount.tsx
rg 'api\.guest' src

# K4 — sign-in cycle
sg --pattern 'import type { SignInFormState }' src/app/auth/sign-in

# K5 — mutex gap
rg 'awaitingKickoffReadiness|pendingClosureLine' src/app/_components/pomodoro-dashboard.tsx

# Fan-out/in
pnpm exec depcruise src/hooks/use-pomodoro-cycle.ts --include-only "^src" --output-type metrics
```

### Wnioski korekcyjne

1. **LOC hooka 2357, nie 2358** — różnica ±1 linia; bez wpływu na ranking.
2. **Odczyt `task.list` w hooku** — ten sam kanał cache co RQ, ale przez `utils.client.task?.list?.query` z optional chaining, nie literal z raportu — **dual read nadal zachowany** (K2).
3. **`show*` w dashboardzie: 8, nie ~15** — raport zawierał overlaye warunkowe bez prefiksu `show*`; **K5** (rozproszona orchestracja JSX) **bez zmiany werdyktu**; liczba nie wpływa na T-01.
4. **`useState` 43, nie ~40** — marginalne; K1 monolith verdict bez zmiany.

### Wpływ na ranking — do decyzji na etapie planowania

Żadne twierdzenie **nie obala** pozycji kandydatów w rankingu. Doprecyzowania V1, V9, V23, V25 to korekty metryk, nie zmiana diagnozy strukturalnej. V9 potwierdza dual read (dashboard `useSuspenseQuery` + hook imperative fetch), nie go obala.

---

## Open Questions

1. **K3:** Czy konsolidacja merge powinna zostać przy server action (jak sign-in/sign-up) czy wrócić do tRPC — brak ADR po `ed6e9f0`.
2. **K5/F-07:** Lokalizacja conductora (`src/lib/` vs hook vs dashboard) — open question w F-07.md.
3. **K2:** Czy `refreshGuest` / `refreshKey` miały triggerować re-render guest repos — **unknown** (pole nigdy nie inkrementowane).
4. **P27:** Które usunięte specy E2E nie mają odpowiednika w belt — wymaga wiedzy autora (repo-map §7).
