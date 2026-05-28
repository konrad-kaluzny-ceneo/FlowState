# Playwright E2E Test Infrastructure Implementation Plan

## Overview

Install Playwright, wire a programmatic authenticated-test-user flow against Neon Auth (beta), and ship one smoke test that signs in, loads the task list, and asserts DOM content. After this plan lands, `pnpm test:e2e` works for agents and humans locally — no CI workflow file in scope.

## Current State Analysis

- **No Playwright** in the project — no config, no `e2e/` directory, no `test:e2e` script.
- **14 existing test files** — all Vitest unit/integration. None hit a real HTTP server or real Neon Auth.
- **Auth surface is HTTP-only** — `POST /api/auth/sign-in/email` and `POST /api/auth/sign-up/email` are the programmatic endpoints (Better Auth engine under `auth.handler()`).
- **`pnpm-workspace.yaml`** has `strictDepBuilds: true` — Playwright browser download handled via explicit `pnpm exec playwright install --with-deps` (no postinstall, no `allowBuilds` change needed).
- **Main page (`/`)** redirects unauthenticated users to `/auth/sign-in`; authenticated view renders `<h1>FlowState</h1>` + `<TaskList />`.
- **`proxy.ts`** excludes `api/auth` from middleware — sign-in/sign-up endpoints are directly reachable without session.

### Key Discoveries:

- `__Secure-neon-auth.session_token` cookie has `Secure: true` — browsers reject it over plain HTTP. Sidestep: use `APIRequestContext` (not a browser) to capture cookies, then inject via `storageState`. Browser never needs to "accept" the cookie from a `Set-Cookie` header.
- `timingMiddleware` in `src/server/api/trpc.ts:107-115` adds 100-500ms random delay in dev mode. E2E tests should run against `pnpm dev` with `reuseExistingServer: true` and budget for this in timeouts.
- `src/env.js` validates `NEON_AUTH_BASE_URL` and `NEON_AUTH_COOKIE_SECRET` — Playwright must run with real env vars (NOT `SKIP_ENV_VALIDATION=1`).
- Sign-up validation: name (1-100 chars), email (valid, max 254), password (8-128 chars) — per `src/app/auth/sign-up/schema.ts`.

## Desired End State

Running `pnpm test:e2e` from the project root:
1. Starts the Next.js dev server (or reuses an already-running one).
2. Provisions a shared test user against real Neon Auth (idempotent — handles "already exists").
3. Signs in via API, saves authenticated `storageState`.
4. Opens Chromium, navigates to `/`, asserts `<h1>FlowState</h1>` and the task list container are visible.
5. Exits with pass/fail status code.

Additionally, test helpers exist for per-test user creation/deletion for future isolation-sensitive scenarios.

### Verification:

- `pnpm test:e2e` passes on a machine with valid `.env` values.
- `pnpm test` (Vitest) still passes — no interference.
- `pnpm typecheck` passes with new files included.
- `pnpm check` (Biome) passes on new files.

## What We're NOT Doing

