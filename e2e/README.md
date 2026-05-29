# E2E Tests (Playwright)

End-to-end tests run against the real app with a real authenticated user via Neon Auth.

## Prerequisites

1. A valid `.env` with real Neon Auth values (`DATABASE_URL`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`).
2. E2E test user credentials in `.env`:

```env
E2E_TEST_EMAIL="your-test-user@example.com"
E2E_TEST_PASSWORD="min-8-chars-password"
E2E_TEST_NAME="E2E Test User"
```

3. Chromium browser installed:

```bash
pnpm exec playwright install chromium --with-deps
```

## Running Tests

```bash
# Run all e2e tests (builds app, starts on port 3001 with E2E timer flags)
pnpm test:e2e

# Pomodoro flow only
pnpm exec playwright test e2e/pomodoro-cycle.spec.ts

# Run only the auth setup (useful for debugging auth issues)
pnpm exec playwright test --project=auth-setup

# Show HTML report after a run
pnpm exec playwright show-report
```

## How Auth Works

1. **Global setup** (`global.setup.ts`): Provisions the shared test user via `POST /api/auth/sign-up/email`. Idempotent — handles "already exists" gracefully.
2. **Auth setup project** (`auth.setup.ts`): Signs in via `POST /api/auth/sign-in/email` and saves cookies to `playwright/.auth/user.json`.
3. **Browser tests** (e.g., `smoke.spec.ts`): Start with the saved `storageState` — already authenticated, no login UI needed.

## Per-Test User Isolation

For tests that need isolated users (to avoid shared state conflicts), use the helpers:

```typescript
import { createTestUser, signInAsUser } from "./helpers/user";

test("isolated user test", async ({ request, browser }) => {
  const user = await createTestUser(request);
  const state = await signInAsUser(request, user);
  const context = await browser.newContext({ storageState: state });
  const page = await context.newPage();
  // ... test with isolated user
});
```

## File Structure

```text
e2e/
├── README.md           # This file
├── global.setup.ts     # Test user provisioning (runs once before all tests)
├── auth.setup.ts       # Sign-in + storageState (runs before browser tests)
├── smoke.spec.ts       # Smoke test proving the pipeline works
├── pomodoro-cycle.spec.ts  # S-01: focus → start → clock → overlay → complete
└── helpers/
    └── user.ts         # Per-test user creation/sign-in utilities
```

## Notes

- Tests run against `http://localhost:3001` by default (`E2E_PORT` overrides). Playwright runs `pnpm build && next start` with `NEXT_PUBLIC_E2E_MAIN_THREAD_TIMER=1` so `page.clock` advances the countdown (Web Workers are not clock-mocked).
- Pomodoro specs reset stray cycles in `beforeEach` (interrupt / dismiss overlay) so **Focus** is not disabled by a leftover `RUNNING` cycle.
- The `__Secure-` cookie constraint is sidestepped by using `APIRequestContext` for sign-in (not a browser).
- `playwright/.auth/` is gitignored — auth state is regenerated on each run.
- Vitest (`pnpm test`) and Playwright (`pnpm test:e2e`) are fully isolated — different configs, different directories, different scripts.
