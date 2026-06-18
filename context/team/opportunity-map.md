# Opportunity Map

## Context

- **Project / context**: FlowState — aplikacja Pomodoro do pracy w sesjach (timer, przerwy, powiązanie sesji z zadaniami). Mapa powstała z powtarzalnych tarć użytkownika przy codziennej pracy: równoległe projekty, Daily standup, tryb „gaszenia pożarów”, asynchroniczne domknięcia (build, release). Wejście od właściciela tarć — bez początkowego mining-u repozytorium.
- **Data constraint**: Realne dane pracy użytkownika (sesje w FlowState, codzienna rutyna firmowa). Pierwsza wersja: widok tylko dla użytkownika, lokalne / read-only tam gdzie możliwe; bez eksportu do zespołu i bez sync z Linear/Slack na start.
- **Date**: 2026-06-18

## Map

| Signal | Existing / default response | Thin complement | First useful version | Data risk | Direction if valuable |
|---|---|---|---|---|---|
| Po 8h równoległej pracy większość tematów otwarta, nic nie czuje się domknięte (blokady build/release, wiele projektów) | Linear/Jira, kalendarz, GitHub/CI pokazują *stan*, nie *domknięcie dnia*; część to istotna złożoność async work | Dziennik domknięć dnia — posunięte / czeka / nowe | Wieczorne 5–7 punktów + shutdown ritual (2 min) | local / read-only | Feature (product) |
| Rano na Daily nie pamięta co robił wczoraj mimo pełnego dnia; listy działają tylko gdy je prowadzi | Commity, tickety, listy wymagają dyscypliny; brak chronologii dnia | Digest „Wczoraj” z sesji FlowState | 3–8 aktywności z historii sesji; draft standupu 3 min przed Daily | real work data, read-only, solo view | Feature (product) |
| Na Daily brak odpowiedzi „czym zajmę się 8h” — mówi „pas” / „według priorytetu”; plan i tak by się rozjechał | Backlog Linear/Jira ma priorytety; brak 2 min refleksji + presja performatywna standupu | Szkic 3 intencji (MIT), nie plan 8h | 3 punkty do powiedzenia, edycja ≤1 min przed Daily | local / read-only | Feature (product) |
| Pomimo Pomodoro wchodzi w tryb AUTO (pożary, terminy): sesje bez przerw, bez wody; odrywa się dopiero przy spotkaniu / człowieku | FlowState ma timer i przerwy; telefon, kalendarz — problem to świadome wyłączenie reguł pod presją | Strażnik trybu pracy — profile głęboka vs reaktywna + detektor AUTO | 2 tryby sesji + nudge po pominiętej przerwie + minimum fizjologiczne (woda, wstań) | local / session data | Feature (product) |
| Nie pamięta kto na kim czeka; wraca do ticketów „na wszelki wypadek”; błędne założenia kto czeka na kogo | Linear/Jira + Slack wystarczają technicznie przy dyscyplinie (Blocked, komentarze, ACK) | Osobista mapa oczekiwań (ball-in-court) | 5–10 pozycji + daily „czy nadal prawda?” | local / personal | Feature (product) |

## Recommended First Candidate

```text
Candidate:
Strażnik trybu pracy (Work Mode Guard)

Reads:
Stan sesji FlowState (cykle, pominięte przerwy, długość ciągłej pracy);
ręczny wybór trybu: Głęboka praca / Gaszenie pożarów;
opcjonalnie ręczny sygnał „za chwilę spotkanie”

Returns:
- Dwa profile sesji (dłuższy blok + chronione przerwy vs krótsze cykle reaktywne)
- Przerwa z minimum fizjologicznym po cyklu (wstań + woda, 15–30 s)
- Po 2 pominiętych przerwach: spokojny prompt „wygląda na AUTO — przełączyć tryb reaktywny?”
- Opcjonalnie: bufor przed spotkaniem (5 min) + zapis „gdzie skończyłem”
- Metryka tygodnia: wykonane regeneracje (obok liczby cykli), bez karzących streaków

Does not do:
Nie blokuje pracy w pożarze; nie moralizuje; nie zastępuje timera;
nie digest na Daily; nie sync Linear/Slack; nie mapa ticketów zespołu;
nie udaje, że pożary znikną

Data risk:
Lokalne / sesyjne — stan timera i self-report; bez danych zespołu na start

Direction if it proves valuable:
Feature rdzeniowy FlowState — obietnica „Pomodoro działa też w trudny dzień”
```

## Why This Candidate

**Ewolucja decyzji:** Pierwsza rekomendacja opportunity map (luka w SaaS) wskazywała **Daily Recall** (sygnał 2). Po analizie wellbeing i feedbacku właściciela tarć priorytet przesunięto na **sygnał 4** — rdzeń obietnicy produktu Pomodoro.

**Ranking (wellbeing + product fit):**

