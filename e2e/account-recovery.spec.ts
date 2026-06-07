/**
 * Risk: S-07 — account recovery initiation (no email capture in CI)
 * Spec role: forgot link, form success, request-reset API smoke
 */
import { expect, test } from "@playwright/test";

import { createTestUser, postAuthWithRetry } from "./helpers/user";

test.describe("Account recovery (S-07)", () => {
	test("sign-in shows Forgot password link to forgot-password page", async ({
		page,
	}) => {
		await page.goto("/auth/sign-in");

		const link = page.getByRole("link", { name: "Forgot password?" });
		await expect(link).toBeVisible();
		await expect(link).toHaveAttribute("href", "/auth/forgot-password");
	});

	test("forgot-password form shows generic success message after submit", async ({
		page,
	}) => {
		await page.goto("/auth/forgot-password");

		await page.getByLabel("Email").fill("anyone@example.com");
		await page.getByRole("button", { name: "Send reset link" }).click();

		await expect(page.getByRole("status")).toContainText(
			"If an account exists for that email",
		);
	});

	test("request-password-reset API returns 2xx for known user", async ({
		request,
		baseURL,
	}) => {
		const user = await createTestUser(request);
		const redirectTo = `${baseURL}/auth/reset-password`;

		const response = await postAuthWithRetry(
			request,
			"/api/auth/request-password-reset",
			{
				email: user.email,
				redirectTo,
			},
		);

		expect(response.ok()).toBe(true);
	});
});
