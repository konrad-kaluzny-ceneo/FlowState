CREATE TABLE "flow_state_task" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(256) NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "task_status_idx" ON "flow_state_task" USING btree ("status");