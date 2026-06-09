import {
	guestSnapshotV1Schema,
	normalizeGuestSnapshot,
} from "~/lib/guest/schema";
import { importGuestSnapshot } from "~/server/api/lib/import-guest-snapshot";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const guestRouter = createTRPCRouter({
	import: protectedProcedure
		.input(guestSnapshotV1Schema)
		.mutation(async ({ ctx, input }) => {
			return importGuestSnapshot(
				ctx.db,
				ctx.session.user.id,
				normalizeGuestSnapshot(input),
			);
		}),
});
