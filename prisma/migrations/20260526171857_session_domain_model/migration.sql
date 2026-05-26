-- CreateEnum
CREATE TYPE "WorkType" AS ENUM ('DEEP_WORK', 'ADMIN', 'REACTIVE');

-- CreateEnum
CREATE TYPE "EnergyLevel" AS ENUM ('FOCUSED', 'STEADY', 'FADING');

-- CreateEnum
CREATE TYPE "SessionState" AS ENUM ('ACTIVE', 'ENDED_BY_USER', 'ENDED_BY_TIMEOUT');

-- CreateEnum
CREATE TYPE "CycleState" AS ENUM ('RUNNING', 'COMPLETED', 'INTERRUPTED');

-- AlterTable
ALTER TABLE "flow_state_task" ADD COLUMN     "weight" SMALLINT NOT NULL DEFAULT 2,
ADD COLUMN     "work_type" "WorkType" NOT NULL DEFAULT 'ADMIN';

-- CreateTable
CREATE TABLE "flow_state_session" (
    "id" SERIAL NOT NULL,
    "user_id" VARCHAR(255) NOT NULL,
    "state" "SessionState" NOT NULL DEFAULT 'ACTIVE',
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ,
    "last_activity_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "interruption_count" INTEGER NOT NULL DEFAULT 0,
    "archived_at" TIMESTAMPTZ,

    CONSTRAINT "flow_state_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flow_state_cycle" (
    "id" SERIAL NOT NULL,
    "session_id" INTEGER NOT NULL,
    "user_id" VARCHAR(255) NOT NULL,
    "task_id" INTEGER,
    "kind" VARCHAR(10) NOT NULL,
    "state" "CycleState" NOT NULL DEFAULT 'RUNNING',
    "configured_duration_sec" INTEGER NOT NULL,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ,

    CONSTRAINT "flow_state_cycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flow_state_check_in" (
    "id" SERIAL NOT NULL,
    "cycle_id" INTEGER NOT NULL,
    "user_id" VARCHAR(255) NOT NULL,
    "energy" "EnergyLevel" NOT NULL,
    "responded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "flow_state_check_in_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "session_user_id_idx" ON "flow_state_session"("user_id");

-- CreateIndex
CREATE INDEX "session_state_idx" ON "flow_state_session"("state");

-- CreateIndex
CREATE INDEX "cycle_session_id_idx" ON "flow_state_cycle"("session_id");

-- CreateIndex
CREATE INDEX "cycle_user_id_idx" ON "flow_state_cycle"("user_id");

-- CreateIndex
CREATE INDEX "cycle_task_id_idx" ON "flow_state_cycle"("task_id");

-- CreateIndex
CREATE UNIQUE INDEX "flow_state_check_in_cycle_id_key" ON "flow_state_check_in"("cycle_id");

-- CreateIndex
CREATE INDEX "check_in_user_id_idx" ON "flow_state_check_in"("user_id");

-- CreateIndex
CREATE INDEX "task_work_type_idx" ON "flow_state_task"("work_type");

-- AddForeignKey
ALTER TABLE "flow_state_cycle" ADD CONSTRAINT "flow_state_cycle_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "flow_state_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_state_cycle" ADD CONSTRAINT "flow_state_cycle_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "flow_state_task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_state_check_in" ADD CONSTRAINT "flow_state_check_in_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "flow_state_cycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex (hand-added: partial unique — only one ACTIVE session per user)
CREATE UNIQUE INDEX "session_user_id_active_unique"
  ON "flow_state_session"("user_id")
  WHERE state = 'ACTIVE';
