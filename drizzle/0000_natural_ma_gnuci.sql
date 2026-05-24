CREATE TABLE ".bootstrap-scaffold_post" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(256),
	"createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "name_idx" ON ".bootstrap-scaffold_post" USING btree ("name");