- No GitHub Actions CI workflow (roadmap: `main_goal: speed`, no CI in MVP scope).
- No multi-browser testing (Chromium only for foundation; Firefox/WebKit added when test count justifies it).
- No HTTPS dev server setup (API sign-in + storageState injection sidesteps the `__Secure-` constraint).
- No task CRUD in the smoke test (that's S-01/S-04 territory).
- No Neon Management API integration for user provisioning (HTTP sign-up is sufficient and portable).
- No test database branching (tests run against the same Neon branch as dev — test user is isolated by `userId`).

## Implementation Approach

Three-phase approach: install & configure → auth infrastructure → smoke test. Each phase is independently verifiable. The auth layer uses Playwright's official "setup project + `storageState` + `dependencies`" pattern with API-level sign-in (Pattern A2 from research).

## Phase 1: Playwright Installation & Configuration

### Overview

Install `@playwright/test`, create the config file, add npm scripts, update `.gitignore`, and verify the bare Playwright runner works (no tests yet).

### Changes Required:

#### 1. Install Playwright

**Intent**: Add `@playwright/test` as a dev dependency and download Chromium browser binary.

**Contract**: `@playwright/test` added to `devDependencies` in `package.json`. Browser installed via `pnpm exec playwright install chromium --with-deps`.

#### 2. Playwright configuration

**File**: `playwright.config.ts`

**Intent**: Configure Playwright with a single Chromium project that depends on an `auth-setup` project, point `testDir` to `e2e/`, configure `webServer` to start the dev server, and set `storageState` path for authenticated tests.

**Contract**: Exports a `PlaywrightTestConfig` with:
- `testDir: './e2e'`
- `webServer: { command: 'pnpm dev', url: 'http://localhost:3000', reuseExistingServer: true }`
- Two projects: `auth-setup` (matches `**/auth.setup.ts`, no `storageState`) and `chromium` (depends on `auth-setup`, uses `storageState: 'playwright/.auth/user.json'`)
- `use.baseURL: 'http://localhost:3000'`
- `retries: 0` (fail fast for foundation)
- `reporter: 'html'`

#### 3. Package.json scripts

**File**: `package.json`

**Intent**: Add `test:e2e` script so agents and humans can run Playwright with a single command.

**Contract**: New script `"test:e2e": "playwright test"` in the `scripts` section.

#### 4. Gitignore entries

**File**: `.gitignore`

**Intent**: Exclude Playwright artifacts (auth state, test results, report, browser binaries) from version control.

**Contract**: Append entries for `playwright/.auth/`, `playwright-report/`, `test-results/`, and `/blob-report/`.

#### 5. E2E directory scaffold

**Intent**: Create the `e2e/` directory with a placeholder to establish the structure.

**Contract**: `e2e/` directory exists at project root.

### Success Criteria:

#### Automated Verification:

- `pnpm install` succeeds with Playwright in devDependencies
- `pnpm exec playwright install chromium --with-deps` completes without error
- `pnpm exec playwright test --list` runs without config errors (reports 0 tests found)
- `pnpm typecheck` passes with `playwright.config.ts` included
- `pnpm check` passes on new/modified files

#### Manual Verification:

- `playwright.config.ts` is readable and matches the intended structure
- `.gitignore` entries are present

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Auth Setup Infrastructure

### Overview

Create the global setup (test user provisioning via sign-up API), the auth setup project file (sign-in via API → `storageState`), environment variable handling for test credentials, and reusable helpers for per-test user creation/deletion.

### Changes Required:

#### 1. Test user environment variables

**File**: `.env.example`

**Intent**: Document the e2e test user credentials as env vars so any developer can configure their own test user.

**Contract**: Add `E2E_TEST_EMAIL`, `E2E_TEST_PASSWORD`, `E2E_TEST_NAME` entries to `.env.example` with placeholder values and a comment block explaining their purpose.

#### 2. Global setup — test user provisioning

**File**: `e2e/global.setup.ts`

**Intent**: Ensure the shared test user exists in Neon Auth before any test runs. POST to `/api/auth/sign-up/email` with credentials from env vars; handle "already exists" as success (idempotent).

**Contract**: Exports a function compatible with Playwright's `globalSetup` config option. Uses `fetch` (or Playwright's `request` API) against `http://localhost:3000/api/auth/sign-up/email`. Reads `E2E_TEST_EMAIL`, `E2E_TEST_PASSWORD`, `E2E_TEST_NAME` from `process.env`. Throws only on unexpected errors (network failure, 5xx) — not on "user already exists" responses.

#### 3. Auth setup project — sign-in and storageState

**File**: `e2e/auth.setup.ts`

**Intent**: Sign in as the shared test user via API and persist the authenticated cookie state to disk so browser tests start already authenticated.

**Contract**: A Playwright test file (`import { test as setup } from '@playwright/test'`) with a single test named `'authenticate'`. Uses `request.post('/api/auth/sign-in/email', { data: { email, password } })` to sign in, then calls `request.storageState({ path: 'playwright/.auth/user.json' })`. The `auth-setup` project in `playwright.config.ts` matches this file.

#### 4. Per-test user helpers

**File**: `e2e/helpers/user.ts`

**Intent**: Provide reusable functions for tests that need isolated users — create a unique user, sign in, get storageState, and (where possible) clean up.

**Contract**: Exports `createTestUser(request: APIRequestContext, overrides?: { email?, password?, name? })` → returns `{ email, password, name }` with generated unique values. Exports `signInAsUser(request: APIRequestContext, credentials: { email, password })` → returns cookie state. Uses UUID-based email generation for uniqueness (e.g., `test-<uuid>@flowstate-e2e.local`).

#### 5. Playwright config update — wire globalSetup

**File**: `playwright.config.ts`

**Intent**: Point Playwright's `globalSetup` to the provisioning script.

**Contract**: Add `globalSetup: './e2e/global.setup.ts'` to the config.

### Success Criteria:

#### Automated Verification:

- `pnpm exec playwright test --project=auth-setup` passes (signs in successfully, writes `playwright/.auth/user.json`)
- `playwright/.auth/user.json` file is created and contains cookie entries
- `pnpm typecheck` passes with all new `e2e/` files
- `pnpm check` passes on new files

#### Manual Verification:

- Inspect `playwright/.auth/user.json` — confirm it contains `__Secure-neon-auth.session_token` cookie
- Verify the test user exists in Neon Auth (check via app sign-in or Neon dashboard)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Smoke Test & Verification

### Overview

Write the smoke test that proves the full pipeline: authenticated browser navigates to `/`, asserts the app shell rendered with authenticated content (heading + task list container).

### Changes Required:

#### 1. Smoke test

**File**: `e2e/smoke.spec.ts`

**Intent**: Verify that an authenticated user can load the main page and see the app shell — proving Playwright, auth setup, and the dev server all work together.

