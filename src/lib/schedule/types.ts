export const AXIS_START_MINUTE = 360;
export const AXIS_END_MINUTE = 1320;
export const SNAP_MINUTES = 15;

export type ScheduleBlockType =
	| "FOCUS"
	| "MEETING"
	| "BREAK"
	| "PERSONAL"
	| "PLANNING"
	| "BATCH";

export const scheduleBlockTypeSchema = [
	"FOCUS",
	"MEETING",
	"BREAK",
	"PERSONAL",
	"PLANNING",
	"BATCH",
] as const satisfies readonly ScheduleBlockType[];

export type GtdFixedContext = "PHONE" | "COMPUTER" | "OFFICE" | "ERRANDS";

export const gtdFixedContextSchema = [
	"PHONE",
	"COMPUTER",
	"OFFICE",
	"ERRANDS",
] as const satisfies readonly GtdFixedContext[];

export type DomainFocusTaskSummary = {
	id: number;
	title: string;
};

export type DomainScheduleBlock = {
	id: number;
	userId: string;
	localDateKey: string;
	blockType: ScheduleBlockType;
	startMinute: number;
	durationMinutes: number;
	metaLabel: string | null;
	fixedContext: GtdFixedContext | null;
	customContextTagId: number | null;
	contextLabel: string | null;
	focusTaskId: number | null;
	focusTask: DomainFocusTaskSummary | null;
	batchTaskIds: number[];
	createdAt: Date;
	updatedAt: Date;
};

export type MinuteInterval = {
	startMinute: number;
	durationMinutes: number;
};
