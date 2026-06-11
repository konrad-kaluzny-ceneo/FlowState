import { beforeEach, describe, expect, it, vi } from "vitest";

const signUpEmail = vi.fn();

vi.mock("~/lib/auth/server", () => ({
	auth: {
		signUp: {
			email: (...args: unknown[]) => signUpEmail(...args),
		},
	},
}));

vi.mock("next/navigation", () => ({
	redirect: vi.fn(),
}));

function makeFormData(name: string, email: string, password: string): FormData {
	const formData = new FormData();
	formData.set("name", name);
	formData.set("email", email);
	formData.set("password", password);
	return formData;
}

describe("signUpAction", () => {
	let signUpAction: typeof import("./actions").signUpAction;

	beforeEach(async () => {
		vi.clearAllMocks();
		const actionModule = await import("./actions");
		signUpAction = actionModule.signUpAction;
	});

	it("returns validation errors for invalid sign-up input", async () => {
		const result = await signUpAction(
			{ errors: {}, values: { name: "", email: "" } },
			makeFormData("", "not-an-email", "short"),
		);

		expect(result.errors.email).toBeTruthy();
		expect(result.errors.password).toBeTruthy();
		expect(signUpEmail).not.toHaveBeenCalled();
	});

	it("maps duplicate email auth errors to email field message", async () => {
		signUpEmail.mockResolvedValue({
			error: { message: "Email already registered" },
		});

		const result = await signUpAction(
			{ errors: {}, values: { name: "", email: "" } },
			makeFormData("Konrad", "user@example.com", "password123"),
		);

		expect(result.errors.email).toBe(
			"This email is already associated with an existing account",
		);
	});

	it("returns form error on unexpected auth failure", async () => {
		signUpEmail.mockResolvedValue({
			error: { message: "service unavailable" },
		});

		const result = await signUpAction(
			{ errors: {}, values: { name: "", email: "" } },
			makeFormData("Konrad", "user@example.com", "password123"),
		);

		expect(result.errors.form).toBe(
			"Could not complete the request. Please try again.",
		);
	});
});
