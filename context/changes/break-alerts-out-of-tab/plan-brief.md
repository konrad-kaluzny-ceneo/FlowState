# Out-of-tab break alerts (narrow MVP) — Plan Brief

> Full plan: `context/changes/break-alerts-out-of-tab/plan.md`
> PRD: `context/foundation/prd.md` — Change thread PRD: Break alerts outside active tab
> Shape: `context/foundation/shape-notes.md` — Change thread: Break alerts outside active tab

## What & Why

On reactive days, breaks are missed because FlowState’s timer is easy to ignore when another browser tab is active — not because the timer is off. This slice adds **one calm system notification plus best-effort background audio** when a **break actually starts**, so the user can notice without returning to the app first.

## Starting Point

The timer hub already tracks tab visibility, plays cycle-end audio in-tab, and shows catch-up overlays when the user **returns** after a hidden work-cycle expiry. There is no Notification API usage, no break-start alert, and no E2E spec using `e2e/helpers/visibility.ts`.

## Desired End State

When a break timer starts and the app tab is not focused, the user gets at most one system notification (click focuses FlowState) and hears the break alarm when browser policy and audio mode allow. First session offers a one-time permission explain; one settings toggle disables all out-of-tab alerts. In-tab timer, catch-up, pause, and guest/auth paths behave as before.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|----------|--------|------------------|--------|
| Alert channel | System notification + background audio | User explicitly chose both; notification is primary reach | Shape |
| Trigger moment | Break start (`startBreakAfterWorkComplete`) | Work-end alone fires before check-in gate; health-check T2 | Research / Plan |
| Permission UX | First timed session explain | One-time, skippable; settings fallback | Shape |
| Out-of-tab master toggle | Single setting, default on | One-action disable; matches FR-004 | PRD |
| Hook preference wiring | Injected `getOutOfTabBreakAlertsEnabled` from dashboard | Hook lacks `userId`; mirror `getCycleEndAudioMode` | Plan review F1 |
| Denied permission UX | Settings helper + “Try again” | Toggle alone cannot re-grant browser permission | PRD FR-001 / F2 |
| Alert placement | Sync after `startWorker`, before invalidate | Async gap lets user refocus and miss alert | Plan review F4 |
| Fire-mode auto-suppress | Deferred | Settings disable enough for MVP | PRD OQ1 |
| Hook edit timing | After Phases 1–2 tests green | User request + health-check recommendation | Plan |
| E2E in belt | `@skip-belt` first | Notification permission flaky; belt keeps in-tab regression | Health-check |

## Scope

**In scope:** Pure alert module, preference storage (guest + auth), settings UI, first-session permission prompt, hook call at break start, unit/component tests, optional `@skip-belt` e2e.

**Out of scope:** Work Mode Guard profiles, AUTO detector, meeting buffer, native push/PWA/service worker, backend/Prisma, analytics pipeline, screen blocking.

## Architecture / Approach

New pure module under `src/lib/break-out-of-tab-alert/` owns permission checks, notification text, and “should fire” guards. UI adds a toggle in break settings, denied-permission helper, and a first-session overlay (after first-run / cycle-intention). Dashboard passes `getOutOfTabBreakAlertsEnabled` into the hook (mirror audio getter). **Single hook touch:** call the module **synchronously after** `startWorker(endTime)` inside `startBreakAfterWorkComplete` when `document.visibilityState !== "visible"`. Reuse `createAudioManager().playAlarm` for background audio (respect `CycleEndAudioMode` — skip when `muted`).

## Phases at a Glance

| Phase | What it delivers | Key risk |
|-------|------------------|----------|
| 1. Alert core + tests | Pure module + Vitest (no hook) | Wrong guard conditions |
| 2. Preferences + UI | Storage, settings toggle, permission prompt | Overlay stacking with first-run |
| 3. Hook integration | Wire break-start alert | Regressing catchUp / in-tab audio |
| 4. E2E + cookbook | `@skip-belt` spec + test-plan §6 note | CI notification flakiness |

**Prerequisites:** PRD/shape/stack-assessment/health-check threads on disk; feature branch or worktree before implement.  
**Estimated effort:** ~2 day-job sessions across 4 phases.

## Open Risks & Assumptions

- Browser notification permission may stay denied — MVP relies on settings helper + “Try again” + best-effort audio fallback.
- Auth check-in gate delays break start until on-tab interaction; alert fires if tab is hidden during async break creation, not at work expiry.
- Headless Playwright notification assertions may be flaky — run e2e via explicit file path (`@skip-belt`); belt stays in-tab regression only.
- Success validated by 2-week self-assessment (friction owner), not analytics.

## Success Criteria (Summary)

- Break start + unfocused tab → one notification when permission granted and toggle on.
- Full hook test file + belt e2e still green after integration.
- User can disable all out-of-tab alerts in one settings action without breaking in-tab timer.
