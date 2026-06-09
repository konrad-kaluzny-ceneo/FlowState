import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
	createEmptyGuestSnapshot,
	GUEST_STORAGE_KEY,
	type GuestSnapshotV1,
} from "~/lib/guest/schema";
import { mutateSnapshot, saveSnapshot } from "~/lib/guest/store";
import { createGuestRepositories } from "~/lib/repositories/guest-repositories";

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
					sortOrder: 0,
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
});
