-- CreateEnum
CREATE TYPE "CycleEndAudioMode" AS ENUM ('NORMAL', 'SOFT', 'MUTED');

-- CreateTable
CREATE TABLE "flow_state_user_preference" (
    "user_id" VARCHAR(255) NOT NULL,
    "cycle_end_audio_mode" "CycleEndAudioMode" NOT NULL DEFAULT 'NORMAL',
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "flow_state_user_preference_pkey" PRIMARY KEY ("user_id")
);
