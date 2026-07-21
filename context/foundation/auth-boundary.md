---
project: FlowState
type: auth-boundary
version: 1
created: 2026-07-21
updated: 2026-07-21
---

# Auth boundary

Where FlowState decides "who is calling", what that decision does and does **not**
guarantee, and the checklist to follow when adding a user-scoped router.

Source of truth for the behavior described here: `src/server/api/trpc.ts`
(verified against the file on 2026-07-21). If that file changes, update this doc in
the same commit.

## 1. How the session reaches a procedure

`createTRPCContext({ headers })` (`src/server/api/trpc.ts`) builds every request context:

1. Calls `auth.getSession()` — Neon Auth, wired in `src/lib/auth/server.ts`.
2. Builds `session` **only** when both `user.id` and `user.email` are truthy.
   `name` is derived defensively: `user.name || user.email.split("@")[0] || user.email`.
3. Any throw from `getSession()` is swallowed (`catch { session = null }`). An auth
   outage therefore degrades the caller to **anonymous**; it never surfaces as a 500.
4. Returns `{ db, session, ...opts }` — so `ctx.db`, `ctx.session`, `ctx.headers`.

`session` is `{ user: { id, email, name } } | null`. There are **no roles, scopes, or
claims** in the context. Authorization in this app is exclusively per-row ownership
via `userId`.

The same factory feeds both entry points, so there is one context shape in production:

- HTTP: `src/app/api/trpc/[trpc]/route.ts`
- RSC: `src/trpc/server.ts`

## 2. The two procedure kinds

| Builder | Definition (`trpc.ts`) | Guarantee |
| --- | --- | --- |
| `publicProcedure` | `t.procedure.use(timingMiddleware)` | None. `ctx.session` may be `null`. |
| `protectedProcedure` | `t.procedure.use(timingMiddleware).use(enforceAuth)` | `ctx.session.user.{id,email,name}` are non-nullable `string`s. |

`enforceAuth` throws `new TRPCError({ code: "UNAUTHORIZED" })` unless **all three** of
`ctx.session?.user?.id`, `.email`, and `.name` are truthy — note the truthiness check
means an empty string is rejected, not just `null`/`undefined`. On success it calls
`next({ ctx: { session: { user: { id, email, name } } } })`, which is what narrows the
three fields for the handler; `db` and `headers` carry over from the base context.

Ordering matters and is asserted by the smoke test: middlewares run **before** input
parsing, so an unauthenticated call with malformed (or missing) input still fails with
`UNAUTHORIZED`, never `BAD_REQUEST`. Unauthenticated requests also never reach Prisma.

**Current state (verified 2026-07-21):** `publicProcedure` has **zero** usages in
`src/` — every procedure registered on `appRouter` is a `protectedProcedure`.
`src/server/api/routers/auth-boundary.test.ts` enforces this by sweeping the whole
router; adding a genuinely public procedure requires adding its path to that test's
`PUBLIC_PROCEDURE_PATHS` allowlist, which is a deliberate, reviewable decision.

## 3. What `protectedProcedure` does NOT do

- **No row-level authorization.** It proves *who* the caller is, not that the
  `taskId` / `cycleId` / `sessionId` in the input belongs to them. Every handler must
  scope its own Prisma query by `ctx.session.user.id` — e.g.
  `findFirst({ where: { id: input.cycleId, userId } })` and throw `NOT_FOUND` when the
  row is missing. This is the invariant the `*-isolation.test.ts` suite covers.
- **No CSRF, rate limiting, or role checks.** None of these exist in the app today.
- **No coverage of non-tRPC surfaces** — see §4.

## 4. Surfaces outside the tRPC boundary

There is **no Next.js `middleware.ts`** in this repo, so there is no edge-level route
guard. Each surface guards itself:

| Surface | Guard |
| --- | --- |
| `src/app/_actions/import-guest-snapshot.ts` | Own `auth.getSession()` check; returns `{ ok: false, error: "UNAUTHORIZED" }` rather than throwing. Server actions bypass tRPC middleware entirely. |
| `src/app/api/health/route.ts` | Intentionally public readiness probe — must never return user data. |
| `src/app/api/auth/[...path]/route.ts` | Neon Auth's own handler. |
| Pages (`src/app/page.tsx`, `src/app/focus/page.tsx`, `src/app/layout.tsx`) | Read the session directly to choose guest vs authenticated rendering — presentation, not a security boundary. |

Anything that writes user-scoped data from outside tRPC needs its own explicit
session check plus its own test; the router sweep will not see it.

## 5. Checklist — adding a user-scoped router

1. **Use `protectedProcedure`** for every procedure. Reach for `publicProcedure` only
   with a written reason, and expect to justify the `PUBLIC_PROCEDURE_PATHS` entry.
2. **Register it in `src/server/api/root.ts`.** An unregistered router is invisible to
   the auth-boundary sweep.
3. **Scope every Prisma query by `ctx.session.user.id`** — in `where`, on reads *and*
   writes, including nested/related lookups. Never trust an id from `input` alone.
4. **Return `NOT_FOUND`, not `FORBIDDEN`, for another user's row.** `FORBIDDEN` confirms
   the row exists; the existing routers all use `NOT_FOUND`. Stay consistent.
5. **Add `src/server/api/routers/<feature>-isolation.test.ts`** covering: a cross-user
   read returns nothing, and a cross-user write is rejected. Model it on
   `suggestion-isolation.test.ts` (explicit cases) or `session-isolation.test.ts`
   (fast-check property).
6. **Re-run the sweep** — `pnpm exec vitest run src/server/api/routers/auth-boundary.test.ts`.
   It picks new procedures up automatically from `appRouter._def.procedures`.
7. **Mirror the guest side.** If the feature also has a guest repository
   (`src/lib/data-mode/`), remember the guest path has no server boundary at all —
   it is browser storage. Never assume a check on the server implies one in guest mode.

## 6. Enforcement map

| Layer | File(s) | Asserts |
| --- | --- | --- |
| Middleware unit | `src/server/api/protected-procedure.test.ts` | fast-check: valid session executes; null/missing/empty-string fields and a throwing `getSession()` all yield `UNAUTHORIZED`; ctx narrowing holds. |
| Whole-router smoke | `src/server/api/routers/auth-boundary.test.ts` | Every registered procedure rejects a no-session caller with `UNAUTHORIZED` and touches no database. |
| Per-user isolation | `src/server/api/routers/*-isolation.test.ts` | An *authenticated* caller cannot read or mutate another user's rows. |
