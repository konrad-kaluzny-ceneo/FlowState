// Example model schema from the Drizzle docs
// https://orm.drizzle.team/docs/sql-schema-declaration

import { sql } from "drizzle-orm";
import {
	index,
	pgTableCreator,
	serial,
	timestamp,
	varchar,
} from "drizzle-orm/pg-core";

/**
 * This is an example of how to use the multi-project schema feature of Drizzle ORM. Use the same
 * database instance for multiple projects.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
export const createTable = pgTableCreator(
	(name) => `.bootstrap-scaffold_${name}`,
);

export const posts = createTable(
	"post",
	(d) => ({
		id: serial("id").primaryKey(),
		name: varchar("name", { length: 256 }),
		createdAt: timestamp("createdAt", { withTimezone: true })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		updatedAt: timestamp("updatedAt", { withTimezone: true }).$onUpdate(
			() => new Date(),
		),
	}),
	(t) => [index("name_idx").on(t.name)],
);
