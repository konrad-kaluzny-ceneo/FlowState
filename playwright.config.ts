import path from "node:path";
import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

import {
	getE2eBaseUrl,
	getE2ePort,
	getE2eWorkerCount,
	isProductionE2eServer,
	shouldReuseExistingServer,
} from "./e2e/env";

// Load .env and .env.local (same precedence as Next.js)
dotenv.config({ path: path.resolve(import.meta.dirname, ".env") });
dotenv.config({
	path: path.resolve(import.meta.dirname, ".env.local"),
	override: true,
});

const e2ePort = getE2ePort();
const e2eBaseUrl = getE2eBaseUrl();
const useProductionServer = isProductionE2eServer();
/** Trial run: `set E2E_PROBE=1` — tight timeouts to surface slow steps (not for CI). */
const e2eProbe = process.env.E2E_PROBE === "1";

// NEXT_PUBLIC_* is baked at build time — export before `pnpm build` on production e2e path.
const e2eBuildEnv =
	process.platform === "win32"
		? "set NEXT_PUBLIC_E2E_MAIN_THREAD_TIMER=1&& set NEXT_PUBLIC_E2E_RETURN_HANDOFF_THRESHOLD_MS=1&& "
		: "NEXT_PUBLIC_E2E_MAIN_THREAD_TIMER=1 NEXT_PUBLIC_E2E_RETURN_HANDOFF_THRESHOLD_MS=1 ";

/** CI pre-builds in the workflow; local production e2e still builds inline. */
const webServerCommand = useProductionServer
	? process.env.GITHUB_ACTIONS
		? `pnpm exec next start -p ${e2ePort}`
		: `${e2eBuildEnv}pnpm build && pnpm exec next start -p ${e2ePort}`
	: `pnpm exec next dev --turbo -p ${e2ePort}`;

export default defineConfig({
	testDir: "./e2e",
	globalSetup: "./e2e/global-setup.ts",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: 0,
	workers: getE2eWorkerCount(),
	reporter: process.env.CI ? "list" : "html",
	...(e2eProbe
		? {
				timeout: 20_000,
				expect: { timeout: 4_000 },
				globalTimeout: 180_000,
			}
		: {}),
	use: {
		baseURL: e2eBaseUrl,
		trace: "on-first-retry",
		...(e2eProbe ? { actionTimeout: 5_000, navigationTimeout: 10_000 } : {}),
	},
	projects: [
		{
			name: "chromium",
			use: {
				...devices["Desktop Chrome"],
			},
			testIgnore: /guest-.*\.spec\.ts/,
		},
		{
			name: "guest-chromium",
			use: {
				...devices["Desktop Chrome"],
			},
			testMatch: /guest-.*\.spec\.ts/,
		},
		{
			// Visual-rhythm belt at phone width (fix-home-layout-spacing).
			// Scoped to the layout spec so the mobile pass doesn't double belt time.
			name: "mobile-chromium",
			use: {
				...devices["Desktop Chrome"],
				viewport: { width: 375, height: 812 },
			},
			testMatch: /layout-rhythm\.spec\.ts/,
		},
	],
	webServer: {
		command: webServerCommand,
		url: e2eBaseUrl,
		reuseExistingServer: shouldReuseExistingServer(),
		timeout: useProductionServer ? 300_000 : 120_000,
		env: {
			...process.env,
			// Dev-only: prod bundles bake this at build time (ci.yml job env / e2eBuildEnv).
			...(useProductionServer
				? {}
				: {
						NEXT_PUBLIC_E2E_MAIN_THREAD_TIMER: "1",
						NEXT_PUBLIC_E2E_RETURN_HANDOFF_THRESHOLD_MS: "1",
					}),
		},
	},
});
