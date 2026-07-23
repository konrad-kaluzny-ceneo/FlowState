<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Platform Refactor Batch (F-15)

- **Plan**: `context/changes/platform-refactor-batch/plan.md`
- **Scope**: Phases 1–6 of 6 (full plan review) — `git diff e8d6541..HEAD` + working tree
- **Date**: 2026-07-21
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 8 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING (2 findings) |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING (3 manual items outstanding by design) |

## Verification re-run (2026-07-21, at review HEAD)

| Command | Result |
|---|---|
| `pnpm typecheck` | PASS — clean |
| `pnpm check` | PASS — exit 0; 6 `noNonNullAssertion` warnings, all pre-existing at base `e8d6541` in `use-pomodoro-cycle.test.tsx` (verified: 6 occurrences at base) |
| `pnpm test` | PASS — 168 files / 1413 tests, 0 failures, 29s |
| `pnpm depcruise` | PASS — 458 modules, 1538 dependencies, **no violations** (Phase 1 import-cycle criterion holds) |
| `pnpm test:e2e:belt` | Not re-run — a separate agent owns the known `completeCheckIn` flake (`e2e/helpers/check-in.ts:56`), reproduced at bare HEAD |

## Plan-drift adjudication

Each phase deviated from `plan.md` in documented ways. All four deviations judged **correct**:

| # | Plan said | Implementation | Verdict |
|---|---|---|---|
| p3 | `sentry.client.config.ts` | `src/instrumentation-client.ts` | **Correct.** `sentry.client.config.ts` is the legacy path; `instrumentation-client.ts` is the current Next 15.3+/`@sentry/nextjs` v10 convention and is the only place `onRouterTransitionStart` can be exported. |
| p3 | `if (env.NEXT_PUBLIC_SENTRY_DSN)` from `~/env` | `process.env.NEXT_PUBLIC_SENTRY_DSN` in the boot files | **Correct.** These modules run before app modules load (edge runtime has no full Node env; the client hook runs pre-hydration). `NEXT_PUBLIC_*` is build-time inlined either way, and the var is still declared + Zod-validated in `src/env.js`. Rationale is documented in every file header. |
| p4 | one representative smoke test | dynamic sweep over `appRouter._def.procedures` | **Correct and stronger.** The only risk — a silently-empty sweep if the tRPC internal shape changes — is explicitly guarded by the `sweeps a non-empty set of registered procedures` case, plus an `only exempts paths that are actually registered` case. `PUBLIC_PROCEDURE_PATHS` is empty and documented as a reviewable security decision. |
| p6 | pure helpers, no params | optional `now` / `clientTimer` options on the extracts | **Correct.** Defaults reproduce prior behavior exactly: `now ?? Date.now()`, `clientTimer ?? useE2eClientTimer` (same module-level `NEXT_PUBLIC_E2E_MAIN_THREAD_TIMER` read), and `formatLocalDateKey(options.now)` with `now === undefined` hits the existing `date: Date = new Date()` default. The seams make the helpers deterministically testable without fake timers. |

## Focus-area checks

**Dual data mode (p5) — PASS.** `guestRouter` unregistered from `root.ts` and deleted. Zero
remaining `api.guest` / `guestRouter` references in `src/` or `e2e/` (only prose mentions in
the migrated test header and frozen research notes). No repository-interface change: guest and
authenticated sides of `src/lib/data-mode/` are untouched, and the guest→account merge still
runs through `src/app/_actions/import-guest-snapshot.ts` → `src/server/api/lib/import-guest-snapshot.ts`.
Test coverage moved *before* removal as the plan required: the old 8-case `guest.test.ts` became
a 13-case `src/app/_actions/import-guest-snapshot.test.ts`, adding the two gates the router used
to get for free from `protectedProcedure` + `.input(...)` (`UNAUTHORIZED`, `INVALID_SNAPSHOT`),
both asserted to touch no database. `context/foundation/test-plan.md` §6.5 was updated to point
at the new location — good hygiene, not required by the plan.

