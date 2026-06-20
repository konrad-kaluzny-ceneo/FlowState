import { beforeEach, describe, expect, it, vi } from "vitest";

type CycleRecord = {
	id: number;
	sessionId: number;
	userId: string;
	taskId: number | null;
	kind: "WORK" | "SHORT_BREAK" | "LONG_BREAK";
	state: "RUNNING" | "PAUSED" | "COMPLETED" | "INTERRUPTED";
	endedAt: Date | null;
	startedAt: Date;
};

type CheckInRecord = {
	cycleId: number;
	userId: string;
	energy: "FOCUSED" | "STEADY" | "FADING";
	respondedAt: Date;
};

type TaskRecord = {
	id: number;
	status: string;
};

let cycles: CycleRecord[] = [];
let checkIns: CheckInRecord[] = [];
let tasks: TaskRecord[] = [];

vi.mock("~/server/db/index", () => ({
	db: {
		cycle: {
			findFirst: vi.fn(
				(args: {
					where: {
						userId?: string;
						sessionId?: number;
						kind?: string;
						state?: { in: string[] };
						taskId?: { not: null };
					};
					orderBy?:
						| { startedAt: "desc" }
						| Array<{ endedAt: "desc" } | { startedAt: "desc" }>;
					select: { taskId: true };
				}) => {
					const matching = cycles.filter((cycle) => {
						if (
							args.where.userId != null &&
							cycle.userId !== args.where.userId
						) {
							return false;
						}
						if (
							args.where.sessionId != null &&
							cycle.sessionId !== args.where.sessionId
						) {
							return false;
						}
						if (args.where.kind != null && cycle.kind !== args.where.kind) {
							return false;
						}
						if (args.where.state?.in != null) {
							if (!args.where.state.in.includes(cycle.state)) {
								return false;
							}
						}
						if (args.where.taskId?.not === null && cycle.taskId == null) {
							return false;
						}
						return true;
					});

					if (Array.isArray(args.orderBy)) {
						matching.sort((a, b) => {
							const endedDiff =
								(b.endedAt?.getTime() ?? 0) - (a.endedAt?.getTime() ?? 0);
							if (endedDiff !== 0) {
								return endedDiff;
							}
							return b.startedAt.getTime() - a.startedAt.getTime();
						});
					} else if (args.orderBy?.startedAt === "desc") {
						matching.sort(
							(a, b) => b.startedAt.getTime() - a.startedAt.getTime(),
						);
					}

					const latest = matching[0];
					return Promise.resolve(
						latest != null ? { taskId: latest.taskId } : null,
					);
				},
			),
			count: vi.fn(
				(args: {
					where: {
						userId?: string;
						sessionId?: number;
						kind?: string;
						state?: string;
						task?: { status: string };
					};
				}) => {
					const matching = cycles.filter((cycle) => {
						if (
							args.where.userId != null &&
							cycle.userId !== args.where.userId
						) {
							return false;
						}
						if (
							args.where.sessionId != null &&
							cycle.sessionId !== args.where.sessionId
						) {
							return false;
						}
						if (args.where.kind != null && cycle.kind !== args.where.kind) {
							return false;
						}
						if (args.where.state != null && cycle.state !== args.where.state) {
							return false;
						}
						if (args.where.task?.status != null) {
							const task = tasks.find((t) => t.id === cycle.taskId);
							if (task?.status !== args.where.task.status) {
								return false;
							}
						}
						return true;
					});
					return Promise.resolve(matching.length);
				},
			),
		},
		checkIn: {
			findFirst: vi.fn(
				(args: {
					where: {
						userId?: string;
						cycle?: { sessionId?: number };
					};
					orderBy?: { respondedAt: "desc" };
					select?: { energy: true };
				}) => {
					const matching = checkIns.filter((checkIn) => {
						if (
							args.where.userId != null &&
							checkIn.userId !== args.where.userId
						) {
							return false;
						}
						const cycle = cycles.find((c) => c.id === checkIn.cycleId);
						if (
							args.where.cycle?.sessionId != null &&
							cycle?.sessionId !== args.where.cycle.sessionId
						) {
							return false;
						}
						return true;
					});

					if (args.orderBy?.respondedAt === "desc") {
						matching.sort(
							(a, b) => b.respondedAt.getTime() - a.respondedAt.getTime(),
						);
					}

					const latest = matching[0];
					return Promise.resolve(
						latest != null ? { energy: latest.energy } : null,
					);
				},
			),
		},
	},
}));

const { computeSessionEndMetadata } = await import(
	"~/server/api/lib/session-end-metadata"
);
const { db } = await import("~/server/db/index");

const USER_ID = "user-session-end";
const SESSION_ID = 10;

describe("computeSessionEndMetadata", () => {
	beforeEach(() => {
		cycles = [];
		checkIns = [];
		tasks = [];
		vi.clearAllMocks();
	});

	it("builds closure line from completed work cycles and latest check-in", async () => {
		cycles = [
			{
				id: 1,
				sessionId: SESSION_ID,
				userId: USER_ID,
				taskId: 7,
				kind: "WORK",
				state: "COMPLETED",
				endedAt: new Date("2025-01-02"),
				startedAt: new Date("2025-01-01"),
			},
			{
				id: 2,
				sessionId: SESSION_ID,
				userId: USER_ID,
				taskId: 8,
				kind: "WORK",
				state: "COMPLETED",
				endedAt: new Date("2025-01-03"),
				startedAt: new Date("2025-01-02"),
			},
		];
		tasks = [
			{ id: 7, status: "active" },
			{ id: 8, status: "completed" },
		];
		checkIns = [
			{
				cycleId: 2,
				userId: USER_ID,
				energy: "FOCUSED",
				respondedAt: new Date("2025-01-03"),
			},
		];

		const result = await computeSessionEndMetadata(
			db as never,
			USER_ID,
			SESSION_ID,
			"timeout",
		);

		expect(result.closureLine).toBe(
			"Session complete — 2 cycles, 1 task done. Feeling focused.",
		);
		expect(result.lastFocusedTaskId).toBe(8);
	});

	it("prefers the active work cycle task for lastFocusedTaskId", async () => {
		cycles = [
			{
				id: 1,
				sessionId: SESSION_ID,
				userId: USER_ID,
				taskId: 7,
				kind: "WORK",
				state: "COMPLETED",
				endedAt: new Date("2025-01-02"),
				startedAt: new Date("2025-01-01"),
			},
			{
				id: 2,
				sessionId: SESSION_ID,
				userId: USER_ID,
				taskId: 9,
				kind: "WORK",
				state: "RUNNING",
				endedAt: null,
				startedAt: new Date("2025-01-03"),
			},
		];

		const result = await computeSessionEndMetadata(
			db as never,
			USER_ID,
			SESSION_ID,
			"timeout",
		);

		expect(result.lastFocusedTaskId).toBe(9);
	});
});
