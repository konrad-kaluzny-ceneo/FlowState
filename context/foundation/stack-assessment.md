---
project: flow-state
assessed_at: 2026-06-13T17:03:22Z
agent_readiness: ready-with-compensation
context_type: brownfield
prd_version: 3
assessment_focus: "PRD v3 change scope — wedge conductor, persona trust, daily planning, pause/resume, craft"
stack_components:
  language: TypeScript 6 (strict)
  framework: Next.js 16 App Router + React 19
  api: tRPC 11 + Zod 4 + TanStack Query 5
  orm: Prisma 7 + Neon serverless adapter
  build_tool: Next.js (Turbopack dev)
  test_runner: Vitest 4 + Playwright 1.60
  package_manager: pnpm
  ci_provider: GitHub Actions
  deployment_target: Vercel
  auth: Neon Auth 0.4.x-beta
gates_passed: 9
gates_failed: 0
domain_gaps: 2
---

## Stack Components

**Language — TypeScript 6:** `tsconfig.json` enables `strict`, `noUncheckedIndexedAccess`, and `checkJs`. End-to-end types from Prisma generated client through tRPC routers to React components.

**Framework — Next.js 16 App Router:** T3-derived layout — `src/app/` routes, `_components/` co-located with pages, `src/server/api/routers/` for tRPC. React 19 client components for interactive Pomodoro UI.

**API — tRPC + Zod:** Routers registered in `src/server/api/root.ts`; inputs validated with Zod; React Query integration via `~/trpc/react`. Type-safe contracts without manual OpenAPI.

**ORM — Prisma 7:** Schema in `prisma/schema.prisma`; client generated to `./generated/prisma/client`; Neon HTTP adapter for serverless. Migrations via `pnpm prisma migrate dev` only.

**Testing — Vitest + Playwright:** Unit/integration co-located `*.test.ts` under `src/`; E2E belt in `e2e/` with auth pool and `@skip-belt` tagging. Lefthook runs related tests pre-commit.

**Tooling — Biome 2:** Sole linter/formatter (`pnpm check`); no ESLint/Prettier split.

**CI/CD — GitHub Actions:** Quality job (check, typecheck, test) + E2E job on PR/push to main.

**Deployment — Vercel:** Native Next.js target; preview deploys on PR.

**Auth — Neon Auth (beta):** Email/password, Google OAuth, password recovery; guest local blob merge on sign-in.

**Instruction files:** `AGENTS.md`, `DESIGN.md`, `context/foundation/tech-stack.md`, `context/foundation/test-plan.md`, `context/foundation/user-flow.md`, `context/foundation/roadmap-references/flow-coherence-recommendations.md`.

## Quality Gate Assessment

| Component   | Typed | Convention | Training Data | Documented | Verdict |
|-------------|-------|------------|---------------|------------|---------|
| Language    | ✓     | —          | —             | —          | pass    |
| Framework   | —     | ✓          | ✓             | ✓          | pass    |
| Build tool  | —     | ✓          | ✓             | ✓          | pass    |
| Test runner | —     | —          | ✓             | ✓          | pass    |

Legend: ✓ = pass, ~ = partial, — = not applicable

### Gate Details

**Typed — pass**

- Evidence: `tsconfig.json` → `"strict": true`, `"noUncheckedIndexedAccess": true`.
- tRPC infers procedure I/O; Prisma generates model types; Zod validates at boundaries (`@t3-oss/env-nextjs` for env).

**Convention-based — pass (framework); partial (PRD v3 domain layer)**

- Evidence (framework): `AGENTS.md` documents route layout, tRPC registration, Prisma `@@map`, path alias `~/`.
- Evidence (domain gap): wedge transition logic is distributed across `src/hooks/use-pomodoro-cycle.ts` (~2100 lines), `src/app/_components/pomodoro-dashboard.tsx`, and pure helpers in `src/lib/catch-up/`, `src/lib/session/`. No central **transition conductor** yet (F-07). PRD v3 US-01 depends on extracting orchestration — agents editing one overlay can miss mutex rules documented in `user-flow.md` T-01–T-05.

**Popular in training data — pass**

- Evidence: TypeScript, Next.js App Router, React, tRPC, Prisma, Vitest, and Playwright are mainstream in the JS/TS ecosystem training corpus.

**Well-documented — pass (core); partial (Neon Auth beta)**

- Evidence: Next.js, Prisma, tRPC, Vitest, and Playwright have versioned official docs.
- Partial: `@neondatabase/auth` at `0.4.1-beta` — docs trail stable releases; project compensates via `.cursor/skills/neon-database/SKILL.md` and pinned version in `package.json`.

## PRD v3 Change Scope — Agent Readiness

Assessment scoped to `context/foundation/prd.md` v3 `## Scope of Change` and [`roadmap-references/prd-v3-horizon.md`](roadmap-references/prd-v3-horizon.md).

