-- RenameEnumValue: WorkType.ADMIN → WorkType.OPERATIONAL
ALTER TYPE "WorkType" RENAME VALUE 'ADMIN' TO 'OPERATIONAL';

-- Update default on the column to use the new enum value
ALTER TABLE "flow_state_task" ALTER COLUMN "work_type" SET DEFAULT 'OPERATIONAL'::"WorkType";
