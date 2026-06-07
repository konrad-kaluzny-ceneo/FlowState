# Account Recovery Flow Implementation Plan

## Overview

Expose Neon Auth's password reset API through custom FlowState UI so email/password users can recover access without losing tasks or session history (FR-003a, S-07). The catch-all auth handler already proxies `request-password-reset` and `reset-password`; this slice adds the missing sign-in entry point, `/auth/forgot-password` and `/auth/reset-password` pages, server actions, validation tests, and partial e2e coverage. No Prisma, tRPC, or middleware changes.

## Current State Analysis

- **API available, app not wired:** `@neondatabase/auth@0.4.1-beta` exposes `auth.requestPasswordReset` and `auth.resetPassword` on the server singleton (`src/lib/auth/server.ts`). `POST /api/auth/request-password-reset` and `POST /api/auth/reset-password` are handled by `src/app/api/auth/[...path]/route.ts`. No application code calls these methods.
- **Sign-in has no recovery path:** `src/app/auth/sign-in/sign-in-form.tsx` renders email/password + Google OAuth only — no "Forgot password?" link.
- **Auth routes:** `sign-in/`, `sign-up/`, `_components/` only. No `forgot-password/` or `reset-password/`.
- **Public access:** `proxy.ts` excludes `auth/` from auth middleware — new recovery pages are reachable without login.
- **Data model safe:** All Prisma entities key off Neon Auth `userId` (string FK). Password reset updates credentials only; `userId` is stable — tasks, sessions, cycles, and check-ins remain attached.

### Key Discoveries:

- S-10 (`google-oauth-provider`) established the pattern: custom dark-theme UI, server wrapper (`page.tsx` + `<Suspense>`) + client form, `role="alert"` error banners, server actions for email flows (`sign-in/action.ts`, `sign-up/actions.ts`).
- Sign-up password rules live in `src/app/auth/sign-up/schema.ts` (8–128 chars) — reuse for reset form validation.
- Sign-in validation tests (`src/app/auth/sign-in/validation.test.ts`) use fast-check property tests with mocked `auth` — mirror for forgot-password action.
- E2e auth helpers (`e2e/helpers/user.ts`) support `createTestUser` via `POST /api/auth/sign-up/email` — use for request-reset API smoke test.
- Better Auth returns generic success on reset request (no email enumeration) — UI must show the same message whether or not the email exists.
- Reset email links land on `redirectTo` with `?token=` query param; invalid/expired tokens may arrive as `?error=INVALID_TOKEN`.

## Desired End State

A user who forgets their password can:

1. Click "Forgot password?" on `/auth/sign-in` → `/auth/forgot-password`
2. Submit their email → receive a reset email from Neon Auth (hosted delivery)
3. Click the email link → `/auth/reset-password?token=…`
4. Set a new password → redirected to `/auth/sign-in` with a success message
5. Sign in with the new password → all existing tasks and session history are intact (`userId` unchanged)

Automated verification covers the sign-in link, forgot-password form success state, and `request-password-reset` API contract. Full email-link → reset → sign-in round-trip is documented as a manual checklist (external email dependency).

## What We're NOT Doing

- OTP-based reset (`forgetPassword.emailOtp`)
- `@neondatabase/auth-ui` pre-built forms
- OAuth-only account recovery (Google users continue via Google sign-in)
- Admin password reset or account takeover flows
- Prisma schema, migrations, or tRPC router changes
- New backend API routes (existing catch-all handles auth HTTP)
- Full e2e automation of email link click (no mail capture in CI)
- Production Neon Console trusted-domain setup (documented as pre-ship manual step)

## Implementation Approach

Follow the S-10 thin-auth-slice pattern: two new route folders under `src/app/auth/` (`forgot-password/`, `reset-password/`) plus sign-in modifications, server actions calling `auth.requestPasswordReset` / `auth.resetPassword`, client forms styled like sign-in/sign-up. Build absolute `redirectTo` from request headers in the forgot-password server action. After successful reset, redirect to sign-in with `?reset=success` (not `/`) so UX is predictable and e2e assertions stay simple. Export shared `passwordSchema` from sign-up schema to avoid drift.

