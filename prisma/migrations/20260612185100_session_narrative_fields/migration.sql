-- AlterTable
ALTER TABLE "flow_state_cycle" ADD COLUMN "intention" VARCHAR(80);

-- AlterTable
ALTER TABLE "flow_state_session" ADD COLUMN "closure_line" VARCHAR(120);
