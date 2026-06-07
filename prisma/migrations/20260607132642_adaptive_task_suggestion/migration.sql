-- CreateTable
CREATE TABLE "flow_state_suggestion_decision" (
    "id" SERIAL NOT NULL,
    "user_id" VARCHAR(255) NOT NULL,
    "cycle_id" INTEGER NOT NULL,
    "suggested_task_id" INTEGER NOT NULL,
    "chosen_task_id" INTEGER NOT NULL,
    "accepted" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "flow_state_suggestion_decision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "flow_state_suggestion_decision_cycle_id_key" ON "flow_state_suggestion_decision"("cycle_id");

-- CreateIndex
CREATE INDEX "suggestion_decision_user_created_idx" ON "flow_state_suggestion_decision"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "flow_state_suggestion_decision" ADD CONSTRAINT "flow_state_suggestion_decision_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "flow_state_cycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_state_suggestion_decision" ADD CONSTRAINT "flow_state_suggestion_decision_suggested_task_id_fkey" FOREIGN KEY ("suggested_task_id") REFERENCES "flow_state_task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_state_suggestion_decision" ADD CONSTRAINT "flow_state_suggestion_decision_chosen_task_id_fkey" FOREIGN KEY ("chosen_task_id") REFERENCES "flow_state_task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
