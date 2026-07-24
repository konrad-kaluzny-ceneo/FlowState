# MCP Server for AI Agents — Plan Brief

> Full plan: `context/changes/mcp-server-for-agents/plan.md`
> Research: `context/changes/mcp-server-for-agents/research.md`

## What & Why

Expose an MCP server at `/api/mcp` so external AI agents (Cursor, Claude, Copilot) can read and write a user's FlowState tasks and read their session/day state. It's a thin adapter over the existing tRPC surface — every tool delegates to `appRouter.createCaller`, reusing all logic and per-user isolation. This is the head of Stream U and directly unblocks S-47 (delegation proposals in Plan dnia).

## Starting Point

FlowState authenticates 100% via cookie-based Neon Auth — no bearer/API-key path, no `middleware.ts`, and no local User table (the Neon Auth `user.id` string is the DB-wide key). All 8 tRPC routers are `protectedProcedure` and user-scoped, with `createCaller` exported as the server-side seam. Settings (Ustawienia) exists from S-45. Deployed on Vercel (Hobby = 10s function cap).

## Desired End State

From Settings, a user mints named API keys (each `READ` or `READ_WRITE`), sees each secret once, and can revoke them. An MCP client configured with a key connects to `/api/mcp` and can list/create/update/complete that user's tasks plus read session/cycle/day state and the app's scored next-task suggestion — all user-scoped, with writes refused for read-only keys.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Transport / hosting | Vercel `mcp-handler`, stateless Streamable HTTP, Node runtime | Official App Router adapter; stateless is the only shape compatible with the 10s Hobby cap | Research |
| Auth mechanism | Personal API key (PAT) via `withMcpAuth` verifier | Cookie reuse impossible for headless clients; OAuth 2.1 is multi-user-oriented and depends on unverified Neon Auth AS support | Research |
| Reuse seam | `appRouter.createCaller(synthetic ctx)` | Reuses all business logic + isolation; repositories are too narrow (no suggestion/recap) | Research |
| Tool surface | Tasks read/write + session/cycle/day read + scored suggestion | Unblocks S-47 with rich context; keeps agents out of the timer | Plan |
| Key scope | `READ` / `READ_WRITE` split, enforced per write tool | Lets an untrusted agent hold a safe read-only key (least privilege) | Plan |
| Hosting tier | Design for Hobby (10s), stateless, explicit `maxDuration` | Safest and best-practice regardless of tier | Plan |
| Key management | Self-serve, multiple named keys, reveal-once, revoke, in Settings | Standard PAT UX — rotate one agent without breaking others | Plan |

## Scope

**In scope:** `flow_state_api_key` table + peppered-hash key primitive; `apiKey` tRPC router (list/create/revoke); Settings key-management panel + i18n; `/api/mcp` endpoint; curated read tools (tasks, session/cycle state, day stats, scored suggestion) + write tools (create/update/complete task) gated to `READ_WRITE`; integration + isolation tests.

**Out of scope:** cycle/timer control, check-in, session start/end, and `recordDecision` writes; hard delete/reorder/archive of tasks via MCP; preference/day-plan writes; OAuth 2.1; rate limiting; guest mode.

## Architecture / Approach

Three bottom-up layers. **(1)** A pure key primitive: key string = `fsk_<tokenId>_<secret>`, DB stores `tokenId` (indexed, public) + `sha256(secret+pepper)` + `scope` + email/name snapshot. **(2)** A `protectedProcedure` `apiKey` router + Settings UI to mint/reveal-once/revoke. **(3)** The MCP route: `withMcpAuth` runs `verifyToken` → resolves key to `{userId, email, name, scope}` → each tool builds a synthetic tRPC context and calls `createCaller`; write tools check scope; tRPC errors map to MCP tool errors.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Auth core | `flow_state_api_key` model + migration + generate/verify utility + env pepper | Key format/lookup must be indexed + constant-time compare |
| 2. Key management | `apiKey` router + Settings panel (named keys, reveal-once, revoke) + isolation test | Reveal-once UX; never persist/log plaintext |
| 3. MCP endpoint | `/api/mcp` stateless server + curated read/write tools + scope gating + error mapping | Synthetic ctx must satisfy `enforceAuth` (id+email+name); stay under 10s |

**Prerequisites:** F-15 + S-45 (both done). New deps: `mcp-handler` / `@modelcontextprotocol/sdk`. New env var `MCP_API_KEY_PEPPER`.
**Estimated effort:** ~3 sessions across 3 phases.

## Open Risks & Assumptions

- The synthetic context must supply `user.email` + `user.name` (not just `id`) or `enforceAuth` rejects it — handled via a snapshot stored on the key row; snapshot can go stale (only affects the unused `name` fallback).
- `get_next_suggestion` needs an active session id; when none is active it returns a graceful "no active session" result rather than creating one.
- Prisma may need `serverExternalPackages` in `next.config.js` if the route bundling complains (currently unset).
- No rate limiting in v1 on a public authenticated endpoint — acceptable for single-user, flagged as follow-up.
- If deployed on Hobby, long/streamed tool responses are impossible — v1 tools are all short request/response, so this is fine.

## Success Criteria (Summary)

- A user can self-serve create/reveal-once/revoke named API keys in Settings, scoped `READ` or `READ_WRITE`.
- An MCP client with a `READ_WRITE` key can list and mutate that user's tasks (visible in the app) and read session/day state + suggestion; a `READ` key is refused writes; a revoked key is refused entirely.
- All access is strictly user-scoped, proven by isolation tests, with no secrets logged.
