# PRD v3 Wedge Coherence — Plan Brief

> Full plan: `context/changes/testing-prd-v3-wedge-coherence/plan.md`
> Frame brief: `context/changes/testing-prd-v3-wedge-coherence/frame.md`
> Research: `context/changes/testing-prd-v3-wedge-coherence/research.md`

## What & Why

Phase 8 must prove the shared PRD v3 wedge-transition invariant across shipped surfaces without reopening those surfaces as product scope or duplicating expensive browser coverage.

This plan closes the remaining test gaps for risks #8-#12 and S-39 operability using the cheapest sufficient layers: conductor unit tests, hook tests, component smokes, and one router integration path.

## Starting Point

Research found the wedge system is already broadly tested: conductor priority, hook pause/optimism/recovery, dashboard overlay matrices, and most S-39 operability paths are covered. The remaining work is gap-closing, led by the break-alerts permission deferral deadlock and a few missing exact-contract oracles.

## Desired End State

Every Phase 8 risk has an explicit automated oracle: one gate per beat, no stuck permission gate, pause is not interruption, PAUSED state persists, recovery UI is operable, and post-check-in optimism does not show stale suggestions. §6.10 of the test-plan cookbook names the new patterns so future wedge changes can reuse them.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Product scope | Quality companion only | Q-08 proves shipped behavior and does not reopen product rows. | Frame / Research |
| Test layer | Hook/component/integration only | Research found every gap observable below Playwright, matching cost x signal rules. | Research / Test Plan |
| First phase | Permission deferral deadlock | This is the named Risk #12 reference incident and largest current gap. | Research |
| Risk #8 shape | Enumerated mutual-exclusion matrix | The conductor input space is small enough for maintainable explicit cases. | Plan |
| Final docs | Update only §6.10 | Cookbook update is in scope; broad test-plan refresh is not. | Frame / Plan |

## Scope

**In scope:**

- Break-alerts permission prompt enable/dismiss and modal operability tests.
- Dashboard tests proving deferred start fires after permission prompt dismiss or enable.
- `wedge-sync-recovery` co-located component test.
- Pause no-interruption hook oracle and persisted PAUSED router integration.
- Conductor exact-one-gate/mutual-exclusion oracle.
- No-stale-suggestion oracle for optimistic post-check-in handoff.
- Focused `context/foundation/test-plan.md` §6.10 cookbook update.

**Out of scope:**

- Product behavior changes, new wedge surfaces, conductor priority changes, or UX redesign.
- Playwright belt/full-catalog additions.
- App-wide accessibility audit or broad axe expansion.
- Phase 5 mutation hardening outside Phase 8 wedge paths.
- General refactors of timer hub files.

## Architecture / Approach

The plan follows the existing DDD/module boundaries: pure wedge beat selection in `src/lib/wedge`, cycle state and async sequencing in `src/hooks`, rendered gate/actionability in `src/app/_components`, and persisted authenticated cycle state in `src/server/api/routers`. Each phase adds the missing oracle at the boundary that owns the behavior.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Break-Alerts Permission Deferral | Prompt operability plus dashboard deferred-start replay | Stuck gate / deadlock (#12) |
| 2. Wedge Sync Recovery Operability | Co-located recovery UI retry/status oracle | Silent or inoperable recovery (#11) |
| 3. Pause Semantics and Persistence | Pause is not interruption; PAUSED round-trip | Session integrity loss (#10) |
| 4. Mutex and Optimistic Suggestion Oracles | One-gate invariant and no stale suggestion handoff | Stacking and stale UI (#8, #9) |
| 5. Cookbook Update and Final Verification | §6.10 update plus `pnpm check` / `pnpm test` | Pattern not durable |

**Prerequisites:** Current branch `features/testing-prd-v3-wedge-coherence`; shipped prerequisites F-07, S-21, S-24, S-28, S-34, S-35, S-39.
**Estimated effort:** 2-4 focused sessions across 5 phases.

## Open Risks & Assumptions

- If a test exposes real shipped behavior drift, keep the fix minimal or split a follow-up if it is not required to make the proof truthful.
- If break-alerts prompt or sync-recovery operability assertions expose missing dialog naming, focus, or polite-status semantics, apply the smallest local component fix needed for the shipped S-39 contract rather than weakening the test.
- Persisted pause integration should fit `cycle.test.ts`; split to a sibling only if the existing file becomes too dense.
- No e2e belt is planned; amend the plan only if implementation proves a contract cannot be observed below browser level.

## Success Criteria (Summary)

- Targeted Vitest commands pass for each phase, then `pnpm check` and `pnpm test` pass.
- Risks #8-#12 each have a direct automated oracle with BDD-style user-visible assertions.
- `context/foundation/test-plan.md` §6.10 reflects the landed Phase 8 patterns without broad strategy churn.
