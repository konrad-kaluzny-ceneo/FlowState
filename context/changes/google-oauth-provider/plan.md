# Google OAuth Social Login Implementation Plan

## Overview

Add Google OAuth as a one-click social login option alongside the existing email/password flow. The integration uses Neon Auth's built-in Google OAuth support — no backend routes, schema changes, or Prisma migrations required. The work is purely a UI surface addition (button + divider + error handling) on both sign-in and sign-up pages, plus an e2e test proving the button renders and initiates the OAuth redirect.

## Current State Analysis

- **Auth client:** `src/lib/auth/client.ts` exports `authClient` created via `createAuthClient()` from `@neondatabase/auth/next`. The `signIn.social()` method is available and accepts `{ provider: "google", callbackURL, errorCallbackURL }`.
- **Sign-in page:** `src/app/auth/sign-in/page.tsx` — client component using `useActionState` for the email/password form. No social login buttons exist.
- **Sign-up page:** `src/app/auth/sign-up/page.tsx` + `sign-up-form.tsx` — server component wrapper + client form component. No social login buttons exist.
- **API route:** `src/app/api/auth/[...path]/route.ts` already handles all auth routes including `/api/auth/callback/google` via `auth.handler()`.
- **OAuth callback handling:** Better Auth redirects to `errorCallbackURL` with query params on failure. On success, it redirects to `callbackURL`.
- **Dev environment:** Google OAuth works with shared credentials in Neon Auth dev environments — no setup needed to test locally.

### Key Discoveries:

- `authClient.signIn.social({ provider: "google", callbackURL: "/", errorCallbackURL: "/auth/sign-in?error=oauth_failed" })` triggers the full OAuth flow client-side — no server action needed.
- The OAuth callback route (`/api/auth/callback/google`) is already handled by the catch-all `[...path]` route.
- Error detection on return: check `searchParams.get("error")` on page load to show an inline banner.
- The sign-in page is a single client component (`page.tsx`); the sign-up page splits into a server wrapper (`page.tsx`) and a client form (`sign-up-form.tsx`).

## Desired End State

Both `/auth/sign-in` and `/auth/sign-up` pages display a "Sign in with Google" button below the email/password form, separated by an "or" divider. Clicking the button initiates the Google OAuth flow via Neon Auth. On success, the user lands on `/` authenticated. On failure or cancellation, the user returns to the auth page with an inline error banner. An e2e test verifies the button is present and clickable on both pages.

## What We're NOT Doing

