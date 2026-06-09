-- AlterTable
ALTER TABLE "flow_state_task" ADD COLUMN     "sort_order" INTEGER NOT NULL DEFAULT 0;

-- Backfill: dense sort_order per user preserving prior createdAt list order
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id
      ORDER BY "createdAt" ASC
    ) - 1 AS new_sort_order
  FROM "flow_state_task"
)
UPDATE "flow_state_task" AS t
SET sort_order = r.new_sort_order
FROM ranked AS r
WHERE t.id = r.id;

-- CreateIndex
CREATE INDEX "task_user_sort_order_idx" ON "flow_state_task"("user_id", "sort_order");
