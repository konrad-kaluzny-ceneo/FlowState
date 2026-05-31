"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { authClient } from "~/lib/auth/client";
import { NEON_AUTH_SESSION_VERIFIER_PARAM } from "~/lib/auth/public-paths";

/**
 * Completes the Google/OAuth redirect when Neon Auth lands with
 * `neon_auth_session_verifier` in the URL. The SDK forwards that param to
 * `/api/auth/get-session`, which sets the session cookies.
 */
export function OAuthSessionVerifier() {
	const router = useRouter();
	const startedRef = useRef(false);

	useEffect(() => {
		if (startedRef.current) {
			return;
		}

		const params = new URLSearchParams(window.location.search);
		if (!params.has(NEON_AUTH_SESSION_VERIFIER_PARAM)) {
			return;
		}

		startedRef.current = true;

		void (async () => {
			try {
				await authClient.getSession();
				router.refresh();
			} catch {
				startedRef.current = false;
			}
		})();
	}, [router]);

	return null;
}
