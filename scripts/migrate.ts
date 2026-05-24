import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL_UNPOOLED;

if (!connectionString) {
	console.error("DATABASE_URL_UNPOOLED is not set");
	process.exit(1);
}

const sql = postgres(connectionString, { max: 1 });
const db = drizzle(sql);

async function main() {
	console.log("Running migrations...");
	await migrate(db, { migrationsFolder: "./drizzle" });
	console.log("Migrations complete.");
	await sql.end();
}

main().catch((err) => {
	console.error("Migration failed:", err);
	process.exit(1);
});
