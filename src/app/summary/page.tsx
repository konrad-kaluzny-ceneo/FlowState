"use client";

import { PodsumowanieView } from "~/app/_components/podsumowanie-view";
import { useDayStats } from "~/hooks/use-day-stats";

export default function SummaryPage() {
	const { stats, isLoading, isGuest } = useDayStats();

	return (
		<div className="flex flex-1 flex-col items-center px-4 py-8">
			<div className="w-full max-w-2xl">
				<PodsumowanieView
					isGuest={isGuest}
					isLoading={isLoading}
					stats={stats}
				/>
			</div>
		</div>
	);
}