- GitHub, Vercel, or other OAuth providers (can be added later with the same pattern).
- Account linking UI (Neon Auth handles this automatically when emails match).
- Changes to the data model, auth middleware, or tRPC routers.
- Production Google Cloud Console setup (documented in change.md; requires manual credential creation).
- Mocking the full OAuth round-trip in e2e tests (Google's consent screen is external).

## Implementation Approach

Create a single reusable `GoogleSignInButton` client component that encapsulates the Google "G" icon SVG, the branded button styling, and the `authClient.signIn.social()` call. Add it to both auth pages below the existing form with an "or" divider. Detect OAuth errors via URL search params and display them using the existing error banner pattern.

---

## Phase 1: Google OAuth Button Component

### Overview

Create the reusable button component with Google branding and wire it into both auth pages with a visual divider separating it from the email/password form.

### Changes Required:

#### 1. Google Sign-In Button Component

**File**: `src/app/auth/_components/google-sign-in-button.tsx`

**Intent**: Create a reusable client component that renders a Google-branded button (white background, Google "G" icon, dark text) and calls `authClient.signIn.social()` on click. Accepts a `callbackURL` and `errorCallbackURL` prop so each page can customize the error return path.

**Contract**: Exports `GoogleSignInButton` — a `"use client"` component accepting `{ mode: "sign-in" | "sign-up"; errorCallbackURL: string }`. Calls `authClient.signIn.social({ provider: "google", callbackURL: "/", errorCallbackURL })`. Disables itself while the redirect is in flight. Uses an inline SVG for the Google "G" icon to avoid external asset dependencies.

#### 2. Auth Divider Component

**File**: `src/app/auth/_components/auth-divider.tsx`

**Intent**: Create a simple "or" divider component matching the dark theme, reusable across both auth pages.

**Contract**: Exports `AuthDivider` — renders a horizontal line with centered "or" text. Styling: `border-white/10` lines, `text-white/40` text, `text-sm`.

#### 3. Sign-In Page Integration

**File**: `src/app/auth/sign-in/page.tsx`

**Intent**: Add the Google button and divider below the existing email/password form, inside the card container. Also read `?error` search param to display an OAuth error banner.

**Contract**: Import and render `AuthDivider` + `GoogleSignInButton` after the `</form>` and before the "Don't have an account?" link. The `errorCallbackURL` is `/auth/sign-in?error=oauth_failed`. Read `useSearchParams()` to detect `?error=oauth_failed` and display an error banner using the same `role="alert"` pattern as the existing `state.error` display.

#### 4. Sign-Up Page Integration

**File**: `src/app/auth/sign-up/sign-up-form.tsx`

**Intent**: Add the Google button and divider below the existing sign-up form, before the "Already have an account?" link.

**Contract**: Import and render `AuthDivider` + `GoogleSignInButton` after the submit button and before the sign-in link paragraph. The `errorCallbackURL` is `/auth/sign-up?error=oauth_failed`. Read `useSearchParams()` to detect `?error=oauth_failed` and display an error banner at the top of the form.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm check`
- Existing unit tests pass: `pnpm test`
- No regressions in existing e2e smoke test: `pnpm test:e2e`

#### Manual Verification:

- Google button renders on `/auth/sign-in` below the form with correct branding (white bg, Google icon, dark text)
- Google button renders on `/auth/sign-up` below the form with correct branding
- Clicking the button initiates a redirect to Google's OAuth consent screen (dev environment with shared credentials)
- After successful OAuth, user lands on `/` authenticated
- After cancelling OAuth or on error, user returns to the auth page with an inline error banner

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: OAuth Error Handling

### Overview

Ensure the error detection and display works correctly for all failure scenarios — user cancellation, provider errors, and network issues.

### Changes Required:

#### 1. Error Parameter Handling in Sign-In

**File**: `src/app/auth/sign-in/page.tsx`

**Intent**: Handle the case where the user returns from a failed OAuth flow. The error banner should be dismissible (clears the URL param) and should not interfere with the existing email/password error state.

**Contract**: Use `useSearchParams()` to read `error` param. When present, show a banner with message "Could not sign in with Google. Please try again or use email and password." Provide a dismiss mechanism that removes the query param from the URL (via `router.replace` without the param). The OAuth error state is independent of the form's `state.error`.

#### 2. Error Parameter Handling in Sign-Up

**File**: `src/app/auth/sign-up/sign-up-form.tsx`

**Intent**: Same error handling pattern for the sign-up page.

**Contract**: Same approach as sign-in — read `error` param, show dismissible banner with message "Could not sign up with Google. Please try again or use email and password."

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm check`
- Existing tests pass: `pnpm test`

#### Manual Verification:

- Navigating to `/auth/sign-in?error=oauth_failed` shows the error banner
- Navigating to `/auth/sign-up?error=oauth_failed` shows the error banner
- Dismissing the banner removes the `?error` param from the URL
- The OAuth error banner does not interfere with email/password form errors (both can show simultaneously)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: E2E Test

### Overview

Add a Playwright test verifying the Google button renders on both auth pages and that clicking it initiates navigation away from the page (to the OAuth provider).

### Changes Required:

#### 1. Google OAuth E2E Test

**File**: `e2e/google-oauth.spec.ts`

**Intent**: Verify the Google OAuth button is present and functional on both auth pages without completing the full OAuth flow (which requires Google's external consent screen).

**Contract**: Unauthenticated test (no `storageState` from auth setup). Two test cases:
1. Navigate to `/auth/sign-in`, assert button with text "Sign in with Google" is visible, click it, assert navigation away from `/auth/sign-in` (URL changes to Google's domain or the Neon Auth OAuth initiation endpoint).
2. Navigate to `/auth/sign-up`, assert button with text "Sign up with Google" is visible, click it, assert navigation away from `/auth/sign-up`.

Use `page.waitForURL()` with a pattern that excludes the current auth page URL to verify the redirect initiated without depending on Google's domain being reachable in CI.

### Success Criteria:

#### Automated Verification:

- New e2e test passes: `pnpm test:e2e`
- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm check`

#### Manual Verification:

- E2E test output confirms both test cases pass
- Test does not flake due to network timeouts (redirect initiation is fast, doesn't depend on Google responding)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- No new unit tests required — the component is a thin wrapper around `authClient.signIn.social()` with no business logic to unit test.
- Existing sign-in validation tests (`validation.test.ts`) must continue passing (no regression).

### Integration Tests:

- Not applicable — no new tRPC routers, server actions, or data layer changes.

### E2E Tests:

- `e2e/google-oauth.spec.ts` — button render + redirect initiation on both pages (Phase 3).
- Existing `e2e/smoke.spec.ts` — must continue passing (authenticated user still sees app shell).

### Manual Testing Steps:

1. Start dev server (`pnpm dev`), navigate to `/auth/sign-in`
2. Verify Google button appears below the form with correct branding
3. Click the Google button — should redirect to Google OAuth consent
4. Complete the Google sign-in — should land on `/` authenticated
5. Sign out, navigate to `/auth/sign-up`, repeat steps 2-4
6. Cancel the OAuth flow mid-way — should return to auth page with error banner
7. Dismiss the error banner — URL should clean up

## Performance Considerations

- No performance impact — the Google button is a static client component with an inline SVG icon. No additional network requests until the user clicks it.
- The `useSearchParams()` hook requires the page to be a client component (already the case for both pages).

## Migration Notes

- **Production setup required** (not part of this implementation):
  1. Create a Google Cloud OAuth client (Web application type)
  2. Set authorized redirect URI to `{NEON_AUTH_BASE_URL}/callback/google`
  3. Paste Client ID + Client Secret into Neon Console (branch → Auth → Google provider)
  4. Add production domain to trusted domains in Neon Console
- **Dev environment**: Works immediately with Neon Auth's shared Google OAuth credentials — no configuration needed.

## References

- Change description: `context/changes/google-oauth-provider/change.md`
- Roadmap entry: `context/foundation/roadmap.md` § S-10
- Auth client: `src/lib/auth/client.ts`
- Sign-in page: `src/app/auth/sign-in/page.tsx`
- Sign-up form: `src/app/auth/sign-up/sign-up-form.tsx`
- Neon Auth docs (llms.txt): `signIn.social({ provider: 'google', callbackURL: '/dashboard' })`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Google OAuth Button Component

#### Automated

- [ ] 1.1 Type checking passes: `pnpm typecheck`
- [ ] 1.2 Linting passes: `pnpm check`
- [ ] 1.3 Existing unit tests pass: `pnpm test`
- [ ] 1.4 No regressions in existing e2e smoke test: `pnpm test:e2e`

#### Manual

- [ ] 1.5 Google button renders on both auth pages with correct branding
- [ ] 1.6 Clicking button initiates Google OAuth redirect (dev shared credentials)
- [ ] 1.7 Successful OAuth lands user on `/` authenticated
- [ ] 1.8 Failed/cancelled OAuth returns user to auth page with error banner

### Phase 2: OAuth Error Handling

#### Automated

- [ ] 2.1 Type checking passes: `pnpm typecheck`
- [ ] 2.2 Linting passes: `pnpm check`
- [ ] 2.3 Existing tests pass: `pnpm test`

#### Manual

- [ ] 2.4 Error banner shows when navigating to auth pages with `?error=oauth_failed`
- [ ] 2.5 Dismissing banner removes query param from URL
- [ ] 2.6 OAuth error banner and form errors can display simultaneously

### Phase 3: E2E Test

#### Automated

- [ ] 3.1 New e2e test passes: `pnpm test:e2e`
- [ ] 3.2 Type checking passes: `pnpm typecheck`
- [ ] 3.3 Linting passes: `pnpm check`

#### Manual

- [ ] 3.4 E2E test output confirms both test cases pass without flaking
