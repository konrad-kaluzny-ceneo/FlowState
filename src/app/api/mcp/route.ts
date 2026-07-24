import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { createMcpHandler, withMcpAuth } from "mcp-handler";

import { registerMcpTools } from "~/app/api/mcp/mcp-tools";
import { verifyApiKey } from "~/lib/api-keys/verify-token";

/**
 * MCP server for external AI agents (S-46), mounted at `/api/mcp`.
 *
 * Stateless Streamable HTTP (no Redis, no session state) — the only shape
 * compatible with Vercel's 10s function cap. Runs on the default Node runtime
 * (Prisma + Neon serverless driver); no `runtime` export. Authenticated by a
 * personal API key via `withMcpAuth`; every tool delegates to
 * `appRouter.createCaller(ctx)` for per-user isolation.
 *
 * With `basePath: "/api"`, mcp-handler derives the streamable endpoint as
 * `/api/mcp`, which this route file serves.
 */

export const maxDuration = 10;

const handler = createMcpHandler(
	(server) => {
		registerMcpTools(server);
	},
	{},
	{ basePath: "/api", maxDuration: 10 },
);

/**
 * Resolve a presented bearer token to an `AuthInfo`. The verified identity +
 * scope ride along in `extra`, where the tool handlers read them. Returns
 * `undefined` for any invalid/revoked/unknown key (rejected by `required: true`).
 */
const verifyToken = async (
	_req: Request,
	bearerToken?: string,
): Promise<AuthInfo | undefined> => {
	if (!bearerToken) return undefined;

	const identity = await verifyApiKey(bearerToken);
	if (identity == null) return undefined;

	return {
		token: bearerToken,
		clientId: identity.userId,
		scopes: identity.scope === "READ_WRITE" ? ["read", "write"] : ["read"],
		extra: {
			userId: identity.userId,
			userEmail: identity.userEmail,
			userName: identity.userName,
			scope: identity.scope,
		},
	};
};

const authHandler = withMcpAuth(handler, verifyToken, { required: true });

export { authHandler as GET, authHandler as POST, authHandler as DELETE };
