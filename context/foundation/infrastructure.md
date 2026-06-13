---
project: flow-state
version: 2
updated: 2026-06-13
prd_version: 3
researched_at: 2026-05-24
recommended_platform: Vercel
runner_up: Railway
context_type: mvp
tech_stack:
  language: TypeScript
  framework: Next.js 16
  runtime: Node.js
  orm: Prisma 7
---

## Recommendation

**Deploy on Vercel.**

Vercel is the native deployment target for Next.js 16 — zero-config deploys, Fluid Compute (GA since April 2025) for server-like concurrency, and a $0 Hobby tier that comfortably handles 10k–100k monthly requests. The developer's existing Vercel + Neon familiarity eliminates onboarding friction, and the Vercel Marketplace provides integrated Neon Postgres provisioning with automatic `DATABASE_URL` injection. The platform scored Pass on 4/5 agent-friendly criteria (CLI-first, managed/serverless, agent-readable docs, stable deploy API) with a Partial on MCP integration (public beta).

## Platform Comparison

| Platform | CLI-first | Managed/Serverless | Agent-readable docs | Stable deploy API | MCP/Integration | Total |
|---|---|---|---|---|---|---|
| **Vercel** | Pass | Pass | Pass | Pass | Partial | 4.5 |
| **Railway** | Partial | Pass | Pass | Partial | Pass | 4.0 |
| **Cloudflare** | Pass | Pass | Pass | Pass | Pass | 5.0* |
| **Netlify** | Pass | Pass | Pass | Pass | Pass | 5.0** |
| **Fly.io** | Pass | Partial | Partial | Pass | Partial | 3.5 |
| **Render** | Partial | Partial | Pass | Partial | Pass | 3.5 |

\* Cloudflare raw score is highest but penalized by **beta Next.js adapter** — the `@opennextjs/cloudflare` 1.0.0-beta is the only path for Next.js 15 on Workers, introducing significant stability risk for an MVP timeline.

\** Netlify **dropped from shortlist** — no persistent filesystem means the current SQLite/LibSQL setup cannot run there without a full DB migration, and the credit-based pricing model adds unpredictability.

**Soft-weight adjustments applied:**
- Good free tier preference → Vercel ($0 Hobby) and Cloudflare ($0) favored; Railway ($5/mo) acceptable; Render ($14+/mo) and Fly.io (no free tier) penalized.
- Vercel familiarity → strong tie-breaker in Vercel's favor over Railway.
- Single region (Poland) → edge-native not critical; Vercel's `cdg1` (Paris) or `fra1` (Frankfurt) provides ~20-30ms latency to Poland.
- Co-location preferred → Vercel Marketplace (Neon) provides integrated billing and env var injection; Railway has native Postgres.

### Shortlisted Platforms

#### 1. Vercel (Recommended)

Native Next.js platform with zero-config deployment. The Hobby tier ($0) includes 1M function invocations, 100GB bandwidth, and 4 CPU-hours — well beyond MVP needs. Fluid Compute (GA) provides server-like concurrency for tRPC procedures. Vercel Marketplace integrates Neon Postgres with automatic connection string injection. CLI (`vercel deploy`, `vercel rollback`, `vercel logs`) is fully scriptable. Docs available at `vercel.com/docs/llms-full.txt`. The developer's existing Vercel experience eliminates the learning curve.

#### 2. Railway

Full-stack PaaS with co-located Postgres, Redis, and MySQL — one-click provisioning with automatic connection strings. Excellent DX with instant deploys and live log streaming. EU West (Amsterdam) region available. The $5/mo Hobby plan covers compute + database for low-traffic MVPs. Gap vs. Vercel: no CLI rollback command (dashboard-only), slightly higher cost, and less Next.js-specific optimization. The local MCP server is GA and well-integrated with coding assistants.

#### 3. Cloudflare Workers + Pages

Best-in-class agent tooling: GA MCP server, `llms.txt` on every docs page, `wrangler` CLI with full operational coverage. D1 (SQLite-based) with EU jurisdiction would be a natural fit for the current Drizzle/SQLite schema. Free tier is generous (100k requests/day). Critical gap: the `@opennextjs/cloudflare` adapter for Next.js 16 is **beta** — deploying a T3 stack through a beta adapter on a 6-week timeline introduces unacceptable risk of breaking changes and debugging time.

## Anti-Bias Cross-Check: Vercel

### Devil's Advocate — Weaknesses

1. **No native database.** Vercel Postgres was sunset June 2025. "Co-located" Neon is a separate vendor with its own billing, connection limits, and cold-start behavior. The network hop from Vercel functions to Neon adds latency that a truly co-located DB (Railway Postgres, Cloudflare D1) wouldn't have.

2. **10-second function timeout on Hobby.** Any tRPC procedure exceeding 10s is hard-killed with no recovery. The adaptive scoring logic (FR-021) with multiple DB queries could approach this limit as the task list grows. Upgrading to Pro ($20/mo) is the only fix.

3. **Vendor lock-in via framework coupling.** Vercel owns Next.js. ISR, Server Actions, and middleware are optimized for Vercel first. Migration to another platform means potentially rewriting framework-specific features or accepting degraded behavior.

4. **SQLite → Postgres migration required before first deploy.** The current `@libsql/client` + SQLite setup won't run on Vercel's serverless functions. This is a prerequisite task: new Drizzle schema (pgTable), new driver (`@neondatabase/serverless`), new migration files, connection string management.

5. **Hobby plan preview deploys are unprotected.** Anyone with the preview URL can access your staging app — no password protection available without Pro. Test data and in-progress features are publicly visible.

### Pre-Mortem — How This Could Fail

