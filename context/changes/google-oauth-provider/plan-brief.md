# Google OAuth Social Login — Plan Brief

> Full plan: `context/changes/google-oauth-provider/plan.md`

## What & Why

Add a "Sign in with Google" button to both auth pages so users can sign in or sign up with one click instead of typing email and password. Neon Auth already supports Google OAuth natively — this is purely a UI surface addition with zero backend changes.

## Starting Point

The app has fully working email/password auth (sign-in, sign-up, session management) via Neon Auth. The `authClient.signIn.social()` method is already available on the client but unused. Both auth pages are client components with a consistent dark theme. The catch-all API route at `/api/auth/[...path]` already handles OAuth callbacks.

## Desired End State

Users see a Google-branded button below the email/password form on both `/auth/sign-in` and `/auth/sign-up`. Clicking it initiates the Google OAuth flow handled entirely by Neon Auth. On success, the user lands on `/` authenticated. On failure, they return to the auth page with a dismissible error banner. An e2e test proves the button renders and initiates the redirect.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Button placement | Below form with "or" divider | Preserves existing layout hierarchy; email/password remains the primary path. |
| Button style | Google-branded (white bg, "G" icon, dark text) | Instantly recognizable and builds trust; follows Google's branding guidelines. |
| Error handling | Inline banner on same page via `?error` query param | Consistent with existing error pattern; user stays in context to retry or fall back. |
| E2E scope | Button render + redirect initiation only | Proves integration is wired without depending on external Google infrastructure in CI. |

## Scope

**In scope:**
- Reusable `GoogleSignInButton` component with Google branding
- "Or" divider component
- Integration into both sign-in and sign-up pages
- OAuth error detection and dismissible banner display
- E2E test for button presence and redirect initiation

**Out of scope:**
- Other OAuth providers (GitHub, Vercel)
- Account linking UI
- Backend/schema changes
- Production Google Cloud Console setup (documented, not automated)
- Full OAuth round-trip e2e testing

## Architecture / Approach

Thin client-side integration: a single `GoogleSignInButton` component calls `authClient.signIn.social({ provider: "google" })` which triggers a redirect to Google via Neon Auth's OAuth flow. The existing catch-all API route handles the callback. Error detection uses URL search params (`?error=oauth_failed`) set via the `errorCallbackURL` parameter.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Google OAuth Button Component | Button + divider on both pages, functional OAuth redirect | `useSearchParams()` requires Suspense boundary in Next.js — may need wrapping |
| 2. OAuth Error Handling | Dismissible error banner on failed/cancelled flows | Error param naming must match what Better Auth actually sends back |
| 3. E2E Test | Automated verification of button presence and redirect | Test must not depend on Google being reachable — assert URL change only |

**Prerequisites:** None beyond existing codebase (Neon Auth already configured, dev shared credentials available).
**Estimated effort:** ~1 session across 3 phases (small, well-bounded changes).

## Open Risks & Assumptions

- Assumes Neon Auth's shared Google OAuth credentials work in the dev environment without additional configuration (documented behavior, but untested in this project).
- `useSearchParams()` in Next.js 16 may require a `<Suspense>` boundary — if so, wrap the component.
- Production deployment requires manual Google Cloud Console setup (not automatable in this plan).

## Success Criteria (Summary)

- User can sign in or sign up with Google in one click from both auth pages
- Failed OAuth flows show a clear, dismissible error message
- E2E test passes in CI without depending on external Google infrastructure
