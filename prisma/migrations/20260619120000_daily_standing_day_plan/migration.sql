-- AlterTable
ALTER TABLE "flow_state_task" ADD COLUMN "is_daily_standing" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "flow_state_day_plan" (
    "id" SERIAL NOT NULL,
    "user_id" VARCHAR(255) NOT NULL,
    "local_date_key" VARCHAR(10) NOT NULL,
    "focus_budget_minutes" INTEGER NOT NULL,
    "used_focus_minutes" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "flow_state_day_plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flow_state_task_day_completion" (
    "id" SERIAL NOT NULL,
    "user_id" VARCHAR(255) NOT NULL,
    "task_id" INTEGER NOT NULL,
    "local_date_key" VARCHAR(10) NOT NULL,
    "completed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "flow_state_task_day_completion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "day_plan_user_id_idx" ON "flow_state_day_plan"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "day_plan_user_date_key" ON "flow_state_day_plan"("user_id", "local_date_key");

-- CreateIndex
CREATE INDEX "task_user_daily_standing_idx" ON "flow_state_task"("user_id", "is_daily_standing");

-- CreateIndex
CREATE INDEX "task_day_completion_user_date_idx" ON "flow_state_task_day_completion"("user_id", "local_date_key");

-- CreateIndex
CREATE UNIQUE INDEX "task_day_completion_user_task_date" ON "flow_state_task_day_completion"("user_id", "task_id", "local_date_key");

-- AddForeignKey
ALTER TABLE "flow_state_task_day_completion" ADD CONSTRAINT "flow_state_task_day_completion_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "flow_state_task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
