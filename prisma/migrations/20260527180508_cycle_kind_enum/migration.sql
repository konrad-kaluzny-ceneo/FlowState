-- CreateEnum
CREATE TYPE "CycleKind" AS ENUM ('WORK', 'SHORT_BREAK', 'LONG_BREAK');

-- AlterTable: convert existing varchar values to the new enum type
ALTER TABLE "flow_state_cycle"
  ALTER COLUMN "kind" TYPE "CycleKind"
  USING (
    CASE "kind"
      WHEN 'work' THEN 'WORK'::"CycleKind"
      WHEN 'short_break' THEN 'SHORT_BREAK'::"CycleKind"
      WHEN 'long_break' THEN 'LONG_BREAK'::"CycleKind"
    END
  );
