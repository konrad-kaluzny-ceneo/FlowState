# Recommendations — component layer & test-plan gaps

Captured from Ask-mode review of `context/foundation/test-plan.md` (2026-06-11).
Feeds `/10x-research` and `/10x-plan` for change `testing-component-layer-cookbook`.

## Context (why these exist)

- Test plan follows **cost × signal** and Phase 7 already demoted 10 E2E specs to Vitest/component.
- Fast layer **exists on disk** (~17 `*.test.tsx`, hook tests, tRPC integration) but is **under-documented** in §6 cookbook and **under-rolled-out** (§3 Phase 6 `not started`).
- Stryker baseline: large **no-coverage** cluster in `src/app/_components/` (359 mutants cited in §2 Risk #1/#3).

## Prioritized actions

| Priority | Action | Rationale |
|----------|--------|-----------|
| **1** | Ship **§3 Phase 6** (`component smoke + integration`) | Closes the felt gap between E2E belt and UI coverage; targets no-coverage mutants in `_components/` per test-plan §6.7 Phase 6 priority order. |
| **2** | Add **§6.x “Adding a component test”** to `test-plan.md` | Cookbook today has §6.1 unit, §6.2 tRPC integration, §6.3 e2e — component patterns are scattered in §6.3 demotion notes, §6.8 latency, and risk guidance. New section should cover: location `_components/*.test.tsx`; when to mock hooks vs test hook separately; reference tests `mid-cycle-completion-prompt.test.tsx`, `task-list.test.tsx`. |
| **3** | Extend **§4 Stack** with a **component + hook (RTL)** row | Stack table lumps “unit + integration”; hook integration (`use-pomodoro-cycle.test.tsx`) and component smoke are distinct fast layers worth naming explicitly. |
| **4** | Add a **new-slice checklist**: belt row vs component + existing belt seed | Belt includes slice entry smokes (S-06, S-15, S-16) beyond pure risk rows — easy to add E2E when component + `seed.spec.ts` would suffice. Checklist: “Does merge gate need a new belt row, or is component + existing belt seed enough?” |
| **5** | Run **§3 Phase 5** (mutation oracle hardening) **before** adding more E2E | Strengthens assertions on hooks/routers without browser cost; addresses ~685 survived mutants and shallow oracles on covered paths. |

## Non-goals for this change (unless plan expands scope)

- Rewriting §1–§5 strategy wholesale.
- Adding new E2E specs or belt rows.
- Configuring MSW / new test runners — document existing RTL + hook-mock patterns only unless research proves a gap.

## Reference artifacts

- `context/foundation/test-plan.md` — §3 Phase 6 row, §6.8 component smoke, Phase 7 demotion list
- `context/foundation/lessons.md` L-04 — co-located component smoke for unbounded text (textarea vs input)
- `context/changes/testing-e2e-belt-fast/` — precedent for E2E → Vitest/component demotion
