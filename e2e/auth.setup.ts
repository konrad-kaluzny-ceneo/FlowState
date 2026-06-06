import path from "node:path";
import { test as setup } from "@playwright/test";

const authFile = path.join(
	import.meta.dirname,
	"../playwright/.auth/user.json",
);

setup("authenticate", async ({ request }) => {
	const email = process.env.E2E_TEST_EMAIL;
	const password = process.env.E2E_TEST_PASSWORD;

	if (!email || !password) {
		throw new Error(
			"Missing E2E_TEST_EMAIL or E2E_TEST_PASSWORD env vars for auth setup.",
		);
	}

	const response = await request.post("/api/auth/sign-in/email", {
		data: { email, password },
	});

	if (!response.ok()) {
		const body = await response.text();
		throw new Error(
			`Auth sign-in failed: ${response.status()} ${response.statusText()} — ${body}`,
		);
	}

	await request.storageState({ path: authFile });
});
