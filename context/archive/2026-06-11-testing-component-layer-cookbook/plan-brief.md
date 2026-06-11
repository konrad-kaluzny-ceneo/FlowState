# Testing Component Layer Cookbook — Plan Brief

> Full plan: `context/changes/testing-component-layer-cookbook/plan.md`
> Research: `context/changes/testing-component-layer-cookbook/recommendations.md`

## What & Why

FlowState already demoted 10 e2e specs to Vitest/component (Phase 7), but the **fast component + hook layer** is under-documented in `test-plan.md` and **nine `_components` files still lack co-located tests**. This change closes test-plan **§3 Phase 6**: add component/auth smokes, write **§6.9 cookbook**, extend **§4 stack**, add a **§1 belt-vs-component checklist**, and verify new oracles with **narrowed Stryker** — without expanding the 12-test e2e belt.

## Starting Point

~18 `*.test.tsx` files exist; overlays follow a **dumb component** pattern (`mid-cycle-completion-prompt.test.tsx`); `task-list.test.tsx` mocks hooks; `use-pomodoro-cycle.test.tsx` owns the state machine. Cookbook has §6.1–6.8 but no dedicated component section; §6.3 belt references must not be renumbered.

## Desired End State

Every `_components/*.tsx` has co-located smoke tests; auth server actions tested with mocked Neon auth; `test-plan.md` documents the component layer in §6.9 + §4 + §1; §3 Phase 6 marked `complete`; narrowed Stryker confirms new oracles are not shallow.

## Key Decisions Made

| Decision | Choice | Why | Source |
|----------|--------|-----|--------|
| Rollout scope | Full Phase 6 (tests + docs) | Closes §3 row and the gap you felt between e2e belt and UI coverage | Plan |
| §6 placement | Append **§6.9** | Avoids renumbering §6.3 belt citations | Plan |
| Belt checklist | New **§1** principle | Highest visibility before anyone adds Playwright | Plan |
| Phase 5 relationship | Phase 6 now; narrowed Stryker at end | No-coverage smoke first; mutation hardening stays separate change | Plan |
| Component priority | All 9 untested `_components` | Maximum drop in no-coverage cluster per §6.7 | Plan |
| Dashboard testing | Overlay visibility matrix via mocked hook / optional `PomodoroDashboardBody` export | Cheapest signal without duplicating hook state machine | Plan |

## Scope

**In scope:**
- 9 new/extended component test files + auth action tests + guest-repository gaps
- `test-plan.md`: §1 checklist, §4 row, §6.9, §6.6 Phase 6, §3 complete, §8 update
- Narrowed Stryker on new coverage

**Out of scope:**
- §3 Phase 5 full mutation hardening
- New e2e / belt rows
- MSW, new runners, §1–§5 strategy rewrite

## Architecture / Approach

```
Thin components (props only)
  → guest-banner, kickoff-duration-chips, empty-active-tasks-guide

Guest/auth wiring (mock tRPC/auth)
  → guest-import-on-mount, merge context, oauth verifier, user-menu

Shell/dashboard (mock hooks / export body)
  → home-shell, pomodoro-dashboard

Auth actions + repositories
  → sign-in/action, sign-up/actions, guest-repositories extend

Docs sync → §6.9 + §4 + §1 + Phase 6 complete

Narrowed Stryker → oracle quality gate
```

## Phases at a Glance

| Phase | What it delivers | Key risk |
|-------|------------------|----------|
| 1. Presentational smokes | 3 thin component test files | Over-mocking presentational components |
| 2. Guest/auth wiring | 4 medium component test files | tRPC mock drift |
| 3. Shell & dashboard | home-shell + pomodoro-dashboard smokes | Duplicating hook tests; export vs mock tradeoff |
| 4. Auth actions & repos | action.test.ts + repository gaps | Accidental real auth calls |
| 5. Cookbook sync | test-plan §6.9, §4, §1, Phase 6 complete | Breaking §6.3 references |
| 6. Narrowed Stryker | Oracle verification + §8 note | Time cost of mutation runs |

**Prerequisites:** Phase 7 belt shipped; Vitest + RTL configured (`vitest.config.ts`)
**Estimated effort:** ~2–3 sessions across 6 phases

## Open Risks & Assumptions

- `pomodoro-dashboard` may require exporting `PomodoroDashboardBody` — small prod surface change if hook mocks are too brittle.
- Full Phase 6 does not replace Phase 5 — survived mutants in hooks/routers remain until `testing-mutation-oracle-hardening`.
- Nine component files in one change is large; phases are ordered so early value ships before dashboard complexity.

## Success Criteria (Summary)

- All `_components/*.tsx` have `*.test.tsx`; `pnpm test` green.
- `test-plan.md` §6.9 is the canonical “how to add a component test” answer.
- §3 Phase 6 `complete`; §1 checklist prevents casual belt growth.
- Narrowed Stryker shows no unaddressed user-visible survived mutants on new files.
