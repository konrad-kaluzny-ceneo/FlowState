-- CreateEnum
CREATE TYPE "CommitmentHorizon" AS ENUM ('ASAP', 'THIS_WEEK', 'WHEN_POSSIBLE');

-- AlterTable
ALTER TABLE "flow_state_task" ADD COLUMN     "commitment_horizon" "CommitmentHorizon" NOT NULL DEFAULT 'WHEN_POSSIBLE',
ADD COLUMN     "effort_minutes" INTEGER,
ADD COLUMN     "importance" SMALLINT NOT NULL DEFAULT 2,
ADD COLUMN     "urgency" SMALLINT NOT NULL DEFAULT 2;

-- Backfill: migrate legacy weight into urgency (clamp to 1–3 invariant)
UPDATE "flow_state_task"
SET urgency = LEAST(3, GREATEST(1, weight));
