/** Query param Neon Auth adds after OAuth; auth middleware must exchange it for session cookies. */
export const NEON_AUTH_SESSION_VERIFIER_PARAM = "neon_auth_session_verifier";

const GUEST_PUBLIC_PATHS = new Set([
	"/",
	"/focus",
	"/tasks",
	"/plan",
	"/summary",
	"/settings",
]);

export function isGuestPublicPath(pathname: string): boolean {
	return GUEST_PUBLIC_PATHS.has(pathname);
}

/** Guest-public paths skip auth middleware unless completing an OAuth redirect. */
export function shouldBypassAuthMiddleware(
	pathname: string,
	searchParams: URLSearchParams,
): boolean {
	return (
		isGuestPublicPath(pathname) &&
		!searchParams.has(NEON_AUTH_SESSION_VERIFIER_PARAM)
	);
}
