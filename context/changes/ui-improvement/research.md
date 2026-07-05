---
date: 2026-07-05T18:05:28+0200
researcher: Konrad Zieliński
git_commit: 62afbc125198d5f0ff9445de07330272aa5a741d
branch: features/ui-refactor
repository: FlowState
topic: "UI polish pass + surfacing 'coming soon' features across Focus, Tasks, Plan, Summary, Settings"
tags: [research, codebase, ui-refactor, focus, tasks, plan, summary, settings, design-system, energy, integrations]
status: complete
last_updated: 2026-07-05
last_updated_by: Konrad Zieliński
---

# Research: UI polish pass + surfacing "coming soon" features

**Date**: 2026-07-05T18:05:28+0200
**Researcher**: Konrad Zieliński
**Git Commit**: 62afbc125198d5f0ff9445de07330272aa5a741d
**Branch**: features/ui-refactor
**Repository**: FlowState

## Research Question

Dopracowanie UI oraz wyświetlenie informacji o przyszłych funkcjonalnościach — 11 punktów:

1. Usunąć całkowicie feature "Na czym się skupiasz w tej sesji?" (cel sesji).
2. Pytanie "Jaką masz dziś energię" ma wyglądać jak na makiecie; energia zmienialna w ustawieniach.
3. Strona Fokus bez następnych zadań ma wyglądać jak na makiecie (duży pusty stan "Twój dzień czeka na Ciebie" + bloczek "Twój dzień" + "Wskazówka na dziś" z elementem wizualnym).
4. Przenieść listę ukończonych zadań ze strony Fokus do zakładki Podsumowanie, poprawić graficznie.
5. Usunąć przycisk "Zadania" ze strony głównej; "Dodaj zadanie" ma być w pustym stanie z pkt 3.
6. Dopasować widok "Zadania" do makiety (zignorować przełącznik widoku kafelkowego).
7. Na widoku "Plan dnia" pokazać kalendarz z makiety, ale z informacją "Kalendarz wkrótce".
8. Wyświetlić tekst motywujący w zakładce Podsumowanie.
9. Zakładka Ustawienia jak na makiecie (użyć feature'ów, które już są w aplikacji).
10. Dodać do Ustawień tab "Integracje" (opcje połączenia agenta przez MCP, z adnotacją "wkrótce").
11. Ponownie sprawdzić makiety z `context/foundation/makiety/` i dopracować stylistykę (aplikacja wciąż mało estetyczna).

Ograniczenie: pracujemy na gałęzi `features/ui-refactor` (PR do zmergowania do `main`), zostajemy na niej.

## Summary

Aplikacja to **Next.js App Router** (React, TypeScript, tRPC, next-intl, Tailwind v4 z tokenami w `@theme`). Kluczowe ustalenie architektoniczne: **root `/` i `/focus` renderują ten sam widok** — `PomodoroDashboard` (`src/app/_components/pomodoro-dashboard.tsx`) wewnątrz `HomeShell`. Dlatego "strona główna" i "Fokus" z punktów 1–5 to jeden ekran.

Stan względem 11 punktów:

| # | Wymaganie | Stan obecny | Skala pracy |
|---|-----------|-------------|-------------|
| 1 | Usunąć "cel sesji" | `SessionFocusCard` w `session-steering-card.tsx`, spleciony z hookiem `use-pomodoro-cycle` i stanem steering | Chirurgiczne usunięcie (nie kasować pliku — dzieli go energia) |
| 2 | Energia jak makieta + edycja w ustawieniach | `SessionEnergyCard`/`EnergySelector` istnieją; energia zapisywana **per-cykl w DB** (CheckIn), NIE w `UserPreference`; brak edycji w ustawieniach | Restyling + **nowa warstwa danych** (najtrudniejszy pkt) |
| 3 | Pusty stan Fokus jak makieta | `EmptyActiveTasksGuide` istnieje, ale NIE renderuje się na Fokus; brak hero "Twój dzień czeka" | Nowy pusty stan + hero grafika |
| 4 | Przenieść ukończone do Podsumowania | Na Fokus nie ma listy ukończonych (tylko sekcja "Ukończone" w `day-memory-line.tsx`); Podsumowanie też jej nie ma | Nowa lista w Podsumowaniu + źródło danych zadań |
| 5 | Usunąć "Zadania" ze strony głównej | Przycisk w `quick-actions.tsx` (`quick-action-view-tasks` → `/tasks`); "Dodaj zadanie" też linkuje do `/tasks` | Usunięcie + przepięcie "Dodaj zadanie" na modal |
| 6 | Widok Zadania jak makieta | `task-list.tsx` działa, ale "nieostylowany" (`rounded-control`, płaskie badge, brak paneli); brak toggle grid | Restyling; toggle grid nie istnieje (nic do ukrywania) |
| 7 | Plan dnia: kalendarz "wkrótce" | `plan-dnia-view.tsx` to tylko formularz budżetu; brak osi czasu | Nowy UI kalendarza (placeholder "wkrótce") |
| 8 | Tekst motywujący w Podsumowaniu | `summary-footer-hero` to pusty `<div>` zarezerwowany pod baner | Wypełnić istniejący placeholder |
| 9 | Ustawienia jak makieta | Jednokolumnowa lista 4 sekcji; makieta = dwukolumnowa z lewym paskiem tabów | Przebudowa layoutu, reużycie kontrolek |
| 10 | Tab "Integracje" (MCP wkrótce) | Nie istnieje | Nowa sekcja/tab placeholder |
| 11 | Estetyka wg makiet | Tokeny dojrzałe (Tailwind v4), ale komponenty używają `rounded-lg`+ramki zamiast miękkich `rounded-card`+cień; mniej whitespace niż makieta | Systematyczny pass po kartach/odstępach |

**Największe ryzyka / nieoczywistości:**
- **Pkt 1 vs 2:** energia i cel sesji dzielą jeden plik (`session-steering-card.tsx`), jeden system "steering" i wspólny hook. Usunięcie celu sesji przy zachowaniu energii wymaga rozplecenia `showSessionFocus`/`completeSessionFocus`/`skipSessionFocus` w `use-pomodoro-cycle.ts` i `home-session-state.ts` bez naruszenia energii.
- **Pkt 2 (edycja w ustawieniach):** energia nie jest preferencją użytkownika — jest zapisem per-cykl. Uczynienie jej "zmienialną w ustawieniach" to zmiana modelu danych (`UserPreference` + router `preference`), nie tylko UI. **Wymaga decyzji o semantyce** (patrz Open Questions).
- **Pkt 4:** "lista ukończonych zadań na Fokus" formalnie nie istnieje jako lista — to sekcja "Ukończone" w `DayMemoryLine`. Trzeba potwierdzić, co dokładnie przenosimy.

## Detailed Findings

### Architektura nawigacji i powłoki (kontekst dla pkt 1–5)

- **Nawigacja**: `src/app/_components/app-shell.tsx:27-33` — 5 pozycji: `/focus` (Fokus), `/tasks` (Zadania), `/plan` (Plan dnia), `/summary` (Podsumowanie), `/settings` (Ustawienia). Desktop = lewy sidebar (~224px), mobile = górny header + dolny bottom-nav (`app-shell.tsx:48-160`). Namespace i18n: `Navbar`.
- **Root = Focus**: `app-shell.tsx:41-46` traktuje `/` i `/focus` jako tożsame; `src/app/page.tsx` przekierowuje/renderuje ten sam `HomeShell`. Powłoka nie renderuje się na `/auth/*` (`app-shell.tsx:53-55`).
- **Drzewo strony Fokus/Home**: `focus/page.tsx` → `HydrateClient` → `HomeShell` (`home-shell.tsx:105`) → `OnboardingProvider` → `GuestMergeUiProvider` → `HomeIllustrationVariantProvider` → `HomeShellContent` → `<main>` → `PomodoroDashboard` (`home-shell.tsx:98`).
- **`PomodoroDashboardBody`** (`pomodoro-dashboard.tsx:119-1135`) — układ trójstrefowy:
  - **Primary region** (`:941-958`): `DayMemoryLine`, steering cards (energia/cel), `KickoffDurationChips`, `TimerPanel`, `TaskSuggestionCard`.
  - **Secondary region** (`:960-984`): status lines, `TimerPanel`, steering cards (alt), `FocusBudgetPrompt`, `DailyRecapPanel`, `FocusTip` (`:981`), `QuickActions` (`:982`).
  - **Context rail** (desktop, `:987-989`): `HomeHeroSprig` + `DailyRecapPanel` + `HomeFocusSummary` (`:856-866`).
  - `FocusTip` i `QuickActions` renderują się tylko gdy `homeIa.state === "idle" || "active_work"` (`:881`).

### Punkt 1 — usunięcie "Cel sesji" ("Na czym się skupiasz w tej sesji?")

- Komponent: `SessionFocusCard` — `src/app/_components/session-steering-card.tsx:54-144`.
- Opcje intencji z `src/lib/session/narrative-copy.ts:8-18` (`getIntentionChipOptions`): "Głęboka praca", "Opróżnij skrzynkę", "Wdróż funkcję" + wolny tekst (max 80 zn.).
- Montaż: `pomodoro-dashboard.tsx:658-663`; handlery `handleCompleteFocus` (`:288-292` → `pomodoro.completeSessionFocus`), `handleSkipFocus` (`:296-299` → `pomodoro.skipSessionFocus`).
- Widoczność: flaga `showSessionFocus` (`:178`) = `pomodoro.showSessionFocus && !dayStartGateDismissed`.
- **Punkty usunięcia**: komponent (`session-steering-card.tsx:54-144`), import + JSX + handlery w `pomodoro-dashboard.tsx`, klucze i18n `SessionSteering.focus*` (`messages/pl.json:604-610`), pola hooka `showSessionFocus/completeSessionFocus/skipSessionFocus` w `use-pomodoro-cycle.ts`, derywacja w `src/lib/home/home-session-state.ts`. **Uwaga:** plik dzieli `SessionEnergyCard` — nie kasować całego pliku.

### Punkt 2 — Energia jak makieta + edycja w ustawieniach

- Komponenty: `SessionEnergyCard` (`session-steering-card.tsx:14-52`) + `EnergySelector` (`src/app/_components/energy-selector.tsx:117-157`).
- Wartości: `CheckInEnergy` = `"FOCUSED" | "STEADY" | "FADING"` (`energy-selector.tsx:7`); definicje z ikonami `ENERGY_OPTION_DEFS` (`:9-44`). Domenowo: `src/lib/domain/energy-level.ts:1-7`.
- Etykiety PL: "Skupiony/Stabilny/Słabnący" (`messages/pl.json:612-616`, namespace `Energy`).
- Nagłówek obecny: `SessionSteering.energyHeading` = "Jaka jest Twoja energia na start?" (`pl.json:601`). **Makieta użytkownika** pokazuje "Jaką masz dziś energię?" + przycisk "Dalej" + hint "Zawsze możesz to zmienić w ustawieniach dnia" — to wariant z **day-start-gate / first-run** (patrz `day-start-gate.tsx`, `first-run-overlay.tsx`), a mockup `flow-pracy.png` (krok 1) pokazuje "Jaka jest Twoja energia na start?" + "Zapisz i kontynuuj". Energia pojawia się więc w kilku miejscach — trzeba ujednolicić z makietą.
- **Persystencja (kluczowe):** energia NIE jest w localStorage onboardingu ani w `UserPreference`. Zapis idzie przez mutację **check-in** do DB: `handleCompleteEnergy` (`pomodoro-dashboard.tsx:275-281`) → `pomodoro.completeSessionEnergy` → `submitCheckIn` → `createCheckIn.mutateAsync({ cycleId, energy })` w `use-pomodoro-cycle.ts` (~`:3124-3220`). Energia jest **per-cykl**, powiązana z `Cycle`/`CheckIn`.
- **Implikacja dla "edycji w ustawieniach":** wymaga nowej semantyki — albo dodać `energyLevel` do modelu `UserPreference` (Prisma) + router `preference`, albo edytować bieżący check-in dnia. To zmiana warstwy danych, nie sam UI. Reużywalny kontroler UI: `EnergySelector`.

### Punkt 3 — pusty stan strony Fokus ("Twój dzień czeka na Ciebie")

- Istnieje `EmptyActiveTasksGuide` (`src/app/_components/empty-active-tasks-guide.tsx:13-38`): ilustracja `EmptyGardenBed`, tekst i18n `EmptyTasks.guest/authenticated`, przycisk "Dodaj zadanie" (`onAddTaskClick`). **Ale renderuje się na stronie Zadania, nie na Fokus.**
- `TimerPanel` (`timer-panel.tsx:82-89`) zwraca `null` gdy brak `focusedTask` i stan nie jest running/paused/completed → strona Fokus bez zadań jest w dużej mierze pusta.
- Makieta `main-page-ready.png` + drugi inline-obraz użytkownika ("Twój dzień czeka na Ciebie" + hero z górami/jeziorem + bloczki "Twój dzień"/"Wskazówka na dziś"/"Szybkie akcje"):
  - Bloczek "Twój dzień": `HomeFocusSummary` (`home-focus-summary.tsx:23-97`), dane z `useDayPlan()` + `pomodoro.completedWorkCycles`; klucze `HomeFocusSummary.*`.
  - "Wskazówka na dziś": `FocusTip` (`focus-tip.tsx:18-34`), rotacja 6 wskazówek `FocusTip.tip0..5`.
  - Hero mountain-lake: **brak assetu** — makieta używa dużej grafiki krajobrazu; obecnie tylko `HomeHeroSprig`/`EmptyGardenBed` (leaf-art). Trzeba dostarczyć/utworzyć grafikę.

### Punkt 4 — przenieść ukończone zadania na Podsumowanie

- Na stronie Fokus **nie ma** listy ukończonych jako osobnej listy. Najbliższe: sekcja "Ukończone" w `DayMemoryLine` (`day-memory-line.tsx:67-82`, klucz `DayMemory.sectionDone`) — pochodzi z recap dnia, nie z live listy zadań.
- Lista ukończonych zadań ("Ukończone N") istnieje na stronie Zadania jako zakładka (`task-list.tsx`, tab `completed`).
- Podsumowanie **nie renderuje** listy ukończonych (patrz Punkt 8/Summary). Trzeba dodać nową, ostylowaną listę i podpiąć źródło (inwentarz zadań / recap). Makieta `podsumowanie.png` pokazuje donut "Zadania" + link "Zobacz wszystkie zadania".

### Punkt 5 — usunięcie "Zadania" ze strony głównej; "Dodaj zadanie" → modal

- `QuickActions` (`src/app/_components/quick-actions.tsx:6-27`): dwa linki — `addTask` (`:13-16` → `/tasks`) i `viewTasks`/"Zadania" (`:18-24`, `data-testid="quick-action-view-tasks"` → `/tasks`).
- Do usunięcia: przycisk `viewTasks`. "Dodaj zadanie" ma otwierać modal `AddTaskModal` (`add-task-modal.tsx:52-193`) zamiast linkować do `/tasks` — najlepiej z poziomu nowego pustego stanu Fokus (pkt 3).
- Modal jest dziś wyzwalany tylko na stronie Zadania (`task-list.tsx:769-773`, render `:879-889`).

### Punkt 6 — widok Zadania jak makieta

- Drzewo: `tasks/page.tsx:112-130` → kontener `flex flex-1 flex-col items-center px-4 py-8`, `max-w-2xl` → `<TaskList>`.
- `task-list.tsx:517-905`: quick-add form (`:731-778`), rząd tabów+filtrów (`:780-802`), listy `<ul class="space-y-2">`.
- Wiersz zadania (`SortableTaskRow` `:262-352`, `StaticTaskRow` `:382-488`): `flex ... rounded-control border border-transparent bg-surface-card px-4 py-3` — **płaski, bez cienia/wyraźnej ramki**. Drag handle `⋮⋮`, checkbox 5×5, tytuł, `TaskBadges` (work-type + minuty), focus/delete.
- Tabs: `ui/tabs.tsx:98-102` (Aktywne/Planowane/Ukończone). Filtry: `ui/select.tsx:147` ("Wszystkie typy", "Sortuj: Priorytet/Ręcznie/Wysiłek").
- **Toggle list/grid (kafelkowy): NIE ISTNIEJE** — nie ma nic do ukrycia; makieta pokazuje ikony list/grid, które ignorujemy.
- Panel szczegółów `TaskDetailPanel` (`task-detail-panel.tsx:51-206`) renderuje się jako **modal**, nie prawy drawer. Makieta pokazuje prawy panel szczegółów (do rozważenia, ale poza rdzeniem "nieostylowania").
- Brak footera "Zasada FlowState" (makieta go ma).
- Badge work-type: `src/lib/design/work-type-config.ts` → tokeny `worktype-{deep,ops,reactive}-{bg,text}`.
- i18n: namespace `Tasks` (`messages/pl.json`, ~`:226-320`): `sectionActive/Planned/Completed`, `filterAllTypes`, `sortPriority`, `createTitlePlaceholder`, `workType.*`, itd.
- **"Nieostylowany" = ** płaskie `bg-surface-card` z `rounded-control`, brak cieni/hierarchii, badge bez głębi, generyczne odstępy. Makieta chce miękkie karty, wyraźniejsze badge, footer-tip, ewentualnie prawy panel.

### Punkt 7 — Plan dnia: kalendarz "wkrótce"

- `plan/page.tsx:1-38` → `PlanDniaView` (`plan-dnia-view.tsx:1-186`) z `dayPlan` z `useDayPlan()`.
- Obecnie: **tylko formularz budżetu** — `max-w-lg` kolumna, tytuł/subtytuł, `FocusBudgetPrompt` lub panel z paskiem postępu i presetami (120/240/360 min). **Brak osi czasu 08:00–18:00, brak bloków Skupienie/Spotkanie/Przerwa/Osobiste, brak prawego railu** ("Podsumowanie dnia"/"Następny blok"/"Wskazówka").
- Makieta `plan-dnia.png`: pełna oś godzinowa z kolorowymi blokami + prawy rail. Wymaganie: pokazać ten kalendarz **jako placeholder "Kalendarz wkrótce"** (statyczny/nieaktywny) — wzorzec "coming soon" już jest w Podsumowaniu (`DeferredPlaceholder`).
- i18n: namespace `PlanDnia` (`pl.json:412-426`).

### Punkt 8 — tekst motywujący w Podsumowaniu

- `summary/page.tsx:1-20` → `useDayStats()` → `PodsumowanieView` (`podsumowanie-view.tsx:235-508`), `max-w-2xl space-y-6`.
- Sekcje istniejące: KPI grid (`:351-377`), `HourlyBarChart` SVG (`:379-394`), donut typów sesji (`:398-431`), donut ukończenia zadań (`:433-479`), deferred widgets "Najlepsza pora dnia"/"Nawigacja dat" (`:484-498`, wzorzec `DeferredPlaceholder`).
- **Motywacja: `summary-footer-hero`** — pusty `<div aria-hidden="true" class="summary-footer-hero h-24 w-full sm:h-32" data-testid="podsumowanie-footer-hero">` (`:500-506`). To gotowe miejsce na baner z makiety ("Dobra robota! Regularne sesje skupienia to klucz..."). Wystarczy wypełnić treścią + grafiką.
- i18n: namespace `Podsumowanie` (`pl.json:380-411`).
- Dane: `DayStats` z `src/lib/recap/aggregate-day-stats.ts:45-62` (`doneTasksCount`, `taskCompletionStat`, itd.).

### Punkt 9 — Ustawienia jak makieta

- `settings/page.tsx` → `ustawienia-view.tsx:95-260`: **jedna kolumna** `max-w-2xl space-y-8`, 4 karty-sekcje: Ogólne (`:102-150`), Sesje skupienia (`:152-213`), Przerwy i powiadomienia (`:215-241`), Wygląd (`:243-259`). Każda: `rounded-card border border-card-border bg-surface-card p-6 shadow-sm`.
- Makieta `ustawienia.png`: **dwukolumnowa** — lewy pasek nawigacji sekcji (Ogólne, Sesje skupienia, Przerwy, Powiadomienia, Wygląd, Synchronizacja, Prywatność, O aplikacji) + prawy panel treści. Wymaganie: użyć **feature'ów już obecnych** (nie wymyślać nowych), więc część sekcji makiety (Synchronizacja/Prywatność) może być placeholderami lub pominięta.
- Kontrolki obecne (reużywalne): `LanguageSwitch` (EN/PL), `DurationPicker` (praca/krótka/długa przerwa, presety+custom), `OutOfTabBreakAlertsControl`, `CycleAudioPreferenceControl`, ThemeToggle (Jasny/Ciemny/Systemowy inline `:265-310`), `StyledCheckbox`, konto+wyloguj.
- **Braki względem makiety**: auto-start przerw (toggle), format czasu (24h), sekcja Dane/kopie zapasowe (backup/usuń dane) — makieta je pokazuje, ale wymaganie mówi "użyj tych, które są".
- Persystencja: hybryda — tRPC `preference` router (`src/server/api/routers/preference.ts:16-79`, tabela `UserPreference`: `cycleEndAudioMode`, `language`) + localStorage per-scope (`flowstate:*:{userId|guest}`), + theme w `theme-provider.tsx`.
- i18n: namespace `Settings` (`pl.json:655-671`).

### Punkt 10 — tab "Integracje" (MCP wkrótce)

- **Nie istnieje** — brak jakichkolwiek odniesień do "Integr*" w `ustawienia-view.tsx`, `messages/*`, `_components/`.
- Do dodania: nowa sekcja/tab "Integracje" z placeholderem "Połączenie agenta przez MCP — wkrótce". Reużyć wzorzec "coming soon" (`DeferredPlaceholder` z Podsumowania) + nowe klucze i18n w namespace `Settings`.

### Punkt 11 — estetyka wg makiet (design system)

- **Tokeny (dojrzałe)**: Tailwind v4, `@theme` w `src/styles/globals.css` (bez `tailwind.config.js`). Paleta: shell linen→stone (`--color-shell-top #faf8f5`), `surface-card #fff`, `surface-panel #f5f3ee`, `surface-card-muted #f3f1ec`, akcent sage `--color-accent-cta #5d8265`, tekst `#2d2a35/#5c5768/#9b96a8`, ramka `border-subtle #e0ddd6`, cień `card-shadow rgb(45 42 53 / .08)`. Energia: indigo/stone/rose. Work-type: indigo/amber/rose washy. Dark theme przez `[data-theme="dark"]`.
- **Promienie**: `--radius-card 1.25rem`, `--radius-control 0.75rem`, `--radius-chip 0.5rem`. **Rozjazd:** wiele komponentów używa `rounded-lg`/`rounded-control` + widoczne ramki, gdy makieta chce miękkie `rounded-card` z delikatnym cieniem i mniejszą liczbą ramek.
- **Typografia**: Geist Sans; `--text-display 2.25rem`, `--text-timer 4.5rem`. Makieta chce większe nagłówki, więcej whitespace, mniej tekstu pomocniczego.
- **Prymitywy UI** (`src/app/_components/ui/`): `Button` (primary/secondary/ghost/danger, sm/md), `SegmentedControl`, `Tabs`, `Select`, `ProgressRing` — wszystkie tokenowe, gotowe do reużycia.
- **Ilustracje** (`src/lib/design/illustrations/`): `CalmGardenBlob`, `CalmGardenSprig`, `HomeHeroSprig`, `EmptyGardenBed` — leaf-art tintowane przez zmienne CSS (`data-illustration-variant`, `data-illustration-energy`). Makieta dodatkowo używa **fotorealistycznego hero (góry/jezioro)** — brak takiego assetu.
- **Konwencje layoutu**: `max-w-2xl` kolumna główna (tasks/plan/summary), karty `rounded-lg border ... shadow-sm`, overlaye `rounded-xl shadow-xl p-8`. Spójny padding `px-4 py-3`.
- **DESIGN.md** (root, 307 linii): pełna specyfikacja — light-default, calm aesthetic, `data-theme` + localStorage, zakaz glassmorphism, motion 200ms overlay / 400ms completion, kontrakt E2E (`data-testid`, `ring-2 ring-focus`).

## Code References

- `src/app/_components/app-shell.tsx:27-46` — definicja nawigacji + logika active (`/` == `/focus`)
- `src/app/_components/pomodoro-dashboard.tsx:119-1135` — trójstrefowy body wspólnego widoku Home/Focus
- `src/app/_components/session-steering-card.tsx:14-52` / `:54-144` — `SessionEnergyCard` (pkt 2) / `SessionFocusCard` (pkt 1, do usunięcia)
- `src/app/_components/energy-selector.tsx:9-44,117-157` — selektor energii (reużywalny w ustawieniach)
- `src/lib/onboarding/` + `src/lib/domain/energy-level.ts` — brak persystencji energii jako preferencji
- `src/server/api/routers/preference.ts:16-79` — router preferencji (`UserPreference`: `language`, `cycleEndAudioMode`) — miejsce na `energyLevel`
- `src/app/_components/empty-active-tasks-guide.tsx:13-38` — istniejący pusty stan (do wyniesienia na Fokus, pkt 3)
- `src/app/_components/home-focus-summary.tsx:23-97` — bloczek "Twój dzień" (pkt 3)
- `src/app/_components/focus-tip.tsx:18-34` — "Wskazówka na dziś" (pkt 3)
- `src/app/_components/quick-actions.tsx:6-27` — przycisk "Zadania" do usunięcia + "Dodaj zadanie" do przepięcia (pkt 5)
- `src/app/_components/task-list.tsx:262-352,517-905` — widok Zadania do restylingu (pkt 6)
- `src/lib/design/work-type-config.ts` — tokeny badge work-type
- `src/app/_components/plan-dnia-view.tsx:1-186` — Plan dnia (stub budżetu; pkt 7)
- `src/app/_components/podsumowanie-view.tsx:235-508` — Podsumowanie; `summary-footer-hero` `:500-506` (pkt 8), brak listy ukończonych (pkt 4)
- `src/lib/recap/aggregate-day-stats.ts:45-62` — `DayStats` (dane Podsumowania)
- `src/app/_components/ustawienia-view.tsx:95-260` — Ustawienia (pkt 9, +Integracje pkt 10)
- `src/app/_components/duration-picker.tsx`, `language-switch.tsx`, `styled-checkbox.tsx`, `cycle-audio-preference-control.tsx`, `out-of-tab-break-alerts-control.tsx` — reużywalne kontrolki ustawień
- `src/styles/globals.css` — tokeny `@theme` (pkt 11)
- `src/app/_components/ui/{button,tabs,select,segmented-control,progress-ring}.tsx` — prymitywy UI
- `src/lib/design/illustrations/*` — ilustracje calm-garden
- `DESIGN.md` (root) — specyfikacja designu
- `messages/pl.json` — wszystkie klucze i18n (namespace'y: `Navbar`, `Home`, `HomeFocusSummary`, `FocusTip`, `QuickActions`, `Tasks`, `PlanDnia`, `Podsumowanie`, `Settings`, `SessionSteering`, `Energy`, `DayMemory`, `EmptyTasks`, `Preferences`)

## Architecture Insights

- **Home == Focus**: jeden komponent (`PomodoroDashboard`) obsługuje `/` i `/focus`. Zmiany "strony głównej" i "strony Fokus" dotykają tego samego drzewa — planować łącznie.
- **Steering system** (energia + cel sesji) jest sprzężony przez `use-pomodoro-cycle.ts`, `home-session-state.ts`, `day-start-gate.tsx`. Usuwanie celu sesji (pkt 1) to refactor stanu, nie tylko usunięcie JSX — ryzyko regresji przejść (por. lesson "Test every wedge transition before shipping transition logic changes").
- **Persystencja preferencji** jest hybrydowa (tRPC `UserPreference` dla zalogowanych + scope'owany localStorage dla gościa/sesji + osobny store theme). Nowa preferencja energii musi wpiąć się w oba tory + merge gościa.
- **Wzorzec "coming soon" — do przeprojektowania:** istnieje płaski `DeferredPlaceholder` w `podsumowanie-view.tsx` (`bestTimeComingSoon`, `dateNavComingSoon`), ale **decyzja użytkownika zmienia wzorzec na blurred-preview** (estetyczny podgląd docelowej funkcji + blur + etykieta "Wkrótce") — patrz Decisions → "Wzorzec wkrótce". Nowy, współdzielony komponent (np. `ComingSoonPreview`) powinien opakowywać realistyczny mock i nakładać blur; użyty w Plan dnia (kalendarz), Ustawienia (MCP), opcjonalnie Podsumowanie (analityka). "Wkrótce" tylko dla funkcji zaplanowanych w roadmapie (S-46/S-47/S-48).
- **Design tokeny są gotowe** — problem estetyczny (pkt 11) to *stosowanie* (rounded-lg+ramki vs rounded-card+cień, za mało whitespace), nie brak tokenów. Pass powinien podnosić karty na `rounded-card`/`shadow-sm`, zwiększać odstępy (`space-section`), redukować ramki.
- **Kontrakt E2E**: zachować `data-testid` (`quick-action-view-tasks` znika → zaktualizować specy), `ring-2 ring-focus`, `podsumowanie-footer-hero`. Uruchamiać E2E per-spec (lesson).

## Historical Context (from prior changes)

- `context/foundation/makiety/redesign.md` — założenia redesignu: "jeden ekran = jedna decyzja", energia/cel sesji pokazywane raz i chowane, karty zadań uproszczone ("Nazwa\nGłęboka praca • 45 min"), estetyka wellbeing (beż, sage, whitespace). **Uwaga:** redesign.md zakłada zachowanie "Cel sesji" jako kroku — wymaganie użytkownika (pkt 1) świadomie od tego odchodzi (usuwa cel sesji całkowicie).
- `context/foundation/makiety/flow-pracy.png` — pełny 8-krokowy flow; krok 1 "Energia dnia" ("Jaka jest Twoja energia na start?"), krok 2 "Cel sesji" (usuwany).
- `context/foundation/makiety/branding.md` — ton: opiekun/mentor, "Mniej chaosu. Więcej skupienia.", nie motywuje agresywnie (istotne dla treści pkt 8 — tekst motywujący ma być spokojny, nie "produktywnościowy").
- `context/foundation/lessons.md`:
  - "Test every wedge transition..." — dotyczy pkt 1 (usuwanie steering/gate).
  - L-04 (NFR 200ms per surface) — dotyczy nowych kontrolek (energia w ustawieniach).
  - "Run E2E one spec at a time" — proces weryfikacji.
- `context/changes/` — istnieje aktywna zmiana `ui-refactor` (12-faz redesign, ta sama gałąź). Ten `ui-improvement` to kontynuacja/dopieszczenie na tym samym PR.

## Related Research

- `context/foundation/makiety/redesign.md` i `branding.md` — spec designu i tonu.
- `DESIGN.md` (root) — żywy kontrakt tokenów/motion/E2E.
- Brak wcześniejszych `research.md` dla tej zmiany (pierwszy).

## Decisions (rozstrzygnięte 2026-07-05)

- **Pkt 2 — energia w ustawieniach:** ustalono wariant **"edycja energii dnia"** — sekcja edytująca *dzisiejszy check-in* (zgodnie z hintem makiety "zmień w ustawieniach dnia). **Bez** nowego pola `UserPreference.energyLevel` i bez zmiany modelu preferencji. Reużyć `EnergySelector`; podpiąć pod istniejącą ścieżkę check-inu (edycja bieżącego wpisu zamiast tworzenia nowego cyklu).
- **Pkt 4 — lista ukończonych w Podsumowaniu:** ustalono **"lista dzisiaj ukończonych"** — nowa, ostylowana lista zadań ukończonych *dziś* (źródło: recap/inwentarz dnia, nie pełna historia z zakładki Zadania), umieszczona pod istniejącym donutem "Zadania" w `podsumowanie-view.tsx`.

- **Pkt 3 — hero grafika:** ustalono **fotorealistyczny krajobraz** (raster). **Ustalenie kluczowe:** assety już istnieją w `public/images/heroes/` — `focus-session-bg.png` (+ `-dark`), `onboarding-hero.png` (+ `-dark`), `summary-footer.png` (+ `-dark`) — używane już przez `globals.css` (`.session-immersive-*`, `.summary-footer-hero`). Prawdopodobnie **nie trzeba tworzyć nowego assetu** — podpiąć istniejący hero pod nowy pusty stan Fokus (jak `.summary-footer-hero` → `summary-footer.png`). Zweryfikować dopasowanie do makiety w /10x-plan; ewentualnie dostarczyć wariant krajobrazu.
- **Pkt 9 — zakres sekcji Ustawień (doprecyzowane 2026-07-05):** **"tylko istniejące feature'y"** — pozostałe propozycje makiety (Prywatność, format czasu, auto-start przerw, kopie zapasowe) **ignorujemy całkowicie** (nie pokazujemy ich nawet jako "wkrótce"). Dwukolumnowy layout z lewym paskiem tabów wg makiety, wyłącznie dla sekcji z działającymi kontrolkami: Ogólne, Sesje skupienia, Przerwy/Powiadomienia, Wygląd + sekcja edycji energii dnia (pkt 2). **Jedyny nowy "wkrótce" w Ustawieniach = tab Integracje/Synchronizacja z MCP** (pkt 10) — dodany już teraz jako blurred-preview (patrz "Wzorzec wkrótce" poniżej), bo mapuje na zaplanowany slice **S-46 `mcp-server-for-agents`** (roadmap, backlog).
- **Pkt 6 — panel zadań:** ustalono **"tylko restyling listy"** — dopracować karty/badge/odstępy/footer-tip listy; szczegóły zadania **zostają modalem** (`TaskDetailPanel`), również ostylowanym. Nie przebudowywać na stały prawy panel (mniejsze ryzyko regresji i testów).
- **Wzorzec "wkrótce" (przekrojowy, ustalone 2026-07-05):** wszystkie stany "wkrótce" mają być **estetyczne i wyglądać jak docelowa funkcja, ale rozmyte (blur)** — nie płaskie, tekstowe placeholdery. Wzorzec: wyrenderować realistyczny, statyczny podgląd docelowego UI (np. siatka kalendarza z blokami, karta integracji MCP, wykres trendów), nałożyć `blur` (`backdrop-filter`/`filter: blur`) + delikatny scrim + etykietę "Wkrótce". Zastępuje wcześniejszy pomysł reużycia płaskiego `DeferredPlaceholder`. **"Wkrótce" pokazujemy TYLKO tam, gdzie funkcja jest realnie zaplanowana w roadmapie:**
  - **Plan dnia — kalendarz/oś czasu** (pkt 7): blurred podgląd osi 08:00–18:00 z kolorowymi blokami (Skupienie/Spotkanie/Przerwa/Osobiste) wg makiety `plan-dnia.png` → "Kalendarz wkrótce". Mapuje na S-45 (Plan dnia) + **S-47 `delegation-suggestion-in-plan`** (backlog).
  - **Ustawienia — Integracje/MCP** (pkt 10): blurred podgląd karty połączenia agenta przez MCP → "wkrótce". Mapuje na **S-46 `mcp-server-for-agents`** (backlog).
  - **Podsumowanie — analityka** (opcjonalnie, spójność): istniejące stuby "Najlepsza pora dnia" / "Nawigacja dat" (`bestTimeComingSoon`, `dateNavComingSoon`) można podnieść do tego samego blurred-preview; mapują na **S-48 `analytics-trends-plan-vs-execution`** (backlog). Poza tym nie mnożyć "wkrótce".

## Open Questions

_Wszystkie kwestie rozstrzygnięte 2026-07-05 (patrz Decisions powyżej). Brak otwartych pytań blokujących planowanie._
