# First-Run Wedge Onboarding (S-11) — Plan Brief

> Full plan: `context/changes/first-run-wedge-onboarding/plan.md`
> Research: `context/changes/first-run-wedge-onboarding/research.md`

## What & Why

FlowState's check-in → suggestion wedge (S-06) works but new users have no guidance discovering it. S-11 adds a dismissible first-run overlay, recurring empty-list help when active tasks hit zero, and two calm one-line coaches on the first real check-in and first suggestion — teaching the wedge without adding blocking modals or server state.

## Starting Point

No onboarding exists today. Overlay substrate (cycle-complete, check-in at z-60, suggestion card), guest/auth mode split, and `flowstate:` localStorage patterns are shipped. Active list empty state is a single `"No active tasks"` line.

## Desired End State

Guest and auth users see tailored first-run copy once, dismissible via "Got it." Empty active lists always show calm guidance + add-task CTA. Authenticated users get sequential coach subcopy on first check-in (energy tap marks seen) and first ready suggestion — then never again. All flags persist in `flowstate:onboarding:guest` or `flowstate:onboarding:{userId}`.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|----------|--------|------------------|--------|
| First-run audience | Both guest and auth, tailored copy | Mode split already exists; guest needs trial framing, auth needs wedge framing | Research / Proxy |
| Empty-list guide | Show whenever active count is zero | Recurring zero is valid; replaces too-minimal placeholder | Research / Proxy |
| Coach tips | Two sequential one-liners (check-in, then suggestion) | Distinct pipeline moments; subcopy only avoids second gate | Research / Proxy |
| Persistence | localStorage per guest or userId | No profile schema; matches S-08 device-local precedent | Research / Proxy |
| Auth userId source | Server pass-through from `page.tsx` | Session already fetched server-side; avoids new client auth hook | Plan |
| Coach seen timing | Check-in on energy tap; suggestion on first ready render | Engagement-based for check-in; suggestion is passive read | Plan |
| S-14 coordination | `shouldDeferFirstRun()` stub (false until S-14) | Merge-success should win over first-run post sign-in | Research / Plan |
| First-run z-index | `z-[55]` | Above cycle-complete, below check-in gate | Research |

## Scope

**In scope:**
- `src/lib/onboarding/*` storage, types, copy, defer stub
- `useOnboardingState` hook
- `FirstRunOverlay` in `HomeShell`
- `EmptyActiveTasksGuide` in `TaskList`
- Coach subcopy on `CheckInOverlay` + `TaskSuggestionCard` (auth only)
- E2E specs + helper extensions

**Out of scope:**
- Server preferences / Prisma changes
- Cross-device sync, analytics, "remind later"
- Guest check-in/suggestion demo
- S-12 visual polish, S-14 merge UI (stub only)

## Architecture / Approach

```
page.tsx (userId) → HomeShell → useOnboardingState(scope)
                    ├─ FirstRunOverlay (firstRunDismissed)
                    └─ PomodoroDashboard (auth) → CheckInOverlay / TaskSuggestionCard (coach flags)
TaskList → EmptyActiveTasksGuide (activeTasks.length === 0)
localStorage: flowstate:onboarding:guest | flowstate:onboarding:{userId}
```

Hook owns flag reads/writes; components stay presentational. E2E clears scoped keys in `beforeEach`; `ensureIdleCycle` auto-dismisses first-run for regression specs.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|-------|------------------|----------|
| 1. Storage + types | Typed localStorage + hook + unit tests | Corrupt JSON / SSR guards |
| 2. First-run overlay | Dismissible modal in HomeShell | Z-index overlap with cycle-complete |
| 3. Empty-list guide | Recurring zero-state CTA in TaskList | CTA focus wiring on add input |
| 4. Coach subcopy | Auth-only wedge one-liners | Accidentally showing on guest path |
| 5. E2E tests | Auth + guest specs, helper extensions | Existing wedge specs blocked by first-run |

**Prerequisites:** S-06 (wedge), S-08 (guest storage) — both shipped.

**Estimated effort:** ~2–3 implementation sessions across 5 phases.

## Open Risks & Assumptions

- S-14 merge-success UI may race first-run post sign-in — stub ready but needs S-14 wiring
- Copy tone must stay calm; naggy text would fight mindfulness loop (S-12 may refine visuals later)
- Auth `userId` must be non-null before authenticated storage writes — guarded in hook

## Success Criteria (Summary)

- First-time guest and auth users can dismiss first-run and not see it again on revisit
- Zero active tasks always shows guidance with working add-task CTA (FR-008, FR-004)
- Auth users see coach subcopy exactly once on first check-in and first suggestion (FR-020, FR-021, FR-022)
- `task-suggestion.spec.ts` and new E2E specs pass in CI