The developer deployed FlowState to Vercel Hobby with Neon Postgres via Marketplace. The first month was smooth — git push, auto-deploy, done. By month three, the adaptive scoring logic grew complex enough that some tRPC calls hit the 10-second timeout during peak usage. The fix required splitting procedures into smaller chunks, adding client-side orchestration, and losing the clean single-request pattern tRPC provides. Meanwhile, Neon's free tier connection limit started dropping requests during the Pomodoro timer's periodic state-sync calls — each browser tab held a connection pool. The developer added connection pooling via Neon's serverless driver, but that introduced cold-start latency on the DB side. Preview deploys leaked user test data because there's no auth gate on Hobby previews. The real disaster: when Next.js 16 shipped with breaking changes to Server Actions, Vercel's auto-update pressure (framework warnings in dashboard, deprecation notices) forced an upgrade mid-feature, consuming a full weekend of the 6-week timeline on framework migration instead of product work.

### Unknown Unknowns

- **Neon serverless driver cold starts.** The first request after idle hits Neon's compute wake-up (~300-500ms). For a Pomodoro app where users return after 25-minute breaks, every session resumption pays this penalty.
- **Vercel's build cache is region-locked.** Deploying from Poland but build cache defaults to US (`iad1`). First builds after cache expiry are slower. Cache region isn't configurable on Hobby.
- **`NEXT_PUBLIC_` env vars are baked at build time.** Different values per preview deploy (e.g., different Neon branches) require Vercel's branch-specific environment variable overrides — functional but not obvious from docs.
- **Vercel Analytics and Speed Insights are separate paid add-ons.** The "free" platform doesn't include observability — you'll need external tools (Sentry, PostHog) or pay extra.
- **Function cold starts on Hobby are real.** Fluid Compute helps but doesn't eliminate cold starts for infrequently-hit routes. A tRPC router with many procedures means many function entry points, each with independent cold-start behavior.

## Operational Story

- **Preview deploys**: Every push to a non-production branch gets an automatic preview URL (`<branch>-<project>.vercel.app`). There is password protection on Hobby — URLs are publicly accessible but password protected. PR comments show the preview link automatically when GitHub integration is connected.
- **Secrets**: Environment variables live in Vercel's project settings (encrypted at rest). Scoped per environment (Production / Preview / Development). Neon's `DATABASE_URL` is injected automatically via Marketplace integration. Rotation: update in Vercel dashboard → redeploy triggers automatically.
- **Rollback**: `vercel rollback <deployment-url>` — instant, reverts to a previous successful deployment. Typical time-to-revert: <30 seconds. Caveat: DB migrations don't roll back automatically — if a deploy included a schema change, the rollback serves old code against new schema.
- **Approval**: Human-required: promote to production (first time), delete project, change billing plan, rotate integration tokens. Agent-safe: deploy to preview, tail logs, read deployment status, trigger redeploy.
- **Logs**: `vercel logs <deployment-url>` streams request logs. `vercel logs <deployment-url> --follow` for live tail. Runtime logs visible in Vercel dashboard under Functions tab. No structured JSON export on Hobby — Pro adds log drains to external services.

## Risk Register

| Risk | Source | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| tRPC procedures hit 10s timeout on Hobby | Devil's advocate | M | H | Keep procedures lean; split complex scoring into multiple calls; monitor execution time; budget for Pro upgrade ($20/mo) if needed |
| Neon cold-start latency after 25-min Pomodoro idle | Unknown unknowns | H | L | Use Neon's serverless driver with connection pooling; accept ~300ms first-request penalty (acceptable for non-real-time app) |
| ~~SQLite → Postgres migration~~ | Devil's advocate | — | — | **Resolved.** Migrated to Prisma 7 + Neon Postgres (May 2026). |
| Preview deploys expose test data publicly | Devil's advocate | L | M | Use seed data only in preview; never put real user data in preview branches; consider Vercel Authentication add-on if sensitive |
| Next.js major version upgrade pressure mid-timeline | Pre-mortem | L | H | Already upgraded to Next.js 16. Pin to ^16.x; test future upgrades in a separate branch |
| Neon free tier connection limits under concurrent tabs | Pre-mortem | L | M | Use Neon's serverless HTTP driver (stateless, no connection pooling needed); limit concurrent DB calls per request |
| Build cache region mismatch (US cache, PL developer) | Unknown unknowns | M | L | Accept slightly slower first builds; incremental builds are fast regardless of cache region |

## Getting Started

1. **Install Vercel CLI**: `pnpm add -g vercel`

2. **Link project to Vercel**: Run `vercel link` in the project root. Follow prompts to connect to your Vercel account and create a new project.

3. **Provision Neon Postgres via Marketplace**: In the Vercel dashboard → Storage tab → Add Database → select Neon. Choose `eu-central-1` (Frankfurt) as the region. The `DATABASE_URL` and `DATABASE_URL_UNPOOLED` env vars are injected automatically.

4. **Database schema**: The project uses Prisma 7 with `@prisma/adapter-neon`. Schema is defined in `prisma/schema.prisma`. Run `pnpm prisma migrate dev` for local development migrations. The Vercel build runs `prisma generate` only (no migrations at build time — run migrations separately via `pnpm db:migrate:prod`).

5. **Deploy**: `vercel --prod` for production, or just push to `main` with GitHub integration enabled (auto-deploy-on-merge per your CI config).

## Out of Scope

The following were not evaluated in this research:
- Docker image configuration
- CI/CD pipeline setup (GitHub Actions auto-deploy is assumed per tech-stack.md)
- Production-scale architecture (multi-region, HA, DR)
