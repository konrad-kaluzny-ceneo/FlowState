# FlowState - Założenia redesignu UX/UI

## Cel redesignu

FlowState nie powinien przypominać klasycznego menedżera zadań (Todoist, Jira, Trello czy ClickUp).

Jego głównym zadaniem jest pomaganie użytkownikowi wejść w stan głębokiego skupienia, ograniczyć przeciążenie poznawcze oraz prowadzić przez dzień w spokojny sposób.

Po wejściu do aplikacji użytkownik powinien odczuć:

- spokój,
- jasność,
- jeden kierunek działania,
- brak presji,
- poczucie kontroli.

Aplikacja ma prowadzić użytkownika przez dzień, a nie wyświetlać wszystkie dostępne informacje jednocześnie.

---

# Główna zasada projektowa

## Jeden ekran = jedna decyzja

Aktualny ekran wymaga podjęcia wielu decyzji jednocześnie:

- wybór energii,
- wybór celu sesji,
- dodanie zadania,
- wybór typu zadania,
- analiza aktywnych zadań,
- analiza ukończonych zadań,
- podsumowanie dnia,
- archiwum,
- Daily,
- statystyki.

To stoi w sprzeczności z ideą aplikacji.

Nowy interfejs powinien wyświetlać wyłącznie informacje potrzebne użytkownikowi w aktualnym momencie pracy.

---

# Nowa architektura aplikacji

## 1. Widok "Sesja Fokusu" (Home)

To jest główny ekran aplikacji.

Powinien zawierać jedynie:

- aktualne zadanie,
- duży timer Pomodoro,
- przycisk Start,
- krótki postęp dnia,
- opcjonalne przypomnienie lub cytat.

Na tym ekranie nie pokazujemy:

- listy zadań,
- ukończonych zadań,
- statystyk,
- archiwum,
- filtrów.

To ekran wykonywania pracy.

---

## 2. Widok "Zadania"

Oddzielny ekran służący organizacji.

Tutaj znajdują się:

- aktywne zadania,
- zaplanowane zadania,
- ukończone zadania,
- dodawanie nowych zadań,
- edycja zadań.

To nie jest ekran pracy.

To ekran planowania.

---

## 3. Widok "Plan dnia"

Osobny ekran odpowiedzialny za planowanie dnia.

Powinien zawierać:

- harmonogram,
- kolejność wykonywania zadań,
- plan sesji Pomodoro,
- ewentualne spotkania.

---

## 4. Widok "Podsumowanie"

Oddzielny ekran zawierający:

- statystyki,
- historię dnia,
- liczbę sesji,
- czas skupienia,
- wykonane zadania.

Statystyki nie powinny być widoczne podczas pracy.

---

# Upraszczanie ekranu głównego

Na ekranie głównym nie powinny znajdować się:

- lista ukończonych zadań,
- archiwum,
- pełna lista aktywnych zadań,
- wszystkie tagi,
- priorytety,
- wagi,
- filtry,
- dodatkowe informacje organizacyjne.

Wszystkie te elementy są potrzebne wyłącznie podczas planowania.

---

# Projekt kart zadań

Obecnie karta zawiera zbyt wiele informacji jednocześnie.

Przykład:

- nazwa zadania,
- typ,
- priorytet,
- waga,
- ASAP,
- estymowany czas,
- inne oznaczenia.

Nowa karta powinna być znacznie prostsza.

Przykład:

```
Monitoring - usprawnienia ręczne

Głęboka praca • 45 min
```

Pozostałe informacje powinny być dostępne dopiero po wejściu w szczegóły zadania.

---

# Dodawanie zadania

Obecnie użytkownik od razu widzi:

- zestawy,
- typy,
- checkboxy,
- informacje pomocnicze,
- pole tekstowe.

Nowe podejście:

Na ekranie widoczny jest wyłącznie przycisk:

> ➕ Dodaj zadanie

Po kliknięciu otwierany jest modal zawierający:

- nazwę,
- typ,
- przewidywany czas,
- priorytet,
- opcjonalne dodatkowe informacje.

---

# Energia

Pytanie o energię powinno pojawiać się wyłącznie na początku dnia.

Po dokonaniu wyboru:

- Skupiony
- Stabilny
- Słabnący

sekcja zostaje ukryta.

Nie zajmuje miejsca przez resztę dnia.

---

# Cel sesji

Analogicznie do energii.

Pokazywany raz.

Po wybraniu celu, np.

> Głęboka praca

sekcja znika.

---

# Daily

Nie powinno być osobnym dużym modułem.

Wystarczy niewielki panel zawierający:

```
Dzisiaj

3 / 8 zadań
2 sesje
2 h 15 min skupienia
```

---

# Timer

Timer powinien być najważniejszym elementem całej aplikacji.

To on ma przyciągać wzrok.

Po wejściu użytkownik powinien od razu wiedzieć:

- jakie zadanie wykonuje,
- ile czasu pozostało,
- że wystarczy kliknąć "Start".

Timer jest sercem aplikacji.

---

# Nawigacja

Większość funkcji należy przenieść do menu.

Desktop:

- Fokus
- Zadania
- Plan dnia
- Podsumowanie
- Ustawienia

Mobile:

Dolny pasek nawigacyjny z tymi samymi sekcjami.

---

# Estetyka

Interfejs powinien kojarzyć się bardziej z aplikacją wellbeing niż z narzędziem do zarządzania projektami.

Założenia:

- dużo białej przestrzeni,
- delikatne odcienie beżu,
- miękka zieleń jako kolor akcentu,
- subtelne cienie,
- zaokrąglone karty,
- minimum ramek,
- minimum kontrastów.

Kolor powinien prowadzić uwagę użytkownika, a nie dekorować interfejs.

---

# Typografia

Projekt powinien wykorzystywać:

- większe nagłówki,
- mniej tekstów pomocniczych,
- większe odstępy,
- krótsze komunikaty,
- czytelną hierarchię informacji.

Interfejs powinien "oddychać".

---

# Ikony

Ikony powinny wspierać orientację w interfejsie.

Należy:

- ograniczyć ich liczbę,
- usunąć dekoracyjne ikony,
- pozostawić jedynie te, które pomagają zrozumieć funkcję elementu.

---

# Zasady UX

Projekt powinien być tworzony zgodnie z następującymi zasadami:

1. Najpierw skupienie, potem organizacja.
2. Jeden ekran odpowiada jednej decyzji.
3. Minimalna liczba decyzji na każdym etapie.
4. Maksimum pustej przestrzeni.
5. Planowanie i wykonywanie pracy są od siebie oddzielone.
6. Statystyki nie rozpraszają podczas pracy.
7. Timer jest centralnym elementem interfejsu.
8. Interfejs ma uspokajać zamiast motywować agresywnie.
9. Aplikacja przypomina bardziej narzędzie mindfulness niż klasyczny task manager.
10. Każdy element interfejsu powinien odpowiadać na pytanie:

> Czy pomaga użytkownikowi wejść w stan Flow?

Jeżeli odpowiedź brzmi "nie", element powinien zostać ukryty, uproszczony lub przeniesiony do innego widoku.

---

# Kierunek projektowy

FlowState nie konkuruje z Todoist, TickTick czy ClickUp liczbą funkcji.

Jego przewagą jest doświadczenie użytkownika.

Najważniejsze wartości produktu:

- mniej bodźców,
- więcej spokoju,
- jedno zadanie na raz,
- świadome planowanie,
- głęboka praca,
- ograniczenie przełączania kontekstu,
- zdrowy rytm pracy zgodny z metodą Pomodoro i zasadami wellbeing.