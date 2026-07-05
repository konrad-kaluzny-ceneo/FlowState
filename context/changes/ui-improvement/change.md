---
change_id: ui-improvement
title: UI polish pass and "coming soon" surfacing across Focus, Tasks, Plan, Summary and Settings
status: implemented
created: 2026-07-05
updated: 2026-07-05
archived_at: null
---

## Notes

celem tego zadania jest dopracowanie UI oraz wyświetlenie informacji o przyszłych funkcjonalnościach:

1. pozbądź się widoku "Na czym się skupiasz w tej sesji?" - całkowicie pozbywamy się feature'a
2. Pytanie "Jaką masz dziś energię" ma wyglądać jak na makiecie (+ energia powinna być zmienialna w ustawieniach)
3. Strona Fokus gdy nie ma następnych zadań powinna wyglądać jak na makiecie (Duży widok "Twój dzień czeka na Ciebie", obok bloczek "Twój dzień", "Wskazówka na dziś" (z elementem wizualnym)
4. Przenieś ze strony Fokus listę ukończonych zadań (przenieś do zakładki Podsumowanie, usprawnij graficznie - dopasuj do aktualnego wyglądu funkcji z makiet)
5. Usuń przycisk "Zadania" ze strony głównej (a przycisk "Dodaj zadanie będzie znajdować się w feature z punktu 3)
6. Dopasuj widok "Zadania" do makiety (zignoruj przycisk zmiany widoku na kafelkowy) - aktualnie widok "Zadania" wygląda na nieostylowany
7. Na widoku "Plan dnia" wyświetl feature kalendarza z makiety, ale z informacją że "Kalendarz wkrótce"
8. Wyświetl tekst motywujący w zakładce Podsumowanie
9. Zakładka ustawienia ma wyglądać jak na makiecie (użyj tych feature'ów, które są w aplikacji)
10. Dodaj do zakładki ustawienia tab Integracje (będą tam opcje połączenia agenta przez MCP, ale napisz że wkrótce)
11. Sprawdź jeszcze raz makiety z folderu @context/foundation/makiety i zastosuj się do stylistyki (aplikacji nadal dużo brakuje do określenia jej jako estetyczną)

Kontekst pracy: jesteśmy na gałęzi features/ui-refactor (PR UI-refactor), która niedługo zostanie zmergowana do main — pozostajemy na tej gałęzi.
