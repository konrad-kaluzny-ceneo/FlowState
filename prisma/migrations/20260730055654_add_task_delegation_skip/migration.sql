-- CreateTable
CREATE TABLE "flow_state_task_delegation_skip" (
    "id" SERIAL NOT NULL,
    "user_id" VARCHAR(255) NOT NULL,
    "task_id" INTEGER NOT NULL,
    "local_date_key" VARCHAR(10) NOT NULL,
    "skipped_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "flow_state_task_delegation_skip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_delegation_skip_user_date_idx" ON "flow_state_task_delegation_skip"("user_id", "local_date_key");

-- CreateIndex
CREATE UNIQUE INDEX "flow_state_task_delegation_skip_user_id_task_id_local_date__key" ON "flow_state_task_delegation_skip"("user_id", "task_id", "local_date_key");

-- AddForeignKey
ALTER TABLE "flow_state_task_delegation_skip" ADD CONSTRAINT "flow_state_task_delegation_skip_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "flow_state_task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
