import fs from "node:fs";
import path from "node:path";

import { type FullConfig, request } from "@playwright/test";

import { AUTH_POOL_SIZE, getE2eStartupTimeoutMs } from "./env";
import { createTestUser, postAuthWithRetry } from "./helpers/user";

const AUTH_DIR = path.join(import.meta.dirname, ".auth");

function resolveBaseURL(config: FullConfig): string {
	const fromConfig = config.projects[0]?.use?.baseURL;
	if (typeof fromConfig === "string" && fromConfig.length > 0) {
		return fromConfig;
	}
	const port = process.env.E2E_PORT ?? "3001";
	return `http://localhost:${port}`;
}

async function waitForServer(baseURL: string, timeoutMs: number) {
	const deadline = Date.now() + timeoutMs;
	let lastError: unknown;

	while (Date.now() < deadline) {
		try {
			const ctx = await request.newContext({ baseURL });
			const response = await ctx.get("/");
			await ctx.dispose();
			if (response.ok()) {
				return;
			}
		} catch (error) {
			lastError = error;
		}
		await new Promise((resolve) => setTimeout(resolve, 1_000));
	}

	throw new Error(
		`E2E server at ${baseURL} not ready within ${timeoutMs}ms${lastError ? `: ${lastError}` : ""}`,
	);
}

async function provisionWorkerAuth(baseURL: string, workerIndex: number) {
	const authPath = path.join(AUTH_DIR, `worker-${workerIndex}.json`);
	const ctx = await request.newContext({ baseURL });
	try {
		const user = await createTestUser(ctx);
		const signInResponse = await postAuthWithRetry(
			ctx,
			"/api/auth/sign-in/email",
			{
				email: user.email,
				password: user.password,
			},
		);
		if (!signInResponse.ok()) {
			const body = await signInResponse.text();
			throw new Error(
				`Worker ${workerIndex} sign-in failed: ${signInResponse.status()} ${body}`,
			);
		}
		await ctx.storageState({ path: authPath });
	} finally {
		await ctx.dispose();
	}
}

export default async function globalSetup(config: FullConfig) {
	const baseURL = resolveBaseURL(config);
	const startupTimeoutMs = getE2eStartupTimeoutMs();

	// Playwright starts webServer before globalSetup (see playwright.config.ts).
	try {
		await waitForServer(baseURL, startupTimeoutMs);
	} catch (error) {
		const hint =
			process.env.E2E_REUSE_SERVER === "1"
				? "Start next dev on E2E_PORT with NEXT_PUBLIC_E2E_MAIN_THREAD_TIMER=1, or unset E2E_REUSE_SERVER."
				: "Playwright webServer should start the app; check port conflicts on E2E_PORT.";
		throw new Error(
			`${error instanceof Error ? error.message : error}. ${hint}`,
		);
	}

	fs.mkdirSync(AUTH_DIR, { recursive: true });

	for (let i = 0; i < AUTH_POOL_SIZE; i++) {
		await provisionWorkerAuth(baseURL, i);
	}
}
