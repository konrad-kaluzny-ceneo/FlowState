-- AlterTable: add nullable per-day energy and relax budget to nullable (energy-only day plans)
ALTER TABLE "flow_state_day_plan" ADD COLUMN "energy_level" "EnergyLevel";
ALTER TABLE "flow_state_day_plan" ALTER COLUMN "focus_budget_minutes" DROP NOT NULL;
