# Pre-suggestion Readiness Gate (S-25) — Plan Brief

> Full plan: `context/changes/pre-suggestion-readiness/plan.md`
> Research: `context/changes/pre-suggestion-readiness/research.md`

## What & Why

At session kickoff, FlowState currently hardcodes `STEADY` energy when scoring the first task suggestion (S-15 MVP deferral). S-25 adds the same Focused / Steady / Fading declaration users already make at cycle-end check-in — skippable with Steady default — so kickoff suggestions reflect declared readiness instead of a synthetic constant. Post-check-in suggestion already satisfies this via S-05; no second gate there.

## Starting Point

S-15 ships kickoff `suggestion.next` with server-side `"STEADY"` at `suggestion.ts:229` and client eager fetch on `kickoffEligible` with no UI gate. S-05 `CheckInOverlay` captures energy after each cycle; post-check-in scoring reads `cycle.checkIn.energy`. The gap is kickoff-only.

## Desired End State

Authenticated users see a readiness overlay before the kickoff suggestion card at session-start and post-break idle. Energy (or skip → Steady) feeds `suggestion.next` kickoff input; no CheckIn row on skip. Post-check-in flow unchanged. Guest unchanged.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| -------- | ------ | ---------------- | ------ |
| UI pattern | Extract `EnergySelector`; overlay for kickoff | Matches S-05 check-in pattern; inline chips break loading-state UX | Research |
| Skip persistence | Pass `STEADY` to API only; no CheckIn row | CheckIn is cycle-bound; session-level persistence deferred | Research |
| Post-check-in gate | No second readiness overlay | S-05 check-in already declares energy before break suggestion | Research |
| Guest scope | Out of scope | Guest has no kickoff or check-in gates today | Research |
| Post-break energy | User re-declares at kickoff idle | Avoids stale energy from prior cycle check-in | Research |
| Kickoff rationale keys | Unchanged (`kickoff_fresh` / `kickoff_resume`) | Task selection changes with energy; rationale copy stays kickoff-specific | Research |
| Mutation hooks | Keep separate `suggestionNextKickoff` | S-15 lesson — CI suggestion-priority isolation | Research / Plan |
| L-04 timing | Dismiss overlay within 200ms before fetch | Per-surface NFR oracle for readiness tap/skip | Lessons / Plan |

## Scope

**In scope:** Kickoff `energy` required in API; `EnergySelector` + `KickoffReadinessOverlay`; hook `awaitingKickoffReadiness`; defer eager fetch; unit/hook/component/e2e tests; test-plan §6 update; post-check-in regression verification.

**Out of scope:** Guest readiness; post-check-in readiness UI; CheckIn persistence on skip; last-check-in energy reuse; schema migration; inline card chips; rationale key changes.

## Architecture / Approach

API contract first: kickoff branch of `suggestion.next` accepts required `energy` and passes it to `buildScoringContextForSession`. Client replaces eager fetch on `kickoffEligible` with `awaitingKickoffReadiness` state; overlay mounts in `pomodoro-dashboard` when eligible and not awaiting check-in/wind-down. Submit/skip dismisses synchronously (L-04), then calls existing `fetchKickoffSuggestion(sessionId, energy)` via separate mutation hook. Post-check-in path untouched.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. API — Kickoff Energy Input | Required `energy` in kickoff schema; remove STEADY hardcode; router tests | Client/type breakage until Phase 2 wires energy |
| 2. EnergySelector + Overlay + Hook | Shared buttons, kickoff overlay, deferred fetch | Double prompt if readiness shows during check-in |
| 3. Hook Tests + Component Smoke | Readiness gate unit tests; L-04 oracle; component smoke | 200ms timing test flakiness without fake timers |
| 4. E2E Kickoff Readiness | Updated helpers + session-kickoff spec | Existing e2e assumes immediate network fetch |
| 5. Post-check-in Regression | Verify check-in path unchanged | Accidental readiness mount on cycle complete |
| 6. Test-plan Cookbook | §6 kickoff entry documents readiness step | Doc drift from helper names |

**Prerequisites:** S-05, S-06, S-15 shipped; worktree on `features/pre-suggestion-readiness`.

**Estimated effort:** ~2 sessions across 6 phases (API + hook/UI first session; tests + e2e + cookbook second).

## Open Risks & Assumptions

- Post-break idle timing: readiness must not flash during break-running state (mitigated by existing `kickoffEligible` gates).
- E2E helpers must complete readiness before waiting for `suggestion.next` or specs flake.
- Kickoff rationale copy may not mention energy even when selection changes (accepted — 78% confidence from research).
- Assumption: no external callers of kickoff `suggestion.next` outside the hook (only client mutation).

## Success Criteria (Summary)

- Kickoff suggestion scorer uses user-declared energy (or Steady on skip), not hardcoded STEADY.
- Readiness overlay appears once per kickoff-eligible idle transition; dismisses within 200ms on tap/skip.
- Post-check-in suggestion flow passes all existing tests without modification.
- Guest experience unchanged.
