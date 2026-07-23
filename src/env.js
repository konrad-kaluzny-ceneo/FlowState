import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
	/**
	 * Specify your server-side environment variables schema here. This way you can ensure the app
	 * isn't built with invalid env vars.
	 */
	server: {
		DATABASE_URL: z
			.string()
			.refine(
				(val) =>
					val.startsWith("postgresql://") || val.startsWith("postgres://"),
				{
					message:
						"DATABASE_URL must be a postgresql:// or postgres:// connection string",
				},
			),
		DATABASE_URL_UNPOOLED: z
			.string()
			.refine(
				(val) =>
					val.startsWith("postgresql://") || val.startsWith("postgres://"),
				{
					message:
						"DATABASE_URL_UNPOOLED must be a postgresql:// or postgres:// connection string",
				},
			),
		NEON_AUTH_BASE_URL: z
			.string()
			.url()
			.refine((val) => val.startsWith("https://"), {
				message: "NEON_AUTH_BASE_URL must start with https://",
			}),
		NEON_AUTH_COOKIE_SECRET: z.string().min(32, {
			message: "NEON_AUTH_COOKIE_SECRET must be at least 32 characters",
		}),
		NODE_ENV: z
			.enum(["development", "test", "production"])
			.default("development"),
		/** Sentry auth token for source-map uploads (optional — no uploads when absent) */
		SENTRY_AUTH_TOKEN: z.string().optional(),
		/** Sentry org slug — build-time only, used by `withSentryConfig` in `next.config.js` */
		SENTRY_ORG: z.string().optional(),
		/** Sentry project slug — build-time only, used by `withSentryConfig` in `next.config.js` */
		SENTRY_PROJECT: z.string().optional(),
	},

	/**
	 * Specify your client-side environment variables schema here. This way you can ensure the app
	 * isn't built with invalid env vars. To expose them to the client, prefix them with
	 * `NEXT_PUBLIC_`.
	 */
	client: {
		/** Set to "1" in Playwright webServer so fake timers advance the countdown. */
		NEXT_PUBLIC_E2E_MAIN_THREAD_TIMER: z.enum(["1"]).optional(),
		/** Milliseconds before return handoff shows; Playwright sets "1" for belt specs. */
		NEXT_PUBLIC_E2E_RETURN_HANDOFF_THRESHOLD_MS: z.string().optional(),
		/** Sentry DSN for error monitoring (optional — Sentry disabled when absent) */
		NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
	},

	/**
	 * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
	 * middlewares) or client-side so we need to destruct manually.
	 */
	runtimeEnv: {
		DATABASE_URL: process.env.DATABASE_URL,
		DATABASE_URL_UNPOOLED: process.env.DATABASE_URL_UNPOOLED,
		NEON_AUTH_BASE_URL: process.env.NEON_AUTH_BASE_URL,
		NEON_AUTH_COOKIE_SECRET: process.env.NEON_AUTH_COOKIE_SECRET,
		NODE_ENV: process.env.NODE_ENV,
		SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN,
		SENTRY_ORG: process.env.SENTRY_ORG,
		SENTRY_PROJECT: process.env.SENTRY_PROJECT,
		NEXT_PUBLIC_E2E_MAIN_THREAD_TIMER:
			process.env.NEXT_PUBLIC_E2E_MAIN_THREAD_TIMER,
		NEXT_PUBLIC_E2E_RETURN_HANDOFF_THRESHOLD_MS:
			process.env.NEXT_PUBLIC_E2E_RETURN_HANDOFF_THRESHOLD_MS,
		NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
	},
	/**
	 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
	 * useful for Docker builds.
	 */
	skipValidation: !!process.env.SKIP_ENV_VALIDATION,
	/**
	 * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
	 * `SOME_VAR=''` will throw an error.
	 */
	emptyStringAsUndefined: true,
});
