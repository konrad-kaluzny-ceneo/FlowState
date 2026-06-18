---
change_id: fix-stale-suggestion-after-delete
title: Clear task suggestion when suggested task is deleted
status: planned
created: 2026-06-18
updated: 2026-06-18
archived_at: null
---

## Notes

Zgłoszenie od użytkownika (2026-06-18): mały bug do poprawy w jednej iteracji — **nie naprawiać przed planem**.

### Opis problemu

Gdy FlowState proponuje task jako następny do realizacji, a użytkownik **usuwa ten task** z listy, UI nadal pokazuje go jako proponowany u góry aplikacji (karta „Suggested next task” / kickoff suggestion). Task znika z listy, ale stan sugestii pozostaje „ready” ze snapshotem sprzed usunięcia.

### Kroki reprodukcji

1. Miej co najmniej jeden aktywny task.
2. Rozpocznij sesję Pomodoro i przejdź do momentu, w którym pojawia się sugestia następnego taska:
   - **Ścieżka A (post check-in):** zakończ cykl pracy → check-in → przerwa → karta „Suggested next task”.
   - **Ścieżka B (kickoff):** po zakończeniu przerwy / na starcie sesji → karta kickoff suggestion (gdy `state === "idle"`).
3. Zanotuj proponowany task (tytuł na karcie u góry).
4. **Usuń ten sam task** z listy (przycisk ✕ w wierszu taska).
5. **Obserwuj:** karta sugestii u góry nadal wyświetla usunięty task; użytkownik nie może go zaakceptować sensownie (task nie istnieje na liście).

Oczekiwane: sugestia znika lub jest odświeżana (empty / nowy task / retry), spójnie z aktualną listą aktywnych tasków.

Rzeczywiste: `pendingSuggestion` / `pendingKickoffSuggestion` pozostaje w stanie `ready` z danymi snapshotu API sprzed delete.

### Dotknięte powierzchnie UI

| Powierzchnia | Źródło stanu | Objaw |
| --- | --- | --- |
| Karta u góry (`TaskSuggestionCard`) | `pomodoro.pendingSuggestion` / `pendingKickoffSuggestion` | Tytuł, rationale i CTA „Accept” dla nieistniejącego taska |
| Podświetlenie w liście (`highlightedTaskId`) | `suggestedTaskId` / `kickoffSuggestedTaskId` | Brak wiersza z `data-testid="suggested-task-row"` (task usunięty), ale karta u góry nadal widoczna |

### Prawdopodobna przyczyna (hipoteza do weryfikacji w research)

Sugestia jest **odłączonym stanem lokalnym** w `use-pomodoro-cycle.ts`, ustawianym po `suggestion.next` i trzymanym w `pendingSuggestion` / `pendingKickoffSuggestion` (+ `suggestedTaskId` / `kickoffSuggestedTaskId`). Zawiera snapshot pól taska (`taskId`, `title`, …).

Usunięcie taska idzie przez `useTaskMutations` → `deleteMutation` (optimistic `removeTask` na `task.list`). **Brak mostu** z delete do hooka cyklu: `clearSuggestion()` / analogiczne czyszczenie kickoff nie jest wywoływane, gdy zniknie task pasujący do `pendingSuggestion.data.taskId`.

Porównanie z istniejącym zachowaniem override: `selectTask()` przy break + inny task niż sugerowany — czyści highlight i rejestruje decyzję; delete tego nie robi.

### Zakres do potwierdzenia

- [ ] Oba konteksty sugestii: `post_check_in` (przerwa) i `kickoff` (idle po przerwie).
- [ ] Tryb guest i authenticated (guest: lokalny snapshot; auth: tRPC + optimistic list).
- [ ] Delete sugerowanego taska vs delete innego taska (ten drugi nie powinien psuć sugestii).
- [ ] Delete taska już **pre-focus** (`hasPreFocusedSuggestion` / `hasPreFocusedKickoff`) — osobny edge case.
- [ ] Czy akceptacja sugestii po „duchu” delete (race) wymaga guarda.

### Kierunek naprawy (wstępny, bez implementacji)

1. **Reakcja na brak taska w liście:** gdy `tasks` nie zawiera `pendingSuggestion.data.taskId` (status active), wyczyść sugestię (`clearSuggestion`) lub ustaw `empty` / ponów fetch — spójnie z `showSuggestionCard` / `showKickoffCard`.
2. **Alternatywa:** callback z `TaskList` / `PomodoroDashboard` przy delete — jeśli `id === suggestedTaskId`, wywołaj clear + opcjonalnie refetch.
3. Preferować **jeden punkt prawdy** (sync z `tasks` / `activeTaskIds` już liczonym w dashboardzie) zamiast rozproszonej logiki w delete handlerze.

### Testy (propozycja)

- **Vitest:** efekt/sync w `use-pomodoro-cycle` — sugestia `ready` + task usunięty z listy → status `idle`/`empty` lub refetch.
- **Component smoke:** `pomodoro-dashboard` — mock sugestii + tasks bez sugerowanego id → brak karty ready.
- **E2E (belt):** break z sugestią → delete suggested row → karta znika lub pokazuje empty (jeśli brak innych tasków).

### Priorytet i wielkość

Niski–średni UX bug; mała iteracja (szacunkowo 1 faza planu, bez nowych API). Brak wpływu na dane persystentne poza ewentualnym brakiem `recordDecision` przy cichym clear — do ustalenia w planie.
