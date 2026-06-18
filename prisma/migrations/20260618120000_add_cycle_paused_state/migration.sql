-- AlterEnum
ALTER TYPE "CycleState" ADD VALUE 'PAUSED';

-- AlterTable
ALTER TABLE "flow_state_cycle" ADD COLUMN     "paused_at" TIMESTAMPTZ,
ADD COLUMN     "remaining_duration_sec" INTEGER;
