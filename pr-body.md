## Summary

- Add optional wind-down nudge after Fading check-in when session fatigue or interruption signals align (S-16 / FR-019–FR-021).
- Gate sits between check-in and break/suggestion: **Keep going** continues the loop; **End session** completes the cycle without starting break.
- Seven Playwright proofs plus unit tests for trigger matrix and invitational copy tone.

Fixes #42

## Test plan

- [x] `pnpm check`
- [x] `pnpm test` (303 tests)
- [x] `set CI=true && pnpm test:e2e e2e/mindful-session-wind-down.spec.ts` (7 passed)
- [ ] CI quality + e2e on PR
- [ ] CodeRabbit review
