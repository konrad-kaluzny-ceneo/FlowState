# Cross-day stale session fix — Plan Brief

> Full plan: `context/changes/fix-cross-day-stale-session/plan.md`
> Roadmap: `context/foundation/roadmap-references/items/S-53.md`

## What & Why

Returning on a new local day with a stale prior-day session currently resumes an expired break cycle in overtime — the UI shows a false break instead of a calm fresh-day open. US-18 / FR-014 require the prior day to close calmly with honest totals and no spurious break prompt.

## Starting Point

`cycle.getActive` returns any `RUNNING`/`PAUSED` cycle on an `ACTIVE` session with no local-date guard. The 4h inactivity timeout in `findOrCreateActiveSession` only runs on `getOrCreateActive`, not on hydrate. Break cycles past expiry intentionally resume in overtime (`resumeFromActiveCycle`) — correct same-day, wrong cross-day. B-06 already shows a closure overlay for `ENDED_BY_TIMEOUT` on idle hydrate.

## Desired End State

On first open of a new local day (cold start or tab-return after midnight), a stale prior-day session closes server-side, active cycles are interrupted, the user sees a calm closure overlay with honest totals, and the timer hub lands idle — never a false break UI. Guest and authenticated modes behave the same.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Cross-day trigger | Close on first open / hydrate | Matches PRD SLA (no false-break flash); no background midnight job needed | Plan |
| Closure UX | Calm closure overlay (B-06 pattern) | Reuses proven handoff; user gets honest totals context | Plan |
| Architecture locus | Server guard on `getActive` / `getOrCreateActive` | Single source of truth; client cannot resume stale state | Plan |
| Guest scope | Full guest + auth parity | Repository contract requires both modes | Plan |
| Tab left open | Re-check on `visibilitychange` | Same lazy rollover pattern as `use-day-plan.ts` | Plan |
| Session end reason | `ENDED_BY_CROSS_DAY` (new enum) | Distinct from inactivity timeout for analytics and copy | Plan |
| Cycle disposition | `INTERRUPT` all `RUNNING`/`PAUSED` | Matches existing timeout path; preserves S-52 elapsed totals | Plan |
| Testing | Server router + hook Vitest | High blast-radius timer hub; no new Playwright e2e (L-06) | Plan |

## Scope

**In scope:** Prisma `SessionState` extension; shared server close helper; `getActive` + `getOrCreateActive` cross-day guard with client `localDateKey`; timer-hub hydrate + date-rollover re-recovery; closure overlay for cross-day end; guest repository parity; Vitest server + hook regression tests.

**Out of scope:** Day-open steering (S-59), schedule blocks, midnight background jobs, E2E overnight scenarios, guest→auth import changes, F-07 conductor changes.

## Architecture / Approach

Client supplies today's `localDateKey` on every `getActive` call. Server compares it to the active session's `lastActivityAt` calendar day; on mismatch, closes the session (`ENDED_BY_CROSS_DAY`), interrupts orphan cycles via `computeSessionEndMetadata`, and returns no active cycle. Client `recoverActiveCycle` then follows the existing idle path → `getLastEnded` → closure overlay. A `visibilitychange` date-key sync re-runs recovery when the tab stays open across midnight.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Server cross-day close | Enum, close helper, guarded `getActive` / `getOrCreateActive` | Prisma migration + type union sweep |
| 2. Timer hub hydrate + overlay | `localDateKey` pass-through, date rollover re-recovery, closure for cross-day | Recovery guard must allow re-run on date change |
| 3. Guest parity + tests | Guest close semantics + Vitest false-break oracles | Guest has no server path — logic must mirror server |

**Prerequisites:** S-52 (honest totals), F-07 (conductor shipped). Run `pnpm change-impact` before Phase 2.

**Estimated effort:** ~2–3 focused sessions across 3 phases.

## Open Risks & Assumptions

- Server SSR prefetch uses host timezone for `localDateKey`; client hydrate is source of truth — brief cache mismatch acceptable.
- `ENDED_BY_CROSS_DAY` closure copy reuses default closure line (no dedicated i18n key unless copy review requests one).
- Tab open across midnight without any `visibilitychange` (always-visible pinned tab) may delay recovery until next visibility event — accepted per lazy-close model.

## Success Criteria (Summary)

- Opening FlowState on a new local day with a stale break cycle shows closure overlay then idle — never break UI.
- Prior-day session recorded as `ENDED_BY_CROSS_DAY` with honest totals preserved (S-52).
- Guest and authenticated paths produce the same recovery behavior for equivalent state.
