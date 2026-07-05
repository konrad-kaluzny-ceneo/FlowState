"use client";

import { PlanDniaView } from "~/app/_components/plan-dnia-view";
import { useDayPlan } from "~/hooks/use-day-plan";
import { useDataMode } from "~/lib/data-mode/data-mode-context";

function AuthenticatedPlanPage() {
	const dayPlan = useDayPlan();

	return (
		<div className="flex flex-1 flex-col items-center px-4 py-8">
			<div className="w-full max-w-2xl">
				<PlanDniaView dayPlan={dayPlan} />
			</div>
		</div>
	);
}

function GuestPlanPage() {
	return (
		<div className="flex flex-1 flex-col items-center px-4 py-8">
			<div className="w-full max-w-2xl">
				<PlanDniaView dayPlan={undefined} />
			</div>
		</div>
	);
}

export default function PlanPage() {
	const mode = useDataMode();

	if (mode === "guest") {
		return <GuestPlanPage />;
	}

	return <AuthenticatedPlanPage />;
}
