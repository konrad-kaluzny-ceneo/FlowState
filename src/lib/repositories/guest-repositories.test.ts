import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { defaultEisenhowerFields } from "~/lib/data-mode/types";
import {
	createEmptyGuestSnapshot,
	GUEST_STORAGE_KEY,
	type GuestSnapshotV1,
} from "~/lib/guest/schema";
import { mutateSnapshot, saveSnapshot } from "~/lib/guest/store";
import { createGuestRepositories } from "~/lib/repositories/guest-repositories";
import { getStaleArchiveCutoff } from "~/lib/task/stale-task-archive";

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

	it("starts and retrieves an active cycle", async () => {
		const { tasks, cycles } = createGuestRepositories();
		const task = await tasks.create({ title: "Focus me" });

		const cycle = await cycles.create({
			kind: "WORK",
			configuredDurationSec: 900,
			taskId: task.id,
		});

		const active = await cycles.getActive();
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
		const active = await cyclesAgain.getActive();

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

		const activeWhilePaused = await cycles.getActive();
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
		const active = await cycles.getActive();

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
		const first = await tasks.create({ title: "First" });
		const second = await tasks.create({ title: "Second" });

		expect(first.sortOrder).toBe(0);
		expect(second.sortOrder).toBe(1);

		const list = await tasks.list();
		expect(list.map((task) => task.title)).toEqual(["First", "Second"]);
	});

	it("reorders active tasks and persists sortOrder in snapshot", async () => {
		const { tasks } = createGuestRepositories();
		const first = await tasks.create({ title: "First" });
		const second = await tasks.create({ title: "Second" });
		const third = await tasks.create({ title: "Third" });

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
		const task = await tasks.create({ title: "Reopen me" });

		await tasks.update({ id: task.id, status: "completed" });
		await tasks.create({ title: "Active tail" });
		await tasks.update({ id: task.id, status: "active" });

		const list = await tasks.list();
		expect(list.map((item) => item.title)).toEqual([
			"Active tail",
			"Reopen me",
		]);
		expect(list[1]?.sortOrder).toBe(1);
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

		const active = await cycles.getActive();
		expect(active).toBeNull();

		const updatedTask = (await tasks.list()).find(
			(item) => item.id === task.id,
		);
		expect(updatedTask?.status).toBe("completed");
	});

	it("rejects invalid reorder requests", async () => {
		const { tasks } = createGuestRepositories();
		const first = await tasks.create({ title: "First" });
		const second = await tasks.create({ title: "Second" });

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
		const active = await cycles.getActive();

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
