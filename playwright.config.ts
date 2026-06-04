import path from "node:path";
import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

// Load .env and .env.local (same precedence as Next.js)
dotenv.config({ path: path.resolve(import.meta.dirname, ".env") });
dotenv.config({
	path: path.resolve(import.meta.dirname, ".env.local"),
	override: true,
});

const e2ePort = process.env.E2E_PORT ?? "3001";
const e2eBaseUrl = `http://localhost:${e2ePort}`;

/** GitHub Actions / explicit E2E_PRODUCTION_SERVER=1 → build + next start. Otherwise next dev (fast local). */
const useProductionServer =
	process.env.E2E_PRODUCTION_SERVER === "1" || !!process.env.GITHUB_ACTIONS;

const webServerCommand = useProductionServer
	? `pnpm build && pnpm exec next start -p ${e2ePort}`
	: `pnpm exec next dev --turbo -p ${e2ePort}`;

const workerCount = process.env.E2E_WORKERS
	? Number.parseInt(process.env.E2E_WORKERS, 10)
	: process.env.CI
		? 4
		: undefined;

export default defineConfig({
	globalSetup: "./e2e/global.setup.ts",
	testDir: "./e2e",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: 0,
	workers: workerCount,
	reporter: process.env.CI ? "list" : "html",
	use: {
		baseURL: e2eBaseUrl,
		trace: "on-first-retry",
	},
	projects: [
		{
			name: "auth-setup",
			testMatch: /auth\.setup\.ts/,
		},
		{
			name: "chromium",
			// Shared auth storageState + one RUNNING cycle in DB — keep auth specs serial.
			fullyParallel: false,
			use: {
				...devices["Desktop Chrome"],
				storageState: "playwright/.auth/user.json",
			},
			dependencies: ["auth-setup"],
			testIgnore: /guest-trial\.spec\.ts/,
		},
		{
			name: "guest-chromium",
			use: {
				...devices["Desktop Chrome"],
			},
			testMatch: /guest-trial\.spec\.ts/,
		},
	],
	webServer: {
		command: webServerCommand,
		url: e2eBaseUrl,
		// Local: reuse an existing dev server on E2E_PORT (e.g. manual pnpm dev -p 3001).
		reuseExistingServer: !useProductionServer,
		timeout: useProductionServer ? 300_000 : 120_000,
		env: {
			...process.env,
			NEXT_PUBLIC_E2E_MAIN_THREAD_TIMER: "1",
		},
	},
});
