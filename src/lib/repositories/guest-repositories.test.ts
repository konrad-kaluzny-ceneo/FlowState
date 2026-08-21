import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { defaultEisenhowerFields } from "~/lib/data-mode/types";
import {
	createEmptyGuestSnapshot,
	GUEST_STORAGE_KEY,
	type GuestSnapshotV1,
} from "~/lib/guest/schema";
import { loadSnapshot, mutateSnapshot, saveSnapshot } from "~/lib/guest/store";
import { createGuestRepositories } from "~/lib/repositories/guest-repositories";
import {
	getStaleArchiveCutoff,
	STALE_TASK_ARCHIVE_DAYS,
} from "~/lib/task/stale-task-archive";
import {
	formatLocalDateKey,
	subtractLocalDateKey,
} from "~/lib/time/local-date-key";

const TODAY_KEY = formatLocalDateKey();

async function createActiveGuestTask(
	tasks: ReturnType<typeof createGuestRepositories>["tasks"],
	title: string,
) {
	const created = await tasks.create({ title });
	await tasks.update({ id: created.id, status: "active" });
	const list = await tasks.list();
	const updated = list.find((task) => task.id === created.id);
	if (updated == null) {
		throw new Error(`Expected active task ${String(created.id)}`);
	}
	return updated;
}

