import { randomUUID } from "node:crypto";
import type { APIRequestContext, APIResponse } from "@playwright/test";

interface TestUserCredentials {
	email: string;
	password: string;
	name: string;
}

const AUTH_RATE_LIMIT_STATUSES = new Set([429, 503]);

export async function postAuthWithRetry(
	request: APIRequestContext,
	url: string,
	data: Record<string, string>,
): Promise<APIResponse> {
	const maxAttempts = process.env.CI ? 10 : 3;
	let lastResponse: APIResponse | undefined;

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		const response = await request.post(url, { data });
		if (!AUTH_RATE_LIMIT_STATUSES.has(response.status())) {
			return response;
		}
		lastResponse = response;
		if (attempt < maxAttempts) {
			const baseMs = Math.min(30_000, 1_000 * 2 ** (attempt - 1));
			const jitterMs = Math.floor(Math.random() * 1_000);
			await new Promise((resolve) => setTimeout(resolve, baseMs + jitterMs));
		}
	}

	if (!lastResponse) {
		throw new Error(`Auth request to ${url} failed with no response`);
	}

	return lastResponse;
}

/**
 * Create a unique test user via the sign-up API.
 * Uses UUID-based email for isolation between tests.
 */
export async function createTestUser(
	request: APIRequestContext,
	overrides?: Partial<TestUserCredentials>,
): Promise<TestUserCredentials> {
	const id = randomUUID().slice(0, 8);
	const credentials: TestUserCredentials = {
		email: overrides?.email ?? `test-${id}@flowstate-e2e.local`,
		password: overrides?.password ?? `TestPass!${id}`,
		name: overrides?.name ?? `E2E User ${id}`,
	};

	const response = await postAuthWithRetry(request, "/api/auth/sign-up/email", {
		email: credentials.email,
		password: credentials.password,
		name: credentials.name,
	});

	if (!response.ok()) {
		const body = await response.text();
		throw new Error(
			`Failed to create test user ${credentials.email}: ${response.status()} ${body}`,
		);
	}

	return credentials;
}

/**
 * Sign in as a user via the API and return the storage state (cookies).
 * Useful for per-test isolated authentication.
 */
export async function signInAsUser(
	request: APIRequestContext,
	credentials: Pick<TestUserCredentials, "email" | "password">,
): Promise<{
	cookies: Array<{
		name: string;
		value: string;
		domain: string;
		path: string;
	}>;
	origins: Array<{
		origin: string;
		localStorage: Array<{ name: string; value: string }>;
	}>;
}> {
	const response = await postAuthWithRetry(request, "/api/auth/sign-in/email", {
		email: credentials.email,
		password: credentials.password,
	});

	if (!response.ok()) {
		const body = await response.text();
		throw new Error(
			`Failed to sign in as ${credentials.email}: ${response.status()} ${body}`,
		);
	}

	return await request.storageState();
}
