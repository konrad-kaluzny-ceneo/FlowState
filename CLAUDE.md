# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Start here

This repo already has a thorough `AGENTS.md` — read it first. It is the source of truth for hard rules (branching, `pnpm`-only, commit conventions, PR/CI gates), commands, hooks, and the `context/` doc-router. Do not duplicate its rules here; this file adds the architectural map `AGENTS.md` doesn't cover.

Also load on demand: `context/README.md` (foundation/changes/archive router), `PRODUCT.md` (brand/product principles), `DESIGN.md` (visual system).

## Commands

- `pnpm dev` — Prisma generate + Next dev (Turbopack), http://localhost:3000
- `pnpm check` / `pnpm check:write` — Biome lint+format (sole linter, no ESLint/Prettier)
- `pnpm typecheck` — `tsc --noEmit`
- `pnpm test` / `pnpm test:watch` — Vitest unit/integration
- Single test file: `pnpm exec vitest run src/<path>/<name>.test.ts`
- `pnpm test:e2e:belt` — CI merge-gate e2e subset (12 tests); `pnpm test:e2e` — full Playwright catalog; `pnpm test:e2e:a11y` — accessibility spec only. See `AGENTS.md` for env vars (`E2E_WORKERS`, `E2E_REUSE_SERVER`, etc.) and `e2e/README.md`.
- `pnpm db:migrate` — `prisma migrate dev` (never hand-write migration SQL); `pnpm db:studio` — Prisma Studio
- `pnpm depcruise` / `depcruise:graph` / `depcruise:report` — dependency-cruiser checks/reports
- `pnpm change-impact` — advisory git co-change + test-suggestion tool; run before editing timer-hub files (see AGENTS.md "Maintainer tooling")

## Architecture

FlowState is a Next.js 16 App Router app (T3-stack style) built around one core loop: **plan a day → pick one task → run a Pomodoro cycle → check in → get a suggested next task → repeat → end-of-day recap.** Almost every subsystem exists to serve that loop.

### Dual data mode: guest vs authenticated

The app runs fully client-side for anonymous visitors and server-persisted for signed-in users, behind one shared interface:

- `src/lib/data-mode/types.ts` defines `TaskRepository`, `CycleRepository`, `SessionRepository` — the contract every feature codes against, never Prisma or tRPC directly from components/hooks.
- `src/lib/data-mode/data-mode-context.tsx` (`DataModeProvider`/`useRepositories`) picks an implementation based on `DataMode` ("guest" | "authenticated"):
  - Guest: `src/lib/repositories/guest-repositories.ts` — persists to browser storage.
  - Authenticated: `src/lib/repositories/server-repositories.ts` — thin wrappers around tRPC client calls.
- Guest → account conversion goes through `src/app/_actions/import-guest-snapshot.ts` / `src/server/api/lib/import-guest-snapshot.ts`.
- When adding a feature that reads/writes tasks, cycles, or sessions, extend the repository interface first, then implement both sides — a guest-only or server-only implementation breaks the other mode silently (no compile error, since components only see the interface).

### Server API (tRPC)

- Routers live in `src/server/api/routers/<feature>.ts` and must be registered in `src/server/api/root.ts` (`appRouter`).
- `src/server/api/trpc.ts` defines `publicProcedure` and `protectedProcedure` (auth-enforced via Neon Auth session, narrows `ctx.session.user` to non-nullable). Use `protectedProcedure` for anything user-scoped.
- Prisma client: `src/server/db/index.ts` (Neon serverless adapter). Schema is `prisma/schema.prisma`; generated client imported via `@prisma/generated`, tables mapped `@@map("flow_state_<name>")`.
- Auth: Neon Auth, wired in `src/lib/auth/server.ts` / `src/lib/auth/client.ts`; env contract in `src/env.js` (Zod-validated — add new env vars there, not ad hoc `process.env` reads).

### The wedge: suggestion + scoring + transitions

The product's differentiator ("the wedge") is session-aware next-task suggestion with a one-line rationale, plus calm transitions between plan/focus/break/summary states:

- `src/lib/scoring/score-task.ts` (+ `dominant-factor.ts`, `rationale.ts`, `rationale-breakdown.ts`, `persona-trust-clause.ts`) — scores candidate tasks against energy level, work type, urgency, and session context to produce a suggestion + rationale.
- `src/lib/wedge/transition-conductor.ts` — the single authority for overlay/gate sequencing between cycle states; new interstitial surfaces must route through it rather than stacking ad-hoc overlays.
- `src/hooks/use-pomodoro-cycle.ts` — the timer-hub hook driving cycle state; paired with `src/app/_components/pomodoro-dashboard.tsx`. Both are considered high-blast-radius files — see AGENTS.md's "Maintainer tooling" (`pnpm change-impact`) before editing either.
- `src/lib/domain/` holds small enums/value types shared across scoring, tasks, and cycles (`work-type.ts`, `energy-level.ts`, `commitment-horizon.ts`, `cycle-end-audio-mode.ts`).
- Timer ticking runs off the main thread via `src/workers/timer-worker.ts` (+ `timer-worker-logic.ts` for the pure logic, tested independently of worker plumbing).

### App structure

- `src/app/<route>/_components/` — page-scoped components co-located with their route (`focus/`, `plan/`, `summary/`, `tasks/`, `settings/`, `auth/`).
- `src/app/_components/` — shared/global components (shell, navbar, overlays, gates) used across routes.
- `src/app/_actions/` — server actions.
- `src/i18n/` — next-intl setup; user-facing strings should go through it, not be hard-coded (see `context/foundation/product-voice.md` for copy tone).

### Testing shape

- Unit/integration: Vitest, co-located `*.test.ts(x)` beside source under `src/`.
- Isolation tests (`*-isolation.test.ts` in `src/server/api/routers/`) verify per-user data isolation for a router — follow this pattern when adding a router that touches user-scoped data.
- E2E: Playwright specs in `e2e/`, modeled on `e2e/seed.spec.ts`; belt subset (`@skip-belt` tag convention) vs full catalog — see AGENTS.md for the exact commands and worker/auth-pool setup.
- Mutation testing available via `pnpm test:mutate` (Stryker), not part of the standard loop.

## Key references (load on demand, not up front)

- `context/foundation/prd.md` — product contract; `context/foundation/roadmap.md` — slice index.
- `context/foundation/user-flow.md`, `context/foundation/roadmap-references/flow-coherence-recommendations.md` — wedge transition/gate rules (T-01–T-05).
- `context/foundation/test-plan.md` — test risk priorities; `context/foundation/lessons.md` — recurring pitfalls.
- `context/map/repo-map.md` — dependency/co-change mapping detail behind `change-impact`.
