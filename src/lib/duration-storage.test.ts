import { beforeEach, describe, expect, it } from "vitest";

import {
	DEFAULT_DURATION_SEC,
	DEFAULT_LONG_BREAK_SEC,
	DEFAULT_SHORT_BREAK_SEC,
	getLastDuration,
	getLongBreakDuration,
	getShortBreakDuration,
	setLastDuration,
	setLongBreakDuration,
	setShortBreakDuration,
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

	it("round-trips 1 second minimum", () => {
		setLastDuration(1);
		expect(getLastDuration()).toBe(1);
	});

	it("returns default for corrupt stored values", () => {
		localStorage.setItem("flowstate:lastDurationSec", "not-a-number");
		expect(getLastDuration()).toBe(DEFAULT_DURATION_SEC);

		localStorage.setItem("flowstate:lastDurationSec", "0");
		expect(getLastDuration()).toBe(DEFAULT_DURATION_SEC);
	});

	it("reads sub-minute stored values", () => {
		localStorage.setItem("flowstate:lastDurationSec", "30");
		expect(getLastDuration()).toBe(30);
	});

	it("clamps out-of-range values on write", () => {
		setLastDuration(60 * 60);
		expect(getLastDuration()).toBe(60 * 60);

		setLastDuration(0);
		expect(getLastDuration()).toBe(1);

		setLastDuration(10_000);
		expect(getLastDuration()).toBe(90 * 60);
	});
});

describe("short break duration storage", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it("returns default (5 min) when nothing stored", () => {
		expect(getShortBreakDuration()).toBe(DEFAULT_SHORT_BREAK_SEC);
	});

	it("round-trips a valid short break duration", () => {
		setShortBreakDuration(10 * 60);
		expect(getShortBreakDuration()).toBe(10 * 60);
	});

	it("returns default for corrupt stored values", () => {
		localStorage.setItem("flowstate:shortBreakDurationSec", "not-a-number");
		expect(getShortBreakDuration()).toBe(DEFAULT_SHORT_BREAK_SEC);
	});

	it("returns default for out-of-range stored values", () => {
		localStorage.setItem("flowstate:shortBreakDurationSec", "30");
		expect(getShortBreakDuration()).toBe(DEFAULT_SHORT_BREAK_SEC);

		localStorage.setItem("flowstate:shortBreakDurationSec", "3600");
		expect(getShortBreakDuration()).toBe(DEFAULT_SHORT_BREAK_SEC);
	});

	it("clamps out-of-range values on write", () => {
		setShortBreakDuration(0);
		expect(getShortBreakDuration()).toBe(1 * 60);

		setShortBreakDuration(60 * 60);
		expect(getShortBreakDuration()).toBe(30 * 60);
	});
});

describe("long break duration storage", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it("returns default (15 min) when nothing stored", () => {
		expect(getLongBreakDuration()).toBe(DEFAULT_LONG_BREAK_SEC);
	});

	it("round-trips a valid long break duration", () => {
		setLongBreakDuration(20 * 60);
		expect(getLongBreakDuration()).toBe(20 * 60);
	});

	it("returns default for corrupt stored values", () => {
		localStorage.setItem("flowstate:longBreakDurationSec", "not-a-number");
		expect(getLongBreakDuration()).toBe(DEFAULT_LONG_BREAK_SEC);
	});

	it("returns default for out-of-range stored values", () => {
		localStorage.setItem("flowstate:longBreakDurationSec", "30");
		expect(getLongBreakDuration()).toBe(DEFAULT_LONG_BREAK_SEC);

		localStorage.setItem("flowstate:longBreakDurationSec", "3600");
		expect(getLongBreakDuration()).toBe(DEFAULT_LONG_BREAK_SEC);
	});

	it("clamps out-of-range values on write", () => {
		setLongBreakDuration(0);
		expect(getLongBreakDuration()).toBe(1 * 60);

		setLongBreakDuration(60 * 60);
		expect(getLongBreakDuration()).toBe(30 * 60);
	});
});
