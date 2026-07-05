---
change_id: mvp-defect-intake
title: Post-MVP defect intake — collected user reports before fix planning
status: archived
created: 2026-07-03
updated: 2026-07-05
archived_at: 2026-07-05T19:46:03Z
---

## Notes

Zbiorcza lista usterek zgłaszanych przez użytkownika po zamknięciu MVP
(2026-07-03). Decyzja: najpierw zebrać wszystkie zgłoszenia, potem planować
poprawki. Ten dokument jest rejestrem i triage'em; właściwe poprawki będą
wydzielane do osobnych change'ów na etapie planowania.

**LISTA ZAMKNIĘTA 2026-07-03** (11 pozycji, D-01…D-11). Pogrupowanie i
kolejność planowania: sekcja "Fix waves" na dole.

D-01 ma już pełny frame: `context/changes/fix-home-layout-spacing/frame.md`.

## Defect register

| ID | Zgłoszenie (skrót) | Triage | Weryfikacja |
| --- | --- | --- | --- |
| D-01 | Rozjechany układ strony głównej, nierówne odstępy (wszystkie szerokości, dev+prod) | framed → `fix-home-layout-spacing` | HIGH — 3 hipotezy STRONG |
| D-02 | Usunąć popup "Zestawy wstępnie ustawiają typ pracy i priorytet — wybierz Własny…" (baner z "Rozumiem" przy presetach) | DECYZJA (2026-07-03): usunąć baner; oryginalna decyzja z S-29/S-36 o banerze edukacyjnym unieważniona | decided |
| D-03 | Checkbox "Uwzględnij w Daily" w composerze ma być domyślnie zaznaczony | DECYZJA (2026-07-03): domyślnie zaznaczony | decided |
| D-04 | Ilustracje z roadmapy (Calm Garden, S-28/S-43) niewidoczne w aplikacji | DECYZJA (2026-07-03): dotychczasowa "subtelność by design" była BŁĘDNA — ilustracje mają być wyraźnie widoczne. Wymaganie: zwiększyć rozmiar/kontrast (hero ~48×80px kreska 1.5px, pastel 55% + składane przezroczystości `globals.css:186-232` — do rewizji); rozważyć dowiezienie odłożonych scrimów nakładek (S-28 faza 2). Technicznie nic nie brakuje (inline SVG, wszystkie powierzchnie wired) — to zmiana parametrów wizualnych, nie szukanie plików | decided — requirement |
| D-05 | Toggle "Uwzględnij w daily" w edycji istniejącego taska zaznacza też główny checkbox composera; ma wpływać tylko na edytowany task | POTWIERDZONY BUG: `styled-checkbox.tsx:22` używa `data-testid` jako fallbacku `id`; composer i każdy panel edycji dostają to samo `data-testid="daily-standing-toggle"` (`task-fields-panel.tsx:260-265`) → zduplikowane HTML id, label `htmlFor` wskazuje pierwszy input w DOM (composer) | STRONG |
| D-06 | Po wylogowaniu na `/auth/sign-in` brak powrotu do strony głównej; brak navbara z logotypem → `/` | DECYZJA (2026-07-03): dodać navbar aplikacji z logotypem linkującym do `/` (widoczny też na stronach auth) | decided — requirement |
| D-07 | Usunąć górną sekcję hero: "FlowState / Spokojna odpowiedź na: co teraz? / Zarządzaj zadaniami. Zostań w flow." | DECYZJA (2026-07-03): usunąć sekcję hero; branding przejmuje navbar z D-06. Sprzężone z D-01 (frame layoutu zakłada header w rytmie strony — plan D-01 musi uwzględnić usunięcie hero) | decided |
| D-08 | Horyzont: opcja "Gdy się da" (WHEN_POSSIBLE) nieklikalna | STATYCZNIE NIE POTWIERDZONY: wiring poprawny (`task-fields-panel.tsx:10-14,88-96,148-159` — wszystkie 3 wartości w options, colorMap, onClick; brak disabled/pointer-events). Podejrzani do reprodukcji w przeglądarce: `overflow-hidden` na wierszu taska (`task-list.tsx:338`, możliwe przycięcie ostatniego segmentu) oraz blur-save panelu edycji (`task-list.tsx:407-411` — blur odpala się przed click; por. archiwalny fix-task-edit-blur-save) | WEAK — wymaga repro |
| D-09 | Nazwa presetu (np. "Gaszenie") ma się pokazywać na utworzonym tasku | DECYZJA (2026-07-03) — wymaganie wiążące: nazwa presetu widoczna na utworzonym tasku. Stan kodu: personaPresetId persystowany (`task.ts:118-120`), plakietka renderowana (`task-list.tsx:124-169,492-502`) ale znika po edycji atrybutów (przechodzi na "Własny", `persona-presets.ts getTaskBadgeDisplayMode`) — jeśli to ten mechanizm zasłonił preset, regułę "preset → Własny po edycji" należy zrewidować przy poprawce; nadal potrzebna repro, który wariant wystąpił | decided — needs repro |
| D-10 | Spójność polskiej terminologii statusów: zawsze 'Ukończone'/'Aktywne'/'Zarchiwizowane'; wyeliminować 'Domknięte', 'Zostaje', 'Zrobione', 'Otwarte' | DECYZJA (2026-07-03): strefowanie słownictwa z kontraktu product-voice było BŁĘDNE — jedna spójna terminologia statusów w całej aplikacji. Wymaga poprawki kontraktu `context/foundation/product-voice.md:133-147` (sekcja day-memory labels z S-42) + kluczy: `DayMemory.sectionDone/sectionRemains` (pl.json:332-333), `DayMemory.collapsedLine/remainingCount` (:335-338), `Recap.todayDoneTag` (:381) | decided — contract amendment |
| D-11 | Nieprzetłumaczone: 'Alert me when break starts (other tab)' | POTWIERDZONY BUG: hardcode EN w `out-of-tab-break-alerts-control.tsx:46`, komponent nie używa useTranslations; klucza brak w OBU katalogach (en.json/pl.json) — do dodania para kluczy w namespace `BreakAlerts` | STRONG |

