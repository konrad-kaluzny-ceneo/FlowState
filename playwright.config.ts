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

export default defineConfig({
	globalSetup: "./e2e/global.setup.ts",
	testDir: "./e2e",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: 0,
	workers: 1,
	reporter: "html",
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
		command: `pnpm build && pnpm exec next start -p ${e2ePort}`,
		url: e2eBaseUrl,
		reuseExistingServer: !!process.env.E2E_REUSE_SERVER,
		timeout: 300_000,
		env: {
			...process.env,
			NEXT_PUBLIC_E2E_MAIN_THREAD_TIMER: "1",
		},
	},
});
