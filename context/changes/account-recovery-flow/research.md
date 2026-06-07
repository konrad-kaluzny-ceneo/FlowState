---
date: 2026-06-07T12:00:00+02:00
researcher: Cursor Agent (10x-research)
git_commit: a1ce6312627879c6898472301aacee03bbb31471
branch: main
repository: konrad-kaluzny-ceneo/FlowState
topic: "S-07 account-recovery-flow — Neon Auth password reset API availability and UI scope"
tags: [research, codebase, neon-auth, password-reset, auth, e2e, FR-003a]
status: complete
last_updated: 2026-06-07
last_updated_by: Cursor Agent (10x-research)
---

# Research: S-07 account-recovery-flow — Neon Auth password reset

**Date**: 2026-06-07T12:00:00+02:00  
**Researcher**: Cursor Agent (10x-research)  
**Git Commit**: [`a1ce631`](https://github.com/konrad-kaluzny-ceneo/FlowState/commit/a1ce6312627879c6898472301aacee03bbb31471)  
**Branch**: main  
**Repository**: konrad-kaluzny-ceneo/FlowState

## Research Question

For roadmap slice S-07 (`account-recovery-flow`, FR-003a):

1. Is Neon Auth's password reset/recovery API available and wired in FlowState?
2. Does the sign-in surface already expose forgot-password UI?
3. What auth UI patterns did the archived `google-oauth-provider` slice establish?
4. What e2e patterns exist for auth flows?
5. Is this slice verification-only or does it need new UI?

## Summary

- **API: available, not wired in app UI.** Neon Auth 0.4.1-beta (Better Auth) exposes `requestPasswordReset`, `resetPassword`, and client `forgetPassword` / `requestPasswordReset`. The catch-all handler at [`src/app/api/auth/[...path]/route.ts`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/a1ce631/src/app/api/auth/%5B...path%5D/route.ts) already proxies `POST /api/auth/request-password-reset` and `POST /api/auth/reset-password`. No FlowState code calls these methods today.
- **UI: missing.** Sign-in has email/password + Google OAuth only — no "Forgot password?" link, no `/auth/forgot-password` or `/auth/reset-password` routes. Auth routes under `src/app/auth/` are limited to `sign-in`, `sign-up`, and shared `_components`.
- **Data preservation: safe by design.** App data is keyed by Neon Auth `userId` (string) in Prisma; password reset updates credentials only — it does not rotate user id. Tasks, sessions, cycles, and check-ins remain attached after recovery.
- **Recommended scope: build custom UI** (not verify-only), following the S-10 pattern: server-wrapper + client form + server action or `authClient`, dark-theme styling, link from sign-in. Optional alternative: `@neondatabase/auth-ui` pre-built forms — rejected for consistency with existing custom auth pages.
- **E2e: partial automation.** Follow F-02 API-auth helpers and S-10's "initiate flow, don't complete external email" pattern. Test forgot-password link visibility, request form success state, and API `request-password-reset` for a known user. Full email-link → token → reset → sign-in round-trip is not automatable without email capture; prove data retention via API-level sign-in before/after password change if token can be obtained in test env.

## Detailed Findings

### 1. Neon Auth integration — API surface

#### 1.1 Current FlowState auth wiring

| Concern | Location | Status |
|---------|----------|--------|
| Server auth singleton | [`src/lib/auth/server.ts`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/a1ce631/src/lib/auth/server.ts) | `createNeonAuth({ baseUrl, cookies })` |
| Client auth | [`src/lib/auth/client.ts`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/a1ce631/src/lib/auth/client.ts) | `createAuthClient()` |
| HTTP handler | [`src/app/api/auth/[...path]/route.ts`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/a1ce631/src/app/api/auth/%5B...path%5D/route.ts) | `auth.handler()` — all Better Auth routes |
| Route protection | [`proxy.ts`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/a1ce631/proxy.ts) | `auth.middleware({ loginUrl: "/auth/sign-in" })`; matcher excludes `auth/` |
| Methods used in app | sign-in/up actions only | `auth.signIn.email`, `auth.signUp.email`; client `signIn.social`, `signOut` |

Prior F-02 research ([`context/archive/2026-05-28-e2e-test-infra/research.md`](context/archive/2026-05-28-e2e-test-infra/research.md)) catalogued the live API surface as sign-in, sign-up, sign-out, session — **no recovery methods called**. That remains true at `a1ce631`.

#### 1.2 Password reset endpoints (available via SDK, not called)

From `@neondatabase/auth@0.4.1-beta` type definitions (`dist/next/server/index.d.mts`):

| Method | HTTP path (under `/api/auth/`) | Purpose |
|--------|-------------------------------|---------|
| `requestPasswordReset` | `POST request-password-reset` | Send reset email; body `{ email, redirectTo? }` |
| `resetPassword` | `POST reset-password` | Set new password; body `{ newPassword, token }` |

Client (`authClient`) also exposes:

- `requestPasswordReset({ email, redirectTo })`
- `resetPassword({ newPassword, token })`
- `forgetPassword.emailOtp` / `emailOtp.*` (OTP variant — not required for link-based MVP)

Neon docs ([password reset guide](https://neon.com/docs/auth/guides/password-reset)): enabled automatically when email sign-up is enabled; Neon sends the verification email. Flow: user requests reset → email link → redirect to app `redirectTo` with `?token=` → user submits new password.

#### 1.3 Email / infra prerequisites

- Email/password sign-up is already used (`signUpAction`, e2e `createTestUser` via `/api/auth/sign-up/email`).
- No custom `sendResetPassword` handler required in FlowState — Neon Auth hosted service handles email delivery.
- `redirectTo` must be a trusted app URL (production: register domain in Neon Console). Use absolute URL built from request origin or env in server action.

### 2. Sign-in and auth routes — no recovery UI

#### 2.1 Sign-in form

[`src/app/auth/sign-in/sign-in-form.tsx`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/a1ce631/src/app/auth/sign-in/sign-in-form.tsx):

- Fields: email, password, submit
- Footer: link to `/auth/sign-up`
- OAuth: `GoogleSignInButton` + `AuthDivider`
- **No** forgot-password link, **no** reference to reset routes

[`src/app/auth/sign-in/action.ts`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/a1ce631/src/app/auth/sign-in/action.ts) calls only `auth.signIn.email`.

#### 2.2 Auth route inventory

```
src/app/auth/
├── sign-in/          (page.tsx + sign-in-form.tsx + action.ts)
├── sign-up/          (page.tsx + sign-up-form.tsx + actions.ts + schema.ts)
└── _components/      (google-sign-in-button, auth-divider)
```

No `forgot-password/`, `reset-password/`, or similar directories exist.

#### 2.3 Middleware / public access

`proxy.ts` matcher excludes `auth/` — new pages under `/auth/forgot-password` and `/auth/reset-password` are reachable without login (required for recovery).

### 3. Historical pattern — google-oauth-provider (S-10)

Archived at [`context/archive/2026-05-31-google-oauth-provider/`](context/archive/2026-05-31-google-oauth-provider/).

**Reusable patterns for S-07:**

| Pattern | S-10 implementation | Apply to S-07 |
|---------|---------------------|---------------|
| Custom UI, not auth-ui package | `GoogleSignInButton` calls `authClient.signIn.social()` | Custom forms call `authClient.requestPasswordReset` / server `auth.resetPassword` |
| Server wrapper + client form | `page.tsx` (RSC) + `sign-in-form.tsx` (`useSearchParams`, Suspense) | Same split for forgot/reset pages |
| Error banners | `role="alert"`, dismissible OAuth errors via `router.replace` | Reuse for invalid token, network errors |
| Styling | Dark gradient card, white/5 inputs, blue/indigo CTAs | Match existing sign-in/sign-up |
| No schema/tRPC changes | UI-only slice | Same — recovery is auth-layer only |
| E2e scope | Plan: button render + redirect initiation; **Phase 3 e2e not shipped** (`e2e/google-oauth.spec.ts` absent) | Don't block on full OAuth-style redirect test; prefer API + DOM oracles |

[`plan.md`](context/archive/2026-05-31-google-oauth-provider/plan.md) explicitly: "No new backend routes" — recovery fits the same model; only new **pages** and links, existing catch-all handles API.

### 4. E2E test patterns

#### 4.1 Auth fixture (F-02)

[`e2e/helpers/user.ts`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/a1ce631/e2e/helpers/user.ts):

- `createTestUser` → `POST /api/auth/sign-up/email`
- `signInAsUser` → `POST /api/auth/sign-in/email` → cookies via `storageState`

[`e2e/fixtures.ts`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/a1ce631/e2e/fixtures.ts): per-test authenticated user (no shared storageState).

[`e2e/README.md`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/a1ce631/e2e/README.md): documents API auth, rate-limit retries, guest vs authenticated projects.

**No existing spec** covers password reset, forgot-password UI, or recovery.

#### 4.2 Recommended e2e strategy for S-07

| Test | Approach | Rationale |
|------|----------|-----------|
| Forgot link on sign-in | Unauthenticated Playwright; assert link href | Pure UI, fast |
| Request reset form | Fill email → submit → success message (generic, no email enumeration) | Matches Better Auth response |
| API contract | `request.post('/api/auth/request-password-reset', { email })` for user from `createTestUser` | Exercises real handler |
| Data after recovery | Create user + seed task via authenticated fixture → reset password (needs token) → sign in → task visible | FR-003a + NFR guardrail |
| Email link click | Manual or mail capture | External dependency; defer full automation |

**Token gap:** Better Auth sends token via email. Without Neon DB access to `verification` table or a test mail sink, automated end-to-end reset completion is blocked. Mitigation: API-level `reset-password` if token obtained manually once; or document manual verification checklist (as S-10 did for OAuth completion).

#### 4.3 Sign-in validation tests

[`src/app/auth/sign-in/validation.test.ts`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/a1ce631/src/app/auth/sign-in/validation.test.ts): property tests for empty-field rejection on sign-in — pattern to mirror for forgot-password email validation.

Password rules: reuse [`signUpSchema`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/a1ce631/src/app/auth/sign-up/schema.ts) password constraints (8–128 chars) on reset form.

### 5. Scope determination

| Criterion | Finding | Implication |
|-----------|---------|-------------|
| API wired? | Handler yes; app calls no | Must add UI + actions |
| UI exists? | No | **Build required** |
| FR-003a satisfied today? | No — user cannot initiate reset from app | Not verify-only |
| Roadmap unknown | "audit IS the slice; if wired, verification only" | Audit result: **not wired** |
| Data loss risk on reset? | No — same `userId` | Document in plan; optional integration test |

**Recommended scope (minimal MVP):**

1. "Forgot password?" link on sign-in → `/auth/forgot-password`
2. Forgot-password page: email form → `auth.requestPasswordReset` (server action) with `redirectTo: ${origin}/auth/reset-password`
3. Reset-password page: read `token` from query → new password form → `auth.resetPassword` → redirect to sign-in with success hint
4. E2e: link + request form + API smoke; manual step for email link
5. Reuse sign-in/sign-up visual patterns; no `@neondatabase/auth-ui` unless plan explicitly opts in

**Out of scope (align with S-10 / PRD):**

- OTP-based reset (`forgetPassword.emailOtp`)
- OAuth-only account recovery (Google users use Google sign-in)
- Admin password set
- Prisma / tRPC changes

## Code References

- [`src/lib/auth/server.ts`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/a1ce631/src/lib/auth/server.ts) — Neon Auth server singleton
- [`src/lib/auth/client.ts`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/a1ce631/src/lib/auth/client.ts) — browser auth client
- [`src/app/api/auth/[...path]/route.ts`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/a1ce631/src/app/api/auth/%5B...path%5D/route.ts) — proxies all auth HTTP including reset
- [`src/app/auth/sign-in/sign-in-form.tsx`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/a1ce631/src/app/auth/sign-in/sign-in-form.tsx) — missing forgot-password link
- [`src/app/auth/sign-in/action.ts`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/a1ce631/src/app/auth/sign-in/action.ts) — sign-in server action (pattern for forgot action)
- [`proxy.ts`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/a1ce631/proxy.ts) — `auth/` paths public
- [`e2e/helpers/user.ts`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/a1ce631/e2e/helpers/user.ts) — programmatic auth for tests
- [`prisma/schema.prisma`](https://github.com/konrad-kaluzny-ceneo/FlowState/blob/a1ce631/prisma/schema.prisma) — all entities use `userId` FK, not auth secrets

## Architecture Insights

1. **Thin auth slice pattern:** S-10 proved Neon Auth features integrate as UI + client/server SDK calls with zero domain changes. S-07 is the same class of work.
2. **Server actions vs client SDK:** Sign-in/up use server actions (`auth.signIn.email` / `auth.signUp.email`); Google uses client `authClient.signIn.social`. Either works for reset; server actions keep secrets off client and match sign-in/up — prefer server actions for forgot + reset.
3. **Security UX:** Better Auth returns generic success on request ("If this email exists…") — implement the same non-enumerating copy on forgot-password success.
4. **Token handling:** Reset page must handle missing/invalid `token` query param with clear error and link back to forgot-password (Better Auth `?error=INVALID_TOKEN` on redirect).
5. **Guest trial orthogonality:** S-08 guest merge is unrelated; recovery applies to email/password accounts only.

## Historical Context (from prior changes)

- [`context/foundation/roadmap.md`](context/foundation/roadmap.md) § S-07 — outcome and unknown ("API vs UI") resolved here: API yes, UI no.
- [`context/foundation/tech-stack.md`](context/foundation/tech-stack.md) § Authentication — documents "Password reset and account recovery (satisfies FR-003a)" at platform level; app never exposed it.
- [`context/archive/2026-05-28-e2e-test-infra/research.md`](context/archive/2026-05-28-e2e-test-infra/research.md) — auth API catalog, cookie/`__Secure-` constraints, HTTP sign-in pattern for Playwright.
- [`context/archive/2026-05-31-google-oauth-provider/plan.md`](context/archive/2026-05-31-google-oauth-provider/plan.md) — custom auth UI template, server/client split, partial e2e scope.

## Related Research

- [`context/archive/2026-05-28-e2e-test-infra/research.md`](context/archive/2026-05-28-e2e-test-infra/research.md) — Playwright + Neon Auth API auth
- Neon docs: [Password reset guide](https://neon.com/docs/auth/guides/password-reset)
- Better Auth: [Email & password — requestPasswordReset / resetPassword](https://www.better-auth.com/docs/authentication/email-password)

## Open Questions

1. **Production `redirectTo` / trusted domains:** Confirm production domain is registered in Neon Console before shipping — same class of risk as S-10 OAuth redirect URI.
2. **Auto sign-in after reset:** Better Auth may sign user in on successful reset — plan should specify whether to `redirect("/")` or `/auth/sign-in` (prefer sign-in + message for predictable e2e).
3. **Full e2e token acquisition:** Investigate during `/10x-plan` whether Neon dev branch exposes verification tokens via SQL MCP for automated reset completion; if not, accept manual + API partial coverage.
4. **Google-only users:** No password to reset — optional copy on forgot-password ("Use Google sign-in if you registered with Google") — product polish, not blocking.
