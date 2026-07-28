---
date: 2026-07-24T14:23:04+02:00
researcher: Konrad Zieliński
git_commit: 4b912d04219a08ec3bdf9dd7845729fe48e54d0b
branch: main
repository: konrad-kaluzny-ceneo/FlowState
topic: "MCP server for AI agents — protocol/transport surface + agent auth model (S-46)"
tags: [research, codebase, mcp, trpc, auth, neon-auth, vercel, agent-integration]
status: complete
last_updated: 2026-07-24
last_updated_by: Konrad Zieliński
---

# Research: MCP server for AI agents (S-46)

**Date**: 2026-07-24T14:23:04+02:00
**Researcher**: Konrad Zieliński
**Git Commit**: 4b912d04219a08ec3bdf9dd7845729fe48e54d0b
**Branch**: main
**Repository**: konrad-kaluzny-ceneo/FlowState

## Research Question

Build an MCP (Model Context Protocol) server so external AI agents (Cursor, Claude, Copilot) can read/write FlowState tasks and session state, enabling agent-driven task-delegation proposals (S-47). The roadmap flags two explicit unknowns to resolve before `/10x-plan`:

1. **Protocol / transport surface** — how to expose an MCP server from this Next.js 16 + tRPC + Vercel stack.
2. **Agent auth model** — how a headless machine client authenticates, given the app is cookie-based Neon Auth today.

Scope decisions taken with the user (both "research all, recommend"): investigate the full tool-surface tier ladder and all three auth options, then recommend a v1 boundary.

## Summary

**The whole thing is a thin adapter over logic that already exists.** Every user operation FlowState needs is already a `protectedProcedure` in one of 8 tRPC routers, and `appRouter.createCaller(ctx)` is the exact reuse seam — an MCP tool resolves a `userId`, builds a synthetic tRPC context, and calls the caller. No business logic is reimplemented.

Two clear recommendations fall out of the research:

- **Transport/hosting**: Use Vercel's official **`mcp-handler`** package to mount one App Router route (`src/app/api/mcp/route.ts`) speaking **stateless Streamable HTTP**. This is the transport the MCP spec adopted in March 2025 (replacing SSE), it needs no Redis in stateless mode, it matches the existing "single fetch handler exported per verb" pattern, and stateless request/response is the only shape compatible with **Vercel's 10s Hobby function limit** (long-open SSE streams would be killed).
- **Auth**: Ship a **personal API key / PAT** verified through `mcp-handler`'s **`withMcpAuth(handler, verifyToken, …)`** wrapper. `verifyToken` accepts an arbitrary bearer token and returns `AuthInfo` (with `extra.userId`), which is exactly the single-user shape FlowState needs. The formal MCP spec (Nov 2025) prefers **OAuth 2.1**, but that is designed for multi-user/multi-client servers and depends on Neon Auth acting as a third-party authorization server — unverified for `@neondatabase/auth 0.4.1-beta` and far heavier. Document OAuth 2.1 as a future upgrade; reusing the existing Neon Auth session cookie is **not viable** for headless clients (cookie-only, HttpOnly, no programmatic mint path).

**Recommended v1 tool surface**: **Task read/write + session/cycle read-only.** This directly unblocks S-47 (delegation proposals need to read + mutate tasks and read day/session context) while keeping agents *out* of cycle-control writes (start/pause/end), which route through the high-blast-radius wedge/transition-conductor machinery and violate the "the user drives the timer" calm-flow principle.

## Detailed Findings

### A. Operation surface — everything is already a user-scoped tRPC procedure

`appRouter` composes 8 routers ([src/server/api/root.ts:16-25](src/server/api/root.ts)), and **every procedure across all of them is `protectedProcedure`** — there is no `publicProcedure` anywhere under `routers/`. Each handler reads `ctx.session.user.id` and filters every query/mutation by `userId`. `createCaller` is exported as the server-side caller factory ([src/server/api/root.ts:37](src/server/api/root.ts)).

Candidate operations, grouped, each already implemented:

**Task reads**
- List active tasks (+ done-for-today) — `task.list` ([src/server/api/routers/task.ts:40](src/server/api/routers/task.ts))
- List archived tasks — `task.archiveList` ([task.ts:283](src/server/api/routers/task.ts))

**Task writes**
- `task.create` ([task.ts:78](src/server/api/routers/task.ts)) — title, workType, weight, importance, urgency, effortMinutes, commitmentHorizon, resumeNote, project, personaPresetId, isDailyStanding
- `task.update` ([task.ts:134](src/server/api/routers/task.ts)) — status transitions `active|completed|planned|blocked`
- `task.reorder` ([task.ts:220](src/server/api/routers/task.ts)), `task.delete` ([task.ts:267](src/server/api/routers/task.ts)), `task.restore` ([task.ts:293](src/server/api/routers/task.ts)), `task.deleteArchived` ([task.ts:317](src/server/api/routers/task.ts)), `task.markDoneForToday` ([task.ts:345](src/server/api/routers/task.ts))

