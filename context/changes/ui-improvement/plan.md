# UI Improvement — Makieta Polish & "Coming Soon" Surfacing — Implementation Plan

## Overview

Fazowy pass dopracowujący UI FlowState na pięciu widokach (Fokus, Zadania, Plan dnia, Podsumowanie, Ustawienia) plus cienka warstwa danych „energii dnia". Celem jest zbliżenie aplikacji do makiet z `context/foundation/makiety/` (estetyka wellbeing: miękkie karty, whitespace, spokój) oraz zasygnalizowanie zaplanowanych funkcji (kalendarz, MCP) jako estetycznych, rozmytych podglądów „Wkrótce". Pracujemy na gałęzi `features/ui-refactor` (PR do merge do `main`).

## Current State Analysis

Pełne findingi: [research.md](research.md). Skrót:

- **Home == Focus**: `/` i `/focus` renderują ten sam `PomodoroDashboard` ([pomodoro-dashboard.tsx:119](src/app/_components/pomodoro-dashboard.tsx)). Punkty 1–5 dotykają jednego drzewa.
- **Energia + cel sesji** dzielą [session-steering-card.tsx](src/app/_components/session-steering-card.tsx) (`SessionEnergyCard` :14-52, `SessionFocusCard` :54-144) i hook [use-pomodoro-cycle.ts](src/hooks/use-pomodoro-cycle.ts) (`showSessionFocus`, `completeSessionFocus`, `skipSessionFocus`, `completeSessionEnergy`). Widoczność gate'owana raz-na-dzień przez [day-start-gate.tsx](src/app/_components/day-start-gate.tsx) (sessionStorage po `localDateKey`).
- **Energia = zapis per-cykl**: `checkIn.create({ cycleId, energy })` w [check-in.ts:19](src/server/api/routers/check-in.ts); `CheckIn.cycleId @unique`, brak update, brak rekordu per-dzień. **Nie da się ustawić energii bez cyklu.**
- **DayPlan** ma per-dniowy rekord z unikalnością `userId+localDateKey` — idealne miejsce na „energię dnia".
- **Plan dnia** = stub budżetu ([plan-dnia-view.tsx](src/app/_components/plan-dnia-view.tsx)); brak osi czasu.
- **Podsumowanie** ([podsumowanie-view.tsx:235](src/app/_components/podsumowanie-view.tsx)) ma pusty, zarezerwowany `summary-footer-hero` (:500-506) i płaskie stuby „wkrótce"; brak listy ukończonych. `recap.getDaily` zwraca `last24Hours: RecapTaskRow[]` (tytuł, minuty, czas) **bez** `workType`/`effortMinutes`.
- **Ustawienia** ([ustawienia-view.tsx:95](src/app/_components/ustawienia-view.tsx)) = jedna kolumna, 4 sekcje; makieta chce dwie kolumny z paskiem tabów; brak tabu Integracje.
- **Design tokeny dojrzałe** (Tailwind v4 `@theme` w [globals.css](src/styles/globals.css)); rozjazd: komponenty używają `rounded-lg`+ramki zamiast miękkich `rounded-card`+cień.
- **Assety hero** (light+dark) już w `public/images/heroes/` i podpięte w `globals.css`.
- **Kontrakt E2E**: usunięcie `quick-action-view-tasks` i celu sesji łamie specy.

## Desired End State

Po ukończeniu planu, zalogowany użytkownik:
- Na starcie dnia widzi jedną estetyczną bramkę „Jaką masz dziś energię?" (bez „celu sesji"); wybór zapisuje się jako energia dnia i jest edytowalny w Ustawieniach.
- Na Fokus bez aktywnych zadań widzi hero „Twój dzień czeka na Ciebie" z przyciskiem „Dodaj pierwsze zadanie" (modal) obok bloczków „Twój dzień" i „Wskazówka na dziś"; brak przycisku „Zadania".
- W Zadaniach widzi ostylowane, spokojne karty zgodne z makietą (bez zmiany zawartości/akcji).
- W Planie dnia widzi rozmyty podgląd kalendarza z etykietą „Kalendarz wkrótce".
- W Podsumowaniu widzi spokojny baner motywujący i ostylowaną listę zadań ukończonych w ostatnich 24h.
- W Ustawieniach widzi dwukolumnowy układ tabów (tylko działające sekcje), sekcję edycji energii dnia oraz tab Integracje z rozmytym podglądem połączenia MCP „wkrótce".

Weryfikacja: `pnpm typecheck`, `pnpm lint`, `pnpm test` zielone; naprawione czerwone specy E2E; manualny obchód każdego widoku zgodny z makietą.

### Key Discoveries:

