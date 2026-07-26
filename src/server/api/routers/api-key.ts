import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { generateApiKey } from "~/lib/api-keys/api-key";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

const apiKeyScopeSchema = z.enum(["READ", "READ_WRITE"]);

/** Ceiling on non-revoked, non-expired keys a single user can hold. */
export const MAX_ACTIVE_KEYS_PER_USER = 10;

/**
 * Self-serve management of personal API keys used to authenticate the MCP
 * server (S-46). All procedures are `protectedProcedure`, so keys are always
 * minted against the real cookie session — that is where the email/name
 * snapshot needed to rebuild a synthetic context later comes from.
 *
 * The plaintext key is returned by `create` exactly once and never persisted
 * or logged; storage keeps only the peppered hash produced by `generateApiKey`.
 */
export const apiKeyRouter = createTRPCRouter({
	list: protectedProcedure.query(async ({ ctx }) => {
		const rows = await ctx.db.apiKey.findMany({
			where: { userId: ctx.session.user.id },
			orderBy: { createdAt: "desc" },
			select: {
				id: true,
				name: true,
				scope: true,
				tokenId: true,
				createdAt: true,
				lastUsedAt: true,
				revokedAt: true,
			},
		});

		return rows;
	}),

	create: protectedProcedure
		.input(
			z.object({
				name: z.string().min(1).max(64),
				scope: apiKeyScopeSchema,
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const activeCount = await ctx.db.apiKey.count({
				where: {
					userId: ctx.session.user.id,
					revokedAt: null,
					OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
				},
			});
			if (activeCount >= MAX_ACTIVE_KEYS_PER_USER) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Active API key limit reached — revoke an unused key first.",
				});
			}

			const { plaintext, tokenId, hashedSecret } = generateApiKey();

			const row = await ctx.db.apiKey.create({
				data: {
					userId: ctx.session.user.id,
					name: input.name,
					scope: input.scope,
					tokenId,
					hashedSecret,
					userEmail: ctx.session.user.email,
					userName: ctx.session.user.name,
				},
				select: { id: true },
			});

			// Returned exactly once — the plaintext is never stored or logged.
			return { id: row.id, plaintext };
		}),

	revoke: protectedProcedure
		.input(z.object({ id: z.number().int() }))
		.mutation(async ({ ctx, input }) => {
			const existing = await ctx.db.apiKey.findFirst({
				where: { id: input.id, userId: ctx.session.user.id },
			});

			if (!existing) {
				throw new TRPCError({ code: "NOT_FOUND" });
			}

			await ctx.db.apiKey.update({
				where: { id: input.id },
				data: { revokedAt: new Date() },
			});
		}),
});
