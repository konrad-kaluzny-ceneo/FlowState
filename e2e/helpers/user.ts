import { randomUUID } from "node:crypto";
import type { APIRequestContext } from "@playwright/test";

interface TestUserCredentials {
	email: string;
	password: string;
	name: string;
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

	const response = await request.post("/api/auth/sign-up/email", {
		data: {
			email: credentials.email,
			password: credentials.password,
			name: credentials.name,
		},
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
	const response = await request.post("/api/auth/sign-in/email", {
		data: {
			email: credentials.email,
			password: credentials.password,
		},
	});

	if (!response.ok()) {
		const body = await response.text();
		throw new Error(
			`Failed to sign in as ${credentials.email}: ${response.status()} ${body}`,
		);
	}

	return await request.storageState();
}