- Energia da się „udniowić" przez [prisma/schema.prisma](prisma/schema.prisma) `DayPlan` (istniejąca unikalność `userId+localDateKey`) — bez nowej tabeli.
- `recap.getDaily` / `RecapTaskRow` w [build-daily-recap.ts:19](src/lib/recap/build-daily-recap.ts) + [recap/types.ts:1](src/lib/recap/types.ts) — źródło listy ukończonych „w 24h"; brakuje tylko `workType`+`effortMinutes` w `select`.
- Hero rastry gotowe: `public/images/heroes/onboarding-hero.png`, `focus-session-bg.png`, `summary-footer.png` (+ `-dark`).
- Lesson „Test every wedge transition" — Faza 2 (usunięcie celu sesji) musi mieć oracle dismiss dla bramki energii.

## What We're NOT Doing

- **Nie** dodajemy sekcji Ustawień bez działającej logiki (Prywatność, format czasu, auto-start przerw, kopie zapasowe) — ignorujemy je (nie jako „wkrótce").
- **Nie** przebudowujemy szczegółów zadania na stały prawy panel — zostają (ostylowanym) modalem.
- **Nie** zmieniamy zawartości/akcji kart zadań — tylko wygląd.
- **Nie** robimy parytetu gościa — gość dostaje tylko odświeżone puste stany/prompty logowania.
- **Nie** ruszamy globalnych prymitywów `ui/` (Button/Tabs/Select radii) — token-pass per widok.
- **Nie** usuwamy end-of-cycle check-inów energii (per-cykl) — zostają dla narracji/wind-down.
- **Nie** implementujemy realnego kalendarza ani MCP — tylko rozmyte podglądy „wkrótce".
- **Nie** mnożymy nowych testów E2E — nowe pokrycie w unit/integration; E2E tylko naprawa czerwonych (+ ewentualnie trywialne, stabilne, szybkie).

## Implementation Approach

Backend energii najpierw (Faza 1), bo od niego zależy UI energii (Fazy 2 i 7). Najbardziej ryzykowny refactor stanu — usunięcie „celu sesji" ze splecionego steering/conductor — izolowany w Fazie 2 z własną bramką weryfikacji i oracle przejść. Fazy widoków (3–7) są w większości niezależne; estetyka (pkt 11) realizowana w każdej z nich jako per-widok token-pass (miękkie `rounded-card`, `shadow-sm`, większy whitespace, większe nagłówki) zgodnie z [DESIGN.md](DESIGN.md). Wzorzec „Wkrótce" = jeden współdzielony komponent renderujący realistyczny mock + blur + scrim + etykieta; wprowadzony w Fazie 5, reużyty w Fazach 6–7. i18n zawsze w obu plikach (`messages/pl.json` + `en.json`).

## Critical Implementation Details

- **Priorytet źródeł energii (Faza 1–2):** `DayPlan.energyLevel` staje się autorytatywną „energią dnia" — ustawianą przez bramkę day-start i edytowalną w Ustawieniach, oraz bazą dla sugestii na starcie dnia. Istniejące per-cyklowe check-iny (`CheckIn`) pozostają nietknięte i nadal zasilają narrację/wind-down w trakcie sesji. Gdy oba istnieją, per-cyklowy check-in jest „świeższą" energią w obrębie sesji; energia dnia jest bazą do wyświetlania i do pierwszej sugestii dnia. Nie tworzymy nowej tabeli.
- **Rozplecenie celu sesji (Faza 2):** bramka day-start po usunięciu celu sesji musi zostać jedną bramką (tylko energia). Usuwając `showSessionFocus`/`completeSessionFocus`/`skipSessionFocus`, zachować `steeringCompletedRef`/dismiss dla energii, aby przejście po wyborze energii domykało się przed kolejnym beatem (lesson). Bramka energii pisze teraz do `DayPlan.energyLevel` (bez `cycleId`), nie przez `checkIn.create`.
- **Definicja „ukończone dziś" (Faza 6):** = `recap.getDaily.last24Hours` przefiltrowane do faktycznie ukończonych (status/`completedWithoutCycle`), w oknie 24h. Nie budujemy osobnego „completed today" po `localDateKey`.
- **ComingSoonPreview a11y (Faza 5):** rozmyty mock oznaczony `aria-hidden`; etykieta „Wkrótce" jako widoczny, odczytywalny tekst, żeby czytnik ekranu nie zgłaszał dekoracyjnej treści mocka.

---

## Phase 1: Backend „energii dnia" (DayPlan.energyLevel)

### Overview

Dodać per-dniowe pole energii do `DayPlan` i endpointy odczytu/zapisu, tak by energię można było ustawić i zmienić bez uruchamiania cyklu. Fundament pod Fazy 2 i 7.

### Changes Required:

#### 1. Prisma model

**File**: `prisma/schema.prisma`

**Intent**: Dodać opcjonalne pole energii do istniejącego per-dniowego rekordu `DayPlan`, żeby reprezentować „energię dnia" niezależną od cykli.

**Contract**: Nowe pole `energyLevel EnergyLevel?` (istniejący enum `FOCUSED|STEADY|FADING`) w modelu `DayPlan`; zachowana unikalność `userId+localDateKey`. Migracja Prisma (nullable, brak backfillu).

#### 2. tRPC — get/set energii dnia

**File**: `src/server/api/routers/day-plan.ts` (istniejący router DayPlan; jeśli osobny, dołączyć do niego)

**Intent**: Udostępnić odczyt energii dla „dziś" (prefill kontrolki) i zapis/aktualizację energii dnia (upsert po `userId+localDateKey`).

**Contract**: `getTodayEnergy({ localDateKey }) -> EnergyLevel | null`; `setTodayEnergy({ localDateKey, energy }) -> { energyLevel }`. Upsert rekordu DayPlan (nie wymaga istniejącego planu/budżetu). `protectedProcedure`.

#### 3. Klient — hook odczytu/zapisu

**File**: `src/hooks/` (nowy hook np. `use-day-energy.ts` lub rozszerzenie `use-day-plan.ts`)

**Intent**: Cienki hook opakowujący query+mutację energii dnia z optymistyczną aktualizacją (NFR 200ms per surface, lesson L-04).

**Contract**: `useDayEnergy()` zwraca `{ energy, setEnergy, isSaving }`; `localDateKey` z istniejącego helpera czasu.

### Success Criteria:

#### Automated Verification:

- Migracja aplikuje się czysto: `pnpm prisma migrate dev` (lub projektowy skrypt migracji)
- Typecheck: `pnpm typecheck`
- Lint: `pnpm lint`
- Testy jednostkowe/integracyjne routera przechodzą: `pnpm test` (get zwraca null gdy brak; set upsertuje; drugi set nadpisuje; izolacja per `localDateKey`)

#### Manual Verification:

- `setTodayEnergy` tworzy/aktualizuje energię bez istniejącego cyklu ani budżetu
- `getTodayEnergy` zwraca ostatnio zapisaną wartość dla dzisiejszego klucza daty

**Implementation Note**: Po przejściu automatów zatrzymać się na potwierdzenie manualne przed Fazą 2.

---

## Phase 2: Fokus — usunięcie „celu sesji" + bramka energii wg makiety

### Overview

Usunąć całkowicie feature „Na czym się skupiasz w tej sesji?" i przestylizować pytanie o energię do postaci jednej bramki raz-na-dzień zgodnej z makietą, piszącej do `DayPlan.energyLevel`. Najbardziej ryzykowna faza (splecione steering/conductor).

### Changes Required:

#### 1. Usunięcie SessionFocusCard i jego stanu

**Files**: `src/app/_components/session-steering-card.tsx`, `src/app/_components/pomodoro-dashboard.tsx`, `src/hooks/use-pomodoro-cycle.ts`, `src/lib/home/home-session-state.ts`, `src/lib/session/narrative-copy.ts`

**Intent**: Wyciąć `SessionFocusCard` (:54-144) oraz całą ścieżkę celu sesji — bez naruszania `SessionEnergyCard` w tym samym pliku.

**Contract**: Usunąć komponent `SessionFocusCard`; usunąć montaż + handlery `handleCompleteFocus`/`handleSkipFocus` w `pomodoro-dashboard.tsx`; usunąć `showSessionFocus`/`completeSessionFocus`/`skipSessionFocus` z `use-pomodoro-cycle.ts` i derywację w `home-session-state.ts`; usunąć opcje intencji w `narrative-copy.ts` jeśli nieużywane gdzie indziej. Zachować invariant conductora „max 1 bramka".

#### 2. Restyling bramki energii wg makiety

**Files**: `src/app/_components/session-steering-card.tsx` (`SessionEnergyCard`), `src/app/_components/energy-selector.tsx`

**Intent**: Nadać karcie energii wygląd z makiety — nagłówek „Jaką masz dziś energię?", podtytuł, trzy karty (Skupiony/Stabilny/Słabnący) z ikonami, hint „Zawsze możesz to zmienić w ustawieniach dnia", przycisk „Dalej".

**Contract**: Zmienione klucze i18n nagłówka/CTA (patrz #4); układ i klasy zgodne z makietą (miękkie karty, energy tokeny). Zachowane `data-testid` selektora energii.

#### 3. Zapis energii do DayPlan zamiast check-inu

**Files**: `src/app/_components/pomodoro-dashboard.tsx`, `src/hooks/use-pomodoro-cycle.ts` (lub `day-start-gate.tsx`)

**Intent**: Bramka energii zapisuje energię dnia przez `setTodayEnergy` (Faza 1), nie przez `checkIn.create` (który wymaga cyklu). Sugestia startowa czyta energię dnia z DayPlan.

**Contract**: `handleCompleteEnergy` woła `useDayEnergy().setEnergy`; usunąć zależność startowej energii od `createCheckIn`. Zachować gating raz-na-dzień (`day-start-gate` po `localDateKey`). End-of-cycle check-iny bez zmian.

#### 4. i18n

**Files**: `messages/pl.json`, `messages/en.json`

**Intent**: Zaktualizować teksty energii do makiety; usunąć klucze celu sesji.

**Contract**: `SessionSteering.energyHeading` → „Jaką masz dziś energię?"; dodać CTA „Dalej"/hint; usunąć `SessionSteering.focus*`. Oba języki.

### Success Criteria:

#### Automated Verification:

- Typecheck: `pnpm typecheck`
- Lint: `pnpm lint`
- Testy jednostkowe/hooka: `pnpm test` — nowy oracle: po wyborze energii bramka domyka się i nie pojawia się ponownie tego dnia; brak martwych referencji do celu sesji
- Naprawione czerwone specy E2E steering/transition: `pnpm exec playwright test <affected specs>` (per-spec, wg lesson)

#### Manual Verification:

- Brak jakiegokolwiek śladu „celu sesji" w przepływie
- Bramka energii wygląda jak makieta, znika po wyborze, nie wraca tego dnia
- Wybór energii zapisuje `DayPlan.energyLevel` (widoczne po odświeżeniu / w Ustawieniach po Fazie 7)
- Brak regresji przejść cyklu (start → praca → przerwa → check-in)

**Implementation Note**: Zatrzymać się na potwierdzenie manualne — to faza wysokiego ryzyka regresji przejść.

---

## Phase 3: Fokus — pusty stan „Twój dzień czeka na Ciebie" + Szybkie akcje

### Overview

Zbudować pusty stan Fokus zgodny z makietą i uporządkować Szybkie akcje: usunąć przycisk „Zadania", przepiąć „Dodaj zadanie" na modal.

### Changes Required:

#### 1. Pusty stan Fokus z hero

**Files**: `src/app/_components/pomodoro-dashboard.tsx`, nowy/rozszerzony komponent pustego stanu (bazując na `empty-active-tasks-guide.tsx`), `src/styles/globals.css`

**Intent**: Gdy brak aktywnego/następnego zadania, pokazać duży hero „Twój dzień czeka na Ciebie" + podtytuł + przycisk „Dodaj pierwsze zadanie" (otwiera modal), z grafiką krajobrazu z `public/images/heroes/`.

**Contract**: Warunek pustego stanu w regionie primary; tło hero przez klasę CSS analogiczną do `.summary-footer-hero` wskazującą `onboarding-hero.png`/`focus-session-bg.png` (+ dark). Przycisk wyzwala `AddTaskModal`. Zachowane bloczki `HomeFocusSummary` („Twój dzień") i `FocusTip` („Wskazówka").

#### 2. Quick Actions — usunięcie „Zadania", przepięcie „Dodaj zadanie"

**File**: `src/app/_components/quick-actions.tsx`

**Intent**: Usunąć akcję „Zadania" (`quick-action-view-tasks`); „Dodaj zadanie" otwiera modal zamiast linkować do `/tasks`; dopasować zestaw akcji do makiety (Dodaj zadanie, Zaplanuj dzień/Plan dnia, Rozpocznij sesję).

**Contract**: Usunięty `Link` do `/tasks` z testid `quick-action-view-tasks`; „Dodaj zadanie" jako przycisk wywołujący modal (przekazać handler/context). Zaktualizować zależne E2E.

#### 3. Modal add-task dostępny z Fokus

**Files**: `src/app/_components/pomodoro-dashboard.tsx` (lub shell), `src/app/_components/add-task-modal.tsx`

**Intent**: Udostępnić `AddTaskModal` na widoku Fokus (stan otwarcia + create), by pusty stan i quick action mogły go otwierać.

**Contract**: Stan `showAddModal` na poziomie dashboardu; `onCreate` przez istniejącą mutację task.create (optymistycznie).

#### 4. i18n

**Files**: `messages/pl.json`, `messages/en.json`

**Intent**: Teksty pustego stanu i quick actions wg makiety.

**Contract**: Nowe klucze pustego stanu Fokus („Twój dzień czeka na Ciebie", podtytuł, „Dodaj pierwsze zadanie"); usunąć `QuickActions.viewTasks`. Oba języki.

### Success Criteria:

#### Automated Verification:

- Typecheck: `pnpm typecheck`
- Lint: `pnpm lint`
- Testy komponentu: `pnpm test` — pusty stan renderuje CTA i otwiera modal; quick actions nie zawiera „Zadania"
- Naprawione czerwone E2E odnoszące się do `quick-action-view-tasks`

#### Manual Verification:

- Fokus bez zadań wygląda jak makieta (hero, „Dodaj pierwsze zadanie", „Twój dzień", „Wskazówka")
- „Dodaj zadanie" (pusty stan i quick action) otwiera modal, tworzy zadanie
- Brak przycisku „Zadania" na stronie głównej

**Implementation Note**: Zatrzymać się na potwierdzenie manualne.

---

## Phase 4: Widok Zadania — restyling

### Overview

Ostylować widok Zadania do makiety (miękkie karty, badge, odstępy, footer „Zasada FlowState") bez zmiany zawartości, akcji ani modala szczegółów.

### Changes Required:

#### 1. Restyling wierszy/kart zadań

**Files**: `src/app/_components/task-list.tsx`, `src/lib/design/work-type-config.ts`

**Intent**: Podnieść wygląd wierszy do makiety — miękka karta (`rounded-card`, `shadow-sm`, subtelna ramka), czytelny tytuł, wyraźniejszy badge typu, kapsułka czasu; zachować checkbox/drag/focus/delete/kebab.

**Contract**: Zmiany klas Tailwind w `SortableTaskRow`/`StaticTaskRow`; badge typu wg `work-type-config.ts` (bez zmiany semantyki). Zachowane wszystkie `data-testid` i logika akcji.

#### 2. Taby, filtry, inline add, footer

**Files**: `src/app/_components/task-list.tsx`, `src/app/tasks/page.tsx`

**Intent**: Dopasować pasek tabów (Aktywne/Planowane/Ukończone) i filtry (typ, sort) oraz inline „+ Dodaj zadanie / lub naciśnij Enter"; dodać stopkę „Zasada FlowState" z ilustracją (calm-garden sprig).

**Contract**: Reużycie `ui/tabs.tsx`, `ui/select.tsx`; nowa sekcja footer-tip; kontener strony wg makiety (whitespace, `max-w`). Ignorujemy toggle grid (nie istnieje — nic nie dodajemy).

#### 3. i18n

**Files**: `messages/pl.json`, `messages/en.json`

**Intent**: Tekst „Zasada FlowState" (footer) jeśli brak.

**Contract**: Nowe klucze footer-tip w namespace `Tasks`. Oba języki.

### Success Criteria:

#### Automated Verification:

- Typecheck: `pnpm typecheck`
- Lint: `pnpm lint`
- Testy: `pnpm test` — istniejące testy task-list zielone (bez zmian kontraktu akcji)

#### Manual Verification:

- Widok Zadania wygląda jak makieta (spokojne karty, badge, footer)
- Wszystkie akcje (complete, drag-reorder, focus, delete, edycja w modalu) działają jak wcześniej
- Brak regresji w tabach/filtrach/sortowaniu

**Implementation Note**: Zatrzymać się na potwierdzenie manualne.

---

## Phase 5: Plan dnia — kalendarz „Kalendarz wkrótce" + wspólny ComingSoonPreview

### Overview

Wprowadzić współdzielony komponent „Wkrótce" (blur) i użyć go do rozmytego podglądu kalendarza dnia zgodnego z makietą.

### Changes Required:

#### 1. Współdzielony ComingSoonPreview

**File**: `src/app/_components/ui/coming-soon-preview.tsx` (nowy)

**Intent**: Reużywalny wrapper renderujący realistyczny mock funkcji pod nałożonym blurem + delikatnym scrimem + widoczną etykietą „Wkrótce".

**Contract**: `ComingSoonPreview({ label, children })`; mock `aria-hidden`, etykieta jako odczytywalny tekst; blur przez `filter/backdrop-filter`; zgodne z DESIGN.md (bez glassmorphism poza tym efektem). Reużyty w Fazach 6–7.

#### 2. Podgląd kalendarza w Planie dnia

**Files**: `src/app/_components/plan-dnia-view.tsx`, `src/app/plan/page.tsx`

**Intent**: Pokazać rozmyty podgląd osi czasu 08:00–18:00 z kolorowymi blokami (Skupienie/Spotkanie/Przerwa/Osobiste) wg makiety, z etykietą „Kalendarz wkrótce"; zachować/estetycznie osadzić istniejący panel budżetu.

**Contract**: Statyczny mock siatki godzinowej owinięty w `ComingSoonPreview`; layout zbliżony do makiety (główna kolumna + opcjonalny rail). Bez realnej logiki kalendarza.

#### 3. i18n

**Files**: `messages/pl.json`, `messages/en.json`

**Intent**: Etykieta „Kalendarz wkrótce" + ewentualne etykiety bloków mocka.

**Contract**: Nowe klucze w namespace `PlanDnia`. Oba języki.

### Success Criteria:

#### Automated Verification:

- Typecheck: `pnpm typecheck`
- Lint: `pnpm lint`
- Testy komponentu: `pnpm test` — `ComingSoonPreview` renderuje etykietę i oznacza mock `aria-hidden`; plan renderuje podgląd „Kalendarz wkrótce"

#### Manual Verification:

- Plan dnia pokazuje estetyczny, rozmyty kalendarz z „Kalendarz wkrótce"
- Istniejący budżet skupienia nadal działa i wygląda spójnie

**Implementation Note**: Zatrzymać się na potwierdzenie manualne.

---

## Phase 6: Podsumowanie — tekst motywujący + lista dziś ukończonych

### Overview

Wypełnić baner motywujący i dodać ostylowaną listę zadań ukończonych w ostatnich 24h; rozszerzyć dane recap o typ i czas zadania.

### Changes Required:

#### 1. Rozszerzenie danych recap o workType + effortMinutes

**Files**: `src/lib/recap/build-daily-recap.ts`, `src/lib/recap/types.ts`, `src/server/api/routers/recap.ts`

**Intent**: Dodać `workType` i `effortMinutes` do `RecapTaskRow`, by lista ukończonych mogła pokazać badge typu i czas.

**Contract**: `RecapTaskRow` +`workType: WorkType` +`effortMinutes: number | null`; `build-daily-recap` dobiera te pola w `select`. Bez zmiany definicji okna 24h.

#### 2. Lista dziś ukończonych w Podsumowaniu

**Files**: `src/app/_components/podsumowanie-view.tsx`, `src/app/summary/page.tsx`

**Intent**: Pod donutem „Zadania" wyrenderować ostylowaną listę zadań ukończonych w 24h (tytuł, badge typu, czas), zasilaną z `recap.getDaily.last24Hours` przefiltrowaną do ukończonych.

**Contract**: Nowa sekcja listy; źródło `getDaily` (dodać do fetchy strony jeśli trzeba); filtr ukończonych po statusie/`completedWithoutCycle`. Reużycie stylu kart/badge z Fazy 4.

#### 3. Baner motywujący (summary-footer-hero)

**Files**: `src/app/_components/podsumowanie-view.tsx`, `messages/pl.json`, `messages/en.json`

**Intent**: Wypełnić istniejący `summary-footer-hero` spokojnym tekstem motywującym zgodnym z tonem marki (opiekun/mentor, nie „produktywnościowo") i grafiką `summary-footer.png`.

**Contract**: Treść w `summary-footer-hero` (już podpięty obraz w `globals.css`); nowe klucze i18n banera. Opcjonalnie podnieść istniejące stuby „Najlepsza pora dnia"/„Nawigacja dat" do `ComingSoonPreview` dla spójności.

### Success Criteria:

#### Automated Verification:

- Typecheck: `pnpm typecheck`
- Lint: `pnpm lint`
- Testy: `pnpm test` — `RecapTaskRow` zawiera nowe pola; podsumowanie renderuje listę ukończonych i baner; filtr ukończonych działa (unit)

#### Manual Verification:

- Podsumowanie pokazuje baner motywujący (spokojny ton) i listę zadań ukończonych w 24h z typem i czasem
- Lista pusta gdy brak ukończonych (stan pusty estetyczny)

**Implementation Note**: Zatrzymać się na potwierdzenie manualne.

---

## Phase 7: Ustawienia — redesign + Integracje (MCP wkrótce) + energia dnia

### Overview

Przebudować Ustawienia do dwukolumnowego układu tabów (tylko działające sekcje), dodać sekcję edycji energii dnia i tab Integracje z rozmytym podglądem MCP „wkrótce".

### Changes Required:

#### 1. Dwukolumnowy layout tabów

**Files**: `src/app/_components/ustawienia-view.tsx`, `src/app/settings/page.tsx`

**Intent**: Zamienić jednokolumnową listę na lewy pasek tabów + prawy panel treści wg makiety, wyłącznie dla sekcji z działającą logiką (Ogólne, Sesje skupienia, Przerwy/Powiadomienia, Wygląd) + Energia dnia + Integracje.

**Contract**: Nawigacja sekcji (reużycie `ui/tabs.tsx` lub lokalny sidebar-nav); reużycie istniejących kontrolek (`DurationPicker`, `LanguageSwitch`, `CycleAudioPreferenceControl`, `OutOfTabBreakAlertsControl`, ThemeToggle, `StyledCheckbox`). Bez sekcji bez logiki.

#### 2. Sekcja „Energia dnia"

**Files**: `src/app/_components/ustawienia-view.tsx`, `src/app/_components/energy-selector.tsx`, `src/hooks/use-day-energy.ts`

**Intent**: Kontrolka edycji energii dnia reużywająca `EnergySelector`, czytająca/pisząca `DayPlan.energyLevel` (Faza 1).

**Contract**: Prefill z `getTodayEnergy`; zapis przez `setTodayEnergy` (optymistycznie). Zachowane `data-testid` selektora.

#### 3. Tab Integracje — MCP „wkrótce"

**Files**: `src/app/_components/ustawienia-view.tsx`, `src/app/_components/ui/coming-soon-preview.tsx`

**Intent**: Nowy tab Integracje z rozmytym podglądem karty połączenia agenta przez MCP i etykietą „wkrótce".

**Contract**: Mock karty MCP owinięty w `ComingSoonPreview` (z Fazy 5); brak realnej logiki połączenia.

#### 4. i18n

**Files**: `messages/pl.json`, `messages/en.json`

**Intent**: Klucze sekcji tabów, „Energia dnia", „Integracje", „MCP wkrótce".

**Contract**: Nowe klucze w namespace `Settings`. Oba języki.

### Success Criteria:

#### Automated Verification:

- Typecheck: `pnpm typecheck`
- Lint: `pnpm lint`
- Testy: `pnpm test` — ustawienia renderują taby; sekcja energii prefill+zapis (integracja z Fazą 1); tab Integracje renderuje podgląd „wkrótce"

#### Manual Verification:

- Ustawienia wyglądają jak makieta (dwie kolumny, taby), bez sekcji bez logiki
- Zmiana energii dnia zapisuje się i utrzymuje po odświeżeniu; spójna z bramką day-start (Faza 2)
- Tab Integracje pokazuje estetyczny, rozmyty podgląd MCP „wkrótce"
- Pełny obchód wszystkich widoków — spójna estetyka wg makiet (pkt 11)

**Implementation Note**: Zatrzymać się na potwierdzenie manualne — to ostatnia faza, wykonać końcowy regression sweep.

---

## Testing Strategy

### Unit / Integration Tests (główny ciężar — wg decyzji):

- Faza 1: router energii dnia — get null gdy brak, set upsert, nadpisanie, izolacja per `localDateKey`.
- Faza 2: hook/komponent — bramka energii domyka się po wyborze i nie wraca tego dnia; brak martwych referencji celu sesji; zapis do DayPlan.
- Faza 4: brak regresji kontraktu akcji task-list (istniejące testy).
- Faza 5: `ComingSoonPreview` — etykieta widoczna, mock `aria-hidden`.
- Faza 6: `RecapTaskRow` z nowymi polami; filtr „ukończone w 24h".
- Faza 7: sekcja energii prefill+zapis; render tabów/Integracji.

### E2E (tylko naprawa czerwonych + ewentualnie trywialne/stabilne/szybkie):

- Naprawa specy łamanych usunięciem `quick-action-view-tasks` (Faza 3) i celu sesji (Faza 2).
- Uruchamiać per-spec (`pnpm exec playwright test e2e/<name>.spec.ts`), pełny belt tylko jako końcowa bramka (lesson).

### Manual Testing Steps:

1. Nowy dzień → bramka „Jaką masz dziś energię?" wygląda jak makieta, wybór znika i nie wraca.
2. Fokus bez zadań → hero „Twój dzień czeka na Ciebie", „Dodaj pierwsze zadanie" otwiera modal.
3. Brak przycisku „Zadania" na stronie głównej.
4. Zadania → spokojne karty wg makiety; wszystkie akcje działają.
5. Plan dnia → rozmyty „Kalendarz wkrótce".
6. Podsumowanie → baner motywujący + lista ukończonych w 24h.
7. Ustawienia → dwie kolumny, energia dnia edytowalna (spójna z bramką), Integracje „MCP wkrótce".

## Performance Considerations

- Energia dnia i lista ukończonych: optymistyczne mutacje / istniejące query — utrzymać perceived latency < 200ms per surface (lesson L-04).
- Blur w `ComingSoonPreview`: statyczny mock, brak animacji; uważać na koszt `backdrop-filter` na dużych obszarach — preferować `filter: blur` na warstwie mocka.

## Migration Notes

- Jedna migracja Prisma (Faza 1): `DayPlan.energyLevel` nullable, bez backfillu. Rollback = usunięcie kolumny (brak danych krytycznych).
- Brak zmian łamiących istniejące dane; check-iny per-cykl nietknięte.

## References

- Research: [research.md](research.md) (sekcja Decisions — wszystkie decyzje projektowe)
- Makiety: `context/foundation/makiety/` (`main-page-ready.png`, `zadania.png`, `plan-dnia.png`, `podsumowanie.png`, `ustawienia.png`, `redesign.md`, `branding.md`)
- Design: [DESIGN.md](DESIGN.md), [globals.css](src/styles/globals.css)
- Roadmap (mapowanie „wkrótce"): S-46 MCP, S-47 delegation, S-48 analytics — [roadmap.md](context/foundation/roadmap.md)
- Lessons: [lessons.md](context/foundation/lessons.md) (wedge transitions, L-04 200ms, E2E per-spec)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Backend „energii dnia" (DayPlan.energyLevel)

#### Automated

- [x] 1.1 Migracja aplikuje się czysto (`pnpm prisma migrate dev`) — 0a754e3
- [x] 1.2 Typecheck przechodzi (`pnpm typecheck`) — 0a754e3
- [x] 1.3 Lint przechodzi (`pnpm lint`) — 0a754e3
- [x] 1.4 Testy routera energii dnia przechodzą (`pnpm test`) — 0a754e3

#### Manual

- [x] 1.5 setTodayEnergy działa bez cyklu ani budżetu (integration: `day-plan.integration.test.ts`) — 0a754e3
- [x] 1.6 getTodayEnergy zwraca ostatnią wartość dla dzisiejszego klucza daty (integration: `day-plan.integration.test.ts`) — 0a754e3

### Phase 2: Fokus — usunięcie „celu sesji" + bramka energii wg makiety

#### Automated

- [ ] 2.1 Typecheck przechodzi
- [ ] 2.2 Lint przechodzi
- [ ] 2.3 Testy hooka/komponentu (oracle domknięcia bramki, brak referencji celu sesji)
- [ ] 2.4 Naprawione czerwone specy E2E steering/transition (per-spec)

#### Manual

- [ ] 2.5 Brak śladu „celu sesji" w przepływie
- [ ] 2.6 Bramka energii wg makiety, znika po wyborze, nie wraca tego dnia
- [ ] 2.7 Wybór energii zapisuje DayPlan.energyLevel
- [ ] 2.8 Brak regresji przejść cyklu

### Phase 3: Fokus — pusty stan + Szybkie akcje

#### Automated

- [ ] 3.1 Typecheck przechodzi
- [ ] 3.2 Lint przechodzi
- [ ] 3.3 Testy komponentu (pusty stan otwiera modal; quick actions bez „Zadania")
- [ ] 3.4 Naprawione czerwone E2E dot. `quick-action-view-tasks`

#### Manual

- [ ] 3.5 Fokus bez zadań wygląda jak makieta (hero, CTA, „Twój dzień", „Wskazówka")
- [ ] 3.6 „Dodaj zadanie" otwiera modal i tworzy zadanie
- [ ] 3.7 Brak przycisku „Zadania" na stronie głównej

### Phase 4: Widok Zadania — restyling

#### Automated

- [ ] 4.1 Typecheck przechodzi
- [ ] 4.2 Lint przechodzi
- [ ] 4.3 Istniejące testy task-list zielone

#### Manual

- [ ] 4.4 Widok Zadania wygląda jak makieta
- [ ] 4.5 Wszystkie akcje działają jak wcześniej (complete/drag/focus/delete/modal)
- [ ] 4.6 Brak regresji tabów/filtrów/sortowania

### Phase 5: Plan dnia — kalendarz „wkrótce" + ComingSoonPreview

#### Automated

- [ ] 5.1 Typecheck przechodzi
- [ ] 5.2 Lint przechodzi
- [ ] 5.3 Testy komponentu (ComingSoonPreview etykieta + aria-hidden; plan renderuje podgląd)

#### Manual

- [ ] 5.4 Plan dnia pokazuje rozmyty „Kalendarz wkrótce"
- [ ] 5.5 Budżet skupienia nadal działa i wygląda spójnie

### Phase 6: Podsumowanie — tekst motywujący + lista dziś ukończonych

#### Automated

- [ ] 6.1 Typecheck przechodzi
- [ ] 6.2 Lint przechodzi
- [ ] 6.3 Testy (RecapTaskRow z workType+effort; filtr ukończonych w 24h; render banera i listy)

#### Manual

- [ ] 6.4 Baner motywujący (spokojny ton) widoczny
- [ ] 6.5 Lista ukończonych w 24h z typem i czasem; pusty stan estetyczny

### Phase 7: Ustawienia — redesign + Integracje (MCP wkrótce) + energia dnia

#### Automated

- [ ] 7.1 Typecheck przechodzi
- [ ] 7.2 Lint przechodzi
- [ ] 7.3 Testy (render tabów; energia prefill+zapis; Integracje podgląd „wkrótce")

#### Manual

- [ ] 7.4 Ustawienia wyglądają jak makieta (dwie kolumny, tylko działające sekcje)
- [ ] 7.5 Energia dnia zapisuje się i jest spójna z bramką day-start
- [ ] 7.6 Tab Integracje pokazuje rozmyty MCP „wkrótce"
- [ ] 7.7 Końcowy sweep — spójna estetyka wg makiet na wszystkich widokach