**High-blast-radius (p6) — PASS.** The `use-pomodoro-cycle.ts` diff is net −41 lines and contains
**zero** changes inside the hook's `return { ... }` object. `CycleKind` is re-exported
(`export type { CycleKind }`) so every existing `import type { CycleKind } from "~/hooks/use-pomodoro-cycle"`
still resolves. `taskPoolHasKickoffCandidates` re-export preserved. Every call-site substitution is
a literal-for-literal swap (`cyclesSinceLastLong + 1 >= 4` → `resolveBreakCadenceSuggestion(...)`,
inline break-kind comparison → `isBreakKind(...)`). `pausedRemainingMs`'s parameter type widened
from `DomainActiveCycle` to a structural subset — a strictly permissive change. Hook suite green
and unchanged.

**Sentry inertness — PASS.** With `NEXT_PUBLIC_SENTRY_DSN` unset, no `Sentry.init` runs in any of
the three runtimes, so no transport is constructed and no fetch/XHR instrumentation is installed.
`onRequestError` and `onRouterTransitionStart` are SDK functions that no-op without a bound client.
`withSentryConfig` wraps the build unconditionally but `sourcemaps.disable` is tied to
`SENTRY_AUTH_TOKEN` and `telemetry: false` is set. `.env.example` ships `NEXT_PUBLIC_SENTRY_DSN=""`,
which `emptyStringAsUndefined: true` in `src/env.js` normalizes to `undefined` — and an empty
string is falsy at the `if` gate regardless. `sentry-manual-verification.md` records an
empirical check that `replayIntegration` is tree-shaken out of every `.next/static` chunk when
built without a DSN. CI sets no Sentry env vars, as the plan required.

**PII posture — PASS.** `sendDefaultPii` is unset (SDK default `false`). Session replay runs with
default `maskAllText` / `blockAllMedia`, so task titles, resume notes, and project names are not
transmitted. `replaysSessionSampleRate: 0` means replay only fires on error.

## Findings

### F1 — No `src/app/global-error.tsx`: root-boundary React render errors go uncaptured

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence / Safety & Quality
- **Location**: N/A (missing file); gap recorded in `context/changes/platform-refactor-batch/change.md`
- **Detail**: Phase 3's goal is *app-wide* error monitoring. Three of four capture surfaces are
  wired: server/RSC render + route-handler errors via `onRequestError`, uncaught client exceptions
  and unhandled rejections via the SDK's `globalHandlers`, and navigation errors via
  `onRouterTransitionStart`. The fourth — a React **render** error on the client that unwinds to
  Next's built-in root error boundary — is not. React reports boundary-caught errors through
  `onCaughtError` (console) rather than `reportError`, so `window.onerror` never fires and Sentry
  never sees it. Sentry's own Next.js integration guide lists `global-error.tsx` +
  `Sentry.captureException` as a required step for exactly this reason. The repo has **no**
  `error.tsx` or `global-error.tsx` anywhere, so there is no sibling to copy styling or copy from.
- **Judgment — acceptable to ship as-is.** Three reasons: (1) Sentry is inert in every environment
  today (no DSN in `.env.example`, none in CI, none on the deploy target), so the gap has zero
  present cost and blocks no other work; (2) `global-error.tsx` replaces the root layout, which
  means it renders *outside* `NextIntlClientProvider` — producing correct copy requires resolving
  the locale cookie client-side and bundling both message files, and producing a correct surface
  requires a `DESIGN.md` treatment. That is a user-facing product surface, not a monitoring
  wire-up, and shipping a hardcoded-copy crash screen inside a review commit would be worse than
  the gap; (3) it is already documented in `change.md`. The deferral rationale recorded by the
  implementer is accurate on all counts.
- **Fix**: Track it as an owned follow-up rather than only a note in `change.md`, so it survives
  archiving of this change.
- **Decision**: ACCEPTED — deferral upheld; queued in `follow-ups/review-fixes.md` (FU-1)

### F2 — `/api/health` is an unauthenticated, uncached DB + outbound-fetch amplifier

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: `src/app/api/health/route.ts:57`
- **Detail**: `GET /api/health` is public and `force-dynamic`, so every anonymous request costs one
  Neon `SELECT 1` (billed serverless compute, cold-start-sensitive) plus one outbound HTTPS request
  to `${NEON_AUTH_BASE_URL}/.well-known/jwks.json`. There is no rate limit anywhere in the app (no
  `middleware.ts` — confirmed in `context/foundation/auth-boundary.md` §4). A trivial request loop
  therefore amplifies into sustained load on two paid/third-party dependencies. The response body
  itself is safe — `{ status, checks: { database, auth } }` leaks no user data, no version, no
  stack — and every failure path is caught and degraded to 503, so nothing throws to the client.
  Timeouts are bounded at 5s on both checks.