describe("guest repositories", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	afterEach(() => {
		localStorage.clear();
	});

	it("creates and lists tasks in localStorage", async () => {
		const { tasks } = createGuestRepositories();
		const created = await tasks.create({ title: "Guest task" });
		const list = await tasks.list();

		expect(list).toHaveLength(1);
		expect(list[0]?.title).toBe("Guest task");
		expect(typeof created.id).toBe("string");
		expect(localStorage.getItem(GUEST_STORAGE_KEY)).toContain("Guest task");
	});

	it("round-trips personaPresetId on guest task create and list", async () => {
		const { tasks } = createGuestRepositories();
		await tasks.create({
			title: "Preset guest task",
			workType: "OPERATIONAL",
			urgency: 2,
			importance: 2,
			effortMinutes: 15,
			commitmentHorizon: "WHEN_POSSIBLE",
			personaPresetId: "synchro",
		});

		const list = await tasks.list();
		expect(list[0]?.personaPresetId).toBe("synchro");
		expect(list[0]?.effortMinutes).toBe(15);
	});

	it("creates normal and daily-standing tasks as planned", async () => {
		const { tasks } = createGuestRepositories();
		const backlog = await tasks.create({ title: "Backlog item" });
		const standing = await tasks.create({
			title: "Standing item",
			isDailyStanding: true,
		});

		expect(backlog.status).toBe("planned");
		expect(standing.status).toBe("planned");
		expect(standing.isDailyStanding).toBe(true);
	});

	it("promotes a planned task to active when a WORK cycle focuses it", async () => {
		const { tasks, cycles } = createGuestRepositories();
		const task = await tasks.create({ title: "Backlog item" });
		expect(task.status).toBe("planned");

		await cycles.create({
			kind: "WORK",
			configuredDurationSec: 900,
			taskId: task.id,
		});

		const list = await tasks.list();
		expect(list.find((t) => t.id === task.id)?.status).toBe("active");
	});

	it("starts and retrieves an active cycle", async () => {
		const { tasks, cycles } = createGuestRepositories();
		const task = await tasks.create({ title: "Focus me" });

		const cycle = await cycles.create({
			kind: "WORK",
			configuredDurationSec: 900,
			taskId: task.id,
		});

		const active = await cycles.getActive({ localDateKey: TODAY_KEY });
		expect(active?.id).toBe(cycle.id);
		expect(active?.task?.title).toBe("Focus me");
	});

	it("returns active cycle after write then read (refresh round-trip)", async () => {
		const { tasks, cycles } = createGuestRepositories();
		const task = await tasks.create({ title: "Persist me" });
		await cycles.create({
			kind: "WORK",
			configuredDurationSec: 900,
			taskId: task.id,
		});

		const { cycles: cyclesAgain } = createGuestRepositories();
		const active = await cyclesAgain.getActive({ localDateKey: TODAY_KEY });

		expect(active?.state).toBe("RUNNING");
		expect(active?.task?.title).toBe("Persist me");
		expect(localStorage.getItem(GUEST_STORAGE_KEY)).toContain("Persist me");
	});

	it("pause and resume preserve remaining duration in guest storage", async () => {
		const { tasks, cycles } = createGuestRepositories();
		const task = await tasks.create({ title: "Pause me" });
		const created = await cycles.create({
			kind: "WORK",
			configuredDurationSec: 900,
			taskId: task.id,
		});

		const paused = await cycles.pause({
			cycleId: created.id,
			remainingDurationSec: 420,
		});
		expect(paused.state).toBe("PAUSED");
		expect(paused.remainingDurationSec).toBe(420);

		const activeWhilePaused = await cycles.getActive({
			localDateKey: TODAY_KEY,
		});
		expect(activeWhilePaused?.state).toBe("PAUSED");

		const resumed = await cycles.resume({ cycleId: created.id });
		expect(resumed.state).toBe("RUNNING");
		expect(resumed.pausedAt ?? null).toBeNull();
		expect(resumed.remainingDurationSec ?? null).toBeNull();
	});

	it("blocks create when a PAUSED cycle exists", async () => {
		const { tasks, cycles } = createGuestRepositories();
		const task = await tasks.create({ title: "Blocked" });
		const created = await cycles.create({
			kind: "WORK",
			configuredDurationSec: 900,
			taskId: task.id,
		});
		await cycles.pause({
			cycleId: created.id,
			remainingDurationSec: 300,
		});

		await expect(
			cycles.create({
				kind: "WORK",
				configuredDurationSec: 600,
				taskId: task.id,
			}),
		).rejects.toThrow("A cycle is already running");
	});

	it("returns expired RUNNING cycle for hook to complete on recovery", async () => {
		const sessionId = crypto.randomUUID();
		const taskId = crypto.randomUUID();
		const startedAt = new Date(Date.now() - 120_000);
		const snapshot: GuestSnapshotV1 = {
			...createEmptyGuestSnapshot(),
			tasks: [
				{
					id: taskId,
					title: "Stale guest",
					status: "active",
					workType: "OPERATIONAL",
					weight: 2,
					...defaultEisenhowerFields(2),
					sortOrder: 0,
					resumeNote: null,
					project: null,
					createdAt: startedAt,
					updatedAt: null,
				},
			],
			sessions: [
				{
					id: sessionId,
					state: "ACTIVE",
					startedAt,
					endedAt: null,
					lastActivityAt: startedAt,
					interruptionCount: 0,
				},
			],
			cycles: [
				{
					id: crypto.randomUUID(),
					sessionId,
					taskId,
					kind: "WORK",
					state: "RUNNING",
					configuredDurationSec: 60,
					startedAt,
					endedAt: null,
				},
			],
		};
		saveSnapshot(snapshot);

		const { cycles } = createGuestRepositories();
		const active = await cycles.getActive({ localDateKey: TODAY_KEY });

		expect(active?.state).toBe("RUNNING");
		expect(active?.startedAt).toEqual(startedAt);
		expect(active).not.toBeNull();
		if (active == null) {
			return;
		}
		expect(
			active.startedAt.getTime() + active.configuredDurationSec * 1000,
		).toBeLessThan(Date.now());
	});

	it("appends new tasks at the tail sortOrder", async () => {
		const { tasks } = createGuestRepositories();
		const first = await createActiveGuestTask(tasks, "First");
		const second = await createActiveGuestTask(tasks, "Second");

		expect(first.sortOrder).toBe(0);
		expect(second.sortOrder).toBe(1);

		const list = await tasks.list();
		expect(list.map((task) => task.title)).toEqual(["First", "Second"]);
	});

	it("reorders active tasks and persists sortOrder in snapshot", async () => {
		const { tasks } = createGuestRepositories();
		const first = await createActiveGuestTask(tasks, "First");
		const second = await createActiveGuestTask(tasks, "Second");
		const third = await createActiveGuestTask(tasks, "Third");

		await tasks.reorder({
			orderedIds: [third.id, first.id, second.id],
		});

		const list = await tasks.list();
		expect(list.map((task) => task.title)).toEqual([
			"Third",
			"First",
			"Second",
		]);
		expect(list.map((task) => task.sortOrder)).toEqual([0, 1, 2]);

		const raw = JSON.parse(localStorage.getItem(GUEST_STORAGE_KEY) ?? "{}");
		const titlesBySortOrder = [...raw.tasks]
			.sort(
				(
					a: { sortOrder: number; createdAt: string },
					b: { sortOrder: number; createdAt: string },
				) =>
					a.sortOrder !== b.sortOrder
						? a.sortOrder - b.sortOrder
						: new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
			)
			.map((task: { title: string }) => task.title);
		expect(titlesBySortOrder).toEqual(["Third", "First", "Second"]);
	});

	it("deletes a task from the guest snapshot", async () => {
		const { tasks } = createGuestRepositories();
		const created = await tasks.create({ title: "Delete me" });

		await tasks.delete({ id: created.id });

		const list = await tasks.list();
		expect(list).toHaveLength(0);
	});

	it("reactivates completed task at the tail sortOrder", async () => {
		const { tasks } = createGuestRepositories();
		const task = await createActiveGuestTask(tasks, "Reopen me");

		await tasks.update({ id: task.id, status: "completed" });
		await createActiveGuestTask(tasks, "Active tail");
		await tasks.update({ id: task.id, status: "active" });

		const list = await tasks.list();
		expect(list.map((item) => item.title)).toEqual([
			"Active tail",
			"Reopen me",
		]);
		expect(list[1]?.sortOrder).toBe(1);
	});

	it("sets a task to blocked and reads it back as blocked", async () => {
		const { tasks } = createGuestRepositories();
		const task = await createActiveGuestTask(tasks, "Block me");

		await tasks.update({ id: task.id, status: "blocked" });

		const list = await tasks.list();
		const blocked = list.find((item) => item.id === task.id);
		expect(blocked?.status).toBe("blocked");
	});

	it("reactivates blocked task at the tail sortOrder", async () => {
		const { tasks } = createGuestRepositories();
		const task = await createActiveGuestTask(tasks, "Unblock me");

		await tasks.update({ id: task.id, status: "blocked" });
		await createActiveGuestTask(tasks, "Active tail");
		await tasks.update({ id: task.id, status: "active" });

		const list = await tasks.list();
		const activeList = list.filter((item) => item.status === "active");
		expect(activeList.map((item) => item.title)).toEqual([
			"Active tail",
			"Unblock me",
		]);
		expect(activeList[1]?.sortOrder).toBe(1);
	});

	it("does not auto-archive a stale blocked task on list", async () => {
		const staleAt = new Date();
		staleAt.setDate(staleAt.getDate() - (STALE_TASK_ARCHIVE_DAYS + 1));
		saveSnapshot({
			...createEmptyGuestSnapshot(),
			tasks: [
				{
					id: crypto.randomUUID(),
					title: "Stale blocked",
					status: "blocked",
					workType: "OPERATIONAL",
					weight: 2,
					...defaultEisenhowerFields(2),
					sortOrder: 0,
					resumeNote: null,
					project: null,
					createdAt: staleAt,
					updatedAt: staleAt,
				},
			],
		});

		const { tasks } = createGuestRepositories();
		const list = await tasks.list();
		expect(list.find((task) => task.title === "Stale blocked")?.status).toBe(
			"blocked",
		);
	});

	it("completes a running cycle and optionally marks task done", async () => {
		const { tasks, cycles } = createGuestRepositories();
		const task = await tasks.create({ title: "Complete me" });
		const cycle = await cycles.create({
			kind: "WORK",
			configuredDurationSec: 900,
			taskId: task.id,
		});

		await cycles.complete({ cycleId: cycle.id, markTaskDone: true });

		const active = await cycles.getActive({ localDateKey: TODAY_KEY });
		expect(active).toBeNull();

		const updatedTask = (await tasks.list()).find(
			(item) => item.id === task.id,
		);
		expect(updatedTask?.status).toBe("completed");
	});

	it("completes a running cycle and marks task blocked when markTaskBlocked", async () => {
		const { tasks, cycles } = createGuestRepositories();
		const task = await tasks.create({ title: "Block me" });
		const cycle = await cycles.create({
			kind: "WORK",
			configuredDurationSec: 900,
			taskId: task.id,
		});

		await cycles.complete({ cycleId: cycle.id, markTaskBlocked: true });

		const active = await cycles.getActive({ localDateKey: TODAY_KEY });
		expect(active).toBeNull();

		const updatedTask = (await tasks.list()).find(
			(item) => item.id === task.id,
		);
		expect(updatedTask?.status).toBe("blocked");
	});

	it("rejects invalid reorder requests", async () => {
		const { tasks } = createGuestRepositories();
		const first = await createActiveGuestTask(tasks, "First");
		const second = await createActiveGuestTask(tasks, "Second");

		await expect(tasks.reorder({ orderedIds: [first.id] })).rejects.toThrow(
			"Invalid reorder",
		);
		await expect(
			tasks.reorder({ orderedIds: [first.id, first.id] }),
		).rejects.toThrow("Invalid reorder");
		await expect(
			tasks.reorder({ orderedIds: [first.id, "missing-id"] }),
		).rejects.toThrow("Task not found or not active");
		await expect(
			tasks.reorder({ orderedIds: [first.id, second.id, second.id] }),
		).rejects.toThrow("Invalid reorder");
	});

	it("returns cycle with null task when taskId is missing from snapshot", async () => {
		const sessionId = crypto.randomUUID();
		const startedAt = new Date();
		mutateSnapshot(() => ({
			...createEmptyGuestSnapshot(),
			sessions: [
				{
					id: sessionId,
					state: "ACTIVE",
					startedAt,
					endedAt: null,
					lastActivityAt: startedAt,
					interruptionCount: 0,
				},
			],
			cycles: [
				{
					id: crypto.randomUUID(),
					sessionId,
					taskId: crypto.randomUUID(),
					kind: "WORK",
					state: "RUNNING",
					configuredDurationSec: 900,
					startedAt,
					endedAt: null,
				},
			],
		}));

		const { cycles } = createGuestRepositories();
		const active = await cycles.getActive({ localDateKey: TODAY_KEY });

		expect(active?.task).toBeNull();
		expect(active?.taskId).not.toBeNull();
	});

	it("archives stale active non-standing tasks on list using updatedAt ?? createdAt", async () => {
		const cutoff = getStaleArchiveCutoff(new Date());
		const staleAt = new Date(cutoff);
		const freshAt = new Date(cutoff.getTime() + 60_000);
		saveSnapshot({
			...createEmptyGuestSnapshot(),
			tasks: [
				{
					id: crypto.randomUUID(),
					title: "Stale",
					status: "active",
					workType: "OPERATIONAL",
					weight: 2,
					...defaultEisenhowerFields(2),
					sortOrder: 0,
					resumeNote: null,
					project: null,
					createdAt: staleAt,
					updatedAt: staleAt,
				},
				{
					id: crypto.randomUUID(),
					title: "Fresh",
					status: "active",
					workType: "OPERATIONAL",
					weight: 2,
					...defaultEisenhowerFields(2),
					sortOrder: 1,
					resumeNote: null,
					project: null,
					createdAt: freshAt,
					updatedAt: freshAt,
				},
				{
					id: crypto.randomUUID(),
					title: "Standing stale",
					status: "active",
					workType: "OPERATIONAL",
					weight: 2,
					...defaultEisenhowerFields(2),
					isDailyStanding: true,
					sortOrder: 2,
					resumeNote: null,
					project: null,
					createdAt: new Date("2020-01-01"),
					updatedAt: new Date("2020-01-01"),
				},
			],
		});

		const { tasks } = createGuestRepositories();
		const list = await tasks.list();

		expect(list.find((task) => task.title === "Stale")?.status).toBe(
			"archived",
		);
		expect(
			list.find((task) => task.title === "Stale")?.archivedAt,
		).toBeInstanceOf(Date);
		expect(list.find((task) => task.title === "Fresh")?.status).toBe("active");
		expect(list.find((task) => task.title === "Standing stale")?.status).toBe(
			"active",
		);
	});

	it("restores archived task to active tail sort order", async () => {
		const archivedId = crypto.randomUUID();
		saveSnapshot({
			...createEmptyGuestSnapshot(),
			tasks: [
				{
					id: crypto.randomUUID(),
					title: "Active",
					status: "active",
					workType: "OPERATIONAL",
					weight: 2,
					...defaultEisenhowerFields(2),
					sortOrder: 0,
					resumeNote: null,
					project: null,
					createdAt: new Date(),
					updatedAt: null,
				},
				{
					id: archivedId,
					title: "Archived",
					status: "archived",
					workType: "OPERATIONAL",
					weight: 2,
					...defaultEisenhowerFields(2),
					sortOrder: 4,
					resumeNote: null,
					project: null,
					archivedAt: new Date("2026-06-20"),
					createdAt: new Date(),
					updatedAt: new Date(),
				},
			],
		});

		const { tasks } = createGuestRepositories();
		const restored = await tasks.restore({ id: archivedId });

		expect(restored).toMatchObject({
			id: archivedId,
			status: "active",
			archivedAt: null,
			sortOrder: 1,
		});

		const activeTitles = (await tasks.list())
			.filter((task) => task.status === "active")
			.map((task) => task.title);
		expect(activeTitles).toEqual(["Active", "Archived"]);
	});

	it("restored stale-archived task stays active after list sweep", async () => {
		const staleAt = new Date();
		staleAt.setDate(staleAt.getDate() - (STALE_TASK_ARCHIVE_DAYS + 1));
		const archivedId = crypto.randomUUID();
		saveSnapshot({
			...createEmptyGuestSnapshot(),
			tasks: [
				{
					id: archivedId,
					title: "Stale archived",
					status: "archived",
					workType: "OPERATIONAL",
					weight: 2,
					...defaultEisenhowerFields(2),
					sortOrder: 0,
					resumeNote: null,
					project: null,
					archivedAt: staleAt,
					createdAt: staleAt,
					updatedAt: staleAt,
				},
			],
		});

		const { tasks } = createGuestRepositories();
		await tasks.restore({ id: archivedId });

		const list = await tasks.list();
		expect(list.find((task) => task.id === archivedId)?.status).toBe("active");
	});

	it("deleteArchived removes only archived tasks and rejects mixed sets", async () => {
		const archivedA = crypto.randomUUID();
		const archivedB = crypto.randomUUID();
		const activeId = crypto.randomUUID();
		saveSnapshot({
			...createEmptyGuestSnapshot(),
			tasks: [
				{
					id: archivedA,
					title: "Archived A",
					status: "archived",
					workType: "OPERATIONAL",
					weight: 2,
					...defaultEisenhowerFields(2),
					sortOrder: 0,
					resumeNote: null,
					project: null,
					archivedAt: new Date("2026-06-10"),
					createdAt: new Date("2026-01-01"),
					updatedAt: null,
				},
				{
					id: archivedB,
					title: "Archived B",
					status: "archived",
					workType: "OPERATIONAL",
					weight: 2,
					...defaultEisenhowerFields(2),
					sortOrder: 1,
					resumeNote: null,
					project: null,
					archivedAt: new Date("2026-06-11"),
					createdAt: new Date("2026-01-02"),
					updatedAt: null,
				},
				{
					id: activeId,
					title: "Active",
					status: "active",
					workType: "OPERATIONAL",
					weight: 2,
					...defaultEisenhowerFields(2),
					sortOrder: 2,
					resumeNote: null,
					project: null,
					createdAt: new Date(),
					updatedAt: null,
				},
			],
		});

		const { tasks } = createGuestRepositories();
		const result = await tasks.deleteArchived({ ids: [archivedA, archivedB] });

		expect(result).toEqual({ deletedCount: 2 });
		const remaining = await tasks.list();
		expect(remaining.map((task) => task.id)).toEqual([activeId]);

		await expect(tasks.deleteArchived({ ids: [activeId] })).rejects.toThrow(
			"Only archived tasks can be deleted",
		);
	});
});

