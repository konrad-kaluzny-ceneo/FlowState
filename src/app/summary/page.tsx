"use client";

import { PodsumowanieView } from "~/app/_components/podsumowanie-view";
import { useDailyRecap } from "~/hooks/use-daily-recap";
import { useDayStats } from "~/hooks/use-day-stats";

export default function SummaryPage() {
	const { stats, isLoading, isGuest } = useDayStats();
	const { recap, isLoading: isRecapLoading } = useDailyRecap();

	return (
		<div className="flex flex-1 flex-col items-center px-4 py-8">
			<div className="w-full max-w-2xl">
				<PodsumowanieView
					isGuest={isGuest}
					isLoading={isLoading || isRecapLoading}
					last24Hours={recap.last24Hours}
					stats={stats}
				/>
			</div>
		</div>
	);
}
