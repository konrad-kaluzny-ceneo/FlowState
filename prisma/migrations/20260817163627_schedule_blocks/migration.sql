-- CreateEnum
CREATE TYPE "ScheduleBlockType" AS ENUM ('FOCUS', 'MEETING', 'BREAK', 'PERSONAL', 'PLANNING', 'BATCH');

-- CreateEnum
CREATE TYPE "GtdFixedContext" AS ENUM ('PHONE', 'COMPUTER', 'OFFICE', 'ERRANDS');

-- CreateTable
CREATE TABLE "flow_state_user_context_tag" (
    "id" SERIAL NOT NULL,
    "user_id" VARCHAR(255) NOT NULL,
    "label" VARCHAR(32) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "flow_state_user_context_tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flow_state_schedule_block" (
    "id" SERIAL NOT NULL,
    "user_id" VARCHAR(255) NOT NULL,
    "local_date_key" VARCHAR(10) NOT NULL,
    "block_type" "ScheduleBlockType" NOT NULL,
    "start_minute" INTEGER NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "meta_label" VARCHAR(120),
    "fixed_context" "GtdFixedContext",
    "custom_context_tag_id" INTEGER,
    "focus_task_id" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "flow_state_schedule_block_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flow_state_schedule_block_task" (
    "id" SERIAL NOT NULL,
    "schedule_block_id" INTEGER NOT NULL,
    "task_id" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "flow_state_schedule_block_task_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "flow_state_user_context_tag_user_id_label_key" ON "flow_state_user_context_tag"("user_id", "label");

-- CreateIndex
CREATE INDEX "schedule_block_user_date_idx" ON "flow_state_schedule_block"("user_id", "local_date_key");

-- CreateIndex
CREATE UNIQUE INDEX "flow_state_schedule_block_task_schedule_block_id_task_id_key" ON "flow_state_schedule_block_task"("schedule_block_id", "task_id");

-- AddForeignKey
ALTER TABLE "flow_state_schedule_block" ADD CONSTRAINT "flow_state_schedule_block_custom_context_tag_id_fkey" FOREIGN KEY ("custom_context_tag_id") REFERENCES "flow_state_user_context_tag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_state_schedule_block" ADD CONSTRAINT "flow_state_schedule_block_focus_task_id_fkey" FOREIGN KEY ("focus_task_id") REFERENCES "flow_state_task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_state_schedule_block_task" ADD CONSTRAINT "flow_state_schedule_block_task_schedule_block_id_fkey" FOREIGN KEY ("schedule_block_id") REFERENCES "flow_state_schedule_block"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_state_schedule_block_task" ADD CONSTRAINT "flow_state_schedule_block_task_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "flow_state_task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
