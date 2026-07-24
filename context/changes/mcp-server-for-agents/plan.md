# MCP Server for AI Agents Implementation Plan

## Overview

Expose an MCP (Model Context Protocol) server at `/api/mcp` so external AI agents (Cursor, Claude, Copilot) can read and write a user's FlowState tasks and read their session/day state. The server is a thin adapter over the existing tRPC surface — every operation delegates to `appRouter.createCaller(ctx)`, reusing all business logic and per-user isolation. Authentication is a new personal API-key mechanism (the codebase has no bearer path today), issued self-serve from Settings, with a `READ` / `READ_WRITE` scope split.

This unblocks S-47 (delegation proposals in Plan dnia), which needs to read tasks + day context and mutate task state.

## Current State Analysis

Grounded in `context/changes/mcp-server-for-agents/research.md`:

- **All 8 tRPC routers are `protectedProcedure`** and user-scoped via `ctx.session.user.id`; `createCaller` is exported at [src/server/api/root.ts:37](src/server/api/root.ts). This is the reuse seam.
- **Identity is 100% cookie-based.** `createTRPCContext` calls `auth.getSession()` which reads the Neon Auth cookie from `next/headers` and ignores passed-in headers ([src/server/api/trpc.ts:28-54](src/server/api/trpc.ts)). `protectedProcedure`'s `enforceAuth` requires `session.user.id`, `.email`, and `.name` all truthy ([trpc.ts:137-161](src/server/api/trpc.ts)).
- **No bearer/API-key path anywhere; no `middleware.ts`; no local `User` model.** Every domain table carries a denormalized `userId String @db.VarChar(255)` ([prisma/schema.prisma:71,106,186](prisma/schema.prisma)) — the Neon Auth `user.id` string is the stable DB-wide key an `ApiKey` row binds to directly.
- **Route handlers run on the default Node runtime** (no `export const runtime` anywhere); reference pattern is [src/app/api/trpc/[trpc]/route.ts:1-34](src/app/api/trpc/[trpc]/route.ts) (one fetch handler exported per verb).
- **Vercel Hobby caps functions at 10s** (context/foundation/infrastructure.md) — mandates stateless request/response, no long-open SSE.
- **Domain enums** (`workType`, `energyLevel`, `commitmentHorizon`, `cycleKind`) are Zod-backed in `src/lib/domain/*` and reusable in MCP tool input schemas.
- **Stack**: `next ^16.2.6`, `@trpc/* ^11.17.0`, `@prisma/client ^7.8.0`, `zod ^4.4.3`, `superjson ^2.2.6`. `mcp-handler` / `@modelcontextprotocol/sdk` are net-new installs.
- **Settings (Ustawienia)** exists from S-45 as the home for the key-management panel. Env vars go through the Zod contract in [src/env.js:9-48](src/env.js) + its `runtimeEnv` map.

## Desired End State

A user can, from Settings, create one or more named API keys (each `READ` or `READ_WRITE`), see the secret exactly once, and revoke any key. An external MCP client configured with a key can connect to `https://<app>/api/mcp`, list/create/update/complete that user's tasks, and read their session/cycle/day state and the app's scored next-task suggestion — all scoped to that user, with write tools rejected for `READ` keys. Verify by: (1) creating a key in Settings, (2) connecting MCP Inspector to `/api/mcp` with the key, (3) calling `list_tasks` and `create_task` and seeing them reflected in the app, (4) confirming a `READ` key is denied `create_task`.

### Key Discoveries:

- `appRouter.createCaller(ctx)` ([root.ts:37](src/server/api/root.ts)) is the only integration layer needed — the repository interfaces in `src/lib/data-mode/types.ts` are narrower (no suggestion/recap/day-plan) and are the wrong seam.
- `protectedProcedure` requires `user.email` and `user.name` to be truthy, not just `id` ([trpc.ts:138-144](src/server/api/trpc.ts)) — so the synthetic context must supply all three. The key row stores an email/name snapshot captured at creation (real session available then).
- `withMcpAuth(handler, verifyToken, opts)` accepts `verifyToken(req, bearerToken) => Promise<AuthInfo | undefined>` returning `{ token, scopes, clientId, extra }`; `extra` carries `userId`/scope into tool handlers via `authInfo`.
- The scored suggestion (`suggestion.next`, [suggestion.ts:183](src/server/api/routers/suggestion.ts)) is a mutation but performs no writes — safe to expose read-only; its `kickoff` context needs a `sessionId`.

