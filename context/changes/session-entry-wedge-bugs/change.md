---
change_id: session-entry-wedge-bugs
title: Fix session entry wedge bugs on first visit and return
status: impl_reviewed
created: 2026-06-20
updated: 2026-06-20
---

## Notes

gdy wejdę do aplikacji pierwszy raz po przerwie trafiam na "Session complete — 0 cycles". Przy pierwszym wejściu widzę "Continue: ..." bez Focus zamiast "Suggested next task". "What's your focus this session?" powinno być Card (nie popup), Skip gdy nie wybrano. Popup nie da się przeklikać.
