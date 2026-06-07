# Adaptive Task Suggestion (S-06) — Plan Brief

> Full plan: `context/changes/adaptive-task-suggestion/plan.md`
> Research: `context/changes/adaptive-task-suggestion/research.md`

## What & Why

FlowState's wedge feature: after each end-of-cycle check-in, suggest the best next active task with a one-line rationale the user can accept in one click or override via the existing task list (FR-021, FR-022). This closes the adaptive-focus loop that task attributes (S-04) and check-ins (S-05) were built to feed.

## Starting Point

Scoring **inputs** are shipped — `Task.workType`/`weight`, `CheckIn.energy`, session lifecycle, `cycle.countCompletedWork`. No scorer, suggestion UI, override persistence, or `interruptionCount` increment exists. Check-in gate and mid-cycle flows live in `use-pomodoro-cycle.ts`; `checkIn.list` is unused client-side.

## Desired End State

Authenticated user completes a WORK cycle check-in → sees a suggested next task with rationale during the break → can accept (pre-focus + one-click at break end) or override by focusing any other task. Override is recorded and influences the next suggestion. Guest users see no suggestion. Formula is deterministic, unit-tested, and transparent in UI copy.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| -------- | ------ | ---------------- | ------ |
| Suggestion timing | Non-blocking card during break | Avoids third modal gate; break starts immediately per NFR | Research |
| Override UX | Existing Focus buttons + highlight on suggested task | Preserves autonomy; zero new navigation | Research |
| Formula location | Pure function in `src/lib/scoring/` + tRPC router | Testable, single source of truth | Research |
| Override persistence | `SuggestionDecision` Prisma model | Queryable, testable; feeds override feedback to scorer | Plan |
| Time of day | Client passes `localHour` in `suggestion.next` | Accurate local "late day" without timezone DB | Plan |
| Interruption count | Increment on `rebindTask` + mid-cycle early complete | Column exists but unused; needed for rationale accuracy | Research |
| Guest scope | Auth-only (mirror `enableCheckInGate`) | PRD FR-003b excludes scoring from guest slice | Research |
| Empty candidates | Inline card message, no error | Graceful UX when all tasks completed | Plan |
| Mid-cycle check-in path | Same suggestion fetch after check-in | `onMidCycleEndCycleAndBreak` also gates on check-in | Research |
| E2e | New `e2e/task-suggestion.spec.ts` | Dedicated wedge proof without bloating S-01 spec | Plan |

## Scope

**In scope:** `SuggestionDecision` migration, scorer + rationale templates, `suggestion.next`/`recordDecision` tRPC, `interruptionCount` wiring, `TaskSuggestionCard`, hook state, break-end overlay enhancement, unit + integration + e2e tests, test-plan cookbook entry.

**Out of scope:** ML/AI scoring, ranking UI for all tasks, analytics dashboards, guest suggestions, server-side check-in prerequisite, formula calibration from production data, optimistic mutations (S-09), dedicated `check-in-gate.spec.ts`.

## Architecture / Approach

```
checkIn.create → submitCheckIn → confirmComplete (break starts)
                                      ↘ suggestion.next (async, after complete)
                                           ↘ TaskSuggestionCard (during break)
                                                ↘ accept: preFocus + recordDecision
                                                ↘ override: Focus (break-only unlock) + recordDecision
```

Server loads cycle → session → check-in → active tasks → last override in session; pure scorer ranks candidates; client displays top result. Decisions persisted on accept/override.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Schema + session context | `SuggestionDecision` table; `interruptionCount` increment | Migration + transaction ordering with rebind |
| 2. Scoring engine + API | Pure scorer, rationale templates, tRPC procedures | Formula edge cases (ties, single task) |
| 3. Hook + UI | Suggestion card, break-end CTA, override wiring | Hook state races with break timer |
| 4. Tests + e2e | Unit/integration/e2e + test-plan §6 | Flaky e2e if suggestion fetch not awaited |

**Prerequisites:** S-04 and S-05 shipped; branch `features/adaptive-task-suggestion`.  
**Estimated effort:** ~3 implementation sessions across 4 phases.

## Open Risks & Assumptions

- v1 formula coefficients are starting points — post-launch tuning does not require schema changes.
- Client `localHour` is trusted input (same user, non-security-sensitive).
- Suggestion fetch failure should not block break — card shows retry/error state.

## Success Criteria (Summary)

- After check-in, user sees suggestion with rationale during break within NFR feedback window.
- Accept pre-focuses task; break-end Continue starts next cycle in one click.
- Override via Focus records decision and clears suggestion highlight.
- `pnpm check`, `pnpm typecheck`, `pnpm test`, `CI=true pnpm test:e2e` all green.
