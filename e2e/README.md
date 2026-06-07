# E2E Tests (Playwright)

End-to-end tests run against the real app with per-test API authentication via Neon Auth.

## Prerequisites

1. A valid `.env` with real Neon values:

```env
DATABASE_URL="postgresql://..."
DATABASE_URL_UNPOOLED="postgresql://..."
NEON_AUTH_BASE_URL="https://your-project.neonauth.com"
NEON_AUTH_COOKIE_SECRET="your-secret-at-least-32-characters-long"
```

2. Chromium browser installed:

```bash
pnpm exec playwright install chromium --with-deps
```

No shared test-user credentials are required — each authenticated spec creates a fresh user via `e2e/fixtures.ts`.

## Running Tests

```bash
# Local (fast): Playwright starts next dev on port 3001, or reuses one already running
set CI=true && pnpm test:e2e

# Reuse your own dev server (fastest iteration — start once, run specs many times)
set NEXT_PUBLIC_E2E_MAIN_THREAD_TIMER=1
pnpm exec next dev --turbo -p 3001
# other terminal:
set CI=true && set E2E_REUSE_SERVER=1 && pnpm test:e2e

# Production parity (slow — full build, same as CI)
set CI=true && set E2E_PRODUCTION_SERVER=1 && pnpm test:e2e

# Single spec (seed exemplar)
set CI=true && pnpm exec playwright test e2e/seed.spec.ts

# Override worker count (default: 1 in CI for Neon Auth rate limits)
set E2E_WORKERS=1 && set CI=true && pnpm test:e2e

# Show HTML report after a run (omit CI=true)
pnpm exec playwright show-report
```

## How Auth Works

1. **`e2e/fixtures.ts`** extends Playwright's `page` fixture: `createTestUser` + `signInAsUser` via API (`POST /api/auth/sign-up/email`, `POST /api/auth/sign-in/email`).
2. Cookies and localStorage are applied before each test — no sign-in UI, no shared `storageState` file.
3. **`guest-trial.spec.ts`** runs in the `guest-chromium` project without auth.

See `AGENTS.md` § E2E Testing Rules and `context/foundation/test-plan.md` §6.3 for the full cookbook.

## Account recovery (S-07)

`e2e/account-recovery.spec.ts` covers initiation only: the sign-in "Forgot password?" link, the forgot-password form success state, and the `POST /api/auth/request-password-reset` API contract. It does **not** assert email delivery or the full reset flow (email link → token → new password → sign-in). Complete that round-trip manually in dev using a real inbox; see `context/changes/account-recovery-flow/plan.md` § Manual Testing Steps.

## Seed Exemplar

**`e2e/seed.spec.ts`** is the canonical template for new E2E specs (Risk #1 reload flow). Model new tests on this file — provenance header, fixture auth, helpers, business-outcome assertions.

## File Structure

```text
e2e/
├── README.md                 # This file
├── seed.spec.ts              # Generation exemplar (/10x-e2e quality lever)
├── fixtures.ts               # Per-test API auth fixture
├── smoke.spec.ts             # Pipeline sanity (infra smoke)
├── pomodoro-cycle.spec.ts    # S-01: focus → start → clock → overlay → complete
├── persistence-reload.spec.ts  # Risk #1: auth mid-cycle reload
├── guest-trial.spec.ts       # Risk #1: guest reload (guest-chromium project)
├── mid-cycle-completion.spec.ts
├── mid-cycle-last-task.spec.ts
├── DELIBERATE-BREAK.md       # One-time VERIFY matrix (/10x-e2e)
└── helpers/
    ├── idle-cycle.ts         # Dismiss overlays / interrupt before tests
    ├── work-cycle.ts         # setWorkDurationSec + startFocusedWorkCycle
    ├── check-in.ts
    └── user.ts               # createTestUser / signInAsUser utilities
```

## CI

GitHub Actions runs `pnpm check`, `pnpm typecheck`, `pnpm test`, then `CI=true pnpm test:e2e` with production build parity (`GITHUB_ACTIONS` in `playwright.config.ts`).

Required repository secrets: `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`. Use a Neon **dev branch** — never production credentials in public forks.

Set `E2E_WORKERS: "1"` in CI to avoid Neon Auth rate limits on parallel sign-up.

## Notes

- Tests run against `http://localhost:3001` by default (`E2E_PORT` overrides).
- **Local:** `next dev --turbo` with `NEXT_PUBLIC_E2E_MAIN_THREAD_TIMER=1`. Set `E2E_PRODUCTION_SERVER=1` to force `build && next start`.
- **CI (GitHub Actions):** always production build + start.
- `page.clock` advances the countdown in specs that use it (Web Workers are not clock-mocked in e2e).
- Pomodoro specs reset stray cycles in `beforeEach` (interrupt / dismiss overlay) so **Focus** is not disabled by a leftover `RUNNING` cycle.
- Short work cycles: fill `work-duration-min` and `work-duration-sec` via `setWorkDurationSec` in `e2e/helpers/work-cycle.ts`.
- Vitest (`pnpm test`) and Playwright (`pnpm test:e2e`) are fully isolated — different configs, directories, and scripts.
