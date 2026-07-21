/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import { withSentryConfig } from "@sentry/nextjs";
import createNextIntlPlugin from "next-intl/plugin";

import { env } from "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/**
 * Sentry wraps the build unconditionally so the runtime hooks are always wired, but every
 * side effect is gated: source-map upload needs `SENTRY_AUTH_TOKEN`, and `Sentry.init` itself
 * only runs when `NEXT_PUBLIC_SENTRY_DSN` is set (see `instrumentation*.ts` / `sentry.*.config.ts`).
 * With neither set the build produces no Sentry network traffic and no console noise.
 */
export default withSentryConfig(withNextIntl(config), {
	org: env.SENTRY_ORG,
	project: env.SENTRY_PROJECT,
	authToken: env.SENTRY_AUTH_TOKEN,
	silent: !process.env.CI,
	telemetry: false,
	sourcemaps: {
		disable: !env.SENTRY_AUTH_TOKEN,
	},
});
