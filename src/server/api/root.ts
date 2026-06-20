import { checkInRouter } from "~/server/api/routers/check-in";
import { cycleRouter } from "~/server/api/routers/cycle";
import { dayPlanRouter } from "~/server/api/routers/day-plan";
import { guestRouter } from "~/server/api/routers/guest";
import { preferenceRouter } from "~/server/api/routers/preference";
import { recapRouter } from "~/server/api/routers/recap";
import { sessionRouter } from "~/server/api/routers/session";
import { suggestionRouter } from "~/server/api/routers/suggestion";
import { taskRouter } from "~/server/api/routers/task";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
	task: taskRouter,
	session: sessionRouter,
	cycle: cycleRouter,
	checkIn: checkInRouter,
	guest: guestRouter,
	preference: preferenceRouter,
	dayPlan: dayPlanRouter,
	recap: recapRouter,
	suggestion: suggestionRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
