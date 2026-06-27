-- CreateEnum
CREATE TYPE "UserLocale" AS ENUM ('EN', 'PL');

-- AlterTable
ALTER TABLE "flow_state_user_preference" ADD COLUMN "language" "UserLocale";
