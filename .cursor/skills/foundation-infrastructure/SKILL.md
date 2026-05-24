---
name: foundation-infrastructure
description: FlowState hosting and deployment — Vercel + Neon Postgres, preview deploys, rollback, secrets, and risk mitigations. Use when deploying, promoting to production, debugging production or preview, changing Vercel/Neon config, evaluating platform limits, or planning a platform migration.
---

# FlowState Infrastructure

## Platform decision

| Item | Value |
|------|--------|
| Platform | **Vercel** (Hobby, $0) |
| Runner-up | Railway |
| Region | `fra1` (Frankfurt) or `cdg1` (Paris), ~20–30ms to Poland |
| Database | Neon Postgres via Vercel Marketplace (`DATABASE_URL` auto-injected) |
| Rollback | `vercel rollback <deployment-url>` — instant; **DB migrations do not roll back** |

Operational CLI rules live in `AGENTS.md`, `.cursor/rules/vercel.mdc`, and `.cursor/rules/neon.mdc`. Follow those for commands and safety (preview before prod, never echo connection strings).

## Constraints to remember

- **10s function timeout** on Hobby — monitor tRPC procedure duration; split heavy work or budget Pro ($20/mo) if needed.
- **Neon is a separate vendor** — network hop vs co-located DB; use `@neondatabase/serverless` and serverless driver patterns.
- **Preview URLs on Hobby** — no password gate; use seed-only data, not real user data.
- **`NEXT_PUBLIC_*`** — baked at build time; per-branch values need Vercel branch env overrides.
- **Code rollback ≠ schema rollback** — if a deploy ran migrations, rolling back code may leave old code on a new schema.

## Operational quick reference

### Deploy

1. Preview first: `vercel --yes` — verify, then `vercel --prod --yes`.
2. Or push to `main` with GitHub integration (auto-deploy on merge).
3. Env vars: Vercel project settings, scoped Production / Preview / Development. Neon `DATABASE_URL` from Marketplace.

### Debug production

- Logs: `vercel logs <url>` or `vercel logs <url> --follow`
- Dashboard: Functions tab for runtime logs (no structured JSON export on Hobby)
- Never log or echo `DATABASE_URL`

### Rollback

```bash
vercel rollback <deployment-url>
```

Typical revert <30s. If the bad deploy included Drizzle migrations, plan a forward fix or manual schema repair — rollback alone is insufficient.

### Agent-safe vs human-required

| Agent-safe | Human-required |
|------------|----------------|
| Preview deploy, tail logs, read status, redeploy | First production promote, delete project, billing/plan changes, integration token rotation |

## When to read the full research doc

Read [context/foundation/infrastructure.md](context/foundation/infrastructure.md) for:

- Platform comparison matrix and scoring
- Anti-bias cross-check (devil's advocate, pre-mortem, unknown unknowns)
- Full operational story and risk register with mitigations
- Getting started steps (Vercel link, Neon Marketplace, SQLite→Postgres migration checklist)

**Trigger checklist:**

- [ ] First deploy or changing deploy/build config
- [ ] Production incident — logs, rollback, secrets rotation
- [ ] Hitting Hobby limits (timeout, connections, cold starts)
- [ ] Considering migration off Vercel

## First-deploy migration note

Vercel serverless requires Postgres, not LibSQL/SQLite. Before first deploy: `dialect: "postgresql"`, Neon serverless driver, `pgTable` schema, `pnpm db:generate` then `pnpm db:migrate`. Details in the full doc § Getting Started.

## Top risks (mitigations)

| Risk | Mitigation |
|------|------------|
| tRPC >10s on Hobby | Lean procedures; split scoring; monitor duration |
| Neon cold start after idle | Serverless driver; accept ~300ms first hit after breaks |
| Preview data exposure | Seed data only on preview branches |
| Neon connection limits | Serverless HTTP driver; avoid per-tab pooling |
| Next.js upgrade mid-MVP | Pin `^15.5.x`; upgrade after MVP in a separate branch |

For likelihood/impact and full register, see the full doc § Risk Register.
