-- CreateEnum
CREATE TYPE "SuggestionContext" AS ENUM ('POST_CHECK_IN', 'KICKOFF');

-- AlterTable
ALTER TABLE "flow_state_suggestion_decision" ADD COLUMN     "context" "SuggestionContext" NOT NULL DEFAULT 'POST_CHECK_IN',
ADD COLUMN     "session_id" INTEGER,
ALTER COLUMN "cycle_id" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "suggestion_decision_session_created_idx" ON "flow_state_suggestion_decision"("session_id", "created_at");

-- AddForeignKey
ALTER TABLE "flow_state_suggestion_decision" ADD CONSTRAINT "flow_state_suggestion_decision_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "flow_state_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
