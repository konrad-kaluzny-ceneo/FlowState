---
change_id: fix-task-edit-blur-save
title: Fix task edit save when clicking outside the task row
status: archived
created: 2026-06-12
updated: 2026-06-13
archived_at: 2026-06-13T00:00:00Z
---

## Notes

Edycja zadania (tytuł, resumeNote, atrybuty) zapisuje się dopiero po Enter w polu tytułu. Zapis powinien następować również gdy użytkownik kliknie poza wierszem zadania (tło aplikacji) lub wykona inną akcję (Focus, inne zadanie, itp.) — bez utraty zmian w polach resumeNote i pozostałych.
