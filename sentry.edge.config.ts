import * as Sentry from "@sentry/nextjs";

/**
 * Edge runtime Sentry init, loaded from `src/instrumentation.ts`.
 *
 * `process.env` (not `~/env.js`) is read on purpose — the edge runtime has no full Node env and
 * this module runs before the app modules load. The var is declared and validated in `src/env.js`.
 * With no DSN, `Sentry.init` never runs: no transport is created and nothing is sent.
 */
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
	Sentry.init({
		dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
		tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
	});
}