## What We're NOT Doing

- **No cycle/timer control via MCP** — `cycle.create/complete/pause/resume/interrupt`, `checkIn.create`, `session.create/end`, `suggestion.recordDecision`. These drive the F-07 transition conductor and `use-pomodoro-cycle` (highest blast radius) and violate "the user drives the timer."
- **No hard delete / reorder / archive of tasks via MCP** in v1 (`task.delete`, `task.reorder`, `task.deleteArchived`, `task.restore`). Agents mutate status/attributes, not destroy data.
- **No OAuth 2.1 / dynamic client registration** — deferred; PAT is the v1 fit. (Neon Auth AS capability is unverified — research OQ #1.)
- **No rate limiting / abuse controls** beyond auth in v1 (noted as a follow-up risk).
- **No preference/day-plan writes** via MCP (`preference.set`, `dayPlan.setBudget/setEnergy`) — read-only exposure of day state only.
- **No guest-mode support** — MCP is authenticated-only.

## Implementation Approach

Build bottom-up in three independently testable layers: (1) a pure API-key primitive (model + generate/verify utility) with no dependents, (2) self-serve management (tRPC router + Settings UI) that exercises the primitive, (3) the MCP endpoint that consumes a verified key and bridges to `createCaller`. Layers 1–2 ship value even before the MCP route exists (a user can mint/revoke keys); layer 3 turns them into agent access.

## Critical Implementation Details

- **Synthetic context must satisfy `enforceAuth`.** `createCaller` runs the real `protectedProcedure` middleware, which throws `UNAUTHORIZED` unless `session.user.id`, `.email`, and `.name` are all truthy ([trpc.ts:138-144](src/server/api/trpc.ts)). The MCP route bypasses `createTRPCContext` (cookie-based) and constructs `{ db, session: { user: { id, email, name } }, headers: req.headers }` from the key row's stored snapshot. Do not call `auth.getSession()` in the MCP path.
- **Statelessness is mandatory.** Serverless functions share no memory across invocations and long streams die at the 10s Hobby cap. Configure `mcp-handler` in stateless mode (no Redis), set an explicit `export const maxDuration`, and keep tool responses short request/response.
- **Key lookup must not scan.** The key string embeds a public, indexed token id so verification is an indexed lookup + constant-time hash compare — never a full-table scan of hashes.

## Phase 1: API-key data model + auth core

### Overview

Add the `flow_state_api_key` table and a pure utility that generates a key, splits it into a public token id + secret, and verifies a presented key against a stored peppered hash and scope. No UI, no MCP — fully unit-testable.

### Changes Required:

#### 1. Prisma model + migration

**File**: `prisma/schema.prisma`

**Intent**: Add an `ApiKey` model storing the hashed secret and metadata so a presented key resolves to a user + scope without any local User table.

**Contract**: New model mapped `@@map("flow_state_api_key")`. Fields: `id` (int autoincrement PK), `userId String @db.VarChar(255)` (indexed), `name String` (user label), `tokenId String @unique` (public, embedded in the key string, drives lookup), `hashedSecret String`, `scope ApiKeyScope`, `userEmail String`, `userName String` (session snapshot for the synthetic context), `createdAt`, `lastUsedAt DateTime?`, `revokedAt DateTime?`. New enum `ApiKeyScope { READ READ_WRITE }`. Follow the existing `flow_state_*` + denormalized-`userId` conventions. Generate the migration with `pnpm db:migrate` (never hand-write SQL).

#### 2. Env secret

**File**: `src/env.js`

**Intent**: Add a server-side pepper used when hashing key secrets, so a DB leak alone doesn't expose usable hashes.

**Contract**: New required server var `MCP_API_KEY_PEPPER` (min 32 chars) in the Zod server block and the `runtimeEnv` map. Add to `.env` / `.env.example` as applicable.

#### 3. Key generation + verification utility

**File**: `src/lib/api-keys/api-key.ts` (new)

**Intent**: Own the key format and crypto so both the tRPC router (creation) and the MCP verifier (verification) share one implementation.

**Contract**: Pure functions, no DB access:
- `generateApiKey(): { plaintext, tokenId, hashedSecret }` — plaintext format `fsk_<tokenId>_<secret>` where `tokenId` and `secret` are high-entropy random (Node `crypto`); `hashedSecret = sha256(secret + pepper)`.
- `parseApiKey(plaintext): { tokenId, secret } | null` — strict parse of the `fsk_…` shape.
- `verifySecret(secret, hashedSecret): boolean` — constant-time compare (`crypto.timingSafeEqual`).
Reads `MCP_API_KEY_PEPPER` from `~/env`. No pepper value ever logged.

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly: `pnpm db:migrate`
- Prisma client generates: `pnpm dev` prisma generate step (or `pnpm exec prisma generate`)
- Unit tests pass: `pnpm exec vitest run src/lib/api-keys/api-key.test.ts`
- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm check`

#### Manual Verification:

- Generated key round-trips: `parseApiKey(generateApiKey().plaintext)` yields the same `tokenId`, and `verifySecret` returns true for the right secret, false for a tampered one.
- `flow_state_api_key` table visible in `pnpm db:studio` with the expected columns.

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 2: Key management (tRPC router + Ustawienia UI)

### Overview

Let users mint, list, and revoke named keys self-serve. The `create` mutation returns the plaintext exactly once; storage keeps only the hash.

### Changes Required:

#### 1. `apiKey` tRPC router

**File**: `src/server/api/routers/api-key.ts` (new), registered in `src/server/api/root.ts`

**Intent**: CRUD-lite over the user's keys, all `protectedProcedure` so keys are minted against the real cookie session (capturing the email/name snapshot).

**Contract**:
- `list` (query) → `{ id, name, scope, createdAt, lastUsedAt, revokedAt, tokenId }[]` for `ctx.session.user.id` (never the secret/hash).
- `create` (mutation) — input `{ name: string(1-64), scope: ApiKeyScope }` → returns `{ id, plaintext }` **once**; persists `tokenId`, `hashedSecret`, `scope`, and `userEmail`/`userName` from `ctx.session.user`.
- `revoke` (mutation) — input `{ id: int }` → sets `revokedAt`; verifies ownership by `userId`.
Register alongside the existing 8 routers in `root.ts`.

#### 2. Per-user isolation test

**File**: `src/server/api/routers/api-key-isolation.test.ts` (new)

**Intent**: Prove one user cannot list or revoke another user's keys — the same guarantee every user-scoped router carries.

**Contract**: Mirror the existing `*-isolation.test.ts` pattern (createCaller with two user contexts; assert cross-user `list` excludes and `revoke` throws NOT_FOUND/UNAUTHORIZED).

#### 3. Settings panel

**File**: `src/app/settings/_components/api-keys-panel.tsx` (new) + wiring into the Ustawienia page

**Intent**: A calm, on-brand panel to create a named key (choosing scope), reveal the secret once with a copy affordance, list existing keys with scope/created/last-used, and revoke.

**Contract**: Client component using the `apiKey` router via the server-repositories/tRPC client pattern used elsewhere in Settings. Reveal-once UX: after `create`, show the plaintext in a dismissible reveal with copy; it is never re-fetchable. All strings via `next-intl` (`src/i18n/`), PL primary per product voice.

#### 4. i18n copy

**File**: `src/i18n/messages/*` (existing message catalogs)

**Intent**: Add the panel's labels/help text (create, scope names, reveal-once warning, revoke confirm).

**Contract**: New message keys under a `settings.apiKeys` namespace in each locale catalog.

### Success Criteria:

#### Automated Verification:

- Unit/integration tests pass: `pnpm exec vitest run src/server/api/routers/api-key-isolation.test.ts`
- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm check`
- Full unit suite green: `pnpm test`

#### Manual Verification:

- In Settings, create a `READ_WRITE` key → secret shown once, copyable; reloading the page never shows it again.
- Created key appears in the list with correct scope; revoke marks it revoked and it disappears from the active set.
- A second signed-in account cannot see the first account's keys.
- Copy matches product voice (PL), no raw keys logged to console/server.

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 3: MCP endpoint + curated tools

### Overview

Mount the MCP server, authenticate it with a key, and expose curated read/write tools that delegate to `createCaller`. Write tools are gated to `READ_WRITE` keys.

### Changes Required:

#### 1. Install MCP dependency

**File**: `package.json`

**Intent**: Add Vercel's `mcp-handler` (pulls `@modelcontextprotocol/sdk`) — the App Router MCP adapter.

**Contract**: `pnpm add mcp-handler`. If Prisma bundling complains under the route, add `serverExternalPackages: ["@prisma/client"]` to `next.config.js` (currently absent).

#### 2. Key → context bridge

**File**: `src/lib/api-keys/verify-token.ts` (new)

**Intent**: Resolve a presented bearer key to a live user identity + scope for the MCP verifier, updating `lastUsedAt`.

**Contract**: `verifyApiKey(bearerToken): Promise<{ userId, userEmail, userName, scope } | null>` — `parseApiKey` → indexed lookup by `tokenId` → reject if `revokedAt` set → `verifySecret` constant-time compare → bump `lastUsedAt`. Returns null on any failure (no distinguishing errors). Also export a helper to build the synthetic tRPC context `{ db, session: { user: { id, email, name } }, headers }` from that result.

#### 3. MCP route handler

**File**: `src/app/api/mcp/route.ts` (new)

**Intent**: The MCP server itself — stateless Streamable HTTP, authenticated, tools bridged to `createCaller`.

**Contract**: `createMcpHandler((server) => { /* register tools */ }, {}, { basePath: "/api", maxDuration: 10 })` wrapped in `withMcpAuth(handler, verifyToken, { required: true })`, exported as `GET`/`POST` (and `DELETE` if the SDK needs session teardown — stateless likely does not). `verifyToken` calls `verifyApiKey` and returns `AuthInfo` with `extra = { userId, userEmail, userName, scope }`. `export const maxDuration = 10` (Hobby). Node runtime (no `runtime` export). Each tool handler reads `authInfo.extra`, builds the synthetic context, and calls `appRouter.createCaller(ctx)`.

**Read tools** (any scope):
- `list_tasks` → `task.list`
- `get_session_state` → `cycle.getActive` + `cycle.countCompletedWork` + `cycle.getLatestCheckInEnergy` (composed) or `session.list` head; returns active cycle/task + counts.
- `get_day_stats` → `recap.getDayStats` (rolling 24h totals)
- `get_day_plan` → `dayPlan.getOrCreate`
- `get_next_suggestion` → `suggestion.next` (kickoff) using the active session id from `cycle.getActive`/`session.list`; input `{ localDateKey, localHour, energy }`; if no active session, return a friendly "no active session" result. Annotate read-only; records no decision.

**Write tools** (`READ_WRITE` only — throw a clear error otherwise):
- `create_task` → `task.create` (input schema reuses `src/lib/domain/*` Zod enums)
- `update_task` → `task.update` (status/attributes; status ∈ active|completed|planned|blocked)
- `complete_task` → `task.update` with `status: "completed"` (agent-friendly shortcut)

#### 4. Scope enforcement + error mapping

**File**: `src/app/api/mcp/route.ts` (same) / small helper in `src/lib/api-keys/`

**Intent**: Reject writes for `READ` keys and translate tRPC failures into readable MCP tool errors.

**Contract**: A `requireWrite(authInfo)` guard used by every write tool that throws a tool error when `scope !== "READ_WRITE"`. A `toMcpError(TRPCError)` mapper turning `UNAUTHORIZED`/`FORBIDDEN`/`NOT_FOUND`/`CONFLICT`/`BAD_REQUEST` into concise `isError` tool responses (no stack traces / internal details).

#### 5. Integration tests

**File**: `src/app/api/mcp/mcp-tools.test.ts` (new) and `src/lib/api-keys/verify-token.test.ts` (new)

**Intent**: Prove the auth bridge and tool delegation at the caller layer (per lessons L-06 — no browser).

**Contract**: `verify-token.test.ts`: valid/invalid/revoked keys, scope resolution, `lastUsedAt` bump. `mcp-tools.test.ts`: a `READ` key is denied `create_task`; a `READ_WRITE` key creates a task visible via `list_tasks`; tools are user-scoped (user A's key never sees user B's tasks); tRPC errors map to `isError` responses. Drive tools through the same `createCaller` path the route uses.

### Success Criteria:

#### Automated Verification:

- Tests pass: `pnpm exec vitest run src/lib/api-keys/verify-token.test.ts src/app/api/mcp/mcp-tools.test.ts`
- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm check`
- Build succeeds: `pnpm build`
- Full unit suite green: `pnpm test`

#### Manual Verification:

- MCP Inspector connects to `http://localhost:3000/api/mcp` with a `READ_WRITE` key; `list_tasks` returns the user's tasks; `create_task` adds one visible in the app UI.
- A `READ` key connects and can call read tools but `create_task` returns a clear permission error.
- A revoked key is rejected at connect/verify.
- `get_next_suggestion` returns the app's suggested task + rationale when a session is active, and a graceful message when not.
- No secrets or pepper values in server logs.

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation.

---

## Testing Strategy

### Unit Tests:

- `api-key.ts`: generate → parse round-trip; `verifySecret` true/false incl. tampered secret; format rejection in `parseApiKey`.
- `verify-token.ts`: valid / invalid / revoked / unknown-tokenId; scope surfaced; `lastUsedAt` updated.

### Integration Tests:

- `api-key-isolation.test.ts`: cross-user `list`/`revoke` isolation.
- `mcp-tools.test.ts`: scope gating (READ denied writes), write→read visibility, per-user scoping, error mapping — all via `createCaller`.

### Manual Testing Steps:

1. Create a `READ_WRITE` key in Settings; confirm reveal-once + copy.
2. Connect MCP Inspector with the key; run `list_tasks`, `create_task`, `update_task`, `get_day_stats`, `get_next_suggestion`.
3. Create a `READ` key; confirm read tools work and write tools are refused.
4. Revoke a key; confirm the client can no longer authenticate.
5. Confirm the second account cannot see the first's tasks through its own key.

## Performance Considerations

Stateless Streamable HTTP, one indexed key lookup per request, Node runtime. Keep each tool to a single `createCaller` round-trip to stay well under the 10s Hobby cap; `maxDuration = 10` set explicitly. Neon serverless HTTP driver already used — expect ~300-500ms cold start on the first hit.

## Migration Notes

One additive migration (`flow_state_api_key` table + `ApiKeyScope` enum) via `pnpm db:migrate` — no changes to existing tables, no data backfill. Rollback = drop the table/enum; no other surface depends on it until Phase 3 ships.

## References

- Related research: `context/changes/mcp-server-for-agents/research.md`
- Reuse seam: [src/server/api/root.ts:37](src/server/api/root.ts) (`createCaller`)
- Auth enforcement contract: [src/server/api/trpc.ts:137-161](src/server/api/trpc.ts)
- Route-handler pattern: [src/app/api/trpc/[trpc]/route.ts:1-34](src/app/api/trpc/[trpc]/route.ts)
- Isolation-test pattern: existing `src/server/api/routers/*-isolation.test.ts`
- Domain Zod enums: `src/lib/domain/*`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: API-key data model + auth core

#### Automated

- [x] 1.1 Migration applies cleanly: `pnpm db:migrate`
- [x] 1.2 Prisma client generates
- [x] 1.3 Unit tests pass: `pnpm exec vitest run src/lib/api-keys/api-key.test.ts`
- [x] 1.4 Type checking passes: `pnpm typecheck`
- [x] 1.5 Linting passes: `pnpm check`

#### Manual

- [x] 1.6 Key round-trips (parse/verify true/false) verified
- [x] 1.7 `flow_state_api_key` table visible in `pnpm db:studio` with expected columns

### Phase 2: Key management (tRPC router + Ustawienia UI)

#### Automated

- [ ] 2.1 Isolation test passes: `pnpm exec vitest run src/server/api/routers/api-key-isolation.test.ts`
- [ ] 2.2 Type checking passes: `pnpm typecheck`
- [ ] 2.3 Linting passes: `pnpm check`
- [ ] 2.4 Full unit suite green: `pnpm test`

#### Manual

- [ ] 2.5 Create key in Settings → secret shown once, copyable, never re-shown
- [ ] 2.6 Key lists with correct scope; revoke works
- [ ] 2.7 Second account cannot see first account's keys
- [ ] 2.8 PL copy on-brand; no raw keys logged

### Phase 3: MCP endpoint + curated tools

#### Automated

- [ ] 3.1 Tests pass: `pnpm exec vitest run src/lib/api-keys/verify-token.test.ts src/app/api/mcp/mcp-tools.test.ts`
- [ ] 3.2 Type checking passes: `pnpm typecheck`
- [ ] 3.3 Linting passes: `pnpm check`
- [ ] 3.4 Build succeeds: `pnpm build`
- [ ] 3.5 Full unit suite green: `pnpm test`

#### Manual

- [ ] 3.6 MCP Inspector: `READ_WRITE` key lists + creates tasks visible in app
- [ ] 3.7 `READ` key: read tools work, write tools refused with clear error
- [ ] 3.8 Revoked key rejected at verify
- [ ] 3.9 `get_next_suggestion` returns suggestion+rationale when session active, graceful message otherwise
- [ ] 3.10 No secrets/pepper in server logs
