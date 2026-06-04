import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
	/**
	 * Specify your server-side environment variables schema here. This way you can ensure the app
	 * isn't built with invalid env vars.
	 */
	server: {
		/** Set to "1" in Playwright webServer to allow 1s work/break cycles in API validation. */
		E2E_FAST_DURATIONS: z.enum(["1"]).optional(),
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
	},

	/**
	 * Specify your client-side environment variables schema here. This way you can ensure the app
	 * isn't built with invalid env vars. To expose them to the client, prefix them with
	 * `NEXT_PUBLIC_`.
	 */
	client: {
		/** Set to "1" in Playwright webServer so fake timers advance the countdown. */
		NEXT_PUBLIC_E2E_MAIN_THREAD_TIMER: z.enum(["1"]).optional(),
		/** Set to "1" with E2E_FAST_DURATIONS — shows 1 sec preset and relaxes min duration. */
		NEXT_PUBLIC_E2E_FAST_DURATIONS: z.enum(["1"]).optional(),
	},

	/**
	 * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
	 * middlewares) or client-side so we need to destruct manually.
	 */
	runtimeEnv: {
		E2E_FAST_DURATIONS: process.env.E2E_FAST_DURATIONS,
		DATABASE_URL: process.env.DATABASE_URL,
		DATABASE_URL_UNPOOLED: process.env.DATABASE_URL_UNPOOLED,
		NEON_AUTH_BASE_URL: process.env.NEON_AUTH_BASE_URL,
		NEON_AUTH_COOKIE_SECRET: process.env.NEON_AUTH_COOKIE_SECRET,
		NODE_ENV: process.env.NODE_ENV,
		NEXT_PUBLIC_E2E_MAIN_THREAD_TIMER:
			process.env.NEXT_PUBLIC_E2E_MAIN_THREAD_TIMER,
		NEXT_PUBLIC_E2E_FAST_DURATIONS:
			process.env.NEXT_PUBLIC_E2E_FAST_DURATIONS,
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
