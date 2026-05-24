---
starter_id: t3
package_manager: pnpm
project_name: flow-state
hints:
  language_family: js
  team_size: solo
  deployment_target: vercel
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: verified
  path_taken: custom
  quality_override: false
  self_check_answers:
    typed: true
    from_official_starter: true
    conventions: true
    docs_current: true
    can_judge_agent: true
  has_auth: true
  auth_provider: neon-auth
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
---

## Why this stack

Solo builder shipping a Pomodoro + adaptive-focus web-app with auth on a 6-week after-hours timeline. T3 (Next.js + tRPC + Drizzle + Tailwind) delivers type-safe contracts from database to UI with zero assembly — the three load-bearing factors are verified bootstrapper confidence, all four agent-friendly gates passing, and a clear path to production auth via Neon Auth (PRD FR-001 through FR-003a). Vercel is the native deployment target; GitHub Actions with auto-deploy-on-merge is the default CI shape. pnpm strict-isolated workspace provides dependency safety without changing the starter's core scaffold.

## Authentication

**Provider: Neon Auth** (https://neon.com/docs/auth/overview)

Neon Auth is the chosen authentication solution for FlowState. It integrates directly with the Neon Postgres database already used for data storage, providing:

- Built-in user management backed by the same Neon infrastructure as the app database
- OAuth social login support (Google, GitHub, etc.) and email/password flows
- Session handling with JWT tokens
- Password reset and account recovery (satisfies FR-003a)
- User data co-located with application data in the same Neon project — no separate auth service to manage

**Rationale over NextAuth/Auth.js:**
- Zero additional infrastructure — auth lives inside the existing Neon project
- Tighter integration with Drizzle schema (user table is a native Postgres table in the same DB)
- Reduces vendor surface: one fewer dependency to maintain, one fewer service to monitor
- Co-location eliminates the network hop between auth verification and user data queries
