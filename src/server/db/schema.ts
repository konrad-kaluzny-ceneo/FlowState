import { sql } from "drizzle-orm";
import {
	index,
	pgTableCreator,
	serial,
	timestamp,
	varchar,
} from "drizzle-orm/pg-core";

/**
 * Multi-project schema helper — prefixes all table names with `.bootstrap-scaffold_`.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
export const createTable = pgTableCreator(
	(name) => `.bootstrap-scaffold_${name}`,
);

export const tasks = createTable(
	"task",
	{
		id: serial("id").primaryKey(),
		title: varchar("title", { length: 256 }).notNull(),
		status: varchar("status", { length: 20 }).notNull().default("active"),
		createdAt: timestamp("createdAt", { withTimezone: true })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		updatedAt: timestamp("updatedAt", { withTimezone: true }).$onUpdate(
			() => new Date(),
		),
	},
	(t) => [index("task_status_idx").on(t.status)],
);
