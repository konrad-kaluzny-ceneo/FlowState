import * as Sentry from "@sentry/nextjs";

/**
 * Next.js client instrumentation hook — runs before the app becomes interactive.
 *
 * `process.env.NEXT_PUBLIC_SENTRY_DSN` (not `~/env.js`) is read on purpose: this module boots
 * before the app, and Next inlines `NEXT_PUBLIC_*` at build time. The var is still declared and
 * validated in `src/env.js`. With no DSN, `Sentry.init` never runs — no transport, no
 * instrumentation of fetch/XHR, no network traffic.
 */
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
	Sentry.init({
		dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
		tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
		replaysSessionSampleRate: 0,
		replaysOnErrorSampleRate: 1.0,
		integrations: [Sentry.replayIntegration()],
	});
}

/** No-ops until `Sentry.init` has bound a client (i.e. when no DSN is configured). */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
