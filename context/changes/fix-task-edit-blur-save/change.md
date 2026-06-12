---
change_id: fix-task-edit-blur-save
title: Fix task edit save when clicking outside the task row
status: new
created: 2026-06-12
updated: 2026-06-12
archived_at: null
---

## Notes

Edycja zadania (tytuł, resumeNote, atrybuty) zapisuje się dopiero po Enter w polu tytułu. Zapis powinien następować również gdy użytkownik kliknie poza wierszem zadania (tło aplikacji) lub wykona inną akcję (Focus, inne zadanie, itp.) — bez utraty zmian w polach resumeNote i pozostałych.
