---
project: FlowState
version: 1
updated: 2026-06-13
status: pointer
---

# Test stack (pointer)

Canonical test strategy and cookbook: [`test-plan.md`](test-plan.md) (§6 grows per rollout phase).

| Layer | Tool | Run |
| --- | --- | --- |
| Unit / integration | Vitest | `pnpm test` |
| Single file | Vitest | `pnpm exec vitest run src/<path>/<name>.test.ts` |
| E2E belt (CI gate) | Playwright | `set CI=true && pnpm test:e2e:belt` |
| E2E full catalog | Playwright | `set CI=true && pnpm test:e2e` |
| E2E conventions | — | `@e2e/README.md`, seed: `@e2e/seed.spec.ts` |

Co-located tests: `*.test.ts` beside source under `src/`. Hooks: `@lefthook.yml`.
