---
change_id: fix-suggestion-decision-save
title: Fix spurious suggestion preference save failures
status: archived
created: 2026-08-04
updated: 2026-08-07
archived_at: 2026-08-07T15:05:31Z
---

## Notes

Bug report: authenticated users frequently see
"Nie udało się zapisać preferencji sugestii. Twój wybór jest zachowany lokalnie."
when accepting/overriding a kickoff suggestion. Root cause: suggestion pool includes
`planned` tasks, but `recordDecision` ownership check only allows `active`.
