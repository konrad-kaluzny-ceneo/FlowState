# Playwright E2E Test Infrastructure — Plan Brief

> Full plan: `context/changes/e2e-test-infra/plan.md`
> Research: `context/changes/e2e-test-infra/research.md`

## What & Why

Install Playwright with an authenticated test-user flow against Neon Auth so that `pnpm test:e2e` can verify UI-facing behavior in a real browser. This foundation slice (F-02) gates every UI-facing slice in the roadmap (S-01 through S-07) — without it, no browser-level verification is possible and NFRs like crash/refresh recovery, 200ms acknowledgement, and timer drift cannot be validated.

## Starting Point

No Playwright exists in the project. 14 Vitest unit/integration tests exist but none hit a real HTTP server or real Neon Auth. Auth is fully wired (sign-in, sign-up, session resolution via `proxy.ts` middleware) but has never been exercised end-to-end in a browser test. The `__Secure-` cookie prefix on Neon Auth's session token means browser-level cookie acceptance fails over plain HTTP — but API-level sign-in + `storageState` injection sidesteps this entirely.

## Desired End State

Running `pnpm test:e2e` provisions a test user (idempotent), signs in via API, saves authenticated state, opens Chromium, navigates to `/`, and asserts the authenticated app shell renders. The pipeline is self-contained — no manual user creation, no HTTPS setup, no CI dependency.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Auth strategy | API sign-in + `storageState` injection | Sidesteps `__Secure-` cookie constraint without HTTPS; matches Playwright's official recipe | Research |
| Test user management | Shared user via global setup + per-test helpers for isolation | Balances speed (shared user for most tests) with correctness (isolated users when needed) | Plan |
| Browser scope | Chromium only | Fastest feedback, smallest footprint; multi-browser added when test count justifies it | Plan |
| Test directory | `e2e/` at project root | Clear separation from Vitest tests in `src/`; Playwright convention | Plan |
| CI story | Local + agent only (no workflow file) | Respects `main_goal: speed`; script works for agents today; CI addable in 5 minutes later | Plan |
| webServer | `pnpm dev` with `reuseExistingServer: true` | Fast local iteration; production build documented for future CI | Research |

## Scope

**In scope:**
- Install `@playwright/test` + Chromium
- `playwright.config.ts` with auth-setup project + chromium project
- Global setup: idempotent test user provisioning via sign-up API
- Auth setup: API sign-in → `storageState` persistence
- Per-test user creation/deletion helpers
- One smoke test: authenticated page load + heading + task list assertion
- `pnpm test:e2e` script
- `.gitignore` entries for Playwright artifacts
- Documentation (README section)

**Out of scope:**
- GitHub Actions CI workflow
- Multi-browser testing (Firefox, WebKit)
- HTTPS dev server setup
- Task CRUD in smoke test
- Neon Management API integration
- Test database branching

## Architecture / Approach

```text
pnpm test:e2e
  → globalSetup: POST /api/auth/sign-up/email (idempotent user provisioning)
  → auth-setup project: POST /api/auth/sign-in/email → storageState saved
  → chromium project: browser loads storageState → navigates to / → asserts content
```

Playwright's "setup project + `storageState` + `dependencies`" pattern. Auth happens at the API level (no browser involved), cookies are injected into the browser context via `storageState`. The dev server is started by Playwright's `webServer` config or reused if already running.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Playwright Installation & Config | Working Playwright runner with config, scripts, gitignore | `strictDepBuilds` blocking browser install (mitigated: explicit `pnpm exec` step) |
| 2. Auth Setup Infrastructure | Global setup + auth setup project + per-test helpers | Sign-up API rejecting programmatic requests or cookie format changing |
| 3. Smoke Test & Verification | One passing e2e test proving the full pipeline | `storageState` cookies not being accepted by browser context |

**Prerequisites:** Valid `.env` with real `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`, `DATABASE_URL` values. Three new env vars for test user credentials.
**Estimated effort:** ~1 session across 3 phases (each phase is 15-30 minutes of implementation).

## Open Risks & Assumptions

- Assumes `APIRequestContext.post('/api/auth/sign-in/email')` returns `Set-Cookie` headers that `storageState` captures correctly — must be empirically verified in Phase 2.
- Assumes Neon Auth `0.4.1-beta` doesn't change its cookie format between now and implementation.
- `proxy.ts` Turbopack bugs ([#93328](https://github.com/vercel/next.js/issues/93328), [#92921](https://github.com/vercel/next.js/issues/92921)) may surface when running `pnpm dev` for e2e — fallback is `pnpm preview` (build + start).

## Success Criteria (Summary)

- `pnpm test:e2e` passes from a cold start (no running server, no pre-existing auth state)
- `pnpm test` (Vitest) remains unaffected
- An agent can run `pnpm test:e2e` after any UI change to verify the app still loads authenticated
