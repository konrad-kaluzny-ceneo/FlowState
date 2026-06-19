import type { PrismaClient, Session } from "@prisma/generated";

/** Narrow Prisma client surface for day-plan helpers. */
export type DayPlanDb = Pick<PrismaClient, "dayPlan">;

export type { PrismaClient, Session };
