import { z } from "zod";

import { buildDailyRecap } from "~/lib/recap/build-daily-recap";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

const localDateKeySchema = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD local date key");

export const recapRouter = createTRPCRouter({
	getDaily: protectedProcedure
		.input(z.object({ localDateKey: localDateKeySchema }))
		.query(async ({ ctx, input }) => {
			return buildDailyRecap(ctx.db, ctx.session.user.id, input.localDateKey);
		}),
});
