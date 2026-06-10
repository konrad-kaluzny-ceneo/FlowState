import { type ChildProcess, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { type FullConfig, request } from "@playwright/test";

import { createTestUser, postAuthWithRetry } from "./helpers/user";

const AUTH_DIR = path.join(import.meta.dirname, ".auth");
const WORKER_POOL_SIZE = 4;

function resolveBaseURL(config: FullConfig): string {
	const fromConfig = config.projects[0]?.use?.baseURL;
	if (typeof fromConfig === "string" && fromConfig.length > 0) {
		return fromConfig;
	}
	const port = process.env.E2E_PORT ?? "3001";
	return `http://localhost:${port}`;
}

function isProductionE2eServer(): boolean {
	return (
		process.env.E2E_PRODUCTION_SERVER === "1" || !!process.env.GITHUB_ACTIONS
	);
}

function webServerCommand(port: string): string {
	const useProduction = isProductionE2eServer();
	if (useProduction) {
		const buildEnv =
			process.platform === "win32"
				? "set NEXT_PUBLIC_E2E_MAIN_THREAD_TIMER=1&& "
				: "NEXT_PUBLIC_E2E_MAIN_THREAD_TIMER=1 ";
		return `${buildEnv}pnpm build && pnpm exec next start -p ${port}`;
	}
	return `pnpm exec next dev --turbo -p ${port}`;
}

async function waitForServer(baseURL: string, timeoutMs: number) {
	const deadline = Date.now() + timeoutMs;
	let lastError: unknown;

	while (Date.now() < deadline) {
		try {
			const ctx = await request.newContext({ baseURL });
			const response = await ctx.get("/");
			await ctx.dispose();
			if (response.ok() || response.status() < 500) {
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

function startWebServer(port: string): ChildProcess {
	const command = webServerCommand(port);
	const child = spawn(command, {
		cwd: path.resolve(import.meta.dirname, ".."),
		env: {
			...process.env,
			NEXT_PUBLIC_E2E_MAIN_THREAD_TIMER: "1",
		},
		shell: true,
		stdio: "pipe",
	});
	child.stdout?.on("data", () => {});
	child.stderr?.on("data", () => {});
	return child;
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
	const port = process.env.E2E_PORT ?? "3001";
	const startupTimeoutMs = isProductionE2eServer() ? 300_000 : 120_000;

	try {
		await waitForServer(baseURL, 5_000);
	} catch {
		startWebServer(port);
		await waitForServer(baseURL, startupTimeoutMs);
	}

	fs.mkdirSync(AUTH_DIR, { recursive: true });

	for (let i = 0; i < WORKER_POOL_SIZE; i++) {
		await provisionWorkerAuth(baseURL, i);
	}
}
