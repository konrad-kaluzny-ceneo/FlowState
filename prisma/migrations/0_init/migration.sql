-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "flow_state_task" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(256) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "user_id" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ,

    CONSTRAINT "flow_state_task_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_status_idx" ON "flow_state_task"("status");

-- CreateIndex
CREATE INDEX "task_user_id_idx" ON "flow_state_task"("user_id");