## Critical Implementation Details

### redirectTo origin

The forgot-password server action must pass an absolute `redirectTo` URL (e.g. `https://localhost:3000/auth/reset-password`). There is no `NEXT_PUBLIC_APP_URL` in `src/env.js`. Add a small server-only helper (e.g. `src/lib/auth/request-origin.ts`) used by the forgot-password action:

```typescript
import { headers } from "next/headers";

export async function getRequestOrigin(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) {
    throw new Error("Missing host header for redirectTo");
  }
  return `${proto}://${host}`;
}
```

Use `const origin = await getRequestOrigin()` before calling `auth.requestPasswordReset`. Default `proto` to `http` for local dev when the header is absent. Register production and preview domains in Neon Console trusted domains before shipping (same class of risk as S-10 OAuth redirect URIs).

### Post-reset session

Better Auth may establish a session on successful `resetPassword`. Regardless, redirect to `/auth/sign-in?reset=success` and show a success banner — do not redirect straight to `/`. This keeps recovery UX consistent and avoids coupling reset completion to app-shell auth state in tests.

## Phase 1: Sign-In Entry Point and Forgot-Password Flow

### Overview

Add the "Forgot password?" link on sign-in and implement the full request-reset page with server action, validation, and non-enumerating success UX.

### Changes Required:

#### 1. Forgot Password Link on Sign-In

**File**: `src/app/auth/sign-in/sign-in-form.tsx`

**Intent**: Expose the recovery entry point from the primary login surface without changing the email/password or OAuth flows.

**Contract**: Add a right-aligned or below-password `Link` to `/auth/forgot-password` with accessible text (e.g. "Forgot password?"). Place it between the password field and the submit button (common pattern). Match existing link styling (`text-blue-400`, `text-sm`).

#### 2. Forgot-Password Email Schema

**File**: `src/app/auth/forgot-password/schema.ts`

**Intent**: Centralize email validation for the request-reset form, aligned with sign-up email rules.

**Contract**: Export a Zod schema with email: required, max 254, valid email format. Export `ForgotPasswordFormState` with `{ error?: string; email: string; success?: boolean }` (or equivalent discriminated shape).

#### 3. Request Origin Helper

**File**: `src/lib/auth/request-origin.ts`

**Intent**: Centralize absolute URL construction for Neon Auth `redirectTo` from incoming request headers.

**Contract**: Export `getRequestOrigin()` as documented in Critical Implementation Details (`await headers()`, `x-forwarded-proto` / `x-forwarded-host` / `host` fallbacks).

#### 4. Forgot-Password Server Action

**File**: `src/app/auth/forgot-password/action.ts`

**Intent**: Call Neon Auth to send the reset email with the correct post-click landing page.

**Contract**: `"use server"` action accepting `(prevState, formData)`. Validate email via schema. On validation failure, return field error preserving email. On success path, call:

```typescript
await auth.requestPasswordReset({
  email: validatedEmail,
  redirectTo: `${origin}/auth/reset-password`,
});
```

where `origin` is `await getRequestOrigin()` from `~/lib/auth/request-origin`. Mirror sign-in error handling: check `result.error` on the SDK response. If `result.error.code` is in `NEON_AUTH_NETWORK_ERROR_CODES`, return a generic connection error. For any other `result.error` or thrown exception, still return `{ success: true, email }` (Better Auth non-enumeration — do not reveal whether the email exists). On a clean success (`!result.error`), return `{ success: true, email }`. Do not redirect — show inline success message on the same page.

#### 5. Forgot-Password Client Form

**File**: `src/app/auth/forgot-password/forgot-password-form.tsx`

**Intent**: Render the email capture form with loading, error, and success states matching existing auth styling.

**Contract**: `"use client"` component using `useActionState` with the server action. Fields: email input, submit button ("Send reset link"). On `success`, replace form with non-enumerating copy: e.g. "If an account exists for that email, we've sent a reset link." Include optional footer note: "Signed up with Google? Use Google sign-in instead." Link back to `/auth/sign-in`. Error banner uses `role="alert"`.

#### 6. Forgot-Password Page

**File**: `src/app/auth/forgot-password/page.tsx`

**Intent**: Server wrapper matching sign-in page layout (gradient background, card, heading).

**Contract**: RSC page with `<Suspense>` wrapping `ForgotPasswordForm`. Heading: e.g. "Reset your password". Subcopy explaining the user will receive an email.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm check`
- Existing unit tests pass: `pnpm test`
- No regressions in existing e2e: `pnpm test:e2e`