describe("guest repositories cross-day stale session", () => {
	const YESTERDAY_KEY = subtractLocalDateKey(TODAY_KEY, 1);

	function yesterdayAt(hour: number, minute = 0): Date {
		const date = new Date(`${YESTERDAY_KEY}T12:00:00`);
		date.setHours(hour, minute, 0, 0);
		return date;
	}

	function seedStaleBreakSession() {
		const sessionId = crypto.randomUUID();
		const cycleId = crypto.randomUUID();
		const lastActivityAt = yesterdayAt(23, 30);

		saveSnapshot({
			...createEmptyGuestSnapshot(),
			sessions: [
				{
					id: sessionId,
					state: "ACTIVE",
					startedAt: yesterdayAt(9),
					endedAt: null,
					lastActivityAt,
					interruptionCount: 0,
				},
			],
			cycles: [
				{
					id: cycleId,
					sessionId,
					taskId: null,
					kind: "SHORT_BREAK",
					state: "RUNNING",
					configuredDurationSec: 300,
					startedAt: lastActivityAt,
					endedAt: null,
				},
			],
		});

		return { sessionId, cycleId };
	}

	beforeEach(() => {
		localStorage.clear();
	});

	afterEach(() => {
		localStorage.clear();
	});

	it("getActive closes cross-day stale break and returns null", async () => {
		const { sessionId, cycleId } = seedStaleBreakSession();
		const { cycles } = createGuestRepositories();

		const result = await cycles.getActive({ localDateKey: TODAY_KEY });

		expect(result).toBeNull();
		const snapshot = loadSnapshot();
		expect(
			snapshot.sessions.find((session) => session.id === sessionId)?.state,
		).toBe("ENDED_BY_CROSS_DAY");
		expect(
			snapshot.sessions.find((session) => session.id === sessionId)
				?.closureLine,
		).toBeTruthy();
		expect(snapshot.cycles.find((cycle) => cycle.id === cycleId)?.state).toBe(
			"INTERRUPTED",
		);
		expect(
			snapshot.cycles.find((cycle) => cycle.id === cycleId)?.endedAt,
		).not.toBeNull();
	});

	it("getOrCreateActive closes stale session and creates a fresh active session", async () => {
		seedStaleBreakSession();
		const { sessions } = createGuestRepositories();

		const session = await sessions.getOrCreateActive();

		expect(session.state).toBe("ACTIVE");
		const snapshot = loadSnapshot();
		expect(
			snapshot.sessions.filter((entry) => entry.state === "ACTIVE"),
		).toHaveLength(1);
		expect(
			snapshot.sessions.filter((entry) => entry.state === "ACTIVE")[0]?.id,
		).toBe(session.id);
		expect(
			snapshot.sessions.filter((entry) => entry.state === "ENDED_BY_CROSS_DAY"),
		).toHaveLength(1);
	});

	it("same-day active break is returned unchanged", async () => {
		const sessionId = crypto.randomUUID();
		const cycleId = crypto.randomUUID();
		const now = new Date();

		saveSnapshot({
			...createEmptyGuestSnapshot(),
			sessions: [
				{
					id: sessionId,
					state: "ACTIVE",
					startedAt: now,
					endedAt: null,
					lastActivityAt: now,
					interruptionCount: 0,
				},
			],
			cycles: [
				{
					id: cycleId,
					sessionId,
					taskId: null,
					kind: "SHORT_BREAK",
					state: "RUNNING",
					configuredDurationSec: 300,
					startedAt: now,
					endedAt: null,
				},
			],
		});

		const { cycles } = createGuestRepositories();
		const result = await cycles.getActive({ localDateKey: TODAY_KEY });

		expect(result).toMatchObject({
			id: cycleId,
			kind: "SHORT_BREAK",
			state: "RUNNING",
		});
		expect(
			loadSnapshot().sessions.find((session) => session.id === sessionId)
				?.state,
		).toBe("ACTIVE");
	});

	it("preserves prior-day completed work minutes after cross-day interrupt (S-52)", async () => {
		const sessionId = crypto.randomUUID();
		const workCycleId = crypto.randomUUID();
		const breakCycleId = crypto.randomUUID();
		const taskId = crypto.randomUUID();
		const workStarted = yesterdayAt(10);
		const workEnded = new Date(workStarted.getTime() + 20 * 60 * 1000);
		const breakStarted = yesterdayAt(10, 25);

		saveSnapshot({
			...createEmptyGuestSnapshot(),
			tasks: [
				{
					id: taskId,
					title: "Yesterday work",
					status: "active",
					workType: "DEEP_WORK",
					weight: 2,
					...defaultEisenhowerFields(2),
					sortOrder: 0,
					resumeNote: null,
					project: null,
					createdAt: workStarted,
					updatedAt: null,
				},
			],
			sessions: [
				{
					id: sessionId,
					state: "ACTIVE",
					startedAt: yesterdayAt(9),
					endedAt: null,
					lastActivityAt: breakStarted,
					interruptionCount: 0,
				},
			],
			cycles: [
				{
					id: workCycleId,
					sessionId,
					taskId,
					kind: "WORK",
					state: "COMPLETED",
					configuredDurationSec: 1500,
					startedAt: workStarted,
					endedAt: workEnded,
				},
				{
					id: breakCycleId,
					sessionId,
					taskId: null,
					kind: "SHORT_BREAK",
					state: "RUNNING",
					configuredDurationSec: 300,
					startedAt: breakStarted,
					endedAt: null,
				},
			],
		});

		const { cycles, recap } = createGuestRepositories();
		await cycles.getActive({ localDateKey: TODAY_KEY });

		const snapshot = loadSnapshot();
		const workCycle = snapshot.cycles.find((cycle) => cycle.id === workCycleId);
		expect(workCycle?.state).toBe("COMPLETED");

		const yesterdayKey = formatLocalDateKey(workStarted);
		const trend = await recap.getTrendStats({
			todayLocalMidnightUtc: new Date(),
			todayLocalDateKey: TODAY_KEY,
			windowDays: 7,
		});
		const yesterdayPoint = trend.find(
			(point) => point.localDateKey === yesterdayKey,
		);
		expect(yesterdayPoint?.focusMinutes).toBe(20);
	});

	it("schedule stub throws because guest mode has no calendar", async () => {
		const { schedule } = createGuestRepositories();
		expect(() => schedule.listBlocks(TODAY_KEY)).toThrow(
			"Schedule not available in guest mode",
		);
	});
});
