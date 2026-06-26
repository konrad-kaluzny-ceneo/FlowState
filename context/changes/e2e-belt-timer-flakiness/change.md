---
change_id: e2e-belt-timer-flakiness
title: Stabilize E2E belt when fast work cycles race real wall clock
status: implemented
created: 2026-06-24
updated: 2026-06-26
archived_at: null
---

## Notes

Zgłoś nowy błąd do poprawy jako osobny PR.

Belt E2E pada lokalnie przy 4 workerach (domyślnie): specy z `setWorkDurationSec(1)` + `clickStartCycle` oczekują `timer-panel-running`, ale cykl kończy się na prawdziwym zegarze zanim `advanceClockThroughFastWork` zainstaluje fake clock — snapshot pokazuje `cycle-complete-overlay`. Przy `E2E_WORKERS=1` belt przechodzi (21/21). CI na GHA używa `next start` i na main jest zielony; problem dotyczy głównie lokalnego `next dev --turbo` pod równoległym loadem.

Proponowana naprawa: `ensureFakeClock(page)` przed `clickStartCycle` w `e2e/helpers/work-cycle.ts` (wzorzec z `mindful-session-wind-down.spec.ts`). Osobny PR — nie blokuje `remove-done-for-today-button`.
