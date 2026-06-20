export type CycleMinutesInput = {
	kind: string;
	state: string;
	startedAt: Date;
	endedAt: Date | null;
	configuredDurationSec: number;
};

export function computeCycleFocusedMinutes(cycle: CycleMinutesInput): number {
	if (
		cycle.kind !== "WORK" ||
		cycle.state !== "COMPLETED" ||
		cycle.endedAt == null
	) {
		return 0;
	}

	const elapsedSec = Math.min(
		cycle.configuredDurationSec,
		Math.max(
			0,
			Math.floor((cycle.endedAt.getTime() - cycle.startedAt.getTime()) / 1000),
		),
	);

	return Math.max(1, Math.ceil(elapsedSec / 60));
}
