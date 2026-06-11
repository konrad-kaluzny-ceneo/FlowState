-- CreateEnum
CREATE TYPE "CommitmentHorizon" AS ENUM ('ASAP', 'THIS_WEEK', 'WHEN_POSSIBLE');

-- AlterTable
ALTER TABLE "flow_state_task" ADD COLUMN     "commitment_horizon" "CommitmentHorizon" NOT NULL DEFAULT 'WHEN_POSSIBLE',
ADD COLUMN     "effort_minutes" INTEGER,
ADD COLUMN     "importance" SMALLINT NOT NULL DEFAULT 2,
ADD COLUMN     "urgency" SMALLINT NOT NULL DEFAULT 2;

-- Backfill: migrate legacy weight into urgency (importance defaults to 2)
UPDATE "flow_state_task" SET urgency = weight;
