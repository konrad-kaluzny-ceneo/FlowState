import { afterEach, describe, expect, it } from "vitest";
import {
	GUEST_IMPORT_ATTEMPTED_KEY,
	getGuestSnapshotStorageKey,
	markGuestImportAttempted,
	markGuestImportDone,
	shouldRunGuestImport,
} from "~/lib/guest/import-guard";
import { GUEST_STORAGE_KEY } from "~/lib/guest/schema";
import { mutateSnapshot } from "~/lib/guest/store";

describe("guest import guard", () => {
	afterEach(() => {
		localStorage.clear();
		sessionStorage.clear();
	});

	it("allows import when guest blob exists and was not attempted", () => {
		mutateSnapshot((current) => ({
			...current,
			tasks: [
				{
					id: "550e8400-e29b-41d4-a716-446655440000",
					title: "Guest task",
					status: "active",
					workType: "OPERATIONAL",
					weight: 2,
					createdAt: new Date(),
					updatedAt: null,
				},
			],
		}));

		expect(shouldRunGuestImport()).toBe(true);
	});

	it("blocks import after a successful import for the same blob", () => {
		mutateSnapshot((current) => ({
			...current,
			tasks: [
				{
					id: "550e8400-e29b-41d4-a716-446655440000",
					title: "Guest task",
					status: "active",
					workType: "OPERATIONAL",
					weight: 2,
					createdAt: new Date(),
					updatedAt: null,
				},
			],
		}));

		markGuestImportDone();

		expect(shouldRunGuestImport()).toBe(false);
	});

	it("blocks import after a failed attempt for the same blob", () => {
		mutateSnapshot((current) => ({
			...current,
			tasks: [
				{
					id: "550e8400-e29b-41d4-a716-446655440000",
					title: "Guest task",
					status: "active",
					workType: "OPERATIONAL",
					weight: 2,
					createdAt: new Date(),
					updatedAt: null,
				},
			],
		}));

		markGuestImportAttempted();

		expect(shouldRunGuestImport()).toBe(false);
	});

	it("uses the raw localStorage key for attempt tracking", () => {
		mutateSnapshot((current) => ({
			...current,
			tasks: [
				{
					id: "550e8400-e29b-41d4-a716-446655440000",
					title: "Guest task",
					status: "active",
					workType: "OPERATIONAL",
					weight: 2,
					createdAt: new Date(),
					updatedAt: null,
				},
			],
		}));

		const storageKey = getGuestSnapshotStorageKey();
		expect(storageKey).toBe(localStorage.getItem(GUEST_STORAGE_KEY));

		markGuestImportAttempted();
		expect(sessionStorage.getItem(GUEST_IMPORT_ATTEMPTED_KEY)).toBe(storageKey);
	});
});
