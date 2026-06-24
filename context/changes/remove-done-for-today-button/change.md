---
change_id: remove-done-for-today-button
title: Remove spurious Done for today button; daily recap from completions
status: implementing
created: 2026-06-23
updated: 2026-06-24
frame: context/changes/remove-done-for-today-button/frame.md
research: context/changes/remove-done-for-today-button/research.md
archived_at: null
---

## Notes

zgłaszam nowy błąd w funkcjonalności - nie wiem jak powstał, ale wygląda na zły plan realizacji.
Aktualnie na taskach są 2 typy przycisków do zamknięcia zadania:
- poprawny: "Mark complete"
- dzwiny, błędny, zbędny: "Done for today"
Z jakiegoś powodu powstał ten przycisk, prawdopodobnie źle zostało zrozumiane wymaganie, że zadania zakończone mają tworzyć każdego dnia listę "Daily recap". Ale "Daily recap" powinno po prostu sprawdzać jakie zadania zostały wykonane w ostatnich 24h. Nie powinien być do tego potrzebny osobny przycisk.
