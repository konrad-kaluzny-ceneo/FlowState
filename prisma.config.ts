import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
	schema: "prisma/schema.prisma",
	migrations: {
		path: "prisma/migrations",
	},
	datasource: {
		// Migrations need a direct (unpooled) Neon connection; runtime uses DATABASE_URL.
		url: env("DATABASE_URL_UNPOOLED"),
	},
});
