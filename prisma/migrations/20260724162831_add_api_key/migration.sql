-- CreateEnum
CREATE TYPE "ApiKeyScope" AS ENUM ('READ', 'READ_WRITE');

-- CreateTable
CREATE TABLE "flow_state_api_key" (
    "id" SERIAL NOT NULL,
    "user_id" VARCHAR(255) NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "token_id" VARCHAR(64) NOT NULL,
    "hashed_secret" VARCHAR(128) NOT NULL,
    "scope" "ApiKeyScope" NOT NULL DEFAULT 'READ',
    "user_email" VARCHAR(320) NOT NULL,
    "user_name" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMPTZ,
    "revoked_at" TIMESTAMPTZ,

    CONSTRAINT "flow_state_api_key_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "flow_state_api_key_token_id_key" ON "flow_state_api_key"("token_id");

-- CreateIndex
CREATE INDEX "api_key_user_id_idx" ON "flow_state_api_key"("user_id");

-- RenameIndex
ALTER INDEX "day_plan_user_date_key" RENAME TO "flow_state_day_plan_user_id_local_date_key_key";

-- RenameIndex
ALTER INDEX "task_day_completion_user_task_date" RENAME TO "flow_state_task_day_completion_user_id_task_id_local_date_k_key";
