import * as Sentry from "@sentry/nextjs";

/**
 * Next.js server/edge instrumentation hook.
 *
 * Lives under `src/` because the app uses the `src/app` layout — the production build only
 * scans the directory that contains `app/` for this convention file.
 *
 * The imported configs gate `Sentry.init` on `NEXT_PUBLIC_SENTRY_DSN`, so with no DSN this
 * registers nothing and produces no network traffic.
 */
export async function register() {
	if (process.env.NEXT_RUNTIME === "nodejs") {
		await import("../sentry.server.config");
	}

	if (process.env.NEXT_RUNTIME === "edge") {
		await import("../sentry.edge.config");
	}
}

/**
 * Forwards Next.js request errors to Sentry. No-ops when `Sentry.init` never ran (no DSN),
 * because the SDK then has no client bound to the current scope.
 */
export const onRequestError = Sentry.captureRequestError;
