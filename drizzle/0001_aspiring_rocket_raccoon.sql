ALTER TABLE "flow_state_task" ADD COLUMN "user_id" varchar(255);--> statement-breakpoint
DELETE FROM "flow_state_task" WHERE "user_id" IS NULL;--> statement-breakpoint
ALTER TABLE "flow_state_task" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "task_user_id_idx" ON "flow_state_task" USING btree ("user_id");