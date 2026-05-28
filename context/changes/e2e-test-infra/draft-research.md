---
date: 2026-05-28
branch: features/e2e-test-infra
repository: konrad-kaluzny-ceneo/FlowState
topic: "F-02 e2e-test-infra: Playwright + authenticated test user against Neon Auth (beta) on Next.js 16"
tags: [research, codebase, e2e, playwright, neon-auth, next-16, draft]
status: draft
last_updated: 2026-05-28
last_updated_by: Konrad Kaluzny
note: >
  This is a working draft assembled from two completed parallel sub-agents
  (internal codebase deep-dive + external research) and main-context historical
  reading. The third sub-agent (historical context) was cancelled mid-run and
  its scope was recovered directly. Author the canonical research.md from this.
---

# DRAFT — Research: F-02 e2e-test-infra

This document is the raw working material for `context/changes/e2e-test-infra/research.md`. It is structured to drop into the canonical template with minimal editing.

## Research Question

How should FlowState install Playwright and authenticate a programmatic test user against Neon Auth (beta) on Next.js 16 so that `pnpm test:e2e` can verify any UI-facing slice in a real browser? Roadmap F-02 outcome: "Playwright installed with authenticated test user flow; agent and CI can run browser-based e2e tests against the real app." Tagged `needs-research` 🔴 High in `context/foundation/roadmap.md`.

Specific research targets per `roadmap.md`:
- Playwright auth strategies with Neon Auth (beta)
- Next.js 16 + Playwright integration patterns

## Summary (provisional — author your own)

