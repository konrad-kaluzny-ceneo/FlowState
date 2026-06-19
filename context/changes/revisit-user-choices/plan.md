---
change_id: revisit-user-choices
title: Review and change prior in-session choices and dismissals
status: planned
created: 2026-06-19
updated: 2026-06-19
---

# Plan: revisit-user-choices (notification preference revisit MVP)

## Approach

Extend break-alerts UI with honest 3-state readout and settings enable path (no overlay replay). UI-only; reuse existing storage keys.

## Progress

- [x] Phase 1: `resolveOutOfTabBreakAlertStatus` + unit tests
- [x] Phase 2: `OutOfTabBreakAlertsControl` — status label, permission on enable
- [x] Phase 3: Timer panel placement — always visible idle; compact running/paused
- [x] Phase 4: Component tests + `pnpm check` + `pnpm test`
- [x] Phase 5: Document revisit pattern note in plan-brief for follow-on slices

## Phase 1 — Status helper

Add `src/lib/break-out-of-tab-alert/preference-status.ts`:

- `disabled` when user preference `enabled === false`
- `enabled` when preference true AND `Notification.permission === 'granted'`
- `not-configured` when preference true AND permission not granted

## Phase 2 — Control UX

- Show status text with `data-testid="out-of-tab-break-alerts-status"`
- On toggle to enabled: if permission `default`, call `requestNotificationPermission()` before persisting
- Keep retry button for denied state

## Phase 3 — Timer hub reachability

- Move control out of break-settings collapse on idle (after audio preference)
- Add same control block to running/paused timer section (≤2 actions during session)

## Automated criteria

- Unit: status resolver cases
- Component: status label renders; enable requests permission when default
- Existing break-out-of-tab tests remain green

## Rollout pattern (follow-on)

Document in plan-brief: each dismissible choice gets storage key + timer-hub readout + user-initiated edit — check-in and wedge dismissals next.