**Session / cycle reads** (situational context for agents)
- `session.list` ([session.ts:9](src/server/api/routers/session.ts)), `session.getLastEnded` ([session.ts:110](src/server/api/routers/session.ts))
- `cycle.getActive` ([cycle.ts:74](src/server/api/routers/cycle.ts)), `cycle.list` ([cycle.ts:19](src/server/api/routers/cycle.ts)), `cycle.countCompletedWork` ([cycle.ts:32](src/server/api/routers/cycle.ts)), `cycle.getLatestCheckInEnergy` ([cycle.ts:59](src/server/api/routers/cycle.ts))
- `recap.getDaily` ([recap.ts:16](src/server/api/routers/recap.ts)), `recap.getDayStats` ([recap.ts:22](src/server/api/routers/recap.ts)) — rolling 24h stats
- `dayPlan.getOrCreate` ([day-plan.ts:16](src/server/api/routers/day-plan.ts)), `preference.get` ([preference.ts:17](src/server/api/routers/preference.ts))
- `suggestion.next` ([suggestion.ts:183](src/server/api/routers/suggestion.ts)) — computes the scored next-task suggestion + rationale (declared a mutation but read-semantic; mark with a read-only tool hint)

**Cycle-control + session-state writes** (recommend EXCLUDE from v1)
- `session.create` / `getOrCreateActive` / `end`, `cycle.create` / `complete` / `interrupt` / `pause` / `resume`, `checkIn.create`, `suggestion.recordDecision`, `dayPlan.setBudget` / `setEnergy`, `preference.set`

Reuse-seam note: the `TaskRepository` / `CycleRepository` / `SessionRepository` contract ([src/lib/data-mode/types.ts:95-161](src/lib/data-mode/types.ts)) is **narrower** than the tRPC surface — it has no suggestion/scoring, check-in, day-plan, recap, or preference methods. So the correct reuse layer is **`createCaller` (full tRPC surface)**, not the repositories.

### B. Auth architecture — cookie-only Neon Auth, no bearer path, no local User table

- **SDK**: `@neondatabase/auth 0.4.1-beta` (Better-Auth underneath), server instance at [src/lib/auth/server.ts:11-17](src/lib/auth/server.ts). Session obtained via `auth.getSession()` in [src/server/api/trpc.ts:33](src/server/api/trpc.ts).
- **Identity is 100% cookie-based.** `auth.getSession()` reads the `__Secure-neon-auth.session_token` cookie from `next/headers` and validates it against `NEON_AUTH_BASE_URL`; it **ignores any passed-in header/bearer**. `createTRPCContext` projects `{ id, email, name }` into `ctx.session.user` ([trpc.ts:36-44](src/server/api/trpc.ts)); `protectedProcedure` throws `UNAUTHORIZED` unless id/email/name are present ([trpc.ts:137-161](src/server/api/trpc.ts)).
- **No existing bearer / API-key path anywhere.** A repo-wide grep for `authorization|bearer|apiKey|token` matched only `SENTRY_AUTH_TOKEN`, the Neon password-reset token, and test fixtures.
- **No `middleware.ts`.** Nothing gates requests upstream — a new MCP route owns its auth end-to-end.
- **No local `User` model.** Identity is owned by the external Neon Auth server; every domain table carries a denormalized `userId String @db.VarChar(255)` with no FK ([prisma/schema.prisma:71,106,186](prisma/schema.prisma)). That `user.id` string is already the stable, DB-wide user key — an `ApiKey` table can bind to it directly with zero id-reconciliation.

Feasibility of the three auth options:

| Option | Exists today | Must build | Verdict |
| --- | --- | --- | --- |
| **API key / PAT** | Stable `user.id` DB key; `flow_state_*` table + migration conventions; middleware slot | `flow_state_api_key` model (hashed key + userId + metadata); `Authorization: Bearer` parsing (none today); issuance UI in Ustawienia; hashing secret in `env.js` | **Recommended v1** — lowest external dependency, fits single-user |
| **OAuth 2.1** | Neon Auth runs an interactive OAuth login flow | Token introspection/verification path (none reads bearer today); client registration + consent; **unverified** whether Neon Auth `0.4.1-beta` can be an AS for third-party machine clients | Defer — heaviest, out-of-repo dependency |
| **Reuse session cookie** | Full flow already works if the cookie is present | A headless client has no cookie jar and cannot run the interactive login; cookie is `__Secure`/HttpOnly with no programmatic mint | **Not viable** for machine clients |

