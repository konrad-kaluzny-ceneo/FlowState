---
inclusion: manual
---

# Infrastructure Decision

The full infrastructure research is at `context/foundation/infrastructure.md`. Reference it with `#File context/foundation/infrastructure.md` when you need:

- Platform comparison matrix (Vercel, Railway, Cloudflare, Netlify, Fly.io, Render)
- Anti-bias cross-check findings (devil's advocate, pre-mortem, unknown unknowns)
- Operational story (preview deploys, secrets, rollback, approval, logs)
- Risk register with mitigations
- Getting started steps for Vercel + Neon deployment

Key facts (always available via AGENTS.md and vercel.md steering):
- Platform: Vercel (Hobby tier)
- Runner-up: Railway
- Region: Frankfurt (fra1) or Paris (cdg1)
- DB: Neon Postgres via Vercel Marketplace
- Rollback: `vercel rollback <url>` (instant, but DB migrations don't auto-rollback)
