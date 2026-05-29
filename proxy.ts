import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { isGuestPublicPath } from "./src/lib/auth/public-paths";
import { auth } from "./src/lib/auth/server";

/**
 * Neon Auth route protection (S-08 guest trial):
 * `auth.middleware({ loginUrl })` redirects unauthenticated users on every
 * matched path. `/` is intentionally excluded so visitors can try the app
 * without an account; session remains optional on home. Auth routes, static
 * assets, and tRPC are excluded via `config.matcher`.
 */
const runAuthProxy = auth.middleware({
	loginUrl: "/auth/sign-in",
});

export function proxy(request: NextRequest) {
	if (isGuestPublicPath(request.nextUrl.pathname)) {
		return NextResponse.next();
	}

	return runAuthProxy(request);
}

export const config = {
	matcher: [
		"/((?!_next/static|_next/image|favicon.ico|api/auth|api/trpc|auth/).*)",
	],
};
