# E2E Tests (Playwright)

End-to-end tests run against the real app with worker-scoped auth via Neon Auth.

## Prerequisites

1. A valid `.env` with real Neon values (one-time setup — not per test run):

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

## Environment variables

| Variable | Default | Set by | Purpose |
|----------|---------|--------|---------|
| *(Neon secrets above)* | — | you (`.env`/`.env.local`) | App + auth; loaded by Playwright via dotenv |
| `CI` | unset | you / `ci.yml` | **Reporter only** (`list` vs `html`) + `forbidOnly`; does not change server mode or workers |
| `GITHUB_ACTIONS` | unset | GitHub automatically | Prod server (`next start`), no reuse |
| `E2E_WORKERS` | `4` | `ci.yml` sets `"4"`; override locally | Parallel workers (max 4, auth pool size) |
| `E2E_PORT` | `3001` | optional | App URL for tests |
| `E2E_REUSE_SERVER` | unset | optional, local only | Reuse manual `next dev` on `E2E_PORT` (blocked on GHA) |
| `E2E_PRODUCTION_SERVER` | unset | optional, **local only** | `build && next start` (GHA uses `GITHUB_ACTIONS` instead) |
| `NEXT_PUBLIC_E2E_MAIN_THREAD_TIMER` | `1` on dev | Playwright `webServer.env` (dev) or `ci.yml` + build (GHA) | Main-thread timer for stable Playwright clocks |

You do **not** need to export E2E flags manually for a normal local run — only Neon secrets in `.env`.

## Running Tests

```bash
# Belt (CI merge gate — 12 tests, --grep-invert @skip-belt)
set CI=true && pnpm test:e2e:belt

# Accessibility wedge scan (CI step after belt)
set CI=true && pnpm test:e2e:a11y

# Full catalog (ad-hoc local / pre-release; includes @skip-belt tests)
set CI=true && pnpm test:e2e

# Reuse your own dev server (fastest iteration — start once, run specs many times)
set NEXT_PUBLIC_E2E_MAIN_THREAD_TIMER=1
pnpm exec next dev --turbo -p 3001
# other terminal:
set CI=true && set E2E_REUSE_SERVER=1 && pnpm test:e2e

# Production parity locally (slow — full build; GHA does this automatically)
set CI=true && set E2E_PRODUCTION_SERVER=1 && pnpm test:e2e

# Single spec (seed exemplar)
set CI=true && pnpm exec playwright test e2e/seed.spec.ts

# Reduce parallelism if Neon Auth returns 429 (default is 4 workers)
set E2E_WORKERS=1 && set CI=true && pnpm test:e2e

# Show HTML report after a run (omit CI=true)
pnpm exec playwright show-report
```

## How Auth Works

1. **`e2e/global-setup.ts`** creates 4 Neon Auth users once per run and saves `storageState` to `e2e/.auth/worker-{0..3}.json`.
2. **`e2e/fixtures.ts`** assigns each worker a slot from that pool (no per-test sign-up UI).
3. **`guest-*.spec.ts`** runs in the `guest-chromium` project without auth.

See `AGENTS.md` and `context/foundation/test-plan.md` §6.3 for the full cookbook.

## Account recovery (S-07)

`e2e/account-recovery.spec.ts` covers initiation only: the sign-in "Forgot password?" link, the forgot-password form success state, and the `POST /api/auth/request-password-reset` API contract. It does **not** assert email delivery or the full reset flow (email link → token → new password → sign-in). Complete that round-trip manually in dev using a real inbox; see `context/changes/account-recovery-flow/plan.md` § Manual Testing Steps.

## Seed Exemplar

**`e2e/seed.spec.ts`** is the canonical template for new E2E specs (Risk #3 / #7 exemplars). Model new tests on this file — provenance header, fixture auth, helpers, business-outcome assertions. Risk #1 auth reload is covered by Vitest hook + integration tests; guest reload is in `guest-trial.spec.ts`.

## Belt vs full catalog

| Command | Tests | When |
|---------|------:|------|
| `pnpm test:e2e:belt` | 12 | CI merge gate; PR/push to `main` |
| `pnpm test:e2e` | ~27 | Ad-hoc local; optional pre-release manual |

Partial spec files tag non-belt cases `@skip-belt`; the belt script uses `--grep-invert @skip-belt`. Inventory: `context/foundation/test-plan.md` §6.3 `#### Belt merge gate`.

## File Structure

```text
e2e/
├── README.md                 # This file
├── env.ts                    # Shared E2E env helpers (playwright.config + global-setup)
├── global-setup.ts           # Auth pool (4 users) + server readiness wait
├── seed.spec.ts              # Generation exemplar (/10x-e2e quality lever)
├── fixtures.ts               # Worker-scoped storageState fixture
├── smoke.spec.ts             # Pipeline sanity (infra smoke)
├── pomodoro-cycle.spec.ts    # S-01: focus → start → clock → overlay → complete
├── guest-trial.spec.ts       # Risk #1: guest reload (guest-chromium project)
├── mid-cycle-last-task.spec.ts
├── mindful-session-wind-down.spec.ts
├── DELIBERATE-BREAK.md       # One-time VERIFY matrix (/10x-e2e)
└── helpers/
    ├── idle-cycle.ts         # Dismiss overlays / interrupt before tests
    ├── work-cycle.ts         # setWorkDurationSec + startFocusedWorkCycle
    ├── seed-scenario.ts      # tRPC API seed (wind-down fatigue setup)
    ├── check-in.ts
    └── user.ts               # createTestUser / postAuthWithRetry utilities
```

## CI

GitHub Actions job `e2e` runs `pnpm test:e2e:belt` after `pnpm build`, with `E2E_WORKERS=4`, `NEXT_PUBLIC_E2E_MAIN_THREAD_TIMER=1`, and Neon secrets from repository settings.

Required repository secrets: `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`. Use a Neon **dev branch** — never production credentials in public forks.

## Notes

- Tests run against `http://localhost:3001` by default (`E2E_PORT` overrides).
- **Local:** Playwright starts `next dev --turbo` with `NEXT_PUBLIC_E2E_MAIN_THREAD_TIMER=1` injected via `webServer.env`.
- **CI (GitHub Actions):** separate build step + `next start`; timer flag baked at build time via job env.
- `page.clock` advances the countdown in specs that use it (Web Workers are not clock-mocked in e2e).
- Fake clock before start: UI cycle starts via `clickStartCycle` / `startFocusedWorkCycle` install Playwright fake timers **before** the Start Cycle click, so E2E client timer mode (`NEXT_PUBLIC_E2E_MAIN_THREAD_TIMER=1`) cannot expire a sub-second cycle on the real wall clock. For API-seeded RUNNING cycles, call `ensureFakeClock` before `advanceClockThroughFast*` (see `mindful-session-wind-down` / `seed-scenario`). Do not start sub-second work cycles without going through these helpers.
- Pomodoro specs reset stray cycles in `beforeEach` (interrupt / dismiss overlay) so **Focus** is not disabled by a leftover `RUNNING` cycle.
- Short work cycles: fill `work-duration-min` and `work-duration-sec` via `setWorkDurationSec` in `e2e/helpers/work-cycle.ts`.
- Vitest (`pnpm test`) and Playwright (`pnpm test:e2e`) are fully isolated — different configs, directories, and scripts.
