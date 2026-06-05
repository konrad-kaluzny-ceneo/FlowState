import { readFileSync } from "node:fs";
import path from "node:path";
import { defineConfig } from "prisma/config";

// Load .env file manually since Prisma CLI doesn't auto-load it with prisma.config.ts
function loadEnv() {
	try {
		const envPath = path.join(import.meta.dirname, ".env");
		const content = readFileSync(envPath, "utf-8");
		for (const line of content.split("\n")) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith("#")) continue;
			const eqIdx = trimmed.indexOf("=");
			if (eqIdx === -1) continue;
			const key = trimmed.slice(0, eqIdx);
			let value = trimmed.slice(eqIdx + 1);
			if (
				(value.startsWith('"') && value.endsWith('"')) ||
				(value.startsWith("'") && value.endsWith("'"))
			) {
				value = value.slice(1, -1);
			}
			if (!process.env[key]) {
				process.env[key] = value;
			}
		}
	} catch {
		// .env file not found — rely on environment variables
	}
}

loadEnv();

export default defineConfig({
	schema: path.join(import.meta.dirname, "prisma", "schema.prisma"),
	migrations: {
		path: "prisma/migrations",
	},
	datasource: {
		// Migrations need a direct (unpooled) Neon connection; runtime uses DATABASE_URL.
		url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "",
	},
});
