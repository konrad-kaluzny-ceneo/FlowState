import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { GUEST_STORAGE_KEY } from "~/lib/guest/schema";
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
});
