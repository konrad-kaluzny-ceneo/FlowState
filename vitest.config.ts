import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [react()],
	test: {
		environment: "jsdom",
		globals: true,
		setupFiles: ["./src/test/setup.ts"],
		env: {
			SKIP_ENV_VALIDATION: "1",
			DATABASE_URL: "postgresql://test:test@localhost:5432/test",
			DATABASE_URL_UNPOOLED: "postgresql://test:test@localhost:5432/test",
			NODE_ENV: "test",
		},
	},
	resolve: {
		alias: {
			"~": resolve(__dirname, "./src"),
			"@prisma/generated": resolve(__dirname, "./generated/prisma/client"),
		},
	},
});
