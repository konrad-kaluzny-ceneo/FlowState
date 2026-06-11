import { beforeEach, describe, expect, it, vi } from "vitest";

const signInEmail = vi.fn();

vi.mock("~/lib/auth/server", () => ({
	auth: {
		signIn: {
			email: (...args: unknown[]) => signInEmail(...args),
		},
	},
}));

vi.mock("next/navigation", () => ({
	redirect: vi.fn(),
}));

vi.mock("@neondatabase/auth/next/server", () => ({
	NEON_AUTH_NETWORK_ERROR_CODES: [
		"NETWORK_DNS",
		"NETWORK_REFUSED",
		"NETWORK_TIMEOUT",
		"NETWORK_TLS",
		"NETWORK_RESET",
	],
}));

function makeFormData(email: string, password: string): FormData {
	const formData = new FormData();
	formData.set("email", email);
	formData.set("password", password);
	return formData;
}

describe("signInAction", () => {
	let signInAction: typeof import("./action").signInAction;

	beforeEach(async () => {
		vi.clearAllMocks();
		const actionModule = await import("./action");
		signInAction = actionModule.signInAction;
	});

	it("returns field error when email and password are empty", async () => {
		const result = await signInAction(
			{ error: null, email: "" },
			makeFormData("", ""),
		);

		expect(result.error).toContain("email");
		expect(result.error).toContain("password");
		expect(signInEmail).not.toHaveBeenCalled();
	});

	it("returns generic error for invalid credentials", async () => {
		signInEmail.mockResolvedValue({
			error: { code: "INVALID_CREDENTIALS", message: "bad" },
		});

		const result = await signInAction(
			{ error: null, email: "" },
			makeFormData("user@example.com", "secret123"),
		);

		expect(result.error).toBe("Invalid email or password. Please try again.");
		expect(result.email).toBe("user@example.com");
	});

	it("maps network error codes to connection message", async () => {
		signInEmail.mockResolvedValue({
			error: { code: "NETWORK_TIMEOUT", message: "timeout" },
		});

		const result = await signInAction(
			{ error: null, email: "" },
			makeFormData("user@example.com", "secret123"),
		);

		expect(result.error).toBe(
			"Could not complete the request. Please check your connection and try again.",
		);
	});
});
