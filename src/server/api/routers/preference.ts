import { z } from "zod";

import {
	cycleEndAudioModeSchema,
	DEFAULT_CYCLE_END_AUDIO_MODE,
	fromPrismaMode,
	toPrismaMode,
} from "~/lib/cycle-audio-preference/types";
import { userLocaleSchema } from "~/lib/language-preference/types";
import {
	fromPrismaUserLocale,
	toPrismaUserLocale,
} from "~/lib/persistence/prisma/enum-mappers";
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
			language: row?.language ? fromPrismaUserLocale(row.language) : null,
		};
	}),

	set: protectedProcedure
		.input(
			z
				.object({
					cycleEndAudioMode: z.enum(cycleEndAudioModeSchema).optional(),
					language: z.enum(userLocaleSchema).optional(),
				})
				.refine(
					(input) =>
						input.cycleEndAudioMode !== undefined ||
						input.language !== undefined,
					{
						message: "At least one preference field must be provided.",
					},
				),
		)
		.mutation(async ({ ctx, input }) => {
			const updateData = {
				...(input.cycleEndAudioMode !== undefined
					? {
							cycleEndAudioMode: toPrismaMode(input.cycleEndAudioMode),
						}
					: {}),
				...(input.language !== undefined
					? { language: toPrismaUserLocale(input.language) }
					: {}),
			};

			const row = await ctx.db.userPreference.upsert({
				where: { userId: ctx.session.user.id },
				create: {
					userId: ctx.session.user.id,
					cycleEndAudioMode:
						input.cycleEndAudioMode !== undefined
							? toPrismaMode(input.cycleEndAudioMode)
							: toPrismaMode(DEFAULT_CYCLE_END_AUDIO_MODE),
					language:
						input.language !== undefined
							? toPrismaUserLocale(input.language)
							: undefined,
				},
				update: updateData,
			});

			return {
				cycleEndAudioMode: fromPrismaMode(row.cycleEndAudioMode),
				language: row.language ? fromPrismaUserLocale(row.language) : null,
			};
		}),
});
