-- Enforce at most one active (RUNNING or PAUSED) cycle per user at the DB level.
-- This prevents the TOCTOU race where two concurrent requests both pass the
-- application-level existingActive check and create duplicate running cycles.

CREATE UNIQUE INDEX "cycle_one_active_per_user"
  ON "flow_state_cycle" ("user_id")
  WHERE "state" IN ('RUNNING', 'PAUSED');
