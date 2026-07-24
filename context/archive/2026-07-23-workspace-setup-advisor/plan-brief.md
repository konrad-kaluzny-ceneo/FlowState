# Workspace Setup Advisor — Plan Brief

> Full plan: `context/changes/workspace-setup-advisor/plan.md`

## What & Why

Users get calm, bilingual coaching tips for configuring their work environment (editors, chat DND, notifications, email/phone/OS Focus) inside Settings — as a personal checklist they can mark done. FlowState coaches better habits; it does not block or integrate with external tools.

## Starting Point

Settings already has a tabbed Ustawienia page; Integracje is reserved for an MCP “coming soon” preview. Local preference patterns (break-alerts) and Focus tip widgets exist, but there is no browsable workspace checklist or Settings-first-visit nudge.

## Desired End State

Opening Settings shows a one-time nudge toward a new **Workspace** tab. There, guest and signed-in users browse categorized tips, check them off, and optionally open official guide links. Done state survives reload in that browser scope. Integracje stays MCP-only.

## Key Decisions Made

| Decision | Choice | Why |
| --- | --- | --- |
| Placement | Settings library + first-visit Settings nudge | Discovery without timer-hub / transition risk |
| Interaction | Personal checklist (mark done) | Actionable without fake “must complete” product settings |
| Catalog breadth | Broad (agents, Slack/Teams, browser, email, phone, OS Focus) | Matches #194+ expansion chosen in planning |
| Audience | Guest + authenticated | Coaching does not require an account |
| Persistence | Local only in v1; server later | Fast ship; document sync follow-up |
| Outbound links | Optional official guide URLs | Actionable, still coaching-only |
| Nudge timing | First visit to Settings only | Zero overlay mutex risk |
| Testing | Unit/component + one light guest e2e | L-06-friendly smoke for persistence |

## Scope

**In scope:** Tip catalog + EN/PL copy; local checklist + nudge storage; Workspace Settings tab UI; first-visit Settings banner; Vitest + one Playwright smoke.

**Out of scope:** OS/API integrations; server sync of done tips; MCP/Integracje changes; timer-hub overlays; first-run dialog extension.

## Architecture / Approach

`src/lib/workspace-setup-advisor/` holds stable tip ids + scoped localStorage. A thin hook feeds `workspace-setup-checklist` inside a new `workspace` Settings tab. Nudge dismiss lives in the same local state blob. Copy lives in next-intl (`Settings` chrome + `WorkspaceSetup` tips); voice cites F-14 / product-voice (add Settings copy-zone row).

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Catalog + storage | Tips, i18n, local done/nudge state | Copy quality / link rot |
| 2. Workspace tab UI | Checklist in Settings; MCP untouched | Conflating with Integracje |
| 3. Settings nudge | One-time dismissible banner | Accidental re-show / wrong scope |
| 4. E2E + hardening | Guest persistence smoke | Keep e2e &lt;15s |

**Prerequisites:** S-45 Settings page and F-14 voice already shipped.  
**Estimated effort:** ~2–3 sessions across 4 phases (content authoring is the long pole in phase 1).

## Open Risks & Assumptions

- Guide URLs will age — omit rather than link to weak pages.
- Auth users will not get cross-device checklist sync until a follow-up.
- Broad catalog must stay calm and short per tip or Settings will feel noisy.

## Success Criteria (Summary)

- User can find and complete workspace tips in Settings (guest + auth).
- Nudge appears once on Settings and never on the timer hub.
- Integracje MCP preview unchanged; no external integrations shipped.
