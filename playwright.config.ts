import path from "node:path";
import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

// Load .env and .env.local (same precedence as Next.js)
dotenv.config({ path: path.resolve(import.meta.dirname, ".env") });
dotenv.config({
	path: path.resolve(import.meta.dirname, ".env.local"),
	override: true,
});

export default defineConfig({
	globalSetup: "./e2e/global.setup.ts",
	testDir: "./e2e",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: "html",
	use: {
		baseURL: "http://localhost:3000",
		trace: "on-first-retry",
	},
	projects: [
		{
			name: "auth-setup",
			testMatch: /auth\.setup\.ts/,
		},
		{
			name: "chromium",
			use: {
				...devices["Desktop Chrome"],
				storageState: "playwright/.auth/user.json",
			},
			dependencies: ["auth-setup"],
		},
	],
	webServer: {
		command: "pnpm dev",
		url: "http://localhost:3000",
		reuseExistingServer: true,
	},
});