#### Manual Verification:

- "Forgot password?" link visible on `/auth/sign-in` and navigates to `/auth/forgot-password`
- Submitting a valid email shows generic success message (no enumeration)
- Submitting empty/invalid email shows validation error without calling auth API
- Page styling matches sign-in/sign-up dark theme

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Reset-Password Page and Token Handling

### Overview

Implement the landing page for email reset links: read `token` from query, validate new password, call `auth.resetPassword`, handle missing/invalid tokens, redirect to sign-in on success.

### Changes Required:

#### 1. Shared Password Schema Export

**File**: `src/app/auth/sign-up/schema.ts`

**Intent**: Single source of truth for password length rules across sign-up and reset flows.

**Contract**: Add `export const passwordSchema = signUpSchema.shape.password` alongside existing `signUpSchema` export. No change to sign-up validation behavior.

#### 2. Reset-Password Schema

**File**: `src/app/auth/reset-password/schema.ts`

**Intent**: Validate new password with the same rules as registration.

**Contract**: Import `passwordSchema` from `../sign-up/schema`. Build `resetPasswordSchema` with `{ password: passwordSchema, confirmPassword: z.string() }` plus a `.refine` ensuring passwords match. Export `ResetPasswordFormState` with field errors + optional form-level error.

#### 3. Reset-Password Server Action

**File**: `src/app/auth/reset-password/action.ts`

**Intent**: Apply the new password via Neon Auth using the token from the email link.

**Contract**: `"use server"` action. Read `token` from a hidden form field (populated by client from `useSearchParams`). Reject if token missing/empty before SDK call. Validate password fields via schema. Call:

```typescript
const result = await auth.resetPassword({ newPassword, token });
```

Mirror sign-in error handling on `result.error`: network codes in `NEON_AUTH_NETWORK_ERROR_CODES` → generic connection error; other errors (invalid/expired token) → user-facing message with link to `/auth/forgot-password`. On success (`!result.error`), `redirect("/auth/sign-in?reset=success")`.

#### 4. Reset-Password Client Form

**File**: `src/app/auth/reset-password/reset-password-form.tsx`

**Intent**: Collect new password when token is present; show error state when token is missing or URL carries `error`.

**Contract**: `"use client"` with `useSearchParams` + `useActionState`. If `token` query param absent (and no `error` param), show static error: "This reset link is invalid or has expired" with link to `/auth/forgot-password`. If `error=INVALID_TOKEN` (or similar), show dismissible `role="alert"` banner. Form: hidden `token` input, password + confirm password fields, submit ("Set new password"). Match sign-in input classes.

#### 5. Reset-Password Page

**File**: `src/app/auth/reset-password/page.tsx`

**Intent**: Server wrapper for reset form with Suspense boundary (required for `useSearchParams`).

**Contract**: Same visual shell as forgot-password page. `<Suspense>` wraps `ResetPasswordForm`.

#### 6. Sign-In Success Banner

**File**: `src/app/auth/sign-in/sign-in-form.tsx`

**Intent**: Acknowledge successful password reset when user lands on sign-in.

