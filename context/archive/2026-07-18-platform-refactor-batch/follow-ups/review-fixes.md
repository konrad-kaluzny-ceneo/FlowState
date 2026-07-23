# Follow-ups from the F-15 implementation review

Source: `../reviews/impl-review.md` (2026-07-21). None of these block merging
`platform-refactor-batch`. Fold each into a future change rather than this one.

---

## FU-1 — Add `src/app/global-error.tsx` so root-boundary render errors reach Sentry

**From**: F1 (WARNING). Also recorded under "Known gaps / follow-ups" in `change.md`.

**Problem**: The repo has no `error.tsx` or `global-error.tsx`. A React **render** error on the
client that unwinds to Next's built-in root error boundary is reported by React through
`onCaughtError` (console only), never through `reportError`/`window.onerror`, so Sentry's
`globalHandlers` integration does not see it. Server render errors (`onRequestError`), uncaught
client exceptions, unhandled rejections, and navigation errors are all already captured — this is
the one uncovered surface, and it is the most common crash class for a UI-heavy app.

**Why it was deferred**: `global-error.tsx` replaces the root layout, so it renders *outside*
`NextIntlClientProvider`. Correct copy requires resolving the locale cookie client-side and
bundling both message files; a correct surface requires a `DESIGN.md` treatment. That is a
user-facing product surface, not a monitoring wire-up. Cost of deferral is currently zero because
no environment has a Sentry DSN configured.

**Do this when**: a real DSN is provisioned (pairs naturally with FU-3).

**Shape of the work**:
1. `src/app/global-error.tsx` — client component rendering its own `<html><body>`, calling
   `Sentry.captureException(error)` in a `useEffect` keyed on `error`.
2. Locale: read the `LOCALE_COOKIE_NAME` cookie (`src/i18n/routing.ts`) client-side and pick copy
   from a small inline `{ pl, en }` map — do **not** try to mount `NextIntlClientProvider` here,
   since the failure being handled may be in the provider tree itself.
3. Copy per `context/foundation/product-voice.md`; visual treatment per `DESIGN.md`. Keep it
   dependency-free so it cannot itself crash.
4. Co-located render test asserting `captureException` is called once with the thrown error.

---

## FU-2 — Bound the cost of the public `/api/health` probe

**From**: F2 (WARNING).

**Problem**: `GET /api/health` is public and `force-dynamic`. Every anonymous request costs one
Neon `SELECT 1` (billed serverless compute) plus one outbound HTTPS request to
`${NEON_AUTH_BASE_URL}/.well-known/jwks.json`. There is no rate limit anywhere in the app — there
is no `middleware.ts` (see `context/foundation/auth-boundary.md` §4) — so a trivial request loop
amplifies into sustained load on two paid/third-party dependencies.

The response body itself is safe (`{ status, checks: { database, auth } }` — no user data, no
version, no stack), all failures degrade to 503, and both checks are bounded at 5s. The issue is
cost/availability, not disclosure.

**Options**:
- **Short-TTL memo (preferred)**: cache the computed result for ~5s in module scope so a flood
  collapses to one dependency round-trip per window. Requires a reset seam for the tests —
  `src/app/api/health/route.test.ts` calls `GET()` six times with different mock outcomes and
  would otherwise read stale results. Pick the TTL against the chosen uptime-monitor interval.
- **Platform rate limit**: constrain the route at the edge (Vercel) instead. Zero code change; not
  yet verified whether the deploy target's default protection already covers this.

Tradeoff to weigh either way: a TTL means a deploy gate polling immediately after recovery reads a
stale `degraded` for up to the TTL.

---

## FU-3 — Sentry DSN provisioning cleanup

**From**: F6 + F8 (OBSERVATIONS). Do these together when a real DSN is first configured.

1. **Server-only DSN.** `sentry.server.config.ts` and `sentry.edge.config.ts` currently gate on
   `NEXT_PUBLIC_SENTRY_DSN`, which is inlined at build time — so enabling server monitoring on
   Vercel needs a rebuild, not just a dashboard env change, and the server DSN rides along in the
   client bundle. Add an optional server-only `SENTRY_DSN` to `src/env.js` and read
   `process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN` in both configs. (The current
   shape matches the plan's contract verbatim and the rebuild caveat is already documented in
   `../sentry-manual-verification.md` — this is a refinement, not a defect.)
2. **Silence health-probe transactions.** Uptime pings to `/api/health` each create a Sentry
   transaction and consume quota. Add `ignoreTransactions: ["GET /api/health"]` to the server init.
3. **Close out plan items 3.4 / 3.5** using `../sentry-manual-verification.md`.
