import type { NextRequest } from "next/server";

import { auth } from "./src/lib/auth/server";

const runAuthProxy = auth.middleware({
	loginUrl: "/auth/sign-in",
});

export function proxy(request: NextRequest) {
	return runAuthProxy(request);
}

export const config = {
	matcher: [
		"/((?!_next/static|_next/image|favicon.ico|api/auth|api/trpc|auth/).*)",
	],
};
