import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/generated";
import { env } from "~/env";

/**
 * Cache the Prisma client in development. This avoids creating a new connection on every HMR
 * update.
 */
const globalForPrisma = globalThis as unknown as {
	prisma: PrismaClient | undefined;
};

function createPrismaClient() {
	const adapter = new PrismaNeon({
		connectionString: env.DATABASE_URL,
	});
	return new PrismaClient({ adapter });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();
if (env.NODE_ENV !== "production") globalForPrisma.prisma = db;