**Contract**: Read `reset=success` from `useSearchParams`. When present (and no `error` param), show a green/success `role="status"` banner: e.g. "Password updated. Sign in with your new password." OAuth `error` banner takes precedence when both params are present. Provide dismiss via `router.replace("/auth/sign-in")` (same pattern as OAuth error dismiss).

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm check`
- Existing unit tests pass: `pnpm test`
- No regressions in existing e2e: `pnpm test:e2e`

#### Manual Verification:

- Navigating to `/auth/reset-password` without `token` shows invalid-link message (no form)
- Submitting matching passwords with a valid token (from manual email) succeeds and lands on sign-in with success banner
- Invalid/expired token shows clear error with link back to forgot-password
- After reset + sign-in, existing tasks from before reset are still visible

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Validation Tests, E2E, and Manual Verification

### Overview

Add fast-check validation tests for the forgot-password action, Playwright coverage for the sign-in link and request-reset API, and a documented manual checklist for the email-link round-trip and data retention.

### Changes Required:

#### 1. Forgot-Password Validation Tests

**File**: `src/app/auth/forgot-password/validation.test.ts`

**Intent**: Prove empty/invalid email never reaches `auth.requestPasswordReset`, matching sign-up Zod + fast-check test style.

**Contract**: Mock `~/lib/auth/server` (`auth.requestPasswordReset`), `~/lib/auth/request-origin` (`getRequestOrigin` → `"http://localhost:3001"`), and `@neondatabase/auth/next/server` (`NEON_AUTH_NETWORK_ERROR_CODES`). Property tests: empty/whitespace email returns error and does not call SDK; valid email calls SDK with trimmed email and `redirectTo` containing `/auth/reset-password`.

#### 2. Export Auth POST Retry Helper

**File**: `e2e/helpers/user.ts`

**Intent**: Reuse rate-limit retry logic for password-reset API smoke test in CI.

**Contract**: Export `postAuthWithRetry` (currently module-private) so `account-recovery.spec.ts` can call it for `POST /api/auth/request-password-reset`.

#### 3. Account Recovery E2E Spec

**File**: `e2e/account-recovery.spec.ts`

**Intent**: Automate UI and API surfaces that do not depend on external email.

**Contract**: Unauthenticated Playwright tests (no auth fixture):

1. **Sign-in link:** Navigate to `/auth/sign-in`, assert link "Forgot password?" visible, `href` is `/auth/forgot-password`.
2. **Forgot-password form:** Navigate to `/auth/forgot-password`, fill email, submit, assert success message appears (generic copy).
3. **Request-reset API:** `createTestUser(request)` then `POST /api/auth/request-password-reset` with `{ email, redirectTo: "<baseURL>/auth/reset-password" }` — assert `response.ok()` (2xx). Use the same rate-limit retry pattern as `postAuthWithRetry` in `e2e/helpers/user.ts` (export that helper for reuse) to avoid CI flakes on 429/503.

Use `baseURL` from Playwright config. Do not assert email delivery or complete reset flow.

#### 4. E2E README Update (optional, one paragraph)

**File**: `e2e/README.md`

**Intent**: Document that full password-reset completion requires manual email verification.

**Contract**: Add short section under auth testing noting `account-recovery.spec.ts` covers initiation only; email link → token → reset is manual per plan Manual Testing Steps.

### Success Criteria:

#### Automated Verification:

- New validation tests pass: `pnpm test`
- New e2e spec passes: `pnpm test:e2e e2e/account-recovery.spec.ts`
- Full e2e suite passes: `pnpm test:e2e`
- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm check`

#### Manual Verification:

- E2E spec passes locally and in CI without flaking
- Manual email-link round-trip succeeds in dev (see Manual Testing Steps below)
- Data retention verified: user with seeded task recovers password and still sees the task

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- `src/app/auth/forgot-password/validation.test.ts` — empty/invalid email rejection; valid email triggers SDK call with correct `redirectTo` shape.
- Existing `src/app/auth/sign-in/validation.test.ts` — must continue passing.

### Integration Tests:

- Not applicable — no tRPC or Prisma changes. API contract exercised via e2e `request.post`.

### E2E Tests:

- `e2e/account-recovery.spec.ts` — forgot link, form success state, `request-password-reset` API smoke.
- Existing `e2e/smoke.spec.ts` — must continue passing.

### Manual Testing Steps:

