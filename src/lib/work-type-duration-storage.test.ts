import { beforeEach, describe, expect, it } from "vitest";

import { KICKOFF_PRESET_SEC } from "~/lib/duration-bounds";
import { DEFAULT_DURATION_SEC, setLastDuration } from "~/lib/duration-storage";

import {
	getWorkTypeDuration,
	resolveKickoffChipSec,
	setWorkTypeDuration,
} from "./work-type-duration-storage";

const guestScope = { mode: "guest" as const };
const userAScope = { mode: "authenticated" as const, userId: "user-a" };
const userBScope = { mode: "authenticated" as const, userId: "user-b" };

describe("work-type-duration-storage", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it("isolates guest and authenticated keys", () => {
		setWorkTypeDuration("DEEP_WORK", 40 * 60, guestScope);
		setWorkTypeDuration("DEEP_WORK", 50 * 60, userAScope);

		expect(getWorkTypeDuration("DEEP_WORK", guestScope)).toBe(40 * 60);
		expect(getWorkTypeDuration("DEEP_WORK", userAScope)).toBe(50 * 60);
		expect(getWorkTypeDuration("DEEP_WORK", userBScope)).toBeUndefined();
	});

	it("isolates authenticated users", () => {
		setWorkTypeDuration("OPERATIONAL", 20 * 60, userAScope);
		setWorkTypeDuration("OPERATIONAL", 22 * 60, userBScope);

		expect(getWorkTypeDuration("OPERATIONAL", userAScope)).toBe(20 * 60);
		expect(getWorkTypeDuration("OPERATIONAL", userBScope)).toBe(22 * 60);
	});

	it("remembered value overrides PRD default in resolveKickoffChipSec", () => {
		setWorkTypeDuration("REACTIVE", 12 * 60, guestScope);

		expect(resolveKickoffChipSec("REACTIVE", guestScope)).toBe(12 * 60);
		expect(resolveKickoffChipSec("DEEP_WORK", guestScope)).toBe(
			KICKOFF_PRESET_SEC.DEEP_WORK,
		);
	});

	it("falls back to PRD preset when nothing remembered", () => {
		expect(resolveKickoffChipSec("DEEP_WORK", guestScope)).toBe(
			KICKOFF_PRESET_SEC.DEEP_WORK,
		);
		expect(resolveKickoffChipSec("OPERATIONAL", guestScope)).toBe(
			KICKOFF_PRESET_SEC.OPERATIONAL,
		);
		expect(resolveKickoffChipSec("REACTIVE", guestScope)).toBe(
			KICKOFF_PRESET_SEC.REACTIVE,
		);
	});

	it("falls back to global last duration when preset missing", () => {
		setLastDuration(33 * 60);

		expect(resolveKickoffChipSec("DEEP_WORK", guestScope)).toBe(
			KICKOFF_PRESET_SEC.DEEP_WORK,
		);
	});

	it("clamps out-of-range writes", () => {
		setWorkTypeDuration("DEEP_WORK", 0, guestScope);
		expect(getWorkTypeDuration("DEEP_WORK", guestScope)).toBe(1);

		setWorkTypeDuration("DEEP_WORK", 10_000, guestScope);
		expect(getWorkTypeDuration("DEEP_WORK", guestScope)).toBe(90 * 60);
	});

	it("ignores corrupt stored values", () => {
		localStorage.setItem(
			"flowstate:workTypeDurationSec",
			JSON.stringify({ DEEP_WORK: "bad" }),
		);

		expect(getWorkTypeDuration("DEEP_WORK", guestScope)).toBeUndefined();
		expect(resolveKickoffChipSec("DEEP_WORK", guestScope)).toBe(
			KICKOFF_PRESET_SEC.DEEP_WORK,
		);
	});

	it("returns default global duration only via resolve fallback chain", () => {
		setLastDuration(30 * 60);
		expect(resolveKickoffChipSec("OPERATIONAL", guestScope)).toBe(
			KICKOFF_PRESET_SEC.OPERATIONAL,
		);
		expect(DEFAULT_DURATION_SEC).toBe(25 * 60);
	});
});
