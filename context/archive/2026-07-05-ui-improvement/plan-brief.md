# UI Improvement — Makieta Polish & "Coming Soon" — Plan Brief

> Full plan: `context/changes/ui-improvement/plan.md`
> Research: `context/changes/ui-improvement/research.md`

## What & Why

Fazowy pass dopracowujący UI FlowState na pięciu widokach (Fokus, Zadania, Plan dnia, Podsumowanie, Ustawienia) plus cienka warstwa danych „energii dnia". Cel: zbliżyć aplikację do makiet (estetyka wellbeing — miękkie karty, whitespace, spokój) i estetycznie zasygnalizować zaplanowane funkcje (kalendarz, MCP) jako rozmyte podglądy „Wkrótce". Aplikacja „nadal mało estetyczna" i pokazuje przestarzały feature „cel sesji" — to porządkuje jedno i drugie.

## Starting Point

Działa PR `features/ui-refactor` (S-45). `/` i `/focus` to ten sam dashboard; energia i „cel sesji" dzielą jeden plik i hook cyklu; energia jest zapisem per-cykl (bez rekordu per-dzień). Plan dnia to stub budżetu, Podsumowanie ma pusty zarezerwowany baner i brak listy ukończonych, Ustawienia to jedna kolumna. Tokeny designu są dojrzałe — brakuje ich konsekwentnego zastosowania.

## Desired End State

Zalogowany użytkownik: na starcie dnia widzi jedną estetyczną bramkę „Jaką masz dziś energię?" (bez celu sesji), edytowalną w Ustawieniach; na Fokus bez zadań — hero „Twój dzień czeka na Ciebie" z „Dodaj pierwsze zadanie" (bez przycisku „Zadania"); spokojne karty w Zadaniach; rozmyty „Kalendarz wkrótce" w Planie; baner motywujący + listę ukończonych w 24h w Podsumowaniu; dwukolumnowe Ustawienia z energią dnia i tabem Integracje „MCP wkrótce".

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Persystencja energii dnia | Pole `DayPlan.energyLevel` | Reużywa per-dniowy rekord DayPlan; działa bez cyklu; jedna prosta migracja | Plan |
| Umiejscowienie pytania o energię | Bramka raz-na-dzień (day-start) wg makiety | Zgodne z makietą/redesign.md; reużywa gating po localDateKey | Plan |
| Źródło listy ukończonych | `recap.getDaily.last24Hours` (rozszerzone o typ+czas) | „Ukończone dziś" = ukończone w 24h; reużywa istniejący fetch | Plan |
| Zakres karty zadania (pkt 6) | Restyling bez zmiany zawartości/akcji | Minimalne ryzyko, zero zmian w logice/testach akcji | Plan |
| Zakres gościa | Zalogowani pełny; gość = spójne prompty | Wysiłek tam, gdzie funkcje działają | Plan |
| Głębokość estetyki (pkt 11) | Per-widok token-pass, bez ruszania prymitywów | Duży efekt, niskie ryzyko app-wide | Plan |
| Testy | Naprawa czerwonych E2E; nowe pokrycie unit/integration | Użytkownik ma nadmiar E2E; belt wolny | Plan |
| Cel sesji (pkt 1) | Usunięcie całkowite | Świadome odejście od redesign.md; sprzeczne z „mniej decyzji" | Research |
| Hero / „wkrótce" | Raster z `public/images/heroes/`; blur-preview | Assety już istnieją i podpięte; „wkrótce" ma wyglądać jak funkcja, ale rozmyta | Research |

## Scope

**In scope:** usunięcie celu sesji; bramka energii wg makiety + edycja w Ustawieniach (`DayPlan.energyLevel`); pusty stan Fokus + hero; usunięcie „Zadania" i przepięcie „Dodaj zadanie" na modal; restyling Zadań; rozmyty „Kalendarz wkrótce"; baner motywujący + lista ukończonych w Podsumowaniu; dwukolumnowe Ustawienia + Integracje (MCP wkrótce); per-widok token-pass estetyki.

**Out of scope:** sekcje Ustawień bez logiki (Prywatność/format czasu/auto-start/backup); prawy panel szczegółów zadania (zostaje modal); parytet gościa; refactor globalnych prymitywów ui/; realny kalendarz/MCP; usuwanie per-cyklowych check-inów; mnożenie testów E2E.

## Architecture / Approach

Backend energii najpierw (Faza 1: `DayPlan.energyLevel` + tRPC get/set), bo zależą od niego Fazy 2 i 7. Ryzykowny refactor stanu (usunięcie celu sesji ze splecionego steering/conductor) izolowany w Fazie 2 z oracle domknięcia bramki (lesson: wedge transitions). Widoki 3–7 głównie niezależne; estetyka wpleciona w każdą fazę jako token-pass. Wspólny `ComingSoonPreview` (blur) wprowadzony w Fazie 5, reużyty w 6–7. i18n zawsze PL+EN.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Backend energii dnia | `DayPlan.energyLevel` + tRPC get/set + hook | Migracja / dwa źródła energii |
| 2. Fokus: usunięcie celu sesji + bramka energii | Jedna estetyczna bramka energii, pisząca do DayPlan | Regresja przejść (splecione steering/conductor) |
| 3. Fokus: pusty stan + Szybkie akcje | Hero „Twój dzień czeka", modal, bez „Zadania" | Łamanie E2E `quick-action-view-tasks` |
| 4. Zadania: restyling | Spokojne karty wg makiety, footer-tip | Przypadkowa zmiana kontraktu akcji |
| 5. Plan dnia: „Kalendarz wkrótce" | `ComingSoonPreview` + rozmyta oś czasu | Koszt blur na dużym obszarze |
| 6. Podsumowanie: motywacja + ukończone | Baner + lista ukończonych (recap+typ/czas) | Nieścisłość filtra „ukończone w 24h" |
| 7. Ustawienia: redesign + Integracje + energia | Dwie kolumny, energia dnia, MCP wkrótce | Spójność energii z bramką day-start |

**Prerequisites:** gałąź `features/ui-refactor`; działające migracje Prisma; assety hero w `public/images/heroes/` (są).
**Estimated effort:** ~5–7 sesji na 7 faz (Faza 2 najcięższa; Fazy 4–5 lekkie).

## Open Risks & Assumptions

- Rozplecenie celu sesji od energii we wspólnym hooku/conductorze może odsłonić ukryte zależności przejść — mitygacja: oracle domknięcia bramki + naprawa E2E per-spec.
- „Dwa źródła energii" (DayPlan vs per-cykl check-in) — przyjęto: DayPlan = energia dnia/baza sugestii; check-iny nietknięte dla narracji.
- Filtr „ukończone w 24h" z `last24Hours` wymaga poprawnego rozróżnienia pracowane vs ukończone (`completedWithoutCycle`/status).

## Success Criteria (Summary)

- Wszystkie 5 widoków wyglądają zgodnie z makietami; „cel sesji" zniknął; energia dnia edytowalna w Ustawieniach i spójna z bramką.
- „Wkrótce" (kalendarz, MCP) prezentowane jako estetyczne, rozmyte podglądy — tylko dla realnie zaplanowanych funkcji.
- `typecheck`/`lint`/`test` zielone; czerwone E2E naprawione; brak regresji przejść cyklu i akcji zadań.
