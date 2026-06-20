export type RecapTaskId = string | number;

export type RecapTaskRow = {
	taskId: RecapTaskId;
	title: string;
	firstStartedAt: Date;
	lastEndedAt: Date;
	focusedMinutes: number;
	completedWithoutCycle?: boolean;
};

export type TodayPlanRow = {
	taskId: RecapTaskId;
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
	footprints: Record<string, TaskFootprint>;
};
