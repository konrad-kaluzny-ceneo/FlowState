import { afterEach, describe, expect, it, vi } from "vitest";

import { defaultEisenhowerFields } from "~/lib/data-mode/types";
import { GUEST_STORAGE_KEY } from "~/lib/guest/schema";
import {
	clearGuestSnapshot,
	hasGuestData,
	loadSnapshot,
	mutateSnapshot,
	saveSnapshot,
	subscribeGuestStore,
} from "~/lib/guest/store";

describe("guest store", () => {
	afterEach(() => {
		localStorage.clear();
	});

	it("round-trips snapshot through localStorage", () => {
		const { snapshot, error } = mutateSnapshot((current) => ({
			...current,
			tasks: [
				{
					id: "550e8400-e29b-41d4-a716-446655440000",
					title: "Guest task",
					status: "active",
					workType: "OPERATIONAL",
					weight: 2,
					...defaultEisenhowerFields(2),
					sortOrder: 0,
					resumeNote: null,
					createdAt: new Date("2026-05-29T10:00:00.000Z"),
					updatedAt: null,
				},
			],
		}));

		expect(error).toBeNull();
		expect(loadSnapshot().tasks).toEqual(snapshot.tasks);
		expect(hasGuestData()).toBe(true);
	});

	it("clearGuestSnapshot removes data", () => {
		mutateSnapshot((current) => ({
			...current,
			tasks: [
				{
					id: "550e8400-e29b-41d4-a716-446655440000",
					title: "Guest task",
					status: "active",
					workType: "OPERATIONAL",
					weight: 2,
					...defaultEisenhowerFields(2),
					sortOrder: 0,
					resumeNote: null,
					createdAt: new Date(),
					updatedAt: null,
				},
			],
		}));

		clearGuestSnapshot();

		expect(hasGuestData()).toBe(false);
		expect(localStorage.getItem(GUEST_STORAGE_KEY)).toBeNull();
	});

	it("notifies subscribers on save and clear", () => {
		const listener = vi.fn();
		const unsubscribe = subscribeGuestStore(listener);

		saveSnapshot({
			version: 1,
			tasks: [],
			sessions: [],
			cycles: [],
		});
		expect(listener).toHaveBeenCalledTimes(1);

		clearGuestSnapshot();
		expect(listener).toHaveBeenCalledTimes(2);

		unsubscribe();
	});

	it("returns user-visible error when localStorage.setItem throws", () => {
		const setItem = vi
			.spyOn(Storage.prototype, "setItem")
			.mockImplementation(() => {
				throw new Error("quota exceeded");
			});

		const error = saveSnapshot({
			version: 1,
			tasks: [],
			sessions: [],
			cycles: [],
		});

		expect(error).toMatch(/Could not save your work locally/);
		setItem.mockRestore();
	});
});