- **Fix**: Memoize the probe result behind a short TTL (≈5s) so a request flood collapses to one
  dependency round-trip per window, or apply a platform-level rate limit on the route. Not applied
  here: a TTL changes probe semantics (a deploy gate polling right after recovery would read a
  stale `degraded` for up to the TTL) and would invalidate four of the six route tests, which each
  call `GET()` with different mock outcomes. That is a genuine tradeoff the owner should make, not
  a mechanical review fix.
  - Strength: Removes the amplification factor entirely while keeping the endpoint public and
    monitor-friendly.
  - Tradeoff: Staleness window on recovery; test restructuring (needs a cache-reset seam).
  - Confidence: MEDIUM — standard practice for readiness probes, but the right TTL depends on the
    uptime-monitor interval, which is not yet chosen.
  - Blind spot: The deploy target's own edge rate limiting (Vercel) may already blunt this; not verified.
- **Decision**: QUEUED — `follow-ups/review-fixes.md` (FU-2)

### F3 — `.gitignore` had no Sentry entries

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `.gitignore`
- **Detail**: `@sentry/cli` and the Sentry build plugin write `.sentryclirc` and
  `.env.sentry-build-plugin`, both of which can contain `SENTRY_AUTH_TOKEN`. Neither is matched by
  the existing dotenv patterns (`.env`, `.env.local`, `.env.*.local`), so an accidental
  `git add -A` after a source-map upload run could commit a token.
- **Fix**: Added a Sentry section to `.gitignore` covering `.sentryclirc` and `.env.sentry-build-plugin`.
- **Decision**: FIXED

### F4 — Health-route comment misattributes the `process.env` read to test convenience

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: `src/app/api/health/route.ts:41`
- **Detail**: The comment justified reading `process.env.NEON_AUTH_BASE_URL` instead of the
  validated `~/env` accessor "so route tests can stub it" — production code shaped by test needs,
  and on its face a break of the CLAUDE.md rule that env vars go through `src/env.js`. The read is
  in fact **correct**: `src/lib/auth/server.ts:12` resolves the same variable the same way
  (`requireEnv("NEON_AUTH_BASE_URL")` → `process.env[name]`), so the probe checks exactly the value
  the auth client will use. Reading it via `~/env` would have made the probe test a *different*
  source than production auth. The behavior needed no change; the stated reason did.
- **Fix**: Reworded the comment to lead with parity against `src/lib/auth/server.ts`, keeping the
  test-stub note as a secondary benefit.
- **Decision**: FIXED

### F5 — Two env vars added beyond the plan's contract (`SENTRY_ORG`, `SENTRY_PROJECT`)

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: `src/env.js:44-47`, `next.config.js:22-23`, `.env.example`
- **Detail**: Phase 3's contract named only `NEXT_PUBLIC_SENTRY_DSN` and `SENTRY_AUTH_TOKEN`.
  `withSentryConfig` also needs org and project slugs to resolve an upload target. Both are
  registered as optional in the T3 schema with `runtimeEnv` entries and documented in
  `.env.example`, so they follow the repo's env contract exactly. Necessary completion of the
  planned work, not scope creep.
- **Decision**: NO ACTION

### F6 — Server/edge Sentry gated on a build-time-inlined `NEXT_PUBLIC_` variable

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architecture
- **Location**: `sentry.server.config.ts:10`, `sentry.edge.config.ts:10`
- **Detail**: Both server-side inits gate on `NEXT_PUBLIC_SENTRY_DSN`. `NEXT_PUBLIC_*` is inlined
  at build time, so enabling *server* error monitoring on Vercel will require a rebuild, not just a
  dashboard env change — and the server DSN is unnecessarily exposed to the client bundle. The
  conventional split is a server-only `SENTRY_DSN` with `NEXT_PUBLIC_SENTRY_DSN` reserved for the
  browser. This matches the plan's contract verbatim, and `sentry-manual-verification.md` already
  documents the rebuild caveat, so it is a deliberate simplification rather than an oversight —
  but it is worth revisiting when a DSN is actually provisioned.
