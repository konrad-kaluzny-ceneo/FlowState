-- AlterTable
ALTER TABLE "flow_state_task" ADD COLUMN "archived_at" TIMESTAMPTZ;

-- CreateIndex
CREATE INDEX "task_user_status_archived_at_idx" ON "flow_state_task"("user_id", "status", "archived_at");
