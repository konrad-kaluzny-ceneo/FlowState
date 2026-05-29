import { beforeEach, describe, expect, it } from "vitest";

import {
	DEFAULT_DURATION_SEC,
	getLastDuration,
	setLastDuration,
} from "./duration-storage";

describe("duration-storage", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it("returns default when nothing stored", () => {
		expect(getLastDuration()).toBe(DEFAULT_DURATION_SEC);
	});

	it("round-trips a valid duration", () => {
		setLastDuration(45 * 60);
		expect(getLastDuration()).toBe(45 * 60);
	});

	it("returns default for corrupt stored values", () => {
		localStorage.setItem("flowstate:lastDurationSec", "not-a-number");
		expect(getLastDuration()).toBe(DEFAULT_DURATION_SEC);

		localStorage.setItem("flowstate:lastDurationSec", "60");
		expect(getLastDuration()).toBe(DEFAULT_DURATION_SEC);
	});

	it("clamps out-of-range values on write", () => {
		setLastDuration(60 * 60);
		expect(getLastDuration()).toBe(60 * 60);

		setLastDuration(10_000);
		expect(getLastDuration()).toBe(90 * 60);
	});
});