- **Fix**: When wiring a real DSN, add an optional server-only `SENTRY_DSN` to `src/env.js` and
  read `process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN` in the server/edge configs.
  Not applied: it introduces an env var the plan did not authorize, and cannot be validated without
  a real DSN.
- **Decision**: QUEUED — `follow-ups/review-fixes.md` (FU-3)

### F7 — Auth-boundary sweep depends on a tRPC internal (`appRouter._def.procedures`)

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: `src/server/api/routers/auth-boundary.test.ts:62`
- **Detail**: The sweep introspects an underscore-prefixed tRPC internal, cast through
  `as unknown as { _def: { procedures: Record<string, unknown> } }`. A tRPC major bump could change
  the shape and silently reduce the sweep to zero cases. The implementation already anticipates
  this with an explicit `expect(protectedProcedurePaths.length).toBeGreaterThan(0)` guard, so the
  failure mode is a loud red test rather than a silent pass. Accepted as-is — the coverage this
  buys (every registered procedure, automatically, forever) far outweighs the coupling, and
  `context/foundation/auth-boundary.md` §5 step 6 documents the mechanism for future authors.
- **Decision**: NO ACTION

### F8 — Sentry SDK bundled unconditionally; `/api/health` will be traced once a DSN exists

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `next.config.js:21`, `src/instrumentation-client.ts:17`
- **Detail**: `withSentryConfig` wraps the build unconditionally. The implementer verified
  empirically that `replayIntegration` is tree-shaken out of `.next/static` when no DSN is set
  (recorded in `sentry-manual-verification.md`), which addresses the client-bundle concern.
  Separately, once a DSN is configured, uptime pings to `/api/health` will each create a Sentry
  transaction and consume quota — worth an `ignoreTransactions: ["GET /api/health"]` entry at DSN
  provisioning time.
- **Decision**: NO ACTION (folded into FU-3)

### F9 — Manual Progress item 1.5 checked without recorded evidence

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: `context/changes/platform-refactor-batch/plan.md:370`
- **Detail**: Items 2.4/2.5 carry a commit sha, 4.3 and 5.5 carry an explicit evidence note (5.5
  cites the belt spec that proves it), and 3.4/3.5/6.6 are honestly left `[ ]` with deferral
  reasons — an unusually disciplined Progress section. Only 1.5 ("sign-in form renders and submits
  with no behavior change") is `[x]` with a bare sha and no evidence. Residual risk is negligible:
  Phase 1 is a pure type-location move with no value or control-flow change, covered by
  `action.test.ts` + `validation.test.ts`, and `pnpm depcruise` independently confirms the cycle is gone.
- **Decision**: NO ACTION

### F10 — Closeout (C.1) and two manual verifications remain open

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: `context/changes/platform-refactor-batch/plan.md:395`, `:434`, `:441`
- **Detail**: Three items are correctly outstanding, none of them blocking this review:
  **3.4 / 3.5** require a user-supplied Sentry DSN — un-runnable by an agent, with a step-by-step
  guide already written (`sentry-manual-verification.md`); **6.6** (full cycle in the browser)
  needs a manual pass, mitigated by the 130-case hook suite plus the belt; **C.1** (`rollout.md`,
  roadmap F-15 → done, GitHub #190) is downstream closeout that belongs after merge. `roadmap.md`
  already carries F-15 → `active`, and `test-plan.md` §6.5 was updated in-phase.
- **Decision**: NO ACTION — hand off to the closeout stage

## Fixes applied in this review

| Finding | File | Change |
|---|---|---|
| F3 | `.gitignore` | Added `.sentryclirc` and `.env.sentry-build-plugin` (both can hold `SENTRY_AUTH_TOKEN`) |
| F4 | `src/app/api/health/route.ts` | Reworded the `process.env` justification comment to cite parity with `src/lib/auth/server.ts` |

Post-fix re-verification: `pnpm typecheck` clean, `pnpm exec biome check src/app/api/health/route.ts` clean.
