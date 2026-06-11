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

// NEXT_PUBLIC_* is baked at build time — export before `pnpm build` on production e2e path.
const e2eBuildEnv =
	process.platform === "win32"
		? "set NEXT_PUBLIC_E2E_MAIN_THREAD_TIMER=1&& "
		: "NEXT_PUBLIC_E2E_MAIN_THREAD_TIMER=1 ";

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
	use: {
		baseURL: e2eBaseUrl,
		trace: "on-first-retry",
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
				: { NEXT_PUBLIC_E2E_MAIN_THREAD_TIMER: "1" }),
		},
	},
});
