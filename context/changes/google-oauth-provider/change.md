---
change_id: google-oauth-provider
title: "Google OAuth social login"
status: impl_reviewed
created: 2026-05-31
updated: 2026-05-31
---

# Google OAuth Social Login

## Summary

Add Google OAuth as a social login option alongside the existing email/password flow. Neon Auth supports Google OAuth out of the box (shared credentials for dev, custom credentials for production). The integration requires:

1. A "Sign in with Google" button on sign-in and sign-up pages calling `authClient.signIn.social({ provider: "google" })`.
2. Production configuration: Google Cloud OAuth client credentials pasted into Neon Console (branch → Auth), redirect URI registered as `{NEON_AUTH_BASE_URL}/callback/google`, and trusted domains configured.
3. No schema changes, no new tRPC routers, no Prisma migration — purely a provider configuration + UI surface addition.

## Motivation

- Reduces sign-up friction (one-click login vs. email + password).
- Neon Auth already handles the OAuth flow, session creation, and user provisioning — minimal implementation effort.
- Google OAuth works with shared credentials in development immediately (no setup needed to test).

## Scope

- Add Google OAuth button to `/auth/sign-in` and `/auth/sign-up` pages.
- Verify the flow works end-to-end (dev with shared credentials, production with custom credentials).
- Update e2e tests if needed (F-02 auth fixture may need awareness of OAuth users).
- Document production setup steps (Google Cloud Console + Neon Console).

## Out of scope

- GitHub or Vercel OAuth (can be added later with the same pattern).
- Account linking (merging an OAuth account with an existing email/password account) — Neon Auth handles this automatically when the email matches.
- Changes to the data model or auth middleware.