- **Decisive technical fact**: Neon Auth's primary session cookie is `__Secure-neon-auth.session_token` with `Secure: true`. Browsers refuse `__Secure-`-prefixed cookies over plain HTTP. Playwright against `http://localhost:3000` will silently fail to authenticate. The plan must run the dev server over HTTPS, use a host-trust trick, or hit a deployed preview URL.
- **No DB-side test-user precedent and no User table in Prisma.** Identity lives entirely in Neon Auth (`NEON_AUTH_BASE_URL`); FlowState DB only stores `userId String` rows. The plan must design test-user provisioning from scratch.
- **`strictDepBuilds: true` will block Playwright's browser download** unless `pnpm exec playwright install --with-deps` is used as an explicit step (Playwright-recommended for pnpm).
- **Two open Next.js 16 `proxy.ts` bugs** ([vercel/next.js#93328](https://github.com/vercel/next.js/issues/93328), [vercel/next.js#92921](https://github.com/vercel/next.js/issues/92921)) may force the planner to choose `pnpm build && pnpm start` over `pnpm dev` for e2e.
- **No CI exists** (`.github/workflows/` absent). F-02's outcome includes "Agent and CI can run `pnpm test:e2e`" — the planner must reconcile this with `roadmap.md`'s "no CI under main_goal: speed" stance.
- **Vitest jsdom env vs Playwright env are independent.** A separate `playwright.config.ts` is required; existing `vitest.config.ts:6-13` env block uses `SKIP_ENV_VALIDATION=1` which must NOT leak into Playwright (real auth needs real `NEON_AUTH_*` values).
- **`timingMiddleware` adds 100–500 ms artificial delay in dev** (`src/server/api/trpc.ts:107-115`). E2E against `pnpm dev` will hit this on every tRPC call. Either run e2e against `pnpm preview` (production build, no delay) or budget for it in test timeouts.

## Detailed Findings — INTERNAL CODEBASE (sub-agent output, evidence-backed)

### 1. Neon Auth surface in this codebase

#### 1.1 All `@neondatabase/auth/*` import sites

| File:line | Import | Exposes |
|---|---|---|
| `src/lib/auth/server.ts:1` | `import { createNeonAuth } from "@neondatabase/auth/next/server"` | server `auth` instance |
| `src/lib/auth/client.ts:2` | `import { createAuthClient } from "@neondatabase/auth/next"` | browser `authClient` |
| `src/app/auth/sign-in/action.ts:3` | `import { NEON_AUTH_NETWORK_ERROR_CODES } from "@neondatabase/auth/next/server"` | network-error code allowlist |
| `src/app/auth/sign-in/validation.test.ts:24-32` | `vi.mock("@neondatabase/auth/next/server", …)` | mock for unit tests |
| `src/app/auth/error-clearing.test.ts:31-40` | `vi.mock("@neondatabase/auth/next/server", …)` | mock for unit tests |

These are the **only five** Neon Auth touch points in the source tree. There is no other auth code in the repo.

#### 1.2 Methods called on `auth` (every site, quoted)

| Method | Site | Quote |
|---|---|---|
| `auth.middleware({ loginUrl })` | `proxy.ts:5-7` | `const runAuthProxy = auth.middleware({ loginUrl: "/auth/sign-in" });` |
| `auth.handler()` | `src/app/api/auth/[...path]/route.ts:3` | `export const { GET, POST } = auth.handler();` |
| `auth.getSession()` | `src/server/api/trpc.ts:33` | `const { data } = await auth.getSession();` |
| `auth.getSession()` | `src/app/page.tsx:10` | `const { data } = await auth.getSession();` |
| `auth.getSession()` | `src/app/layout.tsx:27` | `const result = await auth.getSession();` |
| `auth.signIn.email({email,password})` | `src/app/auth/sign-in/action.ts:27-30` | `const result = await auth.signIn.email({ email, password });` |
| `auth.signUp.email({name,email,password})` | `src/app/auth/sign-up/actions.ts:30-34` | `const response = await auth.signUp.email({ name: result.data.name.trim(), email: result.data.email, password: result.data.password });` |
| `authClient.signOut()` | `src/app/_components/user-menu.tsx:14` | `await authClient.signOut();` (browser side) |

Complete API surface used: `middleware`, `handler`, `getSession`, `signIn.email`, `signUp.email`, `signOut`. No `signIn.social`, no anonymous tokens, no JWT export.

#### 1.3 Cookie names (DECISIVE — extracted from the installed package)

From `node_modules/.pnpm/@neondatabase+auth@0.4.1-be_…/node_modules/@neondatabase/auth/dist/next/server/index.mjs:289-297`:

```js
const NEON_AUTH_COOKIE_PREFIX = "__Secure-neon-auth";
const NEON_AUTH_SESSION_DATA_COOKIE_NAME      = `${NEON_AUTH_COOKIE_PREFIX}.local.session_data`;
const NEON_AUTH_SESSION_CHALLENGE_COOKIE_NAME = `${NEON_AUTH_COOKIE_PREFIX}.session_challange`;
const NEON_AUTH_SESSION_COOKIE_NAME           = `${NEON_AUTH_COOKIE_PREFIX}.session_token`;
```

Same file at `:330-335`:
```js
httpOnly: parsedCookie.httponly ?? true,
secure:   parsedCookie.secure   ?? true,
sameSite: parsedCookie.samesite ?? "lax",
```

Implications:
- Primary auth cookie: `__Secure-neon-auth.session_token` (HttpOnly, Secure, SameSite=lax).
- The `__Secure-` prefix is browser-enforced — **the cookie will be rejected over plain HTTP.**
- Three cookies in play: `session_token` (auth), `local.session_data` (cached signed JWT), `session_challange` (OAuth state — irrelevant for email/password).

The package's own `node_modules/.../@neondatabase/auth/llms.txt` confirms API names plus:
- "Sessions cached 60s (or until JWT expires)"
- "TTL calculated from JWT `exp` claim"
- Optional `cookies.sessionDataTtl` and `cookies.domain` config fields (not currently used in `src/lib/auth/server.ts`).

#### 1.4 Sign-up surface

`src/app/auth/sign-up/` contains:

| File | Role |
|---|---|
| `page.tsx` | Server component — renders `<SignUpForm />` |
| `sign-up-form.tsx` | Client component, `"use client"` — `useActionState(signUpAction, …)` |
| `actions.ts` | Server action — Zod validates → `auth.signUp.email({ name, email, password })` (`actions.ts:30-34`) → on success `redirect("/")` |
| `schema.ts` | Zod: `name 1-100`, `email ≤254`, `password 8-128` |
| `password-validation.test.ts` | Property tests for password length boundaries |
| `validation.test.ts` | Property tests for name/email |

Sign-up uses `auth.signUp.email`. No OAuth, magic-link, or admin-create path wired.

---

### 2. Session resolution end-to-end

#### 2.1 Request → protected procedure path

1. **HTTP request hits Next.js middleware** — `proxy.ts:1-15`. Matcher excludes `_next/static`, `_next/image`, `favicon.ico`, `api/auth`, `api/trpc`, `auth/`. Other paths run `auth.middleware({ loginUrl: "/auth/sign-in" })`.
2. **Next.js renders the page or hits the tRPC route**:
   - Pages (`src/app/page.tsx:10-13`) explicitly call `auth.getSession()` and `redirect("/auth/sign-in")` if no user. Page also `export const dynamic = "force-dynamic"` (`page.tsx:7`).
   - tRPC HTTP route at `src/app/api/trpc/[trpc]/route.ts:13-18` invokes `createTRPCContext({ headers: req.headers })`.
   - RSC tRPC caller at `src/trpc/server.ts:14-22` does the same with `headers()` from `next/headers`.
3. **`createTRPCContext`** (`src/server/api/trpc.ts:30-54`):
   ```ts
   const { data } = await auth.getSession();
   const user = data?.user;
   if (user?.id && user.email) {
     session = { user: { id: user.id, email: user.email,
                         name: user.name || user.email.split("@")[0]! } };
   }
   ```
   On any thrown error, `session = null` (`trpc.ts:42-44`).
4. **`enforceAuth` middleware** (`src/server/api/trpc.ts:127-153`) — runs after `timingMiddleware`:
   ```ts
   if (!ctx.session?.user?.id || !ctx.session?.user?.email || !ctx.session?.user?.name) {
     throw new TRPCError({ code: "UNAUTHORIZED" });
   }
   return next({ ctx: { session: { user: { id, email, name } } } });
   ```
5. **`protectedProcedure`** = `t.procedure.use(timingMiddleware).use(enforceAuth)` (`src/server/api/trpc.ts:155-157`).

#### 2.2 Every `ctx.session` read in routers

| Router | Line | Use |
|---|---|---|
| `src/server/api/routers/task.ts:9` | `where: { userId: ctx.session.user.id }` | list filter |
| `task.ts:26` | `userId: ctx.session.user.id` | create owner |
| `task.ts:46` | `where: { id, userId: ctx.session.user.id }` | update ownership |
| `task.ts:63` | `where: { id, userId: ctx.session.user.id }` | delete ownership |
| `src/server/api/routers/session.ts:9` | `where: { userId: ctx.session.user.id, archivedAt: null }` | list |
| `session.ts:18` | `data: { userId: ctx.session.user.id }` | create |
| `src/server/api/routers/cycle.ts:13` | `userId: ctx.session.user.id` | list |
| `cycle.ts:37` | session ownership check | create |
| `cycle.ts:47` | task ownership check | create |
| `cycle.ts:59` | `userId: ctx.session.user.id` | create cycle |
| `src/server/api/routers/check-in.ts:10` | `where: { userId: ctx.session.user.id }` | list |
| `check-in.ts:26` | `where: { id, userId: ctx.session.user.id }` | create — verify cycle ownership |
| `check-in.ts:37` | `userId: ctx.session.user.id` | create row |

Every router uses `ctx.session.user.id` as the per-row tenancy key, matching `userId String @db.VarChar(255)` columns in `prisma/schema.prisma`.

#### 2.3 Unauthenticated failure mode

`createTRPCContext` swallows `auth.getSession()` exceptions → `session: null`, then `enforceAuth` throws `UNAUTHORIZED`. tRPC never crashes on auth provider outages.

---

### 3. Existing test infrastructure

#### 3.1 Full inventory (14 test files)

**Unit / property tests (no DB or HTTP I/O):**

| File | Covers |
|---|---|
| `src/test/smoke.test.ts` | Trivial `expect(true).toBe(true)`. |
| `src/env.test.ts` | Property tests for `NEON_AUTH_BASE_URL` (https-only) and `NEON_AUTH_COOKIE_SECRET` (≥32 chars), schemas replicated. |
| `src/proxy.test.ts` | Property tests verifying middleware matcher regex. |
| `src/app/auth/sign-up/validation.test.ts` | Property tests over sign-up Zod schema. |
| `src/app/auth/sign-up/password-validation.test.ts` | Password length boundary property tests. |
| `src/app/auth/sign-in/validation.test.ts` | Property tests for sign-in action's empty-field rejection — mocks `~/lib/auth/server` and `next/navigation`. |
| `src/app/auth/error-clearing.test.ts` | Property tests for error state clearing — mocks both auth and `next/navigation`. |

**Integration (server-side tRPC caller + mocked DB & auth):**

| File | Covers |
|---|---|
| `src/server/api/trpc.test.ts` | `createTRPCContext` mapping. |
| `src/server/api/protected-procedure.test.ts` | `protectedProcedure` enforcement. |
| `src/server/api/routers/task.test.ts` | Created task `userId === ctx.session.user.id`. |
| `src/server/api/routers/task-query.test.ts` | `task.list` returns ONLY rows of querying user. |
| `src/server/api/routers/task-isolation.test.ts` | Multi-user isolation at scale. |
| `src/server/api/routers/task-mutation.test.ts` | `update`/`delete` return `NOT_FOUND` for non-owners. |
| `src/server/api/routers/session-isolation.test.ts` | Cross-user session list isolation. |
| `src/server/api/routers/cycle-isolation.test.ts` | Cross-user cycle isolation + cross-user FK injection on create returns `NOT_FOUND`. |
| `src/server/api/routers/check-in-isolation.test.ts` | CheckIn isolation, FK injection (`NOT_FOUND`), double-create (`CONFLICT`). |

No `e2e/`, `tests/`, `__tests__/` outside `src/`. No test file hits a real HTTP server, real DB, or real Neon Auth backend.

#### 3.2 Decisive config files (full quotes)

`vitest.config.ts`:
```ts
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
    plugins: [react()],
    test: {
        environment: "jsdom",
        globals: true,
        setupFiles: ["./src/test/setup.ts"],
        env: {
            SKIP_ENV_VALIDATION: "1",
            DATABASE_URL: "postgresql://test:test@localhost:5432/test",
            DATABASE_URL_UNPOOLED: "postgresql://test:test@localhost:5432/test",
            NODE_ENV: "test",
        },
    },
    resolve: {
        alias: {
            "~": resolve(__dirname, "./src"),
            "@prisma/generated": resolve(__dirname, "./generated/prisma/client"),
        },
    },
});
```

`src/test/setup.ts`:
```ts
// Vitest test setup
// Add global test utilities here if needed
```

`src/test/smoke.test.ts`:
```ts
import { describe, expect, it } from "vitest";

describe("test setup", () => {
    it("works", () => { expect(true).toBe(true); });
});
```

#### 3.3 Tests that exercise auth

Every "auth" test mocks the auth surface:
- `src/server/api/trpc.test.ts:11-22` mocks `~/server/db` and `~/lib/auth/server`.
- `src/server/api/protected-procedure.test.ts:13-24` same plus stubs `globalThis.setTimeout` to bypass `timingMiddleware`'s 100–500ms dev delay.
- `src/app/auth/sign-in/validation.test.ts:14-32` mocks `~/lib/auth/server`, `next/navigation`, AND `@neondatabase/auth/next/server` (for `NEON_AUTH_NETWORK_ERROR_CODES`).
- `src/app/auth/error-clearing.test.ts:14-40` same mock surface.

**No test exercises real authentication, real cookies, or real session creation.**

#### 3.4 tRPC server-side caller pattern

```ts
const { createCallerFactory } = await import("~/server/api/trpc");
const { taskRouter } = await import("~/server/api/routers/task");
const createCaller = createCallerFactory(taskRouter);

const caller = createCaller({
    db: (await import("~/server/db/index")).db as never,
    session: { user: { id, email, name } },
    headers: new Headers(),
});
await caller.list();
```
Source: `src/server/api/routers/task.test.ts:53-67`, identical shape elsewhere. **Not viable for true e2e per AGENTS.md.**

---

### 4. Database test posture

#### 4.1 How DB is mocked

Every integration test uses `vi.mock("~/server/db/index", …)` returning a hand-rolled in-memory mock that mirrors the Prisma API. Examples:
- `src/server/api/trpc.test.ts:11-13` — `vi.mock("~/server/db", () => ({ db: {} }))`.
- `src/server/api/routers/task-isolation.test.ts:24-58` — full in-memory tasks array with `findMany` filtering on `args.where.userId`.
- `src/server/api/routers/check-in-isolation.test.ts:39-89` — in-memory cycles + check-ins with unique-constraint simulation (raises `P2002` on duplicate `cycleId`).

No Prisma test harness, `vitest-mock-extended`, `prisma-mock`, SQLite-backed adapter, or fixture loader.

#### 4.2 `prisma/schema.prisma` models

Models: **Task, Session, Cycle, CheckIn**. Enums: `WorkType`, `EnergyLevel`, `SessionState`, `CycleState`, `CycleKind`. All models use `userId String @db.VarChar(255)` mapped to `user_id`. **No User model** — Neon Auth owns identity in its own database (`NEON_AUTH_BASE_URL`).

#### 4.3 `prisma.config.ts`

```ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { defineConfig } from "prisma/config";

function loadEnv() {
    try {
        const envPath = path.join(import.meta.dirname, ".env");
        const content = readFileSync(envPath, "utf-8");
        for (const line of content.split("\n")) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith("#")) continue;
            const eqIdx = trimmed.indexOf("=");
            if (eqIdx === -1) continue;
            const key = trimmed.slice(0, eqIdx);
            let value = trimmed.slice(eqIdx + 1);
            if ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }
            if (!process.env[key]) process.env[key] = value;
        }
    } catch { /* .env not found */ }
}
loadEnv();

export default defineConfig({
    schema: path.join(import.meta.dirname, "prisma", "schema.prisma"),
    migrations: { path: "prisma/migrations" },
    datasource: { url: process.env.DATABASE_URL ?? "" },
});
```

#### 4.4 Seed script

**None.** Searched `scripts/`, `prisma/`, root `package.json`. Only `scripts/migrate.ts` (production migration runner — `pnpm db:migrate:prod`).

#### 4.5 Pattern for creating a test user

**No existing pattern.** Every test fabricates a `userId` string in-memory and never touches Neon Auth or the real DB. Options visible from the code:
- Hit `auth.signUp.email` against a real Neon Auth dev/staging baseUrl.
- Call the catch-all route at `/api/auth/sign-up/email` directly (HTTP POST — `proxy.ts:11` excludes `api/auth` from middleware, endpoint exists per `dist/next/server/index.mjs:69-72`: `signUp: { email: { path: "sign-up/email", method: "POST" } }`).
- Use a Neon Auth admin endpoint (`admin/create-user`) — visible in the SDK at `dist/next/server/index.mjs:130-133` but no admin secret currently configured.

---

### 5. CI / deployment surface

#### 5.1 GitHub workflows

**Absent.** No `.github/` directory. `roadmap.md:68` confirms: *"No `.github/workflows/` for parallel CI yet — out of MVP scope under main_goal: speed."*

#### 5.2 `package.json` scripts

```json
"scripts": {
    "build":           "prisma generate && next build",
    "check":           "biome check .",
    "check:unsafe":    "biome check --write --unsafe .",
    "check:write":     "biome check --write .",
    "db:generate":     "prisma generate",
    "db:migrate":      "prisma migrate dev",
    "db:migrate:prod": "tsx scripts/migrate.ts",
    "db:push":         "prisma db push",
    "db:studio":       "prisma studio",
    "dev":             "prisma generate && next dev --turbo",
    "preview":         "next build && next start",
    "start":           "next start",
    "test":            "vitest run",
    "test:watch":      "vitest",
    "typecheck":       "tsc --noEmit"
}
```
**`test:e2e` is missing.**

#### 5.3 `next.config.js`

```js
import "./src/env.js";
/** @type {import("next").NextConfig} */
const config = {};
export default config;
```

Empty config object. The `import "./src/env.js"` triggers env validation at build time (skippable via `SKIP_ENV_VALIDATION`).

#### 5.4 Existing `playwright.config.*`

**None.** No `playwright.config` file in the repo. `pnpm-lock.yaml` matches are transitive optional peer deps of `next` and `vitest`; no top-level dep references Playwright.

#### 5.5 Dev-server commands available

- `pnpm dev` → `prisma generate && next dev --turbo`
- `pnpm preview` → `next build && next start`
- `pnpm start` → `next start`

Default port 3000. Both hit the `__Secure-` cookie problem (§1.3) over HTTP.

---

### 6. Conventions an e2e plan must follow

#### 6.1 Code style (`AGENTS.md` + `biome.jsonc`)

- Tabs (size 2), LF line endings (Biome + `.editorconfig`).
- Biome only — no ESLint, no Prettier ("Do not add either.").
- Tailwind class sorting via `useSortedClasses` for `clsx`/`cva`/`cn` (`biome.jsonc:24-32`).
- Path alias `~/` → `src/` (`tsconfig.json:33`). E2E files outside `src/` won't get the alias unless an e2e tsconfig opts in.
- Allowed commit types: `feat`, `docs`, `init` only.

#### 6.2 `pnpm-workspace.yaml` — build approval

```yaml
strictDepBuilds: true
onlyBuiltDependencies:
  - "@biomejs/biome"
  - "@prisma/client"
  - "@prisma/engines"
  - esbuild
  - prisma
  - sharp
allowBuilds:
  "@prisma/client": true
  "@prisma/engines": true
  core-js: true
  esbuild: true
  prisma: true
  sharp: true
```

Neither `@playwright/test` nor `playwright` listed. Adding Playwright with a postinstall lifecycle script would require approval. Best path: explicit `pnpm exec playwright install --with-deps` step (no postinstall needed).

Other relevant settings: `nodeLinker: isolated`, `hoistPattern: []`, `publicHoistPattern: []`, `autoInstallPeers: true`, `strictPeerDependencies: true`.

#### 6.3 `tsconfig.json` settings affecting Playwright

```jsonc
"target": "es2022", "module": "ESNext", "moduleResolution": "Bundler",
"strict": true, "noUncheckedIndexedAccess": true,
"verbatimModuleSyntax": true, "isolatedModules": true,
"jsx": "react-jsx",
"plugins": [{ "name": "next" }],
"paths": { "~/*": ["./src/*"], "@prisma/generated": ["./generated/prisma/client"] }
```

Implications:
- `verbatimModuleSyntax: true` — type-only imports must use `import type`.
- `noUncheckedIndexedAccess: true` — array/object index access yields `T | undefined`.
- `moduleResolution: "Bundler"` — fine for Playwright; consider a separate `tsconfig.e2e.json`.
- `"include"` covers `**/*.ts` — a top-level `e2e/` folder will get type-checked unless excluded.

#### 6.4 `AGENTS.md` test pyramid + e2e rule (literal)

> **E2E vs integration:** A direct DB query or server-side tRPC caller is an integration test, not e2e. True e2e requires a browser with an authenticated session hitting the running app. Do not claim "e2e verified" unless a real browser flow (with auth) was exercised.
>
> **Test pyramid:** All changes must include unit and integration tests. Code must be testable at each level of the pyramid (unit → integration → e2e). Do not ship code without covering the appropriate test levels for the change.

Other rules from `AGENTS.md`:
- "tRPC middleware runs in declaration order — auth middleware must come before any procedure that reads `ctx.session`" (already satisfied — `trpc.ts:155-157`).
- "All `create` mutations must `return` the created entity."
- "All `list` queries must use `take: DEFAULT_LIST_LIMIT`" (`src/server/api/config.ts:5` = `100`).
- "Connection strings are secrets — reference by env var name, never echo values."
- pnpm only, Windows-compatible commands, `pnpm test` at end of every cycle, `gh` uses `konrad-kaluzny-ceneo` account.

---

### Key risks for the planner

- **`__Secure-` cookie + localhost HTTP.** Neon Auth's session cookie is `__Secure-neon-auth.session_token` with `Secure: true`. Browsers refuse `__Secure-`-prefixed cookies over plain HTTP.
- **No DB-side test-user precedent — and no `User` table.** Identity lives entirely in Neon Auth.
- **`strictDepBuilds: true` will block Playwright's browser download.** `@playwright/test` and `playwright` are absent from `onlyBuiltDependencies` / `allowBuilds`.
- **No CI exists.** No `.github/workflows/`, no `test:e2e` script. F-02's outcome statement conflicts with `roadmap.md:68` ("CI out of MVP scope").
- **Vitest config is jsdom and pre-loads test env vars.** Playwright must NOT pick up `vitest.config.ts`.
- **`timingMiddleware` adds 100–500 ms artificial delay in dev.** `src/server/api/trpc.ts:107-115`.


## Detailed Findings — EXTERNAL RESEARCH (sub-agent output)

### 1. Playwright auth strategies — current best practice (2025/2026)

Playwright's official authentication guide presents the **setup project + `storageState` + `dependencies`** trio as the recommended default. From [Authentication | Playwright](https://playwright.dev/docs/auth) and the upstream source [docs/src/auth.md](https://github.com/microsoft/playwright/blob/master/docs/src/auth.md):

- Create `tests/auth.setup.ts` that signs in (UI or API) and calls `page.context().storageState({ path: authFile })`.
- Add a `setup` project that matches `*.setup.ts` and declare it as a `dependencies: ['setup']` entry on each browser project. Each browser project consumes `use.storageState: '<authFile>'`.
- Tests start already authenticated.

Canonical config snippet:

```ts
// playwright.config.ts
projects: [
  { name: 'setup', testMatch: /.*\.setup\.ts/ },
  {
    name: 'chromium',
    use: { ...devices['Desktop Chrome'], storageState: 'playwright/.auth/user.json' },
    dependencies: ['setup'],
  },
],
```

Auth-file convention: `playwright/.auth/user.json`, gitignored. Source: [playwright.dev/docs/auth](https://playwright.dev/docs/auth).

#### Setup-project-as-dependency vs older `globalSetup`

Per [Playwright Projects > Dependencies](https://playwright.dev/docs/test-projects), the dependency-projects approach is the documented default and supports trace-viewable setup, fixtures inside setup, and selective re-runs (`--no-deps`). Independent reference: Clerk's [Reuse auth state across tests](https://clerk.com/docs/guides/development/testing/playwright/test-authenticated-flows) (2026-05-19) recommends project-based setup over function-based `globalSetup` because env vars in a function-`globalSetup` "don't propagate to your test workers."

I could not find an authoritative changelog entry pinpointing what changed in Playwright 1.45+ for the dependency-projects pattern — **open question**. Most recent meaningful surface change: `BrowserContext.setStorageState()` lets a context swap state mid-test without creating a new context.

#### UI vs API vs direct cookie injection

From [playwright.dev/docs/auth § Authenticate with API request](https://playwright.dev/docs/auth):

- **UI sign-in once**: most realistic; exercises real login UI; slowest; UI-change sensitive.
- **API request sign-in**: `request.post(...)` then `request.storageState({ path })`. Faster; requires an HTTP endpoint that sets the session cookie on `APIRequestContext`.
- **Direct cookie injection**: build cookies in Node and `addCookies(...)`. Fastest; requires producing the same HMAC-signed token the server expects.

Playwright recommends **UI or API sign-in saved to `storageState`** as the default; direct cookie injection is an advanced optimization.

#### Worker-scoped fixture vs global setup

From [§ Moderate: one account per parallel worker](https://playwright.dev/docs/auth):

- **Setup file (basic)** — preferred when tests do not modify shared server-side state.
- **Worker-scoped fixture** — preferred when tests modify shared server-side state and must run with distinct accounts; uses `testInfo.parallelIndex` and `testInfo.project.outputDir/.auth/<id>.json`.

For F-02's single smoke test, the basic setup-file path matches the docs' rubric. Worker-fixture is over-engineering.

> Content was rephrased for compliance with licensing restrictions.

---

### 2. Neon Auth (Better Auth) programmatic sign-in surface

#### Library IDs (Context7)

- `@neondatabase/auth` does NOT resolve to a Context7 ID. Closest: `/neondatabase/neon-js`, `/websites/neon`.
- Better Auth resolves to `/better-auth/better-auth` and `/websites/better-auth`. **Substitution: where Neon Auth docs are silent, Better Auth docs are authoritative.** Neon's [Overview](https://neon.com/docs/auth/overview.md) confirms "Neon Auth is powered by Better Auth … currently supports Better Auth version **1.4.18**."

#### Catch-all route shape

Per Neon's [Use Neon Auth with Next.js (API methods)](https://neon.com/docs/auth/quick-start/nextjs-api-only) and [Next.js Server SDK Reference](https://neon.com/docs/auth/reference/nextjs-server):

```ts
// app/api/auth/[...path]/route.ts
import { auth } from '@/lib/auth/server';
export const { GET, POST } = auth.handler();
```

Catch-all proxies to Better Auth's HTTP surface. Per [Authentication flow](https://neon.com/docs/auth/authentication-flow), the SDK posts to `{NEON_AUTH_URL}/auth/sign-in/email`. Through the Next.js catch-all, the equivalent app-relative path is `POST /api/auth/sign-in/email`.

#### Sign-in HTTP endpoint (Better Auth, the engine under Neon Auth)

From [packages/better-auth/src/api/routes/sign-in.ts](https://github.com/better-auth/better-auth/blob/9fed16b6/packages/better-auth/src/api/routes/sign-in.ts):

- **Path**: `/sign-in/email` (mounted under `auth.handler()` base)
- **Method**: `POST`
- **Body** (`application/json` or `application/x-www-form-urlencoded`):
  ```ts
  { email: string, password: string, callbackURL?: string, rememberMe?: boolean = true }
  ```
- **Success (200)**: `{ redirect: boolean, token: string, url?: string, user: User }` plus `Set-Cookie` with the session cookie.
- **Error**: 401 `INVALID_EMAIL_OR_PASSWORD`.
- **Middleware**: `formCsrfMiddleware` (origin and `Sec-Fetch-*` validation).

Neon Auth public docs do not enumerate the raw HTTP body shape — they document the SDK helpers `auth.signIn.email({ email, password })` and `authClient.signIn.email(...)`. Substitution from Better Auth's source is authoritative for the wire format.

#### Test mode / programmatic provisioning

- **Better Auth `testUtils()` plugin** (landed Feb 2026): per [test-utils.mdx](https://github.com/better-auth/better-auth/blob/canary/docs/content/docs/plugins/test-utils.mdx), exposes `ctx.test.createUser`, `ctx.test.saveUser`, `ctx.test.login`, `ctx.test.getCookies({ userId, domain })` returning Playwright-compatible cookie objects, plus `captureOTP`. **Caveat**: Neon Auth pins Better Auth at **1.4.18**; Better Auth 1.4.18 predates the test-utils commit ([f15d28b](https://github.com/better-auth/better-auth/commit/f15d28bc7), 2026-02-11). **Open question**: whether `@neondatabase/auth@0.4.1-beta` exposes `testUtils()`.
- **Neon Auth Admin plugin**: per [Admin - Neon Docs](https://neon.com/docs/auth/guides/plugins/admin), `authClient.admin.createUser({ email, password, name, role, data })` is available. Requires existing admin user; admin operations require a session cookie.
- **Neon Management API**: per [Manage Neon Auth via API](https://neon.com/docs/auth/guides/manage-auth-api) and [Create new auth user](https://api-docs.neon.tech/reference/createneonauthnewuser), `POST https://console.neon.tech/api/v2/projects/{project_id}/branches/{branch_id}/auth/users` accepts `{ auth_provider: "better_auth", email, name }` with `Authorization: Bearer $NEON_API_KEY`. **Open question**: whether this endpoint accepts a `password` field.
- **`auth.signUp.email({ email, password, name })`** through the SDK is documented and is the simplest provisioning path — same shape as sign-in, on path `/sign-up/email`.

#### Cookie name and attributes

From Better Auth's [Cookies doc](https://www.better-auth.com/docs/concepts/cookies) and [packages/better-auth/src/cookies/index.ts](https://github.com/better-auth/better-auth/blob/cd2ea4cd/packages/better-auth/src/cookies/index.ts):

- Default name: `better-auth.session_token` (format: `${prefix}.${cookie_name}`, prefix defaults to `better-auth`).
- In secure mode the `__Secure-` prefix is prepended → `__Secure-better-auth.session_token`. Confirmed in [PR #5154](https://github.com/better-auth/better-auth/pull/5154), 2025-10-07.
- Default attributes: `httpOnly: true`, `sameSite: "lax"`, `path: "/"`, `secure` derived (`useSecureCookies` OR `baseURL` starts with `https://` OR `NODE_ENV=production`).
- Domain: unset by default unless `crossSubDomainCookies.enabled`.
- Cookie value is HMAC-signed using `BETTER_AUTH_SECRET`. Raw token from `nanoid(64)` set directly will NOT validate.

**Important**: Internal research (§1.3 above) found Neon Auth uses prefix `__Secure-neon-auth`, NOT `__Secure-better-auth`. So the prefix IS Neon-specific, not the Better Auth default. **Open question for the plan**: confirm by inspecting `Set-Cookie` against a local instance.

#### Issuing a session token directly from Node

- Better Auth exposes `auth.api.signInEmail({ body, asResponse: true })` returning a `Response` so cookies can be parsed.
- For test flows, the test-utils plugin's `getCookies({ userId, domain })` does this in one call.
- Manually inserting `neon_auth.session` rows + computing HMAC manually is documented in Nelson Lai's [E2E Testing with Better Auth](https://nelsonlai.dev/blog/e2e-testing-with-better-auth), 2025-09-17. Brittle.

> Content was rephrased for compliance with licensing restrictions.

---

### 3. Next.js 16 + Playwright

#### Known issues with `proxy.ts`

- **`proxy.ts` produces empty middleware-manifest under Turbopack** — [vercel/next.js#93328](https://github.com/vercel/next.js/issues/93328), 2026-04-28: on Next.js `16.2.4` and `16.3.0-canary.3`, `next build` writes `"middleware": {}` and the proxy is silently skipped at runtime. Workaround: rename to `middleware.ts`. Bug open. **Affects FlowState directly** — `proxy.ts` exists at project root.
- **Valid app routes 404 in `next dev` when `src/proxy.ts` is present** — [vercel/next.js#92921](https://github.com/vercel/next.js/issues/92921), 2026-04-17: on Next.js 16.2.4, valid routes return 404 in `next dev`. FlowState's `proxy.ts` is at root, not `src/` — verify whether root placement triggers either bug before committing to `pnpm dev`.

#### Recommended `webServer` config

Per [Next.js docs § Testing: Playwright](https://nextjs.org/docs/pages/guides/testing/playwright):

> "We recommend running your tests against your production code to more closely resemble how your application will behave."

Convergence of [testdino-hq/playwright-skill / core/nextjs.md](https://github.com/testdino-hq/playwright-skill/blob/main/core/nextjs.md), [Autonoma](https://getautonoma.com/blog/nextjs-playwright-testing-guide) (2026-01-20), [Codertronix](https://codertronix.com/posts/playwright-e2e-testing.html) (2026-01-30):

- **Local dev**: `pnpm dev` (Turbopack), `reuseExistingServer: !process.env.CI`.
- **CI**: `pnpm build && pnpm start`, `reuseExistingServer: false`.

Tradeoff specific to FlowState: the `proxy.ts` Turbopack manifest bug means dev-server e2e may pass while production fails (or vice versa). Running CI against `build && start` is a defect-detection necessity.

#### HMR, port collisions, `reuseExistingServer`

- `reuseExistingServer: true` locally; `reuseExistingServer: false` in CI.
- `timeout: 120_000` common default.
- Anti-pattern: `await page.waitForTimeout(...)` for HMR. Use `expect(locator).toBeVisible()` or `page.waitForURL(...)`.

> Content was rephrased for compliance with licensing restrictions.

---

### 4. Playwright + pnpm install posture

#### `pnpm exec playwright install --with-deps`

From [microsoft/playwright issue #32072](https://github.com/microsoft/playwright/issues/32072), 2024-08-08, the maintainer-confirmed working sequence under pnpm:

```
pnpm install
pnpm exec playwright install-deps
pnpm exec playwright install
```

`pnpm dlx playwright install` runs but does not produce a working install. `--with-deps` combines both steps.

Known active issue on pnpm 10.5.0: [pnpm/pnpm#9178](https://github.com/pnpm/pnpm/issues/9178) — pnpm 10.5.0 erroneously believed both `neverBuiltDependencies` and `onlyBuiltDependencies` were present, breaking `pnpm exec playwright install`. Fixed in 10.5.1+.

#### `@playwright/test` postinstall and `strictDepBuilds`

From [pnpm Settings](https://pnpm.io/settings): `strictDepBuilds` defaults to `true` in pnpm 10+. In pnpm 11 the previously separate `onlyBuiltDependencies` / `neverBuiltDependencies` / `ignoredBuiltDependencies` settings are **replaced by a single `allowBuilds` map**.

Empirically: Vite CI ([commit 7157b15](https://github.com/vitejs/vite/commit/7157b15205e27b6d8d2e30c3717ae80244b2c266), 2022-06-15) sets `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: "1"` because "pnpm only runs install script once." Modern Playwright recommends `pnpm exec playwright install --with-deps` as a separate explicit step, sidestepping the postinstall question.

**FlowState-specific**: `pnpm-workspace.yaml` does not currently approve Playwright builds. Cypress reference precedent ([pnpm/pnpm#9123](https://github.com/pnpm/pnpm/issues/9123)) shows browser-installing test runners need `allowBuilds` plus often `side-effects-cache=false`. **Open question**: empirically determine whether `@playwright/test@<version>` ships a postinstall in the pinned version.

#### `PLAYWRIGHT_BROWSERS_PATH` for CI caching

Per Playwright's [installation doc](https://github.com/microsoft/playwright/blob/dd3d49339d1e39ee8711abaf4ebe310d094aae3a/docs/installation.md): default browser cache locations are `~/.cache/ms-playwright` (Linux), `~/Library/Caches/ms-playwright` (macOS), `%USERPROFILE%\AppData\Local\ms-playwright` (Windows).

Playwright [CI doc](https://github.com/microsoft/playwright/blob/main/docs/src/ci.md) **discourages** caching browser binaries:

> "Caching browser binaries is not recommended, since the amount of time it takes to restore the cache is comparable to the time it takes to download the binaries."

Counter-evidence: [vitest-dev/vitest CI](https://github.com/vitest-dev/vitest/blob/6fdb2ba6/.github/workflows/ci.yml), [Argos / Speed up your Playwright tests](https://argos-ci.com/blog/speed-up-playwright) (2024-05-17), [Autonoma](https://getautonoma.com/blog/playwright-github-actions) (2026-04-17) all cache `~/.cache/ms-playwright` keyed on Playwright version, reporting 30-60s savings. **Knob for the planner**, not a blocker.

> Content was rephrased for compliance with licensing restrictions.

---

### 5. Testing email+password auth in modern stacks — patterns

#### Pattern A — Better Auth + Playwright (Nelson Lai blog + repo)

Source: [E2E Testing with Better Auth](https://nelsonlai.dev/blog/e2e-testing-with-better-auth), 2025-09-17, and [nelsonlaidev/e2e-testing-with-better-auth](https://github.com/nelsonlaidev/e2e-testing-with-better-auth), 2025-09-18.

- **Test user creation**: SQL `INSERT OR IGNORE` directly into `user`, `account`, `session` tables in Playwright global-setup. Static `TEST_USER` with deterministic ID `0`.
- **Cookie**: HMAC-sign session token with `BETTER_AUTH_SECRET` using `compact` strategy, write Playwright-shaped cookie object to `.auth/auth.json`: `name: 'better-auth.session_token'`, `value: encodeURIComponent(signedValue)`, `domain: 'localhost'`, `httpOnly: true`, `secure: false`, `sameSite: 'Lax'`.
- **Where stored**: `.auth/auth.json` consumed via `storageState`.
- **Refresh**: per-test-run via global setup + teardown projects.
- **Fit for Neon Auth's catch-all**: works if FlowState can read `BETTER_AUTH_SECRET`.

#### Pattern B — Better Auth `testUtils()` plugin

Source: [test-utils.mdx](https://github.com/better-auth/better-auth/blob/canary/docs/content/docs/plugins/test-utils.mdx), commit [f15d28b](https://github.com/better-auth/better-auth/commit/f15d28bc7), 2026-02-11.

- **Test user creation**: `ctx.test.createUser({ email, name })` then `ctx.test.saveUser(user)`.
- **Cookie**: `ctx.test.getCookies({ userId, domain: 'localhost' })` returns `{ name, value, domain, path, httpOnly, secure, sameSite }[]` ready for `context.addCookies(cookies)`.
- **Where stored**: per-test cookie injection.
- **Refresh**: per-test fresh.
- **Fit for Neon Auth's catch-all**: best if `0.4.1-beta` exposes the plugin (open question per §2).

#### Pattern C — Clerk + Playwright via `@clerk/testing`

Source: [Reuse auth state across tests - Playwright | Clerk Docs](https://clerk.com/docs/guides/development/testing/playwright/test-authenticated-flows), 2026-05-19.

- **Test user creation**: separate; `+clerk_test` email convention.
- **Programmatic sign-in**: `clerk.signIn({ page, emailAddress })` calls Clerk's Backend API.
- **Where stored**: `playwright/.clerk/user.json` via `storageState({ path })` in `global.setup.ts`.
- **Refresh**: setup project re-runs; `clerkSetup()` obtains a Testing Token at suite start.
- **Fit for Neon Auth**: not direct (different vendor) but shape is identical to provider-specific helper → `storageState`.

#### Pattern D — Supabase + Playwright + admin-API seed

Source: [Testing for Vibe Coders](https://supabase.com/blog/testing-for-vibe-coders-from-zero-to-production-confidence), 2025-08-16.

- **Test user creation**: `supabase.auth.admin.createUser({ email, password, email_confirm: true })`.
- **Where stored**: not via Playwright `storageState`; defers to Playwright docs.
- **Fit for Neon Auth**: closest analog is the Neon Management API `POST .../auth/users` (§2).

#### Best fit for Neon Auth's HTTP catch-all

Patterns A and B are closest fits (Neon Auth IS the Better Auth handler). Choice collapses to:

- **A (manual SQL + HMAC sign)** — works today; brittle.
- **B (`testUtils()` plugin)** — cleanest API; depends on `0.4.1-beta` exposure.

**Pattern C-shaped** (HTTP sign-in to the catch-all → `request.storageState`) is the most defensible default — works regardless of plugin availability: `POST /api/auth/sign-in/email`, then `request.storageState({ path })`. Matches Playwright's "Authenticate with API request" recipe.

> Content was rephrased for compliance with licensing restrictions.

---

### 6. Agent-friendly docs signal (Lesson 4 quality gate)

#### Neon Auth

- `https://neon.com/docs/auth/llms.txt` → **404**.
- `https://neon.com/docs/auth/overview.md` → **200, valid markdown** (~4 KB), includes BA 1.4.18 dependency note.
- `https://neon.com/docs/llms.txt` → **200, valid markdown index**, full doc tree linked, `.md` suffix convention documented.
- `https://neon.com/docs/neon-auth/llms.txt` → 404.

**Verdict**: Neon publishes a global `llms.txt` and per-page `.md` convention. No auth-specific `llms.txt`. **Quality signal: present at project level, not feature level.**

#### Playwright

- `https://playwright.dev/llms.txt` → **404**.
- `https://playwright.dev/llms-full.txt` → **404**.
- `https://playwright.dev/docs/auth` → 200.

**Verdict**: Playwright does NOT publish `llms.txt`. Markdown source on GitHub at [microsoft/playwright/docs/src/auth.md](https://github.com/microsoft/playwright/blob/master/docs/src/auth.md) is the practical agent-readable source. **Indirect signal.**

#### Better Auth

- `https://www.better-auth.com/llms.txt` → **200, valid markdown index** with full TOC and per-doc `/llms.txt/docs/...md` URLs. **Highest agent-readability** of the three.

> Content was rephrased for compliance with licensing restrictions.

---

### 7. Pitfalls / gotchas

#### CSRF / origin validation on the sign-in POST

[PR #6314](https://github.com/better-auth/better-auth/pull/6314), 2025-11-25 (merged [3f06dd2](https://github.com/better-auth/better-auth/commit/3f06dd2dd), 2025-12-31), introduced `formCsrfMiddleware` on `/sign-in/email` and `/sign-up/email`:

- Cookies present → `validateOrigin(ctx)` runs.
- No cookies + `Sec-Fetch-*` headers → cross-site `navigate` blocked with 403; otherwise origin validated.
- Neither → falls back to old behavior.

For Playwright: `APIRequestContext` POST has `Origin` matching `webServer.url` → same-origin → in `trustedOrigins` → passes. Cross-origin (deployed preview) → must configure `trustedOrigins`. **Open question**: which BA version `0.4.1-beta` wraps and whether `formCsrfMiddleware` is active.

#### `storageState` expiration on long-running suites

[microsoft/playwright issue #16627](https://github.com/microsoft/playwright/issues/16627), 2022-08-18: Playwright reads `storageState` once when context created; doesn't reload. Must re-login.

[Mergify — Playwright storageState is not just a setup file](https://mergify.com/blog/playwright-storagestate-shared-auth-leakage): logout test writing `storageState` poisons shared `auth.json`. Fix: write per-test state to `test.info().outputPath()`.

[#30416](https://github.com/microsoft/playwright/issues/30416), 2024-04-18: setup project re-runs on selective single-test run. Workaround: `setup.skip(fs.existsSync(authFile) && !fileOlderThan(authFile, '4h'))`.

#### Race conditions on first sign-in

From [playwright.dev/docs/auth](https://playwright.dev/docs/auth):

> "Sometimes login flow sets cookies in the process of several redirects. Wait for the final URL to ensure that the cookies are actually set."

Use `page.waitForURL(...)` or `expect(locator).toBeVisible()`. Anti-pattern: `storageState()` right after `click()`.

#### Cookie domain mismatch

Better Auth's `secure` derivation considers `options.baseURL`: `https://...` forces secure cookies. If `webServer.url` is `http://localhost:3000` but Neon Auth `baseURL: https://...`, secure cookie won't be sent → `auth.api.getSession` returns null. Documented in [Issue #4555](https://github.com/better-auth/better-auth/issues/4555) and [Cookies doc](https://www.better-auth.com/docs/concepts/cookies).

#### CSRF token requirements on auth POST

Better Auth uses content-type-based CSRF — only non-simple `Content-Type: application/json` accepted by default. PR #6314 also accepts `application/x-www-form-urlencoded`. **No separate CSRF token form field** — protection layers are content-type, `Origin`/`Referer` validation, Fetch Metadata.

Playwright's `request.post(url, { form: { ... } })` sends `application/x-www-form-urlencoded` with `Origin` and `Sec-Fetch-*` set to same-origin values — should pass `formCsrfMiddleware` automatically.

#### Turbopack-specific Playwright issues

Already covered in §3:
- [vercel/next.js#93328](https://github.com/vercel/next.js/issues/93328) (proxy.ts empty manifest under Turbopack)
- [vercel/next.js#92921](https://github.com/vercel/next.js/issues/92921) (404 on valid routes when `src/proxy.ts` present in dev)

#### Better Auth session cookie format gotchas (direct injection)

If considering direct cookie injection (Pattern A):

- Token value: `${nanoid(64)}.${HMAC-base64url-nopad(BETTER_AUTH_SECRET, token)}`, then `encodeURIComponent`.
- In production-secure mode, **two cookies** set: unprefixed name AND `__Secure-`-prefixed name. Reference: [Answer Overflow thread](https://www.answeroverflow.com/m/1356550334478155836).
- Cookie cache strategy `compact` vs `jwt` vs `jwe` ([session-management.mdx](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/concepts/session-management.mdx)) changes encoding. Default `compact`.
- The `next-js` plugin (`nextCookies()` in plugins) is required for cookies set inside Next.js server actions to actually reach the browser ([Discussion #3541](https://github.com/better-auth/better-auth/discussions/3541)). **Open question**: whether Neon Auth includes this by default.

> Content was rephrased for compliance with licensing restrictions.

---

### Recommendation surface for the planner (option-pairs, NOT recommendations)

#### Option pair 1 — Auth flow shape

- **A1: UI sign-in once via `storageState`** — drives real `/auth/sign-in` page, asserts authenticated DOM, saves `storageState`. Highest realism, exercises `proxy.ts` route, slowest.
- **A2: HTTP sign-in via `APIRequestContext.post('/api/auth/sign-in/email')`** — fastest, decoupled from UI. Requires user already exists. Same-origin POST passes `formCsrfMiddleware`.
- **A3: Direct cookie injection** — bypass HTTP. Requires `BETTER_AUTH_SECRET` (or Neon equivalent), knowledge of cookie prefix, HMAC algorithm. Brittle.

#### Option pair 2 — Test user provisioning

- **B1: Sign-up via HTTP (`POST /api/auth/sign-up/email`)** — works today; idempotently handle "user exists".
- **B2: SQL seed in `neon_auth.user/account/session`** — fastest, no HTTP. Brittle (BA password hash format, HMAC for pre-baked cookies).
- **B3: Neon Management API (`POST .../branches/{id}/auth/users`)** — uses `NEON_API_KEY`. Open question whether accepts password.
- **B4: Better Auth `testUtils()` plugin** — cleanest. Depends on `0.4.1-beta` exposure.

#### Option pair 3 — webServer choice

- **C1: `pnpm dev` everywhere** — fastest. Exposes proxy.ts Turbopack bugs.
- **C2: `pnpm dev` locally + `pnpm build && pnpm start` in CI** — Next.js docs default. Catches build-time issues. Matches `AGENTS.md` "test against the running app".
- **C3: `pnpm build && pnpm start` everywhere** — most realistic, slowest.

#### Option pair 4 — Playwright project topology

- **D1: Single setup project + `dependencies: ['setup']`** — canonical. One auth file. Simplest for single smoke test.
- **D2: Worker-scoped fixture** — only when tests modify shared state.
- **D3: No setup project, sign-in inside smoke test** — defeats reuse.

#### Option pair 5 — Browser binary install posture

- **E1: `pnpm exec playwright install --with-deps` as separate step** — Playwright-recommended for pnpm. No `pnpm-workspace.yaml` change.
- **E2: Rely on `@playwright/test` postinstall** — requires `allowBuilds` entry. Can be flaky on certain pnpm versions.

#### Option pair 6 — CI browser binary cache

- **F1: No browser cache** — Playwright maintainers' recommendation. ~30-60s per CI run.
- **F2: `actions/cache` keyed on `~/.cache/ms-playwright` + Playwright version** — community-standard.

#### Option pair 7 — Storage-state freshness strategy

- **G1: Recreate on every run** — simplest, always fresh.
- **G2: `setup.skip(fs.existsSync && !fileOlderThan(authFile, '4h'))`** — avoids re-auth in tight loops; comes with poisoning risk; mitigate with per-test outputPath.

#### Open questions to resolve in `/10x-plan`

1. Does `@neondatabase/auth@0.4.1-beta` expose Better Auth `testUtils()`? (Affects B1/B2/B4.)
2. What `cookiePrefix` does Neon Auth ship with — `__Secure-better-auth` or `__Secure-neon-auth`? (Internal research §1.3 confirms `__Secure-neon-auth` from installed bundle. Affects A3 and `getSessionCookie`-based assertions.)
3. Does FlowState's `proxy.ts` (project root) reproduce [#93328](https://github.com/vercel/next.js/issues/93328) or [#92921](https://github.com/vercel/next.js/issues/92921)? (Forces C1 vs C2.)
4. Does Neon Management API `POST .../auth/users` accept `password`? (Decides B3 viability.)
5. Does `@playwright/test` ship a postinstall on the version FlowState pins? (Decides `allowBuilds` need.)
6. Does Neon Auth's wrapped Better Auth include `nextCookies()` by default? (Affects server-action cookies through `proxy.ts`.)

---

*Compliance: external claims paraphrased per ≤30-consecutive-words rule. All citations as inline markdown links. "Open question for the plan" labels used where authoritative answers were unavailable.*



## Code References (consolidated)

Live codebase, file:line — use these to navigate when authoring `research.md`:

- `proxy.ts:1-15` — Next.js 16 `proxy.ts` middleware. Excludes `_next/static`, `_next/image`, `favicon.ico`, `api/auth`, `api/trpc`, `auth/`. Login redirect to `/auth/sign-in`.
- `src/lib/auth/server.ts:1-7` — `createNeonAuth({ baseUrl, cookies: { secret } })` from `@neondatabase/auth/next/server`. Server-side `auth` instance.
- `src/lib/auth/client.ts:1-3` — `createAuthClient()` from `@neondatabase/auth/next`. Browser `authClient`.
- `src/app/api/auth/[...path]/route.ts:1-3` — `auth.handler()` exposed as `GET, POST`. Catch-all auth HTTP surface.
- `src/app/api/trpc/[trpc]/route.ts:13-18` — tRPC HTTP handler invokes `createTRPCContext({ headers: req.headers })`.
- `src/app/auth/sign-in/action.ts:27-30` — `auth.signIn.email({ email, password })` server action; `redirect("/")` on success.
- `src/app/auth/sign-up/actions.ts:30-34` — `auth.signUp.email({ name, email, password })` server action.
- `src/server/api/trpc.ts:30-54` — `createTRPCContext` calls `auth.getSession()` and narrows to `{id, email, name}`. Swallows errors → `session: null`.
- `src/server/api/trpc.ts:107-115` — `timingMiddleware` adds `Math.floor(Math.random() * 400) + 100` ms delay when `t._config.isDev`.
- `src/server/api/trpc.ts:127-153` — `enforceAuth` middleware throws `UNAUTHORIZED` on missing/empty session fields.
- `src/server/api/trpc.ts:155-157` — `protectedProcedure = t.procedure.use(timingMiddleware).use(enforceAuth)`.
- `src/server/api/root.ts:1-30` — `appRouter` registers `task`, `session`, `cycle`, `checkIn`. `createCaller` factory exported.
- `src/server/api/config.ts:5` — `DEFAULT_LIST_LIMIT = 100`.
- `src/server/api/routers/{task,session,cycle,check-in}.ts` — every protected procedure scopes by `ctx.session.user.id`.
- `prisma/schema.prisma` — Models: Task, Session, Cycle, CheckIn. **No User model.** All use `userId String @db.VarChar(255)`.
- `prisma.config.ts:1-37` — Manual `.env` loader; `defineConfig({ schema, migrations: { path }, datasource: { url } })`.
- `vitest.config.ts:6-13` — jsdom env; `SKIP_ENV_VALIDATION: "1"` plus stub DB URLs and `NODE_ENV: "test"`.
- `src/test/setup.ts` — empty placeholder.
- `package.json:5-19` — scripts: `build`, `check*`, `db:*`, `dev`, `preview`, `start`, `test`, `test:watch`, `typecheck`. **No `test:e2e`.**
- `pnpm-workspace.yaml:6-21` — `strictDepBuilds: true`; `onlyBuiltDependencies` and `allowBuilds` lists. Playwright NOT listed.
- `tsconfig.json` — `verbatimModuleSyntax: true`, `noUncheckedIndexedAccess: true`, `moduleResolution: "Bundler"`, `paths: { "~/*": ["./src/*"] }`.
- `biome.jsonc:24-32` — `useSortedClasses` for `clsx`/`cva`/`cn`.
- `next.config.js:1-8` — empty config; `import "./src/env.js"` triggers env validation.
- `src/env.js` — Zod schema: `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `NEON_AUTH_BASE_URL` (https only), `NEON_AUTH_COOKIE_SECRET` (≥32 chars), `NODE_ENV`.
- `.env.example` — only the four secrets above.
- `node_modules/.../@neondatabase/auth/dist/next/server/index.mjs:289-297` — cookie name constants: `__Secure-neon-auth.session_token`, `__Secure-neon-auth.local.session_data`, `__Secure-neon-auth.session_challange`.
- `node_modules/.../@neondatabase/auth/dist/next/server/index.mjs:69-72` — `signUp: { email: { path: "sign-up/email", method: "POST" } }`.
- `node_modules/.../@neondatabase/auth/dist/next/server/index.mjs:130-133` — admin endpoint surface (visible in SDK; no admin secret currently configured).

## Architecture Insights

- **Auth boundary is HTTP-only.** Identity lives entirely in Neon Auth at `NEON_AUTH_BASE_URL`. The FlowState DB has no `User` table and no auth columns — only `userId String` foreign keys. This forces every test that needs a real session to obtain one through HTTP (or SDK) against Neon Auth.
- **The catch-all auth route is the only auth HTTP surface.** `proxy.ts` excludes `api/auth` so it's directly reachable. `auth.handler()` proxies to Better Auth's full HTTP map under that prefix.
- **`createTRPCContext` is one-shot.** Resolves session per request, narrows to `{id, email, name}`. Errors are swallowed → `null`. `protectedProcedure` then enforces non-null.
- **Test pyramid**: 14 existing test files, all unit/integration. None hit a real HTTP server, real DB, or real Neon Auth. F-02 introduces the first truly-e2e layer.
- **Per-user isolation is deeply embedded** — every router uses `ctx.session.user.id` as the tenancy key. Not relevant to F-02 directly but constrains how tests must inject/persist sessions: a Playwright test must surface as a real authenticated user, not a synthesized one, or the isolation guarantees become untestable.
- **Build does not run migrations.** `package.json:"build"` is `prisma generate && next build`. Production migrations go through `pnpm db:migrate:prod` (`scripts/migrate.ts`). E2E plan must NOT add migration steps to the build.
- **Vitest and Playwright must be config-isolated.** `vitest.config.ts` sets `SKIP_ENV_VALIDATION=1` and stub DB URLs — these MUST NOT leak into Playwright. Two test runners, two configs, two npm scripts (`pnpm test` for Vitest, `pnpm test:e2e` for Playwright).

## Historical Context (from foundation docs and prior changes)

- **`prd.md` NFRs that demand browser-level verification (literal):**
  - "User sees acknowledgement of any action … within 200ms."
  - "A configured Pomodoro cycle does not drift by more than ±2 seconds … regardless of whether the browser tab is active or in the background."
  - "A browser crash, page refresh, or connection loss does not cause loss of: task list, cycle configuration, or current session state."
  These are the three NFRs that justify F-02. None can be verified by an integration test alone.

- **`roadmap.md` F-02 entry (key fields):**
  - Outcome: "Playwright is installed and configured with a programmatic test-user authentication flow … one smoke test … signs in, loading the task list, and asserting DOM content."
  - Change ID: `e2e-test-infra`. Linear: FLO-14. GitHub: #6.
  - Prerequisites: none. Parallel with F-01 (done) and S-07 (planning only).
  - Unknowns: "How to authenticate a test user programmatically with Neon Auth — direct API call to get a session cookie, or a test-only auth bypass route?" Owner: implementer. Block: no.
  - Risk: "Without this, every UI-facing slice ships without real e2e confidence … each slice adds manual verification debt that cannot be automated retroactively without this foundation."
  - Status: active.
  - Research requirements row: Priority 🔴 High, targets "Playwright auth strategies with Neon Auth (beta); Next.js 16 + Playwright integration patterns".
  - Unlocks: S-01..S-07 (every UI-facing slice).

- **`tech-stack.md`:** Next.js 16, React 19, TypeScript 6, Prisma 7, tRPC 11, Tailwind 4, Vitest 4 + fast-check, Biome, pnpm 11, Vercel. CI provider listed as `github-actions` with `ci_default_flow: auto-deploy-on-merge` but no workflow files exist yet.

- **`infrastructure.md`:** Vercel Hobby; Neon Postgres via Marketplace (`eu-central-1`); preview deploys are public on Hobby (no Authentication add-on); `vercel rollback`; secrets via project settings; `vercel env ls/add/rm` per environment.

- **`health-check.md`:** Tests Vitest 4.1.7 jsdom + React plugin + Testing Library. CI: not detected. "No CI/CD configuration detected. You'll set this up in [M1L5]." Audit: 0 critical/0 high/2 moderate transitive. Note: file says "Tests found: 1" — outdated; the codebase now has 14 test files (the file was authored before F-01 shipped).

- **`context/changes/session-domain-model/plan.md`** is the **structural template** for the eventual F-02 plan. Salient features to mirror:
  - Frontmatter on `change.md` with status field that advances `new → preparing → planning → implementing → impl_reviewed → done`.
  - Plan structure: Overview → Current State Analysis → Desired End State (with Key Discoveries) → What We're NOT Doing → Implementation Approach (with decision table) → Critical Implementation Details → Phase 1..N → Testing Strategy → Performance Considerations → Migration Notes.
  - Each phase has Overview, Changes Required (file + intent + contract), Success Criteria split into "Automated Verification" and "Manual Verification", and an "Implementation Note" pause point between phases.

- **`AGENTS.md` constraints to honor (literal):**
  - "True e2e requires a browser with an authenticated session hitting the running app. Do not claim 'e2e verified' unless a real browser flow (with auth) was exercised."
  - "All changes must include unit and integration tests. Code must be testable at each level of the pyramid."
  - "Use `pnpm` for all install/run commands. Never use `npm` or `yarn`."
  - "Agent AI commands are always runned in Windows OS. Use always Windows compatibile commands."
  - "Indentation: tabs (size 2). Line endings: LF. Enforced by Biome and `.editorconfig`."
  - "Path alias: `~/` maps to `src/`."
  - "Always run `pnpm test` at the end of every work cycle before presenting results."
  - "Allowed commit types: `feat`, `docs`, `init` only. No trailing period."
  - "`gh` is installed and authenticated with account `konrad-kaluzny-ceneo`."
  - "Issues labeled `needs-research` … must not be planned without prior research."
  - "Never commit secrets. All env vars must be declared in `@src/env.js` (Zod schema)."

- **No `context/foundation/lessons.md` exists yet.** This research is a candidate input for the first lesson once the plan converges.

## Related Research

None. Searched `context/changes/**/research.md` and `context/archive/**/research.md` — no prior research artifacts in this repository.

## Open Questions

Identical to "Open questions to resolve in /10x-plan" in §7 above:

1. Does `@neondatabase/auth@0.4.1-beta` expose Better Auth `testUtils()`?
2. What `cookiePrefix` does Neon Auth use? (Internal research §1.3 confirms `__Secure-neon-auth` from installed bundle — verify at runtime.)
3. Does FlowState's root `proxy.ts` reproduce [vercel/next.js#93328](https://github.com/vercel/next.js/issues/93328) or [vercel/next.js#92921](https://github.com/vercel/next.js/issues/92921)?
4. Does Neon Management API `POST .../auth/users` accept a `password` field?
5. Does `@playwright/test` ship a postinstall on the pinned version?
6. Does Neon Auth's wrapped Better Auth include `nextCookies()` by default?

## Notes for the author of `research.md`

- **GitHub permalinks (skill step 8):** Skip for now. Branch is `features/e2e-test-infra`, HEAD `7d2dd695ebd862b34b1bd728905b3ebdc4846ff5` is local-only. Once pushed, replace `path:line` with `https://github.com/konrad-kaluzny-ceneo/FlowState/blob/{commit}/{path}#L{line}`.
- **Frontmatter (skill template):** date (current), researcher (Konrad Kaluzny), git_commit (current HEAD), branch (`features/e2e-test-infra`), repository (`konrad-kaluzny-ceneo/FlowState`), topic ("F-02 e2e-test-infra: Playwright + authenticated test user against Neon Auth (beta) on Next.js 16"), tags `[research, codebase, e2e, playwright, neon-auth, next-16]`, status `complete`.
- **Update `change.md`:** advance `status: preparing` → `status: researched` (or whatever the next phase token is) and bump `updated: <today>` once `research.md` is finalized.
- **Drop the third sub-agent's nominal section.** The "Historical Context" section above already covers what that sub-agent would have produced; do not leave a placeholder.
- **Compliance reminder:** External research paraphrased per ≤30-consecutive-words rule with markdown-link citations. Preserve when copying into `research.md`.



---

## Skill steps NOT completed (handoff log)

The `/10x-research` skill defines 10 numbered steps. This draft completes most of steps 1–7 but several items remain. Use this as the resumption checklist.

### Step 1 — Read mentioned files
**Status: complete.** All foundation docs (`prd.md`, `tech-stack.md`, `infrastructure.md`, `health-check.md`, `health-check-v1.md`, `roadmap.md` full, `README.md`) plus `AGENTS.md`, every relevant source file, both prior change folders. Confirmed `context/foundation/lessons.md` does NOT exist (so the "treat lessons as priors" instruction is moot — there are no priors yet).

### Step 2 — Decompose research question
**Status: complete.** Research areas pinned to roadmap's two explicit research targets: Playwright auth strategies with Neon Auth (beta), Next.js 16 + Playwright integration patterns. No formal task list created in the AI assistant's task management UI (this skill instruction is IDE-feature-dependent and was not used).

### Step 3 — Clarify research scope
**Status: skipped intentionally.** Skill says "Skip this step if the research query is unambiguous and tightly scoped." F-02's outcome is locked in `roadmap.md` and the AGENTS.md "true e2e" rule pins what counts as success. No clarification needed.

### Step 4 — Spawn parallel sub-agents
**Status: 2 of 3 completed.**
- Internal codebase deep-dive sub-agent: **completed**, output preserved in §"Detailed Findings — INTERNAL CODEBASE".
- External research sub-agent: **completed**, output preserved in §"Detailed Findings — EXTERNAL RESEARCH".
- Historical context sub-agent: **CANCELLED mid-run.** Recovered scope by reading source files directly in main context. Coverage is in §"Historical Context (from foundation docs and prior changes)" but is leaner than a dedicated sub-agent run would have produced. **Not blocking** — the historical material that mattered (PRD NFRs, F-02 entry, prior plan template, AGENTS.md rules) is captured.

### Step 5 — Wait for sub-agents and synthesize
**Status: complete for the two that ran.** §Summary is provisional and marked "author your own" — finalize when copying into `research.md`.

### Step 6 — Resolve change folder and metadata
**Status: complete.**
- `context/changes/e2e-test-infra/` exists.
- `change.md` written with frontmatter (status `preparing`, roadmap_ref F-02, prd_refs, unlocks, parallel_with, research_required: true).
- Path is NOT under `context/archive/` so the abort condition is not triggered.
- Filename for the canonical artifact will be `context/changes/e2e-test-infra/research.md` (single artifact per change).

### Step 7 — Generate research document
**Status: NOT DONE.** This file is `draft-research.md`, NOT `research.md`. The user is authoring `research.md` themselves from this draft. Open items for them:
- Convert frontmatter `status: draft` → `status: complete` and tags drop the `draft` token.
- Recompute `date` and `git_commit` at the moment of writing.
- Replace the provisional §Summary with their own headline.
- Optionally trim the option-pairs and open questions if any are out of scope.

### Step 8 — GitHub permalinks
**Status: NOT DONE — skipped by design.**
- Current branch `features/e2e-test-infra` is not pushed (`git status` showed only the tracked-mod on `roadmap.md`; HEAD `7d2dd6` is local-only).
- File:line references are local. To convert post-push: replace `path:line` with `https://github.com/konrad-kaluzny-ceneo/FlowState/blob/{commit}/{path}#L{line}`.
- The `gh repo view --json owner,name` call already succeeded; `owner: konrad-kaluzny-ceneo`, `name: FlowState`.

### Step 9 — Sync and present findings to user
**Status: NOT DONE.** No final concise summary was delivered to the user as a chat message (this draft file is the substitute). When `research.md` is authored, present:
- 4–6 bullet headline summary
- Key file references for navigation
- The 6 open questions (these gate the plan)
- Offer follow-up.

### Step 10 — Handle follow-up questions
**Status: not applicable yet.** No follow-ups received. Skill says append to the same `research.md` with a `## Follow-up Research [timestamp]` section and bump `last_updated` / `last_updated_note` in frontmatter.

### Side-tasks NOT done
- **No commit, no push.** All work is local. `change.md` and `draft-research.md` are unstaged. `roadmap.md` was already unstaged before this work began.
- **Did not advance `change.md` status field.** Currently `preparing`. Skill instruction: "only if current status is `new`, advance to `status: preparing`" — already at `preparing`, so the conditional was satisfied. When `research.md` is finalized, consider bumping to a "researched" or "ready-for-plan" status per the project's own status-token vocabulary (the prior change `session-domain-model` uses `impl_reviewed`; the project does not appear to have a documented status taxonomy).
- **No `pnpm test` run.** `AGENTS.md` requires it at the end of every work cycle, but this cycle made no source changes — only docs in `context/`. No test was run on purpose.
- **No update to `context/foundation/lessons.md`.** File does not exist. If the planner derives a recurring rule from this research, that's a candidate first lesson — but that's a `/10x-lesson` task, not a research task.
- **Did not invoke the `update-status` skill.** That skill is for shipping (PR with `Fixes #N`, status sync to Linear/GitHub). F-02 is in research, not implementation, so this is correctly deferred.

### Resumption checklist for the new chat (or for the human author)

1. `git rev-parse HEAD` and `git status --short` to refresh metadata.
2. Open `context/changes/e2e-test-infra/draft-research.md` (this file).
3. Create `context/changes/e2e-test-infra/research.md` from the draft. Suggested operations:
   - Copy frontmatter; flip `status: draft` → `status: complete`, drop `draft` from tags, refresh date/commit.
   - Drop the §"Notes for the author of research.md" section.
   - Drop this §"Skill steps NOT completed (handoff log)" section.
   - Optionally trim §Summary to 4–6 bullets.
4. Optionally delete `draft-research.md` once `research.md` is authored, or keep it for traceability.
5. Bump `change.md` `updated:` to today's date.
6. Present summary to user (skill step 9). Stop.
