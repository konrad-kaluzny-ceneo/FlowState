-- Enforce at most one active (RUNNING or PAUSED) cycle per user at the DB level.
-- This prevents the TOCTOU race where two concurrent requests both pass the
-- application-level existingActive check and create duplicate running cycles.

-- Backfill: collapse any pre-existing duplicate active cycles so the unique
-- index below can be created without aborting. The old application-level check
-- could let duplicates through, so prod may already hold users with 2+ active
-- cycles. Keep the most recently started active cycle per user (tie-break on
-- id); demote the rest to INTERRUPTED and stamp ended_at.
UPDATE "flow_state_cycle" AS c
SET "state" = 'INTERRUPTED',
    "ended_at" = COALESCE("ended_at", now())
WHERE c."state" IN ('RUNNING', 'PAUSED')
  AND EXISTS (
    SELECT 1
    FROM "flow_state_cycle" AS newer
    WHERE newer."user_id" = c."user_id"
      AND newer."state" IN ('RUNNING', 'PAUSED')
      AND (
        newer."started_at" > c."started_at"
        OR (newer."started_at" = c."started_at" AND newer."id" > c."id")
      )
  );

CREATE UNIQUE INDEX "cycle_one_active_per_user"
  ON "flow_state_cycle" ("user_id")
  WHERE "state" IN ('RUNNING', 'PAUSED');
