---
change_id: fix-e2e-suggestion-ci
title: Fix E2E suggestion flakiness and slow CI runs
status: impl_reviewed
created: 2026-06-09
updated: 2026-06-09
archived_at: null
---

## Notes

mam problem z moim CI/CD:
- testy E2E bardzo długo lecą, a powinny przechodzić w maksymalnie 3 minuty (jeżeli jest dłużej, to mamy jakiś problem w testach)
- dodatkowo w skillu /10x-ship-slice mam zaznaczone, by czekać na testy e2e, ale testy nie przechodzą tam z jakiś powodów (chyba są flacky)

CI run: https://github.com/konrad-kaluzny-ceneo/FlowState/actions/runs/27192758165/job/80277007754

6 failed — all timeout on `getByTestId('suggestion-accept-btn')` in `e2e/helpers/suggestion.ts:32` after `waitForSuggestionNext`:
- first-run-onboarding.spec.ts (2 tests)
- mindful-session-wind-down.spec.ts (1 test)
- task-suggestion.spec.ts (3 tests)

42 passed in ~9.3 min with 1 worker on GitHub Actions.
