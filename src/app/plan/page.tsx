"use client";

import { PlanDniaView } from "~/app/_components/plan-dnia-view";
import { useDayPlan } from "~/hooks/use-day-plan";
import { useDaySchedule } from "~/hooks/use-day-schedule";
import { useDataMode } from "~/lib/data-mode/data-mode-context";
import { useAuthenticatedDomainTasks } from "~/lib/data-mode/use-domain-tasks";

function AuthenticatedPlanPage() {
	const dayPlan = useDayPlan();
	const daySchedule = useDaySchedule(dayPlan.localDateKey);
	const { tasks } = useAuthenticatedDomainTasks({
		localDateKey: dayPlan.localDateKey,
		enabled: true,
	});

	return (
		<div className="flex flex-1 flex-col items-center px-4 py-8">
			<div className="w-full max-w-2xl">
				<PlanDniaView
					dayPlan={dayPlan}
					daySchedule={daySchedule}
					tasks={tasks}
				/>
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
