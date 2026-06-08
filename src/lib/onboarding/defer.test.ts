import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/lib/guest/store", () => ({
	hasGuestData: vi.fn(() => false),
}));

import { hasGuestData } from "~/lib/guest/store";

import {
	resetDeferStateForTests,
	setImportInFlight,
	setMergeSuccessVisible,
	shouldDeferFirstRun,
	subscribeDeferState,
} from "./defer";

describe("shouldDeferFirstRun", () => {
	beforeEach(() => {
		resetDeferStateForTests();
		vi.mocked(hasGuestData).mockReturnValue(false);
	});

	afterEach(() => {
		resetDeferStateForTests();
	});

	it("returns false when all defer conditions are false", () => {
		expect(shouldDeferFirstRun()).toBe(false);
	});

	it("defers when guest blob has data", () => {
		vi.mocked(hasGuestData).mockReturnValue(true);
		expect(shouldDeferFirstRun()).toBe(true);
	});

	it("defers when import is in-flight", () => {
		setImportInFlight(true);
		expect(shouldDeferFirstRun()).toBe(true);
	});

	it("defers when merge-success modal is visible", () => {
		setMergeSuccessVisible(true);
		expect(shouldDeferFirstRun()).toBe(true);
	});

	it("defers after guest blob cleared but merge-success still visible", () => {
		vi.mocked(hasGuestData).mockReturnValue(false);
		setMergeSuccessVisible(true);
		expect(shouldDeferFirstRun()).toBe(true);
	});
});

describe("subscribeDeferState", () => {
	beforeEach(() => {
		resetDeferStateForTests();
		vi.mocked(hasGuestData).mockReturnValue(false);
	});

	afterEach(() => {
		resetDeferStateForTests();
	});

	it("notifies listener when import in-flight toggles", () => {
		const listener = vi.fn();
		const unsubscribe = subscribeDeferState(listener);

		setImportInFlight(true);
		expect(listener).toHaveBeenCalledTimes(1);

		setImportInFlight(false);
		expect(listener).toHaveBeenCalledTimes(2);

		unsubscribe();
	});

	it("notifies listener when merge-success visibility toggles", () => {
		const listener = vi.fn();
		const unsubscribe = subscribeDeferState(listener);

		setMergeSuccessVisible(true);
		expect(listener).toHaveBeenCalledTimes(1);

		setMergeSuccessVisible(false);
		expect(listener).toHaveBeenCalledTimes(2);

		unsubscribe();
	});

	it("does not notify when setting the same value", () => {
		const listener = vi.fn();
		subscribeDeferState(listener);

		setImportInFlight(true);
		setImportInFlight(true);
		expect(listener).toHaveBeenCalledTimes(1);
	});

	it("unsubscribe stops notifications", () => {
		const listener = vi.fn();
		const unsubscribe = subscribeDeferState(listener);
		unsubscribe();

		setImportInFlight(true);
		expect(listener).not.toHaveBeenCalled();
	});
});

describe("resetDeferStateForTests", () => {
	beforeEach(() => {
		resetDeferStateForTests();
		vi.mocked(hasGuestData).mockReturnValue(false);
	});

	it("clears import in-flight and merge-success flags", () => {
		setImportInFlight(true);
		setMergeSuccessVisible(true);
		resetDeferStateForTests();
		expect(shouldDeferFirstRun()).toBe(false);
	});
});
