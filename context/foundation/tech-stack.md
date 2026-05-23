---
starter_id: t3
package_manager: npm
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
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
---

## Why this stack

Solo builder shipping a Pomodoro + adaptive-focus web-app with auth on a 6-week after-hours timeline. T3 (Next.js + tRPC + Drizzle + NextAuth + Tailwind) delivers type-safe contracts from database to UI with zero assembly for auth and data layer — the three load-bearing factors are verified bootstrapper confidence, all four agent-friendly gates passing, and batteries-included auth matching the PRD's FR-001 through FR-003a. Vercel is the native deployment target; GitHub Actions with auto-deploy-on-merge is the default CI shape. Monorepo structure (Turborepo + pnpm) layers on top for repository clarity without changing the starter's core scaffold.
