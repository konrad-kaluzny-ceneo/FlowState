# Smart Day

## Cel aplikacji

Aplikacja wspierająca osoby pracujące w dynamicznym i zmiennym środowisku.  
Jeżeli Twój dzień składa się z kilkunastu lub kilkudziesięciu różnych zadań, przełączania kontekstów, oczekiwania na pipeline’y, pracy rozwojowej pomiędzy „gaszeniem pożarów” — Smart Day ma pomóc Ci zakończyć dzień z poczuciem kontroli zamiast przebodźcowania.

Główne założenia:

- ograniczenie chaosu poznawczego,
- skupienie na najważniejszym zadaniu w danym momencie,
- szybki powrót do kontekstu po przerwaniu pracy,
- wspieranie spokoju, mindfulness i świadomej organizacji dnia.

---

# Problem

Użytkownik ma trudność z:

- odnajdywaniem się w chaosie codziennej pracy,
- wybieraniem aktualnie najważniejszego zadania,
- utrzymaniem koncentracji,
- szybkim powrotem do poprzedniego kontekstu po przerwaniu pracy,
- zarządzaniem wieloma równoległymi obowiązkami.

---

# MVP

## Lista zadań

### Funkcjonalności

- Użytkownik może dodać zadanie na listę.
- Użytkownik może usunąć zadanie.
- Użytkownik może edytować zadanie.
- Użytkownik może oznaczyć zadanie jako ukończone.
- System prezentuje czytelną listę:
  - zadań aktywnych,
  - zadań zakończonych.

---

## Pomodoro

### Funkcjonalności

- Użytkownik może skonfigurować:
  - długość cyklu pracy,
  - długość przerwy.
- Użytkownik może rozpocząć cykl Pomodoro.
- System informuje użytkownika o zakończeniu cyklu.

### Zachowanie systemu

- Koniec cyklu pracy rozpoczyna cykl przerwy.
- Koniec cyklu przerwy rozpoczyna kolejny cykl pracy (po akceptacji użytkownika).
- Pomiędzy cyklami:
  - odtwarzany jest sygnał dźwiękowy,
  - system oczekuje na potwierdzenie przejścia do kolejnego etapu.
- Rozpoczęcie pracy wymaga zalogowania, dane zapisywane są na Bazie Danych.

# Poza MVP (Long Term Solutions)

1. Określanie ważności i pilności zadań.
1. Dodawanie tagów / kategorii do zadań.
1. Statystyki sesji Pomodoro.
1. Grupowanie zadań w projekty.
1. Narzędzie ułatwiające planować zadania wg SMART.
1. Definiowanie deadline'ów i kamieni milowych.
1. Proponowanie przez AI zmian w planie na podstawie statystyk.
1. Śledzenie nawyków (uwzględniając zasady Atomic Habits).
1. Dodawanie zadań cyklicznych.
1. Aplikacja mobilna obok webowej.

---

# Dane

Typy danych obsługiwane przez aplikację:

- zadania jednorazowe,
- zadania powtarzalne,
- nawyki.

---

# Logika biznesowa

## Zadania

Możliwości rozszerzające organizację pracy:

- tagowanie zadań,
- określanie pilności,
- określanie ważności,
- deadline’y,
- notatki do zadań.

---

# Stack technologiczny

## Architektura

- Monorepo: `Turborepo`
- Package manager: `pnpm`

### Założenia

- utrzymanie czystości projektu,
- łatwa rozszerzalność,
- bezpieczeństwo pakietów.

---

## Technologie

| Obszar | Technologia |
|---|---|
| Frontend | Next.js |
| Backend | Next.js |
| Baza danych | Supabase |
| Authentication | Supabase Auth |
| Deploy | Vercel |

---

# CI/CD

## Repozytorium

- GitHub

## Deployment

- Vercel

## Integracje

- Supabase
- Google Auth

---

# Testy

## Główny scenariusz testowy

1. User dodaje 3 zadania.
2. User uruchamia serię Pomodoro:
   - cykl pracy: 10 sekund,
   - cykl przerwy: 3 sekundy.
3. User oznacza 2 zadania jako ukończone.
4. System wysyła powiadomienie o zakończeniu cyklu pracy.
5. System przechodzi w tryb przerwy.
6. System kończy działanie po zakończeniu testowego przepływu.

---

## Strategia testów

### Unit Tests

- Logika biznesowa wydzielona jako niezależne, testowalne funkcje.

### Component Tests

- Wszystkie komponenty UI pokryte testami komponentowymi.

### E2E Tests

- Happy Path pełnego przepływu użytkownika.

---

# Pipeline CI/CD

## Artefakty

- GitHub Projects

---

## GitHub Actions

### `feature/*`

- uruchamianie testów jednostkowych,
- Code Rabbit Review.

### `master`

- walidacja migracji bazy danych.

### `release`

- testy E2E na środowisku INT.

---

## Vercel

- build aplikacji,
- deploy aplikacji.

---

# Monitoring i Observability

## Narzędzia

- Vercel Logs
- Sentry