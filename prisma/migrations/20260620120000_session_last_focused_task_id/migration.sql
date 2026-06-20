-- AlterTable
ALTER TABLE "flow_state_session" ADD COLUMN "last_focused_task_id" INTEGER;

-- CreateIndex
CREATE INDEX "session_last_focused_task_id_idx" ON "flow_state_session"("last_focused_task_id");

-- AddForeignKey
ALTER TABLE "flow_state_session" ADD CONSTRAINT "flow_state_session_last_focused_task_id_fkey" FOREIGN KEY ("last_focused_task_id") REFERENCES "flow_state_task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
