---
change_id: ui-polish-fixes
title: UI polish — beige palette, task editing, icons, and simplified overlays
status: archived
created: 2026-06-21
updated: 2026-06-22
archived_at: 2026-06-22
---

## Notes

Zgłaszam kilka małych błędów UI w aplikacji:

1. ten fiolet jako podstawowy kolor jest paskudny - zamień go na jakiś przyjazny beż w zgodzie z /impeccable
2. Daily recap - zamiast "not now" powinno być "close", a jeszcze lepiej ikona X
3. Checkbox "Daily standing" jest nieostylowany + powinien być domyślnie zaznaczony na true.
4. Gdy edytuję task powinien mieć on taki sam styl edycji jak przy tworzeniu. Uprości to architekturę aplikacji i poprawi UX.
5. Aktualnie nie da się edytować zamkniętych tasków, nie rozumiem dlaczego miałoby to być zablokowane.
6. Zakończone taski mają przekreślony tytuł, co utrudnia ich czytanie - jakoś inaczej powinniśmy komunikować userowi, że zadanie jest zakończone. (prościej, elegancko)
7. Niektóre przyciski nie mają ikon, np.: "End session", "Focus", "Add", "Interrupt", "Pause". Jeżeli jakaś ikona jest oczywista, użyj jej bez napisu.
8. Widok edycji focus'u jest nieostylowanyt dobrze (Ready to focus on) - tak samo popup "Focusing on".
9. Out-of-tab break alerts ma bardzo dużo informacji, a wystarczyłby sam ostylowany checkbox z napisem o intencji (a ma tytuł, podtytuł, checkbox, dodatkową informację). Uprość ten komponent, wystarczy checkbox z opcją ustawienia alertów. Dodatkowe informacje pokazuj tylko gdy coś się zepsuje.

**2026-06-21 plan expansion:** Daily recap visual polish added to Phase 3 after Phase 1 manual review — raised card elevation, X icon dismiss, remove subtitle, omit empty Last 24h section, chevron toggles (reverses prior "Close" text decision).