### C. Runtime / deployment surface — where the MCP route lives, and its constraints

- **Reference pattern**: the tRPC route handler [src/app/api/trpc/[trpc]/route.ts:1-34](src/app/api/trpc/[trpc]/route.ts) — one `const handler = (req: NextRequest) => …` returning a `Response`, exported per verb (`export { handler as GET, handler as POST }`). The MCP route follows the same shape at `src/app/api/mcp/route.ts` (path `/api/mcp`).
- **Only 3 route handlers exist today**: `/api/trpc/[trpc]`, `/api/auth/[...path]` (two-line delegation `export const { GET, POST } = auth.handler()`), `/api/health` (`force-dynamic`). **All run on the default Node.js runtime** — no `export const runtime` anywhere in `src`. Keep MCP on Node (Prisma 7 + `@prisma/adapter-neon` + Neon serverless driver are Node-oriented); do **not** set edge.
- **Stack versions**: `next ^16.2.6`, `@trpc/* ^11.17.0`, `@prisma/client ^7.8.0`, `zod ^4.4.3`, `superjson ^2.2.6`, `@neondatabase/auth 0.4.1-beta`. **No MCP dependency present** — `mcp-handler` (and transitively `@modelcontextprotocol/sdk`) is a net-new install.
- **Vercel constraints** (context/foundation/infrastructure.md): **10s function timeout on Hobby** (Pro raises it); Fluid Compute; Neon serverless HTTP driver (stateless, ~300-500ms cold start); deploy `fra1`/`cdg1` near Neon `eu-central-1`. **No `vercel.json`, no `next.config` `experimental`/`serverExternalPackages`** today — a `serverExternalPackages` entry may be needed if Prisma bundling complains.
- **Config surfaces to touch**: add new env vars (API-key hashing secret, and MCP is authenticated-only) to the Zod contract in [src/env.js:9-48](src/env.js) *and* its `runtimeEnv` map — do not read `process.env` ad hoc.

### D. External MCP landscape (web research, July 2026)

- **`mcp-handler`** (Vercel, official) mounts an MCP server as a Next.js App Router route (`createMcpHandler`, exports GET+POST), supports **Streamable HTTP + SSE**, needs **Redis only for optional SSE resumability** (not for stateless), requires **Next.js 13+/Node 18+** (FlowState 16 ✓). Tools registered with `server.registerTool()` + **Zod** schemas — the same schemas the routers already define in `src/lib/domain/*`.
- **Transport**: Streamable HTTP replaced SSE in the March 2025 spec; **stateless mode** ("fresh instance per request") is the recommended shape for serverless (Vercel/Lambda) and the only one compatible with the 10s cap.
- **Auth**: `withMcpAuth(handler, verifyToken, { required, requiredScopes, resourceMetadataPath })` where `verifyToken(req, bearerToken) => Promise<AuthInfo | undefined>`; `AuthInfo` = `{ token, scopes, clientId, extra }`, and the verifier can accept an arbitrary PAT (docs example matches on a token prefix). `authInfo` is then available in tool handlers via `extra.authInfo`. The Nov-2025 spec formally wants OAuth 2.1 + PKCE with the MCP server as a *resource server*, chosen because MCP servers typically serve many users/clients — a weaker fit for a single-user productivity app.
- **tRPC→MCP bridges** (`trpc-mcp`, `trpc-to-mcp`) exist but are immature (mostly stdio, not Streamable HTTP). **Do not depend on a bridge** — hand-write a curated set of MCP tools that call `createCaller`; this keeps tool names/descriptions agent-friendly and the exposed surface deliberately scoped.

## Code References

- `src/server/api/root.ts:16-25,37` — `appRouter` composition + `createCaller` factory (the reuse seam)
- `src/server/api/trpc.ts:28-54,137-161` — `createTRPCContext` (cookie-based `auth.getSession()`) + `protectedProcedure`
- `src/app/api/trpc/[trpc]/route.ts:1-34` — reference route-handler pattern for the new `/api/mcp` route
- `src/app/api/auth/[...path]/route.ts` — alternative "SDK ships its own handler factory" delegation pattern
- `src/lib/auth/server.ts:11-17` — Neon Auth server instance
- `src/lib/data-mode/types.ts:95-161` — repository contract (narrower than tRPC; not the reuse layer)
- `prisma/schema.prisma:67-221` — all `flow_state_*` domain models; `userId String @db.VarChar(255)` is the stable user key; no local User table
- `src/env.js:9-48,68-82` — env contract to extend for new secrets
- `src/lib/domain/*` — Zod-backed enums (`workType`, `energyLevel`, `commitmentHorizon`, `cycleKind`) to reuse in MCP tool input schemas
- `context/foundation/infrastructure.md` — Vercel 10s Hobby timeout, Node runtime, region