**Contract**: A Playwright test file with a single test. Navigates to `/`. Asserts `page.getByRole('heading', { name: 'FlowState' })` is visible. Asserts the task list container is visible (by role, test-id, or text — based on what `TaskList` renders). Does NOT interact with tasks or test CRUD.

#### 2. README documentation

**File**: `README.md` (or a new `e2e/README.md`)

**Intent**: Document how to run e2e tests, what env vars are needed, and the auth setup flow for future contributors.

**Contract**: A section covering: prerequisites (`.env` with real Neon Auth values, `E2E_TEST_*` vars), how to install browsers (`pnpm exec playwright install chromium --with-deps`), how to run (`pnpm test:e2e`), and how the auth flow works (global setup provisions user, auth setup signs in, tests run authenticated).

### Success Criteria:

#### Automated Verification:

- `pnpm test:e2e` passes end-to-end (smoke test green)
- `pnpm test` (Vitest) still passes — no interference between test runners
- `pnpm typecheck` passes
- `pnpm check` passes

#### Manual Verification:

- Run `pnpm test:e2e` from scratch (no running dev server) — verify webServer starts automatically
- Run `pnpm test:e2e` with dev server already running — verify `reuseExistingServer` works
- Inspect Playwright HTML report (`npx playwright show-report`) — confirm smoke test is listed and green

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- None needed for this change — Playwright infrastructure is verified by running itself.

### Integration Tests:

- The auth setup (`e2e/auth.setup.ts`) IS the integration test — it exercises real Neon Auth sign-in.

### Manual Testing Steps:

1. Delete `playwright/.auth/user.json`, run `pnpm test:e2e` — verify it re-authenticates and passes.
2. Run `pnpm test:e2e` twice in a row — verify idempotent user provisioning (no "already exists" failure).
3. Run `pnpm test` — verify Vitest tests still pass (no config bleed).
4. Check that `playwright/.auth/` is gitignored (not tracked).

## Performance Considerations

- Chromium-only keeps install size ~150MB and test runtime under 10s for the smoke test.
- `reuseExistingServer: true` avoids cold-starting Next.js on every run during development.
- `timingMiddleware` adds 100-500ms per tRPC call in dev — acceptable for a smoke test; future tests against `pnpm preview` (production build) will be faster.

## Migration Notes

- No data migration needed.
- Existing Vitest tests are unaffected — different config file, different test directory, different npm script.
- `.env` needs three new variables (`E2E_TEST_EMAIL`, `E2E_TEST_PASSWORD`, `E2E_TEST_NAME`) — but these are only required for `pnpm test:e2e`, not for `pnpm dev` or `pnpm build`.

## References

- Research: `context/changes/e2e-test-infra/research.md`
- Playwright auth docs: [playwright.dev/docs/auth](https://playwright.dev/docs/auth)
- Neon Auth catch-all route: `src/app/api/auth/[...path]/route.ts:1-3`
- Sign-in server action (reference for API shape): `src/app/auth/sign-in/action.ts:27-30`
- Sign-up server action (reference for API shape): `src/app/auth/sign-up/actions.ts:30-34`
- Main page (smoke test target): `src/app/page.tsx:10-27`
- Vitest config (isolation reference): `vitest.config.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Playwright Installation & Configuration

#### Automated

- [x] 1.1 `pnpm install` succeeds with Playwright in devDependencies
- [x] 1.2 `pnpm exec playwright install chromium --with-deps` completes without error
- [x] 1.3 `pnpm exec playwright test --list` runs without config errors
- [x] 1.4 `pnpm typecheck` passes with `playwright.config.ts` included
- [x] 1.5 `pnpm check` passes on new/modified files

#### Manual

- [ ] 1.6 `playwright.config.ts` is readable and matches intended structure
- [ ] 1.7 `.gitignore` entries are present

### Phase 2: Auth Setup Infrastructure

#### Automated

- [ ] 2.1 `pnpm exec playwright test --project=auth-setup` passes
- [ ] 2.2 `playwright/.auth/user.json` is created with cookie entries
- [ ] 2.3 `pnpm typecheck` passes with all new `e2e/` files
- [ ] 2.4 `pnpm check` passes on new files

#### Manual

- [ ] 2.5 `playwright/.auth/user.json` contains `__Secure-neon-auth.session_token` cookie
- [ ] 2.6 Test user exists in Neon Auth

### Phase 3: Smoke Test & Verification

#### Automated

- [ ] 3.1 `pnpm test:e2e` passes end-to-end
- [ ] 3.2 `pnpm test` (Vitest) still passes
- [ ] 3.3 `pnpm typecheck` passes
- [ ] 3.4 `pnpm check` passes

#### Manual

- [ ] 3.5 `pnpm test:e2e` works without a running dev server (webServer auto-starts)
- [ ] 3.6 `pnpm test:e2e` works with dev server already running (reuseExistingServer)
- [ ] 3.7 Playwright HTML report shows smoke test green
