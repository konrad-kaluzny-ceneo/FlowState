---
topic: revisit-user-choices notification preference visibility
researcher: ship-slice-orchestrator
created: 2026-06-19
---

# Research: revisit-user-choices (MVP)

## Question

What exists after break-alerts-out-of-tab (PR #138), and what gaps remain for the revisit pattern on timer hub?

## Findings

### Shipped (break-alerts-out-of-tab)

- `OutOfTabBreakAlertsControl` on timer panel idle state, inside collapsed **Break settings** panel.
- `BreakAlertsPermissionPrompt` first-session overlay with Not now → `writeNotificationPromptDismissed`.
- `useOutOfTabBreakAlertsPreference` + `storage.ts` keys for enabled + prompt dismissed.
- Checkbox toggle writes enabled flag; no permission request when enabling from settings.
- Running/paused timer panel has **no** out-of-tab preference surface.

### Gaps vs shaped FRs

| FR | Gap |
| --- | --- |
| FR-001 | No explicit enabled / disabled / not-configured label |
| FR-002 | Enable path exists but buried; running session has no path |
| FR-004 | Toggling on does not call `requestNotificationPermission` when permission is `default` |

### Touch points

- `src/lib/break-out-of-tab-alert/storage.ts` — preference keys (reuse)
- `src/lib/break-out-of-tab-alert/notify-break-start.ts` — permission helpers
- `src/app/_components/out-of-tab-break-alerts-control.tsx` — UI + status
- `src/app/_components/timer-panel.tsx` — placement idle + running
- `src/app/_components/pomodoro-dashboard.tsx` — wiring

### Blast radius

UI-only; no timer hub logic changes beyond existing `getOutOfTabBreakAlertsEnabled` callback.

## Recommendation

Add pure `resolveOutOfTabBreakAlertStatus`, surface control outside break-settings collapse on idle, add compact control on running/paused panel, request permission on user-initiated enable from settings.