## Architecture Insights

- **`createCaller` is the correct integration layer.** Build a synthetic context `{ db, session: { user: { id, email, name } }, headers }` from the resolved API key and call `appRouter.createCaller(ctx)`. This reuses *all* logic — including scoring/suggestion and recap that have no repository counterpart — and inherits every `userId` filter and ownership check for free. The MCP route must bypass `createTRPCContext` (which resolves identity from cookies) and inject the userId directly.
- **MCP is authenticated-only.** The guest data-mode path is browser-localStorage; it has no meaning for a headless machine client. MCP always uses the server/authenticated repositories via `createCaller`.
- **Keep agents out of the wedge.** Cycle-control writes (`cycle.create/complete/pause/resume/interrupt`, `checkIn.create`, `session.end`) drive the F-07 transition conductor and `use-pomodoro-cycle` — the highest-blast-radius files in the repo (per CLAUDE.md and lessons "Test every wedge transition"). Excluding them from v1 both respects the "user drives the timer / always overrides" wedge principle and avoids the fragility of agent-driven timer control under a 10s serverless cap.
- **Statelessness is mandatory.** Serverless functions share no memory across invocations, and long-open SSE dies at the Hobby timeout. Use stateless Streamable HTTP (JSON-RPC request/response per POST); any session state lives in the DB, never module scope.
- **Follow the existing conventions**: new table `@@map("flow_state_api_key")`, migrations via `pnpm db:migrate` (never hand-written SQL), new env vars through `src/env.js` Zod, new router work registered in `root.ts` if any tRPC additions are needed.

## Historical Context (from prior changes)

- **F-15 `platform-refactor-batch`** (archived `context/archive/2026-07-18-platform-refactor-batch/`) — the immediate prerequisite; hardened the timer hub + data-mode layer (ACL verify, sign-in schema, guest merge, auth smoke, Sentry wedge). The auth/data-mode surfaces an MCP server sits on were recently reviewed there.
- **S-45 `ui-refactor`** (archived `context/archive/2026-07-04-ui-refactor/`) — delivered the 5-section nav including **Ustawienia (Settings)**, the natural home for the API-key issuance UI, and **Plan dnia**, where S-47's delegation proposals will consume this MCP surface.
- **lessons.md L-01/L-02/L-03** — Linear ↔ GitHub sync hazards; relevant only for the status-sync step (this slice's FLO-97 / #191 pair already exists — never create a duplicate).
- **lessons.md "Test every wedge transition"** — reinforces excluding cycle-control from v1; any future write into the wedge needs a dismiss-oracle per gate.
- **lessons.md L-06** — prefer Vitest integration (`createCaller`) over Playwright for logic like this; MCP tools are testable at the caller layer without a browser.

## Open Questions

1. **Neon Auth as OAuth AS?** Does `@neondatabase/auth 0.4.1-beta` expose an OAuth authorization-server endpoint (dynamic client registration / client-credentials / PKCE for non-browser clients)? Blocks any future OAuth 2.1 path; not needed for the PAT v1. Verify against Neon Auth docs before ever choosing option (b).
2. **Key model & hashing**: store a SHA-256 hash + a lookup prefix, or bcrypt/argon2? Prefix scheme for O(1) lookup vs scanning. One key or many per user?
3. **Scopes in v1?** A simple `read` vs `write` scope split on the key (enforced via `requiredScopes` / per-tool checks) vs a single all-or-nothing key. Recommend read/write split so a read-only agent can be handed a safe key.
4. **Rate limiting / abuse** on a public authenticated endpoint (single-user, but internet-reachable). Vercel firewall vs in-app throttle — likely out of v1 scope but note it.
5. **Pro vs Hobby**: confirm the deploy tier — if Hobby, the 10s cap hard-forbids long streams and constrains `maxDuration`. Set `export const maxDuration` explicitly.
6. **v1 write depth**: confirm S-47 only needs task read/write + context reads (it does — delegation is a task-level concern), so cycle-control exclusion doesn't block the downstream slice.
7. **Testing/verification**: MCP Inspector for manual smoke; integration tests at the `createCaller` + `verifyToken` layer (per L-06). Add a per-user isolation test for the API-key auth path mirroring the existing `*-isolation.test.ts` pattern.

## Related Research

- No prior `research.md` exists for this change (first pass).
- Adjacent: `context/foundation/infrastructure.md` (Vercel platform decision) is the authority for runtime limits cited above.
