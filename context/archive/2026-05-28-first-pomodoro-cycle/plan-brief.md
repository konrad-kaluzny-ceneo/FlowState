# First Pomodoro Cycle — Plan Brief

> Full plan: `context/changes/first-pomodoro-cycle/plan.md`
> Research: `context/changes/first-pomodoro-cycle/research.md`

## What & Why

Build the north-star validation milestone for FlowState: a user picks an existing task, runs one configurable work cycle with a real-time countdown, hears an audio alarm at cycle end, and confirms the transition — all without losing state on refresh. This proves the core hypothesis that FlowState can deliver trustworthy, mindful Pomodoro cycles.

## Starting Point

The data layer is complete (F-01): Cycle/Session/Task models exist with `startedAt`, `configuredDurationSec`, `state`. tRPC routers have `cycle.create` and `cycle.list`. The task list UI has full CRUD with active/completed split. E2E infrastructure (F-02) is in place. Missing: active cycle query, complete mutation, timer engine, audio, and the entire focus/countdown/confirmation UI.

## Desired End State

A logged-in user can click "Focus" on any task, choose a duration, start a cycle, see a live countdown that stays accurate in background tabs (≤2s drift), hear a chime when it ends, and confirm via "Done" or "Continue later". Refreshing mid-cycle resumes seamlessly. The full loop works end-to-end.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|----------|--------|-------------------|--------|
| Timer accuracy mechanism | Web Worker + wall-clock derivation | Workers are unthrottled in background tabs; wall-clock prevents drift accumulation. | Research |
| Audio delivery | Web Audio API (resume on Start click) + HTML5 fallback | AudioContext unlocked by user gesture fires on audio thread even in background. | Research |
| Crash recovery | Server-authoritative (derive from startedAt + duration) | Zero additional infrastructure; Cycle model already has all needed fields. | Research |
| Session management | Auto-create on first cycle start | Removes friction; explicit session lifecycle deferred to S-02. | Plan |
| Duration persistence | localStorage (not server) | Instant access, zero API calls; server sync is post-MVP. | Plan |
| Cycle-end UX | Overlay with "Done" + "Continue later" | FR-014 requires explicit confirm; two CTAs cover both task-done and task-ongoing scenarios. | Plan |
| Task list during cycle | Visible but read-only | Prevents accidental mutations during focus; user can still see their list. | Plan |
| UI approach | Inline panel (no separate page/modal for timer) | Matches existing single-page pattern; minimizes context switch. | Plan |

## Scope

**In scope:**
- Task focus selection (highlight + "Focus" button)
- Configurable duration (presets 15/25/45/60 + custom 5–90 min)
- Web Worker countdown with ≤2s drift guarantee
- Audio alarm (MP3 chime via Web Audio + fallback)
- Cycle-end confirmation overlay
- Crash/refresh recovery
- Interrupt (manual stop) capability
- localStorage duration preference
- Full test pyramid (unit + integration + E2E)

**Out of scope:**
- Break cycles, session lifecycle (S-02)
- Mid-cycle task completion prompt (S-03)
- Energy check-in (S-05), task suggestion (S-06)
- Server-side duration persistence
- Volume/mute controls
- Mobile optimization

## Architecture / Approach

Server records `cycle.startedAt` + `configuredDurationSec` as source of truth. Client derives remaining time via `endTime - Date.now()`. A Web Worker ticks every 1s (unthrottled in background). Web Audio schedules the alarm on the audio thread. Visibility API corrects display on tab re-focus. On page load, `cycle.getActive` query enables instant recovery. Single `usePomodoroCycle` hook orchestrates all pieces.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|-------|-----------------|----------|
| 1. Server Layer | `getActive`, `complete`, `interrupt` procedures + session auto-creation | Schema assumptions wrong (mitigated: F-01 already built the model) |
| 2. Timer Engine | Web Worker + AudioContext + `usePomodoroCycle` hook | Worker bundling in Next.js (mitigated: webpack 5 native support) |
| 3. UI Components | Focus selection, timer panel, duration picker, completion overlay | No existing modal component — built from scratch |
| 4. Recovery & Polish | Refresh recovery, visibility API, localStorage, error handling | Edge cases in expired-while-hidden scenario |
| 5. Testing | Unit + integration + E2E Playwright test | E2E timing (mitigated: use `page.clock` for fast-forward) |

**Prerequisites:** F-01 (done), F-02 (done), audio asset (`public/sounds/pomodoro-complete.mp3` — must be manually sourced, royalty-free)
**Estimated effort:** ~3-4 sessions across 5 phases

## Open Risks & Assumptions

- **Audio asset**: Must be manually sourced (freesound.org CC0 or mixkit.co). Without it, audio features degrade to visual-only.
- **Web Worker in Turbopack dev**: The `new URL('./worker.ts', import.meta.url)` pattern works in webpack 5 (production build). Turbopack (dev mode) support is assumed but needs verification during Phase 2.
- **Minimum cycle duration**: Schema allows 60s minimum. E2E tests need either a test-env override or Playwright clock manipulation to avoid 60s waits.

## Success Criteria (Summary)

- User completes a full focus-cycle on a selected task without losing state on refresh
- Timer drift ≤ ±2s verified in background tab scenario
- Audio alarm fires reliably on Chrome/Firefox/Edge desktop
