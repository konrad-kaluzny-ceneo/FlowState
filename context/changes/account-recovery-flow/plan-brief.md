# Account Recovery Flow — Plan Brief

> Full plan: `context/changes/account-recovery-flow/plan.md`
> Research: `context/changes/account-recovery-flow/research.md`

## What & Why

Email/password users who forget their credentials are permanently locked out today — Neon Auth supports password reset at the API layer, but FlowState exposes no UI. This slice satisfies FR-003a: request a reset email, set a new password from the link, and sign back in without losing tasks or session history.

## Starting Point

Neon Auth is wired end-to-end for sign-in, sign-up, and Google OAuth (S-10). The catch-all `src/app/api/auth/[...path]/route.ts` already proxies `request-password-reset` and `reset-password`, but no app code calls `auth.requestPasswordReset` or `auth.resetPassword`. Sign-in has no forgot-password link; `/auth/forgot-password` and `/auth/reset-password` routes do not exist.

## Desired End State

Users click "Forgot password?" on sign-in, submit their email on `/auth/forgot-password`, receive a Neon Auth email, land on `/auth/reset-password?token=…`, set a new password, and sign in on `/auth/sign-in` with a success banner — all existing data intact because `userId` never changes. Automated tests cover the link, form success state, and request-reset API; the email-link round-trip is a documented manual step.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| UI approach | Custom pages (not `@neondatabase/auth-ui`) | Matches S-10 sign-in/sign-up styling and server-action pattern | Research |
| SDK surface | Server actions calling `auth.requestPasswordReset` / `auth.resetPassword` | Consistent with sign-in/up; keeps token handling server-side | Research / Plan |
| Post-reset redirect | `/auth/sign-in?reset=success` (not `/`) | Predictable UX; success banner on sign-in; avoids e2e coupling to auto-session | Plan |
| Email enumeration | Generic success copy on forgot-password | Better Auth returns non-enumerating responses — UI must match | Research |
| `redirectTo` construction | Absolute URL from `headers()` | No `NEXT_PUBLIC_APP_URL` in env schema; Neon requires trusted absolute redirect | Plan |
| Password rules | Reuse sign-up constraints (8–128 chars) | Single policy across registration and recovery | Research |
| E2E scope | Link + form + API smoke; manual email link | Token arrives via external email — not automatable in CI without mail sink | Research / Plan |
| Data retention proof | Manual: task visible after reset + sign-in | `userId` FK is stable by design; no Prisma changes needed | Research |
| Google-only users | Optional footer copy on forgot-password | Polish only — Google users use Google sign-in | Plan |

## Scope

**In scope:**

- "Forgot password?" link on `/auth/sign-in`
- `/auth/forgot-password` page + server action (`requestPasswordReset`)
- `/auth/reset-password` page + server action (`resetPassword`)
- Token/error handling, sign-in success banner
- Forgot-password validation tests (fast-check)
- E2e: forgot link, form success, `request-password-reset` API
- Manual checklist for email link and data retention

**Out of scope:**

- OTP reset, OAuth recovery, admin reset
- Prisma / tRPC / new API routes
- Full e2e of email delivery
- Production Neon trusted-domain setup (documented, not coded)

## Architecture / Approach

Thin auth slice identical in class to S-10: new route folders under `src/app/auth/` with RSC page + Suspense + client form + server action. Forgot action builds `redirectTo` from request headers and calls `auth.requestPasswordReset`. Reset action reads token from form (sourced from URL query), validates password, calls `auth.resetPassword`, redirects to sign-in. `proxy.ts` already allows unauthenticated access to `auth/*`. All app data remains keyed by stable Neon Auth `userId`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Sign-in link + forgot-password | Entry point, email form, request-reset action | `redirectTo` origin wrong in preview/prod without trusted domains |
| 2. Reset-password + sign-in banner | Token form, reset action, error/success UX | Invalid/expired token edge cases; Better Auth auto-session vs redirect |
| 3. Tests + manual verification | Validation tests, e2e spec, manual email checklist | Email delivery flaky in dev; no CI token automation |

**Prerequisites:** F-02 (e2e infra) done; Neon Auth email/password sign-up working; research complete.

**Estimated effort:** ~1–2 sessions across 3 phases (thin UI slice, no schema work).

## Open Risks & Assumptions

- Production/preview domains must be registered in Neon Console trusted domains before reset links work outside localhost.
- Dev reset email delivery depends on Neon Auth hosted email — manual verification required to confirm inbox delivery.
- Automated reset completion blocked without email capture or verification-table SQL access; accepted per research.
- Assumes `auth.requestPasswordReset` / `auth.resetPassword` signatures match `@neondatabase/auth@0.4.1-beta` types (verified in research).

## Success Criteria (Summary)

- User can initiate password reset from sign-in and complete recovery via email link without data loss.
- `pnpm test`, `pnpm test:e2e`, `pnpm typecheck`, and `pnpm check` pass including new specs.
- Manual checklist confirms email link round-trip and task persistence after reset.
