# Platform Refactor Batch (F-15) Implementation Plan

## Overview

Close the remaining tail of the `refactor-opportunities` rollout plus the deferred
production-hygiene issues gathered under foundation epic **F-15** (GitHub #190 / FLO-96).
The batch ships as six independently mergeable phases, ordered **low-risk / independent
first**, with the high-blast-radius timer-hook extract (F-09) last so it can be cut without
blocking the rest.

## Current State Analysis

The `refactor-opportunities` research (frozen 2026-06-17,
`context/foundation/refactor-opportunities/research.md`) ranked structural debt (K1–K5) and
seeded a rollout. Since then B-05/B-06/F-07 and the ACL char tests shipped. Verified against
the codebase on 2026-07-18:

| Sub-scope | Theme | State |
| --- | --- | --- |
| F-08 `data-mode-acl-hardening` | ACL SSOT + char tests | **Done** — `src/lib/data-mode/data-mode-context.test.tsx` exists |
| F-10 `timer-change-impact-digest` | maintainer digest | **Done** — `scripts/change-impact/run.mjs` runs |
| **F-12 `sign-in-schema-extract`** | K4 import cycle | Not done — `action.ts:8` imports `SignInFormState` type from `sign-in-form.tsx:11`; no `sign-in/schema.ts` |
| **health probe** | `GET /api/health` | Not done — only `api/auth`, `api/trpc` exist under `src/app/api` |
| **Sentry** | error monitoring | Not done — no `@sentry` dependency |
| **auth-boundary-audit** | boundary checklist + smoke | Not done — no smoke/checklist artifact |
| **F-13 `guest-merge-consolidation`** | K3 single entry | Not done — dual entry: `_actions/import-guest-snapshot.ts` (sole prod UI path) **and** tRPC `guest` router (`root.ts:22`, prod-registered, tests-only) |
| **F-09 `cycle-hook-pure-extracts`** | K1 pure extracts | Not done — hook grew to **3317 LOC** (was 2357 at research time) |

### Key Discoveries:

- **F-12 mirror pattern exists**: `sign-up/schema.ts`, `reset-password/schema.ts` already hold their `*FormState`; sign-in is the sole outlier and the only import cycle in `src/` (research V17–V19).
- **F-13 current reality**: the server action is already the only prod UI write path (`guest-import-on-mount.tsx`); `api.guest` has 0 prod callers (research V14–V15). Consolidating to the action is the low-churn direction.
- **Env contract is T3-validated** (`src/env.js`) — new env vars (Sentry DSN) must be added there, not read ad hoc (CLAUDE.md rule).
- **`next.config.js` is ESM and already wrapped** with `withNextIntl`; Sentry adds an outer `withSentryConfig` wrapper.
- **Isolation-test pattern exists** for auth boundaries: `src/server/api/routers/{check-in,cycle,session,suggestion,task}-isolation.test.ts` — the auth-audit smoke test extends this shape.
- **F-09 is riskier than the research assumed** — the hook is ~960 LOC larger. Scope is therefore held to *minimal pure-helper extraction with an identical return API* (research first-step), not a timer-engine split.

## Desired End State

`GET /api/health` reports Neon + auth readiness; Sentry captures app-wide errors when a DSN
is configured (no-op otherwise); the sign-in import cycle is gone; guest merge has a single
server-action entry; a documented auth-boundary checklist is backed by a CI smoke test; and a
few more pure helpers are extracted from the timer hook without changing its public API.
`rollout.md`, roadmap F-15, and #190 are marked closed. `pnpm check`, `pnpm typecheck`,
`pnpm test`, and `pnpm test:e2e:belt` are green throughout.

## What We're NOT Doing

- **No timer-engine / sub-hook split** of `use-pomodoro-cycle.ts` — only pure-helper extraction with zero return-API churn. Deeper decomposition is a separate future change.
- **No change to the guest merge behavior or the localStorage/sessionStorage guards** — F-13 only removes the redundant tRPC entry point.
- **No narrow-only Sentry** — user chose app-wide instrumentation.
- **No full per-router isolation sweep** for the auth audit — one representative smoke test only.
- **No re-doing F-08 or F-10** — already shipped.
- **No K3 behavior redesign, no `refreshGuest` change, no Path B React Query unification** (out of scope in the original rollout and here).

## Implementation Approach

Each phase is a self-contained, independently mergeable unit on the F-15 branch. Phases 1–4
touch isolated or net-new surfaces (auth folder, a new route, config, a new test). Phase 5
removes a prod-dead API surface. Phase 6 (cut-able) nibbles the timer monolith behind an
unchanged facade. Run `pnpm change-impact` before Phase 6 (already run 2026-07-18) and lean on
the hook's 130-case test suite as the regression net.

## Critical Implementation Details

- **Sentry must be inert without a DSN.** Initialization has to no-op when `NEXT_PUBLIC_SENTRY_DSN` is unset so local dev, CI, and Playwright belt runs produce no network traffic or noise. Gate every init path on DSN presence. CI (`.github/workflows/ci.yml`) intentionally does not set Sentry env vars — this must remain so.
- **Health route must be uncached and bounded.** Force dynamic (`export const dynamic = "force-dynamic"`) and wrap the Neon ping + auth-config check in short timeouts so a slow dependency returns 503 rather than hanging the probe.
- **F-13 test migration precedes router removal.** Move `guest.test.ts` coverage onto the action/core `importGuestSnapshot` *before* unregistering the router, so the guest-merge invariants never go untested between commits.

## Phase 1: F-12 — Sign-in Schema Extract

### Overview

Break the only import cycle in `src/` by extracting `SignInFormState` into a dedicated schema module, mirroring the sign-up/reset-password pattern.

### Changes Required:

#### 1. New sign-in schema module

**File**: `src/app/auth/sign-in/schema.ts`

**Intent**: Home for `SignInFormState` (and any sign-in form validation schema), so neither `action.ts` nor `sign-in-form.tsx` imports a type from the other. Mirrors `sign-up/schema.ts`.

**Contract**: Exports `SignInFormState` (moved verbatim from `sign-in-form.tsx:11`). `action.ts` and `sign-in-form.tsx` both import it from `./schema`.

#### 2. Update sign-in action + form imports

**File**: `src/app/auth/sign-in/action.ts`, `src/app/auth/sign-in/sign-in-form.tsx`

**Intent**: Point both files at `./schema`; remove the cross-import that formed the cycle.

**Contract**: `action.ts` no longer has `import type { SignInFormState } from "./sign-in-form"`; `sign-in-form.tsx` no longer defines/exports the type.

### Success Criteria:

#### Automated Verification:

- `pnpm depcruise` reports no import cycle in `src/app/auth/sign-in` (baseline before, clean after)
- `pnpm typecheck` passes
- `pnpm check` passes
- Sign-in action tests pass: `pnpm exec vitest run src/app/auth/sign-in/action.test.ts src/app/auth/sign-in/validation.test.ts`

#### Manual Verification:

- Sign-in form renders and submits (happy path + a validation error) with no behavior change

**Implementation Note**: After automated verification passes, pause for manual confirmation before Phase 2.

---

## Phase 2: Production Health Probe

### Overview

Add a readiness endpoint that confirms the app can reach Neon and its auth config, for uptime checks and deploy gates.

### Changes Required:

#### 1. Health route handler

**File**: `src/app/api/health/route.ts`

**Intent**: A `GET` route that performs a cheap DB round-trip (e.g. `SELECT 1` via the Prisma/Neon client) and an auth-config reachability check, returning `200` with a per-component status body when both pass, `503` when either fails. Force-dynamic, bounded timeouts, never throws to the client.

**Contract**: Route: `GET /api/health`. Response JSON shape `{ status: "ok" | "degraded", checks: { database: "ok" | "fail", auth: "ok" | "fail" } }`. `export const dynamic = "force-dynamic"`. Failures degrade to `503`, not a 500 stack.

### Success Criteria:

#### Automated Verification:

- Route unit/integration test passes: `pnpm exec vitest run src/app/api/health/route.test.ts` (ok path → 200; simulated DB failure → 503)
- `pnpm typecheck`, `pnpm check` pass

#### Manual Verification:

- `curl localhost:3000/api/health` returns 200 + component statuses against a live dev DB
- Temporarily breaking `DATABASE_URL` yields 503, not a crashed request

**Implementation Note**: Pause for manual confirmation before Phase 3.

---

## Phase 3: Sentry Error Monitoring (App-Wide)

### Overview

Integrate `@sentry/nextjs` across client, server, and edge runtimes, inert unless a DSN is configured.

### Changes Required:

#### 1. Add dependency + instrumentation configs

**File**: `package.json`, `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts` (+ `instrumentation.ts` if required by the Next version)

**Intent**: Standard `@sentry/nextjs` setup for all three runtimes. Each `Sentry.init` is gated on `NEXT_PUBLIC_SENTRY_DSN` so it no-ops when unset. Conservative default sample rates.

**Contract**: `@sentry/nextjs` added via `pnpm add`. Init calls guarded `if (env.NEXT_PUBLIC_SENTRY_DSN) Sentry.init({...})`.

#### 2. Wrap Next config

**File**: `next.config.js`

**Intent**: Compose `withSentryConfig` around the existing `withNextIntl(config)` export.

**Contract**: Default export becomes `withSentryConfig(withNextIntl(config), {...})`; source-map upload gated on `SENTRY_AUTH_TOKEN` presence so builds without it still succeed.

#### 3. Env schema

**File**: `src/env.js`

**Intent**: Register `NEXT_PUBLIC_SENTRY_DSN` (client, optional) and `SENTRY_AUTH_TOKEN` (server, optional) in the T3 schema + `runtimeEnv`.

**Contract**: Both optional (`.optional()`); absence is valid and disables Sentry.

### Success Criteria:

#### Automated Verification:

- `pnpm build` (or `pnpm typecheck` + `pnpm check`) succeeds with **no** DSN set (Sentry inert, no upload)
- `pnpm test` passes; `pnpm test:e2e:belt` passes (no Sentry network noise in belt)

#### Manual Verification:

- With a scratch DSN set, a deliberately thrown error appears in the Sentry project (client + server)
- With DSN unset, dev server boots clean and emits no Sentry traffic

**Implementation Note**: Pause for manual confirmation before Phase 4.

---

## Phase 4: Auth-Boundary Audit

### Overview

Document the auth boundary rules and back them with one automated smoke test asserting unauthed access is rejected.

### Changes Required:

#### 1. Boundary checklist doc

**File**: `context/foundation/auth-boundary.md`

**Intent**: Record the `publicProcedure` vs `protectedProcedure` boundary, the Neon Auth session narrowing in `src/server/api/trpc.ts`, and a checklist for adding new user-scoped routers.

**Contract**: Prose checklist; references `trpc.ts` and the existing `*-isolation.test.ts` suite as the enforcement pattern.

#### 2. Unauthed-rejection smoke test

**File**: `src/server/api/routers/auth-boundary.test.ts`

**Intent**: Assert that calling a representative `protectedProcedure` (e.g. a `cycle` or `task` mutation) with no session throws `UNAUTHORIZED`. Complements the per-user isolation tests with an explicit no-session case.

**Contract**: Vitest test building a caller with an empty/anonymous context; expects `TRPCError` code `UNAUTHORIZED`.

### Success Criteria:

#### Automated Verification:

- Smoke test passes: `pnpm exec vitest run src/server/api/routers/auth-boundary.test.ts`
- `pnpm check` passes (doc + test lint-clean)

#### Manual Verification:

- Checklist reads accurately against current `trpc.ts` behavior

**Implementation Note**: Pause for manual confirmation before Phase 5.

---

## Phase 5: F-13 — Guest-Merge Consolidation

### Overview

Retire the redundant tRPC `guest` router, leaving the server action as the single guest-merge entry point, after migrating its test coverage.

### Changes Required:

#### 1. Migrate guest router test coverage

**File**: `src/server/api/routers/guest.test.ts` → coverage relocated onto the action/core

**Intent**: Ensure every guest-merge invariant currently asserted through `api.guest` is covered against `importGuestSnapshot` (core) and/or the server action `import-guest-snapshot.ts` **before** the router is removed.

**Contract**: Existing `guest.test.ts` cases (8) preserved as tests against the core/action; no invariant loses coverage.

#### 2. Unregister and remove the tRPC guest router

**File**: `src/server/api/root.ts`, `src/server/api/routers/guest.ts`

**Intent**: Remove `guest: guestRouter` from `appRouter` and delete the router file (and its now-migrated test) once coverage has moved.

**Contract**: `root.ts` no longer imports/registers `guestRouter`; server action remains the sole entry via `guest-import-on-mount.tsx`.

### Success Criteria:

#### Automated Verification:

- Migrated guest-merge tests pass (against action/core)
- `pnpm typecheck` passes (no dangling `api.guest` references)
- `pnpm test:e2e:belt` passes — `guest-merge-on-sign-in` belt spec still green
- `pnpm check` passes

#### Manual Verification:

- Guest trial → sign-in merge works end-to-end in the browser (tasks/cycles imported, localStorage cleared)

**Implementation Note**: Pause for manual confirmation before Phase 6.

---

## Phase 6: F-09 — Cycle-Hook Pure Extracts (cut-able)

### Overview

Extract remaining pure helpers from `use-pomodoro-cycle.ts` into colocated modules with tests, keeping the hook's public return API byte-for-byte identical. This phase may be deferred without affecting phases 1–5.

### Changes Required:

#### 1. Extract pure helpers

**File**: new colocated modules under `src/hooks/` or `src/lib/` (e.g. `cycle-end-time.ts`) + `*.test.ts`; `src/hooks/use-pomodoro-cycle.ts` imports them

**Intent**: Move genuinely pure logic still inline in the hook (e.g. `cycleEndTimeMs` computation, `isBreakKind` deduplication) into tested standalone functions the hook imports. No state, no effects moved.

**Contract**: Hook's `return { ... }` object is unchanged (same ~65 keys, same semantics). New pure modules have direct unit tests. Extractions are individually revertable.

### Success Criteria:

#### Automated Verification:

- Hook test suite unchanged and green: `pnpm exec vitest run src/hooks/use-pomodoro-cycle.test.tsx src/hooks/use-pomodoro-cycle-guest.test.tsx`
- New pure-helper tests pass
- Dashboard tests pass: `pnpm exec vitest run src/app/_components/pomodoro-dashboard.test.tsx`
- `pnpm typecheck`, `pnpm check` pass
- `pnpm test:e2e:belt` passes

#### Manual Verification:

- Full cycle (WORK → check-in → suggestion → break) behaves identically in the browser

**Implementation Note**: After this phase (or if cut), proceed to closeout.

---

## Closeout

- Update `context/foundation/refactor-opportunities/rollout.md` — mark F-09/F-12/F-13 rows shipped (and note health/Sentry/auth-audit landed).
- Roadmap: F-15 `active` → `done`; add a Done-log entry; clear `active_slices` if empty.
- GitHub #190: check off shipped sub-scopes and close; note F-09 status if cut.
- Linear FLO-96: sync in an authorized session (`/update-status`).

## Testing Strategy

### Unit Tests:

- Sign-in schema: existing action/validation tests stay green (Phase 1).
- Health route: ok → 200, dependency failure → 503 (Phase 2).
- Sentry: build + belt green with DSN unset; init guarded (Phase 3).
- Auth boundary: unauthed `protectedProcedure` → `UNAUTHORIZED` (Phase 4).
- Guest merge: migrated core/action tests preserve the 8 invariants (Phase 5).
- Pure helpers: direct unit tests; hook suite unchanged (Phase 6).

### Integration / E2E:

- `pnpm test:e2e:belt` after phases 3, 5, 6 (Sentry noise, guest merge, cycle parity).

### Manual Testing Steps:

1. `/api/health` returns 200 live, 503 with a broken DB URL.
2. Thrown error reaches Sentry with a scratch DSN; silent without one.
3. Guest → sign-in merge imports data and clears localStorage.
4. A full Pomodoro cycle behaves identically after the hook extract.

## Performance Considerations

- Health probe adds one bounded DB round-trip per call — force-dynamic, not cached; acceptable for a probe.
- Sentry sample rates kept conservative to avoid overhead/cost; tracing minimal.
- Pure-helper extraction is behavior-neutral — no runtime impact.

## Migration Notes

- New optional env vars (`NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`) — absence is valid; document in the env example.
- Removing the tRPC `guest` router is a server-internal API change; no client calls it in prod (verified), so no client migration needed.

## References

- Rollout registry: `context/foundation/refactor-opportunities/rollout.md`
- Research: `context/foundation/refactor-opportunities/research.md` (K1–K5, V1–V30)
- GitHub epic: https://github.com/konrad-kaluzny-ceneo/FlowState/issues/190
- Env contract: `src/env.js`; Next config: `next.config.js`
- Auth boundary: `src/server/api/trpc.ts`; isolation pattern: `src/server/api/routers/*-isolation.test.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: F-12 — Sign-in Schema Extract

#### Automated

- [x] 1.1 `pnpm depcruise` reports no import cycle in `src/app/auth/sign-in`
- [x] 1.2 `pnpm typecheck` passes
- [x] 1.3 `pnpm check` passes
- [x] 1.4 Sign-in action + validation tests pass

#### Manual

- [x] 1.5 Sign-in form renders and submits (happy + validation error) with no behavior change

### Phase 2: Production Health Probe

#### Automated

- [ ] 2.1 Health route test passes (200 ok path; 503 simulated DB failure)
- [ ] 2.2 `pnpm typecheck` passes
- [ ] 2.3 `pnpm check` passes

#### Manual

- [ ] 2.4 `curl /api/health` returns 200 + component statuses live
- [ ] 2.5 Broken `DATABASE_URL` yields 503, not a crash

### Phase 3: Sentry Error Monitoring (App-Wide)

#### Automated

- [ ] 3.1 Build/typecheck/check succeed with no DSN set (Sentry inert)
- [ ] 3.2 `pnpm test` passes
- [ ] 3.3 `pnpm test:e2e:belt` passes (no Sentry noise)

#### Manual

- [ ] 3.4 Thrown error appears in Sentry with a scratch DSN (client + server)
- [ ] 3.5 DSN unset → dev boots clean, no Sentry traffic

### Phase 4: Auth-Boundary Audit

#### Automated

- [ ] 4.1 Unauthed-rejection smoke test passes
- [ ] 4.2 `pnpm check` passes

#### Manual

- [ ] 4.3 Checklist reads accurately against current `trpc.ts` behavior

### Phase 5: F-13 — Guest-Merge Consolidation

#### Automated

- [ ] 5.1 Migrated guest-merge tests pass (against action/core)
- [ ] 5.2 `pnpm typecheck` passes (no dangling `api.guest`)
- [ ] 5.3 `pnpm test:e2e:belt` passes (`guest-merge-on-sign-in` green)
- [ ] 5.4 `pnpm check` passes

#### Manual

- [ ] 5.5 Guest → sign-in merge works end-to-end (data imported, localStorage cleared)

### Phase 6: F-09 — Cycle-Hook Pure Extracts (cut-able)

#### Automated

- [ ] 6.1 Hook test suite unchanged and green
- [ ] 6.2 New pure-helper tests pass
- [ ] 6.3 Dashboard tests pass
- [ ] 6.4 `pnpm typecheck` + `pnpm check` pass
- [ ] 6.5 `pnpm test:e2e:belt` passes

#### Manual

- [ ] 6.6 Full cycle behaves identically in the browser

### Closeout

#### Automated

- [ ] C.1 `rollout.md`, roadmap F-15 → done, and #190 updated
