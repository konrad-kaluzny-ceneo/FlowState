---
date: 2026-05-28T12:00:00+02:00
researcher: Konrad Kaluzny
git_commit: 7d2dd695ebd862b34b1bd728905b3ebdc4846ff5
branch: features/e2e-test-infra
repository: konrad-kaluzny-ceneo/FlowState
topic: "F-02 e2e-test-infra: Playwright + authenticated test user against Neon Auth (beta) on Next.js 16"
tags: [research, codebase, e2e, playwright, neon-auth, next-16]
status: complete
last_updated: 2026-05-28
last_updated_by: Konrad Kaluzny
---

# Research: F-02 e2e-test-infra

**Date**: 2026-05-28T12:00:00+02:00
**Researcher**: Konrad Kaluzny
**Git Commit**: 7d2dd695ebd862b34b1bd728905b3ebdc4846ff5
**Branch**: features/e2e-test-infra
**Repository**: konrad-kaluzny-ceneo/FlowState

## Research Question

How should FlowState install Playwright and authenticate a programmatic test user against Neon Auth (beta) on Next.js 16 so that `pnpm test:e2e` can verify any UI-facing slice in a real browser?

Roadmap F-02 outcome: "Playwright installed with authenticated test user flow; agent and CI can run browser-based e2e tests against the real app." Tagged `needs-research` 🔴 High in `context/foundation/roadmap.md`.

Specific research targets per `roadmap.md`:
- Playwright auth strategies with Neon Auth (beta)
- Next.js 16 + Playwright integration patterns

## Summary

