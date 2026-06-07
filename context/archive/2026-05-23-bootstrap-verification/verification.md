---
bootstrapped_at: 2026-05-23T19:53:00Z
starter_id: t3
starter_name: "T3 Stack"
project_name: flow-state
language_family: js
package_manager: npm
cwd_strategy: subdir-then-move
bootstrapper_confidence: verified
phase_3_status: ok
audit_command: "npm audit --json"
---

## Hand-off

```yaml
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
```

### Why this stack

Solo builder shipping a Pomodoro + adaptive-focus web-app with auth on a 6-week after-hours timeline. T3 (Next.js + tRPC + Drizzle + Neon Auth + Tailwind) delivers type-safe contracts from database to UI with zero assembly for auth and data layer — the three load-bearing factors are verified bootstrapper confidence, all four agent-friendly gates passing, and batteries-included auth matching the PRD's FR-001 through FR-003a. Vercel is the native deployment target; GitHub Actions with auto-deploy-on-merge is the default CI shape. Monorepo structure (Turborepo + pnpm) layers on top for repository clarity without changing the starter's core scaffold.

## Pre-scaffold verification

| Signal | Value | Severity | Notes |
| --- | --- | --- | --- |
| npm package | create-t3-app v7.40.0 published 2025-11-05 | stale | resolved from cmd_template |
| GitHub repo | t3-oss/create-t3-app last pushed 2025-12-13 | aged | from card docs_url (create.t3.gg) |

## Scaffold log

**Resolved invocation**: `npx create-t3-app@latest .bootstrap-scaffold --CI --tailwind --trpc --drizzle --appRouter --biome --dbProvider sqlite`
**Strategy**: subdir-then-move
**Exit code**: 0
**Files moved**: 14 (node_modules, public, src, .env, .env.example, biome.jsonc, drizzle.config.ts, next-env.d.ts, next.config.js, package-lock.json, package.json, postcss.config.js, README.md, tsconfig.json)
**Conflicts (.scaffold siblings)**: none
**.gitignore handling**: append-merged (T3-specific entries de-duped and appended with `# from t3` separator)
**.bootstrap-scaffold cleanup**: deleted

## Post-scaffold audit

**Tool**: `npm audit --json`
**Summary**: 0 CRITICAL, 1 HIGH, 6 MODERATE, 0 LOW
**Direct vs transitive**: 0/1/2/0 direct of total 0/1/6/0

#### HIGH findings

- **drizzle-orm** (direct) — SQL injection via improperly escaped SQL identifiers (GHSA-gpj5-g38j-94v9, CVSS 7.5). Affects versions <0.45.2. Fix available: upgrade to drizzle-orm@0.45.2.

#### MODERATE findings

- **drizzle-kit** (direct) — affected via transitive dependency on esbuild <=0.24.2 (GHSA-67mh-4wv8-2f99, dev server CORS bypass). Fix available: upgrade drizzle-kit to 0.31.10 (semver-major).
- **next** (direct) — affected via transitive dependency on postcss <8.5.10 (GHSA-qx2v-qp2m-jg93, XSS via unescaped style tag in CSS stringify). Fix available: upgrade next (semver-major downgrade to 9.3.3 not viable; await upstream patch).
- **esbuild** (transitive) — dev server allows any website to send requests and read responses (GHSA-67mh-4wv8-2f99, CVSS 5.3). Affects <=0.24.2. Transitive via drizzle-kit.
- **@esbuild-kit/core-utils** (transitive) — affected via esbuild. Transitive via drizzle-kit.
- **@esbuild-kit/esm-loader** (transitive) — affected via @esbuild-kit/core-utils. Transitive via drizzle-kit.
- **postcss** (transitive) — XSS via unescaped </style> in CSS stringify output (GHSA-qx2v-qp2m-jg93, CVSS 6.1). Affects <8.5.10. Transitive via next.

#### LOW / INFO findings

None.

## Hints recorded but not acted on

| Hint | Value |
| --- | --- |
| bootstrapper_confidence | verified |
| quality_override | false |
| path_taken | custom |
| self_check_answers | typed: true, from_official_starter: true, conventions: true, docs_current: true, can_judge_agent: true |
| team_size | solo |
| deployment_target | vercel |
| ci_provider | github-actions |
| ci_default_flow | auto-deploy-on-merge |
| has_auth | true |
| has_payments | false |
| has_realtime | false |
| has_ai | false |
| has_background_jobs | false |

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:
- `git init` (if you have not already) to start your own repo history.
- Review any `.scaffold` siblings the conflict policy created and decide which version of each file to keep.
- Address audit findings per your project's risk tolerance — the full breakdown is in this log.
