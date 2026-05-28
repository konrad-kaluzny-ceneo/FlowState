import type { FullConfig } from "@playwright/test";

/**
 * Global setup: ensures the shared test user exists in Neon Auth.
 * POST to /api/auth/sign-up/email — handles "already exists" as success (idempotent).
 */
async function globalSetup(config: FullConfig) {
	const baseURL = config.projects[0]?.use?.baseURL ?? "http://localhost:3000";

	const { hostname } = new URL(baseURL);
	const allowedHosts = new Set(["localhost", "127.0.0.1", "::1"]);
	if (!allowedHosts.has(hostname)) {
		throw new Error(
			`E2E tests must not run against non-localhost. baseURL: ${baseURL}`,
		);
	}

	const email = process.env.E2E_TEST_EMAIL;
	const password = process.env.E2E_TEST_PASSWORD;
	const name = process.env.E2E_TEST_NAME;

	if (!email || !password || !name) {
		throw new Error(
			"Missing E2E test user env vars. Set E2E_TEST_EMAIL, E2E_TEST_PASSWORD, and E2E_TEST_NAME in .env",
		);
	}

	const response = await fetch(`${baseURL}/api/auth/sign-up/email`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Origin: baseURL,
		},
		body: JSON.stringify({ email, password, name }),
	});

	// Success or "already exists" are both acceptable
	if (response.ok) {
		console.log("[global-setup] Test user created or already exists.");
		return;
	}

	const body = await response.text();

	// 409/422 are canonical "conflict / already exists" signals
	if (response.status === 409 || response.status === 422) {
		console.log(
			`[global-setup] Test user provisioning returned ${response.status} — treating as exists.`,
		);
		return;
	}

	// Fallback: check body text for "already exists" variants from Better Auth
	if (
		body.toLowerCase().includes("already") ||
		body.toLowerCase().includes("exists") ||
		body.toLowerCase().includes("registered")
	) {
		console.log("[global-setup] Test user already exists — OK.");
		return;
	}

	throw new Error(
		`[global-setup] Failed to provision test user: ${response.status} ${body}`,
	);
}

export default globalSetup;