- **`__Secure-` cookie blocks localhost HTTP.** Neon Auth's session cookie (`__Secure-neon-auth.session_token`) has `Secure: true`. Browsers reject `__Secure-`-prefixed cookies over plain HTTP. Playwright against `http://localhost:3000` will silently fail to authenticate. The plan must run the dev server over HTTPS or hit a deployed preview URL.
- **No DB-side test-user precedent and no User table in Prisma.** Identity lives entirely in Neon Auth (`NEON_AUTH_BASE_URL`); FlowState DB only stores `userId String` rows. Test-user provisioning must be designed from scratch using HTTP sign-up/sign-in against the catch-all auth route.
- **`strictDepBuilds: true` will block Playwright's browser download** unless `pnpm exec playwright install --with-deps` is used as an explicit step (Playwright-recommended for pnpm).
- **Two open Next.js 16 `proxy.ts` bugs** ([vercel/next.js#93328](https://github.com/vercel/next.js/issues/93328), [vercel/next.js#92921](https://github.com/vercel/next.js/issues/92921)) may force the planner to choose `pnpm build && pnpm start` over `pnpm dev` for e2e.
- **No CI exists** (`.github/workflows/` absent). F-02's outcome includes "Agent and CI can run `pnpm test:e2e`" — the planner must reconcile this with `roadmap.md`'s "no CI under main_goal: speed" stance.
- **Recommended auth flow: HTTP sign-in via `APIRequestContext.post('/api/auth/sign-in/email')` saved to `storageState`.** This is the most defensible default — works regardless of Better Auth plugin availability, matches Playwright's "Authenticate with API request" recipe, and exercises the real auth surface.

## Detailed Findings

### 1. Neon Auth Surface in This Codebase

#### 1.1 All `@neondatabase/auth/*` import sites

| File:line | Import | Exposes |
|---|---|---|
| `src/lib/auth/server.ts:1` | `import { createNeonAuth } from "@neondatabase/auth/next/server"` | server `auth` instance |
| `src/lib/auth/client.ts:2` | `import { createAuthClient } from "@neondatabase/auth/next"` | browser `authClient` |
| `src/app/auth/sign-in/action.ts:3` | `import { NEON_AUTH_NETWORK_ERROR_CODES } from "@neondatabase/auth/next/server"` | network-error code allowlist |
| `src/app/auth/sign-in/validation.test.ts:24-32` | `vi.mock("@neondatabase/auth/next/server", …)` | mock for unit tests |
| `src/app/auth/error-clearing.test.ts:31-40` | `vi.mock("@neondatabase/auth/next/server", …)` | mock for unit tests |

These are the **only five** Neon Auth touch points in the source tree.

#### 1.2 Methods called on `auth`

| Method | Site | Quote |
|---|---|---|
| `auth.middleware({ loginUrl })` | `proxy.ts:5-7` | `const runAuthProxy = auth.middleware({ loginUrl: "/auth/sign-in" });` |
| `auth.handler()` | `src/app/api/auth/[...path]/route.ts:3` | `export const { GET, POST } = auth.handler();` |
| `auth.getSession()` | `src/server/api/trpc.ts:33` | `const { data } = await auth.getSession();` |
| `auth.getSession()` | `src/app/page.tsx:10` | `const { data } = await auth.getSession();` |
| `auth.getSession()` | `src/app/layout.tsx:27` | `const result = await auth.getSession();` |
| `auth.signIn.email({email,password})` | `src/app/auth/sign-in/action.ts:27-30` | server action |
| `auth.signUp.email({name,email,password})` | `src/app/auth/sign-up/actions.ts:30-34` | server action |
| `authClient.signOut()` | `src/app/_components/user-menu.tsx:14` | browser side |

Complete API surface: `middleware`, `handler`, `getSession`, `signIn.email`, `signUp.email`, `signOut`. No OAuth, no magic-link, no anonymous tokens.

#### 1.3 Cookie Names (DECISIVE)

From `node_modules/.../@neondatabase/auth/dist/next/server/index.mjs:289-297`:

```js
const NEON_AUTH_COOKIE_PREFIX = "__Secure-neon-auth";
const NEON_AUTH_SESSION_DATA_COOKIE_NAME      = `${NEON_AUTH_COOKIE_PREFIX}.local.session_data`;
const NEON_AUTH_SESSION_CHALLENGE_COOKIE_NAME = `${NEON_AUTH_COOKIE_PREFIX}.session_challange`;
const NEON_AUTH_SESSION_COOKIE_NAME           = `${NEON_AUTH_COOKIE_PREFIX}.session_token`;
```

Same file at `:330-335`: `httpOnly: true`, `secure: true`, `sameSite: "lax"`.

**Implications:**
- Primary auth cookie: `__Secure-neon-auth.session_token` (HttpOnly, Secure, SameSite=lax).
- The `__Secure-` prefix is browser-enforced — cookie rejected over plain HTTP.
- Three cookies in play: `session_token` (auth), `local.session_data` (cached signed JWT), `session_challange` (OAuth state — irrelevant for email/password).

### 2. Session Resolution End-to-End

1. **HTTP request hits `proxy.ts`** — matcher excludes `_next/static`, `_next/image`, `favicon.ico`, `api/auth`, `api/trpc`, `auth/`. Other paths run `auth.middleware({ loginUrl: "/auth/sign-in" })`.
2. **`createTRPCContext`** (`src/server/api/trpc.ts:30-54`) calls `auth.getSession()` and narrows to `{id, email, name}`. Errors swallowed → `session: null`.
3. **`enforceAuth` middleware** (`src/server/api/trpc.ts:127-153`) throws `UNAUTHORIZED` on missing/empty session fields.
4. **`protectedProcedure`** = `t.procedure.use(timingMiddleware).use(enforceAuth)` (`src/server/api/trpc.ts:155-157`).

Every router uses `ctx.session.user.id` as the per-row tenancy key. A Playwright test must surface as a real authenticated user.

### 3. Existing Test Infrastructure

**14 test files** — all unit/integration. None hit a real HTTP server, real DB, or real Neon Auth backend.

Key config:
- `vitest.config.ts`: jsdom env, `SKIP_ENV_VALIDATION: "1"`, stub DB URLs, `NODE_ENV: "test"`.
- No `playwright.config.*` exists. No `e2e/` directory. No `test:e2e` script.
- `pnpm-lock.yaml` has no top-level Playwright dependency.

**Vitest and Playwright must be config-isolated.** `SKIP_ENV_VALIDATION=1` must NOT leak into Playwright (real auth needs real `NEON_AUTH_*` values).

### 4. Database Test Posture

- Every integration test mocks DB with in-memory arrays.
- **No User model** in Prisma — Neon Auth owns identity.
- **No seed script** exists.
- No existing pattern for creating a test user against real Neon Auth.

### 5. CI / Deployment Surface

- **No `.github/workflows/` directory.** `roadmap.md:68` confirms CI is out of MVP scope.
- `package.json` scripts: `test` (vitest run), `preview` (next build && next start), `start` (next start). **No `test:e2e`.**
- `pnpm-workspace.yaml`: `strictDepBuilds: true`. Playwright NOT in `onlyBuiltDependencies` or `allowBuilds`.

### 6. `timingMiddleware` Dev Delay

`src/server/api/trpc.ts:107-115` adds `Math.floor(Math.random() * 400) + 100` ms delay when `t._config.isDev`. E2E against `pnpm dev` will hit this on every tRPC call. Either run e2e against `pnpm preview` (production build, no delay) or budget for it in test timeouts.

### 7. Playwright Auth Strategies — Current Best Practice

Playwright's official authentication guide ([playwright.dev/docs/auth](https://playwright.dev/docs/auth)) presents the **setup project + `storageState` + `dependencies`** trio as the recommended default:

- Create `tests/auth.setup.ts` that signs in and calls `page.context().storageState({ path: authFile })`.
- Add a `setup` project that matches `*.setup.ts` and declare it as `dependencies: ['setup']` on each browser project.
- Tests start already authenticated.

Auth-file convention: `playwright/.auth/user.json`, gitignored.

#### UI vs API vs Direct Cookie Injection

- **UI sign-in once**: most realistic; exercises real login UI; slowest; UI-change sensitive.
- **API request sign-in**: `request.post(...)` then `request.storageState({ path })`. Faster; decoupled from UI.
- **Direct cookie injection**: requires `BETTER_AUTH_SECRET` equivalent, HMAC knowledge. Brittle.

> Content was rephrased for compliance with licensing restrictions. Source: [playwright.dev/docs/auth](https://playwright.dev/docs/auth)

### 8. Neon Auth Programmatic Sign-In Surface

#### Catch-all route shape

Per [Neon Auth Next.js docs](https://neon.com/docs/auth/quick-start/nextjs-api-only): `auth.handler()` proxies to Better Auth's HTTP surface. The app-relative path for sign-in is `POST /api/auth/sign-in/email`.

#### Sign-in HTTP endpoint (Better Auth engine)

- **Path**: `/sign-in/email` (mounted under `auth.handler()` base → `/api/auth/sign-in/email`)
- **Method**: `POST`
- **Body** (`application/json`): `{ email: string, password: string, callbackURL?: string, rememberMe?: boolean }`
- **Success (200)**: `{ redirect, token, url?, user }` plus `Set-Cookie` with session cookie.
- **Error**: 401 `INVALID_EMAIL_OR_PASSWORD`.

#### Sign-up HTTP endpoint

- **Path**: `/api/auth/sign-up/email`
- **Method**: `POST`
- **Body**: `{ email, password, name }`

#### CSRF / Origin Validation

Better Auth's `formCsrfMiddleware` validates `Origin` header. Playwright's `APIRequestContext` POST from `webServer.url` is same-origin → passes automatically.

> Content was rephrased for compliance with licensing restrictions. Sources: [Better Auth source](https://github.com/better-auth/better-auth), [Neon Auth docs](https://neon.com/docs/auth/reference/nextjs-server)

### 9. Next.js 16 + Playwright Integration

#### Known `proxy.ts` Issues

- [vercel/next.js#93328](https://github.com/vercel/next.js/issues/93328): `proxy.ts` produces empty middleware-manifest under Turbopack build. Workaround: rename to `middleware.ts`.
- [vercel/next.js#92921](https://github.com/vercel/next.js/issues/92921): valid routes 404 in `next dev` when `src/proxy.ts` present.

FlowState's `proxy.ts` is at project root — must verify whether root placement triggers either bug.

#### Recommended `webServer` Config

Per [Next.js testing docs](https://nextjs.org/docs/pages/guides/testing/playwright): "run tests against production code." Convergence of multiple sources recommends:
- **Local dev**: `pnpm dev`, `reuseExistingServer: !process.env.CI`
- **CI**: `pnpm build && pnpm start`, `reuseExistingServer: false`

The `proxy.ts` Turbopack manifest bug means dev-server e2e may pass while production fails. Running CI against `build && start` is a defect-detection necessity.

> Content was rephrased for compliance with licensing restrictions. Source: [nextjs.org/docs/pages/guides/testing/playwright](https://nextjs.org/docs/pages/guides/testing/playwright)

### 10. Playwright + pnpm Install Posture

From [microsoft/playwright#32072](https://github.com/microsoft/playwright/issues/32072), the maintainer-confirmed working sequence under pnpm:

```
pnpm install
pnpm exec playwright install --with-deps
```

`pnpm dlx playwright install` does not produce a working install. `--with-deps` combines browser download + system dependencies.

FlowState's `pnpm-workspace.yaml` does not approve Playwright builds. Using `pnpm exec playwright install --with-deps` as a separate explicit step sidesteps the `strictDepBuilds` / `allowBuilds` question entirely (no postinstall needed).

> Content was rephrased for compliance with licensing restrictions.

### 11. Testing Email+Password Auth — Pattern Comparison

| Pattern | Mechanism | Fit for Neon Auth |
|---|---|---|
| **A: HTTP sign-in to catch-all** | `POST /api/auth/sign-in/email` → `storageState` | ✅ Best fit — works today, exercises real auth |
| **B: Better Auth `testUtils()` plugin** | `getCookies({ userId })` → `addCookies` | ⚠️ Depends on `0.4.1-beta` exposure |
| **C: Manual SQL + HMAC sign** | Direct DB insert + cookie forge | ❌ Brittle, requires secret knowledge |
| **D: Neon Management API** | `POST .../auth/users` | ⚠️ Open question: accepts password? |

**Recommended default: Pattern A** — HTTP sign-in via `APIRequestContext.post('/api/auth/sign-in/email')` saved to `storageState`. Works regardless of plugin availability, matches Playwright's "Authenticate with API request" recipe.

### 12. The `__Secure-` Cookie + HTTPS Problem

This is the **single most critical technical constraint** for the plan:

1. Neon Auth sets `__Secure-neon-auth.session_token` with `Secure: true`.
2. Browsers enforce: `__Secure-`-prefixed cookies are only accepted over HTTPS.
3. `http://localhost:3000` → cookie silently rejected → auth always fails.

**Options:**
- Run dev server with HTTPS (self-signed cert, `--experimental-https` flag if available).
- Hit a deployed Vercel preview URL (HTTPS by default).
- Configure Neon Auth to use a non-`__Secure-` prefix for dev (not currently supported in `0.4.1-beta`).

The plan must resolve this constraint explicitly.

## Code References

- `proxy.ts:1-15` — Next.js 16 proxy middleware
- `src/lib/auth/server.ts:1-7` — `createNeonAuth` server instance
- `src/lib/auth/client.ts:1-3` — `createAuthClient` browser instance
- `src/app/api/auth/[...path]/route.ts:1-3` — `auth.handler()` catch-all
- `src/app/auth/sign-in/action.ts:27-30` — `auth.signIn.email` server action
- `src/app/auth/sign-up/actions.ts:30-34` — `auth.signUp.email` server action
- `src/server/api/trpc.ts:30-54` — `createTRPCContext` with `auth.getSession()`
- `src/server/api/trpc.ts:107-115` — `timingMiddleware` (100-500ms dev delay)
- `src/server/api/trpc.ts:127-153` — `enforceAuth` middleware
- `src/server/api/trpc.ts:155-157` — `protectedProcedure` definition
- `prisma/schema.prisma` — Models: Task, Session, Cycle, CheckIn. No User model.
- `vitest.config.ts:6-13` — jsdom env with `SKIP_ENV_VALIDATION=1`
- `package.json:5-19` — scripts (no `test:e2e`)
- `pnpm-workspace.yaml:6-21` — `strictDepBuilds: true`, Playwright not listed
- `node_modules/.../@neondatabase/auth/dist/next/server/index.mjs:289-297` — cookie name constants

## Architecture Insights

- **Auth boundary is HTTP-only.** Identity lives entirely in Neon Auth. FlowState DB has no `User` table — only `userId String` foreign keys. Every test needing a real session must obtain one through HTTP against Neon Auth.
- **The catch-all auth route is the only auth HTTP surface.** `proxy.ts` excludes `api/auth` so it's directly reachable. `auth.handler()` proxies to Better Auth's full HTTP map.
- **`createTRPCContext` is one-shot.** Resolves session per request, narrows to `{id, email, name}`. Errors swallowed → `null`. `protectedProcedure` enforces non-null.
- **Test pyramid gap.** 14 existing test files, all unit/integration. None hit a real HTTP server, real DB, or real Neon Auth. F-02 introduces the first truly-e2e layer.
- **Per-user isolation is deeply embedded.** Every router uses `ctx.session.user.id` as tenancy key. Playwright tests must surface as real authenticated users.
- **Vitest and Playwright must be config-isolated.** Two test runners, two configs, two npm scripts (`pnpm test` for Vitest, `pnpm test:e2e` for Playwright).

## Historical Context (from prior changes)

- **`prd.md` NFRs demanding browser-level verification:**
  - "User sees acknowledgement of any action within 200ms."
  - "A configured Pomodoro cycle does not drift by more than ±2 seconds regardless of browser tab state."
  - "A browser crash, page refresh, or connection loss does not cause loss of task list, cycle configuration, or current session state."
  These NFRs justify F-02 — none can be verified by integration tests alone.

- **`roadmap.md` F-02 entry:** Outcome locked. Prerequisites: none. Unlocks: S-01..S-07 (every UI-facing slice). Status: active.

- **`tech-stack.md`:** CI provider listed as `github-actions` with `ci_default_flow: auto-deploy-on-merge` but no workflow files exist yet.

- **`context/changes/session-domain-model/plan.md`** provides the structural template for the eventual F-02 plan (phases, success criteria, implementation notes).

## Related Research

No prior research artifacts found in `context/changes/**/research.md` or `context/archive/**/research.md`.

## Open Questions

1. **Does `@neondatabase/auth@0.4.1-beta` expose Better Auth `testUtils()`?** (Affects whether Pattern B is viable.)
2. **Does FlowState's root `proxy.ts` reproduce [#93328](https://github.com/vercel/next.js/issues/93328) or [#92921](https://github.com/vercel/next.js/issues/92921)?** (Forces `pnpm dev` vs `pnpm build && pnpm start` decision.)
3. **Does Neon Management API `POST .../auth/users` accept a `password` field?** (Decides if admin-API provisioning is viable.)
4. **Does `@playwright/test` ship a postinstall on the pinned version?** (Decides `allowBuilds` need in `pnpm-workspace.yaml`.)
5. **Does Neon Auth's wrapped Better Auth include `nextCookies()` by default?** (Affects server-action cookie propagation.)
6. **How to resolve the `__Secure-` cookie + localhost HTTP constraint?** (Most critical — must be empirically tested during implementation Phase 1.)

## Recommendation Surface for `/10x-plan`

### Auth Flow (recommended: A2)

- **A1: UI sign-in via `storageState`** — highest realism, exercises login UI, slowest.
- **A2: HTTP sign-in via `APIRequestContext.post('/api/auth/sign-in/email')`** — fastest, decoupled from UI, exercises real auth. **Recommended default.**
- **A3: Direct cookie injection** — brittle, requires HMAC knowledge.

### Test User Provisioning (recommended: B1)

- **B1: Sign-up via HTTP (`POST /api/auth/sign-up/email`)** — works today, idempotently handle "user exists".
- **B2: Neon Management API** — open question on password support.
- **B3: Better Auth `testUtils()` plugin** — cleanest but availability uncertain.

### webServer Choice (recommended: C2)

- **C1: `pnpm dev` everywhere** — fastest, exposes proxy.ts Turbopack bugs.
- **C2: `pnpm dev` locally + `pnpm build && pnpm start` in CI** — Next.js docs default, catches build-time issues. **Recommended.**
- **C3: `pnpm build && pnpm start` everywhere** — most realistic, slowest.

### Playwright Project Topology (recommended: D1)

- **D1: Single setup project + `dependencies: ['setup']`** — canonical, simplest for single smoke test. **Recommended.**
- **D2: Worker-scoped fixture** — only when tests modify shared state.

### Browser Install (recommended: E1)

- **E1: `pnpm exec playwright install --with-deps` as separate step** — Playwright-recommended for pnpm, no `pnpm-workspace.yaml` change needed. **Recommended.**
