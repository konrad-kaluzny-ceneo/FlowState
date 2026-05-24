---
inclusion: manual
---

# Tech Stack Decision

The full tech-stack rationale is at `context/foundation/tech-stack.md`. Reference it with `#File context/foundation/tech-stack.md` when you need:

- Starter selection rationale (T3 stack)
- Authentication provider details (Neon Auth)
- Deployment target reasoning
- CI/CD shape decisions

Key facts (always available via AGENTS.md):
- Stack: Next.js 15, React 19, TypeScript, Drizzle, tRPC, Tailwind CSS
- Auth: Neon Auth (co-located with DB)
- Deploy: Vercel
- CI: GitHub Actions, auto-deploy-on-merge
- Package manager: pnpm (strict isolated)
