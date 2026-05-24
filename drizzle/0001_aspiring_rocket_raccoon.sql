ALTER TABLE "flow_state_task" ADD COLUMN "user_id" varchar(255) NOT NULL;--> statement-breakpoint
CREATE INDEX "task_user_id_idx" ON "flow_state_task" USING btree ("user_id");