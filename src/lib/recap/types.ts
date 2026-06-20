export type RecapTaskRow = {
	taskId: number;
	title: string;
	firstStartedAt: Date;
	lastEndedAt: Date;
	focusedMinutes: number;
	completedWithoutCycle?: boolean;
};

export type TodayPlanRow = {
	taskId: number;
	title: string;
	isDailyStanding: boolean;
	doneForToday: boolean;
	effortMinutes: number | null;
};

export type TaskFootprint = {
	lastFocusedAt: Date;
	cumulativeMinutes: number;
};

export type DailyRecap = {
	last24Hours: RecapTaskRow[];
	todayPlan: TodayPlanRow[];
	footprints: Record<number, TaskFootprint>;
};
