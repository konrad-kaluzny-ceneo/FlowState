import { z } from "zod";

import {
	cycleEndAudioModeSchema,
	DEFAULT_CYCLE_END_AUDIO_MODE,
	fromPrismaMode,
	toPrismaMode,
} from "~/lib/cycle-audio-preference/types";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const preferenceRouter = createTRPCRouter({
	get: protectedProcedure.query(async ({ ctx }) => {
		const row = await ctx.db.userPreference.findUnique({
			where: { userId: ctx.session.user.id },
		});

		return {
			cycleEndAudioMode: row
				? fromPrismaMode(row.cycleEndAudioMode)
				: DEFAULT_CYCLE_END_AUDIO_MODE,
		};
	}),

	set: protectedProcedure
		.input(
			z.object({
				cycleEndAudioMode: z.enum(cycleEndAudioModeSchema),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const prismaMode = toPrismaMode(input.cycleEndAudioMode);

			const row = await ctx.db.userPreference.upsert({
				where: { userId: ctx.session.user.id },
				create: {
					userId: ctx.session.user.id,
					cycleEndAudioMode: prismaMode,
				},
				update: {
					cycleEndAudioMode: prismaMode,
				},
			});

			return {
				cycleEndAudioMode: fromPrismaMode(row.cycleEndAudioMode),
			};
		}),
});