1. **Powtarza się codziennie** — tryb AUTO to nie wyjątek, lecz regularny wzorzec w dniach terminowych.
2. **Przyczyna, nie objaw** — sygnały 1, 2, 3 i 5 są w dużej mierze skutkiem wyłączenia rytmu pracy pod presją (łańcuch przyczynowy).
3. **Luka w narzędziu, nie tylko w nawyku** — timer bez moderacji trybu to dekoracja w trybie reaktywnym; FlowState może to adresować jako feature rdzeniowy.
4. **Pierwsza wersja wąska** — dwa profile + jeden nudge + przerwa fizjologiczna; bez integracji zewnętrznych.
5. **Nie zastępuje platformy** — uzupełnia praktykę Pomodoro, nie Linear/Slack.
6. **Ton wellbeing** — coach, nie sędzia; unika kar za pominięte przerwy w realnym pożarze.

**Test sukcesu:** Po 2 tygodniach, w dniach pożarowych: ≥1 świadoma przerwa co 60–90 min (nie tylko spotkanie/człowiek); używanie obu trybów; powrót do cyklu w następnym bloku bez porzucania appki. Sygnał porażki: więcej pomidorów, mniej przerw niż przed zmianą.

**Dlaczego nie pozostałe (skrót):**

| Sygnał | Werdykt |
|---|---|
| 1 — domknięcie dnia | Para z sygnałem 4; naturalny **krok 2** (shutdown po AUTO) |
| 2 — amnezja Daily | Realna luka SaaS, ale **objaw** trybu AUTO; sensowny jako faza 2 |
| 3 — brak planu 8h | Dużo zależy od norm zespołu; FlowState wspiera MIT, sam nie naprawi „pas” |
| 5 — kto na kim czeka | Linear/Slack wystarczają technicznie; problem operacyjny + nawyk ACK |

## Next Direction If Valuable

**Fazowy stack (jeśli kandydat 1 się sprawdzi):**

| Faza | Kandydat | Sygnał |
|---|---|---|
| 1 | Strażnik trybu pracy | 4 |
| 2 | Wieczorne domknięcie dnia | 1 |
| 3 | Daily Recall + Daily Intent (digest wczoraj + szkic MIT) | 2 + 3 |
| 4 | Mapa oczekiwań (ball-in-court) | 5 |

**Wellbeing — wspólne praktyki (niezależnie od feature):**

- WIP limit 2–3 aktywne tematy dziennie
- Shutdown ritual (Cal Newport): co domknąłem / co czeka / pierwszy krok jutro
- Rozdzielenie trybów: głęboka praca ↔ reaktywność ↔ oczekiwanie
- MIT + intencja zamiast fałszywego planu 8h na Daily
- Ball-in-court + ACK w 24h przy handoffach (norma zespołowa + osobisty rejestr)

**Ryzyko produktowe:** Zbyt agresywne nudges w trybie pilności → irytacja i wyłączenie funkcji. Mitigacja: miękki ton, max jeden nudge na okno czasowe, brak streaków karzących.

**Rekomendowany następny krok:** Validate, then shape — `/10x-mom-test` → `/10x-shape` → `/10x-prd` → `/10x-roadmap`.

---

## Appendix: Alternative Candidates Considered

Porównanie kandydatów z sesji opportunity map (jeden wiersz = jeden kandydat):

| Tarcie | Kandydat | Pierwsza wersja | Test sukcesu |
|---|---|---|---|
| 1 | Wieczorne domknięcie dnia | 3 kubełki wieczorem + „co odkładam do jutra” | ≥4/5 „dzień domknięty” mimo ~70% otwartych ticketów |
| 2 | Daily Recall | Digest wczoraj z sesji | ≤30 s odpowiedź „co robiłem wczoraj” |
| 3 | Daily Intent | 3 intencje przed Daily | ≤1 min → 3 zdania zamiast „pas” |
| 4 | Strażnik trybu pracy ★ | 2 profile + nudge AUTO | świadome przerwy w dniach pożarowych |
| 5 | Mapa oczekiwań | ball-in-court + daily weryfikacja | ≤10 s wiesz kto czeka; mniej „sprawdzam na wszelki wypadek” |

★ = wybrany pierwszy kandydat (po re-ocenie wellbeing).

## Appendix: Causal Chain

```text
Sygnał 4 (tryb AUTO / brak przerw)
  → Sygnał 1 (nic nie domknięte)
  → Sygnał 2 (amnezja na Daily)
  → Sygnał 3 (brak planu na dziś)
  → Sygnał 5 (gubienie oczekiwań)
```

## Appendix: SaaS Honesty Notes

- **Sygnał 5:** Linear/Jira + Slack rozwiązują problem *technicznie* przy dyscyplinie statusów i ACK — helper tylko jako osobista warstwa, nie nowy tracker.
- **Sygnał 3:** Backlog ma priorytety — problem to format standupu i brak refleksji, nie brak narzędzia planowania.
- **Sygnał 1:** Część tarcia to istotna złożoność pracy async — aplikacja wspiera granice i domknięcia, nie eliminuje równoległości.
- **Sygnał 4:** FlowState ma timer — problem to moderacja trybu pod presją, nie brak odliczania minut.
