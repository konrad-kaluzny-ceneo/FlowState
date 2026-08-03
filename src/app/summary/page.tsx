"use client";

import { useState } from "react";

import { PodsumowanieView } from "~/app/_components/podsumowanie-view";
import { useDailyRecap } from "~/hooks/use-daily-recap";
import { useDayStats } from "~/hooks/use-day-stats";
import { usePlanVsExecution } from "~/hooks/use-plan-vs-execution";
import type { WindowDays } from "~/hooks/use-trend-stats";

export default function SummaryPage() {
	const {
		stats,
		isLoading,
		isGuest,
		viewedLocalDateKey,
		goToPreviousDay,
		goToNextDay,
		goToToday,
		canGoNext,
	} = useDayStats();
	const { recap, isLoading: isRecapLoading } = useDailyRecap();
	const [windowDays, setWindowDays] = useState<WindowDays>(7);
	const {
		trend,
		points: planVsExecution,
		isAvailable: isPlanVsExecutionAvailable,
	} = usePlanVsExecution(windowDays);

	return (
		<div className="flex flex-1 flex-col items-center px-4 py-8">
			<div className="w-full max-w-2xl">
				<PodsumowanieView
					canGoNext={canGoNext}
					isGuest={isGuest}
					isLoading={isLoading || isRecapLoading}
					isPlanVsExecutionAvailable={isPlanVsExecutionAvailable}
					last24Hours={recap.last24Hours}
					onNextDay={goToNextDay}
					onPreviousDay={goToPreviousDay}
					onToday={goToToday}
					onTrendWindowDaysChange={setWindowDays}
					planVsExecution={planVsExecution}
					stats={stats}
					trend={trend}
					trendWindowDays={windowDays}
					viewedLocalDateKey={viewedLocalDateKey}
				/>
			</div>
		</div>
	);
}