1. Start dev server (`pnpm dev`). Create an email/password account with at least one task.
2. Sign out. On `/auth/sign-in`, click "Forgot password?" → `/auth/forgot-password`.
3. Submit the account email. Check inbox for Neon Auth reset email (dev may use real email delivery).
4. Click the reset link → lands on `/auth/reset-password?token=…`.
5. Enter a new password (8+ chars), confirm, submit → redirected to `/auth/sign-in?reset=success` with success banner.
6. Sign in with the new password → land on `/` with the pre-reset task still visible (same `userId`, no data loss).
7. Repeat with an invalid/expired token URL → error state with link to request a new reset.
8. **Production pre-ship:** Confirm app domain is in Neon Console trusted domains so `redirectTo` is accepted.

## Performance Considerations

- No performance impact — two static auth pages and server actions on infrequent recovery paths. No additional client bundles beyond form components.

## Migration Notes

- **No database migration** — auth credentials live in Neon Auth tables, not FlowState Prisma schema.
- **Production prerequisites** (manual, not code):
  1. Register production and preview Vercel domains in Neon Console → Auth → trusted domains.
  2. Verify reset emails deliver from Neon Auth for the production branch.
- **Dev:** Email/password sign-up already works; reset should work without extra FlowState config if trusted localhost origin is accepted (verify during manual test).

## References

- Research: `context/changes/account-recovery-flow/research.md`
- Roadmap: `context/foundation/roadmap.md` § S-07
- PRD: `context/foundation/prd.md` FR-003a
- Archived pattern: `context/archive/2026-05-31-google-oauth-provider/plan.md`
- Auth server: `src/lib/auth/server.ts`
- Sign-in action pattern: `src/app/auth/sign-in/action.ts`
- Sign-up schema: `src/app/auth/sign-up/schema.ts`
- E2e auth helpers: `e2e/helpers/user.ts`
- Neon docs: [Password reset guide](https://neon.com/docs/auth/guides/password-reset)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Sign-In Entry Point and Forgot-Password Flow

#### Automated

- [x] 1.1 Type checking passes: `pnpm typecheck` — 00ca59e
- [x] 1.2 Linting passes: `pnpm check` — 00ca59e
- [x] 1.3 Existing unit tests pass: `pnpm test` — 00ca59e
- [x] 1.4 No regressions in existing e2e: `pnpm test:e2e` — 00ca59e

#### Manual

- [ ] 1.5 Forgot password link visible on sign-in and navigates correctly
- [ ] 1.6 Valid email shows generic success message without enumeration
- [ ] 1.7 Invalid/empty email shows validation error without SDK call
- [ ] 1.8 Page styling matches existing auth pages

### Phase 2: Reset-Password Page and Token Handling

#### Automated

- [x] 2.1 Type checking passes: `pnpm typecheck` — e5fe9cc
- [x] 2.2 Linting passes: `pnpm check` — e5fe9cc
- [x] 2.3 Existing unit tests pass: `pnpm test` — e5fe9cc
- [x] 2.4 No regressions in existing e2e: `pnpm test:e2e` — e5fe9cc

#### Manual

- [ ] 2.5 Missing token shows invalid-link message without password form
- [ ] 2.6 Valid token flow sets new password and redirects to sign-in with success banner
- [ ] 2.7 Invalid/expired token shows error with link to forgot-password
- [ ] 2.8 Post-reset sign-in preserves existing tasks (userId unchanged)

### Phase 3: Validation Tests, E2E, and Manual Verification

#### Automated

- [x] 3.1 New validation tests pass: `pnpm test` — d659ee8
- [x] 3.2 New e2e spec passes: `pnpm test:e2e e2e/account-recovery.spec.ts` — d659ee8
- [x] 3.3 Full e2e suite passes: `pnpm test:e2e` — d659ee8
- [x] 3.4 Type checking passes: `pnpm typecheck` — d659ee8
- [x] 3.5 Linting passes: `pnpm check` — d659ee8

#### Manual

- [ ] 3.6 E2E spec passes in CI without flaking
- [ ] 3.7 Manual email-link round-trip verified in dev
- [ ] 3.8 Data retention verified after full recovery flow
