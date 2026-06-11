import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NEON_AUTH_SESSION_VERIFIER_PARAM } from "~/lib/auth/public-paths";

import { OAuthSessionVerifier } from "./oauth-session-verifier";

const { getSession, refresh } = vi.hoisted(() => ({
	getSession: vi.fn(),
	refresh: vi.fn(),
}));

vi.mock("~/lib/auth/client", () => ({
	authClient: {
		getSession,
	},
}));

vi.mock("next/navigation", () => ({
	useRouter: () => ({ refresh }),
}));

describe("OAuthSessionVerifier", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		window.history.replaceState({}, "", "/");
	});

	it("does nothing when verifier param is absent", () => {
		render(<OAuthSessionVerifier />);

		expect(getSession).not.toHaveBeenCalled();
		expect(refresh).not.toHaveBeenCalled();
	});

	it("exchanges verifier param for session and refreshes router", async () => {
		window.history.replaceState(
			{},
			"",
			`/?${NEON_AUTH_SESSION_VERIFIER_PARAM}=test-verifier`,
		);
		getSession.mockResolvedValue({ data: { session: {} } });

		render(<OAuthSessionVerifier />);

		await waitFor(() => {
			expect(getSession).toHaveBeenCalledTimes(1);
		});
		expect(refresh).toHaveBeenCalledTimes(1);
	});

	it("does not refresh router when session exchange fails", async () => {
		window.history.replaceState(
			{},
			"",
			`/?${NEON_AUTH_SESSION_VERIFIER_PARAM}=test-verifier`,
		);
		getSession.mockRejectedValue(new Error("session exchange failed"));

		const { container } = render(<OAuthSessionVerifier />);

		await waitFor(() => {
			expect(getSession).toHaveBeenCalledTimes(1);
		});
		expect(refresh).not.toHaveBeenCalled();
		expect(container.firstChild).toBeNull();
	});
});