## Cross-cutting observations

- D-01 + D-06 + D-07 razem zmieniają strukturę strony głównej (usunięcie hero,
  dodanie navbara, kontrakt kompozycji układu) — przy planowaniu rozważyć jeden
  wspólny change dla warstwy layout/navigation zamiast trzech osobnych.
- D-10 wymaga decyzji produktowej PRZED implementacją (koliduje z celową
  narracją S-42 / product-voice F-14) — nie traktować jako czystego buga.
- Klasa usterek D-01/D-04 (wizualne) jest niewykrywalna dla obecnych testów
  (strukturalne oracles, jsdom); patrz frame D-01, sekcja Cross-System
  Convention.
- D-05 ujawnia klasę bugów: `StyledCheckbox` (`styled-checkbox.tsx:22`) robi
  fallback `id = data-testid` — KAŻDE użycie StyledCheckbox renderowane
  wielokrotnie na stronie z tym samym testid powtórzy ten bug. Przy poprawce
  przejrzeć wszystkie użycia StyledCheckbox, nie tylko daily-standing.
- Do reprodukcji w przeglądarce przed planowaniem: D-08 (nieklikalne "Gdy się
  da"), D-09 (który mechanizm zasłonił plakietkę presetu).

## Decisions log (product owner, 2026-07-03)

Zgłoszenia użytkownika są wiążące. Tam, gdzie kolidują z wcześniejszymi
decyzjami projektowymi, tamte decyzje zostają UNIEWAŻNIONE i wymagają
poprawki (nie ma otwartych pytań produktowych poza reprodukcjami D-08/D-09):

| Unieważniona decyzja | Źródło | Nowe wymaganie |
| --- | --- | --- |
| Baner edukacyjny presetów ("Zestawy wstępnie ustawiają…") | S-29/S-36 | Usunąć (D-02) |
| "Subtelność by design" ilustracji Calm Garden (małe rozmiary, pastel na pastelu) | S-28/S-43, DESIGN.md tokeny ilustracji | Ilustracje wyraźnie widoczne; rewizja rozmiaru/kontrastu, rozważyć scrimy fazy 2 (D-04) |
| Sekcja hero na stronie głównej (tytuł + tagline'y) | S-13/F-06 | Usunąć; branding w navbarze (D-07 + D-06) |
| Strefowane słownictwo statusów ('Domknięte/Zostaje/Zrobione/Otwarte' w narracji dnia) | S-42 + product-voice F-14 (`product-voice.md:133-147`) | Jedna terminologia: 'Ukończone'/'Aktywne'/'Zarchiwizowane'; poprawić kontrakt i klucze (D-10) |
| (warunkowo) Plakietka presetu → "Własny" po edycji atrybutów | S-29/S-36 (`getTaskBadgeDisplayMode`) | Nazwa presetu widoczna na utworzonym tasku (D-09); regułę zrewidować po repro |

## Fix waves (proposed 2026-07-03, list closed)

| Wave | Change (proponowany change-id) | Zakres | Uzasadnienie kolejności |
| --- | --- | --- | --- |
| 1 | `task-ui-quick-fixes` | D-02 (usunąć baner presetów), D-03 (Daily domyślnie zaznaczone), D-05 (duplicate-id StyledCheckbox — naprawić klasę, przejrzeć wszystkie użycia), D-11 (klucz i18n BreakAlerts) | Potwierdzone, małe, niezależne od layoutu — szybka poprawa jakości przy minimalnym ryzyku |
| 2 | `fix-home-layout-spacing` (istnieje, rozszerzyć zakres) | D-01 (kontrakt kompozycji: puste strefy, tokeny odstępów, szerokości per strefa) + D-07 (usunięcie hero) + D-06 (navbar z logo, także na /auth/*) | Frame gotowy (HIGH); D-07 zmienia założenia planu D-01, więc muszą iść razem; największy wizualny efekt |
| — | sesja repro w przeglądarce | D-08 (nieklikalne "Gdy się da"; podejrzani: overflow-hidden `task-list.tsx:338`, blur-save `:407-411`) + D-09 (który mechanizm ukrył plakietkę presetu) | Przed wave 3; wyniki determinują zakres |
| 3 | `task-edit-interaction-fixes` | D-08 + D-09 (wg wyników repro; ew. rewizja reguły preset→Własny) | Wymaga ustaleń z repro |
| 4 | `status-vocabulary-unification` | D-10: poprawka kontraktu `product-voice.md:133-147` + klucze DayMemory/Recap + przegląd użyć | Zmiana kontraktu + copy w wielu strefach; po ustabilizowaniu UI z wave 2 |
| 5 | `illustration-visibility` | D-04: rewizja tokenów/rozmiarów ilustracji, ew. scrimy fazy 2 (S-28) | Craft; sensowny dopiero po nowym layoucie (wave 2), bo powierzchnie ilustracji się przesuną |

Zależności: wave 1 niezależna (może iść równolegle z frame'owaniem wave 2);
wave 5 po wave 2; wave 4 niezależna od 3/5. Każda wave = osobny change →
`/10x-plan` (wave 1 prawdopodobnie nie wymaga pełnego researchu).
