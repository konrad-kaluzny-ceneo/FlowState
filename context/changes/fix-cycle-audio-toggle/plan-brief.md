# Fix Cycle End Audio Toggle (B-01) — Plan Brief

> Full plan: `context/changes/fix-cycle-audio-toggle/plan.md`
> Research: `context/changes/fix-cycle-audio-toggle/research.md`

## What & Why

S-20 shipped persistent cycle-end audio toggles (Normal / Soft / Muted), but production users report clicks do nothing ([#72](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/72)). The server-reconciliation effect in `useCycleEndAudioPreference` re-enters whenever `suggestionFetchInFlight` flips and overwrites optimistic UI with stale React Query cache — making toggles appear dead. This plan restores immediate toggle response and persistence (FR-013 / FR-014) without touching UI components or backend.

## Starting Point

Hook implements local-first state + deferred `preference.set` + server reconcile on `preference.get` success. Commit `b493dee` added `suggestionFetchInFlight` to the sync effect deps, increasing overwrite frequency. UI (`CycleAudioPreferenceControl`) and API (`preference.get`/`set`) work correctly. E2E covers seeded muted preference and S-22 catch-up but never clicks toggle buttons.

## Desired End State

Users click any cycle-end audio toggle and see the active button change within 200ms. Auth preference persists server-side across reload; guest preference persists in localStorage. Hook unit test and E2E live-click specs prevent recurrence. Suggestion-priority serialization and guest→auth merge remain intact.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Root cause | Server-sync effect overwrite | Stale `preferenceQuery.data` re-applied after optimistic `setMode` | Research |
| Fix location | `use-cycle-end-audio-preference.ts` only | UI and API are not broken | Research |
| Sync strategy | `hasInitialSyncRef` — one unconditional overwrite per scope | Stops re-entry on `suggestionFetchInFlight` without removing idle gating | Plan |
| Cache coherence | `setMutation.onSuccess` → `preference.get.setData` | Eliminates stale-read loop if query is consulted later | Research / Plan |
| Effect deps | Remove `setMutation` from sync effect deps | Mutation object identity re-triggered effect unnecessarily | Research |
| Serialization | Keep `waitUntilSuggestionIdle` in sync and `setMode` | Preserves CI fix from `b493dee`/`5c32f9f` — no tRPC deadlock regression | Research |
| Mutation failure | Keep optimistic UI, no rollback/toast | Matches pre-regression behavior; out of bug-fix scope | Plan |
| Unit test | New `use-cycle-end-audio-preference.test.tsx` | Hook layer had zero coverage for the race | Research / Plan |
| E2E strategy | Live-click Normal→Soft→Muted in auth + guest specs | Closes seed-only gap; keeps existing muted e2e as regression | Research / Plan |
| UI/backend scope | No changes | Research confirmed click handlers and router are correct | Research |

## Scope

**In scope:**

- `hasInitialSyncRef` guard + scope reset in `useCycleEndAudioPreference`
- `setMutation` `onSuccess` cache write
- Stable sync effect dependencies
- Hook unit test for overwrite race
- Live-click E2E tests (auth + guest)
- Test-plan §6 cookbook note for live-toggle pattern

**Out of scope:**

- `CycleAudioPreferenceControl`, `TimerPanel`, dashboard wiring
- `preference` router / Prisma changes
- Error toast or rollback on `preference.set` failure
- B-03 optimistic cycle start/interrupt

## Architecture / Approach

```
Click → setMode → setModeState (optimistic) + writeCycleEndAudioMode
                → waitUntilSuggestionIdle → preference.set
                → onSuccess → preference.get.setData (cache fresh)

Mount → preference.get (gated on !suggestionFetchInFlight)
      → sync effect (once per scope) → reconcile localStorage with server
      → hasInitialSyncRef = true → subsequent effect runs skip overwrite
```

Suggestion-priority link unchanged — preference calls still defer until suggestion idle; only the *repeat* server overwrite is eliminated.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Hook sync guard | One-time sync + cache onSuccess + unit test | Guest-merge path must still run exactly once on first auth mount |
| 2. Live-click E2E | Auth + guest click regression + cookbook note | E2E flake if suggestion fetch overlaps toggle assertion |

**Prerequisites:** S-20 shipped; branch `features/fix-cycle-audio-toggle`; research complete  
**Estimated effort:** ~1 session, 2 phases

## Open Risks & Assumptions

- Guest production repro is unconfirmed (static analysis says guest path should work); E2E live-click will verify
- Auth dashboard always has `enableSuggestionGate` — high `suggestionFetchInFlight` churn assumed
- No cross-tab preference sync required — one-time local sync per scope is acceptable

## Success Criteria (Summary)

- Clicking any toggle updates `aria-pressed` immediately without API/localStorage pre-seed
- Auth Soft selection survives page reload
- `pnpm test`, `pnpm check`, and quiet-cycle e2e specs pass including new live-click tests
