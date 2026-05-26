import { execSync } from "node:child_process";

const connectionString = process.env.DATABASE_URL_UNPOOLED;

if (!connectionString) {
	console.error("DATABASE_URL_UNPOOLED is not set");
	process.exit(1);
}

async function main() {
	console.log("Running Prisma migrations...");
	execSync("npx prisma migrate deploy", {
		stdio: "inherit",
		env: {
			...process.env,
			DATABASE_URL: connectionString,
			DATABASE_URL_UNPOOLED: connectionString,
		},
	});
	console.log("Migrations complete.");
}

main().catch((err) => {
	console.error("Migration failed:", err);
	process.exit(1);
});