| Change area | Stack touchpoints | Agent readiness | Notes |
|-------------|-------------------|-----------------|-------|
| **US-01** Transition conductor (F-07, B-05–B-08, S-34, S-35) | `use-pomodoro-cycle.ts`, overlay components, tRPC cycle router | **Needs compensation** | Highest risk: implicit gate ordering. Ship F-07 foundation before feature slices. E2E belt must cover beat mutex. |
| **US-02** Persona presets + trust bridge (S-29, S-32) | Task create UI, `src/lib/scoring/`, suggestion rationale | **Ready** | Typed scoring lib with tests; patterns in `persona-preset-picker.tsx`. |
| **US-03** Daily standing + recap (S-27, S-30) | Prisma schema, task router, narrative builders | **Ready** | Standard CRUD + display; local-midnight reset is a documented PRD constraint. |
| **US-04** Pause/resume (S-24) | Prisma cycle enum, timer hook, guest blob | **Ready with note** | Pause cap ~30 min and no-interruption rule must be in instruction files; touches guest + auth dual path via `data-mode`. |
| **Craft** Focus shell, Calm Garden (S-28, S-31) | `DESIGN.md`, home/wedge components | **Ready** | Visual tokens and `/impeccable` skill referenced in AGENTS.md. |

**Efficient delivery implication:** Core stack does not block PRD v3. Sequential bottleneck is **domain orchestration** (Stream N), not framework choice. Parallel craft slices (S-28, S-31) can run beside S-29; conductor work should not be skipped.

## Gaps & Compensation

### Gap 1 — Wedge transition orchestration (convention at domain layer)

**What failed:** No single module enforces “max 1 interstitial + 1 gate per beat.” Logic spans hook + dashboard + lib helpers.

**Why it matters:** PRD v3 Primary success (US-01) and guardrail against interstitial fatigue. Agents adding S-21 copy, S-17 narrative, or S-19 ack without conductor context will reintroduce B-05-class stacking bugs.

**Compensation:**

- Implement F-07 (`wedge-transition-conductor`) as explicit pure module + hook before S-21/S-34/S-35.
- Require `/10x-plan` to read `user-flow.md` and `flow-coherence-recommendations.md` for any wedge-touching slice.
- Extend E2E belt with beat-mutex scenarios after F-07.

### Gap 2 — Neon Auth beta documentation

**What failed:** Third-party auth provider is pre-1.0; official docs less stable than core stack.

**Why it matters:** Low for PRD v3 (auth preserved, no changes) unless OAuth/guest merge regressions during parallel work.

**Compensation:**

- Pin `@neondatabase/auth` version in plans; use `@.cursor/skills/neon-database/SKILL.md` for auth operations.
- Do not upgrade auth deps in unrelated slices.

### Gap 3 — Dual data mode (guest vs authenticated)

**Not a gate failure** — pattern exists in `src/lib/data-mode/` — but PRD v3 modifies guest narrative (shortened closure) and adds pause semantics across both paths.

**Compensation:**

- Any slice touching session/cycle state must test guest + auth paths.
- Reference `useRepositories()` pattern; never bypass data-mode for “quick fixes.”

## Recommended Instruction File Additions

Ready-to-paste blocks for `AGENTS.md` (add after Layout & conventions):

```markdown
## Wedge transition conductor (PRD v3 / F-07)

- At each transition beat, at most **one interstitial line** plus **one gate** may be visible. Never stack check-in, suggestion, override ack, narrative, wind-down, or break copy on the same beat.
- Gate priority and mutex rules: `@context/foundation/user-flow.md` (T-01–T-05) and `@context/foundation/roadmap-references/flow-coherence-recommendations.md`.
- New transition surfaces MUST route through the conductor module (F-07) — do not add overlay `&&` branches directly in `pomodoro-dashboard.tsx` or `use-pomodoro-cycle.ts` without conductor integration.
- Flow-coherence hotfixes (B-05–B-08) ship before or inside F-07; see `@context/foundation/roadmap.md` Stream N.

## Pause/resume semantics (PRD v3 / S-24)

- Pause suspends cycle timer; does **not** increment session interruption count.
- Pause cap ~30 minutes → auto-end session calmly (PRD v3 OQ1).
- Implement pause for both guest blob and authenticated cycle paths via `@src/lib/data-mode/`.

## PRD v3 planning

- Product contract: `@context/foundation/prd.md` v3 (brownfield). Slice map: `@context/foundation/roadmap-references/prd-v3-horizon.md`.
- Optimistic wedge transitions (S-34): follow optimistic task mutation patterns from S-09; perceived check-in → suggestion ≤200ms.
```

## Summary

**Overall verdict: ready-with-compensation.**

The T3-style stack (TypeScript, Next.js, tRPC, Prisma, Vitest, Playwright, Biome) passes all four agent-friendly criteria at the component level. PRD v3 does not require stack changes — it deepens product behavior on a stack that already supports typed, convention-based agent workflows.

**Key strengths for v3 delivery:** End-to-end typing, established test belt, documented layout rules, scoring lib with unit tests, existing optimistic mutation patterns (S-09), and split roadmap references that keep planning context loadable on demand.

**Key gaps for v3 delivery:** (1) wedge transition orchestration is implicit until F-07 lands — budget conductor foundation before copy/craft slices that touch beats; (2) Neon Auth beta needs version pinning when touching auth-adjacent code; (3) dual guest/auth paths require explicit test coverage for pause and narrative changes.

**Recommended next step:** `/10x-health-check` — dependency audit and CI coverage validation, with focus on E2E belt completeness for PRD v3 guardrails (200ms wedge, network recovery, beat mutex).
